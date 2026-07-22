/**
 * Preference memory — a SEPARATE Postgres schema (`memory.*`), deliberately walled
 * off from the payment ledger (`public.*`). No foreign key crosses the wall: a
 * payment can never leak into profile memory, and dropping `memory` never touches
 * the ledger.
 *
 * Privacy rules baked in:
 *  - nothing is written unless `profile_consent.granted` is true
 *  - we store EXTRACTED FACTS, never raw social payloads or access tokens
 *  - everything is per-customer and individually deletable
 */
import { pgSchema, text, integer, boolean, bigint, real } from "drizzle-orm/pg-core";

export const memory = pgSchema("memory");

/** The consent gate. Absent/false -> the app stores nothing below. */
export const profileConsent = memory.table("profile_consent", {
  customerId: text("customer_id").primaryKey(),
  granted: boolean("granted").notNull().default(false),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

/** Extracted facts (never raw data): stack, domain, experience, goals, preferences. */
export const profileFacts = memory.table("profile_facts", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  kind: text("kind").notNull(), // experience | stack | domain | goal | preference | project
  key: text("key"),
  value: text("value").notNull(),
  source: text("source").notNull().default("inferred"), // github | user | inferred
  confidence: real("confidence").notNull().default(0.7),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

/** The choice history: what was recommended, chosen, or passed on, and why. */
export const procurementEvents = memory.table("procurement_events", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  capability: text("capability").notNull(),
  planId: text("plan_id").notNull(),
  action: text("action").notNull(), // recommended | selected | rejected
  reason: text("reason"),
  amountCents: integer("amount_cents"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

/** Connected sources as metadata only — no tokens, no raw content. */
export const profileSources = memory.table("profile_sources", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  kind: text("kind").notNull(), // github | twitter | linkedin
  ref: text("ref").notNull(),
  connectedAt: bigint("connected_at", { mode: "number" }).notNull(),
});
