"use client";

import { useEffect, useState } from "react";

/**
 * The receipt's right panel: an in-depth trace of how the payment cleared, in order.
 * Every static step is real data from the settled payment; the final row makes a live
 * authenticated call to the capability endpoint to prove the issued credential works.
 */
export type TraceStep = {
  label: string;
  detail: string;
  tone: "done" | "info";
};

export default function PaymentTrace({
  steps,
  resource,
  credential,
}: {
  steps: TraceStep[];
  resource: string;
  credential?: string;
}) {
  const [probe, setProbe] = useState<"loading" | "ok" | "error">(credential ? "loading" : "error");
  const [code, setCode] = useState<number>();

  useEffect(() => {
    if (!credential) return;
    const c = new AbortController();
    fetch(resource, { headers: { "x-api-key": credential }, cache: "no-store", signal: c.signal })
      .then((r) => {
        setCode(r.status);
        setProbe(r.ok ? "ok" : "error");
      })
      .catch(() => {
        if (!c.signal.aborted) setProbe("error");
      });
    return () => c.abort();
  }, [resource, credential]);

  const liveDetail =
    probe === "loading"
      ? `calling ${resource}`
      : probe === "ok"
        ? `${code} SANDBOX LIVE · ${resource}`
        : `${code ?? "no credential"} · authentication failed`;

  const total = steps.length + 1;

  return (
    <div className="mn-live" style={{ marginTop: 26 }}>
      {steps.map((s, i) => (
        <Row
          key={s.label}
          index={i}
          last={false}
          label={s.label}
          detail={s.detail}
          dot={s.tone === "info" ? "info" : "done"}
        />
      ))}
      <Row
        index={steps.length}
        last
        label="Capability endpoint authenticated"
        detail={liveDetail}
        dot={probe === "ok" ? "done" : probe === "error" ? "error" : "live"}
      />
      <span className="font-mono" style={{ display: "block", marginTop: 4, marginLeft: 38, fontSize: 9.5, letterSpacing: ".08em", color: "var(--faint)" }}>
        {total} STEPS · JUSPAY HYPERSWITCH SANDBOX
      </span>
    </div>
  );
}

function Row({
  index,
  last,
  label,
  detail,
  dot,
}: {
  index: number;
  last: boolean;
  label: string;
  detail: string;
  dot: "done" | "info" | "error" | "live";
}) {
  const color = dot === "error" ? "var(--red)" : dot === "info" ? "#b8862b" : dot === "live" ? "var(--blue)" : "var(--green)";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "24px 1fr",
        gap: 14,
        paddingBottom: last ? 0 : 20,
        animation: `rise .5s ${0.15 + index * 0.09}s both`,
      }}
    >
      <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
        {!last && (
          <span style={{ position: "absolute", top: 22, bottom: -20, left: "calc(50% - 1px)", width: 2, background: "var(--line)" }} />
        )}
        <span
          style={{
            position: "relative",
            width: 22,
            height: 22,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            flex: "none",
            background: dot === "done" ? "var(--green)" : "#fff",
            border: dot === "done" ? "none" : `2px solid ${color}`,
            boxShadow: dot === "live" ? "0 0 0 4px rgba(43,107,243,.14)" : "none",
            animation: dot === "live" ? "pulse 1.4s ease-in-out infinite" : undefined,
          }}
        >
          {dot === "done" ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : dot === "error" ? (
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
          ) : dot === "info" ? (
            <span style={{ width: 7, height: 2, background: color }} />
          ) : (
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
          )}
        </span>
      </div>
      <div style={{ paddingTop: 1 }}>
        <div className="font-body" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", lineHeight: 1.2 }}>
          {label}
        </div>
        <div className="font-mono" style={{ marginTop: 4, fontSize: 11, color: "var(--muted)", wordBreak: "break-word" }}>
          {detail}
        </div>
      </div>
    </div>
  );
}
