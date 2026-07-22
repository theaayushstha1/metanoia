"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon, Pill, LiveDot, TopBar, usd } from "./components/ui";

/* ── types (mirror /api/agent/plan) ───────────────────────────────────── */
interface Candidate {
  id: string;
  name: string;
  vendor: string;
  price: string;
  price_cents: number;
  real_time: boolean;
  websockets: boolean;
  max_rps: number | null;
  uptime_pct: number | null;
}
interface Check {
  rule: string;
  passed: boolean;
  detail: string;
}
interface Verdict {
  approved: boolean;
  summary: string;
  checks: Check[];
}
interface Decision {
  selected_plan_id: string | null;
  valid: boolean;
  plan?: { id: string; name: string; vendor: string; price_cents: number };
  verdict?: Verdict;
  projected_monthly_cents?: number;
  remaining_monthly_cents?: number;
  confirmation_required: boolean;
  note?: string;
}
interface Proposal {
  reasoning: string;
  rejected: { plan_id: string; reason: string }[];
}
interface Blocked {
  plan: Candidate;
  verdict: Verdict;
}
interface Result {
  proposal: Proposal | null;
  decision: Decision;
  trace: { tool?: string; input?: unknown; output?: unknown }[];
  candidates: Candidate[];
  blocked: Blocked | null;
}

type Mandate = { monthly: number; perCharge: number; maxSubs: number };

const PRESETS: Record<string, string> = {
  "market-data":
    "Find the best market-data API: real-time US equities, websockets, ≥60 req/s, under $50/month.",
  news: "I need a news API with LLM summaries, under $20/month.",
  "over-budget": "Get me a GPU compute API for model training.",
};

const RULE_LABEL: Record<string, string> = {
  mandate_expired: "MANDATE VALID",
  per_charge_cap: "PER-CHARGE CAP",
  monthly_cap: "MONTHLY CAP",
  max_subscriptions: "MAX SUBS",
  category_allowlist: "CATEGORY",
  merchant_allowlist: "MERCHANT",
};

const blue = "var(--blue)";
const disp = "var(--font-bricolage), sans-serif";

export default function Workbench({ mandate }: { mandate: Mandate }) {
  const router = useRouter();
  const [request, setRequest] = useState(PRESETS["market-data"]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  async function runWith(text: string) {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch("/api/agent/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: text }),
      });
      const data = await r.json();
      if (!r.ok) setError(data.error ?? "Agent error");
      else setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }
  const run = () => runWith(request);
  const refine = (feedback: string) =>
    runWith(
      `${request}\n\nThe user reviewed your previous pick and asked for: ${feedback}. ` +
        `Reconsider every provider and choose again, respecting the same spending mandate.`
    );

  const statusPills = (
    <>
      <Pill>
        <Icon.bolt size={11} /> HYPERSWITCH · SANDBOX
      </Pill>
      <Pill tone="blue">
        <Icon.sparkle size={11} /> GEMINI 3.1 PRO
      </Pill>
      <Pill tone="green">
        <LiveDot /> LIVE
      </Pill>
    </>
  );

  const approved = Boolean(
    result && result.decision.selected_plan_id && result.decision.verdict?.approved
  );
  const refused = Boolean(result && !approved);

  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      {!loading && refused && (
        <div style={{ height: 4, background: "linear-gradient(90deg,var(--blue),var(--red-2))" }} />
      )}
      <TopBar
        tag={loading ? "PROCURING" : result ? "RUN R-0114" : "PROCUREMENT TERMINAL"}
        right={statusPills}
      />

      {loading && <Processing />}
      {!loading && !result && (
        <Home
          mandate={mandate}
          request={request}
          setRequest={setRequest}
          run={run}
          loading={loading}
          error={error}
        />
      )}
      {!loading && result && approved && (
        <AgentResult
          result={result}
          mandate={mandate}
          onConfirm={(id) => router.push(`/checkout?plan=${id}`)}
          onRefine={refine}
        />
      )}
      {!loading && result && refused && <Refused result={result} onReset={() => setResult(null)} />}
    </div>
  );
}

