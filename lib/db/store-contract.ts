/**
 * The storage contract shared by both backends (in-memory for tests/local, Cloud
 * SQL Postgres for durability). Every method is async so the two are drop-in.
 */
import crypto from "node:crypto";
import type { ExistingSubscription } from "@/lib/agent/spendCap";

export interface Attempt {
  paymentId: string;
  customerId: string;
  planId: string;
  amountCents: number;
  status: "pending" | "succeeded" | "failed";
  paymentMethodId?: string;
  updatedAt: number;
}

export interface WebhookInput {
  eventId?: string;
  eventType?: string;
  paymentId?: string;
  paymentMethodId?: string;
  /** Event timestamp (epoch ms) for the out-of-order guard. */
  updatedAt?: number;
  /** Full payload, retained verbatim for reconciliation. */
  raw: unknown;
}

export interface WebhookOutcome {
  duplicate: boolean; // event_id already seen -> no-op
  applied: boolean; // a subscription was recorded/updated as a result
  reason?: string; // why nothing was applied (e.g. unknown payment id, retained)
}

export interface Store {
  getSubscriptions(customerId: string): Promise<ExistingSubscription[]>;
  recordAttempt(a: {
    paymentId: string;
    customerId: string;
    planId: string;
    amountCents: number;
  }): Promise<void>;
  getAttempt(paymentId: string): Promise<Attempt | undefined>;
  markPaymentSucceeded(
    paymentId: string,
    opts?: { updatedAt?: number; paymentMethodId?: string }
  ): Promise<void>;
  markPaymentFailed(paymentId: string): Promise<void>;
  getSavedPaymentMethod(customerId: string, planId: string): Promise<string | undefined>;
  getCredential(customerId: string, planId: string): Promise<string | undefined>;
  resolveCredential(cred: string): Promise<{ customerId: string; planId: string } | undefined>;
  /** Atomic: dedupe + retain the event, settle the payment, upsert the subscription. */
  processWebhook(input: WebhookInput): Promise<WebhookOutcome>;
  /** Test/util: wipe all state. */
  reset(): Promise<void>;
}

/** Deterministic capability credential for a purchased plan (issued at most once). */
export function credentialFor(customerId: string, planId: string): string {
  return "key_" + crypto.createHash("sha256").update(`${customerId}:${planId}`).digest("hex").slice(0, 32);
}
