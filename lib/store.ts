/**
 * Store facade. Picks the backend once and delegates:
 *  - Cloud SQL Postgres (durable, cross-instance safe) when CLOUD_SQL_* is set
 *  - in-memory otherwise (tests, and local dev without a database)
 *
 * The mandate itself is static config, so `getIntentMandate` stays synchronous.
 * Everything that touches ledger state is async (a real database round-trip).
 */
import type { IntentMandate } from "@/lib/ap2/mandate";
import { DEFAULT_EDITABLE_MANDATE, type EditableMandate } from "@/lib/mandate-policy";
import { pgConfigured } from "@/lib/db/client";
import { InMemoryStore } from "@/lib/store-memory";
import { PgStore } from "@/lib/store-pg";
import type { Store, WebhookInput } from "@/lib/db/store-contract";

export type { Attempt } from "@/lib/db/store-contract";

let _store: Store | null = null;
function store(): Store {
  if (!_store) {
    _store = pgConfigured() && !process.env.VITEST ? new PgStore() : new InMemoryStore();
  }
  return _store;
}

/** True when durable Postgres is the active backend. */
export function isDurable(): boolean {
  return pgConfigured() && !process.env.VITEST;
}

/** The default mandate a user grants the agent. Expiry is always 30 days out. */
export function getIntentMandate(policy: EditableMandate = DEFAULT_EDITABLE_MANDATE): IntentMandate {
  return {
    user_cart_confirmation_required: true,
    natural_language_description:
      "Keep me subscribed to the API/data tools I need to run my product, under budget.",
    requires_refundability: false,
    intent_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    policy: {
      monthly_cap_cents: policy.monthly_cap_cents,
      per_charge_cap_cents: policy.per_charge_cap_cents,
      allowed_categories: undefined,
      max_active_subscriptions: policy.max_active_subscriptions,
    },
  };
}

export const getSubscriptions = (customerId: string) => store().getSubscriptions(customerId);
export const recordAttempt = (a: {
  paymentId: string;
  customerId: string;
  planId: string;
  amountCents: number;
}) => store().recordAttempt(a);
export const getAttempt = (paymentId: string) => store().getAttempt(paymentId);
export const listAttempts = (customerId: string) => store().listAttempts(customerId);
export const markPaymentSucceeded = (
  paymentId: string,
  opts?: { updatedAt?: number; paymentMethodId?: string }
) => store().markPaymentSucceeded(paymentId, opts);
export const markPaymentFailed = (paymentId: string) => store().markPaymentFailed(paymentId);
export const getSavedPaymentMethod = (customerId: string, planId: string) =>
  store().getSavedPaymentMethod(customerId, planId);
export const hasReceivedSuccessWebhook = (paymentId: string) =>
  store().hasReceivedSuccessWebhook(paymentId);
export const cancelSubscription = (customerId: string, planId: string) =>
  store().cancelSubscription(customerId, planId);
export const recordRefund = (r: import("@/lib/db/store-contract").RefundRecord) => store().recordRefund(r);
export const getRefundRecord = (paymentId: string) => store().getRefundRecord(paymentId);
export const getCredential = (customerId: string, planId: string) =>
  store().getCredential(customerId, planId);
export const resolveCredential = (cred: string) => store().resolveCredential(cred);
export const processWebhook = (input: WebhookInput) => store().processWebhook(input);
export const reconcilePendingEvents = () => store().reconcilePendingEvents();

/** Test/util: wipe all state in the active backend. */
export async function __resetStore(): Promise<void> {
  await store().reset();
}
