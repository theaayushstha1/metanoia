"use client";

import { useState } from "react";
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

  async function runWith(text: string) {
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
      <div className="mn-hero" style={{ padding: "14px 56px 10px", textAlign: "center", position: "relative" }}>
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
          <Icon.shieldCheck size={12} /> AGENT WITH A MANDATE
        </div>
        <h1
          className="mn-hero-title"
          style={{
            margin: "8px auto 0",
            maxWidth: 940,
            fontFamily: disp,
            fontWeight: 800,
            fontSize: 44,
            lineHeight: 1,
            letterSpacing: 0,
            textWrap: "balance",
            animation: "rise .7s .12s both",
          }}
        >
          Give your agent a <span style={{ color: blue }}>budget</span>, not your card.
        </h1>
      </div>

      <div className="mn-page-pad" style={{ padding: "0 56px", animation: "rise .7s .25s both" }}>
        <div style={{ maxWidth: 1560, margin: "0 auto" }}>
          <MandateTuner mandate={mandate} onChange={setMandate} />
        </div>
      </div>

      <div className="mn-page-pad" style={{ padding: "18px 56px 24px", animation: "rise .7s .35s both" }}>
        <div className="mn-support-grid">
          <ContextPanel context={context} setContext={setContext} />
          <MemoryPanel />
        </div>

        <div className="mn-command-stage">
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
                  rows={4}
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
              <div className="mn-command-footer">
                <div className="mn-preset-row" style={{ display: "flex", gap: 6 }}>
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
                  className="font-body mn-run-button"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: "#fff",
                    background: "linear-gradient(180deg,#3d7bff,#2b6bf3)",
                    border: "none",
                    borderRadius: 8,
                    padding: "12px 18px",
                    boxShadow: "0 6px 18px rgba(43,107,243,.28)",
                    cursor: loading ? "default" : "pointer",
                    opacity: loading || request.trim().length < 3 ? 0.6 : 1,
                  }}
                >
                  <Icon.bolt size={13} color="#fff" />
                  {loading ? "Procuring…" : "Run Metanoia"}
                </button>
              </div>
            </section>

            {error && (
              <div
                style={{
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
      perCharge: Math.min(patch.perCharge ?? mandate.perCharge, monthly, 10000),
      maxSubs: Math.max(minServices, patch.maxSubs ?? mandate.maxSubs),
    });
  };
  const presets = [
    { label: "Guarded", monthly: 4000, perCharge: 2000, maxSubs: Math.max(minServices, 2) },
    { label: "Balanced", monthly: 6000, perCharge: 4000, maxSubs: Math.max(minServices, 3) },
    { label: "Flexible", monthly: 12000, perCharge: 8000, maxSubs: Math.max(minServices, 7) },
  ];

  return (
    <section className="mn-mandate-tuner" aria-label="Spending mandate controls">
      <div className="mn-mandate-tuner-head">
        <div>
          <div className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".14em" }}>
            MANDATE CONTROLS
          </div>
          <div className="font-mono" style={{ marginTop: 4, fontSize: 9, color: "var(--faint)" }}>
            USER-AUTHORIZED · SERVER ENFORCED
          </div>
        </div>
      </div>

      <div className="mn-mandate-control-grid">
        <RangeControl
          label="MONTHLY BUDGET"
          value={mandate.monthly}
          min={Math.max(3000, Math.ceil(mandate.spent / 500) * 500)}
          max={20000}
          step={500}
          onChange={(monthly) => set({ monthly })}
        />
        <RangeControl
          label="MAX SINGLE PURCHASE"
          value={mandate.perCharge}
          min={500}
          max={Math.min(10000, mandate.monthly)}
          step={500}
          onChange={(perCharge) => set({ perCharge })}
        />
        <div className="mn-service-stepper">
          <div className="mn-range-label font-mono">
            <span>SERVICE SLOTS</span>
            <output aria-live="polite">{mandate.maxSubs}</output>
          </div>
          <div className="mn-service-control-row">
            <button
              type="button"
              aria-label="Decrease service limit"
              title="Decrease service limit"
              disabled={mandate.maxSubs <= minServices}
              onClick={() => set({ maxSubs: mandate.maxSubs - 1 })}
            >
              −
            </button>
            <div className="mn-slot-track" aria-hidden="true">
              {Array.from({ length: 10 }).map((_, index) => (
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
              title="Increase service limit"
              disabled={mandate.maxSubs >= 10}
              onClick={() => set({ maxSubs: mandate.maxSubs + 1 })}
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

      <div className="mn-mandate-profile-row">
        <span className="font-mono">SPENDING PROFILE</span>
        <div className="mn-mandate-presets" role="group" aria-label="Mandate presets">
          {presets.map((preset) => {
            const active =
              mandate.monthly === preset.monthly &&
              mandate.perCharge === preset.perCharge &&
              mandate.maxSubs === preset.maxSubs;
            return (
              <button
                key={preset.label}
                type="button"
                className={active ? "is-active" : undefined}
                onClick={() => set(preset)}
              >
                {preset.label}
              </button>
            );
          })}
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
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const safeValue = Math.max(min, Math.min(max, value));
  const progress = ((safeValue - min) / Math.max(1, max - min)) * 100;
  return (
    <label className="mn-range-control">
      <span className="mn-range-label font-mono">
        <span>{label}</span>
        <output>{usd(safeValue)}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={safeValue}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ "--range-progress": `${progress}%` } as React.CSSProperties}
      />
      <span className="mn-range-scale font-mono">
        <span>{usd(min)}</span>
        <span>{usd(max)}</span>
      </span>
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
  onRefine: (f: string) => void;
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
        {c.max_rps != null ? `${c.max_rps} req/s` : "—"}
      </span>
      <span className="font-mono" style={{ fontSize: selected ? 13 : 12, fontWeight: selected ? 600 : 500, color: selected ? "var(--ink)" : undefined }}>
        {c.uptime_pct ? `${c.uptime_pct}%` : "—"}
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
function NoMatch({ onReset }: { onReset: () => void }) {
  return (
    <div style={{ padding: "80px 64px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(600px 300px at 20% 0,rgba(77,140,255,.08),transparent)" }} />
      <div style={{ position: "relative", maxWidth: 580 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, animation: "rise .5s .05s both" }}>
          <span style={{ width: 52, height: 52, display: "grid", placeItems: "center", background: "var(--accent-bg)", border: "1px solid var(--accent-line)", borderRadius: 14 }}>
            <Icon.grid size={22} color={blue} />
          </span>
          <span className="font-mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".18em", color: "var(--muted)" }}>
            NO MATCH FOUND
          </span>
        </div>
        <div style={{ marginTop: 22, fontFamily: disp, fontWeight: 800, fontSize: 54, lineHeight: 1.02, letterSpacing: "-.02em", animation: "rise .6s .15s both" }}>
          Nothing to compare yet.
        </div>
        <p style={{ margin: "18px 0 0", fontSize: 16, lineHeight: 1.6, color: "var(--muted)", animation: "rise .6s .25s both" }}>
          Metanoia couldn&apos;t find a match for that under your constraints. The marketplace currently covers{" "}
          <b style={{ color: "var(--ink)" }}>market data, news, vector search, geocoding, GPU compute, and transcription</b>.
          Your budget wasn&apos;t the blocker — there was simply nothing to shop.
        </p>
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
}: {
  result: Result;
  mandate: Mandate;
  setMandate: (mandate: Mandate) => void;
  onReset: () => void;
  onRetry: () => void;
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
  const isMandateDenial = checks.some((c) => !c.passed);
  if (!isMandateDenial) return <NoMatch onReset={onReset} />;

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
      </div>
    </div>
  );
}
