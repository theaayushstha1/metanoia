import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rankProposal, runProcurement } from "@/lib/agent/procure";
import { formatUsd } from "@/lib/catalog";
import { DEMO_CUSTOMER } from "@/lib/constants";
import { contextPrompt, enrichProfileContext } from "@/lib/profile/context";
import type { RankedPlan } from "@/lib/agent/ranking";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  request: z.string().min(3).max(2000),
  context: z
    .object({
      profileSummary: z.string().max(1200).optional(),
      projectSummary: z.string().max(1200).optional(),
      socialLinks: z.array(z.url()).max(4).optional(),
      githubRepos: z.array(z.url()).max(5).optional(),
    })
    .optional(),
});

function candidateView(ranked: RankedPlan) {
  const p = ranked.plan;
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
    capability: p.capability,
    features: p.features,
    description: p.blurb,
    best_for: p.bestFor,
    score: ranked.score,
    score_parts: ranked.scoreParts,
    eligible: ranked.eligible,
    hard_failures: ranked.hardFailures,
    tradeoff: ranked.tradeoff,
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
    const context = await enrichProfileContext(parsed.data.context ?? {});
    const agentRequest = `${parsed.data.request}\n\n${contextPrompt(context)}`;
    const result = await runProcurement(agentRequest, DEMO_CUSTOMER);
    const rankings = result.proposal ? rankProposal(result.proposal, DEMO_CUSTOMER).slice(0, 3) : [];
    const candidates = rankings.map(candidateView);

    // If nothing was selected, surface the plan the agent wanted but couldn't afford
    // (the priciest considered) with its authoritative audit, for the "Denied" screen.
    let blocked: { plan: ReturnType<typeof candidateView>; verdict: unknown } | null = null;
    if (!result.decision.selected_plan_id && rankings.length) {
      const closest = rankings[0];
      blocked = { plan: candidateView(closest), verdict: closest.verdict };
    }

    return NextResponse.json({ ...result, candidates, blocked, context });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
