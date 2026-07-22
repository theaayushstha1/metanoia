import { NextRequest, NextResponse } from "next/server";
import { getPlan, type Plan } from "@/lib/catalog";
import { resolveCredential } from "@/lib/store";

export const runtime = "nodejs";

/**
 * Mock provider API. Stands in for the third-party service the agent just bought.
 * It returns real data ONLY when presented the credential issued on a completed
 * purchase — so "the agent buys a capability and immediately uses it" is genuinely
 * end-to-end, not narrated.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ planId: string }> }) {
  const { planId } = await ctx.params;
  const plan = getPlan(planId);
  if (!plan) return NextResponse.json({ error: "unknown provider" }, { status: 404 });

  const key = req.headers.get("x-api-key") ?? "";
  const owner = resolveCredential(key);
  if (!owner || owner.planId !== planId) {
    return NextResponse.json({ error: "invalid or missing API credential" }, { status: 401 });
  }

  return NextResponse.json({
    provider: plan.vendor,
    capability: plan.capability,
    data: sample(plan),
  });
}

function sample(plan: Plan): unknown {
  const now = new Date().toISOString();
  switch (plan.capability) {
    case "market-data":
      return { symbol: "AAPL", price: 231.42, bid: 231.4, ask: 231.44, as_of: now };
    case "news":
      return { headlines: ["Fed holds rates steady", "Chips rally on AI demand"], as_of: now };
    case "vector-search":
      return { matches: [{ id: "doc_12", score: 0.91 }], as_of: now };
    case "geocoding":
      return { query: "1600 Amphitheatre Pkwy", lat: 37.4224, lng: -122.0842, as_of: now };
    case "compute":
      return { gpus_available: 8, region: "us-east", as_of: now };
    default:
      return { ok: true, as_of: now };
  }
}
