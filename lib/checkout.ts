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
import { getIntentMandate, getSubscriptions, recordAttempt, markPaymentSucceeded } from "@/lib/store";
import { evaluateAgainstConstitution, type ConstitutionVerdict } from "@/lib/agent/spendCap";
import { createPaymentIntent, stablePaymentId, type PaymentResponse } from "@/lib/hyperswitch";
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
  const paymentId = stablePaymentId(`${args.customerId}:${plan.id}:${billingPeriod(args.now)}`);
  recordAttempt({
    paymentId,
    customerId: args.customerId,
    planId: plan.id,
    amountCents: plan.priceCents,
  });

  const payment = await client.createPaymentIntent({
    amount: plan.priceCents,
    currency: "USD",
    customerId: args.customerId,
    description: `${plan.name} (${plan.vendor}) — ${plan.billing}`,
    saveForFutureUse: true,
    returnUrl: args.returnUrl,
    paymentId,
  });

  return {
    refused: false,
    verdict,
    clientSecret: payment.client_secret,
    paymentId: payment.payment_id || paymentId,
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
