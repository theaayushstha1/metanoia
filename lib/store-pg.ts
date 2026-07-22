/**
 * Cloud SQL (Postgres) store. Correctness lives in the constraints + transactions:
 *  - recordAttempt is idempotent via the payment_id PK
 *  - a webhook's event insert dedupes via the event_id PK, in the same tx that
 *    settles the payment and upserts the subscription -> all-or-nothing
 *  - an unknown-payment success is retained (event row kept, processed=false), never
 *    marked processed and dropped
 */
import { and, eq, isNotNull } from "drizzle-orm";
import { getDb, type DB } from "@/lib/db/client";
import { attempts, subscriptions, credentials, events } from "@/lib/db/schema";
import {
  credentialFor,
  type Attempt,
  type Store,
  type WebhookInput,
  type WebhookOutcome,
} from "@/lib/db/store-contract";
import { getPlan } from "@/lib/catalog";
import type { ExistingSubscription } from "@/lib/agent/spendCap";

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

export class PgStore implements Store {
  async getSubscriptions(customerId: string): Promise<ExistingSubscription[]> {
    const db = await getDb();
    const rows = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.customerId, customerId), eq(subscriptions.active, true)));
    return rows.map((r) => ({
      plan_id: r.planId,
      merchant_name: r.merchantName,
      category: r.category,
      amount_cents: r.amountCents,
    }));
  }

  async recordAttempt(a: {
    paymentId: string;
    customerId: string;
    planId: string;
    amountCents: number;
  }): Promise<void> {
    const db = await getDb();
    await db
      .insert(attempts)
      .values({ ...a, status: "pending", updatedAt: Date.now() })
      .onConflictDoNothing();
  }

  async getAttempt(paymentId: string): Promise<Attempt | undefined> {
    const db = await getDb();
    const [r] = await db.select().from(attempts).where(eq(attempts.paymentId, paymentId)).limit(1);
    if (!r) return undefined;
    return {
      paymentId: r.paymentId,
      customerId: r.customerId,
      planId: r.planId,
      amountCents: r.amountCents,
      status: r.status as Attempt["status"],
      paymentMethodId: r.paymentMethodId ?? undefined,
      updatedAt: r.updatedAt,
    };
  }

  /** Settle a payment inside a tx. Returns true only on the first transition. */
  private async settleSucceeded(
    tx: Tx,
    paymentId: string,
    opts?: { updatedAt?: number; paymentMethodId?: string }
  ): Promise<boolean> {
    const [attempt] = await tx.select().from(attempts).where(eq(attempts.paymentId, paymentId)).limit(1);
    if (!attempt) return false;
    const ts = opts?.updatedAt ?? Date.now();
    if ((attempt.appliedEventTs ?? 0) > ts) return false; // stale/out-of-order

    const already = attempt.status === "succeeded";
    await tx
      .update(attempts)
      .set({
        status: "succeeded",
        paymentMethodId: opts?.paymentMethodId ?? attempt.paymentMethodId,
        appliedEventTs: ts,
        updatedAt: Date.now(),
      })
      .where(eq(attempts.paymentId, paymentId));
    if (already) return false;

    const plan = getPlan(attempt.planId);
    if (plan) {
      await tx
        .insert(subscriptions)
        .values({
          customerId: attempt.customerId,
          planId: plan.id,
          merchantName: plan.vendor,
          category: plan.category,
          amountCents: attempt.amountCents,
          active: true,
          updatedAt: Date.now(),
        })
        .onConflictDoUpdate({
          target: [subscriptions.customerId, subscriptions.planId],
          set: {
            merchantName: plan.vendor,
            category: plan.category,
            amountCents: attempt.amountCents,
            active: true,
            updatedAt: Date.now(),
          },
        });
      await tx
        .insert(credentials)
        .values({ credential: credentialFor(attempt.customerId, plan.id), customerId: attempt.customerId, planId: plan.id })
        .onConflictDoNothing();
    }
    return true;
  }

  async markPaymentSucceeded(
    paymentId: string,
    opts?: { updatedAt?: number; paymentMethodId?: string }
  ): Promise<void> {
    const db = await getDb();
    await db.transaction((tx) => this.settleSucceeded(tx, paymentId, opts));
  }

  async markPaymentFailed(paymentId: string): Promise<void> {
    const db = await getDb();
    await db
      .update(attempts)
      .set({ status: "failed", updatedAt: Date.now() })
      .where(and(eq(attempts.paymentId, paymentId), eq(attempts.status, "pending")));
  }

  async getSavedPaymentMethod(customerId: string, planId: string): Promise<string | undefined> {
    const db = await getDb();
    const [r] = await db
      .select({ pm: attempts.paymentMethodId })
      .from(attempts)
      .where(
        and(
          eq(attempts.customerId, customerId),
          eq(attempts.planId, planId),
          eq(attempts.status, "succeeded"),
          isNotNull(attempts.paymentMethodId)
        )
      )
      .limit(1);
    return r?.pm ?? undefined;
  }

  async getCredential(customerId: string, planId: string): Promise<string | undefined> {
    const db = await getDb();
    const [r] = await db
      .select({ c: credentials.credential })
      .from(credentials)
      .where(and(eq(credentials.customerId, customerId), eq(credentials.planId, planId)))
      .limit(1);
    return r?.c;
  }

  async resolveCredential(cred: string): Promise<{ customerId: string; planId: string } | undefined> {
    const db = await getDb();
    const [r] = await db.select().from(credentials).where(eq(credentials.credential, cred)).limit(1);
    return r ? { customerId: r.customerId, planId: r.planId } : undefined;
  }

  async processWebhook(input: WebhookInput): Promise<WebhookOutcome> {
    const db = await getDb();
    return db.transaction(async (tx): Promise<WebhookOutcome> => {
      // 1) dedupe + retain: the event insert is the dedupe. Conflict = already seen.
      if (input.eventId) {
        const inserted = await tx
          .insert(events)
          .values({
            eventId: input.eventId,
            eventType: input.eventType,
            paymentId: input.paymentId,
            raw: input.raw,
            processed: false,
            receivedAt: Date.now(),
          })
          .onConflictDoNothing()
          .returning({ id: events.eventId });
        if (inserted.length === 0) return { duplicate: true, applied: false };
      }

      // 2) act only on a payment_succeeded for a known attempt.
      let applied = false;
      let reason: string | undefined;
      if (input.eventType === "payment_succeeded" && input.paymentId) {
        applied = await this.settleSucceeded(tx, input.paymentId, {
          updatedAt: input.updatedAt,
          paymentMethodId: input.paymentMethodId,
        });
        if (!applied) reason = "unknown or already-applied payment (retained)";
      }

      // 3) mark processed only if we acted, or it's a non-actionable event we understand.
      // An unknown-payment success stays processed=false -> retained for reconciliation.
      const actionable = input.eventType === "payment_succeeded";
      const known = applied || !actionable;
      if (input.eventId && known) {
        await tx.update(events).set({ processed: true }).where(eq(events.eventId, input.eventId));
      }
      return { duplicate: false, applied, reason };
    });
  }

  async reset(): Promise<void> {
    const db = await getDb();
    await db.transaction(async (tx) => {
      await tx.delete(events);
      await tx.delete(credentials);
      await tx.delete(subscriptions);
      await tx.delete(attempts);
    });
  }
}
