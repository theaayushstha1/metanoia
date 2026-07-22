import { CATALOG, type Capability, type Plan } from "@/lib/catalog";
import { getIntentMandate } from "@/lib/store";
import {
  evaluateAgainstConstitution,
  type ConstitutionVerdict,
  type ExistingSubscription,
} from "@/lib/agent/spendCap";

export type RankingPriority = "cost" | "balanced" | "reliability" | "throughput";

export interface NormalizedRequirements {
  max_price_cents?: number | null;
  min_rps?: number | null;
  needs_realtime?: boolean;
  needs_websockets?: boolean;
  required_features?: string[];
  priority?: RankingPriority;
}

export interface RankedPlan {
  plan: Plan;
  score: number;
  eligible: boolean;
  hardFailures: string[];
  verdict: ConstitutionVerdict;
  scoreParts: {
    capabilityFit: number;
    priceEfficiency: number;
    reliability: number;
    throughput: number;
  };
  tradeoff: string;
}

const WEIGHTS: Record<RankingPriority, [number, number, number, number]> = {
  // capability fit, price, reliability, throughput
  cost: [30, 45, 15, 10],
  balanced: [35, 30, 20, 15],
  reliability: [30, 15, 40, 15],
  throughput: [30, 15, 15, 40],
};

const clamp = (n: number) => Math.max(0, Math.min(1, n));

function requiredFeatures(r: NormalizedRequirements): string[] {
  return Array.from(
    new Set([
      ...(r.required_features ?? []),
      ...(r.needs_realtime ? ["realtime_us_equities"] : []),
      ...(r.needs_websockets ? ["websockets"] : []),
    ])
  );
}

function mandateFor(plan: Plan, existing: ExistingSubscription[]): ConstitutionVerdict {
  return evaluateAgainstConstitution({
    intent: getIntentMandate(),
    item: {
      plan_id: plan.id,
      label: plan.name,
      merchant_name: plan.vendor,
      category: plan.category,
      amount_cents: plan.priceCents,
    },
    existing,
  });
}

/**
 * Deterministic ranking layer. The model extracts requirements; this function
 * applies the published math to server-owned catalog data and mandate state.
 * Existing subscriptions are injected (fetched once at the async boundary) so this
 * stays a pure, synchronous function of its inputs.
 */
export function rankPlans(
  capability: Capability,
  requirements: NormalizedRequirements,
  existing: ExistingSubscription[]
): RankedPlan[] {
  const required = requiredFeatures(requirements);
  const priority = requirements.priority ?? "balanced";
  const [fitWeight, priceWeight, reliabilityWeight, throughputWeight] = WEIGHTS[priority];
  const mandate = getIntentMandate();
  const priceCeiling = Math.max(
    1,
    Math.min(
      requirements.max_price_cents ?? Number.MAX_SAFE_INTEGER,
      mandate.policy.per_charge_cap_cents,
      mandate.policy.monthly_cap_cents
    )
  );
  const throughputTarget = Math.max(1, requirements.min_rps ?? 50);

  return CATALOG.filter((plan) => plan.capability === capability)
    .map((plan): RankedPlan => {
      const hardFailures: string[] = [];
      if (requirements.max_price_cents != null && plan.priceCents > requirements.max_price_cents) {
        hardFailures.push(`over requested price by $${((plan.priceCents - requirements.max_price_cents) / 100).toFixed(2)}`);
      }
      if (requirements.min_rps != null && (plan.maxRps ?? 0) < requirements.min_rps) {
        hardFailures.push(`${plan.maxRps ?? 0} req/s is below ${requirements.min_rps}`);
      }
      for (const feature of required) {
        if (!plan.features.includes(feature)) hardFailures.push(`missing ${feature.replace(/_/g, " ")}`);
      }

      const verdict = mandateFor(plan, existing);
      const featureCoverage = required.length
        ? required.filter((feature) => plan.features.includes(feature)).length / required.length
        : clamp(plan.features.length / 4);
      const priceEfficiency = clamp(1 - plan.priceCents / priceCeiling);
      const reliability = clamp(((plan.uptimePct ?? 99) - 99) / 1);
      const throughput = clamp((plan.maxRps ?? 0) / throughputTarget);
      const score = Math.round(
        featureCoverage * fitWeight +
          priceEfficiency * priceWeight +
          reliability * reliabilityWeight +
          throughput * throughputWeight
      );
      const eligible = hardFailures.length === 0 && verdict.approved;
      const mandateFailure = verdict.checks.find((check) => !check.passed)?.detail;
      const tradeoff = hardFailures[0]
        ? hardFailures[0]
        : mandateFailure
          ? mandateFailure
          : plan.bestFor;

      return {
        plan,
        score,
        eligible,
        hardFailures,
        verdict,
        scoreParts: {
          capabilityFit: Math.round(featureCoverage * fitWeight),
          priceEfficiency: Math.round(priceEfficiency * priceWeight),
          reliability: Math.round(reliability * reliabilityWeight),
          throughput: Math.round(throughput * throughputWeight),
        },
        tradeoff,
      };
    })
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || a.plan.priceCents - b.plan.priceCents);
}
