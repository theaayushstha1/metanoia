/**
 * The LLM behind Metanoia's buyer-agent — Gemini on Vertex AI, matching the
 * same stack Aayush uses in CS Navigator / vertex-ai-agent-research.
 *
 * Auth uses Application Default Credentials:
 *   - Local dev:  gcloud auth application-default login
 *   - Vercel:     set GOOGLE_VERTEX_CREDENTIALS (service-account JSON, stringified)
 */
import { createVertex } from "@ai-sdk/google-vertex";

const project = process.env.GOOGLE_VERTEX_PROJECT;
const location = process.env.GOOGLE_VERTEX_LOCATION ?? "global";

// When a service-account JSON is provided (e.g. on Vercel), pass it through;
// otherwise fall back to ambient ADC from gcloud.
let googleCredentials: Record<string, unknown> | undefined;
if (process.env.GOOGLE_VERTEX_CREDENTIALS) {
  try {
    googleCredentials = JSON.parse(process.env.GOOGLE_VERTEX_CREDENTIALS);
  } catch {
    googleCredentials = undefined;
  }
}

export const vertex = createVertex({
  project,
  location,
  ...(googleCredentials ? { googleCredentials } : {}),
});

/**
 * The reasoning model for the buyer-agent. gemini-2.5-pro is the newest available
 * on Vertex for this project (3.x is not published here yet, as of 2026-07).
 *
 * Lazy: the model handle resolves the project on first call, not at import time,
 * so importing this module in tests (no Vertex env) doesn't throw.
 */
// gemini-3.1-pro-preview is the flagship Gemini 3 Pro invokable from this project
// (the reasoning agent). gemini-3.6-flash is the newest Flash for fast/light roles.
export const agentModel = () => vertex("gemini-3.1-pro-preview");
export const fastModel = () => vertex("gemini-3.6-flash");

export function assertVertexConfigured() {
  if (!project) {
    throw new Error(
      "GOOGLE_VERTEX_PROJECT is not set. Add your GCP project id to .env.local (and run `gcloud auth application-default login` for local dev)."
    );
  }
}
