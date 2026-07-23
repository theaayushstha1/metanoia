/**
 * Refund orchestration, dependency-injected so it is testable without the network.
 * Guardrails, in order:
 *  - OWNED: the caller's session must own the payment (checked by the route, passed in).
 *  - SUCCEEDED: retrieve the live payment; refuse unless it succeeded.
 *  - IDEMPOTENT: a deterministic refund_id means repeats resolve to the same refund.
 *  - AUTHORITATIVE: the returned status comes from retrieving the refund, not creating it.
 *  - PERSISTED: the verified refund is written so it survives a page reload.
 */
import { stableRefundId, type RefundResponse } from "@/lib/hyperswitch";
import type { RefundRecord } from "@/lib/db/store-contract";

export interface RefundDeps {
  owned: boolean;
  getPayment(paymentId: string): Promise<{ status: string; amount: number; currency?: string }>;
  createRefund(p: { paymentId: string; amount: number; refundId: string }): Promise<RefundResponse>;
  getRefund(refundId: string): Promise<RefundResponse>;
  recordRefund(r: RefundRecord): Promise<void>;
  now?: () => number;
}

export type RefundResult =
  | { ok: false; code: number; error: string }
  | { ok: true; refundId: string; status: string; amountCents: number };

export async function performRefund(paymentId: string, deps: RefundDeps): Promise<RefundResult> {
  if (!deps.owned) {
    return { ok: false, code: 403, error: "You can only refund a payment you made." };
  }

  const payment = await deps.getPayment(paymentId);
  if (payment.status !== "succeeded") {
    return { ok: false, code: 409, error: `Only a succeeded payment can be refunded (status: ${payment.status}).` };
  }

  const refundId = stableRefundId(paymentId);
  await deps.createRefund({ paymentId, amount: payment.amount, refundId });
  const verified = await deps.getRefund(refundId); // authoritative status, not the create response

  const record: RefundRecord = {
    paymentId,
    refundId: verified.refund_id ?? refundId,
    status: verified.status ?? "pending",
    amountCents: verified.amount ?? payment.amount,
    updatedAt: (deps.now ?? Date.now)(),
  };
  await deps.recordRefund(record);
  return { ok: true, refundId: record.refundId, status: record.status, amountCents: record.amountCents };
}
