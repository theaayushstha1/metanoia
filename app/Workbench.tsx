"use client";

import { useState } from "react";
import Link from "next/link";
import MemoryPanel from "./MemoryPanel";
import { useRouter } from "next/navigation";
import { Icon, Mark, Pill, LiveDot, TopBar, usd } from "./components/ui";

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
  capability: string;
  features: string[];
  description: string;
  best_for: string;
  score: number;
  score_parts: {
    capabilityFit: number;
    priceEfficiency: number;
    reliability: number;
    throughput: number;
  };
  eligible: boolean;
  hard_failures: string[];
  tradeoff: string;
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
  model_selected_plan_id?: string | null;
  valid: boolean;
  plan?: { id: string; name: string; vendor: string; price_cents: number };
  verdict?: Verdict;
  projected_monthly_cents?: number;
  remaining_monthly_cents?: number;
  confirmation_required: boolean;
  score?: number;
  note?: string;
}
interface Proposal {
  reasoning: string;
  rejected: { plan_id: string; reason: string }[];
  normalized_requirements: {
    max_price_cents?: number | null;
    min_rps?: number | null;
    min_uptime_pct?: number | null;
    needs_realtime?: boolean;
    needs_websockets?: boolean;
    required_features?: string[];
    priority?: string;
  };
}
interface Blocked {
  plan: Candidate;
  verdict: Verdict;
}
interface ScoutReport {
  lens: "price" | "value" | "quality" | "market";
  label: string;
  status: "complete" | "unavailable";
  scope: "onboarded_catalog" | "external_research";
  winner_plan_id: string | null;
  headline: string;
  summary: string;
  observations: { plan_id: string; score: number; evidence: string; concern: string | null }[];
  external_signals: { provider: string; signal: string }[];
  sources: { title: string; url: string }[];
}
interface Result {
  proposal: Proposal | null;
  decision: Decision;
  trace: { tool?: string; input?: unknown; output?: unknown }[];
  candidates: Candidate[];
  scouts: ScoutReport[];
  blocked: Blocked | null;
  context: {
    profileSummary?: string;
    projectSummary?: string;
    socialLinks: string[];
    repositories: { fullName: string; language?: string; imported: boolean; error?: string }[];
  };
}

type Mandate = { monthly: number; perCharge: number; maxSubs: number; spent: number; active: number };
type RefinementMode = "cheaper" | "throughput" | "reliability" | "different_vendor" | "custom";
type RefinementRequest = { mode: RefinementMode; feedback: string };
type ContextDraft = {
  profileSummary: string;
  projectSummary: string;
  githubRepos: string;
  socialLinks: string;
};

const PRESETS: Record<string, string> = {
  "market-data":
    "Find the best market-data API: real-time US equities, websockets, ≥60 req/s, under $50/month.",
  news: "I need a news API with LLM summaries, under $20/month.",
  transcription: "Find me the best transcription (speech-to-text) service for $10 a month.",
  "over-budget": "Get me an A100 GPU compute API for large-model training. A100 is a hard requirement.",
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
const splitLines = (value: string) =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

export default function Workbench({ mandate: initialMandate }: { mandate: Mandate }) {
  const router = useRouter();
  const [mandate, setMandate] = useState(initialMandate);
  const [request, setRequest] = useState(PRESETS["market-data"]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [context, setContext] = useState<ContextDraft>({
    profileSummary: "Product-minded developer building with TypeScript and AI APIs.",
    projectSummary: "A financial research product that needs dependable real-time data without enterprise-scale spend.",
    githubRepos: "",
    socialLinks: "",
  });

  async function runWith(text: string, refinement?: RefinementRequest & { previousPlanId: string }) {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const mandateResponse = await fetch("/api/mandate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthly_cap_cents: mandate.monthly,
          per_charge_cap_cents: mandate.perCharge,
          max_active_subscriptions: mandate.maxSubs,
        }),
      });
      const mandateData = await mandateResponse.json();
      if (!mandateResponse.ok) throw new Error(mandateData.error ?? "Could not update mandate");

      const r = await fetch("/api/agent/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: text,
          refinement,
          context: {
            profileSummary: context.profileSummary || undefined,
            projectSummary: context.projectSummary || undefined,
            githubRepos: splitLines(context.githubRepos),
            socialLinks: splitLines(context.socialLinks),
          },
        }),
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
  const refine = ({ feedback, mode }: RefinementRequest) => {
    const previousPlanId =
      result?.decision.selected_plan_id ??
      result?.decision.model_selected_plan_id ??
      result?.candidates[0]?.id;
    if (!previousPlanId) {
      setError("Run a search before asking Metanoia to refine it.");
      return;
    }
    return runWith(request, { feedback, mode, previousPlanId });
  };

  const statusPills = (
    <div
      className="font-mono"
      style={{
        display: "flex",
        alignItems: "center",
        border: "1px solid var(--line-3)",
        borderRadius: 99,
        background: "#fff",
        boxShadow: "0 1px 3px rgba(20,40,90,.05)",
        overflow: "hidden",
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: ".07em",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 13px", color: "var(--muted)" }}>
        <Icon.bolt size={11} /> HYPERSWITCH
      </span>
      <span style={{ width: 1, alignSelf: "stretch", background: "var(--line-2)" }} />
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 13px", color: blue }}>
        <Icon.sparkle size={11} /> GEMINI 3.1 PRO
      </span>
      <span style={{ width: 1, alignSelf: "stretch", background: "var(--line-2)" }} />
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 13px", color: "var(--green)" }}>
        <LiveDot /> LIVE
      </span>
    </div>
  );

  const topRight = (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <Link
        href="/lab"
        className="font-mono"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 600, letterSpacing: ".07em", color: "var(--muted)", textDecoration: "none" }}
      >
        <Icon.bolt size={12} /> TEST LAB
      </Link>
      <Link
        href="/subscriptions"
        className="font-mono"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 600, letterSpacing: ".07em", color: "var(--muted)", textDecoration: "none" }}
      >
        <Icon.card size={12} /> SUBSCRIPTIONS
      </Link>
      {statusPills}
    </div>
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
        right={topRight}
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
          context={context}
          setContext={setContext}
          setMandate={setMandate}
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
      {!loading && result && refused && (
        <Refused
          result={result}
          mandate={mandate}
          setMandate={setMandate}
          onReset={() => setResult(null)}
          onRetry={() => runWith(request)}
          onRefine={refine}
        />
      )}
    </div>
  );
}

