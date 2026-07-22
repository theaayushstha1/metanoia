/**
 * Demo state store: the mandate, payment attempts, resulting subscriptions, and
 * processed webhook events.
 *
 * Persistence: JSON file under `.data/` so state survives restarts (local dev).
 * On a read-only serverless FS the write silently falls back to in-memory; a real
 * deployment would use Redis/Postgres/Vercel KV. Under vitest we stay in-memory.
 *
 * Subscriptions are ONLY recorded after a verified `succeeded` payment (via the
 * webhook or an authoritative payment retrieval), never at intent-creation time.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { IntentMandate } from "@/lib/ap2/mandate";
import type { ExistingSubscription } from "@/lib/agent/spendCap";
import { getPlan } from "@/lib/catalog";

const IN_TEST = Boolean(process.env.VITEST);
const DATA_DIR = process.env.METANOIA_DATA_DIR ?? path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

export interface Attempt {
  paymentId: string;
  customerId: string;
  planId: string;
  amountCents: number;
  status: "pending" | "succeeded" | "failed";
  paymentMethodId?: string;
  updatedAt: number;
}

interface StoreShape {
  subscriptions: Record<string, ExistingSubscription[]>;
  attempts: Record<string, Attempt>;
  seenEvents: Record<string, number>;
  paymentEventTs: Record<string, number>; // paymentId -> last applied event ts (out-of-order guard)
  credentials: Record<string, { customerId: string; planId: string }>; // credential -> owner
}

function empty(): StoreShape {
  return { subscriptions: {}, attempts: {}, seenEvents: {}, paymentEventTs: {}, credentials: {} };
}

function load(): StoreShape {
  if (IN_TEST) return empty();
  try {
    return { ...empty(), ...(JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as StoreShape) };
  } catch {
    return empty();
  }
}

let state: StoreShape = load();

function save(): void {
  if (IN_TEST) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(state));
  } catch {
    // read-only FS (serverless): keep in-memory, don't crash.
  }
}

/** The default mandate a user grants the agent. Expiry is always 30 days out. */
export function getIntentMandate(): IntentMandate {
  return {
    user_cart_confirmation_required: true,
    natural_language_description:
      "Keep me subscribed to the API/data tools I need to run my product, under budget.",
    requires_refundability: false,
    intent_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    policy: {
      monthly_cap_cents: 6000, // $60/mo total
      per_charge_cap_cents: 4000, // no single plan over $40/mo
      // No category allowlist on the default mandate; refusals here come from the
      // per-charge and monthly caps. (Allowlist logic is covered by unit tests.)
      allowed_categories: undefined,
      max_active_subscriptions: 3,
    },
  };
}

export function getSubscriptions(customerId: string): ExistingSubscription[] {
  return state.subscriptions[customerId] ?? [];
}

function addSubscription(customerId: string, sub: ExistingSubscription): void {
  const list = state.subscriptions[customerId] ?? [];
  const idx = list.findIndex((s) => s.plan_id === sub.plan_id);
  if (idx >= 0) list[idx] = sub; // upsert: a renewal at a new price updates the amount
  else list.push(sub);
  state.subscriptions[customerId] = list;
}

/** Record a pending checkout attempt. Idempotent by paymentId. */
export function recordAttempt(a: {
  paymentId: string;
  customerId: string;
  planId: string;
  amountCents: number;
}): void {
  if (!state.attempts[a.paymentId]) {
    state.attempts[a.paymentId] = { ...a, status: "pending", updatedAt: Date.now() };
    save();
  }
}

export function getAttempt(paymentId: string): Attempt | undefined {
  return state.attempts[paymentId];
}

/**
 * Idempotently mark a payment succeeded and record its subscription.
 * `updatedAt` guards against out-of-order webhook delivery.
 */
export function markPaymentSucceeded(
  paymentId: string,
  opts?: { updatedAt?: number; paymentMethodId?: string }
): void {
  const attempt = state.attempts[paymentId];
  if (!attempt) return; // unknown payment id — ignore
  const ts = opts?.updatedAt ?? Date.now();
  if ((state.paymentEventTs[paymentId] ?? 0) > ts) return; // stale (out-of-order) event
  state.paymentEventTs[paymentId] = ts;

  if (attempt.status !== "succeeded") {
    attempt.status = "succeeded";
    if (opts?.paymentMethodId) attempt.paymentMethodId = opts.paymentMethodId;
    const plan = getPlan(attempt.planId);
    if (plan) {
      addSubscription(attempt.customerId, {
        plan_id: plan.id,
        merchant_name: plan.vendor,
        category: plan.category,
        amount_cents: attempt.amountCents, // the amount actually authorized, not a later catalog price
      });
      issueCredential(attempt.customerId, plan.id); // the capability is now usable
    }
  } else if (opts?.paymentMethodId) {
    attempt.paymentMethodId = opts.paymentMethodId;
  }
  save();
}

/** Saved payment method for renewals of a given subscription, if any. */
export function getSavedPaymentMethod(customerId: string, planId: string): string | undefined {
  return Object.values(state.attempts).find(
    (a) => a.customerId === customerId && a.planId === planId && a.status === "succeeded" && a.paymentMethodId
  )?.paymentMethodId;
}

/** Issue (idempotently) an API credential scoping the purchased capability. */
function issueCredential(customerId: string, planId: string): string {
  const existing = getCredential(customerId, planId);
  if (existing) return existing;
  const cred =
    "key_" + crypto.createHash("sha256").update(`${customerId}:${planId}`).digest("hex").slice(0, 32);
  state.credentials[cred] = { customerId, planId };
  return cred;
}

/** The credential a customer holds for a purchased plan, if any. */
export function getCredential(customerId: string, planId: string): string | undefined {
  return Object.entries(state.credentials).find(
    ([, v]) => v.customerId === customerId && v.planId === planId
  )?.[0];
}

/** Resolve a credential presented to the mock provider API. */
export function resolveCredential(cred: string): { customerId: string; planId: string } | undefined {
  return state.credentials[cred];
}

export function seenEvent(eventId: string): boolean {
  return eventId in state.seenEvents;
}

export function markEvent(eventId: string): void {
  state.seenEvents[eventId] = Date.now();
  save();
}

/** Test-only: clear all state. */
export function __resetStore(): void {
  state = empty();
}
