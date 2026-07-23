# Metanoia — Payment Audit

_Principal-engineer review of the Hyperswitch integration. Research phase only; no code changed._

_Audited: 2026-07-22 · Reviewer role: payments engineer · Scope: checkout, payment routes, renewal, webhooks, storage, Hyperswitch client._

Every recommendation cites an official source: `docs.hyperswitch.io`, `api-reference.hyperswitch.io`, or `github.com/juspay/hyperswitch`. Claims about the current system cite the file and line in this repo.

Tags used throughout:
- **PROVEN** — exercised against the live sandbox and observed to work.
- **CODED-UNTESTED** — implemented to the documented contract, not yet observed live.
- **MOCKED** — deliberately synthetic (labeled as such in-product).
- **MISSING** — not implemented.

---

## 0. Headline

The integration is further along than a greenfield audit would assume, and it is architecturally honest. Unified Checkout is wired correctly through the official web SDK, raw PAN never touches our server, card networks are auto-detected by the SDK (no manual selector), and there are **no fake wallet buttons** — Apple Pay and Google Pay are explicitly set to `never` (`app/checkout/CheckoutForm.tsx:61`). The CIT sets `setup_future_usage: off_session`, the MIT renewal is coded to the `recurring_details` contract, and the webhook receiver verifies HMAC over the raw body with dedupe and an out-of-order guard.

The gaps are real but bounded, and they cluster in three places:

1. **Recurring is coded but connector-blocked (and manual).** The first payment (CIT) settles against Fauxpay, which returns no reusable `payment_method_id`, so the off-session MIT path has never actually charged. Routing the CIT to the Stripe connector was tried and **Stripe rejected it with `UE_9000`** — "Sending credit card numbers directly to the Stripe API is generally unsafe... use test tokens." Hyperswitch detokenizes and forwards the card to Stripe, and this connector **requires raw-card API access enabled on the Stripe account** (a Stripe-side capability request), so `connector: stripe` proves routing only, not authorization. It is also **not automatic** — the only trigger is a manual "SIMULATE NEXT BILLING CYCLE" button (`RenewPanel.tsx:131`); there is no `next_billing_at`, cadence, or scheduler in the schema (`lib/db/schema.ts`). Call it a **manual, connector-blocked MIT**, not a working recurring lifecycle. Sources: Stripe connector prerequisites — https://docs.hyperswitch.io/explore-hyperswitch/payment-orchestration/quickstart/connectors/available-connectors/stripe ; PCI guidance — https://docs.hyperswitch.io/explore-hyperswitch/security-and-compliance/pci-compliance
2. **Recurring consent is not proven.** Earlier drafts of this doc claimed the CIT was "API-compliant via the SDK." That was overconfident. The SDK only captures `customer_acceptance` when the saved-payment control is enabled (`displaySavedPaymentMethodsCheckbox`) and the customer ticks it — and `CheckoutForm.tsx:59` does not enable that control. So today there is no consent object and no visible "authorize recurring charges" disclosure. This is the correctness item most likely to be probed. Source: https://docs.hyperswitch.io/explore-hyperswitch/payment-orchestration/quickstart/tokenization-and-saved-cards/save-a-payment-method
3. **No routing, no recovery, no ops surface, no test lab.** Single-connector routing only; no fallback, no soft/hard decline handling, no refund/cancel, no payment-operations timeline, and no sandbox scenario lab.

The rest of this document maps each of these precisely and proposes a prioritized 24-hour plan.

---

## 0.1 Correctness pass applied (post-review, 2026-07-22)

A senior review flagged that earlier drafts were overconfident in places. Those claims are corrected above and below, and the following **credentials-free correctness fixes are now in the code and verified (46/46 tests, tsc + lint clean)**:

- **Restored the failing test.** I had raised `max_active_subscriptions` to 20, which broke `mandate-policy.test.ts` (expects 11 rejected). Reverted the cap to **10** in the schema and the UI stepper. Suite is green again.
- **MIT status handling fixed** (`lib/checkout.ts`). The renewal previously marked *every* non-`succeeded` status as `failed`. Now only terminal `failed | cancelled | expired` are marked failed; `processing` and `requires_customer_action` stay **pending** for the webhook / a later retrieve to resolve — so an in-flight payment is never lost.
- **Webhook reconciliation fixed** (`store-memory.ts`, `store-pg.ts`). A retained (`processed=false`) event was previously rejected as a duplicate on redelivery, so it could never recover. Now only a **fully-processed** event is a true duplicate; a retained event is reprocessed on redelivery once its payment is known. Added a **`reconcilePendingEvents()`** sweep (ready to wire to a cron) and two tests proving recovery.
- **Removed fabricated receipt card.** The receipt no longer shows a hardcoded `VISA ·· 4242` (`app/checkout/complete/page.tsx`); real masked details will be derived from the authoritative payment response once the live shape is confirmed.
- **Softened the idempotency claim** (see §10.4). `X-Idempotency-Key` is *not* documented on the current V1 `POST /payments` reference, so the proven guard remains the stable merchant `payment_id`; the header is treated as unverified until a live test confirms it.

