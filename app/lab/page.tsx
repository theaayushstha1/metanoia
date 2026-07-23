import Link from "next/link";
import { listAttempts, getRefundRecord } from "@/lib/store";
import { getPlan, formatUsd } from "@/lib/catalog";
import { getSessionCustomerId, ANON_CUSTOMER } from "@/lib/session";
import { TopBar, Pill, Icon } from "../components/ui";
import CopyButton from "./CopyButton";
import PaymentRow from "./PaymentRow";

export const dynamic = "force-dynamic";

const disp = "var(--font-bricolage), sans-serif";

type Tone = "good" | "bad" | "info";
const SCENARIOS: { label: string; pretty: string; raw: string; outcome: string; tone: Tone }[] = [
  { label: "Visa success", pretty: "4111 1111 1111 1111", raw: "4111111111111111", outcome: "succeeded", tone: "good" },
  { label: "Mastercard success", pretty: "5555 5555 5555 4444", raw: "5555555555554444", outcome: "succeeded", tone: "good" },
  { label: "Amex success", pretty: "3782 822463 10005", raw: "378282246310005", outcome: "succeeded", tone: "good" },
  { label: "Declined", pretty: "4000 0000 0000 0002", raw: "4000000000000002", outcome: "failed · generic decline", tone: "bad" },
  { label: "Insufficient funds", pretty: "4000 0000 0000 9995", raw: "4000000000009995", outcome: "failed · insufficient funds", tone: "bad" },
  { label: "3DS challenge", pretty: "4000 0038 0000 0446", raw: "4000003800000446", outcome: "requires_customer_action", tone: "info" },
];

const toneColor = (t: Tone) => (t === "good" ? "var(--green)" : t === "bad" ? "var(--red)" : "var(--blue)");

export default async function LabPage() {
  // Only this session's payments, and NO Hyperswitch calls on load (store reads only).
  // Live status is fetched per row on demand via the Refresh button.
  const sessionCustomer = await getSessionCustomerId();
  const attempts = sessionCustomer === ANON_CUSTOMER ? [] : (await listAttempts(sessionCustomer)).slice(0, 10);
  const rows = await Promise.all(
    attempts.map(async (a) => {
      const refundRec = await getRefundRecord(a.paymentId);
      const plan = getPlan(a.planId);
      return {
        paymentId: a.paymentId,
        planName: plan?.name ?? a.planId,
        storedStatus: a.status,
        amountLabel: formatUsd(a.amountCents),
        refund: refundRec
          ? { refundId: refundRec.refundId, status: refundRec.status, amountLabel: formatUsd(refundRec.amountCents) }
          : null,
      };
    })
  );

  return (
    <main style={{ minHeight: "100vh", background: "#fff" }}>
      <TopBar
        tag="PAYMENT TEST LAB"
        right={
          <Pill>
            <Icon.bolt size={11} color="var(--green)" /> FAUXPAY SANDBOX
          </Pill>
        }
      />

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "44px 28px 90px" }}>
        <div className="font-mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".16em", color: "var(--blue)" }}>
          SANDBOX SCENARIOS
        </div>
        <h1 style={{ margin: "12px 0 6px", fontFamily: disp, fontWeight: 800, fontSize: 32, letterSpacing: "-.02em" }}>
          Payment test lab
        </h1>
        <p className="font-mono" style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: "var(--muted)", maxWidth: 680 }}>
          Copy a card, open a real checkout, and paste it into the Hyperswitch iframe yourself. Every result below
          is retrieved live from the sandbox, never faked. Any future expiry, any 3-digit CVC.{" "}
          <a href="https://docs.hyperswitch.io/explore-hyperswitch/payment-flows-and-management/quickstart/connectors/test-a-payment-with-connector" target="_blank" rel="noreferrer" style={{ color: "var(--blue)" }}>
            Official test cards
          </a>
          .
        </p>

        {/* scenario reference cards */}
        <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
          {SCENARIOS.map((s) => (
            <div key={s.raw} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span className="font-body" style={{ fontSize: 14, fontWeight: 700 }}>{s.label}</span>
                <span className="font-mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".06em", color: toneColor(s.tone), background: s.tone === "good" ? "var(--green-bg)" : s.tone === "bad" ? "var(--red-bg)" : "var(--panel)", border: `1px solid ${toneColor(s.tone)}33`, borderRadius: 99, padding: "3px 9px" }}>
                  {s.outcome.toUpperCase()}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span className="font-mono" style={{ fontSize: 13, letterSpacing: ".04em", color: "var(--ink)" }}>{s.pretty}</span>
                <CopyButton value={s.raw} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/checkout?plan=tickstream_pro" className="font-body" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--blue)", borderRadius: 10, padding: "11px 20px", textDecoration: "none" }}>
            Open a checkout to test
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
          <span className="font-mono" style={{ alignSelf: "center", fontSize: 10.5, color: "var(--faint)" }}>
            Paste a copied card into the secure iframe. Card data never touches this app.
          </span>
        </div>

        {/* your payments panel — this session only, live status on demand */}
        <div style={{ marginTop: 40 }}>
          <div className="font-mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".14em", color: "var(--muted)" }}>
            YOUR PAYMENTS · THIS SESSION
          </div>
          <p className="font-mono" style={{ marginTop: 6, fontSize: 10.5, color: "var(--faint)" }}>
            Only payments you created here. Hit &ldquo;Refresh status&rdquo; on a row to retrieve its live state from the sandbox.
          </p>
          {rows.length === 0 && (
            <p className="font-mono" style={{ marginTop: 14, fontSize: 12, color: "var(--faint)" }}>
              No payments yet. Run a checkout above and it will appear here with its real status and timeline.
            </p>
          )}
          <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
            {rows.map((r) => (
              <PaymentRow
                key={r.paymentId}
                paymentId={r.paymentId}
                planName={r.planName}
                storedStatus={r.storedStatus}
                amountLabel={r.amountLabel}
                refund={r.refund}
              />
            ))}
          </div>
        </div>

        {/* PayPal — pending real credentials, no fake button */}
        <div style={{ marginTop: 40, border: "1px dashed var(--line-3)", borderRadius: 14, padding: "20px 22px", background: "var(--panel)" }}>
          <div className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".14em", color: "var(--muted)" }}>
            PAYPAL SANDBOX · PENDING CREDENTIALS
          </div>
          <p className="font-mono" style={{ margin: "8px 0 0", fontSize: 11.5, lineHeight: 1.6, color: "var(--muted)", maxWidth: 720 }}>
            PayPal is intentionally not shown as a button until it is really configured. To enable it: add a PayPal
            sandbox Client ID + Secret as a Hyperswitch connector, then Unified Checkout renders PayPal as a real
            method (customer picks PayPal; Hyperswitch routes it). No fake button is added.{" "}
            <a href="https://docs.hyperswitch.io/explore-hyperswitch/connectors/available-connectors/paypal" target="_blank" rel="noreferrer" style={{ color: "var(--blue)" }}>
              Hyperswitch PayPal setup
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
