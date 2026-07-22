// Real Hyperswitch sandbox call. Run:
//   npx tsx --env-file=.env.local scripts/test-payment.ts
import { createPaymentIntent, stablePaymentId } from "@/lib/hyperswitch";
import { getPlan } from "@/lib/catalog";

async function main() {
  const plan = getPlan("tickstream_pro");
  if (!plan) throw new Error("plan not found");

  console.log("Base:", process.env.HYPERSWITCH_BASE_URL);
  console.log("Secret present:", (process.env.HYPERSWITCH_SECRET_KEY ?? "").slice(0, 8) + "…");

  const res = await createPaymentIntent({
    amount: plan.priceCents,
    currency: "USD",
    customerId: "metanoia_demo_customer",
    description: plan.name,
    saveForFutureUse: true,
    returnUrl: "http://localhost:3000/checkout/complete",
    paymentId: stablePaymentId(`livetest:${plan.id}:probe`),
  });

  console.log("OK — created payment intent:");
  console.log(
    JSON.stringify(
      {
        payment_id: res.payment_id,
        status: res.status,
        has_client_secret: Boolean(res.client_secret),
        connector: res.connector,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
