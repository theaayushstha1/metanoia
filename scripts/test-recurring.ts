// Full recurring proof: CIT (save card via Stripe) -> off-session MIT.
//   npx tsx --env-file=.env.local scripts/test-recurring.ts
const BASE = process.env.HYPERSWITCH_BASE_URL ?? "https://sandbox.hyperswitch.io";
const KEY = process.env.HYPERSWITCH_SECRET_KEY ?? "";
const CUST = "metanoia_recurring_test";

async function hs(path: string, body: unknown) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": KEY },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  return { http: r.status, j };
}

async function main() {
  // 1) CIT: create intent, force Stripe (mandate-capable), save for future use.
  const create = await hs("/payments", {
    amount: 2900,
    currency: "USD",
    customer_id: CUST,
    confirm: false,
    setup_future_usage: "off_session",
    routing: { type: "single", data: { connector: "stripe", merchant_connector_id: "mca_3VBZvHYZc86g2VYBpkDG" } },
    return_url: "http://localhost:3000/checkout/complete",
  });
  console.log("1) create:", create.http, create.j.payment_id, create.j.status);
  if (!create.j.payment_id) return console.log("   create failed:", JSON.stringify(create.j).slice(0, 300));

  // 2) Confirm with a test card -> should route to Stripe and save a payment method.
  const confirm = await hs(`/payments/${create.j.payment_id}/confirm`, {
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
  });
  console.log("2) confirm:", confirm.http, "status:", confirm.j.status, "connector:", confirm.j.connector);
  console.log("   error_code:", confirm.j.error_code, "| error_message:", confirm.j.error_message);
  console.log("   unified:", confirm.j.unified_code, confirm.j.unified_message);
  const pmId = confirm.j.payment_method_id;
  console.log("   payment_method_id:", pmId ?? null, "mandate_id:", confirm.j.mandate_id ?? null);
  if (!pmId) return console.log("   No saved method -> MIT not possible. Body:", JSON.stringify(confirm.j).slice(0, 300));

  // 3) MIT: off-session renewal using the saved payment method (nobody watching).
  const mit = await hs("/payments", {
    amount: 2900,
    currency: "USD",
    customer_id: CUST,
    confirm: true,
    off_session: true,
    recurring_details: { type: "payment_method_id", data: pmId },
  });
  console.log("3) MIT:", mit.http, "status:", mit.j.status, "connector:", mit.j.connector, "id:", mit.j.payment_id);
  if (mit.j.error) console.log("   error:", JSON.stringify(mit.j.error));
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
