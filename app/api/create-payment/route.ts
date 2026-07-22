import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { initiateSubscription, hyperswitchClient } from "@/lib/checkout";
import { getPlan } from "@/lib/catalog";
import { addEvent } from "@/lib/memory/store";
import { DEMO_CUSTOMER } from "@/lib/constants";
import { getSessionIntentMandate } from "@/lib/mandate-session";

export const runtime = "nodejs";

const BodySchema = z.object({ planId: z.string().min(1) });

/**
 * Initiate a subscription payment.
 *
 * Enforcement lives in `initiateSubscription`: the Spending Constitution is
 * evaluated before any Hyperswitch call, and an over-cap request returns 403
 * with the full check trail — no money is ever touched. Customer identity is
 * server-fixed; the browser cannot choose it.
 */
export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const intent = await getSessionIntentMandate();
    const result = await initiateSubscription(
      {
        planId: parsed.data.planId,
        customerId: DEMO_CUSTOMER,
        returnUrl: `${appUrl}/checkout/complete`,
        intent,
      },
      hyperswitchClient
    );

    if (result.refused) {
      return NextResponse.json({ refused: true, verdict: result.verdict }, { status: 403 });
    }

    // Remember the choice (consent-gated no-op otherwise). Kept at the route layer so
    // the payment path never imports preference memory.
    const plan = getPlan(parsed.data.planId);
    if (plan) {
      await addEvent(DEMO_CUSTOMER, {
        capability: plan.capability,
        planId: plan.id,
        action: "selected",
        reason: "User confirmed checkout",
        amountCents: plan.priceCents,
      });
    }

    return NextResponse.json({
      clientSecret: result.clientSecret,
      paymentId: result.paymentId,
      status: result.status,
      verdict: result.verdict,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