/* ══ PROCESSING ════════════════════════════════════════════════════════ */
function Processing() {
  const steps = [
    { t: "Reading your request", d: "extracting hard requirements" },
    { t: "Scanning the marketplace", d: "7 onboarded vendors" },
    { t: "Comparing offers", d: "price · throughput · reliability" },
    { t: "Checking your mandate", d: "SpendGuard, in order" },
    { t: "Finalizing the pick", d: "assembling the proposal" },
  ];
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s < steps.length - 1 ? s + 1 : s)), 1250);
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <div style={{ padding: "72px 24px 96px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* emblem */}
      <div style={{ position: "relative", width: 150, height: 150, display: "grid", placeItems: "center" }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{ position: "absolute", width: 80, height: 80, borderRadius: "50%", border: "1.5px solid var(--accent-line)", animation: `ring 2.4s ease-out ${i * 0.8}s infinite` }}
          />
        ))}
        <svg width="112" height="112" viewBox="0 0 112 112" style={{ position: "absolute", animation: "spin 3.6s linear infinite" }}>
          <circle cx="56" cy="56" r="52" fill="none" stroke="var(--blue)" strokeWidth="2" strokeDasharray="10 14" strokeLinecap="round" opacity="0.5" />
        </svg>
        <svg width="86" height="86" viewBox="0 0 86 86" style={{ position: "absolute", animation: "spin 1.4s linear infinite" }}>
          <circle cx="43" cy="43" r="39" fill="none" stroke="var(--blue)" strokeWidth="3" strokeDasharray="60 200" strokeLinecap="round" />
        </svg>
        <span
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "linear-gradient(135deg,#4d8cff,#1e54d0)",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 10px 30px rgba(43,107,243,.4)",
            animation: "bob 2s ease-in-out infinite",
          }}
        >
          <Icon.sparkle size={26} color="#fff" />
        </span>
      </div>

      <div className="font-mono" style={{ marginTop: 24, fontSize: 11, fontWeight: 500, letterSpacing: ".2em", color: blue }}>
        METANOIA IS PROCURING
      </div>
      <div style={{ marginTop: 8, fontFamily: disp, fontWeight: 800, fontSize: 30, letterSpacing: "-.02em" }}>
        Finding your best option…
      </div>

      <div style={{ marginTop: 32, width: "100%", maxWidth: 440, display: "grid", gap: 2 }}>
        {steps.map((s, i) => {
          const state = i < step ? "done" : i === step ? "active" : "todo";
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 16px",
                borderRadius: 10,
                background: state === "active" ? "var(--accent-bg)" : "transparent",
                opacity: state === "todo" ? 0.4 : 1,
                transition: "all .3s",
              }}
            >
              <span style={{ width: 22, height: 22, display: "grid", placeItems: "center", flex: "none" }}>
                {state === "done" ? (
                  <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--green-bg)", display: "grid", placeItems: "center" }}>
                    <Icon.check size={11} color="var(--green)" sw={3} />
                  </span>
                ) : state === "active" ? (
                  <svg width="20" height="20" viewBox="0 0 20 20" style={{ animation: "spin .8s linear infinite" }}>
                    <circle cx="10" cy="10" r="8" fill="none" stroke="var(--accent-line)" strokeWidth="2.5" />
                    <path d="M10 2a8 8 0 0 1 8 8" fill="none" stroke="var(--blue)" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                ) : (
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--faint)" }} />
                )}
              </span>
              <span style={{ flex: 1 }}>
                <span className="font-body" style={{ display: "block", fontSize: 13.5, fontWeight: state === "active" ? 700 : 600, color: state === "active" ? blue : "var(--ink)" }}>
                  {s.t}
                </span>
                <span className="font-mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
                  {s.d}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 26, width: "100%", maxWidth: 440, height: 4, borderRadius: 3, overflow: "hidden", background: "var(--line-2)" }}>
        <div style={{ height: "100%", width: "100%", background: "linear-gradient(90deg,transparent,var(--blue),transparent)", backgroundSize: "220% 100%", animation: "shimmer 1.4s linear infinite" }} />
      </div>
      <div className="font-mono" style={{ marginTop: 14, fontSize: 10, letterSpacing: ".1em", color: "var(--faint)" }}>
        GEMINI 3.1 PRO · REASONING LIVE
      </div>
    </div>
  );
}

