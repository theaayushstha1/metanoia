/**
 * In-memory preference memory: the test backend and local no-database fallback.
 * Mirrors the Postgres backend's semantics, including consent-gated writes.
 */
import crypto from "node:crypto";
import type {
  EventAction,
  Fact,
  FactKind,
  MemorySnapshot,
  MemoryStore,
  ProcurementEvent,
  Source,
} from "@/lib/memory/contract";

export class InMemoryMemoryStore implements MemoryStore {
  private consent = new Map<string, boolean>();
  private facts = new Map<string, Fact[]>();
  private events = new Map<string, ProcurementEvent[]>();
  private sources = new Map<string, Source[]>();

  async getConsent(customerId: string): Promise<boolean> {
    return this.consent.get(customerId) ?? false;
  }

  async setConsent(customerId: string, granted: boolean): Promise<void> {
    this.consent.set(customerId, granted);
  }

  async addFact(
    customerId: string,
    f: { kind: FactKind | string; key?: string; value: string; source?: string; confidence?: number }
  ): Promise<void> {
    if (!(await this.getConsent(customerId))) return;
    const list = this.facts.get(customerId) ?? [];
    // Dedupe on (kind, key, value) so repeated imports don't pile up.
    if (list.some((x) => x.kind === f.kind && x.key === f.key && x.value === f.value)) return;
    list.push({
      id: crypto.randomUUID(),
      kind: f.kind,
      key: f.key,
      value: f.value,
      source: f.source ?? "inferred",
      confidence: f.confidence ?? 0.7,
      createdAt: Date.now(),
    });
    this.facts.set(customerId, list);
  }

  async addEvent(
    customerId: string,
    e: { capability: string; planId: string; action: EventAction; reason?: string; amountCents?: number }
  ): Promise<void> {
    if (!(await this.getConsent(customerId))) return;
    const list = this.events.get(customerId) ?? [];
    list.push({ id: crypto.randomUUID(), ...e, createdAt: Date.now() });
    this.events.set(customerId, list);
  }

  async addSource(customerId: string, s: { kind: string; ref: string }): Promise<void> {
    if (!(await this.getConsent(customerId))) return;
    const list = this.sources.get(customerId) ?? [];
    if (list.some((x) => x.kind === s.kind && x.ref === s.ref)) return;
    list.push({ id: crypto.randomUUID(), ...s, connectedAt: Date.now() });
    this.sources.set(customerId, list);
  }

  async snapshot(customerId: string): Promise<MemorySnapshot> {
    return {
      consent: await this.getConsent(customerId),
      facts: [...(this.facts.get(customerId) ?? [])],
      events: [...(this.events.get(customerId) ?? [])],
      sources: [...(this.sources.get(customerId) ?? [])],
    };
  }

  async deleteFact(customerId: string, id: string): Promise<void> {
    this.facts.set(customerId, (this.facts.get(customerId) ?? []).filter((x) => x.id !== id));
  }

  async deleteEvent(customerId: string, id: string): Promise<void> {
    this.events.set(customerId, (this.events.get(customerId) ?? []).filter((x) => x.id !== id));
  }

  async clear(customerId: string): Promise<void> {
    this.facts.delete(customerId);
    this.events.delete(customerId);
    this.sources.delete(customerId);
  }

  async reset(): Promise<void> {
    this.consent.clear();
    this.facts.clear();
    this.events.clear();
    this.sources.clear();
  }
}
