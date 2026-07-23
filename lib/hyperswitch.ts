/**
 * Server-only Hyperswitch client.
 *
 * The secret key lives here and NEVER leaves the server. The browser only ever
 * sees the publishable key + a per-payment `client_secret`.
 *
 * Money is always in the smallest currency unit (integer cents). No floats.
 *
 * Idempotency: Hyperswitch has no idempotency *header* on POST /payments;
 * idempotency is keyed on a caller-supplied `payment_id`. Merchant-provided ids
 * must be exactly 30 chars (`pay_` + 26).
 */

import crypto from "node:crypto";

const BASE_URL = process.env.HYPERSWITCH_BASE_URL ?? "https://sandbox.hyperswitch.io";
const SECRET_KEY = process.env.HYPERSWITCH_SECRET_KEY ?? "";
const PROFILE_ID = process.env.HYPERSWITCH_PROFILE_ID || undefined;

/**
 * Deterministic, Hyperswitch-shaped payment id: `pay_` + 26 hex = 30 chars total
 * (the length Hyperswitch requires for merchant-provided ids). Deterministic in
 * the seed so retries of the same checkout attempt reuse the same id (idempotent).
 */
export function stablePaymentId(seed: string): string {
  const id = "pay_" + crypto.createHash("sha256").update(seed).digest("hex").slice(0, 26);
  return id; // 4 + 26 = 30
}

export type PaymentStatus =
  | "requires_payment_method"
  | "requires_confirmation"
  | "requires_customer_action"
  | "requires_capture"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "partially_captured"
  | "expired";

/** Non-sensitive card metadata Hyperswitch returns on a retrieved payment (never PAN/CVV). */
export interface HyperswitchCard {
  last4?: string;
  card_network?: string;
  card_type?: string;
  card_issuer?: string;
  card_issuing_country?: string;
  card_exp_month?: string;
  card_exp_year?: string;
}

export interface PaymentResponse {
  payment_id: string;
  status: PaymentStatus;
  client_secret?: string;
  mandate_id?: string;
  payment_method_id?: string;
  amount: number;
  currency: string;
  error_message?: string;
  connector?: string;
  // Additional fields the Payments Retrieve API returns; all safe to display on a receipt.
  amount_received?: number;
  net_amount?: number;
  amount_capturable?: number;
  connector_transaction_id?: string;
  payment_method?: string;
  payment_method_type?: string;
  authentication_type?: string;
  capture_method?: string;
  created?: string;
  modified_at?: string;
  updated?: string;
  merchant_id?: string;
  profile_id?: string;
  merchant_connector_id?: string;
  customer_id?: string;
  attempt_count?: number;
  unified_code?: string;
  unified_message?: string;
  payment_method_data?: { card?: HyperswitchCard; [key: string]: unknown };
  [key: string]: unknown;
}

function assertConfigured() {
  if (!SECRET_KEY || SECRET_KEY.startsWith("snd_PASTE")) {
    throw new Error(
      "HYPERSWITCH_SECRET_KEY is not set. Add your sandbox secret key to .env.local and restart the dev server."
    );
  }
}

async function hsFetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  assertConfigured();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": SECRET_KEY,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Hyperswitch returned non-JSON (${res.status}): ${text.slice(0, 300)}`);
  }

  if (!res.ok) {
    const err = json as { error?: { message?: string; code?: string } };
    throw new Error(
      `Hyperswitch ${path} failed (${res.status}): ${err?.error?.code ?? ""} ${err?.error?.message ?? text.slice(0, 300)}`
    );
  }
  return json as T;
}

/**
 * Create a payment intent for the embedded checkout (customer-initiated).
 * Returns a client_secret the browser SDK uses to collect the card and confirm.
 *
 * `saveForFutureUse` sets `setup_future_usage: "off_session"`, which makes this a
 * subscription setup (CIT). The Unified Checkout SDK collects the save-payment /
 * mandate consent. We intentionally do NOT send the deprecated `mandate_data`.
 */
