/**
 * Postgres preference memory (schema `memory.*`). Same Cloud SQL instance as the
 * payment ledger, but a separate schema and no cross-schema references.
 */
import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profileConsent, profileFacts, procurementEvents, profileSources } from "@/lib/db/memory-schema";
import type {
  EventAction,
  Fact,
  FactKind,
  MemorySnapshot,
  MemoryStore,
  ProcurementEvent,
  Source,
} from "@/lib/memory/contract";

export class PgMemoryStore implements MemoryStore {
  async getConsent(customerId: string): Promise<boolean> {
    const db = await getDb();
    const [r] = await db
      .select({ granted: profileConsent.granted })
      .from(profileConsent)
      .where(eq(profileConsent.customerId, customerId))
      .limit(1);
    return r?.granted ?? false;
  }

  async setConsent(customerId: string, granted: boolean): Promise<void> {
    const db = await getDb();
    await db
      .insert(profileConsent)
      .values({ customerId, granted, updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: profileConsent.customerId,
        set: { granted, updatedAt: Date.now() },
      });
  }

  async addFact(
    customerId: string,
    f: { kind: FactKind | string; key?: string; value: string; source?: string; confidence?: number }
  ): Promise<void> {
    if (!(await this.getConsent(customerId))) return;
    const db = await getDb();
    const existing = await db
      .select({ id: profileFacts.id })
      .from(profileFacts)
      .where(
        and(
          eq(profileFacts.customerId, customerId),
          eq(profileFacts.kind, f.kind),
          eq(profileFacts.value, f.value)
        )
      )
      .limit(1);
    if (existing.length) return; // dedupe on (kind, value)
    await db.insert(profileFacts).values({
      id: crypto.randomUUID(),
      customerId,
      kind: f.kind,
      key: f.key,
      value: f.value,
      source: f.source ?? "inferred",
      confidence: f.confidence ?? 0.7,
      createdAt: Date.now(),
    });
  }

  async addEvent(
    customerId: string,
    e: { capability: string; planId: string; action: EventAction; reason?: string; amountCents?: number }
  ): Promise<void> {
    if (!(await this.getConsent(customerId))) return;
    const db = await getDb();
    await db.insert(procurementEvents).values({
      id: crypto.randomUUID(),
      customerId,
      capability: e.capability,
      planId: e.planId,
      action: e.action,
      reason: e.reason,
      amountCents: e.amountCents,
      createdAt: Date.now(),
    });
  }

  async addSource(customerId: string, s: { kind: string; ref: string }): Promise<void> {
    if (!(await this.getConsent(customerId))) return;
    const db = await getDb();
    const existing = await db
      .select({ id: profileSources.id })
      .from(profileSources)
      .where(and(eq(profileSources.customerId, customerId), eq(profileSources.kind, s.kind), eq(profileSources.ref, s.ref)))
      .limit(1);
    if (existing.length) return;
    await db.insert(profileSources).values({
      id: crypto.randomUUID(),
      customerId,
      kind: s.kind,
      ref: s.ref,
      connectedAt: Date.now(),
    });
  }

  async snapshot(customerId: string): Promise<MemorySnapshot> {
    const db = await getDb();
    const [consent, facts, events, sources] = await Promise.all([
      this.getConsent(customerId),
      db.select().from(profileFacts).where(eq(profileFacts.customerId, customerId)).orderBy(desc(profileFacts.createdAt)),
      db
        .select()
        .from(procurementEvents)
        .where(eq(procurementEvents.customerId, customerId))
        .orderBy(desc(procurementEvents.createdAt)),
      db.select().from(profileSources).where(eq(profileSources.customerId, customerId)),
    ]);
    return {
      consent,
      facts: facts.map(
        (r): Fact => ({
          id: r.id,
          kind: r.kind,
          key: r.key ?? undefined,
          value: r.value,
          source: r.source,
          confidence: r.confidence,
          createdAt: r.createdAt,
        })
      ),
      events: events.map(
        (r): ProcurementEvent => ({
          id: r.id,
          capability: r.capability,
          planId: r.planId,
          action: r.action as EventAction,
          reason: r.reason ?? undefined,
          amountCents: r.amountCents ?? undefined,
          createdAt: r.createdAt,
        })
      ),
      sources: sources.map((r): Source => ({ id: r.id, kind: r.kind, ref: r.ref, connectedAt: r.connectedAt })),
    };
  }

  async deleteFact(customerId: string, id: string): Promise<void> {
    const db = await getDb();
    await db.delete(profileFacts).where(and(eq(profileFacts.customerId, customerId), eq(profileFacts.id, id)));
  }

  async deleteEvent(customerId: string, id: string): Promise<void> {
    const db = await getDb();
    await db.delete(procurementEvents).where(and(eq(procurementEvents.customerId, customerId), eq(procurementEvents.id, id)));
  }

  async clear(customerId: string): Promise<void> {
    const db = await getDb();
    await db.transaction(async (tx) => {
      await tx.delete(profileFacts).where(eq(profileFacts.customerId, customerId));
      await tx.delete(procurementEvents).where(eq(procurementEvents.customerId, customerId));
      await tx.delete(profileSources).where(eq(profileSources.customerId, customerId));
    });
  }

  async reset(): Promise<void> {
    const db = await getDb();
    await db.transaction(async (tx) => {
      await tx.delete(profileFacts);
      await tx.delete(procurementEvents);
      await tx.delete(profileSources);
      await tx.delete(profileConsent);
    });
  }
}