/* ══ PROCESSING ════════════════════════════════════════════════════════ */
function Processing() {
  // A static description of the server-side pipeline. We can't observe the agent's
  // real steps in-flight, so we don't fake per-step completion — the honest live
  // signal is the indeterminate motion below; the real trace shows after completion.
  const steps = [
    { t: "Reads your request", d: "extracting hard requirements" },
    { t: "Scans the marketplace", d: "18 curated offers" },
    { t: "Compares offers", d: "price · throughput · reliability" },
    { t: "Checks your mandate", d: "SpendGuard, in order" },
    { t: "Finalizes the pick", d: "assembling the proposal" },
  ];

  return (
    <div style={{ position: "relative", minHeight: "calc(100vh - 58px)", overflow: "hidden" }}>
      {/* the four real scouts, two per side — their actual evaluation lenses (advisory) */}
      <aside className="mn-procuring-side mn-side-left" aria-hidden="true">
        <ScoutWhisper name="PRICE SCOUT" facets={["exact monthly price", "budget headroom", "price efficiency", "hard reqs outrank cheapness"]} />
        <ScoutWhisper name="VALUE SCOUT" facets={["required feature coverage", "utility per dollar", "must-haves vs nice-to-haves", "no invented capabilities"]} />
      </aside>
      <aside className="mn-procuring-side mn-side-right" aria-hidden="true">
        <ScoutWhisper name="QUALITY SCOUT" align="right" facets={["uptime & throughput", "realtime transport", "operational fit", "SLA / security if supplied"]} />
        <ScoutWhisper name="MARKET SCOUT" align="right" facets={["grounded web search", "real external providers", "official pricing docs", "research-only, not purchasable"]} />
      </aside>

      <div style={{ padding: "60px 24px 90px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* emblem */}
      <div
        style={{
          width: 96,
          height: 96,
          display: "grid",
          placeItems: "center",
          color: "#2b6bf3",
          filter: "drop-shadow(0 4px 4px rgba(77,140,255,.28)) drop-shadow(0 12px 18px rgba(30,84,208,.14))",
          animation: "bob 2s ease-in-out infinite",
        }}
      >
        <span
          style={{
            display: "grid",
            placeItems: "center",
          }}
        >
          <Mark size={72} color="currentColor" sw={7} />
        </span>
      </div>

      <div className="font-mono" style={{ marginTop: 24, fontSize: 11, fontWeight: 500, letterSpacing: ".2em", color: blue }}>
        METANOIA IS PROCURING
      </div>
      <div style={{ marginTop: 8, fontFamily: disp, fontWeight: 800, fontSize: 30, letterSpacing: "-.02em" }}>
        Finding your best option…
      </div>

      <div style={{ marginTop: 32, width: "100%", maxWidth: 440 }}>
        <div className="font-mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".14em", color: "var(--faint)", marginBottom: 12, paddingLeft: 4 }}>
          PROCUREMENT PIPELINE
        </div>
        <div style={{ display: "grid", gap: 2 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 16px", borderRadius: 10 }}>
              <span style={{ width: 22, height: 22, display: "grid", placeItems: "center", flex: "none" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent-line)" }} />
              </span>
              <span style={{ flex: 1 }}>
                <span className="font-body" style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
                  {s.t}
                </span>
                <span className="font-mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
                  {s.d}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 26, width: "100%", maxWidth: 440, height: 4, borderRadius: 3, overflow: "hidden", background: "var(--line-2)" }}>
        <div style={{ height: "100%", width: "100%", background: "linear-gradient(90deg,transparent,var(--blue),transparent)", backgroundSize: "220% 100%", animation: "shimmer 1.4s linear infinite" }} />
      </div>
      <div className="font-mono" style={{ marginTop: 14, fontSize: 10, letterSpacing: ".1em", color: "var(--faint)" }}>
        RUNNING ON GEMINI 3.1 PRO
      </div>
      <div className="font-mono mn-procuring-caption" style={{ marginTop: 22, fontSize: 9.5, letterSpacing: ".16em", color: "var(--faint)" }}>
        FOUR SCOUTS ANALYZING IN PARALLEL · ADVISORY ONLY
      </div>
      </div>
    </div>
  );
}

/* Ambient side column during procuring: shows what a real scout weighs (from its
   actual instructions in lib/agent/scouts.ts). Descriptive, not a fabricated live
   token stream. Facets softly surface at staggered intervals. */
function ScoutWhisper({ name, facets, align = "left" }: { name: string; facets: string[]; align?: "left" | "right" }) {
  const dot = <span style={{ width: 6, height: 6, borderRadius: "50%", background: blue, animation: "pulse 1.6s ease-in-out infinite", flex: "none" }} />;
  return (
    <div style={{ marginBottom: 30, textAlign: align }}>
      <div className="font-mono" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 9.5, fontWeight: 700, letterSpacing: ".14em", color: "var(--muted)" }}>
        {align === "left" && dot}
        {name}
        {align === "right" && dot}
      </div>
      <div style={{ marginTop: 10, display: "grid", gap: 7 }}>
        {facets.map((f, i) => (
          <div key={f} className="font-mono" style={{ fontSize: 11, lineHeight: 1.4, color: "var(--ink-2)", animation: `mnwhisper 3.8s ease-in-out ${i * 0.5}s infinite` }}>
            {f}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══ COUNTER / REFINE ══════════════════════════════════════════════════ */
function CounterBar({ onRefine }: { onRefine: (refinement: RefinementRequest) => void }) {
  const [text, setText] = useState("");
  const chips: { label: string; mode: RefinementMode }[] = [
    { label: "Find something cheaper", mode: "cheaper" },
    { label: "I need higher throughput", mode: "throughput" },
    { label: "Prioritize uptime", mode: "reliability" },
    { label: "Try a different vendor", mode: "different_vendor" },
  ];
  const submit = (feedback: string, mode: RefinementMode) => {
    if (!feedback.trim()) return;
    onRefine({ feedback: feedback.trim(), mode });
    if (mode === "custom") setText("");
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
        {chips.map((chip) => (
          <button
            key={chip.mode}
            onClick={() => submit(chip.label, chip.mode)}
            className="font-body"
            style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-2)", background: "#fff", border: "1px solid var(--line-3)", borderRadius: 99, padding: "8px 14px", cursor: "pointer" }}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit(text, "custom");
          }}
          placeholder="…or say what you'd change"
          className="font-body"
          style={{ flex: 1, border: "1px solid var(--line-3)", borderRadius: 10, padding: "11px 14px", fontSize: 13, outline: "none" }}
        />
        <button
          onClick={() => submit(text, "custom")}
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
  context,
  setContext,
  setMandate,
}: {
  mandate: Mandate;
  request: string;
  setRequest: (s: string) => void;
  run: () => void;
  loading: boolean;
  error: string;
  context: ContextDraft;
  setContext: (context: ContextDraft) => void;
  setMandate: (mandate: Mandate) => void;
}) {
  return (
    <main className="mn-workbench-home">
      {/* hero */}
      <div className="mn-hero" style={{ padding: "26px 56px 12px", textAlign: "center", position: "relative" }}>
        <div
          className="font-mono"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: ".14em",
            color: blue,
            background: "var(--accent-bg)",
            border: "1px solid var(--accent-line)",
            borderRadius: 99,
            padding: "6px 14px",
            animation: "rise .6s .05s both",
          }}
        >
          <Icon.shieldCheck size={12} /> SPENDS ONLY WHAT YOU ALLOW
        </div>
        <h1
          className="mn-hero-title"
          style={{
            margin: "14px auto 0",
            maxWidth: 1000,
            fontFamily: disp,
            fontWeight: 800,
            fontSize: 56,
            lineHeight: 1.02,
            letterSpacing: "-.015em",
            textWrap: "balance",
            animation: "rise .7s .12s both",
          }}
        >
          Tell Metanoia <span style={{ color: blue }}>what you need.</span>
        </h1>
        <p
          style={{
            margin: "16px auto 0",
            maxWidth: 900,
            fontSize: 18,
            lineHeight: 1.5,
            color: "var(--muted)",
            textWrap: "balance",
            animation: "rise .7s .18s both",
          }}
        >
          It shops, compares, and buys the best option, under a budget you set, never your card.
        </p>
      </div>

      {/* project context — moved up, right under the hero */}
      <div className="mn-page-pad" style={{ padding: "16px 56px 0", animation: "rise .7s .28s both" }}>
        <div style={{ maxWidth: 1560, margin: "0 auto" }}>
          <ContextPanel context={context} setContext={setContext} />
        </div>
      </div>

      {/* the command — the main action */}
      <div className="mn-page-pad" style={{ padding: "18px 56px 8px", animation: "rise .7s .34s both" }}>
        <div className="mn-command-stage" style={{ maxWidth: 1560, margin: "0 auto" }}>
            <section
              className="mn-command-panel"
              aria-label="Procurement request"
              style={{
                border: "1px solid var(--line)",
                borderRadius: 10,
                background: "#fff",
                boxShadow: "0 10px 28px rgba(20,40,90,.07)",
                overflow: "hidden",
              }}
            >
              <div className="mn-command-input" style={{ display: "flex", gap: 12, padding: "22px 24px 18px" }}>
                <span className="font-mono" style={{ fontSize: 20, fontWeight: 600, color: blue, lineHeight: "26px" }}>
                  ›
                </span>
                <textarea
                  value={request}
                  onChange={(e) => setRequest(e.target.value)}
                  rows={5}
                  spellCheck={false}
                  className="font-mono"
                  aria-label="Describe what your agent should procure"
                  style={{
                    flex: 1,
                    resize: "none",
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    fontSize: 15,
                    lineHeight: 1.5,
                    color: "var(--ink)",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  padding: "12px 22px 16px",
                  borderTop: "1px solid var(--line-2)",
                }}
              >
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <PresetChip active label="market-data" onClick={() => setRequest(PRESETS["market-data"])}>
                    <Icon.candles size={12} color={blue} />
                  </PresetChip>
                  <PresetChip label="news" onClick={() => setRequest(PRESETS["news"])}>
                    <Icon.news size={12} />
                  </PresetChip>
                  <PresetChip label="transcription" onClick={() => setRequest(PRESETS["transcription"])}>
                    <Icon.sparkle size={12} />
                  </PresetChip>
                  <PresetChip label="over-budget" onClick={() => setRequest(PRESETS["over-budget"])}>
                    <Icon.grid size={12} />
                  </PresetChip>
                </div>
                <button
                  onClick={run}
                  disabled={loading || request.trim().length < 3}
                  className="font-body mn-run"
                >
                  <Icon.bolt size={14} color="#fff" />
                  {loading ? "Procuring…" : "Run Metanoia"}
                </button>
              </div>
            </section>

            {error && (
              <div
                style={{
                  marginTop: 12,
                  border: "1px solid var(--red-2)",
                  background: "var(--red-bg)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 12,
                  color: "var(--red)",
                }}
              >
                {error}
              </div>
            )}
        </div>
      </div>

      {/* agent settings — mandate + memory, at the bottom */}
      <div className="mn-page-pad" style={{ padding: "10px 56px 44px", animation: "rise .7s .4s both" }}>
        <div style={{ maxWidth: 1560, margin: "0 auto", display: "grid", gap: 14 }}>
          <MandateTuner mandate={mandate} onChange={setMandate} />
          <MemoryPanel />
        </div>
      </div>
    </main>
  );
}

function ContextPanel({
  context,
  setContext,
}: {
  context: ContextDraft;
  setContext: (context: ContextDraft) => void;
}) {
  const field = (key: keyof ContextDraft, value: string) => setContext({ ...context, [key]: value });
  return (
    <section className="mn-context-panel">
      <div>
        <div className="mn-context-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
          <div>
            <div className="font-mono" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em" }}>
              <Icon.nodes size={13} color={blue} /> PROJECT CONTEXT
            </div>
            <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
              Optional signals for better fit and tradeoffs.
            </p>
          </div>
          <span className="font-mono" style={{ fontSize: 9, color: "var(--green)", background: "var(--green-bg)", borderRadius: 99, padding: "5px 9px" }}>
            PUBLIC DATA ONLY
          </span>
        </div>
        <div className="mn-context-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <ContextField label="YOUR BACKGROUND" hint="role · skills">
            <textarea
              value={context.profileSummary}
              onChange={(event) => field("profileSummary", event.target.value)}
              rows={3}
              placeholder="Product engineer, comfortable with TypeScript, prefers managed services..."
            />
          </ContextField>
          <ContextField label="CURRENT PROJECT" hint="product · constraints">
            <textarea
              value={context.projectSummary}
              onChange={(event) => field("projectSummary", event.target.value)}
              rows={3}
              placeholder="A research dashboard serving live market data to 500 users..."
            />
          </ContextField>
          <ContextField label="GITHUB REPOSITORIES" hint="up to 5">
            <MultiUrlInput
              value={context.githubRepos}
              onChange={(v) => field("githubRepos", v)}
              max={5}
              placeholder="https://github.com/owner/repo"
            />
          </ContextField>
          <ContextField label="PROFILE LINKS" hint="LinkedIn · X · portfolio">
            <MultiUrlInput
              value={context.socialLinks}
              onChange={(v) => field("socialLinks", v)}
              max={4}
              placeholder="https://linkedin.com/in/…"
            />
          </ContextField>
        </div>
      </div>
    </section>
  );
}

function ContextField({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <label className="mn-context-field" style={{ display: "grid", gap: 6 }}>
      <span className="font-mono" style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 9.5, fontWeight: 600, letterSpacing: ".1em", color: "var(--ink-2)" }}>
        {label}
        <span style={{ color: "var(--faint)", fontWeight: 400, letterSpacing: 0, textTransform: "none" }}>{hint}</span>
      </span>
      {children}
    </label>
  );
}

/* Paste a URL and hit Enter (or comma) to add it as a chip; paste several at once
   and they all get added. Backspace on an empty field removes the last chip.
   Stores its value as a newline-joined string so the parent contract is unchanged. */
function MultiUrlInput({
  value,
  onChange,
  max,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  max: number;
  placeholder: string;
}) {
  const items = splitLines(value);
  const [draft, setDraft] = useState("");

  const addMany = (raws: string[]) => {
    const next = [...items];
    for (const raw of raws) {
      const t = raw.trim().replace(/[,\s]+$/, "");
      if (!t) continue;
      const url = /^https?:\/\//i.test(t) ? t : `https://${t}`;
      if (!next.includes(url) && next.length < max) next.push(url);
    }
    onChange(next.join("\n"));
    setDraft("");
  };

  const label = (u: string) =>
    u.replace(/^https?:\/\/(www\.)?/i, "").replace(/^github\.com\//i, "").replace(/\/$/, "");

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        alignItems: "center",
        border: "1px solid var(--line-3)",
        borderRadius: 9,
        background: "#fff",
        padding: "6px 8px",
        minHeight: 42,
      }}
    >
      {items.map((u) => (
        <span
          key={u}
          className="font-mono"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            maxWidth: "100%",
            fontSize: 11,
            fontWeight: 500,
            color: blue,
            background: "var(--accent-bg)",
            border: "1px solid var(--accent-line)",
            borderRadius: 7,
            padding: "4px 6px 4px 9px",
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label(u)}</span>
          <button
            type="button"
            onClick={() => onChange(items.filter((x) => x !== u).join("\n"))}
            aria-label={`Remove ${label(u)}`}
            style={{ border: "none", background: "transparent", color: blue, cursor: "pointer", lineHeight: 1, fontSize: 14, padding: 0 }}
          >
            ×
          </button>
        </span>
      ))}
      {items.length < max && (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addMany([draft]);
            } else if (e.key === "Backspace" && !draft && items.length) {
              onChange(items.slice(0, -1).join("\n"));
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/[\s,]/.test(text.trim())) {
              e.preventDefault();
              addMany(text.split(/[\s,]+/));
            }
          }}
          onBlur={() => draft && addMany([draft])}
          placeholder={items.length ? "Add another, then Enter" : placeholder}
          style={{
            flex: 1,
            minWidth: 150,
            border: "none",
            outline: "none",
            background: "transparent",
            boxShadow: "none",
            padding: "3px 2px",
            width: "auto",
          }}
        />
      )}
    </div>
  );
}

