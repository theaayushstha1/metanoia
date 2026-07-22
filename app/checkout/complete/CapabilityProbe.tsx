"use client";

import { useEffect, useState } from "react";

export default function CapabilityProbe({
  resource,
  credential,
}: {
  resource: string;
  credential?: string;
}) {
  type ProbeState =
    | { status: "loading" }
    | { status: "success"; code: number; body: unknown }
    | { status: "error"; code?: number; message: string };
  const [state, setState] = useState<ProbeState>(() =>
    credential
      ? { status: "loading" }
      : { status: "error", message: "No credential was issued for this payment." }
  );

  useEffect(() => {
    if (!credential) return;
    const controller = new AbortController();
    fetch(resource, {
      headers: { "x-api-key": credential },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as unknown;
        if (!response.ok) {
          setState({ status: "error", code: response.status, message: JSON.stringify(body) });
          return;
        }
        setState({ status: "success", code: response.status, body });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState({ status: "error", message: error instanceof Error ? error.message : "Provider call failed" });
        }
      });
    return () => controller.abort();
  }, [credential, resource]);

  const masked = credential ? `${credential.slice(0, 9)}...${credential.slice(-4)}` : "not issued";
  return (
    <div className="font-mono mn-capability-probe" style={{ marginTop: 24, border: "1px solid var(--line)", borderRadius: 12, background: "#0e1524", padding: "20px 24px", animation: "rise .6s .45s both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#e05252" }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f0b429" }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#18a04a" }} />
        <span style={{ fontSize: 10, color: "#7c8598", marginLeft: 8 }}>agent · authenticated provider call</span>
      </div>
      <div style={{ marginTop: 14, fontSize: 12, lineHeight: 1.65, overflowWrap: "anywhere" }}>
        <div style={{ color: "#7c8598" }}>&gt; GET {resource}</div>
        <div style={{ color: "#4d8cff" }}>x-api-key: {masked}</div>
        {state.status === "loading" && <div style={{ marginTop: 10, color: "#f0b429" }}>requesting unlocked capability...</div>}
        {state.status === "error" && (
          <div style={{ marginTop: 10, color: "#ff8080" }}>
            {state.code ? `${state.code} ` : ""}{state.message}
          </div>
        )}
        {state.status === "success" && (
          <>
            <div style={{ marginTop: 10, color: "#18a04a" }}>{state.code} OK · credential accepted</div>
            <pre style={{ margin: "8px 0 0", color: "#ece8e1", whiteSpace: "pre-wrap", font: "inherit" }}>
              {JSON.stringify(state.body, null, 2)}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}
