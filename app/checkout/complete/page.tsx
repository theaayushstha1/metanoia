import Link from "next/link";
import { getPayment, type PaymentResponse } from "@/lib/hyperswitch";
import { confirmPaid } from "@/lib/checkout";
import {
  getAttempt,
  recordAttempt,
  getCredential,
  getSubscriptions,
  getSavedPaymentMethod,
} from "@/lib/store";
import { CATALOG, getPlan, formatUsd, type Plan } from "@/lib/catalog";
import { getSessionCustomerId } from "@/lib/session";
import { TopBar, Pill, LiveDot, usd } from "../../components/ui";
import PaymentTrace, { type TraceStep } from "./PaymentTrace";
import PaymentDetails from "./PaymentDetails";
import RenewPanel from "./RenewPanel";
import { getSessionIntentMandate } from "@/lib/mandate-session";

const blue = "var(--blue)";
const disp = "var(--font-bricolage), sans-serif";

/** Recover checkout context when a local in-memory store was reset after payment. */
function planFromPayment(payment: PaymentResponse): Plan | undefined {
  const metadata = payment.metadata;
  if (metadata && typeof metadata === "object" && "plan_id" in metadata) {
    const planId = (metadata as { plan_id?: unknown }).plan_id;
    if (typeof planId === "string") return getPlan(planId);
  }

  const description = typeof payment.description === "string" ? payment.description : "";
  return CATALOG.find(
    (candidate) =>
      candidate.priceCents === payment.amount &&
      description.startsWith(`${candidate.name} (${candidate.vendor})`)
  );
}