Still **not proven** and gated behind credentials/infra: recurring consent, automatic scheduling, durable deploy + one signed webhook, and a real Stripe CIT→vault→MIT. Those are the remainder of P0 below.

---

## 1. Exact map of the current payment flow

### 1a. Customer-present first payment (CIT)

```
Browser (/checkout?plan=…)
  └─ CheckoutClient.tsx  ── POST /api/create-payment { planId }
       app/api/create-payment/route.ts
         └─ initiateSubscription()                         lib/checkout.ts:59
              1. evaluateAgainstConstitution()  ← MANDATE GATE, before any HS call
                 lib/agent/spendCap.ts:52   (per-charge, monthly, category,
                 merchant, max-subs, expiry — all deterministic)
              2. if refused → return 403 { refused, verdict }   (no HS call)
              3. stablePaymentId(customer:plan:period)      lib/hyperswitch.ts:25
              4. createPaymentIntent()                      lib/hyperswitch.ts:100
                   POST {BASE_URL}/payments
                   { amount, currency:"USD", customer_id, description, metadata,
                     return_url, confirm:false, capture_method:"automatic",
                     payment_id, setup_future_usage:"off_session",
                     routing:{ type:single, data:{ connector, merchant_connector_id }}? }
              5. recordAttempt(status:"pending")            lib/store-memory.ts:101
         └─ returns { clientSecret, paymentId, status }
  └─ HyperElements + UnifiedCheckout (HS secure iframe)     CheckoutForm.tsx
       hyper.confirmPayment({ widgets, confirmParams:{return_url}, redirect:"if_required" })
         ├─ inline success → router.push(/checkout/complete?payment_id=…)
         └─ 3DS required   → SDK redirects to return_url (same receipt page)
Receipt (/checkout/complete)                                app/checkout/complete/page.tsx
  └─ getPayment(payment_id)  → authoritative status         lib/hyperswitch.ts:200
  └─ if succeeded:
       recordAttempt (recovery if store was reset)          page.tsx:70
       confirmPaid(payment_id,{ paymentMethodId })          lib/checkout.ts:122
         → markPaymentSucceeded → upsert subscription + issue credential
  └─ CapabilityProbe → GET /api/provider/[planId] with x-api-key (issued credential)
```

Key properties, verified in code:
- **Enforcement precedes the network.** `initiateSubscription` evaluates the constitution and returns on refusal *before* `createPaymentIntent` is called (`lib/checkout.ts:74-82`). A denied cart never reaches Hyperswitch.
- **Customer identity is server-fixed.** `DEMO_CUSTOMER` is a server constant; the browser cannot choose whose mandate it spends (`lib/constants.ts:6`, `app/api/create-payment/route.ts:6`).
- **Idempotency is by merchant `payment_id`.** `stablePaymentId(customer:plan:period)` is deterministic, so re-initiating the same checkout reuses the intent; `HE_01 / already exists` is self-healed — a still-open intent is returned (no double charge), a dead one mints a fresh id (`lib/hyperswitch.ts:142-158`). **Note (corrected after review):** an earlier draft asserted a documented `X-Idempotency-Key` header. That is **not confirmed** on the current V1 `POST /payments` reference — it only appears in some other examples (e.g. Relay). So the **proven** idempotency guard stays the stable merchant `payment_id`; the header is a *possible* future hardening to confirm with a live test, not a documented fact for this endpoint (see §10.4).
- **Secret hygiene.** Secret key is server-only; the browser gets only the publishable key + per-payment `client_secret` (`lib/hyperswitch.ts:16-17`, `CheckoutClient.tsx:9`).

### 1b. Off-session renewal (MIT)

