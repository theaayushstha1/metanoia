/**
 * Metanoia's procurement agent (Gemini on Vertex).
 *
 * The model RESEARCHES and PROPOSES; the server DECIDES. The model lists services
 * (with structured attributes), compares them, and proposes one plan. The server
 * then authoritatively re-checks plan existence, current price, and the mandate
 * (SpendGuard) — the model can never supply an amount, verdict, or budget number.
 *
 * No payment function is reachable from here: research/proposal cannot spend.
 */
import { generateText, tool, stepCountIs, hasToolCall } from "ai";
import { z } from "zod";
import { agentModel } from "@/lib/agent/model";
import { CATALOG, getPlan, type Plan } from "@/lib/catalog";
import { getIntentMandate, getSubscriptions } from "@/lib/store";
import { evaluateAgainstConstitution, type ConstitutionVerdict } from "@/lib/agent/spendCap";
import type { CartItem } from "@/lib/ap2/mandate";

/** The model's structured proposal (validated by Zod at the tool boundary). */
export const ProposalSchema = z.object({
  requested_capability: z.string(),
  normalized_requirements: z.object({
    max_price_cents: z.number().int().nullable().optional(),
    min_rps: z.number().int().nullable().optional(),
    needs_realtime: z.boolean().optional(),
    needs_websockets: z.boolean().optional(),
  }),
  considered_plan_ids: z.array(z.string()),
  selected_plan_id: z.string().nullable(),
  score_breakdown: z.array(
    z.object({ plan_id: z.string(), meets_requirements: z.boolean(), note: z.string() })
  ),
  rejected: z.array(z.object({ plan_id: z.string(), reason: z.string() })),
  reasoning: z.string(),
});
export type Proposal = z.infer<typeof ProposalSchema>;

/** Server-authoritative decision computed AFTER the model proposes. */
export interface Decision {
  selected_plan_id: string | null;
  valid: boolean; // false if the model proposed an unknown/hallucinated plan
  plan?: { id: string; name: string; vendor: string; price_cents: number };
  verdict?: ConstitutionVerdict;
  projected_monthly_cents?: number;
  remaining_monthly_cents?: number;
  confirmation_required: boolean;
  note?: string;
}

export interface TraceStep {
  tool?: string;
  input?: unknown;
  output?: unknown;
}

export interface ProcurementResult {
  proposal: Proposal | null;
  decision: Decision;
  trace: TraceStep[];
}

function serviceView(p: Plan) {
  return {
    id: p.id,
    vendor: p.vendor,
    capability: p.capability,
    price_cents: p.priceCents,
    billing: p.billing,
    real_time: p.features.includes("realtime_us_equities"),
    websockets: p.features.includes("websockets"),
    features: p.features,
    max_rps: p.maxRps,
    uptime_pct: p.uptimePct,
    resource: p.resource,
  };
}

const SYSTEM = `You are Metanoia, an autonomous procurement agent for a software team.
The user names a capability they need plus hard constraints (price, throughput, features).
A spending mandate ALSO constrains you and must never be violated.

Procedure:
1. Call list_services to see the curated marketplace with structured attributes
   (price_cents, real_time, websockets, max_rps, uptime_pct).
2. Filter to the requested capability and keep only plans meeting ALL hard requirements.
3. Among those, prefer the lowest price that fully satisfies the requirements (not the
   cheapest overall, not the most expensive) unless the user explicitly asks for top quality.
4. Call check_mandate on your top pick. If refused, drop it and take the next best that passes.
5. Call recommend EXACTLY ONCE with the full structured proposal. Use integer cents from
   list_services for any amounts — never invent prices. If nothing qualifies, selected_plan_id = null.`;

export async function runProcurement(
  request: string,
  customerId = "metanoia_demo_customer"
): Promise<ProcurementResult> {
  let proposal: Proposal | null = null;
  const trace: TraceStep[] = [];

  const tools = {
    list_services: tool({
      description:
        "List the curated marketplace of onboarded vendors with structured, comparable attributes.",
      inputSchema: z.object({
        capability: z
          .enum(["market-data", "news", "vector-search", "geocoding", "compute"])
          .nullable()
          .optional(),
      }),
      execute: async ({ capability }) =>
        CATALOG.filter((p) => !capability || p.capability === capability).map(serviceView),
    }),

    check_mandate: tool({
      description:
        "Authoritatively check whether subscribing to a plan is allowed by the spending mandate. Uses server-side pricing.",
      inputSchema: z.object({ planId: z.string() }),
      execute: async ({ planId }) => {
        const plan = getPlan(planId);
        if (!plan) return { approved: false, summary: `Unknown plan ${planId}` };
        return { approved: evaluateForPlan(plan, customerId).approved, summary: evaluateForPlan(plan, customerId).summary };
      },
    }),

    recommend: tool({
      description: "Submit your final structured proposal. Call exactly once.",
      inputSchema: ProposalSchema,
      execute: async (p) => {
        proposal = p;
        return { received: true };
      },
    }),
  };

  const result = await generateText({
    model: agentModel(),
    system: SYSTEM,
    prompt: request,
    tools,
    stopWhen: [hasToolCall("recommend"), stepCountIs(8)],
  });

  for (const step of result.steps) {
    for (const call of step.toolCalls ?? []) trace.push({ tool: call.toolName, input: call.input });
    for (const res of step.toolResults ?? []) trace.push({ tool: res.toolName, output: res.output });
  }

  return { proposal, decision: decide(proposal, customerId), trace };
}

function evaluateForPlan(plan: Plan, customerId: string): ConstitutionVerdict {
  const item: CartItem = {
    plan_id: plan.id,
    label: plan.name,
    merchant_name: plan.vendor,
    category: plan.category,
    amount_cents: plan.priceCents,
  };
  return evaluateAgainstConstitution({
    intent: getIntentMandate(),
    item,
    existing: getSubscriptions(customerId),
  });
}

/** Server-authoritative decision — never trusts the model for amount/verdict. */
export function decide(proposal: Proposal | null, customerId: string): Decision {
  const selected = proposal?.selected_plan_id ?? null;
  if (!selected) {
    return { selected_plan_id: null, valid: true, confirmation_required: false, note: "No plan selected." };
  }
  const plan = getPlan(selected);
  if (!plan) {
    // Hallucinated / unknown plan id -> fail safe.
    return {
      selected_plan_id: selected,
      valid: false,
      confirmation_required: false,
      note: `Proposed unknown plan "${selected}".`,
    };
  }
  const verdict = evaluateForPlan(plan, customerId);
  const committed = getSubscriptions(customerId).reduce((s, e) => s + e.amount_cents, 0);
  const projected = committed + plan.priceCents;
  return {
    selected_plan_id: selected,
    valid: true,
    plan: { id: plan.id, name: plan.name, vendor: plan.vendor, price_cents: plan.priceCents },
    verdict,
    projected_monthly_cents: projected,
    remaining_monthly_cents: getIntentMandate().policy.monthly_cap_cents - projected,
    confirmation_required: verdict.approved, // require explicit human confirm before any charge
    note: verdict.approved ? undefined : verdict.summary,
  };
}
