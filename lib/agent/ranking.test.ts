import { beforeEach, describe, expect, it } from "vitest";
import { rankPlans } from "@/lib/agent/ranking";
import { __resetStore } from "@/lib/store";
import type { ExistingSubscription } from "@/lib/agent/spendCap";

// No existing subscriptions in these unit tests -> inject an empty snapshot.
const NONE: ExistingSubscription[] = [];

beforeEach(async () => {
  await __resetStore();
});

describe("deterministic procurement ranking", () => {
  it("returns three market-data choices and selects the compliant balanced option", () => {
    const ranked = rankPlans(
      "market-data",
      {
        max_price_cents: 5000,
        min_rps: 60,
        needs_realtime: true,
        needs_websockets: true,
        priority: "balanced",
      },
      NONE
    );

    expect(ranked).toHaveLength(3);
    expect(ranked[0].plan.id).toBe("tickstream_pro");
    expect(ranked[0].eligible).toBe(true);
    expect(ranked.find((r) => r.plan.id === "quotestream_basic")?.hardFailures).toContain(
      "missing websockets"
    );
    expect(ranked.find((r) => r.plan.id === "realtime_ultra")?.verdict.approved).toBe(false);
  });

  it("refuses every A100 option when the mandate cannot afford one", () => {
    const ranked = rankPlans(
      "compute",
      { required_features: ["gpu_a100"], priority: "throughput" },
      NONE
    );
    expect(ranked.some((r) => r.eligible)).toBe(false);
    expect(ranked.find((r) => r.plan.id === "compute_cluster")?.verdict.approved).toBe(false);
  });

  it("offers at least three alternatives in every supported niche", () => {
    for (const capability of ["market-data", "news", "vector-search", "geocoding", "compute"] as const) {
      expect(rankPlans(capability, {}, NONE)).toHaveLength(3);
    }
  });
});