/* ══ COUNTER / REFINE ══════════════════════════════════════════════════ */
function CounterBar({ onRefine }: { onRefine: (f: string) => void }) {
  const [text, setText] = useState("");
  const chips = ["Find something cheaper", "I need higher throughput", "Prioritize uptime", "Try a different vendor"];
  const submit = (f: string) => {
    if (f.trim()) onRefine(f.trim());
  };
  return (
    <div style={{ marginTop: 16, border: "1px dashed var(--line)", borderRadius: 12, background: "var(--panel)", padding: "18px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <Icon.sparkle size={14} />
        <span className="font-mono" style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".14em" }}>
          NOT QUITE? TELL THE AGENT
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {chips.map((c) => (
          <button
            key={c}
            onClick={() => submit(c)}
            className="font-body"
            style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-2)", background: "#fff", border: "1px solid var(--line-3)", borderRadius: 99, padding: "8px 14px", cursor: "pointer" }}
          >
            {c}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(text)}
          placeholder="…or say what you'd change"
          className="font-body"
          style={{ flex: 1, border: "1px solid var(--line-3)", borderRadius: 10, padding: "11px 14px", fontSize: 13, outline: "none" }}
        />
        <button
          onClick={() => submit(text)}
          className="font-body"
          style={{ fontSize: 12.5, fontWeight: 600, color: blue, background: "var(--accent-bg)", border: "1px solid var(--accent-line)", borderRadius: 10, padding: "11px 20px", cursor: "pointer" }}
        >
          Ask again
        </button>
      </div>
    </div>
  );
}

/* ══ 1a WORKBENCH HOME ═════════════════════════════════════════════════ */
function Home({
  mandate,
  request,
  setRequest,
  run,
  loading,
  error,
}: {
  mandate: Mandate;
  request: string;
  setRequest: (s: string) => void;
  run: () => void;
  loading: boolean;
  error: string;
}) {
  return (
    <>
      {/* hero */}
      <div style={{ padding: "64px 64px 34px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(700px 320px at 50% -80px,rgba(77,140,255,.14),transparent)",
          }}
        />
        <div
          className="font-mono"
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: ".14em",
            color: blue,
            background: "var(--accent-bg)",
            border: "1px solid var(--accent-line)",
            borderRadius: 99,
            padding: "7px 16px",
            animation: "rise .6s .05s both",
          }}
        >
          <Icon.shieldCheck size={12} /> AGENT WITH A MANDATE
        </div>
        <h1
          style={{
            position: "relative",
            margin: "24px auto 0",
            maxWidth: 800,
            fontFamily: disp,
            fontWeight: 800,
            fontSize: 64,
            lineHeight: 1.03,
            letterSpacing: "-.025em",
            textWrap: "balance",
            animation: "rise .7s .12s both",
          }}
        >
          Give your agent a <span style={{ color: blue }}>budget</span>, not your card.
        </h1>
        <p
          style={{
            position: "relative",
            margin: "18px auto 0",
            maxWidth: 520,
            fontSize: 17,
            lineHeight: 1.55,
            color: "var(--muted)",
            animation: "rise .7s .2s both",
          }}
        >
          It shops. It compares. It asks. You approve.
        </p>
      </div>

      {/* mandate cards */}
      <div style={{ padding: "0 64px", animation: "rise .7s .3s both" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
            maxWidth: 900,
            margin: "0 auto",
          }}
        >
          <MandateCard label="MONTHLY CAP" value={usd(mandate.monthly)} foot="SPENT $0.00" meter={0} />
          <MandateCard label="PER-CHARGE CAP" value={usd(mandate.perCharge)} foot="HARD LIMIT" />
          <MandateCard
            label="MAX SUBS"
            value={String(mandate.maxSubs)}
            foot="0 ACTIVE"
            slots={mandate.maxSubs}
          />
        </div>
      </div>

      {/* command input */}
      <div style={{ padding: "26px 64px 40px", animation: "rise .7s .4s both" }}>
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            border: "1px solid var(--line)",
            borderRadius: 14,
            background: "#fff",
            boxShadow: "0 10px 34px rgba(20,40,90,.08)",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", gap: 12, padding: "20px 24px 16px" }}>
            <span className="font-mono" style={{ fontSize: 17, fontWeight: 600, color: blue, lineHeight: "26px" }}>
              ›
            </span>
            <textarea
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              rows={2}
              spellCheck={false}
              className="font-mono"
              style={{
                flex: 1,
                resize: "none",
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 15,
                lineHeight: 1.6,
                color: "var(--ink)",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              borderTop: "1px solid var(--line-2)",
              background: "var(--panel)",
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <PresetChip active label="market-data" onClick={() => setRequest(PRESETS["market-data"])}>
                <Icon.candles size={12} color={blue} />
              </PresetChip>
              <PresetChip label="news" onClick={() => setRequest(PRESETS["news"])}>
                <Icon.news size={12} />
              </PresetChip>
              <PresetChip label="over-budget" onClick={() => setRequest(PRESETS["over-budget"])}>
                <Icon.grid size={12} />
              </PresetChip>
            </div>
            <button
              onClick={run}
              disabled={loading || request.trim().length < 3}
              className="font-body"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                background: "linear-gradient(180deg,#3d7bff,#2b6bf3)",
                border: "none",
                borderRadius: 10,
                padding: "12px 26px",
                boxShadow: "0 8px 22px rgba(43,107,243,.35)",
                cursor: loading ? "default" : "pointer",
                opacity: loading || request.trim().length < 3 ? 0.6 : 1,
              }}
            >
              <Icon.bolt size={13} color="#fff" />
              {loading ? "Procuring…" : "Run Metanoia"}
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              maxWidth: 900,
              margin: "16px auto 0",
              border: "1px solid var(--red-2)",
              background: "var(--red-bg)",
              borderRadius: 10,
              padding: "12px 16px",
              fontSize: 13,
              color: "var(--red)",
            }}
          >
            {error}
          </div>
        )}

        <div
          className="font-mono"
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 26,
            marginTop: 22,
            fontSize: 10.5,
            letterSpacing: ".08em",
            color: "var(--faint)",
            flexWrap: "wrap",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Icon.nodes size={11} /> 7 VENDORS
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Icon.shield size={11} color="var(--faint)" /> EVERY CHARGE CHECKED
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Icon.card size={11} color="var(--faint)" /> REAL PAYMENTS VIA HYPERSWITCH
          </span>
        </div>
      </div>
    </>
  );
}