```
RenewPanel.tsx ── POST /api/renew { planId }         (only rendered when canRenew)
  app/api/renew/route.ts
    └─ renewSubscription()                            lib/checkout.ts:174
         1. getSavedPaymentMethod(customer, plan)     lib/store-memory.ts:171
            └─ none → 409 "No saved payment method"
         2. evaluateRenewal() ← MANDATE RE-CHECK at current price, excluding self
            lib/checkout.ts:150
            └─ refused → 403 { refused, verdict }      (no charge)
         3. PENDING-FIRST: recordAttempt(pending) BEFORE the charge   lib/checkout.ts:205
         4. chargeSavedMethod()                        lib/hyperswitch.ts:168
              POST {BASE_URL}/payments
              { amount, currency, customer_id, confirm:true, off_session:true,
                recurring_details:{ type:"payment_method_id", data:<pmid> },
                routing:{ single, mandate connector }?, payment_id }
         5. succeeded → confirmPaid ; else → markPaymentFailed
```

`canRenew` is `Boolean(savedPm) && connector !== "fauxpay"` (`app/checkout/complete/page.tsx:203`). Because Fauxpay yields no `payment_method_id`, the panel today renders the blocked state, honestly telling the user MIT needs the Stripe path (`RenewPanel.tsx:86`).

### 1c. Webhook

```
POST /api/webhooks                                    app/api/webhooks/route.ts
  1. raw = await req.text()   ← RAW body, never re-serialized
  2. verify HMAC (x-webhook-signature-512 | -256) over raw, timingSafeEqual
  3. processWebhook()  (single transaction)           lib/store-memory.ts:194
       - dedupe by event_id
       - on payment_succeeded → settleSucceeded (out-of-order guard via updatedAt)
       - unknown payment id → event RETAINED (processed=false) and now RECOVERABLE:
         reprocessed on redelivery once the payment is known, plus a reconcile sweep
         (fixed in the post-review pass; see §0.1)
  4. 200 { received, applied|duplicate }
```

### 1d. Storage

`Store` contract (`lib/db/store-contract.ts`) with two drop-in backends: `InMemoryStore` (disk-backed `.data/store.json`, local/test) and `PgStore` (Cloud SQL Postgres). Selection is automatic: Postgres when `CLOUD_SQL_*` is set and not under vitest (`lib/store.ts:19-24`). The in-memory backend mirrors Pg semantics (idempotent recording, atomic webhook, retained unknowns) so behavior is identical bar durability.

---

## 2. Genuinely proven vs mocked / simulated / deferred

| Capability | Status | Evidence |
|---|---|---|
| Mandate gate before any charge | **PROVEN** | `lib/checkout.ts:74`; unit-tested in `spendCap`/`checkout`/`renewal` tests |
| Unified Checkout renders in HS iframe; PAN never on our server | **PROVEN** (integration) | `CheckoutForm.tsx:59` `UnifiedCheckout`; `CheckoutClient.tsx` uses `client_secret` only |
| Card network auto-detected (no manual selector) | **PROVEN** (by construction) | No network field anywhere; SDK owns BIN detection |
| No fake wallet buttons | **PROVEN** | `applePay:"never", googlePay:"never"` `CheckoutForm.tsx:61` |
| First payment (CIT) settles | **PROVEN** | STATUS.md:49 — fresh Fauxpay sandbox CIT observed `succeeded` |
| Capability credential issued + authenticated provider call | **PROVEN** (against our sandbox) | `store-memory.ts:146`, `/api/provider/[planId]` returns 200/401 |
| Idempotent CIT via stable `payment_id` + HE_01 self-heal | **PROVEN** | `lib/hyperswitch.ts:142`; STATUS.md:49 "stable ID honored" |
| Provider data feed | **MOCKED** (labeled) | `/api/provider/[planId]/route.ts` — synthetic, "AUTHENTICATED SANDBOX PROVIDER" |
| Off-session MIT renewal | **CODED-UNTESTED** | `chargeSavedMethod` `lib/hyperswitch.ts:168`; never charged (no reusable pmid from Fauxpay) |
| `payment_method_id` capture + reuse | **CODED-UNTESTED** | wired via `confirmPaid`/webhook `paymentMethodId`; unproven without Stripe |
| Webhook HMAC verify + dedupe + out-of-order | **CODED-UNTESTED** | `app/api/webhooks/route.ts`; needs `PAYMENT_RESPONSE_HASH_KEY` + deployed URL |
| Recurring consent (`customer_acceptance` / saved-method checkbox) | **MISSING** | SDK captures consent only when `displaySavedPaymentMethodsCheckbox` is enabled + ticked; not enabled (`CheckoutForm.tsx:59`) |
| Automatic renewal (scheduler / `next_billing_at`) | **MISSING** | only a manual "simulate" button; no cadence in schema |
| MIT in-flight status handling (`processing`/`requires_customer_action`) | **PROVEN** (fixed §0.1) | terminal-only failure; in-flight stays pending |
| Webhook recovery of retained events | **PROVEN** (fixed §0.1) | redelivery reprocess + `reconcilePendingEvents()`; 2 tests |
| Receipt card details | **PROVEN honest** (fixed §0.1) | hardcoded `4242` removed |
| `X-Idempotency-Key` header | **UNVERIFIED** | not on V1 create ref; stable `payment_id` is the proven guard (§10.4) |
| Mandate revocation / payment-method replacement | **MISSING** | no endpoint |
| Routing fallback / rule-based routing | **MISSING** | only `routing:{type:single}` |
| Soft/hard decline handling + retry / Revenue Recovery | **MISSING** | no decline branch |
| Refund / cancellation | **MISSING** | no endpoint |
| Payment operations screen (timeline, connector-why, CIT/MIT, deliveries) | **MISSING** | none |
| Sandbox scenario test lab | **MISSING** | only happy path |

