/**
 * The Spending Constitution — the gate that makes it safe to hand an agent a card.
 *
 * Every autonomous purchase is checked against the Intent Mandate's policy BEFORE
 * any money moves. A denial is a first-class, explainable outcome (not an error):
 * the UI shows the agent's cart being *refused*, which is the whole trust story.
 *
 * This mirrors the "grounding gate" pattern from CS Navigator: the model proposes,
 * a deterministic gate authorizes, and nothing unverified gets through.
 */
import type { CartItem, IntentMandate, SpendPolicy } from "@/lib/ap2/mandate";

export interface ExistingSubscription {
  plan_id: string;
  merchant_name: string;
  category: string;
  amount_cents: number;
}

export type RuleId =
  | "per_charge_cap"
  | "monthly_cap"
  | "category_allowlist"
  | "merchant_allowlist"
  | "max_subscriptions"
  | "mandate_expired";

export interface RuleResult {
  rule: RuleId;
  passed: boolean;
  detail: string;
}

export interface ConstitutionVerdict {
  approved: boolean;
  /** Every rule evaluated, in order — the UI renders these as the audit trail. */
  checks: RuleResult[];
  /** Human-readable summary the agent narrates. */
  summary: string;
  /** Remaining monthly headroom after this purchase (can be negative if denied). */
  remaining_after_cents: number;
}

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Evaluate a proposed cart item against the policy + current commitments.
 * Pure and deterministic — easy to unit test and to show live.
 */
export function evaluateAgainstConstitution(params: {
  intent: IntentMandate;
  item: CartItem;
  existing: ExistingSubscription[];
  now?: Date;
}): ConstitutionVerdict {
  const { intent, item, existing } = params;
  const policy: SpendPolicy = intent.policy;
  const now = params.now ?? new Date();

  const committedMonthly = existing.reduce((s, e) => s + e.amount_cents, 0);
  const checks: RuleResult[] = [];

  // 1. Mandate not expired
  const expired = new Date(intent.intent_expiry).getTime() < now.getTime();
  checks.push({
    rule: "mandate_expired",
    passed: !expired,
    detail: expired
      ? `Mandate expired ${intent.intent_expiry}`
      : `Mandate valid until ${intent.intent_expiry}`,
  });

  // 2. Per-charge cap
  const perOk = item.amount_cents <= policy.per_charge_cap_cents;
  checks.push({
    rule: "per_charge_cap",
    passed: perOk,
    detail: `${usd(item.amount_cents)} vs per-charge cap ${usd(policy.per_charge_cap_cents)}`,
  });

  // 3. Monthly cap (committed + this item)
  const projected = committedMonthly + item.amount_cents;
  const monthlyOk = projected <= policy.monthly_cap_cents;
  checks.push({
    rule: "monthly_cap",
    passed: monthlyOk,
    detail: `${usd(projected)} projected vs monthly cap ${usd(policy.monthly_cap_cents)}`,
  });

  // 4. Category allowlist
  if (policy.allowed_categories?.length) {
    const ok = policy.allowed_categories.includes(item.category);
    checks.push({
      rule: "category_allowlist",
      passed: ok,
      detail: ok
        ? `"${item.category}" is allowed`
        : `"${item.category}" not in allowlist`,
    });
  }

  // 5. Merchant allowlist
  if (policy.allowed_merchants?.length) {
    const ok = policy.allowed_merchants.includes(item.merchant_name);
    checks.push({
      rule: "merchant_allowlist",
      passed: ok,
      detail: ok
        ? `${item.merchant_name} is allowed`
        : `${item.merchant_name} not in allowlist`,
    });
  }

  // 6. Max active subscriptions
  if (policy.max_active_subscriptions != null) {
    const alreadyHas = existing.some((e) => e.plan_id === item.plan_id);
    const count = existing.length + (alreadyHas ? 0 : 1);
    const ok = count <= policy.max_active_subscriptions;
    checks.push({
      rule: "max_subscriptions",
      passed: ok,
      detail: `${count} vs max ${policy.max_active_subscriptions}`,
    });
  }

  const approved = checks.every((c) => c.passed);
  const failed = checks.filter((c) => !c.passed);
  const summary = approved
    ? `Approved: ${item.label} at ${usd(item.amount_cents)}/mo fits the mandate.`
    : `Refused: ${failed.map((f) => f.rule.replace(/_/g, " ")).join(", ")}. ${failed[0]?.detail}.`;

  return {
    approved,
    checks,
    summary,
    remaining_after_cents: policy.monthly_cap_cents - projected,
  };
}
