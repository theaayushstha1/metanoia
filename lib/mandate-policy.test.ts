import { describe, expect, it } from "vitest";
import { DEFAULT_EDITABLE_MANDATE, EditableMandateSchema } from "./mandate-policy";

describe("editable mandate policy", () => {
  it("accepts the default policy", () => {
    expect(EditableMandateSchema.parse(DEFAULT_EDITABLE_MANDATE)).toEqual(DEFAULT_EDITABLE_MANDATE);
  });

  it("rejects a per-purchase cap above the monthly budget", () => {
    expect(
      EditableMandateSchema.safeParse({
        monthly_cap_cents: 5000,
        per_charge_cap_cents: 6000,
        max_active_subscriptions: 3,
      }).success
    ).toBe(false);
  });

  it("rejects values outside the bounded slider ranges", () => {
    expect(
      EditableMandateSchema.safeParse({
        monthly_cap_cents: 25000,
        per_charge_cap_cents: 4000,
        max_active_subscriptions: 11,
      }).success
    ).toBe(false);
  });
});

