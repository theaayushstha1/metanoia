import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAttempt, recordRefund } from "@/lib/store";
import { getPayment, createRefund, getRefund } from "@/lib/hyperswitch";
import { getSessionCustomerId, ownsAttempt } from "@/lib/session";
import { performRefund } from "@/lib/refund";

export const runtime = "nodejs";

const BodySchema = z.object({ paymentId: z.string().min(1), confirm: z.literal(true) });

/**
 * Server-side refund for the payment test lab. Ownership is by SESSION (only the
 * visitor who created the payment can refund it), the request must carry an explicit
 * confirmation, and the refund is idempotent + verified by retrieval. No card data.
 */
export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Confirmation required." }, { status: 400 });
  }
  const { paymentId } = parsed.data;

  // Session ownership: only the browser session that created this payment may refund it.
  const [sessionCustomer, attempt] = await Promise.all([getSessionCustomerId(), getAttempt(paymentId)]);
  const owned = ownsAttempt(attempt, sessionCustomer);

  const result = await performRefund(paymentId, {
    owned,
    getPayment,
    createRefund,
    getRefund,
    recordRefund,
  }).catch((e): { ok: false; code: number; error: string } => ({
    ok: false,
    code: 502,
    error: e instanceof Error ? e.message : "Refund failed",
  }));

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.code });
  }
  return NextResponse.json({ refund_id: result.refundId, status: result.status, amount: result.amountCents });
}
