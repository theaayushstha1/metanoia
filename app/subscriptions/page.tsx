import Link from "next/link";
import { getSubscriptions, getSavedPaymentMethod } from "@/lib/store";
import { getPlan, formatUsd } from "@/lib/catalog";
import { getSessionCustomerId } from "@/lib/session";
import { getSessionIntentMandate } from "@/lib/mandate-session";
import { TopBar, Icon, usd } from "../components/ui";
import CancelButton from "./CancelButton";

export const dynamic = "force-dynamic";

const disp = "var(--font-bricolage), sans-serif";

export default async function SubscriptionsPage() {
  const customerId = await getSessionCustomerId();
  const subs = await getSubscriptions(customerId);
  const policy = (await getSessionIntentMandate()).policy;
  const committed = subs.reduce((s, x) => s + x.amount_cents, 0);
  const remaining = policy.monthly_cap_cents - committed;

  const rows = await Promise.all(
    subs.map(async (s) => {
      const plan = getPlan(s.plan_id);
      const savedPm = await getSavedPaymentMethod(customerId, s.plan_id);
      return { s, plan, recurring: Boolean(savedPm) };
    })
  );

  return (
    <main style={{ minHeight: "100vh", background: "#fff" }}>
      <TopBar
        tag="SUBSCRIPTIONS"
        right={
          <Link href="/" className="font-mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", color: "var(--blue)", textDecoration: "none" }}>
            Back to workbench
          </Link>
        }
      />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 28px 80px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div className="font-mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".16em", color: "var(--blue)" }}>
              YOUR AGENT&rsquo;S SUBSCRIPTIONS
            </div>
            <h1 style={{ margin: "12px 0 0", fontFamily: disp, fontWeight: 800, fontSize: 34, letterSpacing: "-.02em" }}>
              {subs.length} active {subs.length === 1 ? "subscription" : "subscriptions"}
            </h1>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="font-mono" style={{ fontSize: 10.5, letterSpacing: ".1em", color: "var(--faint)" }}>MONTHLY COMMITTED</div>
            <div style={{ fontFamily: disp, fontWeight: 800, fontSize: 24 }}>
              {formatUsd(committed)} <span style={{ fontSize: 13, color: "var(--faint)", fontWeight: 600 }}>/ {formatUsd(policy.monthly_cap_cents)} cap</span>
            </div>
            <div className="font-mono" style={{ fontSize: 10.5, letterSpacing: ".06em", color: remaining < 0 ? "var(--red)" : "var(--green)", marginTop: 3 }}>
              {usd(remaining)} LEFT
            </div>
          </div>
        </div>

        <div style={{ marginTop: 34, display: "grid", gap: 14 }}>
          {rows.length === 0 && (
            <div style={{ border: "1px solid var(--line)", borderRadius: 14, padding: "40px 28px", textAlign: "center" }}>
              <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 18 }}>No active subscriptions</div>
              <p className="font-mono" style={{ margin: "8px 0 20px", fontSize: 12, color: "var(--muted)" }}>
                Nothing is being billed. Send the agent to shop for a capability.
              </p>
              <Link href="/" className="font-body" style={{ display: "inline-block", fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--blue)", borderRadius: 10, padding: "11px 22px", textDecoration: "none" }}>
                Open the workbench
              </Link>
            </div>
          )}

          {rows.map(({ s, plan, recurring }) => (
            <div
              key={s.plan_id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: "18px 22px",
                background: "#fff",
              }}
            >
              <span className="font-mono" style={{ width: 44, height: 44, flex: "none", display: "grid", placeItems: "center", background: "linear-gradient(135deg,#4d8cff,#1e54d0)", borderRadius: 11, fontSize: 13, fontWeight: 700, color: "#fff" }}>
                {(s.merchant_name ?? "??").slice(0, 2).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="font-body" style={{ fontSize: 15, fontWeight: 700 }}>
                  {plan?.name ?? s.plan_id}
                </div>
                <div className="font-mono" style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 3 }}>
                  {s.merchant_name} · {s.category.toUpperCase()}
                </div>
              </div>
              <span className="font-mono" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 9.5, fontWeight: 600, letterSpacing: ".06em", color: recurring ? "var(--green)" : "var(--muted)", background: recurring ? "var(--green-bg)" : "var(--panel)", border: "1px solid var(--line)", borderRadius: 99, padding: "5px 10px" }}>
                <Icon.bolt size={11} color={recurring ? "var(--green)" : "var(--faint)"} />
                {recurring ? "RENEWAL READY" : "MANUAL RENEW"}
              </span>
              <div style={{ textAlign: "right", minWidth: 92 }}>
                <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 17 }}>{formatUsd(s.amount_cents)}</div>
                <div className="font-mono" style={{ fontSize: 9.5, color: "var(--faint)" }}>/ MONTH</div>
              </div>
              <CancelButton planId={s.plan_id} />
            </div>
          ))}
        </div>

        {rows.length > 0 && (
          <p className="font-mono" style={{ marginTop: 22, fontSize: 10.5, lineHeight: 1.6, color: "var(--faint)" }}>
            Cancelling frees the monthly budget and revokes the capability credential immediately. For a live
            off-session mandate this also calls Hyperswitch <span style={{ color: "var(--muted)" }}>POST /mandates/revoke</span>, wired once the Stripe MIT path is on.
          </p>
        )}
      </div>
    </main>
  );
}
