import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { decide, rankProposal, runProcurement } from "@/lib/agent/procure";
import { formatUsd, inferCapability } from "@/lib/catalog";
import { getSubscriptions } from "@/lib/store";
import { ensureSessionCustomerId } from "@/lib/session";
import { contextPrompt, enrichProfileContext } from "@/lib/profile/context";
import { buildPreferenceProfile, preferenceProfilePrompt } from "@/lib/memory/profile";
import { addEvent, addFact, addSource } from "@/lib/memory/store";
import type { RankedPlan } from "@/lib/agent/ranking";
import { runScoutPanel } from "@/lib/agent/scouts";
import { getSessionIntentMandate } from "@/lib/mandate-session";
import {
  applyProcurementRefinement,
  refinementPrompt,
  RefinementModeSchema,
} from "@/lib/agent/refinement";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  request: z.string().min(3).max(2000),
  refinement: z
    .object({
      mode: RefinementModeSchema,
      feedback: z.string().min(1).max(500),
      previousPlanId: z.string().min(1).max(120),
    })
    .optional(),
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
    const customerId = await ensureSessionCustomerId();
    const context = await enrichProfileContext(parsed.data.context ?? {});
    const profile = await buildPreferenceProfile(customerId);
    const profileBlock = preferenceProfilePrompt(profile);
    const refinementBlock = parsed.data.refinement
      ? `\n\n${refinementPrompt(parsed.data.refinement)}`
      : "";
    const agentRequest =
      `${parsed.data.request}\n\n${contextPrompt(context)}` +
      (profileBlock ? `\n\n${profileBlock}` : "") +
      refinementBlock;
    const existing = await getSubscriptions(customerId);
    const intent = await getSessionIntentMandate();
    const requestedCapability = inferCapability(parsed.data.request);
    const agentResult = await runProcurement(agentRequest, customerId, {
      defaultPriority: profile.priorityLean,
      intent,
      requestedCapability,
    });
    const applied = agentResult.proposal && parsed.data.refinement
      ? applyProcurementRefinement(agentResult.proposal, parsed.data.refinement)
      : null;
    const proposal = applied?.proposal ?? agentResult.proposal;
    const rankingOptions = { excludedPlanIds: applied?.excludedPlanIds ?? [] };
    const result = {
      ...agentResult,
      proposal,
      decision: decide(proposal, existing, intent, rankingOptions),
    };
    const rankings = proposal
      ? rankProposal(proposal, existing, intent, rankingOptions).slice(0, 3)
      : [];
    const candidates = rankings.map(candidateView);
    const scouts = proposal
      ? await runScoutPanel({
          request: parsed.data.refinement
            ? `${parsed.data.request}\nRefinement: ${parsed.data.refinement.feedback}`
            : parsed.data.request,
          capability: proposal.requested_capability,
          requirements: proposal.normalized_requirements,
          rankings,
          abortSignal: req.signal,
        })
      : [];

    // Learn from this run. Every write is consent-gated inside the store: if the user
    // hasn't opted in, these are silent no-ops.
    const ctxIn = parsed.data.context;
    if (ctxIn?.projectSummary)
      await addFact(customerId, { kind: "project", value: ctxIn.projectSummary.slice(0, 300), source: "user" });
    if (ctxIn?.profileSummary)
      await addFact(customerId, { kind: "experience", value: ctxIn.profileSummary.slice(0, 300), source: "user" });
    for (const repo of ctxIn?.githubRepos ?? []) await addSource(customerId, { kind: "github", ref: repo });
    if (result.decision.selected_plan_id) {
      await addEvent(customerId, {
        capability: result.proposal?.requested_capability ?? "unknown",
        planId: result.decision.selected_plan_id,
        action: "recommended",
        reason: result.decision.note ?? rankings[0]?.tradeoff,
        amountCents: result.decision.plan?.price_cents,
      });
    }

    // If nothing was selected, surface the plan the agent wanted but couldn't afford
    // (the priciest considered) with its authoritative audit, for the "Denied" screen.
    let blocked: { plan: ReturnType<typeof candidateView>; verdict: unknown } | null = null;
    if (!result.decision.selected_plan_id && rankings.length) {
      const closest = rankings[0];
      blocked = { plan: candidateView(closest), verdict: closest.verdict };
    }

    return NextResponse.json({ ...result, candidates, scouts, blocked, context, profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