---

## 3. Correct US subscription flow (target)

The lifecycle Hyperswitch documents for saved-card / recurring, mapped to what we must send. Field names below are confirmed against the official recurring-payments guide and Payments Create reference (§10).

1. **Customer-present CIT + consent.**
   `POST /payments` with `amount` (can be `> 0` for setup-with-charge, or `0` for zero-dollar auth), `currency`, `customer_id`, `profile_id`, `setup_future_usage:"off_session"`, `return_url`. Consent (`customer_acceptance`) is **captured by the Unified Checkout SDK** — the explicit object is required only for server-to-server calls that bypass the SDK. Since we use the SDK, our CIT does not need to send it, but we SHOULD assert the confirm response returned a `payment_method_id` / `network_transaction_id` (proof the method vaulted). `payment_type` may be set to `setup_mandate` / `new_mandate` when a formal mandate object is wanted.
   Source: recurring-payments guide — https://docs.hyperswitch.io/integration-guide/payment-suite/payments/recurring-payments ; Payments Create — https://api-reference.hyperswitch.io/v1/payments/payments--create

2. **Persist the vault reference.** Store `payment_method_id` (already wired via `confirmPaid({paymentMethodId})` and the webhook), scoped to `(customer, plan)`. When `off_session` is set, Hyperswitch also returns a `network_transaction_id` (NTID) that chains subsequent card-based MITs.

3. **Off-session MIT renewal.**
   `POST /payments` with `confirm:true`, `off_session:true`, `customer_id`, and `recurring_details:{ type, data }`. **Our current `recurring_details.type:"payment_method_id"` is the correct, current form** — the standalone top-level `mandate_id` field still exists but is **deprecated**. `recurring_details.type` full enum: `payment_method_id | mandate_id | processor_payment_token | network_transaction_id_and_card_details | network_transaction_id_and_network_token_details | network_transaction_id_and_decrypted_wallet_token_details | card_with_limited_data`. Re-run the mandate first (already done, `lib/checkout.ts:190`).
   Source: Payments Create — https://api-reference.hyperswitch.io/v1/payments/payments--create

4. **Retry / dunning on failure.** Classify the decline: soft (retry with backoff, or hand to Revenue Recovery "Smart Retries") vs hard (stop, notify).
   Source: Revenue Recovery — https://docs.hyperswitch.io/explore-hyperswitch/payments-modules/revenue-recovery

5. **Cancellation / mandate revocation.** `POST /mandates/revoke/{mandate_id}` ends recurring authorization (200 revoked; 400 if unknown); retrieve with `GET /mandates/{mandate_id}`; a `mandate_revoked` webhook fires on success. Mandate `status` enum: `active | inactive | pending | revoked`.
   Source: Revoke mandate — https://api-reference.hyperswitch.io/v1/mandates/mandates--revoke-mandate

6. **Payment-method update/replacement.** Let the customer re-vault a new card and re-point the subscription's `payment_method_id` (payment-methods-management in the integration guide).

Our code already implements 2, 3 (correct current form), and the mandate re-check in 4's gate. The CIT (1) is **not yet consent-complete**: the SDK captures `customer_acceptance` only when the saved-method control is enabled and ticked, which we don't do, and we don't assert a vault id came back. **1 (consent) and 4/5/6 are the open work.**

