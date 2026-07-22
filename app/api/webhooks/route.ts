import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { processWebhook } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hyperswitch webhook receiver.
 *
 * Discipline:
 *  - verify HMAC over the RAW body (never re-serialize before checking)
 *  - dedupe by event_id (persisted in the store, survives restarts locally)
 *  - on payment_succeeded, record the subscription (idempotent) with an
 *    out-of-order guard using the resource's updated timestamp
 *  - return 2xx fast
 *
 * CODED to the verified spec; UNTESTED against the live sandbox until
 * HYPERSWITCH_PAYMENT_RESPONSE_HASH_KEY + a connector are configured.
 */
const HASH_KEY = process.env.HYPERSWITCH_PAYMENT_RESPONSE_HASH_KEY ?? "";

function verify(rawBody: string, headerSig: string, algo: "sha512" | "sha256"): boolean {
  if (!HASH_KEY || !headerSig) return false;
  const expected = crypto.createHmac(algo, HASH_KEY).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(headerSig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

type WebhookEvent = {
  event_id?: string;
  event_type?: string;
  content?: { object?: HsPayment };
  object?: HsPayment;
};
type HsPayment = {
  payment_id?: string;
  status?: string;
  payment_method_id?: string;
  updated?: string;
  created?: string;
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text(); // RAW — do not req.json() before verifying

  const sig512 = req.headers.get("x-webhook-signature-512");
  const sig256 = req.headers.get("x-webhook-signature-256");
  const headerSig = sig512 ?? sig256 ?? "";
  const algo = sig512 ? "sha512" : "sha256";

  if (!verify(rawBody, headerSig, algo)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as WebhookEvent;
  const payment = event.content?.object ?? event.object;
  const tsRaw = payment?.updated ?? payment?.created;
  const parsed = tsRaw ? Date.parse(tsRaw) : undefined;
  const updatedAt = parsed === undefined || Number.isNaN(parsed) ? undefined : parsed;

  // Dedupe + settle + subscription upsert happen in ONE transaction. An event for a
  // payment we don't know is retained (not marked processed), never silently dropped.
  const outcome = await processWebhook({
    eventId: event.event_id,
    eventType: event.event_type,
    paymentId: payment?.payment_id,
    paymentMethodId: payment?.payment_method_id,
    updatedAt,
    raw: event,
  });

  if (outcome.duplicate) {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }
  return NextResponse.json({ received: true, applied: outcome.applied }, { status: 200 });
}