function MandateTuner({
  mandate,
  onChange,
  onApply,
}: {
  mandate: Mandate;
  onChange: (mandate: Mandate) => void;
  onApply?: () => void;
}) {
  const minServices = Math.max(1, mandate.active);
  const set = (patch: Partial<Pick<Mandate, "monthly" | "perCharge" | "maxSubs">>) => {
    const monthly = patch.monthly ?? mandate.monthly;
    onChange({
      ...mandate,
      ...patch,
      monthly,
      perCharge: Math.min(patch.perCharge ?? mandate.perCharge, monthly),
      maxSubs: Math.max(minServices, patch.maxSubs ?? mandate.maxSubs),
    });
  };
  const presets = [
    { label: "Guarded", monthly: 4000, perCharge: 2000, maxSubs: Math.max(minServices, 2) },
    { label: "Balanced", monthly: 6000, perCharge: 4000, maxSubs: Math.max(minServices, 3) },
    { label: "Flexible", monthly: 12000, perCharge: 8000, maxSubs: Math.max(minServices, 7) },
  ];

  const ctrlBox: React.CSSProperties = {
    border: "1px solid var(--line-3)",
    borderRadius: 9,
    background: "#fff",
    padding: "12px 14px",
  };
  const stepBtn = (off: boolean): React.CSSProperties => ({
    width: 26,
    height: 26,
    flex: "none",
    display: "grid",
    placeItems: "center",
    border: "1px solid var(--line-3)",
    borderRadius: "50%",
    background: off ? "var(--panel)" : "#fff",
    color: off ? "var(--faint)" : blue,
    fontSize: 17,
    lineHeight: 1,
    cursor: off ? "not-allowed" : "pointer",
  });

  return (
    <section className="mn-mandate-tuner" aria-label="Spending mandate controls">
      <div className="mn-mandate-tuner-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".14em" }}>
            MANDATE CONTROLS
          </div>
          <div className="font-mono" style={{ marginTop: 3, fontSize: 9, color: "var(--faint)" }}>
            YOU SET THE LIMITS · THE SERVER ENFORCES THEM
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span className="font-mono" style={{ fontSize: 9, fontWeight: 600, letterSpacing: ".12em", color: "var(--faint)" }}>
            PROFILE
          </span>
          <div className="mn-mandate-presets" role="group" aria-label="Mandate presets">
            {presets.map((preset) => {
              const active =
                mandate.monthly === preset.monthly &&
                mandate.perCharge === preset.perCharge &&
                mandate.maxSubs === preset.maxSubs;
              return (
                <button key={preset.label} type="button" className={active ? "is-active" : undefined} onClick={() => set(preset)}>
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, padding: 14 }}>
        <div style={ctrlBox}>
          <RangeControl
            label="MONTHLY BUDGET"
            value={mandate.monthly}
            min={Math.max(3000, Math.ceil(mandate.spent / 500) * 500)}
            max={100000}
            step={500}
            onChange={(monthly) => set({ monthly })}
          />
        </div>
        <div style={ctrlBox}>
          <RangeControl
            label="MAX SINGLE PURCHASE"
            value={mandate.perCharge}
            min={500}
            max={mandate.monthly}
            maxInput={mandate.monthly}
            step={500}
            onChange={(perCharge) => set({ perCharge })}
          />
        </div>
        <div style={ctrlBox}>
          <div className="mn-range-label font-mono">
            <span>SERVICE SLOTS</span>
            <NumField value={mandate.maxSubs} min={minServices} max={10} onChange={(n) => set({ maxSubs: n })} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 0" }}>
            <button
              type="button"
              aria-label="Decrease service limit"
              disabled={mandate.maxSubs <= minServices}
              onClick={() => set({ maxSubs: mandate.maxSubs - 1 })}
              style={stepBtn(mandate.maxSubs <= minServices)}
            >
              −
            </button>
            <div className="mn-slot-track" style={{ flex: 1, marginTop: 0, gridTemplateColumns: `repeat(${Math.max(10, mandate.maxSubs)}, 1fr)` }} aria-hidden="true">
              {Array.from({ length: Math.max(10, mandate.maxSubs) }).map((_, index) => (
                <span
                  key={index}
                  className={index < mandate.maxSubs ? "is-available" : undefined}
                  data-filled={index < mandate.active ? "true" : undefined}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Increase service limit"
              disabled={mandate.maxSubs >= 10}
              onClick={() => set({ maxSubs: mandate.maxSubs + 1 })}
              style={stepBtn(mandate.maxSubs >= 10)}
            >
              +
            </button>
          </div>
          <span className="mn-range-scale font-mono">
            <span>{mandate.active} ACTIVE</span>
            <span>{Math.max(0, mandate.maxSubs - mandate.active)} OPEN</span>
          </span>
        </div>
      </div>

      {onApply && (
        <div className="mn-mandate-apply">
          <span className="font-mono">The next run uses these limits at every server gate.</span>
          <button type="button" onClick={onApply}>
            Apply mandate & retry
          </button>
        </div>
      )}
    </section>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  maxInput = 1000000,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Hard ceiling when the amount is typed directly (cents). */
  maxInput?: number;
}) {
  // The slider stretches to include the current value, so a typed amount above the
  // default max is still draggable.
  const sliderMax = Math.max(max, value);
  const safeValue = Math.max(min, Math.min(sliderMax, value));
  const progress = ((safeValue - min) / Math.max(1, sliderMax - min)) * 100;
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(Math.round(value / 100));
  const commit = (raw: string) => {
    const dollars = parseFloat(raw.replace(/[^0-9.]/g, ""));
    if (!Number.isNaN(dollars)) {
      const cents = Math.round((dollars * 100) / step) * step; // snap to step
      onChange(Math.max(min, Math.min(maxInput, cents)));
    }
    setDraft(null);
  };
  return (
    <div className="mn-range-control">
      <span className="mn-range-label font-mono">
        <span>{label}</span>
        <label
          title="Click to type an exact amount"
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 1,
            color: "var(--ink)",
            fontSize: 14,
            fontWeight: 700,
            background: "#fff",
            border: "1px solid var(--line-3)",
            borderRadius: 7,
            padding: "3px 9px",
            cursor: "text",
          }}
        >
          <span style={{ opacity: 0.5, fontWeight: 600 }}>$</span>
          <input
            value={shown}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => commit(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
            }}
            inputMode="numeric"
            aria-label={`${label} in dollars, editable`}
            style={{
              width: `${Math.max(2, shown.length + 0.5)}ch`,
              border: "none",
              outline: "none",
              background: "transparent",
              font: "inherit",
              color: "inherit",
              textAlign: "right",
              padding: 0,
              cursor: "text",
            }}
          />
        </label>
      </span>
      <input
        type="range"
        min={min}
        max={sliderMax}
        step={step}
        value={safeValue}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ "--range-progress": `${progress}%` } as React.CSSProperties}
      />
      <span className="mn-range-scale font-mono">
        <span>{usd(min)}</span>
        <span>{usd(sliderMax)}</span>
      </span>
    </div>
  );
}

