# Architecture Decision Records

Every significant decision in Metanoia, its context, the alternatives rejected, and the tradeoffs accepted.
Format is lightweight ADR. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for *how* and the
[walkthrough](METANOIA-WALKTHROUGH.md) for full detail.

Legend: **[LIVE-VERIFIED]** observed running · **[CODED-UNTESTED]** implemented, not yet observed end-to-end ·
**[ROADMAP]** not built.

---

## ADR-001 — The model proposes; a deterministic server decides
**Context.** An LLM good enough to buy things is also good enough to be talked into overspending.
**Decision.** The agent only emits a *structured proposal*. A deterministic `decide()` re-validates the plan and
recomputes the mandate verdict on server-owned prices; it picks the highest-ranked **eligible** plan, overriding
the model if needed.
**Rejected.** Letting the LLM output the final choice/price.
**Consequences.** Testable, explainable, injection-resistant. The model can feel "overruled" — mitigated by
surfacing `model_selected_plan_id`. **[LIVE-VERIFIED]** (a test proves the override).

## ADR-002 — Deterministic ranking, not model scoring
**Context.** Recommendations must be reproducible and defensible.
**Decision.** A fixed weighted formula (fit / price / reliability / throughput) runs on catalog numbers; weights
shift by requested priority. Hard failures make a plan ineligible regardless of score.
**Rejected.** Asking the model to rank.
**Consequences.** Same inputs → same ranking; every score is auditable. Weights are hand-tuned heuristics.
**[LIVE-VERIFIED]**.

## ADR-003 — SpendGuard runs before any charge
**Context.** A budget guarantee is only real if it's enforced server-side, pre-charge.
**Decision.** A pure `evaluateAgainstConstitution()` checks mandate expiry, per-charge cap, monthly cap,
allowlists, and max-subscriptions **in order**; the checkout route re-runs it and returns `403` before
Hyperswitch is contacted. A refusal is a first-class outcome with a visible audit.
**Rejected.** Trusting the agent's `check_mandate` result; client-side budget UX only.
**Consequences.** Over-budget purchases are impossible through the app. **[LIVE-VERIFIED]**.

## ADR-004 — Curated sandbox catalog with fictional vendors
**Context.** Hyperswitch settles for *onboarded merchants*, not arbitrary URLs; deterministic scoring needs
structured, comparable attributes.
**Decision.** A 30-offer curated marketplace of **fictional** vendors across ten capabilities.
**Rejected.** Live web/product discovery; renaming vendors to real brands (Deepgram, etc.).
**Consequences.** Honest about what "buy" means; fewer/fake names — mitigated by the grounded Market scout, which
surfaces real products as `external_research` only. **[LIVE-VERIFIED]**.

## ADR-005 — Fauxpay for checkout; Stripe reserved for recurring
**Context.** The demo needs a reliable settlement path now and a real recurring path later.
**Decision.** Route customer-initiated checkout to **Fauxpay** (dummy, reliable); reserve **Stripe** for the
mandate/off-session path (which needs a reusable `payment_method_id`).
**Rejected.** Forcing Stripe for the whole demo (browser tokenization flakier).
**Consequences.** Solid checkout; real MIT/recurring is not yet provable. Renewal safety/idempotency are tested.
Checkout **[LIVE-VERIFIED]**, off-session MIT **[ROADMAP]**.

## ADR-006 — Merchant-supplied stable payment IDs (idempotency)
**Context.** Retries must not double-charge.
**Decision.** `stablePaymentId = "pay_" + sha256(customer:plan:period)[:26]` (30 chars). Retries reuse the id;
`HE_01` self-heals (reuse a live intent, or mint a fresh id for a dead one).
**Rejected.** Random ids + server-side dedupe bookkeeping.
**Consequences.** Idempotency is a property of the id. Confirming twice records one subscription. **[LIVE-VERIFIED]**.

## ADR-007 — Pending-first renewal (durability)
**Context.** A crash between "charge" and "record" must not lose a payment.
**Decision.** For off-session renewal, write a **durable pending attempt before** the charge using the same
idempotency key, then settle it. A crash leaves an auditable pending row, not a silent loss.
**Rejected.** Charge-then-record (an earlier version — corrected).
**Consequences.** Only meaningful on durable storage. **[CODED-UNTESTED]** against a real crash.

## ADR-008 — Atomic webhook settlement; retain unknown events
**Context.** Webhooks are async, can duplicate, arrive out of order, or reference unknown payments.
**Decision.** Verify raw-body HMAC (SHA-512/256, timing-safe), then in **one transaction**: dedupe by `event_id`
PK → settle → upsert subscription → issue credential, with an out-of-order timestamp guard. Unknown-payment
events are **retained** (`processed=false`), never dropped.
**Rejected.** Fire-and-forget handling; marking-and-dropping unknown events.
**Consequences.** Correctness is enforced by DB constraints. **[CODED-UNTESTED]** against a live signed event.

