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
    // A sandbox demo may use a payment-only connector such as Fauxpay while the
    // mandate connector remains Stripe for real saved-card renewals.
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