export async function createPaymentIntent(params: {
  amount: number;
  currency?: string;
  customerId: string;
  description?: string;
  metadata?: Record<string, string>;
  saveForFutureUse?: boolean;
  returnUrl: string;
  /** A stable id makes re-initiating the same checkout attempt idempotent. */
  paymentId?: string;
}): Promise<PaymentResponse> {
  const currency = params.currency ?? "USD";
  const body: Record<string, unknown> = {
    amount: params.amount,
    currency,
    customer_id: params.customerId,
    description: params.description,
    ...(params.metadata ? { metadata: params.metadata } : {}),
    return_url: params.returnUrl,
    // confirm:false -> the browser SDK confirms with the collected card.
    confirm: false,
    capture_method: "automatic",
    ...(params.paymentId ? { payment_id: params.paymentId } : {}),
    ...(PROFILE_ID ? { profile_id: PROFILE_ID } : {}),
  };

  if (params.saveForFutureUse) {
    body.setup_future_usage = "off_session";
    // Checkout routes to the payment-only sandbox connector (Fauxpay) for a stable demo.
    // Routing a recurring CIT to Stripe returns UE_9000 ("Sending credit card numbers
    // directly to the Stripe API...") because Hyperswitch detokenizes and forwards the
    // card, and Stripe requires raw-card API access enabled on the account. So recurring
    // is coded but connector-blocked until that Stripe capability is granted. Prefer the
    // checkout connector; fall back to the mandate connector only if it is unset.
    const mca =
      process.env.HYPERSWITCH_CHECKOUT_CONNECTOR_MCA ??
      process.env.HYPERSWITCH_MANDATE_CONNECTOR_MCA;
    const conn =
      process.env.HYPERSWITCH_CHECKOUT_CONNECTOR ??
      process.env.HYPERSWITCH_MANDATE_CONNECTOR ??
      "stripe";
    if (mca) {
      body.routing = { type: "single", data: { connector: conn, merchant_connector_id: mca } };
    }
  }

  try {
    return await hsFetch<PaymentResponse>("/payments", body);
  } catch (e) {
    // The payment_id already exists (HE_01). Two cases:
    //  - reusable intent (still awaiting a method/confirmation) -> return it (idempotent, no double-charge)
    //  - terminal-failed/cancelled/expired -> that attempt is dead; mint a fresh
    //    id so the user can retry (a failed intent can't be re-confirmed).
    const msg = e instanceof Error ? e.message : String(e);
    if (params.paymentId && (msg.includes("HE_01") || msg.includes("already exists"))) {
      const existing = await getPayment(params.paymentId);
      const dead = ["failed", "cancelled", "expired"].includes(existing.status);
      if (!dead) return existing;
      body.payment_id = "pay_" + crypto.randomBytes(13).toString("hex"); // 30 chars
      return await hsFetch<PaymentResponse>("/payments", body);
    }
    throw e;
  }
}

/**
 * Merchant-initiated, off-session renewal against a saved payment method.
 * This is the "agent charges the next cycle with nobody watching" path.
 * Requires a connector that supports mandates (Stripe-test in sandbox, NOT dummy).
 *
 * A stable `paymentId` (per billing period) makes the renewal idempotent.
 */
export async function chargeSavedMethod(params: {
  amount: number;
  currency?: string;
  customerId: string;
  paymentMethodId: string;
  paymentId?: string;
  description?: string;
  metadata?: Record<string, string>;
}): Promise<PaymentResponse> {
  const mca = process.env.HYPERSWITCH_MANDATE_CONNECTOR_MCA;
  const conn = process.env.HYPERSWITCH_MANDATE_CONNECTOR ?? "stripe";
  const body: Record<string, unknown> = {
    amount: params.amount,
    currency: params.currency ?? "USD",
    customer_id: params.customerId,
    confirm: true,
    off_session: true,
    recurring_details: {
      type: "payment_method_id",
      data: params.paymentMethodId,
    },
    // Route the renewal to the mandate-capable connector that holds the saved method.
    ...(mca ? { routing: { type: "single", data: { connector: conn, merchant_connector_id: mca } } } : {}),
    ...(params.paymentId ? { payment_id: params.paymentId } : {}),
    ...(params.description ? { description: params.description } : {}),
    ...(params.metadata ? { metadata: params.metadata } : {}),
    ...(PROFILE_ID ? { profile_id: PROFILE_ID } : {}),
  };
  return hsFetch<PaymentResponse>("/payments", body);
}

/** Retrieve current status of a payment (authoritative). */
export async function getPayment(paymentId: string): Promise<PaymentResponse> {
  assertConfigured();
  const res = await fetch(`${BASE_URL}/payments/${paymentId}`, {
    headers: { "api-key": SECRET_KEY },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Hyperswitch GET /payments/${paymentId} failed (${res.status})`);
  }
  return (await res.json()) as PaymentResponse;
}

export interface RefundResponse {
  refund_id: string;
  payment_id?: string;
  status?: string; // pending | succeeded | failed | review
  amount?: number;
  currency?: string;
  connector?: string;
  error_message?: string;
  error_code?: string;
  [key: string]: unknown;
}

/** Deterministic refund id so a repeated refund of the same payment is idempotent. */
export function stableRefundId(paymentId: string): string {
  return "ref_" + crypto.createHash("sha256").update(`refund:${paymentId}`).digest("hex").slice(0, 26);
}

/**
 * Create a refund with a merchant-supplied, deterministic `refund_id`. If the same
 * refund already exists (a repeat click), Hyperswitch reports a conflict; we then
 * retrieve and return the existing refund — so the operation is idempotent.
 */
export async function createRefund(params: {
  paymentId: string;
  amount: number;
  refundId: string;
}): Promise<RefundResponse> {
  try {
    return await hsFetch<RefundResponse>("/refunds", {
      payment_id: params.paymentId,
      amount: params.amount,
      refund_id: params.refundId,
      reason: "requested_by_customer",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("already exists") || msg.includes("duplicate") || msg.includes("HE_01")) {
      return await getRefund(params.refundId);
    }
    throw e;
  }
}

/** Retrieve the authoritative refund status. */
export async function getRefund(refundId: string): Promise<RefundResponse> {
  assertConfigured();
  const res = await fetch(`${BASE_URL}/refunds/${refundId}`, {
    headers: { "api-key": SECRET_KEY },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Hyperswitch GET /refunds/${refundId} failed (${res.status})`);
  }
  return (await res.json()) as RefundResponse;
}
