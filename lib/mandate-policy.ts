import { z } from "zod";

export const EditableMandateSchema = z
  .object({
    monthly_cap_cents: z.number().int().min(3000).max(20000).multipleOf(500),
    per_charge_cap_cents: z.number().int().min(500).max(10000).multipleOf(500),
    max_active_subscriptions: z.number().int().min(1).max(10),
  })
  .refine((policy) => policy.per_charge_cap_cents <= policy.monthly_cap_cents, {
    message: "Per-purchase cap cannot exceed the monthly budget.",
    path: ["per_charge_cap_cents"],
  });

export type EditableMandate = z.infer<typeof EditableMandateSchema>;

export const DEFAULT_EDITABLE_MANDATE: EditableMandate = {
  monthly_cap_cents: 6000,
  per_charge_cap_cents: 4000,
  max_active_subscriptions: 3,
};

