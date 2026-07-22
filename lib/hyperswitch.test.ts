import { describe, it, expect } from "vitest";
import { stablePaymentId } from "@/lib/hyperswitch";

describe("stablePaymentId", () => {
  it("is exactly 30 chars (pay_ + 26), which Hyperswitch requires", () => {
    const id = stablePaymentId("cust:plan:2026-07");
    expect(id).toMatch(/^pay_[0-9a-f]{26}$/);
    expect(id.length).toBe(30);
  });

  it("is deterministic in the seed (idempotent retries)", () => {
    expect(stablePaymentId("same")).toBe(stablePaymentId("same"));
    expect(stablePaymentId("a")).not.toBe(stablePaymentId("b"));
  });
});
