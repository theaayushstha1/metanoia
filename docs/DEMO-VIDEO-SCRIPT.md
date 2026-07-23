# Metanoia — Demo Video Script (~4:15)

Recorded against the **deployed** app (`https://metanoia-37848252863.us-east1.run.app`).
One take, one browser, driven in order. Each row is a scene: the on-screen action and
the matching voice clip (see `VOICE-NARRATION.md` for the audio). Durations are the real
generated clip lengths; the video timeline stretches a bit where the agent is thinking.

Honesty rules baked in: never claim recurring MIT works, never claim a webhook was
delivered, never name a single confirmed webhook cause. The edges are said out loud.

| # | Clip (dur) | ON SCREEN (action) | Voice beat |
|---|-----------|--------------------|-----------|
| 1 | hook · 11s | Home loads; rest on the headline "Tell Metanoia what you need." | The pitch: budget instead of a credit card. |
| 2 | thesis · 15s | Scroll to MANDATE CONTROLS ($60 / $40 / 3 slots). | Model proposes, server decides. |
| 3 | mandate · 21s | Show the request box and the full chip row (all **10 domains**). Click **LLM**; request fills. | The mandate + the ten domains, then ask for an LLM API. |
| 4 | run · 3s | Click **Run Metanoia**; honest processing screen. | Hit run. |
| 5 | override · 28s | DECISION AUTHORITY: MODEL PROPOSED "Apex LLM Pro" vs SERVER FINAL "Relay LLM", red **SERVER OVERRIDE**, ranking bars. Offers table: Relay BEST FIT, Nano **BLOCKED**. **SpendGuard 4/4**. | The override, 76 vs 71; Nano blocked; SpendGuard 4/4. |
| 6 | scouts · 16s | Pan the **FOUR SPECIALIST PERSPECTIVES** (ADVISORY ONLY) and the **REAL-MARKET REFERENCES** block ("RESEARCH ONLY, NOT PURCHASABLE"). | Scouts are advisory; real companies are research-only. |
| 7 | checkout · 14s | Click **Confirm subscription**. Checkout loads. Type `4242 4242 4242 4242`, expiry, CVC in the Hyperswitch iframe; tick authorize. | Real Hyperswitch checkout; card stays in their iframe. |
| 8 | pay · 1s | Click **Pay $29.00**. | Pay. |
| 9 | receipt · 25s | Receipt: "Payment settled", capability **200 SANDBOX LIVE**, scroll to the **full payment record** + "Open in Hyperswitch dashboard". | Settled, capability proven, live payment record. |
| 10 | subscriptions · 8s | Open **/subscriptions**: the active sub + Cancel. | View and cancel; budget frees up. |
| 11 | nomatch · 21s | New run: **LLM**, run, then **Find something cheaper** → "No exact match. Here are the tradeoffs", MISSES, "NO CHARGE." | Stays honest: no compliant cheaper plan, no charge. |
| 12 | denied · 8s | New run: **over-budget** chip → red **Denied.** "CARD NEVER TOUCHED." | A100 over the cap → Denied. |
| 13 | isolation · 9s | Open the step-9 receipt URL in a **fresh browser** → "No payment for this session." | Payments locked to their session. |
| 14 | limits · 29s | Open **/lab**: copy-only test cards, refund button. | Test lab + refunds; then the honest edges (Stripe MIT, webhook delivery). |
| 15 | close · 18s | Back to home; rest on the headline. | The one-liner: model proposes, server decides. |

## Recording notes

- **Payments 429 intermittently** on the sandbox — the recorder retries the Pay click.
- Scenes 11, 12, 13 use **fresh browser contexts** so budgets/sessions don't bleed.
- Long clips (override, receipt, limits) intentionally cover the agent-thinking dwell.
- The recorder emits a per-action timestamp log; clips are muxed onto those marks with ffmpeg.
