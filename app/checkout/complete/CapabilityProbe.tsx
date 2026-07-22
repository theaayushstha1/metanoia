"use client";

import { useEffect, useRef, useState } from "react";
import { Mark } from "../../components/ui";

/**
 * The "your agent is now equipped" moment. It makes a REAL authenticated call to the
 * provider the agent just bought (proving the credential works), then renders the
 * response as a live, animated demo tailored to the capability — not a JSON dump.
 */
type Data = Record<string, unknown>;
type State =
  | { status: "loading" }
  | { status: "ok"; data: Data }
  | { status: "error"; code?: number; msg: string };

export default function CapabilityProbe({
  resource,
  credential,
  capability,
}: {
  resource: string;
  credential?: string;
  capability?: string;
}) {
  const [state, setState] = useState<State>(
    credential ? { status: "loading" } : { status: "error", msg: "No credential was issued for this payment." }
  );

  useEffect(() => {
    if (!credential) return;
    const controller = new AbortController();
    fetch(resource, { headers: { "x-api-key": credential }, cache: "no-store", signal: controller.signal })
      .then(async (r) => {
        const body = (await r.json()) as { data?: Data; error?: string };
        if (!r.ok) setState({ status: "error", code: r.status, msg: body.error ?? "Provider call failed" });
        else setState({ status: "ok", data: body.data ?? (body as Data) });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setState({ status: "error", msg: e instanceof Error ? e.message : "failed" });
      });
    return () => controller.abort();
  }, [resource, credential]);

  return (
    <div
      className="mn-live"
      style={{
        marginTop: 24,
        borderRadius: 16,
        background: "linear-gradient(180deg,#0d1424,#0a0f1c)",
        border: "1px solid rgba(120,150,220,.18)",
        boxShadow: "0 20px 50px rgba(12,24,60,.28)",
        overflow: "hidden",
        animation: "rise .6s .35s both",
      }}
    >
      {/* arrival header: folding mark + ripple */}
      <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
        <span style={{ position: "relative", width: 34, height: 34, display: "grid", placeItems: "center", flex: "none" }}>
          <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid rgba(77,140,255,.5)", animation: "mnripple 1.8s ease-out .3s infinite" }} />
          <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid rgba(77,140,255,.5)", animation: "mnripple 1.8s ease-out 1.05s infinite" }} />
          <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#4d8cff,#1e54d0)", animation: "mnfold .7s .2s both" }}>
            <Mark size={20} color="#fff" sw={10} />
          </span>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="font-mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", color: "#4d8cff" }}>
            AUTHENTICATED SANDBOX PROVIDER
          </div>
          <div className="font-mono" style={{ fontSize: 10.5, color: "#7c8598", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            issued credential → protected endpoint · {resource}
          </div>
        </div>
        <LiveDot ok={state.status === "ok"} />
      </div>

      <div style={{ padding: "22px 24px 26px", minHeight: 128 }}>
        {state.status === "loading" && <Skeleton />}
        {state.status === "error" && (
          <div className="font-mono" style={{ fontSize: 12, color: "#ff8f8f" }}>
            {state.code ? `${state.code} · ` : ""}
            {state.msg}
          </div>
        )}
        {state.status === "ok" && <Capability capability={capability} data={state.data} />}
      </div>
    </div>
  );
}

/* ── router ─────────────────────────────────────────────────────────────── */
function Capability({ capability, data }: { capability?: string; data: Data }) {
  switch (capability) {
    case "transcription":
      return <Transcription data={data} />;
    case "market-data":
      return <MarketData data={data} />;
    case "news":
      return <News data={data} />;
    case "vector-search":
      return <VectorSearch data={data} />;
    case "geocoding":
      return <Geocoding data={data} />;
    case "compute":
      return <Compute data={data} />;
    default:
      return (
        <pre className="font-mono" style={{ margin: 0, color: "#ece8e1", fontSize: 12, whiteSpace: "pre-wrap" }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      );
  }
}

/* ── shared bits ────────────────────────────────────────────────────────── */
function LiveDot({ ok }: { ok: boolean }) {
  return (
    <span className="font-mono" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 9.5, letterSpacing: ".1em", color: ok ? "#39d98a" : "#7c8598" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: ok ? "#39d98a" : "#7c8598", boxShadow: ok ? "0 0 8px #39d98a" : "none", animation: "pulse 1.6s ease-in-out infinite" }} />
      {ok ? "200 · SANDBOX LIVE" : "…"}
    </span>
  );
}