function MandateCard({
  label,
  value,
  foot,
  meter,
  slots,
}: {
  label: string;
  value: string;
  foot: string;
  meter?: number;
  slots?: number;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 12,
        background: "linear-gradient(180deg,#f7f9fe,#fff)",
        padding: "20px 24px",
        textAlign: "center",
      }}
    >
      <div className="font-mono" style={{ fontSize: 10, fontWeight: 500, letterSpacing: ".14em", color: "var(--muted)" }}>
        {label}
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: 34,
          fontWeight: 600,
          letterSpacing: "-.03em",
          marginTop: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}
      >
        {value}
        {slots != null && (
          <span style={{ display: "flex", gap: 5 }}>
            {Array.from({ length: slots }).map((_, i) => (
              <span key={i} style={{ width: 18, height: 18, border: "1.5px dashed #b9c8e6", borderRadius: 5 }} />
            ))}
          </span>
        )}
      </div>
      <div style={{ height: 5, background: "#e7edf9", borderRadius: 3, marginTop: 14, overflow: "hidden" }}>
        {meter != null && (
          <div style={{ height: "100%", width: `${meter}%`, background: blue, borderRadius: 3 }} />
        )}
      </div>
      <div className="font-mono" style={{ fontSize: 9.5, color: "var(--faint)", marginTop: 8 }}>
        {foot}
      </div>
    </div>
  );
}

function PresetChip({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="font-mono"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        fontSize: 11,
        fontWeight: 500,
        color: active ? blue : "var(--muted)",
        border: `1px solid ${active ? "var(--accent-line)" : "var(--line-3)"}`,
        background: active ? "var(--accent-bg)" : "#fff",
        borderRadius: 99,
        padding: "7px 14px",
        cursor: "pointer",
      }}
    >
      {children}
      {label}
    </button>
  );
}

