import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { decide, ProposalSchema, runProcurement, type Proposal } from "@/lib/agent/procure";
import { searchMarketplace, CATALOG } from "@/lib/catalog";
import { __resetStore } from "@/lib/store";
import type { ExistingSubscription } from "@/lib/agent/spendCap";

// decide() takes an injected subscription snapshot; these tests start from none.
const NONE: ExistingSubscription[] = [];

beforeEach(async () => {
  await __resetStore();
});

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
    const d = decide(proposal({ selected_plan_id: "tickstream_pro" }), NONE);
    expect(d.valid).toBe(true);
    expect(d.verdict?.approved).toBe(true);
    expect(d.plan?.price_cents).toBe(2900); // server price, not model-supplied
    expect(d.projected_monthly_cents).toBe(2900);
    expect(d.confirmation_required).toBe(true);
  });

  it("cannot be tricked into an over-cap plan (mandate bypass attempt)", () => {
    // Even if the model selects premium, the deterministic server ranking chooses
    // the highest-ranked eligible plan and never authorizes the over-cap option.
    const ultra = decide(proposal({ selected_plan_id: "realtime_ultra" }), NONE);
    expect(ultra.valid).toBe(true);
    expect(ultra.selected_plan_id).toBe("tickstream_pro");
    expect(ultra.model_selected_plan_id).toBe("realtime_ultra");
    expect(ultra.verdict?.approved).toBe(true);
    expect(ultra.confirmation_required).toBe(true);

    const compute = decide(
      proposal({
        requested_capability: "compute",
        selected_plan_id: "compute_cluster",
        normalized_requirements: { required_features: ["gpu_a100"] },
      }),
      NONE
    );
    expect(compute.verdict?.approved).toBe(false); // $59 > $40
    expect(compute.confirmation_required).toBe(false);
  });

  it("rejects a model selection from the wrong capability", () => {
    const d = decide(proposal({ selected_plan_id: "newsfeed_ai" }), NONE);
    expect(d.valid).toBe(false);
    expect(d.confirmation_required).toBe(false);
  });

  it("fails safe on a hallucinated / unknown plan id", () => {
    const d = decide(proposal({ selected_plan_id: "totally_made_up" }), NONE);
    expect(d.valid).toBe(false);
    expect(d.confirmation_required).toBe(false);
  });

  it("handles no selection cleanly", () => {
    const d = decide(proposal({ selected_plan_id: null }), NONE);
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

describe("request capability boundary", () => {
  it("does not let advisory context turn an unrelated request into a purchase", async () => {
    const result = await runProcurement(
      "Please water my plants. Project context: financial research needs real-time market data.",
      "capability_boundary_test",
      { requestedCapability: null }
    );

    expect(result.proposal).toBeNull();
    expect(result.decision.selected_plan_id).toBeNull();
    expect(result.trace[0]?.tool).toBe("server_capability_gate");
  });
});

describe("payment authorization boundary", () => {
  it("the agent module cannot initiate a payment (no payment imports)", () => {
    const src = fs.readFileSync(new URL("./procure.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/createPaymentIntent|chargeSavedMethod|hyperswitchClient|initiateSubscription/);
  });
});
