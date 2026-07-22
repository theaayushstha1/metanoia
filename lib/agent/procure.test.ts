import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { decide, ProposalSchema, type Proposal } from "@/lib/agent/procure";
import { searchMarketplace, CATALOG } from "@/lib/catalog";
import { __resetStore } from "@/lib/store";
import { DEMO_CUSTOMER } from "@/lib/constants";

beforeEach(() => __resetStore());

function proposal(over: Partial<Proposal>): Proposal {
  return {
    requested_capability: "market-data",
    normalized_requirements: {},
    considered_plan_ids: ["quotestream_basic", "tickstream_pro", "realtime_ultra"],
    selected_plan_id: null,
    score_breakdown: [],
    rejected: [],
    reasoning: "test",
    ...over,
  };
}

describe("marketplace", () => {
  it("offers at least 3 comparable market-data plans", () => {
    expect(CATALOG.filter((p) => p.capability === "market-data").length).toBeGreaterThanOrEqual(3);
  });

  it("filters candidates by hard requirements", () => {
    const ids = searchMarketplace({
      capability: "market-data",
      requiredFeatures: ["websockets"],
      minRps: 60,
      maxPriceCents: 5000,
    }).map((p) => p.id);
    expect(ids).toContain("tickstream_pro");
    expect(ids).toContain("realtime_ultra");
    expect(ids).not.toContain("quotestream_basic"); // no websockets, 30 rps
  });
});

describe("server-authoritative decide()", () => {
  it("approves a within-mandate plan using server-side pricing", () => {
    const d = decide(proposal({ selected_plan_id: "tickstream_pro" }), DEMO_CUSTOMER);
    expect(d.valid).toBe(true);
    expect(d.verdict?.approved).toBe(true);
    expect(d.plan?.price_cents).toBe(2900); // server price, not model-supplied
    expect(d.projected_monthly_cents).toBe(2900);
    expect(d.confirmation_required).toBe(true);
  });

  it("cannot be tricked into an over-cap plan (mandate bypass attempt)", () => {
    // Even if the model 'selects' the premium/over-cap plan, the server refuses.
    const ultra = decide(proposal({ selected_plan_id: "realtime_ultra" }), DEMO_CUSTOMER);
    expect(ultra.valid).toBe(true);
    expect(ultra.verdict?.approved).toBe(false); // $49 > $40 per-charge cap
    expect(ultra.confirmation_required).toBe(false);

    const compute = decide(proposal({ selected_plan_id: "compute_cluster" }), DEMO_CUSTOMER);
    expect(compute.verdict?.approved).toBe(false); // $59 > $40
  });

  it("fails safe on a hallucinated / unknown plan id", () => {
    const d = decide(proposal({ selected_plan_id: "totally_made_up" }), DEMO_CUSTOMER);
    expect(d.valid).toBe(false);
    expect(d.confirmation_required).toBe(false);
  });

  it("handles no selection cleanly", () => {
    const d = decide(proposal({ selected_plan_id: null }), DEMO_CUSTOMER);
    expect(d.valid).toBe(true);
    expect(d.selected_plan_id).toBeNull();
  });
});

describe("structured output", () => {
  it("accepts a well-formed proposal and rejects a malformed one", () => {
    expect(ProposalSchema.safeParse(proposal({ selected_plan_id: "tickstream_pro" })).success).toBe(true);
    expect(ProposalSchema.safeParse({ requested_capability: 42 }).success).toBe(false);
  });
});

describe("payment authorization boundary", () => {
  it("the agent module cannot initiate a payment (no payment imports)", () => {
    const src = fs.readFileSync(new URL("./procure.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/createPaymentIntent|chargeSavedMethod|hyperswitchClient|initiateSubscription/);
  });
});