/* Editable integer field (service slots). Click to type a number. */
function NumField({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);
  const commit = (raw: string) => {
    const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
    if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
    setDraft(null);
  };
  return (
    <label
      title="Click to type a number"
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        color: "var(--ink)",
        fontSize: 14,
        fontWeight: 700,
        background: "#fff",
        border: "1px solid var(--line-3)",
        borderRadius: 7,
        padding: "3px 10px",
        cursor: "text",
      }}
    >
      <input
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
        inputMode="numeric"
        aria-label="Service slots, editable"
        style={{
          width: `${Math.max(1, shown.length + 0.5)}ch`,
          border: "none",
          outline: "none",
          background: "transparent",
          font: "inherit",
          color: "inherit",
          textAlign: "right",
          padding: 0,
          cursor: "text",
        }}
      />
    </label>
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
  onRefine: (refinement: RefinementRequest) => void;
}) {
  const d = result.decision;
  const checks = d.verdict?.checks ?? [];
  const pass = checks.filter((c) => c.passed).length;
  const projected = d.projected_monthly_cents ?? 0;
  const pct = Math.min(100, (projected / mandate.monthly) * 100);
  const capMark = Math.min(100, (mandate.perCharge / mandate.monthly) * 100);
  const importedRepos = result.context.repositories.filter((repo) => repo.imported).length;
  const requirements = requirementSummary(result.proposal);
  const completedScouts = result.scouts?.filter((scout) => scout.status === "complete").length ?? 0;

  return (
    <div className="mn-result-layout" style={{ display: "grid", gridTemplateColumns: "390px 1fr", minHeight: 620 }}>
      {/* trace rail */}
      <div className="mn-trace-rail" style={{ borderRight: "1px solid var(--line-2)", background: "var(--panel)", padding: 26, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 20 }}>
          <Icon.sparkle size={14} />
          <span className="font-mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".16em" }}>
            AGENT TRACE
          </span>
        </div>
        <div style={{ display: "grid", position: "relative" }} className="font-mono">
          <div style={{ position: "absolute", left: 5, top: 14, bottom: 14, width: 2, background: "linear-gradient(var(--blue),var(--accent-line))" }} />
          <TraceStep i={0} title="read your project context" sub={`${importedRepos} repositories imported · ${result.context.profileSummary ? "profile attached" : "request only"}`} />
          <TraceStep i={1} title="normalized requirements" sub={requirements} />
          <TraceStep
            i={2}
            title="ranked three offers"
            sub="fit + price + reliability + throughput"
          />
          <TraceStep i={3} title="ran specialist review" sub={`${completedScouts}/4 scouts returned · advisory only`} />
          <TraceStep i={4} title="checked your mandate" sub={`${d.plan?.name} · allowed`} subColor="var(--green)" />
          <TraceStep i={5} title="waiting for you" active />
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
      <div className="mn-result-main" style={{ padding: "26px 30px 30px" }}>
        <div className="font-mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".16em", color: "var(--muted)", marginBottom: 14 }}>
          {result.candidates.length} OFFERS COMPARED
        </div>
        <div className="mn-offers-scroll" style={{ border: "1px solid var(--line-3)", borderRadius: 12, overflow: "auto" }}>
          <div
            className="font-mono"
            style={{
              display: "grid",
              gridTemplateColumns: "2.1fr .65fr .8fr .85fr .75fr 1.8fr .9fr",
              minWidth: 920,
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
            <span>FIT</span>
            <span>PRICE/MO</span>
            <span>THROUGHPUT</span>
            <span>UPTIME</span>
            <span>BEST FOR / TRADEOFF</span>
            <span>ACTION</span>
          </div>
          {result.candidates.map((c) => (
            <OfferRow key={c.id} c={c} selected={c.id === d.selected_plan_id} onChoose={onConfirm} />
          ))}
        </div>

        <ScoutPanel scouts={result.scouts ?? []} candidates={result.candidates} />

        <div className="mn-result-cards" style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 16, marginTop: 16 }}>
          {/* the pick */}
          <div style={{ border: "1px solid var(--accent-line)", borderRadius: 12, background: "linear-gradient(180deg,#f4f8ff,#fff)", padding: "24px 26px" }}>
            <div className="font-mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".16em", color: blue }}>
              RECOMMENDED · SCORE {d.score ?? result.candidates[0]?.score}/100
            </div>
            <div style={{ marginTop: 10, fontFamily: disp, fontWeight: 800, fontSize: 28, letterSpacing: "-.02em" }}>
              {d.plan?.name}{" "}
              <span className="font-mono" style={{ fontWeight: 600, fontSize: 20, color: blue }}>
                {usd(d.plan?.price_cents)}/mo
              </span>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.55, color: "var(--muted)" }}>
              {result.proposal?.reasoning ?? "Highest deterministic score among plans that satisfy the request and mandate."}
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

