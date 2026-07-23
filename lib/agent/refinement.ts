import { z } from "zod";
import { CATALOG, getPlan } from "@/lib/catalog";
import type { Proposal } from "@/lib/agent/procure";

export const RefinementModeSchema = z.enum([
  "cheaper",
  "throughput",
  "reliability",
  "different_vendor",
  "custom",
]);

export type RefinementMode = z.infer<typeof RefinementModeSchema>;

export interface ProcurementRefinement {
  mode: RefinementMode;
  feedback: string;
  previousPlanId: string;
}

export interface AppliedRefinement {
  proposal: Proposal;
  excludedPlanIds: string[];
}

/**
 * Convert the refinement shortcuts into deterministic constraints over server-owned
 * catalog data. The model still interprets free-form feedback, but it cannot ignore
 * the four predefined refinement modes.
 */
export function applyProcurementRefinement(
  proposal: Proposal,
  refinement: ProcurementRefinement
): AppliedRefinement {
  const previous = getPlan(refinement.previousPlanId);
  const next: Proposal = {
    ...proposal,
    normalized_requirements: { ...proposal.normalized_requirements },
    considered_plan_ids: [...proposal.considered_plan_ids],
    score_breakdown: [...proposal.score_breakdown],
    rejected: [...proposal.rejected],
    reasoning: `Re-ranked the catalog after the user asked: ${refinement.feedback}. The server enforced the revised constraint before selecting an alternative.`,
  };

  if (!previous || previous.capability !== proposal.requested_capability) {
    return { proposal: next, excludedPlanIds: [] };
  }

  const requirements = next.normalized_requirements;
  const excluded = new Set<string>();

  switch (refinement.mode) {
    case "cheaper": {
      requirements.max_price_cents = Math.min(
        requirements.max_price_cents ?? Number.MAX_SAFE_INTEGER,
        Math.max(0, previous.priceCents - 1)
      );
      requirements.priority = "cost";
      excluded.add(previous.id);
      break;
    }
    case "throughput": {
      requirements.min_rps = Math.max(
        requirements.min_rps ?? 0,
        (previous.maxRps ?? 0) + 1
      );
      requirements.priority = "throughput";
      excluded.add(previous.id);
      break;
    }
    case "reliability": {
      requirements.min_uptime_pct = Math.max(
        requirements.min_uptime_pct ?? 0,
        Math.min(100, (previous.uptimePct ?? 0) + 0.001)
      );
      requirements.priority = "reliability";
      excluded.add(previous.id);
      break;
    }
    case "different_vendor": {
      for (const plan of CATALOG) {
        if (plan.capability === previous.capability && plan.vendor === previous.vendor) {
          excluded.add(plan.id);
        }
      }
      break;
    }
    case "custom": {
      // "Ask again" means produce a genuinely new shortlist. The model interprets
      // the custom constraint while this prevents silently returning the same pick.
      excluded.add(previous.id);
      break;
    }
  }

  return { proposal: next, excludedPlanIds: [...excluded] };
}

export function refinementPrompt(refinement: ProcurementRefinement): string {
  const previous = getPlan(refinement.previousPlanId);
  const previousDescription = previous
    ? `${previous.name} by ${previous.vendor} ($${(previous.priceCents / 100).toFixed(2)}/month, ${previous.maxRps ?? "unknown"} req/s, ${previous.uptimePct ?? "unknown"}% uptime)`
    : refinement.previousPlanId;

  return `REFINEMENT REQUEST
The user already reviewed this recommendation: ${previousDescription}.
Requested change: ${refinement.feedback}
Refinement mode: ${refinement.mode}
Keep the original capability and hard requirements unless the requested change explicitly modifies one. Re-scan the full catalog and recommend a different plan. If no plan satisfies every constraint, return selected_plan_id = null and explain the tradeoff.`;
}
