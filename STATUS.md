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

## P0 MVP - implemented

- Workbench: project/profile context, goal entry, presets, agent trace, three alternatives,
  explicit user choice, budget meter, and refusal state.
- Public GitHub import: server fetches bounded metadata for direct public repository URLs;
  arbitrary URLs cannot be fetched.
- Procurement: Gemini 3.1 Pro Preview on Vertex through AI SDK `ToolLoopAgent` and server-side tools.
- Deterministic ranking: capability fit, price efficiency, reliability, and throughput;
  hard requirements and SpendGuard are evaluated against server-owned data.
- Marketplace: 15 mock offers, with three comparable vendors in each of five capabilities.
- Checkout: embedded Hyperswitch Unified Checkout; server-side secret; stable payment IDs;
  duplicate creates recover the existing intent.
- Payment proof: Fauxpay sandbox CIT observed at `succeeded`; stable ID honored.
- Fulfillment: successful verified payment records the subscription, issues a scoped demo
  credential, and the receipt performs a credential-protected request to the mock provider.
- Safety: payment is unreachable from the research agent; checkout and renewals re-run
  SpendGuard; webhook signatures, deduplication, and stale-event handling are coded.
- Responsive layouts for workbench, comparison, refusal, checkout, and receipt.

## Verification

- `npm run build` - passes using Next.js webpack build.
- `npx tsc --noEmit` - passes.
- `npm run lint` - passes with zero warnings.
- `npm test` - 31/31 tests pass across spend policy, ranking, profile import, procurement,
  checkout, idempotency, and renewal behavior.
- `scripts/test-confirm.ts` - previously observed Fauxpay sandbox payment at `succeeded`.
- Live Vertex and payment credentials are configured locally; secrets stay in `.env.local`.

## External/live checks still required

- Complete one fresh browser checkout after the latest UI changes and confirm the receipt's
  provider probe returns `200 OK`.
- Configure a public HTTPS webhook URL and observe one signed Hyperswitch event end to end.
- Deploy the final build to a shareable URL.

## P1 - not finished

- Real recurring MIT requires a Stripe test connector that returns a `payment_method_id`.
  Fauxpay supports the first payment but does not prove recurring billing.
- Smart routing, a second connector, decline recovery, and failover are not implemented.
- The x402 seller-agent handshake and AP2 cryptographic signatures remain roadmap work;
  AP2 is currently the mandate data model and authorization framing.
- Durable hosted persistence requires Postgres/Redis/KV; local JSON is demo-only.
- LinkedIn/X OAuth imports, repository code analysis, and organization identity are deferred.

## Run locally

```bash
cd /Users/theaayushstha/Desktop/JusPay/metanoia
npm run dev
```

Open `http://localhost:3000`.
