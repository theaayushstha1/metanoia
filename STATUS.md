# Metanoia - MVP status

_Audited: 2026-07-23_

## Product boundary

Metanoia is a personalized procurement agent for developer and API subscriptions.
The user supplies a goal, optional background/project context, and up to five public
GitHub repositories. The agent extracts hard requirements, compares three offers in
the same capability, and explains its recommendation. A deterministic server ranking
and SpendGuard authorize the choice before Hyperswitch checkout.

LinkedIn and X links are accepted only as user-provided references. The prototype does
not scrape those services. Production profile import requires OAuth and user consent.

## Honest boundaries

- The provider endpoints (`/api/provider/*`) are an authenticated internal SANDBOX mock, not
  external vendor APIs. A successful capability call proves our issued credential works against our
  protected provider; it is not a live call to Cadence/Deepgram/etc. The UI labels it
  "AUTHENTICATED SANDBOX PROVIDER" and "200 · SANDBOX LIVE".
- Vendors are fictional sandbox offers. We never present real brands as purchasable. Scout research
  (external, if any) is scoped separately from onboarded, purchasable catalog offers.
- One Gemini agent PROPOSES; a deterministic ranker + SpendGuard DECIDE and gate payment. The four
  scouts are advisory analysts with no spending authority.
- Payment settles via Hyperswitch Fauxpay (sandbox CIT). Off-session MIT / recurring is NOT proven
  yet (Fauxpay returns no reusable payment method; that needs the Stripe path).
- Local persistence is a disk-backed JSON store for dev. The deployed app uses durable Cloud SQL
  Postgres through the Cloud SQL connector.

## P0 MVP - implemented

- Workbench: project/profile context (repository + link chip inputs), goal entry, presets, agent
  trace, three alternatives, explicit user choice, budget meter, refusal state, and an honest
  "no match" empty state distinct from a mandate refusal.
- Public GitHub import: server fetches bounded metadata for direct public repository URLs;
  arbitrary URLs cannot be fetched.
- Procurement: Gemini 3.1 Pro Preview on Vertex through AI SDK `ToolLoopAgent` and server-side tools.
- Deterministic ranking: capability fit, price efficiency, reliability, and throughput;
  hard requirements and SpendGuard are evaluated against server-owned data.
- Parallel analyst scouts: four Gemini scouts (price, value, quality, market) evaluate the same
  shortlist through distinct lenses in parallel. Advisory only; the deterministic ranker and
  SpendGuard remain the sole decision and payment gate. Each report carries a `scope`
  (onboarded_catalog vs external_research).
- Marketplace: 30 sandbox offers - three comparable vendors (budget/balanced/premium) in each of ten
  capabilities: market data, news, vector search, geocoding, GPU compute, transcription, LLM inference,
  transactional email, observability, and authentication. Counts are derived from the catalog
  (`catalogStats()`), never hardcoded. The result screen separates PURCHASABLE SANDBOX OFFERS from
  research-only REAL-MARKET REFERENCES, and a Decision Authority panel shows model-proposed vs
  server-final with any SERVER OVERRIDE reason and the real ranking score parts.
- Checkout: embedded Hyperswitch Unified Checkout; server-side secret; stable payment IDs;
  duplicate creates recover the existing intent; checkout metadata carries plan_id for recovery.
- Payment proof: fresh Fauxpay sandbox CIT observed at `succeeded` (connector fauxpay); stable ID honored.
- Fulfillment: a verified payment records the subscription, issues a scoped demo credential, and the
  receipt performs a credential-protected request to the mock provider.
- Animated capability proof: the receipt renders the authenticated provider response as a live,
  per-capability animation (waveform-to-text, ticker + sparkline, streaming headlines, match bars,
  pin drop, GPU power-on), with a mark-fold + ripple on arrival. Exclusive to the receipt.
- Preference memory (opt-in): a separate `memory.*` schema stores extracted facts and choice history
  with consent; it personalizes ranking priority and is fully deletable. Never mixed with payment data.
- Durable state: `Store` / `MemoryStore` interfaces with an in-memory backend (local, disk-backed)
  and a Cloud SQL Postgres backend (transactions, unique constraints, atomic webhook handling).
  Production selects Postgres when `CLOUD_SQL_*` is configured.
- Safety: payment is unreachable from the research agent; checkout and renewals re-run SpendGuard;
  webhook signature verification, deduplication, and stale-event handling are coded.
- Responsive layouts for workbench, comparison, refusal, checkout, and receipt.

## Verification

