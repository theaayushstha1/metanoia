import { NextRequest, NextResponse } from "next/server";
import { getSessionCustomerId } from "@/lib/session";
import { EditableMandateSchema } from "@/lib/mandate-policy";
import { setSessionMandatePolicy } from "@/lib/mandate-session";
import { getSubscriptions } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const parsed = EditableMandateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid mandate" }, { status: 400 });
  }

  const active = await getSubscriptions(await getSessionCustomerId());
  const committed = active.reduce((sum, subscription) => sum + subscription.amount_cents, 0);
  if (parsed.data.monthly_cap_cents < committed) {
    return NextResponse.json({ error: "Monthly budget cannot be below active commitments." }, { status: 409 });
  }
  if (parsed.data.max_active_subscriptions < active.length) {
    return NextResponse.json({ error: "Service limit cannot be below the active subscription count." }, { status: 409 });
  }

  await setSessionMandatePolicy(parsed.data);
  return NextResponse.json({ mandate: parsed.data, committed_cents: committed, active: active.length });
}