function ScoutPanel({ scouts, candidates }: { scouts: ScoutReport[]; candidates: Candidate[] }) {
  if (!scouts.length) return null;
  const candidateNames = new Map(candidates.map((candidate) => [candidate.id, candidate.name]));

  return (
    <section style={{ marginTop: 16, border: "1px solid var(--line-3)", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 16px", borderBottom: "1px solid var(--line-2)", background: "var(--panel)" }}>
        <Icon.nodes size={14} color={blue} />
        <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".14em" }}>
          FOUR SPECIALIST PERSPECTIVES
        </span>
        <span style={{ marginLeft: "auto" }}>
          <Pill tone="blue">ADVISORY ONLY</Pill>
        </span>
      </div>
      <div className="mn-scout-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))" }}>
        {scouts.map((scout, index) => {
          const winner = scout.winner_plan_id ? candidateNames.get(scout.winner_plan_id) : null;
          const winnerObservation = scout.observations.find((item) => item.plan_id === scout.winner_plan_id) ?? scout.observations[0];
          return (
            <article
              key={scout.lens}
              className="mn-scout-cell"
              style={{ minWidth: 0, padding: "17px 16px 18px", borderLeft: index ? "1px solid var(--line-2)" : undefined }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span className="font-mono" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".12em", color: blue }}>
                  {scout.label.toUpperCase()}
                </span>
                <span className="font-mono" style={{ fontSize: 8.5, color: scout.status === "complete" ? "var(--green)" : "var(--red)" }}>
                  {scout.status === "complete" ? "RETURNED" : "UNAVAILABLE"}
                </span>
              </div>
              <h3 style={{ margin: "9px 0 0", fontFamily: disp, fontSize: 16, lineHeight: 1.2, letterSpacing: 0 }}>
                {winner ?? scout.headline}
              </h3>
              {winner && (
                <div className="font-mono" style={{ marginTop: 4, fontSize: 9, color: "var(--faint)" }}>
                  {scout.headline}
                </div>
              )}
              <p style={{ margin: "9px 0 0", fontSize: 11.5, lineHeight: 1.5, color: "var(--muted)" }}>
                {winnerObservation?.evidence ?? scout.summary}
              </p>
              {scout.external_signals.slice(0, 2).map((signal) => (
                <div key={signal.provider} style={{ marginTop: 9, paddingTop: 9, borderTop: "1px solid var(--line-2)" }}>
                  <strong style={{ display: "block", fontSize: 11.5 }}>{signal.provider}</strong>
                  <span style={{ display: "block", marginTop: 2, fontSize: 10.5, lineHeight: 1.4, color: "var(--muted)" }}>{signal.signal}</span>
                </div>
              ))}
              {scout.sources.length > 0 && (
                <div className="font-mono" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, fontSize: 9 }}>
                  {scout.sources.slice(0, 3).map((source, sourceIndex) => (
                    <a key={source.url} href={source.url} target="_blank" rel="noreferrer" style={{ color: blue }} title={source.title}>
                      SOURCE {sourceIndex + 1}
                    </a>
                  ))}
                </div>
              )}
              <div className="font-mono" style={{ marginTop: 11, fontSize: 8.5, color: "var(--faint)", letterSpacing: ".06em" }}>
                {scout.scope === "external_research" ? "RESEARCH ONLY · NOT ONBOARDED" : "ONBOARDED CATALOG"}
              </div>
            </article>
          );
        })}
      </div>
    </section>
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

