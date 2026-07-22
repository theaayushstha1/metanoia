import { NextResponse } from "next/server";
import { DEMO_CUSTOMER } from "@/lib/constants";
import { buildPreferenceProfile, generateAboutBlurb } from "@/lib/memory/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * The hybrid's warm "about you" line. Its own endpoint so the LLM call happens only
 * when the memory panel asks for it — never on the procurement hot path.
 */
export async function GET() {
  const profile = await buildPreferenceProfile(DEMO_CUSTOMER);
  const blurb = await generateAboutBlurb(profile);
  return NextResponse.json({ blurb });
}
