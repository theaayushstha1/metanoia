/**
 * Preference-memory contract, shared by the in-memory and Postgres backends.
 *
 * Consent is enforced HERE, at the store boundary: writes are silently dropped when
 * the customer hasn't opted in, so no caller can accidentally persist without consent.
 */
import type { ExistingSubscription } from "@/lib/agent/spendCap";

export type FactKind = "experience" | "stack" | "domain" | "goal" | "preference" | "project";
export type EventAction = "recommended" | "selected" | "rejected";

export interface Fact {
  id: string;
  kind: string;
  key?: string;
  value: string;
  source: string;
  confidence: number;
  createdAt: number;
}

export interface ProcurementEvent {
  id: string;
  capability: string;
  planId: string;
  action: EventAction;
  reason?: string;
  amountCents?: number;
  createdAt: number;
}

export interface Source {
  id: string;
  kind: string;
  ref: string;
  connectedAt: number;
}

export interface MemorySnapshot {
  consent: boolean;
  facts: Fact[];
  events: ProcurementEvent[];
  sources: Source[];
}

export interface MemoryStore {
  getConsent(customerId: string): Promise<boolean>;
  setConsent(customerId: string, granted: boolean): Promise<void>;
  /** No-op unless consent is granted. */
  addFact(
    customerId: string,
    f: { kind: FactKind | string; key?: string; value: string; source?: string; confidence?: number }
  ): Promise<void>;
  /** No-op unless consent is granted. */
  addEvent(
    customerId: string,
    e: { capability: string; planId: string; action: EventAction; reason?: string; amountCents?: number }
  ): Promise<void>;
  /** No-op unless consent is granted. */
  addSource(customerId: string, s: { kind: string; ref: string }): Promise<void>;
  snapshot(customerId: string): Promise<MemorySnapshot>;
  deleteFact(customerId: string, id: string): Promise<void>;
  deleteEvent(customerId: string, id: string): Promise<void>;
  /** Delete all stored facts/events/sources for a customer (consent left as-is). */
  clear(customerId: string): Promise<void>;
  /** Test util: wipe everything. */
  reset(): Promise<void>;
}

// Re-exported so the profile synthesizer can type against it without importing the
// payment store.
export type { ExistingSubscription };
