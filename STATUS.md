# Metanoia — Build Status (for review)

_Last updated: 2026-07-21. Written to be audited. Claims are marked
**VERIFIED** (ran it / tested), **CODED-UNTESTED** (written + typechecks, not yet run
against the live sandbox), or **DESIGN-ONLY** (planned, not built)._

## What we're building
A Next.js app for the Juspay Hyperswitch take-home: an AI agent ("Metanoia") that
subscribes to digital/API services on a user's behalf under a spend-capped **mandate**,
with the real recurring payment settled through the **Hyperswitch sandbox**. AP2 is the
authorization framing; x402 is the referenced agent-to-agent handshake; Hyperswitch
moves the money. Full plan: `../PRD.md`.

## The app has been run (Codex #10)
`npm run build` succeeds; `npm run start` serves it. Live checks:
- `GET /` → **200** · `GET /checkout?plan=…` → **200** · `GET /checkout/complete` (no id) → **200** (shows "No payment to verify", not a false success)
- `POST /api/create-payment {planId: vector_search}` (approved) → **500**, error = "HYPERSWITCH_SECRET_KEY is not set" (payment path reached, blocked only on keys)
- `POST /api/create-payment {planId: compute_cluster}` ($59, over the $40 cap) → **403 refused**, full check trail, **Hyperswitch never called** (no missing-key error). The mandate refuses before money moves.

## Fixes applied from the Codex re-audit
1. `stablePaymentId` now returns exactly **30 chars** (`pay_` + 26); unit-tested (`lib/hyperswitch.test.ts`).
2. Subscriptions are recorded **only after a verified `succeeded`** payment (webhook or authoritative `getPayment`), via `markPaymentSucceeded`. Cross-purchase cap/max-subs enforcement now actually works. Integration-tested.
3. Integration tests (`lib/checkout.test.ts`) prove: refused requests **never call Hyperswitch**; a completed purchase **changes the next spend-gate evaluation**; **retries can't duplicate** payments/subscriptions; stale out-of-order events are ignored.
4. **Over-budget demo path is real**: `compute_cluster` ($59) trips the per-charge cap; accumulating subscriptions trips the $60 monthly cap.
5. Webhook dedup is **persisted** (JSON file store, survives restart locally; falls back to memory on read-only FS) and **updates subscription state**; out-of-order handled via the resource `updated` timestamp.
6. Completion page **requires a payment_id and verifies it server-side**; `?status=` is never trusted.
7. CIT uses `setup_future_usage: "off_session"` and the SDK-collected consent; the **deprecated `mandate_data` was removed**.
8. Renewal endpoint (`app/api/renew`) uses `chargeSavedMethod` (MIT). Needs a **Stripe-test connector** (dummy can't do MIT) — CODED-UNTESTED.
9. Landing-page claim softened to describe a prototype, not completed functionality.

## Verified facts (re-runnable)
- `npm run build` — succeeds. `npx tsc --noEmit` — exit 0. `npm run lint` — 0 errors.
- `npm test` — **21/21 pass** (7 spend-guard, 4 checkout enforcement, 2 payment-id, 8 agent).
- **Real CIT to `succeeded` — OBSERVED.** `npx tsx --env-file=.env.local scripts/test-confirm.ts` creates an intent then confirms a test card (4242) → HTTP 200, `status: succeeded`, `connector: fauxpay`. Idempotency proven (our `payment_id` honored; duplicate create recovers the existing intent).
- **BUT Fauxpay returns no `payment_method_id`/`mandate_id`** even with `setup_future_usage: off_session` → the dummy connector cannot do recurring MIT. Saved-method + MIT still require a real **Stripe-test** connector.
- **Live agent endpoint**: market-data request → selects `tickstream_pro` (approved, $29 projected); GPU request → no compliant option (mandate refuses $59 vs $40 cap).
- Vertex/Gemini live: `node scripts/test-vertex.mjs` → "Metanoia online." Project `metanoia-agent-17047`, `global`, `gemini-2.5-pro`. (Gemini 3.x not on Vertex for this project.)
- GCP real: project + billing + Vertex API + ADC.

## Procurement agent — BUILT + live-verified
`lib/agent/procure.ts`: Vertex tool loop (`list_services`, `check_mandate`, `recommend`).
The model researches/compares/proposes; the **server** computes the authoritative
decision (`decide()`), re-checking plan existence, price, and SpendGuard — the model
never supplies an amount/verdict. Live run (`npx tsx scripts/agent-livecheck.ts`):
given "real-time US equities + websockets + ≥60 rps + ≤$50", it listed 3 competing
market-data plans, rejected QuoteStream Basic (no websockets, 30 rps), checked the
mandate, and selected TickStream Pro ($29) over Ultra ($49) with a structured rationale.
Still pending on the agent: mock-LLM unit tests + the procurement UI.

## Still NOT done / blocked
- **No real Hyperswitch payment yet.** Needs the user's `pk_snd_`/`snd_` keys in `.env.local` **and a Stripe-test connector** (for the recurring/MIT path). The dummy connector only proves one-time CIT.
- **Renewal correctness fixes pending** (from Codex): renewal must re-run SpendGuard; must not double-count the existing subscription; must use the authoritative attempt amount; must refuse on a cap-violating price increase. Durable store (KV/Postgres) needed for hosted webhook reliability.
- **No war-room UI / reasoning trace / failover demo / x402 visual / replay mode** — DESIGN-ONLY.
- Webhook + renewal are CODED-UNTESTED against the live sandbox.
- Persistence is file-based (local); a real deploy needs Redis/Postgres/Vercel KV.

## Honest correction
The earlier "only keys remain" claim was wrong. The non-network payment path is now
integration-tested, but reaching a genuine end-to-end demo still requires: (a) keys +
Stripe-test connector, (b) the buyer-agent tool loop, (c) the war-room UI.

## How to audit
```
cd metanoia
npm run build && npx tsc --noEmit && npm run lint && npm test   # all green
npm run start &                                                 # then:
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/            # 200
curl -s -X POST localhost:3000/api/create-payment -H 'content-type: application/json' -d '{"planId":"compute_cluster"}'  # 403 refused, no HS call
curl -s -X POST localhost:3000/api/create-payment -H 'content-type: application/json' -d '{"planId":"vector_search"}'    # 500 missing-key (path reached)
node scripts/test-vertex.mjs                                     # OK -> Metanoia online.
```
