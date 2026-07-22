import Link from "next/link";
import { getPayment } from "@/lib/hyperswitch";
import { confirmPaid } from "@/lib/checkout";
import { getAttempt, getCredential, getSubscriptions, getIntentMandate } from "@/lib/store";
import { getPlan, formatUsd } from "@/lib/catalog";
import { DEMO_CUSTOMER } from "@/lib/constants";
import { TopBar, Pill, Icon, LiveDot, usd } from "../../components/ui";

const blue = "var(--blue)";
const disp = "var(--font-bricolage), sans-serif";

const PHRASE: Record<string, string> = {
  "market-data": "stream market data",
  news: "read the news",
  "vector-search": "run vector search",
  geocoding: "geocode addresses",
  compute: "run GPU jobs",
};

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
      if (p.status === "succeeded") confirmPaid(payment_id, { paymentMethodId: p.payment_method_id });
    } catch (e) {
      verifyError = e instanceof Error ? e.message : "Could not verify payment";
    }
  }

  const ok = status === "succeeded";
  const attempt = payment_id ? getAttempt(payment_id) : undefined;
  const plan = attempt ? getPlan(attempt.planId) : undefined;
  const credential = plan ? getCredential(DEMO_CUSTOMER, plan.id) : undefined;
  const committed = getSubscriptions(DEMO_CUSTOMER).reduce((s, x) => s + x.amount_cents, 0);
  const remaining = getIntentMandate().policy.monthly_cap_cents - committed;
  const shortCred = credential ? `sub_${credential.slice(4, 12).toUpperCase()}` : "sub_—";
  const now = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

  return (
    <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "40px 24px" }}>
      <div className="mn-screen" style={{ width: "100%", maxWidth: 1360 }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "520px 1fr", gap: 56, padding: "56px 64px", alignItems: "start", position: "relative", overflow: "hidden" }}>
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
              <div className="font-mono" style={{ marginTop: 24, border: "1px solid var(--line)", borderRadius: 12, background: "#0e1524", padding: "20px 24px", animation: "rise .6s .45s both" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#e05252" }} />
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f0b429" }} />
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#18a04a" }} />
                  <span style={{ fontSize: 10, color: "#7c8598", marginLeft: 8 }}>agent · live call</span>
                </div>
                <div style={{ marginTop: 14, fontSize: 12.5, lineHeight: 1.8 }}>
                  <div style={{ color: "#7c8598" }}>› GET {plan?.resource ?? "/api/provider"}</div>
                  <div style={{ color: "#4d8cff" }}>
                    {"  "}authorization: {shortCred} <span style={{ color: "#18a04a" }}>✓ 200</span>
                  </div>
                  <div style={{ color: "#ece8e1", marginTop: 8 }}>{`{ "symbol": "AAPL", "price": `}<span style={{ color: "#4d8cff" }}>227.14</span>{` }`}</div>
                  <div style={{ color: "#ece8e1" }}>{`{ "symbol": "NVDA", "price": `}<span style={{ color: "#4d8cff" }}>141.62</span>{` }`}</div>
                  <div style={{ color: "#7c8598", marginTop: 8 }}>
                    streaming {plan?.maxRps ?? 60} req/s
                    <span style={{ display: "inline-block", width: 7, height: 13, background: "#4d8cff", verticalAlign: -2, marginLeft: 4, animation: "blink 1.1s step-end infinite" }} />
                  </div>
                </div>
              </div>
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