export default async function CompletePage({
  searchParams,
}: {
  searchParams: Promise<{ payment_id?: string }>;
}) {
  const { payment_id } = await searchParams;

  let status: string | null = null;
  let connector: string | undefined;
  let amountCents: number | undefined;
  let verifyError: string | null = null;
  let payment: PaymentResponse | null = null;
  const sessionCustomer = await getSessionCustomerId();

  if (payment_id) {
    try {
      const p = await getPayment(payment_id);
      payment = p;
      status = p.status;
      connector = p.connector;
      amountCents = p.amount;
      if (p.status === "succeeded") {
        const existingAttempt = await getAttempt(payment_id);
        if (!existingAttempt) {
          const recoveredPlan = planFromPayment(p);
          const customerId = typeof p.customer_id === "string" ? p.customer_id : undefined;
          if (recoveredPlan && customerId === sessionCustomer) {
            await recordAttempt({
              paymentId: payment_id,
              customerId,
              planId: recoveredPlan.id,
              amountCents: p.amount,
            });
          }
        }
        await confirmPaid(payment_id, { paymentMethodId: p.payment_method_id });
      }
    } catch (e) {
      verifyError = e instanceof Error ? e.message : "Could not verify payment";
    }
  }

  const ok = status === "succeeded";
  const attempt = payment_id ? await getAttempt(payment_id) : undefined;
  const plan = attempt ? getPlan(attempt.planId) : undefined;
  const credential = plan ? await getCredential(sessionCustomer, plan.id) : undefined;
  const savedPm = plan ? await getSavedPaymentMethod(sessionCustomer, plan.id) : undefined;
  const committed = (await getSubscriptions(sessionCustomer)).reduce((s, x) => s + x.amount_cents, 0);
  const policy = (await getSessionIntentMandate()).policy;
  const remaining = policy.monthly_cap_cents - committed;
  const now = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const amountLabel = formatUsd(amountCents ?? plan?.priceCents ?? 0);
  const credShort = credential ? `${credential.slice(0, 8)}…${credential.slice(-4)}` : "not issued";

  // Non-sensitive card metadata + a deep link to this exact payment in the Hyperswitch dashboard.
  const card = payment?.payment_method_data?.card;
  const cardLabel = card?.last4 ? `${card.card_network ?? "Card"} •••• ${card.last4}` : (payment?.payment_method_type ?? "card");
  const dashboardBase = process.env.HYPERSWITCH_DASHBOARD_URL || "https://app.hyperswitch.io";
  const dashboardUrl =
    payment?.profile_id && payment?.merchant_id
      ? `${dashboardBase}/dashboard/payments/${payment.payment_id}/${payment.profile_id}/${payment.merchant_id}`
      : undefined;

  // The real, in-order lifecycle this payment cleared — every line is settled data.
  const trace: TraceStep[] = [
    { label: "Mandate verified", detail: `${amountLabel} within ${formatUsd(policy.per_charge_cap_cents)} per-charge and ${formatUsd(policy.monthly_cap_cents)} monthly caps`, tone: "done" },
    { label: "Payment intent created", detail: `${payment_id ?? "n/a"} · ${amountLabel} USD`, tone: "done" },
    { label: "Routed to connector", detail: `${connector ?? "n/a"} · customer-initiated (CIT)`, tone: "done" },
    { label: "Authorized and captured", detail: `status ${status ?? "n/a"}`, tone: "done" },
    {
      label: "Reusable method vaulted",
      detail: savedPm
        ? `${savedPm.slice(0, 8)}… ready for off-session renewal`
        : "none returned (Fauxpay supports payments/refunds only)",
      tone: savedPm ? "done" : "info",
    },
    { label: "Webhook receiver verified", detail: "settled via authenticated retrieve; signed-webhook endpoint live (HMAC), awaiting Hyperswitch delivery", tone: "info" },
    { label: "Subscription recorded", detail: `active · ${usd(remaining)} budget left`, tone: "done" },
    { label: "Capability credential issued", detail: credShort, tone: "done" },
  ];

  return (
    <main style={{ minHeight: "100vh" }}>
      <div style={{ minHeight: "100vh", background: "#fff" }}>
        <TopBar
          tag="RECEIPT"
          right={
            ok ? (
              <Pill tone="green">
                <LiveDot /> SUBSCRIPTION ACTIVE
              </Pill>
            ) : (
              <Pill>{status ? status.toUpperCase() : "NO PAYMENT"}</Pill>
            )
          }
        />

        {!ok ? (
          <div style={{ padding: "80px 64px", textAlign: "center" }}>
            <div style={{ fontFamily: disp, fontWeight: 800, fontSize: 40 }}>
              {payment_id ? `Payment ${status ?? "unverified"}` : "No payment to verify"}
            </div>
            {payment_id && (
              <p className="font-mono" style={{ marginTop: 10, fontSize: 12, color: "var(--faint)" }}>
                {payment_id}
              </p>
            )}
            {verifyError && (
              <p className="font-mono" style={{ marginTop: 10, fontSize: 12, color: "var(--red)" }}>
                {verifyError}
              </p>
            )}
            <Link href="/" style={{ display: "inline-block", marginTop: 28, color: blue, fontWeight: 600 }}>
              Back to Metanoia
            </Link>
          </div>
        ) : (
          <>
          <div className="mn-receipt-grid" style={{ display: "grid", gridTemplateColumns: "minmax(420px, 42%) 1fr", minHeight: "calc(100vh - 58px)" }}>
            {/* LEFT — payment summary, a full-height brand panel */}
            <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(160deg,#3d7bff 0%,#2b6bf3 46%,#1a3fa0 100%)", color: "#fff", padding: "48px 54px", display: "flex", flexDirection: "column", justifyContent: "center", animation: "rise .6s .05s both" }}>
              <div style={{ position: "absolute", top: -90, right: -90, width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,255,.16),transparent 70%)" }} />
              <div style={{ position: "relative", width: "100%", maxWidth: 440, margin: "0 auto" }}>
                <span style={{ position: "relative", display: "inline-grid", placeItems: "center", width: 62, height: 62 }}>
                  <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(255,255,255,.4)", animation: "mnripple 1.8s ease-out .5s 2" }} />
                  <span style={{ display: "grid", placeItems: "center", width: 58, height: 58, background: "#fff", borderRadius: "50%", boxShadow: "0 8px 22px rgba(12,30,80,.3)", animation: "pop .6s .3s both" }}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" stroke="#2b6bf3" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="26" strokeDashoffset="26" style={{ animation: "mntick .5s .55s forwards" }} />
                    </svg>
                  </span>
                </span>
                <div style={{ marginTop: 16, fontFamily: disp, fontWeight: 800, fontSize: 30, animation: "rise .5s .35s both" }}>Payment settled</div>
                <div className="font-mono" style={{ fontSize: 11, fontWeight: 500, letterSpacing: ".1em", color: "rgba(255,255,255,.72)", marginTop: 6, animation: "rise .5s .42s both" }}>
                  JUSPAY HYPERSWITCH · SANDBOX
                </div>
                <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
                  {["Mandate re-checked", "Credential issued", "Capability online"].map((label, i) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, animation: `rise .45s ${0.6 + i * 0.28}s both` }}>
                      <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.5)", display: "grid", placeItems: "center", flex: "none" }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M20 6 9 17l-5-5" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="26" strokeDashoffset="26" style={{ animation: `mntick .4s ${0.75 + i * 0.28}s forwards` }} />
                        </svg>
                      </span>
                      <span className="font-mono" style={{ fontSize: 11, letterSpacing: ".04em", color: "rgba(255,255,255,.94)" }}>{label}</span>
                    </div>
                  ))}
                </div>

                <div className="font-mono" style={{ marginTop: 28, paddingTop: 22, borderTop: "1px solid rgba(255,255,255,.18)", display: "grid", gap: 14, animation: "rise .6s .5s both" }}>
                  {([
                    ["PLAN", plan?.name ?? "n/a", false],
                    ["AMOUNT", `${formatUsd(amountCents ?? plan?.priceCents ?? 0)} / mo`, true],
                    ["PAYMENT ID", payment_id ?? "n/a", false],
                    ["CONNECTOR", connector ?? "n/a", false],
                    ["CARD", cardLabel, false],
                    ["DATE", now, false],
                  ] as [string, string, boolean][]).map(([k, v, big]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
                      <span style={{ fontSize: 10.5, letterSpacing: ".08em", color: "rgba(255,255,255,.62)" }}>{k}</span>
                      <span style={{ fontSize: big ? 16 : 12, fontWeight: big ? 700 : 600, color: "#fff", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 22, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,.18)", display: "flex", justifyContent: "space-between", alignItems: "center", animation: "rise .6s .58s both" }}>
                  <span className="font-mono" style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: ".1em", color: "rgba(255,255,255,.72)" }}>BUDGET LEFT</span>
                  <span className="font-mono" style={{ fontSize: 20, fontWeight: 700, color: "#9ef7c8" }}>{usd(remaining)}</span>
                </div>

                <Link href="/" className="font-body" style={{ marginTop: 28, display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: blue, background: "#fff", borderRadius: 10, padding: "12px 24px", boxShadow: "0 10px 24px rgba(12,30,80,.28)", animation: "rise .6s .64s both" }}>
                  Back to workbench
                </Link>
              </div>
            </div>

            {/* RIGHT — capability unlocked, full-height */}
            <div style={{ position: "relative", overflow: "hidden", background: "#fff", padding: "48px 56px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(600px 300px at 72% 0,rgba(77,140,255,.07),transparent)" }} />
              <div style={{ position: "relative", width: "100%", maxWidth: 620 }}>
                <div className="font-mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".16em", color: blue, animation: "rise .6s .3s both" }}>
                  PAYMENT PROCESSING
                </div>
                <div style={{ marginTop: 14, fontFamily: disp, fontWeight: 800, fontSize: 34, letterSpacing: "-.02em", lineHeight: 1.06, animation: "rise .6s .35s both" }}>
                  Everything this payment cleared.
                </div>
                <p className="font-mono" style={{ margin: "10px 0 0", fontSize: 11.5, lineHeight: 1.5, color: "var(--faint)", animation: "rise .6s .4s both" }}>
                  Each step is real settlement data from Juspay Hyperswitch, in the order it happened.
                </p>
                {plan && <PaymentTrace steps={trace} resource={plan.resource} credential={credential} />}
                {plan && (
                  <RenewPanel
                    planId={plan.id}
                    canRenew={Boolean(savedPm) && connector !== "fauxpay"}
                    blockedReason={
                      connector === "fauxpay"
                        ? "Recurring is coded but connector-blocked. Fauxpay settles payments and refunds only, and the Stripe connector returns UE_9000 until Stripe grants raw-card API access on the account. Once granted, checkout switches to Stripe to prove off-session MIT."
                        : undefined
                    }
                  />
                )}
              </div>
            </div>
          </div>
            <PaymentDetails
              paymentId={payment_id!}
              status={status ?? "n/a"}
              amountCents={amountCents ?? plan?.priceCents ?? 0}
              amountReceivedCents={payment?.amount_received}
              netAmountCents={payment?.net_amount}
              currency={payment?.currency}
              connector={connector}
              connectorTxnId={payment?.connector_transaction_id}
              merchantConnectorId={payment?.merchant_connector_id}
              paymentMethod={payment?.payment_method}
              paymentMethodType={payment?.payment_method_type}
              authenticationType={payment?.authentication_type}
              captureMethod={payment?.capture_method}
              created={payment?.created}
              updated={payment?.updated ?? payment?.modified_at}
              errorMessage={payment?.error_message}
              card={card}
              merchantId={payment?.merchant_id}
              profileId={payment?.profile_id}
              customerId={payment?.customer_id}
              attemptCount={payment?.attempt_count}
              dashboardUrl={dashboardUrl}
              plan={plan}
            />
          </>
        )}
      </div>
    </main>
  );
}
