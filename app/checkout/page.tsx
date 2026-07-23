import CheckoutClient from "./CheckoutClient";
import { getPlan, formatUsd } from "@/lib/catalog";
import { TopBar, Pill, Icon, usd } from "../components/ui";

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
      <div style={{ minHeight: "100vh", background: "#fff", display: "flex", flexDirection: "column" }}>
        <TopBar
          tag="CHECKOUT"
          right={
            <Pill>
              <Icon.lock size={11} color="var(--green)" /> SECURED BY HYPERSWITCH
            </Pill>
          }
        />
        <div className="mn-checkout-grid" style={{ display: "grid", gridTemplateColumns: "minmax(420px, 42%) 1fr", minHeight: "calc(100vh - 58px)" }}>
          {/* LEFT — order, a full-height brand panel */}
          <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(160deg,#3d7bff 0%,#2b6bf3 46%,#1a3fa0 100%)", color: "#fff", padding: "48px 54px", display: "flex", flexDirection: "column", justifyContent: "center", animation: "rise .6s .05s both" }}>
            <div style={{ position: "absolute", top: -90, right: -90, width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,255,.16),transparent 70%)" }} />
            <div style={{ position: "relative", width: "100%", maxWidth: 440, margin: "0 auto" }}>
              <div className="font-mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".16em", color: "rgba(255,255,255,.72)" }}>
                YOUR ORDER
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginTop: 22 }}>
                <span className="font-mono" style={{ width: 46, height: 46, flex: "none", display: "grid", placeItems: "center", background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.32)", borderRadius: 12, fontSize: 13, fontWeight: 700, color: "#fff" }}>
                  {(plan?.vendor ?? "TS").slice(0, 2).toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: disp, fontWeight: 800, fontSize: 24, lineHeight: 1.1 }}>{plan?.name ?? "Subscription"}</div>
                  <div className="font-mono" style={{ fontSize: 10.5, color: "rgba(255,255,255,.68)", marginTop: 4 }}>{(plan?.category ?? "").toUpperCase()} · MONTHLY</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: disp, fontWeight: 800, fontSize: 26 }}>{formatUsd(plan?.priceCents ?? 0)}</div>
                  <div className="font-mono" style={{ fontSize: 9.5, color: "rgba(255,255,255,.6)", letterSpacing: ".06em" }}>PER MONTH</div>
                </div>
              </div>
              <div className="font-mono" style={{ display: "grid", gap: 12, marginTop: 26, paddingTop: 22, borderTop: "1px solid rgba(255,255,255,.18)", fontSize: 11.5, color: "rgba(255,255,255,.9)" }}>
                {feats.map((f) => (
                  <div key={f} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{f}</span>
                    <Icon.check size={13} color="#9ef7c8" sw={2.8} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 26, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)", borderRadius: 10, padding: "13px 16px" }}>
                <Icon.shieldCheck size={15} color="#fff" />
                <span className="font-mono" style={{ fontSize: 11, letterSpacing: ".05em", color: "rgba(255,255,255,.92)" }}>MANDATE RE-CHECKED BEFORE CHARGE</span>
                <span className="font-mono" style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: "#9ef7c8" }}>PASS</span>
              </div>
              <div className="font-mono" style={{ marginTop: 22, fontSize: 10.5, letterSpacing: ".06em", color: "rgba(255,255,255,.6)" }}>
                BILLED MONTHLY · CANCEL ANYTIME · SANDBOX MODE
              </div>
            </div>
          </div>

          {/* RIGHT — the real Hyperswitch SDK */}
          <div className="mn-checkout-payment" style={{ position: "relative", overflow: "hidden", background: "#fff", padding: "48px 56px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(600px 300px at 70% 0,rgba(77,140,255,.06),transparent)" }} />
            <div style={{ position: "relative", width: "100%", maxWidth: 440, margin: "0 auto" }}>
              <div style={{ fontFamily: disp, fontWeight: 800, fontSize: 30, letterSpacing: "-.01em" }}>Pay with card</div>
              <p className="font-mono" style={{ margin: "10px 0 24px", fontSize: 10.5, letterSpacing: ".06em", color: "var(--faint)" }}>
                TEST CARD 4242 4242 4242 4242 · ANY FUTURE EXPIRY · ANY CVC
              </p>
              <CheckoutClient planId={planId} amountLabel={usd(plan?.priceCents)} />
              <div className="font-mono" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 20, fontSize: 10, letterSpacing: ".08em", color: "var(--faint)" }}>
                PCI DSS · TOKENIZED · JUSPAY HYPERSWITCH
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
