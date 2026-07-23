import { describe, it, expect } from "vitest";
import { decide, rankProposal, type Proposal } from "@/lib/agent/procure";
import { getIntentMandate } from "@/lib/store";

const intent = getIntentMandate(); // $60/mo, $40/charge

function mkProposal(
  capability: string,
  selected: string | null,
  reqs: Proposal["normalized_requirements"] = {}
): Proposal {
  return {
    requested_capability: capability as Proposal["requested_capability"],
    normalized_requirements: reqs,
    considered_plan_ids: [],
    selected_plan_id: selected,
    score_breakdown: [],
    rejected: [],
    reasoning: "test",
  };
}

describe("Decision Authority: model vs server, rendered truthfully", () => {
  it("SERVER OVERRIDE: model proposes an over-cap plan, server selects a compliant one with a real reason", () => {
    // Identity Enterprise is $49 (over the $40 per-charge cap).
    const d = decide(mkProposal("authentication", "identity_enterprise"), [], intent);
    expect(d.model_selected_plan_id).toBe("identity_enterprise"); // MODEL PROPOSED preserved
    expect(d.selected_plan_id).not.toBe("identity_enterprise"); // SERVER FINAL differs -> override
    expect(d.selected_plan_id).toBe("passgate_pro"); // top compliant plan
    // The override reason is truthful and names both plans (what the panel shows).
    expect(d.note).toBeTruthy();
    expect(d.note).toContain("Identity Enterprise");
    expect(d.note).toContain("PassGate Pro");
  });

  it("SERVER REFUSED: when no plan complies, server final is null with a real reason", () => {
    // SSO only exists on the $49 plan, which the mandate refuses; the others lack SSO.
    const d = decide(mkProposal("authentication", "identity_enterprise", { required_features: ["sso"] }), [], intent);
    expect(d.model_selected_plan_id).toBe("identity_enterprise");
    expect(d.selected_plan_id).toBeNull(); // refused — no compliant plan
    expect(typeof d.note).toBe("string");
    expect((d.note ?? "").length).toBeGreaterThan(0);
  });

  it("no override when the server confirms the model's compliant pick (note stays clean)", () => {
    const d = decide(mkProposal("authentication", "passgate_pro"), [], intent);
    expect(d.selected_plan_id).toBe("passgate_pro");
    expect(d.model_selected_plan_id).toBe("passgate_pro");
    expect(d.note).toBeUndefined(); // no override, so no override reason
  });

  it("ranking-formula parts are real and roughly sum to the score", () => {
    const ranked = rankProposal(mkProposal("llm-inference", "relay_llm"), [], intent);
    const top = ranked.find((r) => r.eligible)!;
    const parts = top.scoreParts;
    const sum = parts.capabilityFit + parts.priceEfficiency + parts.reliability + parts.throughput;
    expect(Math.abs(sum - top.score)).toBeLessThanOrEqual(3); // rounding tolerance
    for (const v of Object.values(parts)) expect(v).toBeGreaterThanOrEqual(0);
  });
});