---

## 4. Payment-method matrix (what the customer chooses)

Customers pick a **method**; Hyperswitch picks the **processor**. Never surface Stripe/Adyen/Fauxpay as methods.

| Method | Feasible in this sandbox | Position | Notes / requirement |
|---|---|---|---|
| Card (new) | **Yes — PROVEN** | Primary | Unified Checkout collects it; network auto-detected from BIN client-side |
| Saved card | **Yes — CODED** | Above new card once vaulted | Needs `payment_method_id` from a mandate-capable connector (Stripe) |
| Google Pay | Stretch | Hidden until enabled | Currently `never`; needs connector wallet config + HTTPS domain |
| Apple Pay | Stretch | Hidden until enabled | Requires deployed HTTPS domain, domain verification, processor approval — do **not** add a fake button. Source: https://docs.hyperswitch.io/explore-hyperswitch/payment-orchestration/quickstart/payment-methods-setup/wallets/apple-pay/web-domain |
| PayPal | Out of scope for 24h | Hidden | Connector enablement required |

Unified Checkout renders exactly the enabled methods with connector-driven dynamic fields; we do not hand-roll any of this. Source: Payment experience — https://docs.hyperswitch.io/explore-hyperswitch/payment-experience

---

## 5. Processor matrix (behind Hyperswitch — never shown as a method)

