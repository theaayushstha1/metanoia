/**
 * Preference-memory facade. Same backend-selection rule as the payment store, but a
 * fully separate module and (in Postgres) a separate schema.
 */
import { pgConfigured } from "@/lib/db/client";
import { InMemoryMemoryStore } from "@/lib/memory/inmemory";
import { PgMemoryStore } from "@/lib/memory/pg";
import type {
  EventAction,
  FactKind,
  MemorySnapshot,
  MemoryStore,
} from "@/lib/memory/contract";

export type { Fact, ProcurementEvent, Source, MemorySnapshot } from "@/lib/memory/contract";

let _mem: MemoryStore | null = null;
function mem(): MemoryStore {
  if (!_mem) {
    _mem = pgConfigured() && !process.env.VITEST ? new PgMemoryStore() : new InMemoryMemoryStore();
  }
  return _mem;
}

export const getConsent = (customerId: string) => mem().getConsent(customerId);
export const setConsent = (customerId: string, granted: boolean) => mem().setConsent(customerId, granted);
export const addFact = (
  customerId: string,
  f: { kind: FactKind | string; key?: string; value: string; source?: string; confidence?: number }
) => mem().addFact(customerId, f);
export const addEvent = (
  customerId: string,
  e: { capability: string; planId: string; action: EventAction; reason?: string; amountCents?: number }
) => mem().addEvent(customerId, e);
export const addSource = (customerId: string, s: { kind: string; ref: string }) => mem().addSource(customerId, s);
export const snapshotMemory = (customerId: string): Promise<MemorySnapshot> => mem().snapshot(customerId);
export const deleteFact = (customerId: string, id: string) => mem().deleteFact(customerId, id);
export const deleteEvent = (customerId: string, id: string) => mem().deleteEvent(customerId, id);
export const clearMemory = (customerId: string) => mem().clear(customerId);

/** Test util. */
export async function __resetMemory(): Promise<void> {
  await mem().reset();
}
