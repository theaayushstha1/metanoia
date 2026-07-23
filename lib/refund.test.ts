import { describe, it, expect, vi } from "vitest";
import { performRefund, type RefundDeps } from "@/lib/refund";
import { stableRefundId } from "@/lib/hyperswitch";

const PID = "pay_" + "a".repeat(26);

function deps(over: Partial<RefundDeps> = {}): RefundDeps {
  return {
    owned: true,
    getPayment: vi.fn(async () => ({ status: "succeeded", amount: 2900, currency: "USD" })),
    createRefund: vi.fn(async (p) => ({ refund_id: p.refundId, status: "pending", amount: p.amount })),
    getRefund: vi.fn(async (id) => ({ refund_id: id, status: "succeeded", amount: 2900 })),
    recordRefund: vi.fn(async () => {}),
    now: () => 1000,
    ...over,
  };
}

describe("performRefund", () => {
  it("refuses a payment the session does not own (403), without calling the connector", async () => {
    const d = deps({ owned: false });
    const r = await performRefund(PID, d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(403);
    expect(d.getPayment).not.toHaveBeenCalled();
    expect(d.createRefund).not.toHaveBeenCalled();
  });

  it("refuses a non-succeeded payment (409) and never creates a refund", async () => {
    const d = deps({ getPayment: vi.fn(async () => ({ status: "failed", amount: 2900 })) });
    const r = await performRefund(PID, d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(409);
    expect(d.createRefund).not.toHaveBeenCalled();
    expect(d.recordRefund).not.toHaveBeenCalled();
  });

  it("is idempotent: repeat refunds resolve to the same deterministic refund_id", async () => {
    const d = deps();
    const r1 = await performRefund(PID, d);
    const r2 = await performRefund(PID, d);
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok && r2.ok) expect(r1.refundId).toBe(r2.refundId);
    // Both calls used the same merchant-supplied refund id (the idempotency key).
    const calls = (d.createRefund as unknown as { mock: { calls: [{ refundId: string }][] } }).mock.calls;
    expect(calls[0][0].refundId).toBe(stableRefundId(PID));
    expect(calls[1][0].refundId).toBe(stableRefundId(PID));
  });

  it("reports the AUTHORITATIVE retrieved status, not the create response", async () => {
    const d = deps({
      createRefund: vi.fn(async (p) => ({ refund_id: p.refundId, status: "pending", amount: p.amount })),
      getRefund: vi.fn(async (id) => ({ refund_id: id, status: "succeeded", amount: 2900 })),
    });
    const r = await performRefund(PID, d);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.status).toBe("succeeded"); // from getRefund, not the "pending" create
    expect(d.getRefund).toHaveBeenCalledWith(stableRefundId(PID));
    // Persisted with the authoritative status so it survives a reload.
    expect(d.recordRefund).toHaveBeenCalledWith(expect.objectContaining({ status: "succeeded", paymentId: PID }));
  });
});