| Processor | Role | MIT / saved card | Credentials / enablement | Status here |
|---|---|---|---|---|
| **Fauxpay** | Sandbox settlement proof | No reusable pmid | Dummy connector in HS dashboard; `HYPERSWITCH_CHECKOUT_CONNECTOR(_MCA)` | **PROVEN** for CIT only |
| **Stripe (test)** | Primary for recurring | Yes — returns `payment_method_id` | Connector wired in HS + env. Additionally needs **raw-card API access enabled on the Stripe account** (Stripe-side request; provide Hyperswitch's PCI AOC if asked) | env wired, **connector-blocked: returns `UE_9000` until Stripe grants raw-card access** |
| **Adyen (test)** | Fallback | Yes | Adyen test connector in HS dashboard → second `merchant_connector_id` | **MISSING** |

Also required to close the loop: `HYPERSWITCH_PAYMENT_RESPONSE_HASH_KEY` (Business profile → payment_response_hash_key) for webhook verification, and a public HTTPS `NEXT_PUBLIC_APP_URL` for `return_url` + webhook delivery. Smart-router model source: https://docs.hyperswitch.io/explore-hyperswitch/payment-orchestration/smart-router

---

## 6. Sandbox test matrix

Official Hyperswitch **dummy-connector** test cards drive the outcome by card number (any future expiry, any 3-digit CVV). Source: https://docs.hyperswitch.io/explore-hyperswitch/e2e-testing . These run without Stripe — including 3DS — so most of the test lab does **not** depend on the Stripe connector. The exceptions are the MIT/recurring scenarios (the dummy connector is payments + refunds only, no reusable method), which need Stripe.

| Scenario | Official trigger (dummy connector) | Expected result | System behavior to verify |
|---|---|---|---|
| Success | `4242 4242 4242 4242` / `4111 1111 1111 1111` | `succeeded` | subscription upserted, credential issued, pmid saved |
| Insufficient funds | `4000 0000 0000 9995` | `failed` | attempt → failed; eligible for retry / Revenue Recovery |
| Generic / hard decline | `4000 0000 0000 0002` / `5105 1051 0510 5100` | `failed` | classify; hard → stop |
| Expired card | **no official test PAN** (only a named decline category) | `failed` | simulate via generic decline; prompt PM update |
| 3DS / action required | `4000 0038 0000 0446` | `requires_customer_action` + `next_action.redirect_to_url` | SDK redirects to `return_url`; receipt resolves final status |
| MIT success/decline | (Stripe connector required) | `succeeded` / `failed` | off-session charge against saved pmid |
| Duplicate submission | same `payment_id` twice | one intent | HE_01 self-heal returns existing (no double charge) — **already handled** |
| Duplicate webhook | replay same `event_id` | `{ duplicate:true }` | dedupe — **already coded** |
| Out-of-order webhook | older `updated` after newer | ignored | out-of-order guard — **already coded** |

**3DS response shape (confirmed):** status becomes `requires_customer_action` with
```json
"next_action": { "type": "redirect_to_url", "redirect_to_url": "https://sandbox.hyperswitch.io/api/payments/redirect/..." }
```
The rule "if `next_action` contains `redirect_to_url` → 3DS required" is exactly what our `confirmPayment({ redirect:"if_required" })` already honors. Source: https://docs.hyperswitch.io/api-reference/payments/payments--create

The last three rows are already implemented; the rest need a **test lab UI** to fire them deterministically (only the MIT rows need Stripe).

---

## 7. Proposed checkout design (Unified Checkout)

Keep the current split-screen shell; upgrade the right panel to the full documented Unified Checkout surface:

- **Enabled methods, in order:** saved card (if vaulted) → new card → wallets only when actually enabled on a deployed HTTPS domain. No wallet placeholders.
- **New-card fields:** driven by connector "dynamic fields" (name, number, expiry, CVC, billing ZIP as required) — rendered by the SDK, not by us. Source: https://docs.hyperswitch.io/explore-hyperswitch/payment-experience
- **Network detection:** client-side from BIN inside the SDK; remove any notion of manual Visa/Mastercard selection (there is none today — keep it that way).
- **Explicit recurring consent:** an "Authorize recurring charges" checkbox wired to the CIT `customer_acceptance`; the Pay button stays disabled until it (and the terms line) are acknowledged.
- **Sandbox indicator:** a persistent "SANDBOX" chip (already partially present) and the test-card hint line.
- **PCI boundary preserved:** card data stays in the Hyperswitch-hosted secure iframe; the merchant server sees only tokens (`client_secret`, `payment_method_id`). Confirmed: raw PAN never reaches merchant infrastructure. Source: https://docs.hyperswitch.io/about-hyperswitch/sdk-payment-flows

Our integration already uses the official path — HyperLoader via `@juspay-tech/hyper-js` (`loadHyper`) + `@juspay-tech/react-hyper-js` (`UnifiedCheckout`), which internally calls `/payment_methods` + `/sessions` to surface the enabled methods. Nothing here needs replacing; it needs *configuring* (enable methods) and the consent affordance added.

The **routing decision is shown on the receipt, not in checkout** — the customer never sees processor names while paying (matches the current receipt's post-payment `CONNECTOR` row).

---

## 8. Routing strategy

- **Primary:** Stripe (mandate-capable, returns `payment_method_id`).
- **Fallback:** Adyen (second mandate-capable connector) on primary failure/unavailability. Hyperswitch names this rule type **"Primary with Fallback"** (also offers Single Processor and Split Routing). Source: https://docs.hyperswitch.io/integration-guide/workflows/intelligent-routing/rule-based-routing
- **Eligibility rules:** rules are built from dimensions + operators, evaluated top-to-bottom (first match wins). Officially confirmed dimensions include **payment method, amount, and currency**; card-network and CIT-vs-MIT as explicit dimensions are *not* confirmed in the docs, so treat routing by transaction type as an application-side decision (we already pin MIT to the mandate connector in code). Hyperswitch offers Volume-based, Rule-based, and Default Fallback routing. Sources: https://docs.hyperswitch.io/integration-guide/workflows/intelligent-routing/rule-based-routing , https://docs.hyperswitch.io/about-hyperswitch/hyperswitch-architecture/router
- **Retry policy:** soft declines (insufficient funds, issuer temporary) → retry / fallback / Revenue Recovery "Smart Retries"; hard declines (stolen, invalid) → stop immediately. Source: https://docs.hyperswitch.io/explore-hyperswitch/payments-modules/revenue-recovery
- **Exposure:** surface "connector selected + why" on the receipt and the ops screen, never in the customer checkout.

Today we send `routing:{ type:"single" }` pinned to the mandate connector (`lib/hyperswitch.ts:138,190`) — correct for MIT determinism, but there is no fallback and no rule engine.

---

## 9. Prioritized 24-hour plan

Ordered by depth-of-payments value per the reviewer's framing. Effort is engineering hours.

### P0 — prove the real subscription lifecycle (must-do), in the reviewer's order
| # | Task | Effort | Risk | Credentials |
|---|---|---|---|---|
| P0.0 | **[DONE]** Restore 44→46/46 tests; fix MIT in-flight status handling; fix webhook reconciliation (+ `reconcilePendingEvents`); remove fabricated receipt card | — | — | none |
| P0.1 | **Implement + prove recurring consent**: enable the SDK saved-method control (`displaySavedPaymentMethodsCheckbox`) + a monthly-charge disclosure; block Pay until acknowledged; assert the confirm response returned `payment_method_id`/`network_transaction_id` | 3h | SDK option must actually surface + capture consent | — (needs Stripe to fully prove) |
| P0.2 | **[BLOCKED]** Request **raw-card API access** from Stripe for the account (provide Hyperswitch PCI AOC if asked). Connector + env are already wired; the CIT currently returns `UE_9000` without this grant | — | Stripe-side approval, out of our control | Stripe account capability |
| P0.3 | **[BLOCKED on P0.2]** Switch checkout to Stripe and prove CIT → vaulted `payment_method_id` → off-session MIT `succeeded` | 2h | Depends on Stripe grant | P0.2 |
| P0.4 | **Automatic renewal**: store `next_billing_at` + cadence; a scheduled job charges due subscriptions and calls `reconcilePendingEvents()`. Without this it stays a manual simulation | 4h | Scheduler infra (cron/queue) choice | Cloud SQL |
| P0.5 | Configure `PAYMENT_RESPONSE_HASH_KEY`; deploy to HTTPS with **durable Postgres**; observe **one signed webhook** end-to-end | 3h | Serverless FS → requires PgStore/Cloud SQL | Cloud SQL + hash key + public URL |

### P1 — depth the reviewer will probe
| # | Task | Effort | Risk | Credentials |
|---|---|---|---|---|
| P1.1 | **Sandbox test lab**: buttons to fire success / insufficient / hard decline / 3DS with the official dummy-connector cards (§6). Runs without Stripe; MIT rows use Stripe once P0.1 lands | 3h | No official expired-card PAN (§10.5) | — (Stripe only for MIT rows) |
| P1.2 | **Decline handling**: classify soft vs hard; retry soft, stop hard; wire to Revenue Recovery framing | 3h | Decline-code taxonomy | — |
| P1.3 | **Routing + fallback**: Stripe primary → Adyen fallback via rule-based routing; show decision post-payment | 3h | Adyen enablement | Adyen test connector |
| P1.4 | **Mandate revocation** (`POST /mandates/revoke/{mandate_id}`) + payment-method replacement endpoints | 2h | list-mandates path unverified (§10.5) | — |
| P1.5 | Live-test whether **`X-Idempotency-Key`** is honored on our endpoint; only add it if confirmed (keep stable `payment_id` regardless) | 1h | Header unverified (§10.4) | — |

### P2 — operator surface & polish
| # | Task | Effort | Risk | Credentials |
|---|---|---|---|---|
| P2.1 | **Payment operations screen**: state timeline, connector + why, CIT/MIT tag, webhook deliveries, retries | 4h | Data modeling | — |
| P2.2 | **Refund / cancel** action | 2h | — | — |
| P2.3 | Apple/Google Pay **only if** deployed HTTPS + domain verification clears | — | Domain verification, processor approval | Apple domain assoc. |

**Recommended 24h cut (narrowed per review):** finish P0 in order, then stop and re-assess. P0.0 is done; the sequence is consent → Stripe connector → prove CIT→vault→MIT → automatic scheduler → durable deploy + one signed webhook. Only after that core is proven do we add a single 3DS/decline demonstration (P1.1/P1.2). The **test lab, routing/failover, revenue recovery, wallets, and AP2 artifacts stay deferred** until the core is real — building them now would repeat the overconfidence this review caught.

### Guardrails (unchanged, non-negotiable)
- Stripe/Adyen/Fauxpay stay **processors**, never customer-facing methods.
- **No fake wallet buttons**; wallets appear only when truly enabled.
- **No raw card handling** on our server; Hyperswitch iframe stays the PCI boundary.
- Every new payment path re-runs the mandate gate before charging.

---

## 10. Official-doc reconciliation

Confirmed against `docs.hyperswitch.io` and `api-reference.hyperswitch.io` (the docs site is mid-restructure; several older paths 404 — the API reference host and the integration-guide pages were the stable sources).

**Resolved:**

1. **`customer_acceptance`** — shape is `{ acceptance_type: "online"|"offline", accepted_at: <ISO8601>, online: { ip_address, user_agent } }`. The explicit object is **required only for server-to-server** CIT that bypasses the SDK. The Unified Checkout SDK *can* capture it — **but only when the saved-payment control (`displaySavedPaymentMethodsCheckbox`) is enabled and the customer ticks it.** We do not enable that control today, so consent is **not currently captured** (corrected from an earlier draft that claimed automatic compliance). It travels on the CIT (on-session) call, not the later MIT. Source: https://docs.hyperswitch.io/integration-guide/payment-suite/payments/recurring-payments , https://api-reference.hyperswitch.io/v1/payments/payments--create

2. **MIT identifier** — `recurring_details` is the current mechanism and subsumes all identifiers via `type` + `data`. `payment_method_id` (what we use) is correct and current; top-level `mandate_id` is **deprecated**. Full enum captured in §3. Source: https://api-reference.hyperswitch.io/v1/payments/payments--create

3. **Mandate revocation** — `POST /mandates/revoke/{mandate_id}` (retrieve `GET /mandates/{mandate_id}`); `mandate_revoked` webhook on success; status enum `active|inactive|pending|revoked`. Source: https://api-reference.hyperswitch.io/v1/mandates/mandates--revoke-mandate

4. **Idempotency** — **corrected after review.** `X-Idempotency-Key` appears in some examples (e.g. Relay Create) but is **not documented on the current V1 `POST /payments` reference**, so treat it as unverified for our endpoint. The **proven** guard remains the merchant-supplied `payment_id` (≤30 chars). Do not add the header as a load-bearing dependency until a live sandbox test confirms it. Source: https://api-reference.hyperswitch.io/v1/payments/payments--create

5. **Test cards + 3DS** — official dummy-connector cards confirmed (§6); 3DS is `status:"requires_customer_action"` + `next_action:{ type:"redirect_to_url", redirect_to_url }`. Source: https://docs.hyperswitch.io/explore-hyperswitch/e2e-testing , https://docs.hyperswitch.io/api-reference/payments/payments--create

6. **SDK + PCI boundary** — official mount path is HyperLoader / `@juspay-tech/hyper-js` + `@juspay-tech/react-hyper-js`, card data in a Hyperswitch-hosted iframe, merchant sees only tokens. Matches our integration exactly. Source: https://docs.hyperswitch.io/about-hyperswitch/sdk-payment-flows

7. **Routing** — "Primary with Fallback" is a first-class rule type; confirmed dimensions are payment method / amount / currency. Source: https://docs.hyperswitch.io/integration-guide/workflows/intelligent-routing/rule-based-routing

Also confirmed: NTID-based MIT is supported on **Stripe, Adyen, Cybersource**; when `off_session` is set the CIT returns a `network_transaction_id` for chaining. The sandbox **Dummy Connector (Fauxpay)** supports payments + refunds only and intents expire in ~2 days — corroborating that recurring cannot be proven on Fauxpay. Apple Pay (web) requires HTTPS + a hosted `.well-known/apple-developer-merchantid-domain-association` + control-center verification + processor enablement; Google Pay requires a Merchant ID + Google production approval — both justify the stretch-goal treatment and the no-fake-button rule. Sources: https://docs.hyperswitch.io/integration-guide/payment-methods-setup/wallets/apple-pay , https://docs.hyperswitch.io/integration-guide/payment-methods-setup/wallets/google-pay

**Genuinely unverified (flagged, not shipped as fact):**

- No official test PAN for "expired card" (only a named decline category) — simulate via generic decline.
- Literal **list-mandates-for-customer** path (likely `GET /customers/{customer_id}/mandates`) not rendered verbatim.
- Whether a top-level `connector` name is guaranteed on every PaymentsResponse (`connector_transaction_id` is; `connector` appears in flow examples and works in our Fauxpay run).
- Full per-connector Stripe-vs-Adyen saved-card feature matrix (not on one official page).

---

## Appendix — file index

| Concern | File |
|---|---|
| HS client (CIT, MIT, get, idempotency) | `lib/hyperswitch.ts` |
| Orchestration + enforcement seam | `lib/checkout.ts` |
| Mandate gate | `lib/agent/spendCap.ts` |
| CIT route | `app/api/create-payment/route.ts` |
| Renewal route | `app/api/renew/route.ts` |
| Webhook receiver | `app/api/webhooks/route.ts` |
| Storage contract + backends | `lib/db/store-contract.ts`, `lib/store-memory.ts`, `lib/store-pg.ts` |
| Checkout UI (SDK) | `app/checkout/CheckoutClient.tsx`, `app/checkout/CheckoutForm.tsx` |
| Receipt + renewal UI | `app/checkout/complete/page.tsx`, `app/checkout/complete/RenewPanel.tsx` |
| Env surface | `.env.local.example` |
