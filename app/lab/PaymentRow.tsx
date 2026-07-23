"use client";

import { useState } from "react";

interface Refund {
  refundId: string;
  status: string;
  amountLabel: string;
}
interface Live {
  status: string;
  connector: string;
  error_code: string | null;
  error_message: string | null;
  next_action: string | null;
}

type Tone = "good" | "bad" | "info" | "muted";
const toneColor = (t: Tone) =>
  t === "good" ? "var(--green)" : t === "bad" ? "var(--red)" : t === "info" ? "var(--blue)" : "var(--faint)";

export default function PaymentRow({
  paymentId,
  planName,
  storedStatus,
  amountLabel,
  refund: initialRefund,
}: {
  paymentId: string;
  planName: string;
  storedStatus: string;
  amountLabel: string;
  refund: Refund | null;
}) {
  const [live, setLive] = useState<Live | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshErr, setRefreshErr] = useState("");
  const [refund, setRefund] = useState<Refund | null>(initialRefund);
  const [rStage, setRStage] = useState<"idle" | "confirm" | "loading" | "error">("idle");
  const [rErr, setRErr] = useState("");

  const status = live?.status ?? storedStatus;
  const connector = live?.connector ?? "unknown";
  const isOk = status === "succeeded";
  const isFail = status === "failed" || status === "cancelled";
  const is3ds = status === "requires_customer_action";
  const badge = isOk ? "var(--green)" : isFail ? "var(--red)" : "var(--blue)";

  async function refresh() {
    setRefreshing(true);
    setRefreshErr("");
    try {
      const r = await fetch("/api/lab/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });
      const d = await r.json();
      if (!r.ok) {
        setRefreshErr(d.detail ? `unavailable · ${d.detail}` : d.error ?? "unavailable");
      } else {
        setLive(d as Live);
      }
    } catch (e) {
      setRefreshErr(`unavailable · ${String(e)}`);
    } finally {
      setRefreshing(false);
    }
  }

  async function doRefund() {
    setRStage("loading");
    setRErr("");
    try {
      const r = await fetch("/api/lab/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, confirm: true }),
      });
      const d = await r.json();
      if (!r.ok) {
        setRErr(d.error ?? "Refund failed");
        setRStage("error");
      } else {
        setRefund({ refundId: d.refund_id, status: d.status, amountLabel });
        setRStage("idle");
      }
    } catch (e) {
      setRErr(String(e));
      setRStage("error");
    }
  }

  const steps: { label: string; detail: string; tone: Tone }[] = [
    { label: "Payment intent created", detail: `${paymentId} · ${amountLabel}`, tone: "good" },
    { label: "Routed to connector", detail: connector, tone: connector === "unknown" ? "muted" : "good" },
  ];
  if (isOk) steps.push({ label: "Authorized and captured", detail: "status succeeded", tone: "good" });
  else if (isFail)
    steps.push({
      label: "Declined by connector",
      detail: live ? `${live.error_code ?? ""} ${live.error_message ?? ""}`.trim() || "status failed" : "status failed",
      tone: "bad",
    });
  else if (is3ds) steps.push({ label: "3DS required", detail: `requires_customer_action · ${live?.next_action ?? "redirect"}`, tone: "info" });
  else steps.push({ label: "Awaiting outcome", detail: live ? `status ${status}` : `status ${status} · refresh for live`, tone: "muted" });
  if (refund) steps.push({ label: "Refunded", detail: `${refund.status} · ${refund.refundId}`, tone: refund.status === "succeeded" ? "good" : "info" });

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span className="font-mono" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em", color: badge, background: isOk ? "var(--green-bg)" : isFail ? "var(--red-bg)" : "var(--panel)", border: `1px solid ${badge}33`, borderRadius: 99, padding: "4px 10px" }}>
          {status.toUpperCase()}
        </span>
        <span className="font-body" style={{ fontSize: 14, fontWeight: 700 }}>{planName}</span>
        <span className="font-mono" style={{ fontSize: 10.5, color: connector === "unknown" ? "var(--faint)" : "var(--muted)" }}>{connector}</span>

        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 10 }}>
          <button onClick={refresh} disabled={refreshing} className="font-mono" style={btn}>
            {refreshing ? "Refreshing…" : "Refresh status"}
          </button>
          {refund ? (
            <span className="font-mono" style={{ fontSize: 10.5, fontWeight: 700, color: refund.status === "succeeded" ? "var(--green)" : "var(--blue)" }}>
              REFUND {refund.status.toUpperCase()}
            </span>
          ) : rStage === "confirm" ? (
            <>
              <button onClick={doRefund} className="font-mono" style={{ ...btn, color: "#fff", background: "var(--red)", border: "1px solid var(--red)" }}>Confirm refund</button>
              <button onClick={() => setRStage("idle")} className="font-mono" style={btn}>Keep</button>
            </>
          ) : (
            isOk && (
              <button onClick={() => setRStage("confirm")} disabled={rStage === "loading"} className="font-mono" style={{ ...btn, color: "var(--red)", borderColor: "var(--red-2)" }}>
                {rStage === "loading" ? "Refunding…" : "Refund"}
              </button>
            )
          )}
        </span>
      </div>

      <div className="font-mono" style={{ marginTop: 14, display: "grid", gap: 9 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", flex: "none", background: toneColor(s.tone), transform: "translateY(-1px)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", minWidth: 190 }}>{s.label}</span>
            <span style={{ fontSize: 11, color: "var(--muted)", wordBreak: "break-word" }}>{s.detail}</span>
          </div>
        ))}
      </div>

      {(refreshErr || rErr) && (
        <div className="font-mono" style={{ marginTop: 10, fontSize: 10.5, color: "var(--red)" }}>
          {rErr || refreshErr}
        </div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: ".04em",
  color: "var(--blue)",
  background: "#fff",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "6px 12px",
  cursor: "pointer",
};