/* ══ 1b AGENT RESULT ═══════════════════════════════════════════════════ */
function AgentResult({
  result,
  mandate,
  onConfirm,
  onRefine,
}: {
  result: Result;
  mandate: Mandate;
  onConfirm: (id: string) => void;
  onRefine: (f: string) => void;
}) {
  const d = result.decision;
  const checks = d.verdict?.checks ?? [];
  const pass = checks.filter((c) => c.passed).length;
  const projected = d.projected_monthly_cents ?? 0;
  const pct = Math.min(100, (projected / mandate.monthly) * 100);
  const capMark = Math.min(100, (mandate.perCharge / mandate.monthly) * 100);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "390px 1fr", minHeight: 620 }}>
      {/* trace rail */}
      <div style={{ borderRight: "1px solid var(--line-2)", background: "var(--panel)", padding: 26, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 20 }}>
          <Icon.sparkle size={14} />
          <span className="font-mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".16em" }}>
            AGENT TRACE
          </span>
        </div>
        <div style={{ display: "grid", position: "relative" }} className="font-mono">
          <div style={{ position: "absolute", left: 5, top: 14, bottom: 14, width: 2, background: "linear-gradient(var(--blue),var(--accent-line))" }} />
          <TraceStep i={0} title="read your request" sub="realtime · websockets · ≥60 rps · ≤$50" />
          <TraceStep i={1} title="searched marketplace" sub={`${result.candidates.length} providers found`} />
          <TraceStep
            i={2}
            title="compared plans"
            sub={result.proposal?.rejected?.map((r) => `${r.plan_id} out`).join(" · ") || "ranked on price + fit"}
          />
          <TraceStep i={3} title="checked your mandate" sub={`${d.plan?.name} · allowed`} subColor="var(--green)" />
          <TraceStep i={4} title="waiting for you" active />
        </div>
        <div style={{ marginTop: "auto", border: "1px solid var(--line-3)", background: "#fff", borderRadius: 10, padding: "16px 18px" }}>
          <div className="font-mono" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, fontWeight: 600, letterSpacing: ".12em" }}>
            <Icon.shieldCheck size={12} /> SPENDGUARD
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.55, color: "var(--muted)" }}>
            The agent proposes. The server decides. It can never set a price or skip a check.
          </p>
        </div>
      </div>

      {/* main */}
      <div style={{ padding: "26px 30px 30px" }}>
        <div className="font-mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".16em", color: "var(--muted)", marginBottom: 14 }}>
          {result.candidates.length} OFFERS COMPARED
        </div>
        <div style={{ border: "1px solid var(--line-3)", borderRadius: 12, overflow: "hidden" }}>
          <div
            className="font-mono"
            style={{
              display: "grid",
              gridTemplateColumns: "2.4fr .9fr .9fr .9fr .8fr .9fr 1fr",
              padding: "11px 18px",
              background: "var(--panel)",
              borderBottom: "1px solid var(--line-2)",
              fontSize: 9.5,
              fontWeight: 600,
              letterSpacing: ".12em",
              color: "var(--faint)",
            }}
          >
            <span>PROVIDER</span>
            <span>PRICE/MO</span>
            <span>REALTIME</span>
            <span>WEBSOCKET</span>
            <span>MAX RPS</span>
            <span>UPTIME</span>
            <span />
          </div>
          {result.candidates.map((c) => (
            <OfferRow key={c.id} c={c} selected={c.id === d.selected_plan_id} />
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 16, marginTop: 16 }}>
          {/* the pick */}
          <div style={{ border: "1px solid var(--accent-line)", borderRadius: 12, background: "linear-gradient(180deg,#f4f8ff,#fff)", padding: "24px 26px" }}>
            <div className="font-mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".16em", color: blue }}>
              THE PICK
            </div>
            <div style={{ marginTop: 10, fontFamily: disp, fontWeight: 800, fontSize: 28, letterSpacing: "-.02em" }}>
              {d.plan?.name}{" "}
              <span className="font-mono" style={{ fontWeight: 600, fontSize: 20, color: blue }}>
                {usd(d.plan?.price_cents)}/mo
              </span>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.55, color: "var(--muted)" }}>
              Cheapest plan that meets every requirement.
            </p>
            <div style={{ marginTop: 20 }}>
              <div className="font-mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 500, letterSpacing: ".08em", color: "var(--muted)", marginBottom: 8 }}>
                <span>
                  BUDGET {usd(projected)} / {usd(mandate.monthly)}
                </span>
                <span style={{ color: "var(--green)" }}>{usd(d.remaining_monthly_cents)} LEFT</span>
              </div>
              <div style={{ height: 10, background: "#e7edf9", borderRadius: 5, overflow: "hidden", position: "relative" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: "linear-gradient(90deg,#4d8cff,#2b6bf3)",
                    borderRadius: 5,
                    animation: "meterfill 1s .3s cubic-bezier(.2,.7,.2,1) both",
                  }}
                />
                <span style={{ position: "absolute", left: `${capMark}%`, top: -3, width: 2, height: 16, background: "var(--faint)", borderRadius: 1 }} />
              </div>
              <div className="font-mono" style={{ textAlign: "right", fontSize: 9.5, color: "var(--faint)", marginTop: 7 }}>
                ▲ PER-CHARGE CAP {usd(mandate.perCharge)}
              </div>
            </div>
            <button
              onClick={() => d.selected_plan_id && onConfirm(d.selected_plan_id)}
              className="font-body"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                marginTop: 20,
                fontSize: 13.5,
                fontWeight: 600,
                color: "#fff",
                background: "linear-gradient(180deg,#3d7bff,#2b6bf3)",
                border: "none",
                borderRadius: 10,
                padding: "13px 28px",
                boxShadow: "0 8px 22px rgba(43,107,243,.35)",
                cursor: "pointer",
              }}
            >
              <Icon.check size={14} color="#fff" sw={2.4} />
              Confirm subscription
            </button>
          </div>

          {/* audit */}
          <div style={{ border: "1px solid var(--line-3)", borderRadius: 12, background: "#fff", padding: "24px 26px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <Icon.shieldCheck size={15} />
              <span className="font-mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".14em" }}>
                SPENDGUARD AUDIT
              </span>
              <span
                className="font-mono"
                style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: "var(--green)", background: "var(--green-bg)", borderRadius: 99, padding: "4px 10px" }}
              >
                {pass}/{checks.length} PASS
              </span>
            </div>
            <div style={{ marginTop: 12 }}>
              {checks.map((c, i) => (
                <AuditRow key={i} check={c} last={i === checks.length - 1} />
              ))}
            </div>
            <div style={{ marginTop: 14, borderTop: "1px solid var(--line-2)", paddingTop: 12, fontSize: 11.5, lineHeight: 1.55, color: "var(--muted)" }}>
              Checked in order. Logged. No overrides.
            </div>
          </div>
        </div>
        <CounterBar onRefine={onRefine} />
      </div>
    </div>
  );
}