## ADR-009 — Dual-backend store (in-memory + Cloud SQL), disk-persisted locally
**Context.** Serverless in-memory state is per-instance and racy; tests need to be fast.
**Decision.** A `Store` interface with `InMemoryStore` (tests + local, **disk-backed** for cross-context sharing)
and `PgStore` (Cloud SQL Postgres, transactions + unique constraints). Selected by `CLOUD_SQL_*` env.
**Rejected.** A single JSON store; first-party Vercel KV/Postgres (sunset).
**Consequences.** Same behavior locally and in prod; more code + a provisioning step. Disk persistence fixed a
real cross-context credential `401`. In-memory **[LIVE-VERIFIED]**, Postgres **[CODED-UNTESTED]** (not provisioned).

## ADR-010 — Preference memory in a separate `memory.*` schema, consent-gated
**Context.** Personalization must not entangle with payments and must be private by default.
**Decision.** A separate Postgres schema; **consent enforced at the store boundary** (writes are no-ops without
opt-in); only extracted facts (no tokens, no raw social data); every item deletable.
**Rejected.** Storing memory alongside payment tables; on-by-default memory.
**Consequences.** Hard privacy wall; two schemas to migrate. **[LIVE-VERIFIED]** (consent gate, learn, forget).

## ADR-011 — Hybrid preference synthesis (deterministic steer + optional LLM blurb)
**Context.** Personalization should shape ranking cheaply and auditably, with optional warmth.
**Decision.** `deriveProfile()` is a pure function → a `priorityLean`, typical budget, preferred/avoided vendors,
injected as the ranking default. A short Gemini "about you" blurb is generated **only on demand**
(`/api/memory/blurb`), never on the procurement hot path.
**Rejected.** LLM-summarizing the whole history each run.
**Consequences.** No extra token cost per procurement; the lean is a heuristic. **[LIVE-VERIFIED]** (deterministic
part); blurb **[CODED-UNTESTED]** depends on the model.

## ADR-012 — Four advisory scouts, including a grounded market scout
**Context.** Multi-perspective insight is valuable, but more agents must not dilute the single decision gate.
**Decision.** Four parallel analyst agents (price / value / quality / grounded market via Google Search). They
**advise only**; the deterministic ranker + SpendGuard remain the sole decision and payment gate. Catalog scouts'
output is sanitized to the shortlist; the market scout is scoped `external_research`. Failures are non-blocking.
**Rejected.** Four agents with spending authority; scouts feeding a weighted vote into the decision.
**Consequences.** Rich, honest, non-blocking analysis; extra latency/tokens. Panel **[LIVE-VERIFIED]**; grounded
external content **[CODED-UNTESTED]**.

## ADR-013 — AP2 shapes modeled and enforced app-side; signatures deferred
**Context.** AP2 is an emerging standard for agent payment mandates.
**Decision.** Model AP2's `IntentMandate` / `CartMandate` shapes (snake_case) plus a richer `policy` extension,
and enforce them app-side. Do **not** call any AP2 service.
**Rejected.** Waiting for full cryptographic AP2 before shipping.
**Consequences.** Recognizable envelopes today; signed JWT mandates are **[ROADMAP]**.

## ADR-014 — Cloud SQL Connector (IAM) over IP allowlisting
**Context.** Serverless egress IPs rotate; the app already authenticates to Google for Vertex.
**Decision.** Reach Cloud SQL through `@google-cloud/cloud-sql-connector` (IAM-authenticated socket by instance
connection name), reusing the same Google credentials as the agent.
**Rejected.** Public IP + allowlisting Vercel's rotating IPs; a proxy sidecar.
**Consequences.** One auth story for model + database; no allowlist maintenance. **[CODED-UNTESTED]** (not deployed).

## ADR-015 — Honest sandbox labeling; no real-brand renaming
**Context.** A payments reviewer must not be misled about what actually settles or what's callable.
**Decision.** Label the provider proof "AUTHENTICATED SANDBOX PROVIDER · 200 · SANDBOX LIVE"; keep vendors
fictional; separate researched (external) providers from purchasable (onboarded) offers everywhere.
**Rejected.** Presenting real brands as purchasable; implying external vendor API calls.
**Consequences.** Credible under scrutiny; less superficial "wow." **[LIVE-VERIFIED]**.

---

## Editable mandate (recent)
The mandate is now **user-authored** in the workbench (monthly cap / per-charge cap / max subscriptions) and
persisted per session via `/api/mandate`; SpendGuard and ranking read the session mandate. This keeps ADR-001/003
intact — the *user* sets the envelope, the *server* still enforces it. **[LIVE-VERIFIED]**.
