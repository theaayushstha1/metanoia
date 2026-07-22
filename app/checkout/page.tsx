import CheckoutClient from "./CheckoutClient";
import { getPlan, formatUsd } from "@/lib/catalog";
import { TopBar, Pill, Icon, usd } from "../components/ui";

const blue = "var(--blue)";
const disp = "var(--font-bricolage), sans-serif";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan: planId = "tickstream_pro" } = await searchParams;
  const plan = getPlan(planId);

  const feats = plan
    ? ([
        plan.features.includes("realtime_us_equities") ? "REALTIME EQUITIES" : null,
        plan.features.includes("websockets") ? "WEBSOCKET STREAMS" : null,
        `${plan.maxRps ?? 0} REQ/S · ${plan.uptimePct ?? 99.9}% UPTIME`,
      ].filter(Boolean) as string[])
    : [];

  return (
    <main style={{ minHeight: "100vh" }}>
      <div style={{ minHeight: "100vh", background: "#fff" }}>
        <TopBar
          tag="CHECKOUT"
          right={
            <Pill>
              <Icon.lock size={11} color="var(--green)" /> SECURED BY HYPERSWITCH
            </Pill>
          }
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 460px", minHeight: 560 }}>
          {/* order summary */}
          <div
            style={{
              background: "linear-gradient(160deg,#eef4ff,#f9fbff)",
              borderRight: "1px solid var(--line-2)",
              padding: "56px 60px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", right: -60, top: -60, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle,rgba(77,140,255,.16),transparent 70%)" }} />
            <div className="font-mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".16em", color: blue }}>
              ORDER
            </div>
            <div
              style={{
                marginTop: 18,
                border: "1px solid var(--line)",
                borderRadius: 14,
                background: "#fff",
                boxShadow: "0 12px 32px rgba(20,40,90,.08)",
                padding: "24px 26px",
                maxWidth: 420,
                animation: "drift 5s ease-in-out infinite",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                <span className="font-mono" style={{ width: 42, height: 42, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#4d8cff,#1e54d0)", borderRadius: 10, fontSize: 12, fontWeight: 700, color: "#fff" }}>
                  {(plan?.vendor ?? "TS").slice(0, 2).toUpperCase()}
                </span>
                <span>
                  <span className="font-body" style={{ display: "block", fontSize: 17, fontWeight: 700 }}>
                    {plan?.name ?? "Subscription"}
                  </span>
                  <span className="font-mono" style={{ fontSize: 10.5, color: "var(--faint)" }}>
                    {(plan?.category ?? "").toUpperCase()} · MONTHLY
                  </span>
                </span>
                <span className="font-mono" style={{ marginLeft: "auto", fontSize: 20, fontWeight: 700 }}>
                  {formatUsd(plan?.priceCents ?? 0)}
                </span>
              </div>
              <div className="font-mono" style={{ display: "grid", gap: 9, marginTop: 20, paddingTop: 18, borderTop: "1px dashed var(--line)", fontSize: 11, color: "var(--muted)" }}>
                {feats.map((f) => (
                  <div key={f} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{f}</span>
                    <Icon.check size={12} color="var(--green)" sw={2.5} />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 26, maxWidth: 420, background: "#fff", border: "1px solid var(--line)", borderRadius: 10, padding: "13px 16px" }}>
              <Icon.shieldCheck size={15} />
              <span className="font-mono" style={{ fontSize: 11, letterSpacing: ".06em", color: "var(--muted)" }}>
                MANDATE RE-CHECKED BEFORE CHARGE
              </span>
              <span className="font-mono" style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: "var(--green)" }}>
                PASS
              </span>
            </div>
            <div className="font-mono" style={{ marginTop: 26, fontSize: 10.5, letterSpacing: ".06em", color: "var(--faint)" }}>
              BILLED MONTHLY · CANCEL ANYTIME · SANDBOX MODE
            </div>
          </div>

          {/* payment — the real Hyperswitch SDK */}
          <div style={{ padding: "56px 52px" }}>
            <div style={{ fontFamily: disp, fontWeight: 800, fontSize: 26, letterSpacing: "-.01em" }}>Pay with card</div>
            <p className="font-mono" style={{ margin: "8px 0 20px", fontSize: 10.5, letterSpacing: ".06em", color: "var(--faint)" }}>
              TEST CARD 4242 4242 4242 4242 · ANY FUTURE EXPIRY · ANY CVC
            </p>
            <CheckoutClient planId={planId} amountLabel={usd(plan?.priceCents)} />
            <div className="font-mono" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 16, fontSize: 10, letterSpacing: ".08em", color: "var(--faint)" }}>
              PCI DSS · TOKENIZED · JUSPAY HYPERSWITCH
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
