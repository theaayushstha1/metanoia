"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "./components/ui";

const blue = "var(--blue)";

interface Fact {
  id: string;
  kind: string;
  value: string;
  source: string;
}
interface Event {
  id: string;
  capability: string;
  planId: string;
  action: string;
  reason?: string;
  amountCents?: number;
}
interface Profile {
  hasHistory: boolean;
  priorityLean: string;
  typicalBudgetCents?: number;
  preferredVendors: string[];
  avoidedVendors: string[];
}
interface Snapshot {
  consent: boolean;
  facts: Fact[];
  events: Event[];
}

export default function MemoryPanel() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [blurb, setBlurb] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/memory", { cache: "no-store" });
    const data = await r.json();
    setSnap(data.snapshot);
    setProfile(data.profile);
    if (data.profile?.hasHistory) {
      fetch("/api/memory/blurb", { cache: "no-store" })
        .then((x) => x.json())
        .then((x) => setBlurb(x.blurb ?? ""))
        .catch(() => {});
    } else {
      setBlurb("");
    }
  }, []);

  useEffect(() => {
    // Mount fetch: state is set only after the awaited response, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function setConsent(granted: boolean) {
    setBusy(true);
    await fetch("/api/memory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ granted }),
    });
    await refresh();
    setBusy(false);
  }

  async function del(id: string) {
    await fetch(`/api/memory/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function forgetAll() {
    setBusy(true);
    await fetch("/api/memory", { method: "DELETE" });
    await refresh();
    setBusy(false);
  }

  if (!snap) return null;
  const on = snap.consent;

  return (
    <div className="mn-page-pad" style={{ padding: "6px 64px 0" }}>
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          border: `1px solid ${on ? "var(--accent-line)" : "var(--line)"}`,
          borderRadius: 14,
          background: on ? "linear-gradient(180deg,#f6f9ff,#fff)" : "var(--panel)",
          padding: "18px 22px",
        }}
      >
        {/* header + toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon.sparkle size={15} />
            <div>
              <div className="font-mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".14em" }}>
                PREFERENCE MEMORY
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                {on
                  ? "Metanoia personalizes each run from what you pick and pass on."
                  : "Off. Turn on to let Metanoia learn your taste over time."}
              </div>
            </div>
          </div>
          <Toggle on={on} disabled={busy} onClick={() => setConsent(!on)} />
        </div>

        {on && (
          <>
            {profile?.hasHistory ? (
              <div style={{ marginTop: 16 }}>
                {blurb && (
                  <p style={{ margin: "0 0 12px", fontSize: 13.5, fontStyle: "italic", color: "var(--ink-2)" }}>
                    &ldquo;{blurb}&rdquo;
                  </p>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                  <Chip label={`leans ${profile.priorityLean}`} strong />
                  {profile.typicalBudgetCents ? (
                    <Chip label={`~$${(profile.typicalBudgetCents / 100).toFixed(0)}/mo typical`} />
                  ) : null}
                  {profile.preferredVendors.map((v) => (
                    <Chip key={v} label={`✓ ${v}`} tone="green" />
                  ))}
                  {profile.avoidedVendors.map((v) => (
                    <Chip key={v} label={`✕ ${v}`} tone="muted" />
                  ))}
                </div>

                <Remembered snap={snap} onDelete={del} />

                <button
                  onClick={forgetAll}
                  disabled={busy}
                  className="font-mono"
                  style={{
                    marginTop: 14,
                    fontSize: 10.5,
                    fontWeight: 600,
                    letterSpacing: ".08em",
                    color: "var(--red)",
                    background: "transparent",
                    border: "1px solid var(--red-2)",
                    borderRadius: 8,
                    padding: "7px 13px",
                    cursor: "pointer",
                  }}
                >
                  FORGET EVERYTHING
                </button>
              </div>
            ) : (
              <p style={{ margin: "14px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
                Nothing remembered yet. As you choose and decline tools, Metanoia builds a private preference
                profile, stored as plain facts you can delete anytime. No raw social data, no tokens.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Remembered({ snap, onDelete }: { snap: Snapshot; onDelete: (id: string) => void }) {
  const rows = [
    ...snap.facts.map((f) => ({ id: f.id, label: `${f.kind}: ${f.value}`, tag: f.source })),
    ...snap.events.map((e) => ({
      id: e.id,
      label: `${e.action} · ${e.planId}${e.reason ? ` — ${e.reason}` : ""}`,
      tag: e.capability,
    })),
  ];
  if (!rows.length) return null;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {rows.map((r) => (
        <div
          key={r.id}
          className="font-mono"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 11,
            background: "#fff",
            border: "1px solid var(--line-3)",
            borderRadius: 8,
            padding: "8px 12px",
          }}
        >
          <span style={{ color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.label}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
            <span style={{ color: "var(--faint)", fontSize: 9.5, letterSpacing: ".08em" }}>{r.tag.toUpperCase()}</span>
            <button
              onClick={() => onDelete(r.id)}
              aria-label="Delete"
              style={{
                width: 18,
                height: 18,
                display: "grid",
                placeItems: "center",
                borderRadius: 5,
                border: "1px solid var(--line-3)",
                background: "transparent",
                color: "var(--faint)",
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

function Chip({ label, strong, tone }: { label: string; strong?: boolean; tone?: "green" | "muted" }) {
  const color = tone === "green" ? "var(--green)" : tone === "muted" ? "var(--muted)" : blue;
  return (
    <span
      className="font-mono"
      style={{
        fontSize: 10.5,
        fontWeight: strong ? 700 : 600,
        letterSpacing: ".04em",
        color,
        background: tone === "muted" ? "var(--panel)" : "#fff",
        border: `1px solid ${tone === "green" ? "var(--green-bg)" : tone === "muted" ? "var(--line-3)" : "var(--accent-line)"}`,
        borderRadius: 99,
        padding: "5px 11px",
      }}
    >
      {label}
    </span>
  );
}

function Toggle({ on, disabled, onClick }: { on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      style={{
        width: 46,
        height: 26,
        flex: "none",
        borderRadius: 99,
        border: "none",
        background: on ? "linear-gradient(180deg,#3d7bff,#2b6bf3)" : "var(--line-2)",
        position: "relative",
        cursor: disabled ? "default" : "pointer",
        transition: "background .2s",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: on ? 23 : 3,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,.25)",
          transition: "left .2s",
        }}
      />
    </button>
  );
}
