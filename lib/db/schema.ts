/**
 * Durable payment-state schema (Drizzle / Postgres on Cloud SQL).
 *
 * This is the ledger the JSON store used to hold in-process. Correctness comes
 * from the constraints here, not from application code:
 *  - `attempts.payment_id` PK          -> one row per payment, idempotent recording
 *  - `subscriptions` composite PK       -> upsert a renewal in place (no duplicates)
 *  - `credentials` unique(customer,plan) -> a capability is issued at most once
 *  - `events.event_id` PK               -> webhook dedupe is a constraint, not a check
 *
 * Money is integer cents. Timestamps that gate ordering are epoch-ms bigints so
 * the out-of-order webhook guard is a plain numeric comparison.
 */
import { pgTable, text, integer, boolean, bigint, jsonb, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";

export const attempts = pgTable("attempts", {
  paymentId: text("payment_id").primaryKey(),
  customerId: text("customer_id").notNull(),
  planId: text("plan_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: text("status").notNull().default("pending"), // pending | succeeded | failed
  paymentMethodId: text("payment_method_id"),
  /** ts of the last webhook applied to this row; guards out-of-order delivery. */
  appliedEventTs: bigint("applied_event_ts", { mode: "number" }),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    customerId: text("customer_id").notNull(),
    planId: text("plan_id").notNull(),
    merchantName: text("merchant_name").notNull(),
    category: text("category").notNull(),
    amountCents: integer("amount_cents").notNull(),
    active: boolean("active").notNull().default(true),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.customerId, t.planId] })]
);

export const credentials = pgTable(
  "credentials",
  {
    credential: text("credential").primaryKey(),
    customerId: text("customer_id").notNull(),
    planId: text("plan_id").notNull(),
  },
  (t) => [uniqueIndex("credentials_owner_idx").on(t.customerId, t.planId)]
);

/** Every webhook is retained (raw payload) even if we can't act on it yet. */
export const events = pgTable("events", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type"),
  paymentId: text("payment_id"),
  raw: jsonb("raw"),
  processed: boolean("processed").notNull().default(false),
  receivedAt: bigint("received_at", { mode: "number" }).notNull(),
});
