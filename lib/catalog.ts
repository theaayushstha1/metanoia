/**
 * A curated marketplace of onboarded API/infra vendors.
 *
 * Honest boundary: Hyperswitch settles recurring fiat for vendors that have been
 * onboarded to a connector — it can't pay an arbitrary URL. So the agent shops a
 * curated marketplace here. Real open discovery would come later from x402 Bazaar
 * / UCP-compatible sellers (pay-per-call), with Hyperswitch handling the recurring
 * fiat side.
 *
 * Prices are monthly, integer cents. Multiple providers per capability so the
 * agent actually has offers to compare.
 */

export type Capability = "market-data" | "news" | "vector-search" | "geocoding" | "compute";

export interface Plan {
  id: string;
  name: string;
  vendor: string;
  capability: Capability;
  /** Human-readable category label. */
  category: string;
  priceCents: number;
  billing: "monthly";
  /** Machine-checkable feature flags the agent matches against constraints. */
  features: string[];
  maxRps?: number;
  uptimePct?: number;
  blurb: string;
  /** The resource the credential unlocks (our mock provider serves it). */
  resource: string;
}

export const CATALOG: Plan[] = [
  // --- market-data: three competing offers ---
  {
    id: "quotestream_basic",
    name: "QuoteStream Basic",
    vendor: "QuoteStream",
    capability: "market-data",
    category: "Financial data API",
    priceCents: 1900,
    billing: "monthly",
    features: ["realtime_us_equities"],
    maxRps: 30,
    uptimePct: 99.5,
    blurb: "Real-time US equities via REST polling. No websockets.",
    resource: "/api/provider/quotestream_basic",
  },
  {
    id: "tickstream_pro",
    name: "TickStream Pro",
    vendor: "TickStream",
    capability: "market-data",
    category: "Financial data API",
    priceCents: 2900,
    billing: "monthly",
    features: ["realtime_us_equities", "websockets"],
    maxRps: 60,
    uptimePct: 99.9,
    blurb: "Real-time equities + crypto, websocket streams, 60 req/s.",
    resource: "/api/provider/tickstream_pro",
  },
  {
    id: "realtime_ultra",
    name: "Realtime Markets Ultra",
    vendor: "Realtime Markets",
    capability: "market-data",
    category: "Financial data API",
    priceCents: 4900,
    billing: "monthly",
    features: ["realtime_us_equities", "websockets", "options_chains"],
    maxRps: 120,
    uptimePct: 99.99,
    blurb: "Premium: equities, options chains, 120 req/s, 99.99% uptime.",
    resource: "/api/provider/realtime_ultra",
  },
  // --- other capabilities ---
  {
    id: "newsfeed_ai",
    name: "NewsFeed AI",
    vendor: "Brief",
    capability: "news",
    category: "News + summarization API",
    priceCents: 1500,
    billing: "monthly",
    features: ["dedup", "llm_summaries"],
    maxRps: 20,
    uptimePct: 99.9,
    blurb: "Deduplicated global news with on-call LLM summaries.",
    resource: "/api/provider/newsfeed_ai",
  },
  {
    id: "vector_search",
    name: "Vector Search Cloud",
    vendor: "Nexus",
    capability: "vector-search",
    category: "Retrieval / embeddings API",
    priceCents: 3900,
    billing: "monthly",
    features: ["hybrid_search", "5m_vectors"],
    maxRps: 100,
    uptimePct: 99.9,
    blurb: "Hosted vector DB, 5M vectors, hybrid search.",
    resource: "/api/provider/vector_search",
  },
  {
    id: "geocode_lite",
    name: "Geocode Lite",
    vendor: "Atlas",
    capability: "geocoding",
    category: "Maps / geocoding API",
    priceCents: 900,
    billing: "monthly",
    features: ["forward", "reverse"],
    maxRps: 50,
    uptimePct: 99.5,
    blurb: "Forward + reverse geocoding, 100k calls/mo.",
    resource: "/api/provider/geocode_lite",
  },
  {
    // Priced above the $40 per-charge cap on purpose: demonstrates the mandate
    // REFUSING an over-budget purchase even when it meets the capability.
    id: "compute_cluster",
    name: "Compute Cluster Pro",
    vendor: "Forge",
    capability: "compute",
    category: "GPU compute API",
    priceCents: 5900,
    billing: "monthly",
    features: ["gpu_a100", "autoscaling"],
    maxRps: 1000,
    uptimePct: 99.9,
    blurb: "On-demand A100 pool, autoscaling, per-second billing.",
    resource: "/api/provider/compute_cluster",
  },
];

export function getPlan(id: string): Plan | undefined {
  return CATALOG.find((p) => p.id === id);
}

export interface MarketQuery {
  capability?: Capability;
  maxPriceCents?: number;
  requiredFeatures?: string[];
  minRps?: number;
}

/** Deterministic marketplace search the agent calls as a tool. */
export function searchMarketplace(q: MarketQuery): Plan[] {
  return CATALOG.filter((p) => {
    if (q.capability && p.capability !== q.capability) return false;
    if (q.maxPriceCents != null && p.priceCents > q.maxPriceCents) return false;
    if (q.minRps != null && (p.maxRps ?? 0) < q.minRps) return false;
    if (q.requiredFeatures?.length && !q.requiredFeatures.every((f) => p.features.includes(f)))
      return false;
    return true;
  });
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
