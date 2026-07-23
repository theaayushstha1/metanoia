"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Cancels a subscription, then refreshes the list. */
export default function CancelButton({ planId }: { planId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "confirm" | "loading" | "error">("idle");
  const [err, setErr] = useState("");

  async function cancel() {
    setState("loading");
    try {
      const r = await fetch("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErr(data.error ?? "Could not cancel.");
        setState("error");
        return;
      }
      router.refresh();
    } catch (e) {
      setErr(String(e));
      setState("error");
    }
  }

  if (state === "confirm") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <button onClick={cancel} className="font-mono" style={btn("var(--red)", "#fff")}>
          Confirm cancel
        </button>
        <button onClick={() => setState("idle")} className="font-mono" style={btn("transparent", "var(--muted)", "var(--line)")}>
          Keep
        </button>
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {state === "error" && (
        <span className="font-mono" style={{ fontSize: 10.5, color: "var(--red)" }}>{err}</span>
      )}
      <button
        onClick={() => setState("confirm")}
        disabled={state === "loading"}
        className="font-mono"
        style={btn("transparent", "var(--red)", "var(--red-2)")}
      >
        {state === "loading" ? "Cancelling…" : "Cancel"}
      </button>
    </span>
  );
}

function btn(bg: string, color: string, border = "transparent"): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: ".04em",
    color,
    background: bg,
    border: `1px solid ${border === "transparent" && bg !== "transparent" ? bg : border}`,
    borderRadius: 8,
    padding: "7px 14px",
    cursor: "pointer",
  };
}
