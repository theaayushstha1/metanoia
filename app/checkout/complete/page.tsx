import Link from "next/link";
import { getPayment, type PaymentResponse } from "@/lib/hyperswitch";
import { confirmPaid } from "@/lib/checkout";
import {
  getAttempt,
  recordAttempt,
  getCredential,
  getSubscriptions,
  getIntentMandate,
  getSavedPaymentMethod,
} from "@/lib/store";
import { CATALOG, getPlan, formatUsd, type Plan } from "@/lib/catalog";
import { DEMO_CUSTOMER } from "@/lib/constants";
import { TopBar, Pill, Icon, LiveDot, usd } from "../../components/ui";
import CapabilityProbe from "./CapabilityProbe";
import RenewPanel from "./RenewPanel";

const blue = "var(--blue)";
const disp = "var(--font-bricolage), sans-serif";

const PHRASE: Record<string, string> = {
  "market-data": "stream market data",
  news: "read the news",
  "vector-search": "run vector search",
  geocoding: "geocode addresses",
  compute: "run GPU jobs",
  transcription: "transcribe audio",
};

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

  if (payment_id) {
    try {
      const p = await getPayment(payment_id);
      status = p.status;
      connector = p.connector;
      amountCents = p.amount;
      if (p.status === "succeeded") {
        const existingAttempt = await getAttempt(payment_id);
        if (!existingAttempt) {
          const recoveredPlan = planFromPayment(p);
          const customerId = typeof p.customer_id === "string" ? p.customer_id : undefined;
          if (recoveredPlan && customerId === DEMO_CUSTOMER) {
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
  const credential = plan ? await getCredential(DEMO_CUSTOMER, plan.id) : undefined;
  const savedPm = plan ? await getSavedPaymentMethod(DEMO_CUSTOMER, plan.id) : undefined;
  const committed = (await getSubscriptions(DEMO_CUSTOMER)).reduce((s, x) => s + x.amount_cents, 0);
  const remaining = getIntentMandate().policy.monthly_cap_cents - committed;
  const now = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

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
          <div className="mn-receipt-grid" style={{ display: "grid", gridTemplateColumns: "520px 1fr", gap: 56, padding: "56px 64px", alignItems: "start", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(600px 280px at 30% -60px,rgba(77,140,255,.10),transparent)" }} />

            {/* receipt ticket */}
            <div style={{ position: "relative", border: "1px solid var(--line)", borderRadius: 16, background: "#fff", boxShadow: "0 18px 44px rgba(20,40,90,.12)", overflow: "hidden", animation: "rise .6s .1s both" }}>
              <div style={{ background: "linear-gradient(135deg,#4d8cff,#1e54d0)", padding: "30px 30px 26px", textAlign: "center" }}>
                <span style={{ display: "inline-grid", placeItems: "center", width: 58, height: 58, background: "#fff", borderRadius: "50%", animation: "pop .6s .3s both" }}>
                  <Icon.check size={28} color={blue} sw={2.6} />
                </span>
                <div style={{ marginTop: 14, fontFamily: disp, fontWeight: 800, fontSize: 24, color: "#fff" }}>Payment settled</div>
                <div className="font-mono" style={{ fontSize: 11, fontWeight: 500, letterSpacing: ".1em", color: "rgba(255,255,255,.75)", marginTop: 5 }}>
                  JUSPAY HYPERSWITCH · SANDBOX
                </div>
              </div>
              <div className="font-mono" style={{ padding: "26px 30px 8px", display: "grid", gap: 13 }}>
                <ReceiptRow k="PLAN" v={plan?.name ?? "—"} />
                <ReceiptRow k="AMOUNT" v={`${formatUsd(amountCents ?? plan?.priceCents ?? 0)} / mo`} big />
                <ReceiptRow k="PAYMENT ID" v={payment_id ?? "—"} color={blue} />
                <ReceiptRow k="CONNECTOR" v={connector ?? "—"} />
                <ReceiptRow k="CARD" v="VISA ·· 4242" />
                <ReceiptRow k="DATE" v={now} />
              </div>
              <div style={{ margin: "20px 0 0", borderTop: "1px dashed var(--line)", position: "relative" }}>
                <span style={{ position: "absolute", left: -9, top: -9, width: 18, height: 18, borderRadius: "50%", background: "var(--page)" }} />
                <span style={{ position: "absolute", right: -9, top: -9, width: 18, height: 18, borderRadius: "50%", background: "var(--page)" }} />
              </div>
              <div style={{ padding: "18px 30px 26px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="font-mono" style={{ fontSize: 10, fontWeight: 500, letterSpacing: ".1em", color: "var(--faint)" }}>
                  BUDGET LEFT
                </span>
                <span className="font-mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--green)" }}>
                  {usd(remaining)}
                </span>
              </div>
            </div>

            {/* capability unlocked */}
            <div style={{ position: "relative", paddingTop: 8 }}>
              <div className="font-mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".16em", color: blue, animation: "rise .6s .3s both" }}>
                CAPABILITY UNLOCKED
              </div>
              <div style={{ marginTop: 14, fontFamily: disp, fontWeight: 800, fontSize: 34, letterSpacing: "-.02em", animation: "rise .6s .35s both" }}>
                Your agent can now {PHRASE[plan?.capability ?? ""] ?? "use the API"}.
              </div>
              {plan && (
                <CapabilityProbe
                  resource={plan.resource}
                  credential={credential}
                  capability={plan.capability}
                />
              )}
              {plan && (
                <RenewPanel
                  planId={plan.id}
                  canRenew={Boolean(savedPm) && connector !== "fauxpay"}
                  blockedReason={
                    connector === "fauxpay"
                      ? "Fauxpay proves sandbox settlement but supports payments and refunds only. Use the Stripe path to prove off-session MIT."
                      : undefined
                  }
                />
              )}
              <div style={{ display: "flex", gap: 12, marginTop: 24, animation: "rise .6s .55s both" }}>
                <Link href="/" className="font-body" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: "#fff", background: "linear-gradient(180deg,#3d7bff,#2b6bf3)", borderRadius: 10, padding: "12px 22px", boxShadow: "0 8px 22px rgba(43,107,243,.35)" }}>
                  Back to workbench
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function ReceiptRow({ k, v, big, color }: { k: string; v: string; big?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
      <span style={{ color: "var(--faint)", letterSpacing: ".08em" }}>{k}</span>
      <span style={{ fontWeight: big ? 700 : 600, fontSize: big ? 14 : 11.5, color: color ?? "var(--ink)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {v}
      </span>
    </div>
  );
}