- `npx tsc --noEmit` - passes.
- `npm run lint` - passes with zero warnings.
- `npm test` - 91/91 tests pass across 16 files: spend policy, ranking, profile import, procurement,
  scouts, checkout, idempotency, renewal, preference memory, webhook reconciliation, refunds, session
  ownership, editable mandate bounds, the catalog expansion (category recognition, ranking, mandate
  refusal, refinement), and decision-authority override rendering.
- End-to-end (headless, this audit): procurement (4 scouts) -> selection -> Fauxpay checkout ->
  `confirm` at `succeeded` -> receipt issues the scoped credential -> authenticated provider call
  returns `200`. Invalid and missing credentials return `401`.
- Live Vertex and payment credentials are configured locally; secrets stay in `.env.local`.

## Deployed (P0 path) - LIVE on GCP

Project `metanoia-agent-17047`, region `us-east1`.

- Cloud Run service `metanoia` is public and serving: https://metanoia-37848252863.us-east1.run.app
  A real in-browser checkout completes end to end (payment settled, credential issued, capability
  endpoint returns `200 · SANDBOX LIVE`).
- Cloud SQL Postgres `metanoia-db` (db-f1-micro) is the durable backend; migrations 0000-0002 applied.
  DB-backed pages (subscriptions, lab) work, proving SA -> Cloud SQL -> Secret-Manager-password path.
- Gemini 3.1 Pro runs on Vertex from Cloud Run via the runtime SA (`aiplatform.user`).
- Secrets (Hyperswitch secret key, webhook hash key, DB password) live in Secret Manager, mounted into
  the service. No secret is baked into the image or committed.

### Webhook: real signed delivery and Cloud SQL settlement proven

- Direct sandbox delivery to both `*.run.app` and `*.cloudfunctions.net` failed before either Google
  service logged a request. Cold start, URL form, IAM, ingress, and application code were ruled out.
- A narrow Vercel ingress (`metanoia-webhook-relay.vercel.app/api/webhooks`) now verifies the HMAC over
  the raw body, preserves the exact bytes and signature headers, and forwards to Cloud Run. Cloud Run
  verifies the HMAC again and remains the only component allowed to mutate payment state.
- PROVEN live: Hyperswitch sent real `payment_created` and `payment_succeeded` requests with user-agent
  `Hyperswitch-Backend-Server`; Cloud Run request logs show four `200` responses through the ingress.
- PROVEN applied: app-owned payment `pay_7079adebf7d5660f384b938579` reached `succeeded`, its signed
  success event settled the known attempt, and the subscription appeared in Cloud SQL before the receipt
  page was opened. The receipt now queries the stored event and shows green only for that payment.
- Root-cause boundary: a compatibility issue in the hosted sandbox's outbound path to Google frontends.
  Both failed Google endpoints presented Google Trust Services ECDSA leaf certificates; the working
  Vercel ingress presented an RSA leaf. This correlation is strong but does not prove ECDSA itself is the
  cause because the edge network also changed. The implemented ingress removes the failing boundary.

### Teardown

`bash scripts/cleanup-gcp.sh` removes the SQL instance, Cloud Run service, Cloud Function diagnostic
relay, Artifact Registry repo, secrets, and the runtime SA. It also prints the separate Vercel cleanup
command (Cloud SQL is the only meaningful ongoing cost).

## P1 - not started (do not begin until the deployed P0 path is proven)

- Real recurring MIT is CODED BUT CONNECTOR-BLOCKED. Fauxpay proves the first payment but returns no
  reusable `payment_method_id`. The Stripe connector is wired, but routing a CIT to it returns `UE_9000`
  ("Sending credit card numbers directly to the Stripe API...") because Hyperswitch forwards the card to
  Stripe and the connector needs raw-card API access enabled on the Stripe account (a Stripe-side request).
  Until that capability is granted, `connector: stripe` proves routing only, not authorization.
- Smart routing, a second connector, decline recovery, and failover.
- The x402 seller-agent handshake and AP2 cryptographic signatures (AP2 is currently the mandate data
  model and authorization framing, not signed JWTs).
- LinkedIn/X OAuth imports, repository code analysis, and organization identity.

## Next milestone

Webhook delivery is closed. Next is the scheduler for automatic renewals, then the Stripe raw-card grant
for real off-session MIT. Not before: AP2 signatures, x402, or failover.

## Run locally

```bash
cd /Users/theaayushstha/Desktop/JusPay/metanoia
npm run dev
```

Open `http://localhost:3000`.
