import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAttempt } from "@/lib/store";
import { getPayment } from "@/lib/hyperswitch";
import { getSessionCustomerId, ownsAttempt } from "@/lib/session";

export const runtime = "nodejs";

const BodySchema = z.object({ paymentId: z.string().min(1) });

/**
 * On-demand live status for a single owned payment. One request per click, so a page
 * load never fans out. Reports the real connector/status/error, or a plain
 * "unavailable" when the retrieve fails — never a guessed cause.
 */
export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { paymentId } = parsed.data;

  const [sessionCustomer, attempt] = await Promise.all([getSessionCustomerId(), getAttempt(paymentId)]);
  if (!ownsAttempt(attempt, sessionCustomer)) {
    return NextResponse.json({ error: "Payment not found or not owned." }, { status: 404 });
  }

  try {
    const p = (await getPayment(paymentId)) as {
      status?: string;
      connector?: string;
      amount?: number;
      error_code?: string;
      error_message?: string;
      next_action?: { type?: string };
    };
    return NextResponse.json({
      status: p.status ?? "unknown",
      connector: p.connector ?? "unknown",
      amount: p.amount,
      error_code: p.error_code ?? null,
      error_message: p.error_message ?? null,
      next_action: p.next_action?.type ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "unavailable", detail: e instanceof Error ? e.message : "retrieve failed" },
      { status: 502 }
    );
  }
}
