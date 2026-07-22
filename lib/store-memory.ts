/**
 * In-memory store: the test backend and the local no-database fallback.
 *
 * It mirrors PgStore's semantics (idempotent recording, out-of-order guard, atomic
 * webhook handling, unknown events retained) so behavior is identical whether or
 * not Cloud SQL is configured — only durability and cross-instance safety differ.
 *
 * Local persistence: state is written to `.data/store.json` so it survives across
 * Next dev route contexts and restarts (that's how a credential issued on the
 * receipt render is visible to the provider route). Skipped under vitest, and on a
 * read-only serverless FS the write silently no-ops — that's exactly the case Cloud
 * SQL (PgStore) exists to handle in production.
 */
import fs from "node:fs";
import path from "node:path";
import { getPlan } from "@/lib/catalog";
import type { ExistingSubscription } from "@/lib/agent/spendCap";
import {
  credentialFor,
  type Attempt,
  type Store,
  type WebhookInput,
  type WebhookOutcome,
} from "@/lib/db/store-contract";

interface EventRow {
  eventType?: string;
  paymentId?: string;
  raw: unknown;
  processed: boolean;
  receivedAt: number;
}

const IN_TEST = Boolean(process.env.VITEST);
const DATA_DIR = process.env.METANOIA_DATA_DIR ?? path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

interface Snapshot {
  subscriptions: Record<string, ExistingSubscription[]>;
  attempts: Record<string, Attempt>;
  appliedEventTs: Record<string, number>;
  credentials: Record<string, { customerId: string; planId: string }>;
  events: Record<string, EventRow>;
}

export class InMemoryStore implements Store {
  private subscriptions = new Map<string, ExistingSubscription[]>();
  private attempts = new Map<string, Attempt>();
  private appliedEventTs = new Map<string, number>();
  private credentials = new Map<string, { customerId: string; planId: string }>();
  private events = new Map<string, EventRow>();

  constructor() {
    this.load();
  }

  private load(): void {
    if (IN_TEST) return;
    try {
      const s = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as Partial<Snapshot>;
      this.subscriptions = new Map(Object.entries(s.subscriptions ?? {}));
      this.attempts = new Map(Object.entries(s.attempts ?? {}));
      this.appliedEventTs = new Map(Object.entries(s.appliedEventTs ?? {}));
      this.credentials = new Map(Object.entries(s.credentials ?? {}));
      this.events = new Map(Object.entries(s.events ?? {}));
    } catch {
      // no file yet / unreadable -> start empty
    }
  }

