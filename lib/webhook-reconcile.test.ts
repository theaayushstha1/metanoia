import { describe, it, expect, beforeEach } from "vitest";
import {
  processWebhook,
  recordAttempt,
  reconcilePendingEvents,
  getSubscriptions,
  getSavedPaymentMethod,
  __resetStore,
} from "@/lib/store";

const CUSTOMER = "metanoia_demo_customer";

beforeEach(async () => {
  await __resetStore();
});

describe("webhook reconciliation for retained (processed=false) events", () => {
  it("recovers a retained webhook on redelivery once the payment becomes known", async () => {
    const ev = { eventId: "evt_1", eventType: "payment_succeeded", paymentId: "pay_abc", raw: {} };

    // Event arrives before we know the payment -> retained, not applied, not duplicate.
    const r1 = await processWebhook(ev);
    expect(r1.duplicate).toBe(false);
    expect(r1.applied).toBe(false);
    expect(await getSubscriptions(CUSTOMER)).toHaveLength(0);

    // The payment becomes known.
    await recordAttempt({ paymentId: "pay_abc", customerId: CUSTOMER, planId: "vector_search", amountCents: 3900 });

    // Redelivery of the SAME event id must now recover, not be rejected as a duplicate.
    const r2 = await processWebhook(ev);
    expect(r2.duplicate).toBe(false);
    expect(r2.applied).toBe(true);
    expect(await getSubscriptions(CUSTOMER)).toHaveLength(1);

    // Now it is genuinely processed -> a further redelivery is a true duplicate.
    const r3 = await processWebhook(ev);
    expect(r3.duplicate).toBe(true);
  });

  it("reconcilePendingEvents settles retained events and preserves paymentMethodId", async () => {
    const ev = {
      eventId: "evt_2",
      eventType: "payment_succeeded",
      paymentId: "pay_xyz",
      paymentMethodId: "pm_saved_1",
      updatedAt: 1000,
      raw: {},
    };
    await processWebhook(ev); // retained, with its metadata
    expect(await getSubscriptions(CUSTOMER)).toHaveLength(0);

    await recordAttempt({ paymentId: "pay_xyz", customerId: CUSTOMER, planId: "vector_search", amountCents: 3900 });

    expect(await reconcilePendingEvents()).toBe(1);
    expect(await getSubscriptions(CUSTOMER)).toHaveLength(1);
    // The preserved payment method survived the sweep (not dropped).
    expect(await getSavedPaymentMethod(CUSTOMER, "vector_search")).toBe("pm_saved_1");

    // Idempotent: nothing new to settle on a second sweep.
    expect(await reconcilePendingEvents()).toBe(0);
  });
});
