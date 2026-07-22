// Full CIT: create intent + confirm with a test card through the live connector.
//   npx tsx --env-file=.env.local scripts/test-confirm.ts
import { createPaymentIntent, stablePaymentId } from "@/lib/hyperswitch";
import { getPlan } from "@/lib/catalog";

const BASE = process.env.HYPERSWITCH_BASE_URL ?? "https://sandbox.hyperswitch.io";
const KEY = process.env.HYPERSWITCH_SECRET_KEY ?? "";

async function main() {
  const plan = getPlan("tickstream_pro");
  if (!plan) throw new Error("plan");
  const pid = stablePaymentId(`confirmtest:${plan.id}:${Date.now()}`);

  const created = await createPaymentIntent({
    amount: plan.priceCents,
    currency: "USD",
    customerId: "metanoia_demo_customer",
    description: plan.name,
    saveForFutureUse: true,
    returnUrl: "http://localhost:3000/checkout/complete",
    paymentId: pid,
  });
  console.log("1) created:", created.payment_id, "status:", created.status);

  const res = await fetch(`${BASE}/payments/${created.payment_id}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": KEY },
    body: JSON.stringify({
      payment_method: "card",
      payment_method_data: {
        card: {
          card_number: "4242424242424242",
          card_exp_month: "10",
          card_exp_year: "30",
          card_holder_name: "Test Buyer",
          card_cvc: "123",
        },
      },
    }),
  });
  const cj = await res.json();
  console.log("2) confirm HTTP:", res.status, "status:", cj.status, "connector:", cj.connector);
  console.log("   payment_method_id:", cj.payment_method_id ?? null, "mandate_id:", cj.mandate_id ?? null);
  if (cj.error) console.log("   error:", JSON.stringify(cj.error));
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
