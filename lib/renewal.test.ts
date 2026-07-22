import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  initiateSubscription,
  confirmPaid,
  evaluateRenewal,
  renewSubscription,
  type PaymentClient,
  type RenewalClient,
} from "@/lib/checkout";
import { getSubscriptions, __resetStore } from "@/lib/store";
import type { PaymentResponse } from "@/lib/hyperswitch";

const CUSTOMER = "metanoia_demo_customer";
const RETURN_URL = "https://example.com/checkout/complete";

function fakePaymentClient(): PaymentClient {
  return {
    createPaymentIntent: vi.fn(
      async (p): Promise<PaymentResponse> => ({
        payment_id: p.paymentId ?? "pay_x",
        status: "requires_confirmation",
        client_secret: "cs",
        amount: p.amount,
        currency: "USD",
      })
    ),
  };
}

function fakeRenewalClient() {
  const client: RenewalClient = {
    chargeSavedMethod: vi.fn(
      async (p): Promise<PaymentResponse> => ({
        payment_id: p.paymentId ?? "pay_r",
        status: "succeeded",
        amount: p.amount,
        currency: "USD",
      })
    ),
  };
  return client;
}

async function subscribe(planId: string) {
  const r = await initiateSubscription(
    { planId, customerId: CUSTOMER, returnUrl: RETURN_URL },
    fakePaymentClient()
  );
  if (!r.refused) confirmPaid(r.paymentId, { paymentMethodId: "pm_1" });
}

beforeEach(() => __resetStore());

describe("renewal mandate re-check", () => {
  it("excludes the current subscription (no double-count) when renewing", async () => {
    await subscribe("vector_search"); // $39
    await subscribe("newsfeed_ai"); //   $15  -> committed $54
    // Renewing vector at $39: others ($15) + $39 = $54 <= $60 -> allowed.
    // If it double-counted vector it'd be $54 + $39 = $93 -> refused.
    expect(evaluateRenewal("vector_search", CUSTOMER, 3900).approved).toBe(true);
  });

  it("refuses a renewal whose increased price breaks the per-charge cap", () => {
    const v = evaluateRenewal("vector_search", CUSTOMER, 5000); // vendor raised to $50 > $40 cap
    expect(v.approved).toBe(false);
    expect(v.checks.find((c) => c.rule === "per_charge_cap")?.passed).toBe(false);
  });
});

describe("renewSubscription", () => {
  it("returns 409 and never charges when there is no saved payment method", async () => {
    const client = fakeRenewalClient();
    const r = await renewSubscription({ planId: "vector_search", customerId: CUSTOMER }, client);
    expect(r.ok).toBe(false);
    if (!r.ok && "code" in r) expect(r.code).toBe(409);
    expect(client.chargeSavedMethod).not.toHaveBeenCalled();
  });

  it("charges once, stays idempotent, and does not duplicate the subscription", async () => {
    await subscribe("vector_search");
    expect(getSubscriptions(CUSTOMER)).toHaveLength(1);

    const client = fakeRenewalClient();
    const now = new Date("2026-08-01T00:00:00Z");
    const r1 = await renewSubscription({ planId: "vector_search", customerId: CUSTOMER, now }, client);
    const r2 = await renewSubscription({ planId: "vector_search", customerId: CUSTOMER, now }, client);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (r1.ok && r2.ok) expect(r1.paymentId).toBe(r2.paymentId); // same period -> same id
    expect(getSubscriptions(CUSTOMER)).toHaveLength(1); // no duplicate
  });
});
