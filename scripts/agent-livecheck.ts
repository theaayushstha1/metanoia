// Live check of the procurement agent (hits Vertex). Run:
//   GOOGLE_VERTEX_PROJECT=metanoia-agent-17047 GOOGLE_VERTEX_LOCATION=global \
//     npx tsx scripts/agent-livecheck.ts
import { runProcurement } from "@/lib/agent/procure";

async function main() {
  const request =
    "Find me the best market-data API. It must support real-time US equities, websockets, " +
    "and at least 60 requests per second, and cost no more than $50/month. " +
    "You may subscribe if it satisfies those constraints.";

  const res = await runProcurement(request);
  console.log("=== PROPOSAL (model) ===");
  console.log(JSON.stringify(res.proposal, null, 2));
  console.log("=== DECISION (server-authoritative) ===");
  console.log(JSON.stringify(res.decision, null, 2));
  console.log("=== TRACE (" + res.trace.length + " steps) ===");
  for (const s of res.trace) {
    if (s.input !== undefined) console.log("  call:", s.tool, JSON.stringify(s.input).slice(0, 160));
    else console.log("  ->  ", s.tool, JSON.stringify(s.output).slice(0, 200));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
