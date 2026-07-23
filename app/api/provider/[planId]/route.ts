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
  const owner = await resolveCredential(key);
  if (!owner || owner.planId !== planId) {
    return NextResponse.json({ error: "invalid or missing API credential" }, { status: 401 });
  }

  return NextResponse.json({
    provider: plan.vendor,
    capability: plan.capability,
    data: sample(plan),
  });
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/**
 * Sandbox provider data. This is synthetic — the vendors are fictional — but it is
 * generated live on every call (a fresh random walk each request) so what the agent
 * sees is a moving feed, not a frozen constant. The ticker is stable per plan so a
 * given vendor always streams the same instrument.
 */
function sample(plan: Plan): unknown {
  const now = new Date().toISOString();
  switch (plan.capability) {
    case "market-data": {
      const basket: [string, number][] = [
        ["NVDA", 178.2],
        ["AAPL", 231.4],
        ["MSFT", 429.6],
        ["SPY", 567.3],
        ["AMD", 162.8],
        ["GOOGL", 191.5],
      ];
      const [symbol, base] = basket[hash(plan.id) % basket.length];
      const series: number[] = [];
      let v = base * (1 - 0.005 + Math.random() * 0.006);
      for (let i = 0; i < 16; i++) {
        v += (Math.random() - 0.48) * base * 0.0014;
        series.push(round2(v));
      }
      const price = series[series.length - 1];
      const open = series[0];
      const change = round2(price - open);
      const spread = Math.max(0.01, round2(price * 0.00009));
      return {
        symbol,
        currency: "USD",
        price,
        open,
        change,
        change_pct: round2((change / open) * 100),
        bid: round2(price - spread),
        ask: round2(price + spread),
        series,
        as_of: now,
      };
    }
    case "news": {
      const pool = [
        "Fed holds rates steady as inflation cools",
        "Chipmakers rally on sustained AI demand",
        "Treasury yields dip after jobs report",
        "Cloud spending accelerates into Q3",
        "Energy sector leads afternoon gains",
        "Dollar softens against major currencies",
      ];
      const start = hash(plan.id + now.slice(0, 15)) % pool.length;
      const headlines = [0, 1, 2].map((i) => pool[(start + i) % pool.length]);
      return { headlines, as_of: now };
    }
    case "vector-search": {
      const seed = hash(plan.id + now.slice(0, 15));
      const matches = [0, 1, 2].map((i) => ({
        id: `doc_${((seed + i * 37) % 900) + 100}`,
        score: round2(0.94 - i * 0.11 - (Math.random() * 0.03)),
      }));
      return { query: "quarterly earnings summary", matches, as_of: now };
    }
    case "geocoding":
      return { query: "1600 Amphitheatre Pkwy", lat: 37.4224, lng: -122.0842, as_of: now };
    case "compute": {
      const regions = ["us-east", "us-west", "eu-central"];
      return {
        gpus_available: 5 + (hash(now.slice(0, 16)) % 8),
        region: regions[hash(plan.id) % regions.length],
        as_of: now,
      };
    }
    case "transcription":
      return { text: "Your appointment is confirmed for Tuesday at 3 PM.", confidence: 0.98, words: 8, as_of: now };
    default:
      return { ok: true, as_of: now };
  }
}
