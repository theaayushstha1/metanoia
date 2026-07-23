import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionCustomerId, ensureSessionCustomerId } from "@/lib/session";
import { snapshotMemory, setConsent, clearMemory } from "@/lib/memory/store";
import { deriveProfile } from "@/lib/memory/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everything Metanoia remembers about the user, plus the derived preference profile. */
export async function GET() {
  const snapshot = await snapshotMemory(await getSessionCustomerId());
  const profile = snapshot.consent ? deriveProfile(snapshot) : null;
  return NextResponse.json({ snapshot, profile });
}

const ConsentSchema = z.object({ granted: z.boolean() });

/** Grant or revoke consent to remember. */
export async function PUT(req: NextRequest) {
  const parsed = ConsentSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Expected { granted: boolean }" }, { status: 400 });
  await setConsent(await ensureSessionCustomerId(), parsed.data.granted);
  return NextResponse.json({ ok: true, granted: parsed.data.granted });
}

/** Forget everything: delete all stored facts/events/sources AND revoke consent. */
export async function DELETE() {
  const customerId = await getSessionCustomerId();
  await clearMemory(customerId);
  await setConsent(customerId, false);
  return NextResponse.json({ ok: true });
}