  private save(): void {
    if (IN_TEST) return;
    const snap: Snapshot = {
      subscriptions: Object.fromEntries(this.subscriptions),
      attempts: Object.fromEntries(this.attempts),
      appliedEventTs: Object.fromEntries(this.appliedEventTs),
      credentials: Object.fromEntries(this.credentials),
      events: Object.fromEntries(this.events),
    };
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(snap));
    } catch {
      // read-only FS (serverless): keep in-memory. PgStore covers durability there.
    }
  }

  async getSubscriptions(customerId: string): Promise<ExistingSubscription[]> {
    this.load();
    return this.subscriptions.get(customerId) ?? [];
  }

  private upsertSubscription(customerId: string, sub: ExistingSubscription): void {
    const list = this.subscriptions.get(customerId) ?? [];
    const idx = list.findIndex((s) => s.plan_id === sub.plan_id);
    if (idx >= 0) list[idx] = sub;
    else list.push(sub);
    this.subscriptions.set(customerId, list);
  }

  async recordAttempt(a: {
    paymentId: string;
    customerId: string;
    planId: string;
    amountCents: number;
  }): Promise<void> {
    this.load();
    if (!this.attempts.has(a.paymentId)) {
      this.attempts.set(a.paymentId, { ...a, status: "pending", updatedAt: Date.now() });
      this.save();
    }
  }

  async getAttempt(paymentId: string): Promise<Attempt | undefined> {
    this.load();
    return this.attempts.get(paymentId);
  }

  /** Returns true if this call transitioned the attempt to succeeded (first time). */
  private settleSucceeded(
    paymentId: string,
    opts?: { updatedAt?: number; paymentMethodId?: string }
  ): boolean {
    const attempt = this.attempts.get(paymentId);
    if (!attempt) return false;
    const ts = opts?.updatedAt ?? Date.now();
    if ((this.appliedEventTs.get(paymentId) ?? 0) > ts) return false; // stale/out-of-order
    this.appliedEventTs.set(paymentId, ts);

    if (attempt.status === "succeeded") {
      if (opts?.paymentMethodId) attempt.paymentMethodId = opts.paymentMethodId;
      return false;
    }
    attempt.status = "succeeded";
    attempt.updatedAt = Date.now();
    if (opts?.paymentMethodId) attempt.paymentMethodId = opts.paymentMethodId;

    const plan = getPlan(attempt.planId);
    if (plan) {
      this.upsertSubscription(attempt.customerId, {
        plan_id: plan.id,
        merchant_name: plan.vendor,
        category: plan.category,
        amount_cents: attempt.amountCents,
      });
      const cred = credentialFor(attempt.customerId, plan.id);
      if (!this.credentials.has(cred)) this.credentials.set(cred, { customerId: attempt.customerId, planId: plan.id });
    }
    return true;
  }

  async markPaymentSucceeded(
    paymentId: string,
    opts?: { updatedAt?: number; paymentMethodId?: string }
  ): Promise<void> {
    this.load();
    this.settleSucceeded(paymentId, opts);
    this.save();
  }

  async markPaymentFailed(paymentId: string): Promise<void> {
    this.load();
    const attempt = this.attempts.get(paymentId);
    if (attempt && attempt.status === "pending") {
      attempt.status = "failed";
      attempt.updatedAt = Date.now();
      this.save();
    }
  }

  async getSavedPaymentMethod(customerId: string, planId: string): Promise<string | undefined> {
    this.load();
    for (const a of this.attempts.values()) {
      if (a.customerId === customerId && a.planId === planId && a.status === "succeeded" && a.paymentMethodId) {
        return a.paymentMethodId;
      }
    }
    return undefined;
  }

  async getCredential(customerId: string, planId: string): Promise<string | undefined> {
    this.load();
    for (const [cred, owner] of this.credentials) {
      if (owner.customerId === customerId && owner.planId === planId) return cred;
    }
    return undefined;
  }

  async resolveCredential(cred: string): Promise<{ customerId: string; planId: string } | undefined> {
    this.load();
    return this.credentials.get(cred);
  }

  async processWebhook(input: WebhookInput): Promise<WebhookOutcome> {
    this.load();
    if (input.eventId && this.events.has(input.eventId)) {
      return { duplicate: true, applied: false };
    }
    if (input.eventId) {
      this.events.set(input.eventId, {
        eventType: input.eventType,
        paymentId: input.paymentId,
        raw: input.raw,
        processed: false,
        receivedAt: Date.now(),
      });
    }

    let applied = false;
    let reason: string | undefined;
    if (input.eventType === "payment_succeeded" && input.paymentId) {
      applied = this.settleSucceeded(input.paymentId, {
        updatedAt: input.updatedAt,
        paymentMethodId: input.paymentMethodId,
      });
      if (!applied) reason = "unknown or already-applied payment (retained)";
    }

    const actionable = input.eventType === "payment_succeeded";
    const known = applied || !actionable;
    if (input.eventId && known) {
      const row = this.events.get(input.eventId);
      if (row) row.processed = true;
    }
    this.save();
    return { duplicate: false, applied, reason };
  }

  async reset(): Promise<void> {
    this.subscriptions.clear();
    this.attempts.clear();
    this.appliedEventTs.clear();
    this.credentials.clear();
    this.events.clear();
    this.save();
  }
}