function OfferRow({
  c,
  selected,
  onChoose,
}: {
  c: Candidate;
  selected: boolean;
  onChoose: (id: string) => void;
}) {
  const monogram = c.vendor
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "2.1fr .65fr .8fr .85fr .75fr 1.8fr .9fr",
        minWidth: 920,
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
      <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: c.eligible ? blue : "var(--red)" }}>
        {c.score}
      </span>
      <span className="font-mono" style={{ fontSize: selected ? 15 : 13, fontWeight: selected ? 700 : 600, color: selected ? blue : undefined }}>
        {c.price}
      </span>
      <span className="font-mono" style={{ fontSize: selected ? 13 : 12, fontWeight: selected ? 600 : 500, color: selected ? "var(--ink)" : undefined }}>
        {c.max_rps != null ? `${c.max_rps} req/s` : "n/a"}
      </span>
      <span className="font-mono" style={{ fontSize: selected ? 13 : 12, fontWeight: selected ? 600 : 500, color: selected ? "var(--ink)" : undefined }}>
        {c.uptime_pct ? `${c.uptime_pct}%` : "n/a"}
      </span>
      <span style={{ fontSize: 11.5, lineHeight: 1.35, color: c.eligible ? "var(--muted)" : "var(--red)" }}>
        {c.eligible ? c.best_for : c.hard_failures[0] ?? c.tradeoff}
      </span>
      <span style={{ textAlign: "right" }}>
        {!c.eligible ? (
          <span className="font-mono" style={{ fontSize: 9.5, fontWeight: 700, color: "var(--red)" }}>
            BLOCKED
          </span>
        ) : selected ? (
          <span className="font-mono" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", color: "#fff", background: blue, borderRadius: 99, padding: "5px 11px" }}>
            BEST FIT
          </span>
        ) : (
          <button
            onClick={() => onChoose(c.id)}
            className="font-mono"
            style={{ border: "1px solid var(--accent-line)", background: "var(--accent-bg)", color: blue, borderRadius: 8, padding: "6px 10px", fontSize: 9.5, fontWeight: 700, cursor: "pointer" }}
          >
            CHOOSE
          </button>
        )}
      </span>
    </div>
  );
}

