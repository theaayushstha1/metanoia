import { describe, it, expect } from "vitest";
import { evaluateAgainstConstitution, type ExistingSubscription } from "@/lib/agent/spendCap";
import type { CartItem, IntentMandate } from "@/lib/ap2/mandate";

const FUTURE = new Date(Date.now() + 86_400_000).toISOString();
const PAST = new Date(Date.now() - 86_400_000).toISOString();

function intent(policy: Partial<IntentMandate["policy"]> = {}, expiry = FUTURE): IntentMandate {
  return {
    user_cart_confirmation_required: true,
    natural_language_description: "test mandate",
    requires_refundability: false,
    intent_expiry: expiry,
    policy: {
      monthly_cap_cents: 6000,
      per_charge_cap_cents: 4000,
      allowed_categories: ["data", "news"],
      max_active_subscriptions: 3,
      ...policy,
    },
  };
}

function item(over: Partial<CartItem> = {}): CartItem {
  return {
    plan_id: "p1",
    label: "Plan 1",
    merchant_name: "Acme",
    category: "data",
    amount_cents: 2900,
    ...over,
  };
}

function sub(over: Partial<ExistingSubscription> = {}): ExistingSubscription {
  return { plan_id: "px", merchant_name: "Acme", category: "data", amount_cents: 900, ...over };
}

describe("Spending Constitution", () => {
  it("approves a within-budget item", () => {
    const v = evaluateAgainstConstitution({ intent: intent(), item: item(), existing: [] });
    expect(v.approved).toBe(true);
    expect(v.remaining_after_cents).toBe(6000 - 2900);
  });

  it("refuses when the per-charge cap is exceeded", () => {
    const v = evaluateAgainstConstitution({
      intent: intent(),
      item: item({ amount_cents: 5000 }),
      existing: [],
    });
    expect(v.approved).toBe(false);
    expect(v.checks.find((c) => c.rule === "per_charge_cap")?.passed).toBe(false);
  });

  it("refuses when the monthly cap would be exceeded by existing commitments", () => {
    const existing = [sub({ plan_id: "a", amount_cents: 2000 }), sub({ plan_id: "b", amount_cents: 2000 })];
    const v = evaluateAgainstConstitution({ intent: intent(), item: item({ amount_cents: 2900 }), existing });
    expect(v.approved).toBe(false);
    expect(v.checks.find((c) => c.rule === "monthly_cap")?.passed).toBe(false);
    expect(v.remaining_after_cents).toBeLessThan(0);
  });

  it("refuses a category outside the allowlist", () => {
    const v = evaluateAgainstConstitution({
      intent: intent(),
      item: item({ category: "maps" }),
      existing: [],
    });
    expect(v.approved).toBe(false);
    expect(v.checks.find((c) => c.rule === "category_allowlist")?.passed).toBe(false);
  });

  it("refuses when the max-subscriptions limit is hit by a new plan", () => {
    const existing = [sub({ plan_id: "a" }), sub({ plan_id: "b" }), sub({ plan_id: "c" })];
    const v = evaluateAgainstConstitution({
      intent: intent(),
      item: item({ plan_id: "d" }),
      existing,
    });
    expect(v.approved).toBe(false);
    expect(v.checks.find((c) => c.rule === "max_subscriptions")?.passed).toBe(false);
  });

  it("does NOT count a renewal of an existing plan against the subscription limit", () => {
    const existing = [sub({ plan_id: "p1" }), sub({ plan_id: "b" }), sub({ plan_id: "c" })];
    const v = evaluateAgainstConstitution({
      intent: intent(),
      item: item({ plan_id: "p1", amount_cents: 900 }),
      existing,
    });
    expect(v.checks.find((c) => c.rule === "max_subscriptions")?.passed).toBe(true);
    expect(v.approved).toBe(true);
  });

  it("refuses when the mandate has expired", () => {
    const v = evaluateAgainstConstitution({
      intent: intent({}, PAST),
      item: item(),
      existing: [],
    });
    expect(v.approved).toBe(false);
    expect(v.checks.find((c) => c.rule === "mandate_expired")?.passed).toBe(false);
  });
});
