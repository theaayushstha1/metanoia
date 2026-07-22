/**
 * Checkout orchestration — the enforcement seam.
 *
 * The Spending Constitution is evaluated here BEFORE the payment client is ever
 * touched. A refusal short-circuits and returns without calling Hyperswitch. Only
 * an approved cart records a pending attempt and creates the intent.
 *
 * The payment client is injected so this is fully testable without the network.
 */
import { getPlan } from "@/lib/catalog";
import {
  getIntentMandate,
  getSubscriptions,
  recordAttempt,
  markPaymentSucceeded,
  getSavedPaymentMethod,
} from "@/lib/store";
import { evaluateAgainstConstitution, type ConstitutionVerdict } from "@/lib/agent/spendCap";
import {
  createPaymentIntent,
  chargeSavedMethod,
  stablePaymentId,
  type PaymentResponse,
} from "@/lib/hyperswitch";
import type { CartItem } from "@/lib/ap2/mandate";

export interface PaymentClient {
  createPaymentIntent(p: {
    amount: number;
    currency?: string;
    customerId: string;
    description?: string;
    saveForFutureUse?: boolean;
    returnUrl: string;
    paymentId?: string;
  }): Promise<PaymentResponse>;
}

/** Real client backed by Hyperswitch. */
export const hyperswitchClient: PaymentClient = { createPaymentIntent };

/** Billing period key (UTC YYYY-MM) — renewals get a fresh id each period. */
export function billingPeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type InitiateResult =
  | { refused: true; verdict: ConstitutionVerdict }
  | {
      refused: false;
      verdict: ConstitutionVerdict;
      clientSecret?: string;
      paymentId: string;
      status: string;
    };

export async function initiateSubscription(
  args: { planId: string; customerId: string; returnUrl: string; now?: Date },
  client: PaymentClient
): Promise<InitiateResult> {
  const plan = getPlan(args.planId);
  if (!plan) throw new Error(`Unknown plan: ${args.planId}`);

  // 1) Enforce the mandate FIRST. If refused, the client is never called.
  const item: CartItem = {
    plan_id: plan.id,
    label: plan.name,
    merchant_name: plan.vendor,
    category: plan.category,
    amount_cents: plan.priceCents,
  };
  const verdict = evaluateAgainstConstitution({
    intent: getIntentMandate(),
    item,
    existing: getSubscriptions(args.customerId),
    now: args.now,
  });
  if (!verdict.approved) {
    return { refused: true, verdict };
  }

  // 2) Approved -> stable id per (customer, plan, period) makes retries idempotent.
  // The client self-heals a dead intent to a fresh id, so we record the attempt
  // under the id Hyperswitch actually used (create first, then record).
  const paymentId = stablePaymentId(`${args.customerId}:${plan.id}:${billingPeriod(args.now)}`);
  const payment = await client.createPaymentIntent({
    amount: plan.priceCents,
    currency: "USD",
    customerId: args.customerId,
    description: `${plan.name} (${plan.vendor}) — ${plan.billing}`,
    saveForFutureUse: true,
    returnUrl: args.returnUrl,
    paymentId,
  });
  const actualId = payment.payment_id || paymentId;
  recordAttempt({
    paymentId: actualId,
    customerId: args.customerId,
    planId: plan.id,
    amountCents: plan.priceCents,
  });

  return {
    refused: false,
    verdict,
    clientSecret: payment.client_secret,
    paymentId: actualId,
    status: payment.status,
  };
}

/** Idempotently record a verified payment as a live subscription. */
export function confirmPaid(
  paymentId: string,
  opts?: { updatedAt?: number; paymentMethodId?: string }
): void {
  markPaymentSucceeded(paymentId, opts);
}

// ── Renewals (off-session MIT) ─────────────────────────────────────────────

export interface RenewalClient {
  chargeSavedMethod(p: {
    amount: number;
    currency?: string;
    customerId: string;
    paymentMethodId: string;
    paymentId?: string;
    description?: string;
  }): Promise<PaymentResponse>;
}
export const hyperswitchRenewalClient: RenewalClient = { chargeSavedMethod };

/**
 * Mandate check for a RENEWAL. The existing subscription is excluded before
 * evaluating (so renewing a $29 plan doesn't count as $29 + $29), and the CURRENT
 * price is used — a vendor price increase is checked against the caps, not the old
 * price. A renewal that now violates the mandate is refused before any charge.
 */
export function evaluateRenewal(
  planId: string,
  customerId: string,
  currentAmountCents: number
): ConstitutionVerdict {
  const plan = getPlan(planId);
  if (!plan) throw new Error(`Unknown plan: ${planId}`);
  const item: CartItem = {
    plan_id: plan.id,
    label: plan.name,
    merchant_name: plan.vendor,
    category: plan.category,
    amount_cents: currentAmountCents,
  };
  const existingOthers = getSubscriptions(customerId).filter((s) => s.plan_id !== planId);
  return evaluateAgainstConstitution({ intent: getIntentMandate(), item, existing: existingOthers });
}

export type RenewalResult =
  | { ok: false; code: number; error: string }
  | { ok: false; refused: true; verdict: ConstitutionVerdict }
  | { ok: true; verdict: ConstitutionVerdict; paymentId: string; status: string };

export async function renewSubscription(
  args: { planId: string; customerId: string; now?: Date },
  client: RenewalClient
): Promise<RenewalResult> {
  const plan = getPlan(args.planId);
  if (!plan) return { ok: false, code: 400, error: `Unknown plan: ${args.planId}` };

  const paymentMethodId = getSavedPaymentMethod(args.customerId, args.planId);
  if (!paymentMethodId) {
    return { ok: false, code: 409, error: "No saved payment method for this subscription yet." };
  }

  // Current price (may differ from the original if the vendor changed it).
  const amount = plan.priceCents;

  // 1) Re-run the mandate BEFORE charging. Every autonomous renewal is gated.
  const verdict = evaluateRenewal(args.planId, args.customerId, amount);
  if (!verdict.approved) {
    return { ok: false, refused: true, verdict };
  }

  // 2) Charge off-session. Billing-period id keeps retries idempotent.
  const paymentId = stablePaymentId(`${args.customerId}:${plan.id}:${billingPeriod(args.now)}:renewal`);
  recordAttempt({ paymentId, customerId: args.customerId, planId: plan.id, amountCents: amount });
  const payment = await client.chargeSavedMethod({
    amount,
    currency: "USD",
    customerId: args.customerId,
    paymentMethodId,
    paymentId,
    description: `Renewal — ${plan.name}`,
  });

  if (payment.status === "succeeded") {
    confirmPaid(payment.payment_id || paymentId, { paymentMethodId });
  }
  return { ok: true, verdict, paymentId: payment.payment_id || paymentId, status: payment.status };
}
