import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runProcurement } from "@/lib/agent/procure";
import { getPlan, formatUsd, type Plan } from "@/lib/catalog";
import { DEMO_CUSTOMER } from "@/lib/constants";
import { getIntentMandate, getSubscriptions } from "@/lib/store";
import { evaluateAgainstConstitution } from "@/lib/agent/spendCap";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  request: z.string().min(3).max(2000),
});

function candidateView(p: Plan) {
  return {
    id: p.id,
    name: p.name,
    vendor: p.vendor,
    price: formatUsd(p.priceCents),
    price_cents: p.priceCents,
    real_time: p.features.includes("realtime_us_equities"),
    websockets: p.features.includes("websockets"),
    max_rps: p.maxRps ?? null,
    uptime_pct: p.uptimePct ?? null,
  };
}

/**
 * Run the procurement agent on a capability request. Returns the model's proposal,
 * the server-authoritative decision, a structured tool trace, and the candidate
 * details for the UI comparison table. Identity is server-fixed (never client-set).
 */
export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await runProcurement(parsed.data.request, DEMO_CUSTOMER);
    const consideredPlans = (result.proposal?.considered_plan_ids ?? [])
      .map((id) => getPlan(id))
      .filter((p): p is Plan => Boolean(p));
    const candidates = consideredPlans.map(candidateView);

    // If nothing was selected, surface the plan the agent wanted but couldn't afford
    // (the priciest considered) with its authoritative audit, for the "Denied" screen.
    let blocked: { plan: ReturnType<typeof candidateView>; verdict: unknown } | null = null;
    if (!result.decision.selected_plan_id && consideredPlans.length) {
      const culprit = [...consideredPlans].sort((a, b) => b.priceCents - a.priceCents)[0];
      const verdict = evaluateAgainstConstitution({
        intent: getIntentMandate(),
        item: {
          plan_id: culprit.id,
          label: culprit.name,
          merchant_name: culprit.vendor,
          category: culprit.category,
          amount_cents: culprit.priceCents,
        },
        existing: getSubscriptions(DEMO_CUSTOMER),
      });
      blocked = { plan: candidateView(culprit), verdict };
    }

    return NextResponse.json({ ...result, candidates, blocked });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