function Skeleton() {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {[90, 70, 50].map((w, i) => (
        <span key={i} style={{ height: 12, width: `${w}%`, borderRadius: 6, background: "linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.12),rgba(255,255,255,.04))", backgroundSize: "220% 100%", animation: "shimmer 1.3s linear infinite" }} />
      ))}
    </div>
  );
}

function Chip({ children, tone = "blue" }: { children: React.ReactNode; tone?: "blue" | "green" }) {
  const c = tone === "green" ? "#39d98a" : "#4d8cff";
  return (
    <span className="font-mono" style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: ".08em", color: c, background: "rgba(77,140,255,.1)", border: `1px solid ${c}33`, borderRadius: 99, padding: "4px 9px" }}>
      {children}
    </span>
  );
}

/* typing effect (no synchronous setState in effect) */
function useTyping(text: string, speed = 26) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((x) => (x < text.length ? x + 1 : x)), speed);
    return () => clearInterval(id);
  }, [text.length, speed]);
  return text.slice(0, Math.min(n, text.length));
}

function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);
  return v;
}

/* ── transcription: waveform + text typing out ──────────────────────────── */
function Transcription({ data }: { data: Data }) {
  const text = String(data.text ?? "");
  const typed = useTyping(text);
  const typing = typed.length < text.length;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 2, height: 46, marginBottom: 16 }}>
        {Array.from({ length: 34 }).map((_, i) => (
          <span
            key={i}
            style={{
              width: 3,
              flex: "none",
              borderRadius: 2,
              background: "linear-gradient(180deg,#6ea8ff,#2b6bf3)",
              transformOrigin: "center",
              height: "100%",
              animation: typing ? `mnwave ${0.7 + (i % 5) * 0.12}s ease-in-out ${i * 0.04}s infinite` : "none",
              transform: typing ? undefined : "scaleY(0.22)",
              opacity: typing ? 1 : 0.5,
              transition: "transform .4s, opacity .4s",
            }}
          />
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: "#f4f2ec", fontWeight: 500 }}>
        &ldquo;{typed}
        {typing && <span style={{ display: "inline-block", width: 8, height: 18, marginLeft: 2, background: "#4d8cff", transform: "translateY(3px)", animation: "blink 1s steps(1) infinite" }} />}
        {!typing && "”"}
      </p>
      {!typing && (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Chip tone="green">{Math.round(Number(data.confidence ?? 0) * 100)}% confidence</Chip>
          <Chip>{String(data.words ?? "—")} words</Chip>
        </div>
      )}
    </div>
  );
}

/* ── market-data: ticker + sparkline ────────────────────────────────────── */
function MarketData({ data }: { data: Data }) {
  const price = useCountUp(Number(data.price ?? 0));
  const pts = [8, 14, 10, 18, 12, 22, 17, 26, 21, 30];
  const path = pts.map((p, i) => `${(i / (pts.length - 1)) * 260},${40 - p}`).join(" ");
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".1em", color: "#7c8598" }}>{String(data.symbol ?? "—")}</span>
        <span style={{ fontSize: 30, fontWeight: 800, color: "#f4f2ec", fontVariantNumeric: "tabular-nums" }}>${price.toFixed(2)}</span>
        <Chip tone="green">▲ live</Chip>
      </div>
      <svg width="100%" viewBox="0 0 260 44" preserveAspectRatio="none" style={{ height: 60, marginTop: 12 }}>
        <polyline points={path} fill="none" stroke="#4d8cff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 600, strokeDashoffset: 600, animation: "mndraw 1.2s ease-out .2s forwards" }} />
      </svg>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <Chip>bid {String(data.bid ?? "—")}</Chip>
        <Chip>ask {String(data.ask ?? "—")}</Chip>
      </div>
    </div>
  );
}