function TraceStep({
  i,
  title,
  sub,
  subColor = "var(--muted)",
  active,
}: {
  i: number;
  title: string;
  sub?: string;
  subColor?: string;
  active?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 14, padding: "9px 0", animation: `rise .5s ${0.1 + i * 0.15}s both` }}>
      <span
        style={{
          position: "relative",
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: active ? "#fff" : blue,
          border: `3px solid ${active ? blue : "var(--panel)"}`,
          marginTop: 3,
          flex: "none",
          animation: active ? "pulse 1.6s ease-in-out infinite" : undefined,
        }}
      />
      <span style={{ fontSize: 12, lineHeight: 1.55, color: active ? blue : "var(--ink)", fontWeight: active ? 700 : 400 }}>
        {title}
        {sub && (
          <>
            <br />
            <span style={{ color: subColor }}>{sub}</span>
          </>
        )}
        {active && (
          <span style={{ display: "inline-block", width: 7, height: 13, background: blue, verticalAlign: -2, marginLeft: 4, animation: "blink 1.1s step-end infinite" }} />
        )}
      </span>
    </div>
  );
}

function OfferRow({ c, selected }: { c: Candidate; selected: boolean }) {
  const monogram = c.vendor
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const note = !c.websockets ? "NO WEBSOCKETS" : selected ? "" : "OVERKILL";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "2.4fr .9fr .9fr .9fr .8fr .9fr 1fr",
        alignItems: "center",
        padding: selected ? "17px 18px" : "14px 18px",
        borderBottom: "1px solid var(--line-2)",
        color: selected ? "var(--ink)" : "var(--muted)",
        background: selected ? "linear-gradient(90deg,#eef4ff,#f7faff)" : undefined,
        boxShadow: selected ? "inset 3px 0 0 var(--blue)" : undefined,
        animation: selected ? "lockin 1.5s .5s ease-out 1" : undefined,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          className="font-mono"
          style={{
            width: 32,
            height: 32,
            display: "grid",
            placeItems: "center",
            background: selected ? "linear-gradient(135deg,#4d8cff,#1e54d0)" : "#eef2fa",
            borderRadius: 8,
            fontSize: 10.5,
            fontWeight: 700,
            color: selected ? "#fff" : "var(--muted)",
          }}
        >
          {monogram}
        </span>
        <span>
          <span className="font-body" style={{ display: "block", fontSize: selected ? 14.5 : 13.5, fontWeight: selected ? 700 : 600, color: selected ? "var(--ink)" : "var(--ink-2)" }}>
            {c.name}
          </span>
          <span className="font-mono" style={{ fontSize: 10, color: selected ? "var(--muted)" : "var(--faint)" }}>
            {c.vendor.toUpperCase()}
          </span>
        </span>
      </span>
      <span className="font-mono" style={{ fontSize: selected ? 15 : 13, fontWeight: selected ? 700 : 600, color: selected ? blue : undefined }}>
        {c.price}
      </span>
      <span>{c.real_time ? <Icon.check size={16} color={selected ? blue : "#7c8598"} sw={2.2} /> : <Icon.x size={14} />}</span>
      <span>{c.websockets ? <Icon.check size={16} color={selected ? blue : "#7c8598"} sw={2.2} /> : <Icon.x size={14} />}</span>
      <span className="font-mono" style={{ fontSize: selected ? 13 : 12, fontWeight: selected ? 600 : 500, color: selected ? "var(--ink)" : undefined }}>
        {c.max_rps ?? "—"}
      </span>
      <span className="font-mono" style={{ fontSize: selected ? 13 : 12, fontWeight: selected ? 600 : 500, color: selected ? "var(--ink)" : undefined }}>
        {c.uptime_pct ? `${c.uptime_pct}%` : "—"}
      </span>
      <span style={{ textAlign: "right" }}>
        {selected ? (
          <span className="font-mono" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", color: "#fff", background: blue, borderRadius: 99, padding: "5px 11px" }}>
            SELECTED
          </span>
        ) : (
          <span className="font-mono" style={{ fontSize: 9.5, fontWeight: 500, color: "var(--faint)" }}>
            {note}
          </span>
        )}
      </span>
    </div>
  );
}

