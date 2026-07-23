import { describe, expect, it } from "vitest";
import { applyProcurementRefinement } from "@/lib/agent/refinement";
import { rankPlans } from "@/lib/agent/ranking";
import type { Proposal } from "@/lib/agent/procure";
import type { ExistingSubscription } from "@/lib/agent/spendCap";

const NONE: ExistingSubscription[] = [];

function marketDataProposal(): Proposal {
  return {
    requested_capability: "market-data",
    normalized_requirements: {
      max_price_cents: 5000,
      min_rps: 60,
      needs_realtime: true,
      needs_websockets: true,
      priority: "balanced",
    },
    considered_plan_ids: ["quotestream_basic", "tickstream_pro", "realtime_ultra"],
    selected_plan_id: "tickstream_pro",
    score_breakdown: [],
    rejected: [],
    reasoning: "TickStream satisfies the original request.",
  };
}

describe("procurement refinements", () => {
  it("turns cheaper into a server-enforced price ceiling", () => {
    const applied = applyProcurementRefinement(marketDataProposal(), {
      mode: "cheaper",
      feedback: "Find something cheaper",
      previousPlanId: "tickstream_pro",
    });

    expect(applied.proposal.normalized_requirements.max_price_cents).toBe(2899);
    expect(applied.proposal.normalized_requirements.priority).toBe("cost");
    expect(applied.excludedPlanIds).toEqual(["tickstream_pro"]);

    const ranked = rankPlans(
      "market-data",
      applied.proposal.normalized_requirements,
      NONE,
      undefined,
      { excludedPlanIds: applied.excludedPlanIds }
    );
    expect(ranked).toHaveLength(2);
    expect(ranked.every((candidate) => !candidate.eligible)).toBe(true);
    expect(ranked.find((candidate) => candidate.plan.id === "quotestream_basic")?.hardFailures).toContain(
      "missing websockets"
    );
  });

  it("requires throughput above the previous recommendation", () => {
    const applied = applyProcurementRefinement(marketDataProposal(), {
      mode: "throughput",
      feedback: "I need higher throughput",
      previousPlanId: "tickstream_pro",
    });

    expect(applied.proposal.normalized_requirements.min_rps).toBe(61);
    expect(applied.proposal.normalized_requirements.priority).toBe("throughput");
    expect(applied.excludedPlanIds).toContain("tickstream_pro");
  });

  it("requires uptime above the previous recommendation", () => {
    const applied = applyProcurementRefinement(marketDataProposal(), {
      mode: "reliability",
      feedback: "Prioritize uptime",
      previousPlanId: "tickstream_pro",
    });

    expect(applied.proposal.normalized_requirements.min_uptime_pct).toBeCloseTo(99.901, 3);
    expect(applied.proposal.normalized_requirements.priority).toBe("reliability");
  });

  it("excludes the previous vendor from a different-vendor search", () => {
    const applied = applyProcurementRefinement(marketDataProposal(), {
      mode: "different_vendor",
      feedback: "Try a different vendor",
      previousPlanId: "tickstream_pro",
    });

    expect(applied.excludedPlanIds).toEqual(["tickstream_pro"]);
  });

  it("forces a new shortlist for custom feedback", () => {
    const applied = applyProcurementRefinement(marketDataProposal(), {
      mode: "custom",
      feedback: "Prefer a simpler integration",
      previousPlanId: "tickstream_pro",
    });

    expect(applied.excludedPlanIds).toContain("tickstream_pro");
  });
});