/* ── news: headlines stream in ──────────────────────────────────────────── */
function News({ data }: { data: Data }) {
  const headlines = Array.isArray(data.headlines) ? (data.headlines as string[]) : [];
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {headlines.map((h, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, animation: `rise .5s ${0.15 + i * 0.18}s both` }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#39d98a", flex: "none", boxShadow: "0 0 8px #39d98a" }} />
          <span style={{ fontSize: 14, color: "#f4f2ec" }}>{h}</span>
        </div>
      ))}
    </div>
  );
}

/* ── vector search: matches with score bars ─────────────────────────────── */
function VectorSearch({ data }: { data: Data }) {
  const matches = Array.isArray(data.matches) ? (data.matches as { id: string; score: number }[]) : [];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {matches.map((m, i) => (
        <div key={i}>
          <div className="font-mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9fb0cc", marginBottom: 5 }}>
            <span>{m.id}</span>
            <span style={{ color: "#4d8cff" }}>{m.score.toFixed(2)}</span>
          </div>
          <span style={{ display: "block", height: 6, borderRadius: 4, background: "rgba(255,255,255,.06)" }}>
            <span style={{ display: "block", height: "100%", width: `${Math.min(100, m.score * 100)}%`, borderRadius: 4, background: "linear-gradient(90deg,#4d8cff,#6ea8ff)", transformOrigin: "left", animation: `mngrow .8s ${0.2 + i * 0.15}s ease-out both` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── geocoding: pin drops on a grid ─────────────────────────────────────── */
function Geocoding({ data }: { data: Data }) {
  const lat = Number(data.lat ?? 0);
  const lng = Number(data.lng ?? 0);
  const x = ((lng + 180) / 360) * 100;
  const y = ((90 - lat) / 180) * 100;
  return (
    <div>
      <div className="font-mono" style={{ fontSize: 12, color: "#9fb0cc", marginBottom: 10 }}>
        {String(data.query ?? "location")} → <span style={{ color: "#4d8cff" }}>{lat.toFixed(4)}, {lng.toFixed(4)}</span>
      </div>
      <div style={{ position: "relative", height: 96, borderRadius: 10, background: "repeating-linear-gradient(0deg,transparent,transparent 15px,rgba(255,255,255,.05) 15px,rgba(255,255,255,.05) 16px),repeating-linear-gradient(90deg,transparent,transparent 15px,rgba(255,255,255,.05) 15px,rgba(255,255,255,.05) 16px)", border: "1px solid rgba(255,255,255,.08)", overflow: "hidden" }}>
        <span style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-100%)", animation: "mndrop .7s .3s both" }}>
          <span style={{ display: "block", width: 14, height: 14, borderRadius: "50% 50% 50% 0", background: "#4d8cff", transform: "rotate(45deg)", boxShadow: "0 4px 10px rgba(43,107,243,.6)" }} />
        </span>
      </div>
    </div>
  );
}

/* ── compute: GPU nodes power on ────────────────────────────────────────── */
function Compute({ data }: { data: Data }) {
  const n = Math.max(1, Math.min(16, Number(data.gpus_available ?? 8)));
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {Array.from({ length: n }).map((_, i) => (
          <span key={i} style={{ width: 26, height: 26, borderRadius: 6, background: "#4d8cff", opacity: 0, animation: `mnlight .4s ${0.1 + i * 0.08}s forwards` }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Chip tone="green">{n} GPUs online</Chip>
        <Chip>region {String(data.region ?? "—")}</Chip>
      </div>
    </div>
  );
}