function AuditRow({ check, last }: { check: Check; last?: boolean }) {
  const label = RULE_LABEL[check.rule] ?? check.rule.replace(/_/g, " ").toUpperCase();
  const value = shortDetail(check);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: check.passed ? "11px 0" : "12px 12px",
        borderBottom: last ? "none" : "1px solid var(--line-2)",
        background: check.passed ? undefined : "#fdf3f3",
        borderRadius: check.passed ? undefined : 8,
        margin: check.passed ? undefined : "2px -12px",
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          display: "grid",
          placeItems: "center",
          background: check.passed ? "var(--green-bg)" : "#fbdcdc",
          borderRadius: "50%",
        }}
      >
        {check.passed ? <Icon.check size={10} color="var(--green)" sw={3} /> : <Icon.x size={10} color="var(--red)" />}
      </span>
      <span className="font-mono" style={{ flex: 1, fontSize: 11, fontWeight: check.passed ? 600 : 700, letterSpacing: ".06em", color: check.passed ? undefined : "var(--red)" }}>
        {label}
      </span>
      <span className="font-mono" style={{ fontSize: 10.5, color: check.passed ? "var(--faint)" : "var(--red)", fontWeight: check.passed ? 400 : 600 }}>
        {value}
      </span>
    </div>
  );
}

function shortDetail(c: Check): string {
  // pull the "$x ≤/> $y" style comparison out of the detail where possible
  const m = c.detail.match(/\$[\d.]+.*?\$[\d.]+/);
  if (m) return m[0].replace("vs per-charge cap", "≤").replace("projected vs monthly cap", "≤");
  if (c.rule === "mandate_expired") return c.passed ? "valid" : "expired";
  if (c.rule === "max_subscriptions") {
    const nums = c.detail.match(/\d+/g);
    return nums ? `${nums[0]} of ${nums[1]}` : "";
  }
  return c.passed ? "ok" : "fail";
}

