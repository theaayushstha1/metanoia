"use client";

import { useState } from "react";
import { Icon } from "../../components/ui";

const blue = "var(--blue)";

interface RenewResult {
  paymentId?: string;
  status?: string;
  connector?: string;
  error?: string;
  refused?: boolean;
  verdict?: { summary?: string };
}

/**
 * Demonstrates the off-session MIT: the agent renews the subscription next cycle
 * with no card entry and no human. Only shown when a saved payment method exists
 * (a mandate-capable connector like Stripe returned a payment_method_id).
 */
export default function RenewPanel({ planId, canRenew }: { planId: string; canRenew: boolean }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [res, setRes] = useState<RenewResult>({});

  async function renew() {
    setState("loading");
    try {
      const r = await fetch("/api/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await r.json();
      if (!r.ok) {
        setRes({
          error: data.refused ? data.verdict?.summary ?? "Refused by the mandate." : data.error ?? "Renewal failed.",
          refused: data.refused,
        });
        setState("error");
      } else {
        setRes(data);
        setState(data.status === "succeeded" ? "done" : "error");
        if (data.status !== "succeeded") setRes({ error: `Renewal status: ${data.status}` });
      }
    } catch (e) {
      setRes({ error: String(e) });
      setState("error");
    }
  }

  const shell = (children: React.ReactNode, tone: "blue" | "muted" | "red" = "blue") => (
    <div
      className="mn-capability-probe"
      style={{
        marginTop: 20,
        border: `1px solid ${tone === "red" ? "var(--red-2)" : tone === "muted" ? "var(--line)" : "var(--accent-line)"}`,
        borderRadius: 12,
        background: tone === "red" ? "var(--red-bg)" : tone === "muted" ? "var(--panel)" : "linear-gradient(180deg,#f4f8ff,#fff)",
        padding: "20px 22px",
        animation: "rise .5s both",
      }}
    >
      {children}
    </div>
  );

  if (!canRenew) {
    return shell(
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Icon.card size={14} color="var(--faint)" />
          <span className="font-mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".14em", color: "var(--muted)" }}>
            RECURRING
          </span>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "var(--muted)" }}>
          Off-session renewal needs a saved card. This charge settled on a connector that
          didn&apos;t return a reusable payment method. Pay through the Stripe path to enable MIT.
        </p>
      </>,
      "muted"
    );
  }

  if (state === "done") {
    return shell(
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--green-bg)", display: "grid", placeItems: "center" }}>
            <Icon.check size={11} color="var(--green)" sw={3} />
          </span>
          <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".14em", color: "var(--green)" }}>
            RENEWED OFF-SESSION
          </span>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 13.5, lineHeight: 1.5 }}>
          The agent charged the next cycle with <b>no card entry and no human</b>.
        </p>
        <div className="font-mono" style={{ marginTop: 12, display: "grid", gap: 6, fontSize: 11, color: "var(--muted)" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>MIT PAYMENT</span>
            <span style={{ color: blue, fontWeight: 600 }}>{res.paymentId}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>CONNECTOR</span>
            <span style={{ fontWeight: 600, color: "var(--ink)" }}>{res.connector ?? "stripe"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>STATUS</span>
            <span style={{ fontWeight: 700, color: "var(--green)" }}>{res.status}</span>
          </div>
        </div>
      </>
    );
  }

  return shell(
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <Icon.sparkle size={14} />
        <span className="font-mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".14em" }}>
          SIMULATE NEXT BILLING CYCLE
        </span>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "var(--muted)" }}>
        The agent renews this subscription off-session, re-checking your mandate before it
        charges the saved card. No human in the loop.
      </p>
      {state === "error" && (
        <p className="font-mono" style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--red)" }}>
          {res.error}
        </p>
      )}
      <button
        onClick={renew}
        disabled={state === "loading"}
        className="font-body"
        style={{
          marginTop: 14,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          fontWeight: 600,
          color: "#fff",
          background: "linear-gradient(180deg,#3d7bff,#2b6bf3)",
          border: "none",
          borderRadius: 10,
          padding: "11px 22px",
          boxShadow: "0 8px 22px rgba(43,107,243,.35)",
          cursor: state === "loading" ? "default" : "pointer",
          opacity: state === "loading" ? 0.6 : 1,
        }}
      >
        <Icon.bolt size={13} color="#fff" />
        {state === "loading" ? "Charging off-session…" : "Renew now (off-session MIT)"}
      </button>
    </>
  );
}
