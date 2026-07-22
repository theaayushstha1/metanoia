"use client";

import { useState } from "react";
import Link from "next/link";

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
interface Verdict {
  approved: boolean;
  summary: string;
  checks: { rule: string; passed: boolean; detail: string }[];
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
  requested_capability: string;
  selected_plan_id: string | null;
  score_breakdown: { plan_id: string; meets_requirements: boolean; note: string }[];
  rejected: { plan_id: string; reason: string }[];
  reasoning: string;
}
interface TraceStep {
  tool?: string;
  input?: unknown;
  output?: unknown;
}
interface Result {
  proposal: Proposal | null;
  decision: Decision;
  trace: TraceStep[];
  candidates: Candidate[];
}

const PRESETS = [
  "Find the best market-data API for my financial-research app: real-time US equities, websockets, at least 60 requests/sec, under $50/month.",
  "I need a news API with LLM summaries, under $20/month.",
  "Get me a GPU compute API for model training.",
];

function usd(cents?: number) {
  return cents == null ? "—" : `$${(cents / 100).toFixed(2)}`;
}

export default function Workbench({
  mandate,
}: {
  mandate: { monthly: number; perCharge: number; maxSubs: number };
}) {
  const [request, setRequest] = useState(PRESETS[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch("/api/agent/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request }),
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

  const d = result?.decision;
  const approved = Boolean(d?.verdict?.approved && d?.confirmation_required);

  return (
    <div className="space-y-6">
      {/* Mandate bar */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-neutral-800 bg-neutral-900/40 px-5 py-3 text-sm">
        <span className="text-xs uppercase tracking-wide text-[#9aa6ff]">Spending mandate</span>
        <span className="text-neutral-400">
          Monthly <b className="text-neutral-100">{usd(mandate.monthly)}</b>
        </span>
        <span className="text-neutral-400">
          Per-charge <b className="text-neutral-100">{usd(mandate.perCharge)}</b>
        </span>
        <span className="text-neutral-400">
          Max subs <b className="text-neutral-100">{mandate.maxSubs}</b>
        </span>
      </div>

      {/* Outcome input */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-5">
        <label className="text-sm font-medium text-neutral-300">
          What capability do you need?
        </label>
        <textarea
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          rows={3}
          className="mt-2 w-full resize-none rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-sm text-neutral-100 outline-none focus:border-[#3b4cff]"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={run}
            disabled={loading || request.trim().length < 3}
            className="rounded-lg bg-[#3b4cff] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2f3ddb] disabled:opacity-50"
          >
            {loading ? "Metanoia is procuring…" : "Run Metanoia"}
          </button>
          {PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => setRequest(p)}
              className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-400 hover:border-neutral-500"
            >
              {["market-data", "news", "over-budget"][i]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Structured decision trace */}
          <TraceView result={result} />

          {/* Comparison table */}
          {result.candidates.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-neutral-800">
              <table className="w-full text-sm">
                <thead className="bg-neutral-900/60 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-2">Provider</th>
                    <th className="px-4 py-2">Price</th>
                    <th className="px-4 py-2">Real-time</th>
                    <th className="px-4 py-2">WebSocket</th>
                    <th className="px-4 py-2">Max rps</th>
                    <th className="px-4 py-2">Uptime</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {result.candidates.map((c) => {
                    const isSel = c.id === d?.selected_plan_id;
                    return (
                      <tr
                        key={c.id}
                        className={`border-t border-neutral-800 ${isSel ? "bg-[#3b4cff]/10" : ""}`}
                      >
                        <td className="px-4 py-2">
                          <div className="font-medium text-neutral-100">{c.name}</div>
                          <div className="text-xs text-neutral-500">{c.vendor}</div>
                        </td>
                        <td className="px-4 py-2">{c.price}</td>
                        <td className="px-4 py-2">{c.real_time ? "✓" : "—"}</td>
                        <td className="px-4 py-2">{c.websockets ? "✓" : "—"}</td>
                        <td className="px-4 py-2">{c.max_rps ?? "—"}</td>
                        <td className="px-4 py-2">{c.uptime_pct ? `${c.uptime_pct}%` : "—"}</td>
                        <td className="px-4 py-2">
                          {isSel && (
                            <span className="rounded-full bg-[#3b4cff] px-2 py-0.5 text-xs text-white">
                              selected
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Server-authoritative decision */}
          <DecisionCard decision={d!} approved={approved} reasoning={result.proposal?.reasoning} />
        </div>
      )}
    </div>
  );
}

function TraceView({ result }: { result: Result }) {
  const events: string[] = [];
  for (const s of result.trace) {
    if (s.tool === "list_services") events.push("Listed the curated marketplace");
    else if (s.tool === "check_mandate" && s.input)
      events.push(`Mandate check requested: ${(s.input as { planId?: string }).planId ?? ""}`);
    else if (s.tool === "check_mandate" && s.output) {
      const o = s.output as { approved?: boolean; summary?: string };
      events.push(`Mandate → ${o.approved ? "allowed" : "refused"}: ${o.summary ?? ""}`);
    } else if (s.tool === "recommend" && s.input) {
      const o = s.input as { selected_plan_id?: string | null };
      events.push(`Proposed: ${o.selected_plan_id ?? "none"}`);
    }
  }
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-5">
      <p className="text-xs uppercase tracking-wide text-neutral-500">Decision trace</p>
      <ol className="mt-3 space-y-1.5 text-sm text-neutral-300">
        {events.map((e, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-neutral-600">{i + 1}.</span>
            <span>{e}</span>
          </li>
        ))}
      </ol>
      {result.proposal?.rejected?.length ? (
        <div className="mt-3 border-t border-neutral-800 pt-3 text-xs text-neutral-500">
          {result.proposal.rejected.map((r, i) => (
            <div key={i}>
              Rejected <b className="text-neutral-400">{r.plan_id}</b>: {r.reason}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DecisionCard({
  decision,
  approved,
  reasoning,
}: {
  decision: Decision;
  approved: boolean;
  reasoning?: string;
}) {
  if (!decision.selected_plan_id) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-200">
        <p className="font-medium">No compliant option — nothing purchased.</p>
        {reasoning && <p className="mt-1 text-red-200/90">{reasoning}</p>}
      </div>
    );
  }
  if (!decision.valid) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm text-amber-200">
        The agent proposed an unrecognized plan and was blocked. {decision.note}
      </div>
    );
  }
  if (!approved) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-200">
        <p className="font-medium">Refused by the mandate — no charge.</p>
        <p className="mt-1">{decision.verdict?.summary ?? decision.note}</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-[#3b4cff]/40 bg-[#3b4cff]/10 p-5">
      <p className="text-sm text-neutral-300">Metanoia recommends</p>
      <p className="mt-1 text-lg font-semibold text-neutral-50">
        {decision.plan?.name}{" "}
        <span className="text-neutral-400">· {usd(decision.plan?.price_cents)}/mo</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-400">
        <span>
          Projected monthly <b className="text-neutral-200">{usd(decision.projected_monthly_cents)}</b>
        </span>
        <span>
          Remaining budget <b className="text-neutral-200">{usd(decision.remaining_monthly_cents)}</b>
        </span>
      </div>
      <Link
        href={`/checkout?plan=${decision.selected_plan_id}`}
        className="mt-4 inline-flex rounded-lg bg-[#3b4cff] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f3ddb]"
      >
        Confirm subscription
      </Link>
      <p className="mt-2 text-xs text-neutral-600">
        You confirm; only then does Hyperswitch checkout open. The server re-checks the mandate before charging.
      </p>
    </div>
  );
}
