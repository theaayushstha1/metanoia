// Quick smoke test: confirm Vertex/Gemini auth + model work before we build on it.
// Run from the metanoia dir: node scripts/test-vertex.mjs
import { createVertex } from "@ai-sdk/google-vertex";
import { generateText } from "ai";

const vertex = createVertex({
  project: process.env.GOOGLE_VERTEX_PROJECT ?? "metanoia-agent-17047",
  location: process.env.GOOGLE_VERTEX_LOCATION ?? "us-central1",
});

const model = vertex("gemini-2.5-flash");

try {
  const { text } = await generateText({
    model,
    prompt: 'Reply with exactly: "Metanoia online."',
  });
  console.log("OK ->", text.trim());
} catch (e) {
  console.error("VERTEX ERROR:", e?.message ?? e);
  process.exit(1);
}