/* ══ 1c REFUSED ════════════════════════════════════════════════════════ */
function Refused({ result, onReset }: { result: Result; onReset: () => void }) {
  const b = result.blocked;
  const plan = b?.plan;
  const checks = b?.verdict.checks ?? result.decision.verdict?.checks ?? [];
  const failCount = checks.filter((c) => !c.passed).length;
  const reason = result.proposal?.reasoning ?? result.decision.note ?? "It exceeds your mandate.";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 60, padding: "56px 64px", alignItems: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(600px 300px at 20% 0,rgba(224,82,82,.06),transparent)" }} />
      <div style={{ position: "relative" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, animation: "rise .5s .05s both" }}>
          <span style={{ width: 52, height: 52, display: "grid", placeItems: "center", background: "var(--red-bg)", borderRadius: 14, animation: "pop .5s .2s both" }}>
            <Icon.shieldX size={26} />
          </span>
          <span className="font-mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".18em", color: "var(--muted)" }}>
            SPENDGUARD SAID NO
          </span>
        </div>
        <div style={{ marginTop: 22, fontFamily: disp, fontWeight: 800, fontSize: 88, lineHeight: 0.95, letterSpacing: "-.03em", animation: "rise .6s .15s both" }}>
          Denied.
        </div>
        <p style={{ margin: "20px 0 0", maxWidth: 460, fontSize: 16, lineHeight: 1.6, color: "var(--muted)", animation: "rise .6s .25s both" }}>
          {plan ? (
            <>
              {plan.name} costs{" "}
              <span className="font-mono" style={{ fontWeight: 600, color: "var(--ink)" }}>
                {plan.price}
              </span>
              . {reason}
            </>
          ) : (
            reason
          )}
        </p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 26, background: "var(--accent-bg)", border: "1px solid var(--accent-line)", borderRadius: 10, padding: "12px 18px", animation: "rise .6s .35s both" }}>
          <Icon.lock size={14} />
          <span className="font-mono" style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: ".1em", color: blue }}>
            NO CHARGE. CARD NEVER TOUCHED.
          </span>
        </div>
      </div>

      {plan && (
        <div style={{ position: "relative", border: "1px solid var(--line-3)", borderRadius: 12, background: "#fff", boxShadow: "0 12px 32px rgba(20,40,90,.08)", padding: "24px 26px", animation: "rise .6s .3s both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, paddingBottom: 16, borderBottom: "1px solid var(--line-2)" }}>
            <span className="font-mono" style={{ width: 34, height: 34, display: "grid", placeItems: "center", background: "#eef2fa", borderRadius: 8, fontSize: 10.5, fontWeight: 700, color: "var(--muted)" }}>
              {plan.vendor.slice(0, 2).toUpperCase()}
            </span>
            <span>
              <span className="font-body" style={{ display: "block", fontSize: 14.5, fontWeight: 700 }}>
                {plan.name}
              </span>
              <span className="font-mono" style={{ fontSize: 10, color: "var(--faint)" }}>
                {plan.vendor.toUpperCase()}
              </span>
            </span>
            <span className="font-mono" style={{ marginLeft: "auto", fontSize: 16, fontWeight: 700, color: "var(--red-2)" }}>
              {plan.price}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "16px 0 10px" }}>
            <span className="font-mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".14em" }}>
              SPENDGUARD AUDIT
            </span>
            <span className="font-mono" style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: "var(--red)", background: "var(--red-bg)", borderRadius: 99, padding: "4px 10px" }}>
              {failCount} FAIL
            </span>
          </div>
          <div>
            {checks.map((c, i) => (
              <AuditRow key={i} check={c} last={i === checks.length - 1} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button className="font-body" style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "linear-gradient(180deg,#3d7bff,#2b6bf3)", border: "none", borderRadius: 9, padding: "10px 18px", cursor: "pointer" }}>
              Raise the cap
            </button>
            <button onClick={onReset} className="font-body" style={{ fontSize: 12, fontWeight: 600, color: blue, background: "var(--accent-bg)", border: "1px solid var(--accent-line)", borderRadius: 9, padding: "10px 18px", cursor: "pointer" }}>
              New search
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
