import { describe, it, expect } from "vitest";
import { CATALOG, CAPABILITIES, catalogStats, inferCapability } from "@/lib/catalog";
import { rankPlans } from "@/lib/agent/ranking";
import { rankProposal, type Proposal } from "@/lib/agent/procure";
import { applyProcurementRefinement } from "@/lib/agent/refinement";
import { getIntentMandate } from "@/lib/store";

const intent = getIntentMandate(); // default caps: $60/mo, $40/charge

function mkProposal(capability: string, selected: string | null): Proposal {
  return {
    requested_capability: capability as Proposal["requested_capability"],
    normalized_requirements: {},
    considered_plan_ids: [],
    selected_plan_id: selected,
    score_breakdown: [],
    rejected: [],
    reasoning: "test",
  };
}

describe("catalog expansion: 30 offers across 10 capabilities", () => {
  it("has exactly 30 offers and 10 capabilities, 3 per capability", () => {
    const stats = catalogStats();
    expect(stats.offers).toBe(30);
    expect(stats.capabilities).toBe(10);
    for (const cap of CAPABILITIES) {
      expect(CATALOG.filter((p) => p.capability === cap).length).toBe(3);
    }
  });

  it("counts are derived from the catalog, not hardcoded", () => {
    expect(catalogStats().offers).toBe(CATALOG.length);
    expect(catalogStats().capabilities).toBe(new Set(CATALOG.map((p) => p.capability)).size);
  });
});

describe("natural-language category recognition (inferCapability)", () => {
  const cases: [string, string][] = [
    ["I need passkey authentication", "authentication"],
    ["find an email API", "transactional-email"],
    ["LLM inference for my agent with tool calling", "llm-inference"],
    ["observability for logs and traces", "observability"],
    ["real-time market data with websockets", "market-data"],
    ["a speech-to-text transcription service", "transcription"],
    ["an A100 GPU compute API", "compute"],
    // Codex regressions: a generic word must not beat a specific one.
    ["Compare prices for an LLM inference API", "llm-inference"],
    ["location-aware authentication with passkeys", "authentication"],
  ];
  for (const [text, cap] of cases) {
    it(`"${text}" -> ${cap}`, () => {
      expect(inferCapability(text)).toBe(cap);
    });
  }
  it("returns null when nothing matches", () => {
    expect(inferCapability("please water my plants")).toBeNull();
  });
});

describe("deterministic ranking works for a new category (authentication)", () => {
  it("requires passkeys, ranks the passkey plan, drops the one missing it", () => {
    const ranked = rankPlans("authentication", { required_features: ["passkeys"] }, [], intent);
    const byId = Object.fromEntries(ranked.map((r) => [r.plan.id, r]));
    expect(byId["authlite"].eligible).toBe(false); // no passkeys -> hard fail
    expect(byId["passgate_pro"].eligible).toBe(true); // passkeys, $24, in budget
    // top eligible pick is the compliant passkey plan
    expect(ranked.find((r) => r.eligible)?.plan.id).toBe("passgate_pro");
    // score parts are the four published dimensions
    expect(Object.keys(byId["passgate_pro"].scoreParts).sort()).toEqual([
      "capabilityFit",
      "priceEfficiency",
      "reliability",
      "throughput",
    ]);
  });
});

describe("SpendGuard refuses over-cap plans in the new categories", () => {
  it("observability Vigil Scale ($45) is refused by the per-charge cap", () => {
    const ranked = rankPlans("observability", {}, [], intent);
    const vigil = ranked.find((r) => r.plan.id === "vigil_scale")!;
    expect(vigil.plan.priceCents).toBe(4500);
    expect(vigil.verdict.approved).toBe(false); // > $40 per-charge
    expect(vigil.eligible).toBe(false);
    // a cheaper option in the same category is still eligible
    expect(ranked.some((r) => r.eligible)).toBe(true);
  });

  it("authentication Identity Enterprise ($49) is refused by the per-charge cap", () => {
    const ranked = rankPlans("authentication", {}, [], intent);
    const ent = ranked.find((r) => r.plan.id === "identity_enterprise")!;
    expect(ent.eligible).toBe(false);
    expect(ent.verdict.checks.find((c) => c.rule === "per_charge_cap")?.passed).toBe(false);
  });
});

describe("server-enforced refinement (applyProcurementRefinement) on a new category", () => {
  it("'cheaper' from PassGate Pro excludes it, caps the price, and re-ranks to a cheaper eligible plan", () => {
    const proposal = mkProposal("authentication", "passgate_pro"); // $24 pick
    const applied = applyProcurementRefinement(proposal, {
      mode: "cheaper",
      feedback: "something cheaper",
      previousPlanId: "passgate_pro",
    });
    // The refinement deterministically excludes the previous plan and caps the price below it.
    expect(applied.excludedPlanIds).toContain("passgate_pro");
    expect(applied.proposal.normalized_requirements.max_price_cents).toBeLessThan(2400);
    // Re-rank with the enforced exclusion: the cheaper compliant plan wins.
    const ranked = rankProposal(applied.proposal, [], intent, { excludedPlanIds: applied.excludedPlanIds });
    const winner = ranked.find((r) => r.eligible);
    expect(winner?.plan.id).toBe("authlite"); // $10, the remaining compliant plan
    expect(ranked.some((r) => r.plan.id === "passgate_pro")).toBe(false); // excluded from the shortlist
  });

  it("'different_vendor' excludes every plan from the previous vendor", () => {
    const applied = applyProcurementRefinement(mkProposal("observability", "obsly_pro"), {
      mode: "different_vendor",
      feedback: "a different vendor",
      previousPlanId: "obsly_pro",
    });
    expect(applied.excludedPlanIds).toContain("obsly_pro"); // Obsly vendor excluded
    const ranked = rankProposal(applied.proposal, [], intent, { excludedPlanIds: applied.excludedPlanIds });
    expect(ranked.some((r) => r.plan.vendor === "Obsly")).toBe(false);
  });
});
