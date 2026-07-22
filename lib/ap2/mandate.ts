/**
 * AP2 mandate shapes (modeled on google-agentic-commerce/AP2), re-expressed in
 * TypeScript/Zod. We keep AP2's snake_case field names so the objects serialize
 * exactly like the real spec.
 *
 * We do NOT call Google's AP2 service — these are the authorization envelopes we
 * construct and enforce app-side. The `policy` block on the Intent Mandate is
 * our extension: a "Spending Constitution" richer than a flat cap.
 */
import { z } from "zod";

/** Our extension: the rich spend policy the buyer-agent cannot violate. */
export const SpendPolicySchema = z.object({
  monthly_cap_cents: z.number().int().nonnegative(),
  per_charge_cap_cents: z.number().int().nonnegative(),
  allowed_categories: z.array(z.string()).optional(),
  allowed_merchants: z.array(z.string()).optional(),
  max_active_subscriptions: z.number().int().positive().optional(),
});
export type SpendPolicy = z.infer<typeof SpendPolicySchema>;

/** AP2 Intent Mandate — the human's standing instruction + our policy. */
export const IntentMandateSchema = z.object({
  user_cart_confirmation_required: z.boolean().default(true),
  natural_language_description: z.string(),
  merchants: z.array(z.string()).optional(),
  skus: z.array(z.string()).optional(),
  requires_refundability: z.boolean().optional().default(false),
  intent_expiry: z.string(), // ISO 8601
  policy: SpendPolicySchema, // extension
});
export type IntentMandate = z.infer<typeof IntentMandateSchema>;

/** A single line in the cart the agent assembled. */
export const CartItemSchema = z.object({
  plan_id: z.string(),
  label: z.string(),
  merchant_name: z.string(),
  category: z.string(),
  amount_cents: z.number().int().nonnegative(),
});
export type CartItem = z.infer<typeof CartItemSchema>;

/** AP2 Cart Mandate — the specific, locked purchase awaiting confirmation. */
export const CartMandateSchema = z.object({
  contents: z.object({
    id: z.string(),
    user_cart_confirmation_required: z.boolean(),
    items: z.array(CartItemSchema),
    total_cents: z.number().int().nonnegative(),
    currency: z.string().default("USD"),
    cart_expiry: z.string(),
    merchant_name: z.string(),
  }),
  // In real AP2 this is a base64url JWT over a cart hash; we stub it, same shape.
  merchant_authorization: z.string().optional(),
});
export type CartMandate = z.infer<typeof CartMandateSchema>;

export const AP2_KEYS = {
  intent: "ap2.mandates.IntentMandate",
  cart: "ap2.mandates.CartMandate",
} as const;
