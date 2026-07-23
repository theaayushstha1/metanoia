import { formatUsd, type Plan } from "@/lib/catalog";
import type { HyperswitchCard } from "@/lib/hyperswitch";

const blue = "var(--blue)";
const disp = "var(--font-bricolage), sans-serif";

export interface PaymentDetailsProps {
  paymentId: string;
  status: string;
  amountCents: number;
  amountReceivedCents?: number;
  netAmountCents?: number;
  currency?: string;
  connector?: string;
  connectorTxnId?: string;
  merchantConnectorId?: string;
  paymentMethod?: string;
  paymentMethodType?: string;
  authenticationType?: string;
  captureMethod?: string;
  created?: string;
  updated?: string;
  errorMessage?: string;
  card?: HyperswitchCard;
  merchantId?: string;
  profileId?: string;
  customerId?: string;
  attemptCount?: number;
  dashboardUrl?: string;
  plan?: Plan;
}

/** ISO 8601 -> "Jul 23, 2026 · 15:23:09 UTC". Returns "n/a" for anything unparseable. */
function fmtTime(iso?: string): string {
  if (!iso) return "n/a";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const time = d.toISOString().slice(11, 19);
  return `${date} · ${time} UTC`;
}

function Field({ label, value, mono = true, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
      <span className="font-mono" style={{ fontSize: 10, letterSpacing: ".08em", color: "var(--faint)", textTransform: "uppercase" }}>
        {label}
      </span>
      <span
        className={mono ? "font-mono" : "font-body"}
        style={{ fontSize: 12.5, fontWeight: 600, color: accent ? blue : "var(--ink)", overflowWrap: "anywhere", lineHeight: 1.4 }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function Card({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 14, background: "#fff", padding: "18px 20px", boxShadow: "0 1px 2px rgba(16,32,72,.03)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span className="font-mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", color: "var(--ink)" }}>{title}</span>
        {badge && (
          <span className="font-mono" style={{ fontSize: 9.5, letterSpacing: ".06em", color: "var(--faint)" }}>{badge}</span>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 24px" }}>{children}</div>
    </div>
  );
}

export default function PaymentDetails(p: PaymentDetailsProps) {
  const cur = p.currency ?? "USD";
  const card = p.card;
  const cardLine = card?.last4 ? `${card.card_network ?? "Card"} •••• ${card.last4}` : "n/a";
  const issuerLine = [card?.card_issuer, card?.card_issuing_country].filter(Boolean).join(" · ") || "n/a";
  const expLine = card?.card_exp_month && card?.card_exp_year ? `${card.card_exp_month}/${card.card_exp_year}` : "n/a";

  return (
    <section style={{ borderTop: "1px solid var(--line)", background: "var(--wash, #f7f9fc)", padding: "44px 56px", animation: "rise .6s .1s both" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 22 }}>
          <div style={{ minWidth: 0 }}>
            <div className="font-mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".16em", color: blue }}>
              PAYMENT RECORD · LIVE FROM HYPERSWITCH
            </div>
            <div style={{ marginTop: 10, fontFamily: disp, fontWeight: 800, fontSize: 28, letterSpacing: "-.02em" }}>
              The full payment record.
            </div>
            <p className="font-mono" style={{ margin: "8px 0 0", fontSize: 11.5, lineHeight: 1.55, color: "var(--faint)", maxWidth: 640 }}>
              Every field below is retrieved server-side from the Hyperswitch Payments API — the same record you see in the
              Hyperswitch dashboard, not a value we stored. Card PAN and CVV never reach us; only the network and last four,
              which the processor returns for the receipt.
            </p>
          </div>
          {p.dashboardUrl && (
            <a
              href={p.dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono"
              title="Opens the Hyperswitch Payments list. Search the payment id above to open this exact payment."
              style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 600, color: blue, border: `1px solid ${blue}`, borderRadius: 10, padding: "9px 16px", whiteSpace: "nowrap" }}
            >
              Open Hyperswitch dashboard
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 17 17 7M9 7h8v8" stroke={blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          <Card title="LEDGER" badge={cur}>
            <Field label="Amount" value={`${formatUsd(p.amountCents)} ${cur}`} accent />
            <Field label="Amount received" value={p.amountReceivedCents != null ? `${formatUsd(p.amountReceivedCents)} ${cur}` : "n/a"} />
            <Field label="Net amount" value={p.netAmountCents != null ? `${formatUsd(p.netAmountCents)} ${cur}` : "n/a"} />
            <Field label="Status" value={p.status} accent />
            <Field label="Plan" value={p.plan?.name ?? "n/a"} mono={false} />
            <Field label="Error message" value={p.errorMessage || "N/A"} />
          </Card>

          <Card title="PAYMENT" badge={p.connector ?? ""}>
            <Field label="Payment ID" value={p.paymentId} />
            <Field label="Connector txn ID" value={p.connectorTxnId ?? "n/a"} />
            <Field label="Connector" value={p.connector ?? "n/a"} />
            <Field label="Merchant connector" value={p.merchantConnectorId ?? "n/a"} />
            <Field label="Auth type" value={p.authenticationType ?? "n/a"} />
            <Field label="Capture method" value={p.captureMethod ?? "n/a"} />
            <Field label="Created" value={fmtTime(p.created)} />
            <Field label="Last updated" value={fmtTime(p.updated ?? p.created)} />
          </Card>

          <Card title="PAYMENT METHOD">
            <Field label="Method" value={p.paymentMethod ?? "n/a"} />
            <Field label="Type" value={p.paymentMethodType ?? "n/a"} />
            <Field label="Card" value={cardLine} accent />
            <Field label="Card type" value={card?.card_type ?? "n/a"} />
            <Field label="Issuer" value={issuerLine} />
            <Field label="Expiry" value={expLine} />
          </Card>
        </div>

        <div className="font-mono" style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: "6px 20px", fontSize: 10.5, color: "var(--faint)" }}>
          {p.merchantId && <span>merchant: {p.merchantId}</span>}
          {p.profileId && <span>profile: {p.profileId}</span>}
          {p.customerId && <span>customer: {p.customerId}</span>}
          {p.attemptCount != null && <span>attempts: {p.attemptCount}</span>}
        </div>
      </div>
    </section>
  );
}
