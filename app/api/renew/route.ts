import { NextRequest, NextResponse } from "next/server";
import { chargeSavedMethod, stablePaymentId } from "@/lib/hyperswitch";
import { getPlan } from "@/lib/catalog";
import { getSavedPaymentMethod } from "@/lib/store";
import { confirmPaid, billingPeriod } from "@/lib/checkout";

export const runtime = "nodejs";

/**
 * Off-session renewal (MIT) for an existing subscription — the "agent renews the
 * next cycle with nobody watching" path.
 *
 * Requires a mandate-capable connector (Stripe-test in sandbox; the dummy
 * connector cannot prove recurring MIT). CODED, UNTESTED against live sandbox.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const planId: string = body.planId;
    const customerId: string = body.customerId ?? "metanoia_demo_customer";

    const plan = getPlan(planId);
    if (!plan) return NextResponse.json({ error: `Unknown plan: ${planId}` }, { status: 400 });

    const paymentMethodId = getSavedPaymentMethod(customerId, planId);
    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "No saved payment method for this subscription yet (complete a CIT first)." },
        { status: 409 }
      );
    }

    const paymentId = stablePaymentId(`${customerId}:${plan.id}:${billingPeriod()}:renewal`);
    const payment = await chargeSavedMethod({
      amount: plan.priceCents,
      currency: "USD",
      customerId,
      paymentMethodId,
      paymentId,
      description: `Renewal — ${plan.name}`,
    });

    if (payment.status === "succeeded") {
      confirmPaid(payment.payment_id || paymentId, { paymentMethodId });
    }

    return NextResponse.json({ paymentId: payment.payment_id || paymentId, status: payment.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
