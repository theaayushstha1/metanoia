import { describe, expect, it } from "vitest";
import { sanitizeScoutOutput, type RawScoutOutput } from "./scouts";

const raw: RawScoutOutput = {
  winner_plan_id: "known",
  ranked_plan_ids: ["known", "hallucinated", "known"],
  headline: "Known plan wins this lens",
  summary: "A short advisory explanation.",
  observations: [
    { plan_id: "known", score: 91, evidence: "Server data", concern: null },
    { plan_id: "hallucinated", score: 99, evidence: "Invented", concern: null },
  ],
  external_signals: [{ provider: "Outside", signal: "Research only" }],
};

describe("scout report safety", () => {
  it("removes hallucinated catalog ids and external claims from catalog scouts", () => {
    const report = sanitizeScoutOutput("price", raw, ["known"]);
    expect(report.winner_plan_id).toBe("known");
    expect(report.ranked_plan_ids).toEqual(["known"]);
    expect(report.observations.map((item) => item.plan_id)).toEqual(["known"]);
    expect(report.external_signals).toEqual([]);
  });

  it("keeps market research separate from purchasable catalog rankings", () => {
    const report = sanitizeScoutOutput("market", raw, ["known"], [
      { title: "Primary source", url: "https://example.com" },
    ]);
    expect(report.scope).toBe("external_research");
    expect(report.winner_plan_id).toBeNull();
    expect(report.ranked_plan_ids).toEqual([]);
    expect(report.observations).toEqual([]);
    expect(report.external_signals).toHaveLength(1);
    expect(report.sources).toHaveLength(1);
  });
});
