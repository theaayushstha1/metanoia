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

export type Capability =
  | "market-data"
  | "news"
  | "vector-search"
  | "geocoding"
  | "compute"
  | "transcription";

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
  /** Short explanation of the workload this plan is strongest for. */
  bestFor: string;
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
    bestFor: "Early prototypes that can poll instead of stream",
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
    bestFor: "Production dashboards that need reliable live streams",
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
    bestFor: "High-volume trading products and options workflows",
    resource: "/api/provider/realtime_ultra",
  },
  // --- news: three competing offers ---
  {
    id: "briefwire_core",
    name: "BriefWire Core",
    vendor: "BriefWire",
    capability: "news",
    category: "News API",
    priceCents: 900,
    billing: "monthly",
    features: ["dedup", "global_coverage"],
    maxRps: 10,
    uptimePct: 99.5,
    blurb: "Clean global headlines with source deduplication.",
    bestFor: "Side projects that need dependable headlines at low cost",
    resource: "/api/provider/briefwire_core",
  },
  {
    id: "newsfeed_ai",
    name: "NewsFeed AI",
    vendor: "Brief",
    capability: "news",
    category: "News + summarization API",
    priceCents: 1500,
    billing: "monthly",
    features: ["dedup", "global_coverage", "llm_summaries"],
    maxRps: 20,
    uptimePct: 99.9,
    blurb: "Deduplicated global news with on-call LLM summaries.",
    bestFor: "Research products that need ready-to-use summaries",
    resource: "/api/provider/newsfeed_ai",
  },
  {
    id: "signaldesk_pro",
    name: "SignalDesk Pro",
    vendor: "SignalDesk",
    capability: "news",
    category: "News + events API",
    priceCents: 2900,
    billing: "monthly",
    features: ["dedup", "global_coverage", "llm_summaries", "webhooks"],
    maxRps: 80,
    uptimePct: 99.99,
    blurb: "Low-latency news, entity events, webhooks, and summaries.",
    bestFor: "Production alerting and event-driven market intelligence",
    resource: "/api/provider/signaldesk_pro",
  },
  // --- vector search: three competing offers ---
  {
    id: "vector_lite",
    name: "Vector Lite",
    vendor: "Indexly",
    capability: "vector-search",
    category: "Retrieval API",
    priceCents: 1200,
    billing: "monthly",
    features: ["semantic_search", "1m_vectors"],
    maxRps: 35,
    uptimePct: 99.5,
    blurb: "Managed semantic search for up to one million vectors.",
    bestFor: "Small RAG projects with predictable traffic",
    resource: "/api/provider/vector_lite",
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
    bestFor: "Large retrieval systems that need five million vectors",
    resource: "/api/provider/vector_search",
  },
  {
    id: "retrieval_pro",
    name: "Retrieval Pro",
    vendor: "Recall",
    capability: "vector-search",
    category: "Retrieval + reranking API",
    priceCents: 2900,
    billing: "monthly",
    features: ["semantic_search", "hybrid_search", "2m_vectors", "reranking"],
    maxRps: 75,
    uptimePct: 99.95,
    blurb: "Hybrid retrieval with hosted reranking for two million vectors.",
    bestFor: "Quality-focused RAG without operating a reranker",
    resource: "/api/provider/retrieval_pro",
  },
  // --- geocoding: three competing offers ---
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
    bestFor: "Apps with basic address lookup and modest traffic",
    resource: "/api/provider/geocode_lite",
  },
  {
    id: "geocode_stream",
    name: "Geocode Stream",
    vendor: "Northstar",
    capability: "geocoding",
    category: "Maps / geocoding API",
    priceCents: 1800,
    billing: "monthly",
    features: ["forward", "reverse", "batch"],
    maxRps: 120,
    uptimePct: 99.9,
    blurb: "Fast address lookup with batch jobs and 120 req/s.",
    bestFor: "Marketplaces processing addresses in batches",
    resource: "/api/provider/geocode_stream",
  },
  {
    id: "geocode_global",
    name: "Geocode Global",
    vendor: "Meridian",
    capability: "geocoding",
    category: "Maps / geocoding API",
    priceCents: 3300,
    billing: "monthly",
    features: ["forward", "reverse", "batch", "global_premise_data"],
    maxRps: 250,
    uptimePct: 99.99,
    blurb: "Global premise-level coverage, batch jobs, and high throughput.",
    bestFor: "International logistics and high-volume location products",
    resource: "/api/provider/geocode_global",
  },
  // --- compute: three competing offers ---
  {
    id: "inference_edge",
    name: "Inference Edge",
    vendor: "Sparrow",
    capability: "compute",
    category: "GPU compute API",
    priceCents: 2400,
    billing: "monthly",
    features: ["gpu_l4", "serverless_inference"],
    maxRps: 400,
    uptimePct: 99.5,
    blurb: "Serverless L4 inference with scale-to-zero workloads.",
    bestFor: "Bursty inference where idle cost matters",
    resource: "/api/provider/inference_edge",
  },
  {
    id: "gpu_burst_l4",
    name: "GPU Burst L4",
    vendor: "Arc Compute",
    capability: "compute",
    category: "GPU compute API",
    priceCents: 3500,
    billing: "monthly",
    features: ["gpu_l4", "autoscaling", "training_jobs"],
    maxRps: 800,
    uptimePct: 99.9,
    blurb: "Autoscaling L4 workers for fine-tuning and inference.",
    bestFor: "Budget-conscious training and sustained inference",
    resource: "/api/provider/gpu_burst_l4",
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
    bestFor: "Large-model training that explicitly requires A100 GPUs",
    resource: "/api/provider/compute_cluster",
  },
  // --- transcription (speech-to-text): three competing offers ---
  {
    id: "scribe_lite",
    name: "Scribe Lite",
    vendor: "Deepcast",
    capability: "transcription",
    category: "Speech-to-text API",
    priceCents: 600,
    billing: "monthly",
    features: ["async_transcription", "40_languages"],
    maxRps: 20,
    uptimePct: 99.5,
    blurb: "Batch audio-to-text in 40 languages. Upload and poll.",
    bestFor: "Podcasts and recordings where a few minutes' delay is fine",
    resource: "/api/provider/scribe_lite",
  },
  {
    id: "voxstream",
    name: "VoxStream",
    vendor: "Cadence",
    capability: "transcription",
    category: "Speech-to-text API",
    priceCents: 900,
    billing: "monthly",
    features: ["async_transcription", "realtime_streaming", "diarization"],
    maxRps: 50,
    uptimePct: 99.9,
    blurb: "Live streaming transcription with speaker diarization.",
    bestFor: "Live captions and meeting notes that need speaker labels",
    resource: "/api/provider/voxstream",
  },
  {
    id: "transcribe_ultra",
    name: "Transcribe Ultra",
    vendor: "Verbal",
    capability: "transcription",
    category: "Speech-to-text API",
    priceCents: 1400,
    billing: "monthly",
    features: ["async_transcription", "realtime_streaming", "diarization", "word_timestamps"],
    maxRps: 120,
    uptimePct: 99.99,
    blurb: "Low-latency streaming, diarization, and word-level timestamps.",
    bestFor: "Production media pipelines that need precise timing",
    resource: "/api/provider/transcribe_ultra",
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
