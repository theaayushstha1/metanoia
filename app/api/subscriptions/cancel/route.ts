import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cancelSubscription } from "@/lib/store";
import { getSessionCustomerId } from "@/lib/session";

export const runtime = "nodejs";

const BodySchema = z.object({ planId: z.string().min(1) });

/**
 * Cancel an active subscription. Server-fixed customer identity; the browser cannot
 * cancel someone else's subscription. Frees the monthly budget and revokes the
 * capability credential so access actually stops.
 *
 * Note: for a real off-session mandate this is also where we would call Hyperswitch
 * `POST /mandates/revoke/{mandate_id}` — wired once the Stripe MIT path is live.
 */
export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const cancelled = await cancelSubscription(await getSessionCustomerId(), parsed.data.planId);
  if (!cancelled) {
    return NextResponse.json({ error: "No active subscription for that plan." }, { status: 404 });
  }
  return NextResponse.json({ cancelled: true, planId: parsed.data.planId });
}
