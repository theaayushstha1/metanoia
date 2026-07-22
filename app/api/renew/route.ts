import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { renewSubscription, hyperswitchRenewalClient } from "@/lib/checkout";
import { DEMO_CUSTOMER } from "@/lib/constants";

export const runtime = "nodejs";

const BodySchema = z.object({ planId: z.string().min(1) });

/**
 * Off-session renewal (MIT). The mandate is re-checked server-side BEFORE any
 * charge (a renewal that now exceeds the caps — e.g. a vendor price increase — is
 * refused). Requires a mandate-capable connector (Stripe). Idempotent per period.
 */
export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await renewSubscription(
      { planId: parsed.data.planId, customerId: DEMO_CUSTOMER },
      hyperswitchRenewalClient
    );

    if (!result.ok) {
      if ("refused" in result) {
        return NextResponse.json({ refused: true, verdict: result.verdict }, { status: 403 });
      }
      return NextResponse.json({ error: result.error }, { status: result.code });
    }

    return NextResponse.json({ paymentId: result.paymentId, status: result.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