function requirementSummary(proposal: Proposal | null): string {
  if (!proposal) return "no structured requirements";
  const req = proposal.normalized_requirements;
  return [
    req.priority ? `${req.priority} priority` : "balanced priority",
    req.max_price_cents != null ? `≤${usd(req.max_price_cents)}` : null,
    req.min_rps != null ? `≥${req.min_rps} req/s` : null,
    req.min_uptime_pct != null ? `≥${req.min_uptime_pct.toFixed(3)}% uptime` : null,
    req.needs_realtime ? "realtime" : null,
    req.needs_websockets ? "websockets" : null,
    ...(req.required_features ?? []).map((feature) => feature.replace(/_/g, " ")),
  ]
    .filter(Boolean)
    .join(" · ");
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
/* Honest empty state: the request isn't something the marketplace carries. Neutral,
   not the red "Denied" screen — a budget refusal and "we don't sell that" are
   different truths and must read differently. */
function NoMatch({
  result,
  onReset,
  onRefine,
}: {
  result: Result;
  onReset: () => void;
  onRefine: (refinement: RefinementRequest) => void;
}) {
  const alternatives = result.candidates;
  const hasAlternatives = alternatives.length > 0;

  return (
    <div style={{ padding: "52px 64px 64px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(600px 300px at 20% 0,rgba(77,140,255,.08),transparent)" }} />
      <div style={{ position: "relative", maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, animation: "rise .5s .05s both" }}>
          <span style={{ width: 52, height: 52, display: "grid", placeItems: "center", background: "var(--accent-bg)", border: "1px solid var(--accent-line)", borderRadius: 14 }}>
            <Icon.grid size={22} color={blue} />
          </span>
          <span className="font-mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".18em", color: "var(--muted)" }}>
            NO MATCH FOUND
          </span>
        </div>
        <div style={{ marginTop: 22, maxWidth: 760, fontFamily: disp, fontWeight: 800, fontSize: 48, lineHeight: 1.04, letterSpacing: "-.02em", animation: "rise .6s .15s both" }}>
          {hasAlternatives ? "No exact match. Here are the tradeoffs." : "Nothing to compare yet."}
        </div>
        <p style={{ margin: "16px 0 0", maxWidth: 780, fontSize: 15, lineHeight: 1.6, color: "var(--muted)", animation: "rise .6s .25s both" }}>
          {hasAlternatives ? (
            <>None of the onboarded services satisfies every revised constraint. Metanoia returned the nearest options and will not charge until you change the requirement.</>
          ) : (
            <>The marketplace currently covers <b style={{ color: "var(--ink)" }}>market data, news, vector search, geocoding, GPU compute, and transcription</b>.</>
          )}
        </p>

        {hasAlternatives && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 12, marginTop: 26, animation: "rise .6s .3s both" }}>
            {alternatives.map((candidate, index) => {
              const failures = candidate.hard_failures.length
                ? candidate.hard_failures
                : [candidate.tradeoff];
              return (
                <article key={candidate.id} style={{ border: "1px solid var(--line-3)", borderRadius: 10, background: "#fff", padding: "18px 20px", boxShadow: "0 8px 24px rgba(20,40,90,.05)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <span className="font-mono" style={{ width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: 7, background: "var(--accent-bg)", color: blue, fontSize: 10, fontWeight: 700 }}>
                      {index + 1}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span className="font-body" style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{candidate.name}</span>
                      <span className="font-mono" style={{ fontSize: 9.5, color: "var(--faint)" }}>{candidate.vendor.toUpperCase()}</span>
                    </span>
                    <span className="font-mono" style={{ marginLeft: "auto", fontSize: 14, fontWeight: 700, color: blue }}>{candidate.price}</span>
                  </div>
                  <div className="font-mono" style={{ display: "flex", gap: 12, marginTop: 14, fontSize: 10, color: "var(--muted)" }}>
                    <span>{candidate.max_rps ?? "n/a"} req/s</span>
                    <span>{candidate.uptime_pct ?? "n/a"}% uptime</span>
                  </div>
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line-2)" }}>
                    <span className="font-mono" style={{ display: "block", marginBottom: 6, fontSize: 9, fontWeight: 700, letterSpacing: ".1em", color: "var(--red)" }}>MISSES</span>
                    {failures.slice(0, 2).map((failure) => (
                      <div key={failure} style={{ fontSize: 11.5, lineHeight: 1.45, color: "var(--muted)" }}>• {failure}</div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 26, background: "var(--accent-bg)", border: "1px solid var(--accent-line)", borderRadius: 10, padding: "12px 18px", animation: "rise .6s .35s both" }}>
          <Icon.lock size={14} />
          <span className="font-mono" style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: ".1em", color: blue }}>
            NO CHARGE. CARD NEVER TOUCHED.
          </span>
        </div>
        <div style={{ marginTop: 28, animation: "rise .6s .45s both" }}>
          <button onClick={onReset} className="font-body" style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "linear-gradient(180deg,#3d7bff,#2b6bf3)", border: "none", borderRadius: 10, padding: "12px 22px", boxShadow: "0 8px 22px rgba(43,107,243,.35)", cursor: "pointer" }}>
            Try another request
          </button>
        </div>
        {hasAlternatives && <CounterBar onRefine={onRefine} />}
      </div>
    </div>
  );
}

function Refused({
  result,
  mandate,
  setMandate,
  onReset,
  onRetry,
  onRefine,
}: {
  result: Result;
  mandate: Mandate;
  setMandate: (mandate: Mandate) => void;
  onReset: () => void;
  onRetry: () => void;
  onRefine: (refinement: RefinementRequest) => void;
}) {
  const b = result.blocked;
  const plan = b?.plan;
  const checks = b?.verdict.checks ?? result.decision.verdict?.checks ?? [];
  const failCount = checks.filter((c) => !c.passed).length;
  const reason = result.proposal?.reasoning ?? result.decision.note ?? "It exceeds your mandate.";

  // A real mandate denial is defined by a FAILING SpendGuard check — not merely by
  // "blocked" being set (the closest plan can pass the mandate yet still not be a real
  // match). No failing check => the agent found nothing to shop, which is an honest
  // empty state, NOT a refusal, and must not wear the red "Denied" screen.
  const hasRequestMatch = result.candidates.some((candidate) => candidate.hard_failures.length === 0);
  const isMandateDenial = hasRequestMatch && checks.some((c) => !c.passed);
  if (!isMandateDenial) return <NoMatch result={result} onReset={onReset} onRefine={onRefine} />;

  return (
    <div className="mn-refused-grid" style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 60, padding: "56px 64px", alignItems: "center", position: "relative", overflow: "hidden" }}>
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
        <div className="mn-denied-title" style={{ marginTop: 22, fontFamily: disp, fontWeight: 800, fontSize: 88, lineHeight: 0.95, letterSpacing: "-.03em", animation: "rise .6s .15s both" }}>
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

      <div style={{ position: "relative", display: "grid", gap: 14, animation: "rise .6s .3s both" }}>
        {plan && (
          <div style={{ border: "1px solid var(--line-3)", borderRadius: 8, background: "#fff", boxShadow: "0 12px 32px rgba(20,40,90,.08)", padding: "20px 22px" }}>
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
            <button onClick={onReset} className="font-body" style={{ fontSize: 12, fontWeight: 600, color: blue, background: "var(--accent-bg)", border: "1px solid var(--accent-line)", borderRadius: 9, padding: "10px 18px", cursor: "pointer" }}>
              New search
            </button>
          </div>
          </div>
        )}
        <MandateTuner mandate={mandate} onChange={setMandate} onApply={onRetry} />
        <CounterBar onRefine={onRefine} />
      </div>
    </div>
  );
}
