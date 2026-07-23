# Metanoia - MVP status

_Audited: 2026-07-22_

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
- Local persistence is a disk-backed JSON store for dev. Durable/serverless persistence uses Cloud
  SQL Postgres (built via the Cloud SQL connector), which is not yet provisioned or deployed.

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
- Marketplace: 18 sandbox offers - three comparable vendors in each of six capabilities (market
  data, news, vector search, geocoding, GPU compute, transcription).
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
- `npm test` - 40/40 tests pass across spend policy, ranking, profile import, procurement, scouts,
  checkout, idempotency, renewal, and preference memory.
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

### Webhook: receiver verified; Hyperswitch->Cloud Run delivery does not land (diagnosed)

- Receiver PROVEN: the deployed `/api/webhooks` verifies signed events - a correct HMAC-SHA512 payload
  (Secret-Manager hash key) returns `200`; bad/missing signature returns `401`. Live.
- Hyperswitch generates + signs the events (real `X-Webhook-Signature-512` + full body) and CAN deliver
  outbound: a neutral-collector test (webhook.site) received a `POST` from `Hyperswitch-Backend-Server`
  within seconds. So Hyperswitch's outbound delivery is NOT the blocker.
- Yet Hyperswitch -> our Cloud Run endpoint never lands. Verified on OUR side: exact `status.url` used,
  `allUsers` has `roles/run.invoker`, ingress `all`, instance pre-warmed (min-instances tested at 1),
  both URL forms - and Cloud Run REQUEST logs show ZERO `Hyperswitch-Backend-Server` hits while every
  Hyperswitch attempt records `500 WebhookCallFailed`. node/browser reach the endpoint fine (200/401/405).
- Ruled out: app code, cold start, URL format, public-access IAM, ingress. What remains is a transport-
  layer reachability gap between Hyperswitch's sandbox egress and Cloud Run's `*.run.app` frontend
  (candidates: TLS/SNI, HTTP/2, or IPv6 - unconfirmed without Hyperswitch-side network visibility).
- To land a real delivery: front the app with an HTTPS load balancer / custom domain (stable IPv4) or a
  CDN-proxied endpoint, or use self-hosted / production Hyperswitch. Receiver is ready the instant it lands.

### Teardown

`bash scripts/cleanup-gcp.sh` removes the SQL instance, Cloud Run service, Artifact Registry repo,
secrets, and the runtime SA (Cloud SQL is the only meaningful ongoing cost).

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

Close the webhook loop: manually resend a webhook from the Hyperswitch dashboard and confirm a `200` in
Cloud Run logs (receiver already verified). After that, the scheduler for automatic renewals, then the
Stripe raw-card grant for real off-session MIT. Not before: AP2 signatures, x402, or failover.

## Run locally

```bash
cd /Users/theaayushstha/Desktop/JusPay/metanoia
npm run dev
```

Open `http://localhost:3000`.
