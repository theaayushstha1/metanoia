import { describe, it, expect, beforeEach, vi } from "vitest";
import { initiateSubscription, confirmPaid, type PaymentClient } from "@/lib/checkout";
import { getSubscriptions, __resetStore } from "@/lib/store";
import type { PaymentResponse } from "@/lib/hyperswitch";

const CUSTOMER = "cust_test";
const RETURN_URL = "https://example.com/checkout/complete";

/** A fake payment client that records calls and echoes a succeeded payment. */
function fakeClient() {
  const calls: Array<{ paymentId?: string; amount: number }> = [];
  const client: PaymentClient = {
    createPaymentIntent: vi.fn(async (p): Promise<PaymentResponse> => {
      calls.push({ paymentId: p.paymentId, amount: p.amount });
      return {
        payment_id: p.paymentId ?? "pay_generated",
        status: "requires_confirmation",
        client_secret: "cs_test",
        amount: p.amount,
        currency: "USD",
      };
    }),
  };
  return { client, calls };
}

beforeEach(() => __resetStore());

describe("checkout enforcement", () => {
  it("refuses an over-cap plan WITHOUT ever calling Hyperswitch", async () => {
    const { client, calls } = fakeClient();
    // compute_cluster is $59, above the $40 per-charge cap.
    const res = await initiateSubscription(
      { planId: "compute_cluster", customerId: CUSTOMER, returnUrl: RETURN_URL },
      client
    );
    expect(res.refused).toBe(true);
    expect(calls.length).toBe(0);
    expect(client.createPaymentIntent).not.toHaveBeenCalled();
  });

  it("lets a completed purchase change the NEXT spend-gate evaluation", async () => {
    const { client, calls } = fakeClient();

    // Subscribe to Vector Search ($39) — approved.
    const first = await initiateSubscription(
      { planId: "vector_search", customerId: CUSTOMER, returnUrl: RETURN_URL },
      client
    );
    expect(first.refused).toBe(false);
    expect(calls.length).toBe(1);

    // Confirm it succeeded -> now it's a committed subscription.
    if (!first.refused) confirmPaid(first.paymentId, { paymentMethodId: "pm_1" });
    expect(getSubscriptions(CUSTOMER)).toHaveLength(1);

    // Market Data ($29): 39 + 29 = 68 > $60 monthly cap -> must be refused,
    // and Hyperswitch must NOT be called again.
    const second = await initiateSubscription(
      { planId: "tickstream_pro", customerId: CUSTOMER, returnUrl: RETURN_URL },
      client
    );
    expect(second.refused).toBe(true);
    expect(calls.length).toBe(1); // still 1 — no second call
  });

  it("is idempotent: retries cannot create duplicate payments or subscriptions", async () => {
    const { client } = fakeClient();
    const now = new Date("2026-07-21T00:00:00Z");

    const a = await initiateSubscription(
      { planId: "vector_search", customerId: CUSTOMER, returnUrl: RETURN_URL, now },
      client
    );
    const b = await initiateSubscription(
      { planId: "vector_search", customerId: CUSTOMER, returnUrl: RETURN_URL, now },
      client
    );
    expect(a.refused).toBe(false);
    expect(b.refused).toBe(false);
    if (a.refused || b.refused) return;

    // Same billing period -> same stable payment id.
    expect(a.paymentId).toBe(b.paymentId);

    // Confirming twice records the subscription exactly once.
    confirmPaid(a.paymentId, { paymentMethodId: "pm_1" });
    confirmPaid(b.paymentId, { paymentMethodId: "pm_1" });
    expect(getSubscriptions(CUSTOMER)).toHaveLength(1);
  });

  it("ignores out-of-order (stale) success events", async () => {
    const { client } = fakeClient();
    const res = await initiateSubscription(
      { planId: "geocode_lite", customerId: CUSTOMER, returnUrl: RETURN_URL },
      client
    );
    if (res.refused) throw new Error("should be approved");

    confirmPaid(res.paymentId, { updatedAt: 2000, paymentMethodId: "pm_1" });
    // A stale event (older timestamp) must not undo/alter state.
    confirmPaid(res.paymentId, { updatedAt: 1000 });
    expect(getSubscriptions(CUSTOMER)).toHaveLength(1);
  });
});
