# Metanoia — Voice Narration (ElevenLabs)

15 clips, ~3:46 of speech (about 4:15 on the video with demo pauses). Delivery is
first person, casual, confident, a little playful. Honest about every edge.

## Voice status (read this)

- Your cloned voice `0QZbOvK1JK43fJCI1fSJ` is an **Instant Voice Clone**. ElevenLabs
  blocks IVC voices over the API on the current plan (`ivc_not_permitted`). Upgrade to
  **Starter ($5/mo)** or above and it unlocks.
- Until then, the generated clips in `docs/voice/` use the premade voice **Liam**
  (`TX3LPaxmHKxFdv7VOQHJ`) as a stand-in so you can hear the pacing.
- **To swap to your voice:** upgrade, then re-run the generator with
  `VOICE = os.environ["ELEVENLABS_VOICE_ID"]` (already stored in `.env.local`). One run,
  same 15 clips, your voice.

## Files

- `docs/voice/clip_XX_*.mp3` — one clip per scene, for click-synced placement.
- `docs/voice/full_narration.mp3` — all 15 stitched, for a straight listen.

## Clips (id · duration · text)

**clip_01_hook · 11.4s**
Okay, real talk. What if you never had to hand a company your credit card again? What if you just told an AI what you needed, gave it a budget, and it went and bought the best thing for you. That's Metanoia.

**clip_02_thesis · 15.0s**
And the one line that makes it safe is this. The model proposes, the server decides. The AI can shop and recommend all day, but it can never set a price, pick the final plan, or move a single dollar. Only my server code can do that.

**clip_03_mandate · 20.6s**
So here's my deal. Sixty dollars a month, forty per charge, three subscriptions max. And it can shop across ten whole domains, thirty real offers, everything from market data to authentication to GPU compute. Watch, I'll ask for an LLM API with tool calling and long context, under forty bucks.

**clip_04_run · 2.5s**
I hit run, and Gemini goes to work.

**clip_05_override · 28.5s**
Okay, this is my favorite part. The model wanted Apex LLM Pro. But the server looked at the actual numbers and overrode it, and picked Relay LLM instead, because it scored higher on what I care about, seventy-six to seventy-one. Model proposed, server decided, right there on screen. Nano Chat? Blocked, it's missing tool calling. And SpendGuard checked every rule, four for four, before anything could move.

**clip_06_scouts · 16.3s**
It even ran four specialist scouts in parallel for a second opinion. But here's the honest part, they're advisory only, they don't get a vote. And when it pulls in real companies from the web, it labels them research only, not purchasable, because those aren't things it can actually buy for you.

**clip_07_checkout · 14.2s**
I confirm, and now it's a real Juspay Hyperswitch checkout. I type the test card into their secure iframe, which means the card number never even touches my server. SpendGuard runs one more time, server side.

**clip_08_pay · 1.0s**
And pay.

**clip_09_receipt · 24.8s**
Settled. And immediately, it proves the thing it bought actually works, a live authenticated call to the service, two hundred okay. Then it pulls the entire payment record straight from Hyperswitch, the exact same data their dashboard shows, connector, transaction ID, card network, timestamps. None of it is faked, it's all live.

**clip_10_subscriptions · 8.1s**
Everything it buys shows up right here in my subscriptions, and I can cancel any of it in one click, which frees the budget back up instantly.

**clip_11_nomatch · 20.9s**
Now watch it stay honest under pressure. I ask for something cheaper. But the only cheaper option is missing my must-haves, and the next one's over budget. So instead of quietly downgrading me, or blowing past the cap, it just says, no exact match, here are the tradeoffs, and it charges nothing. That's not a bug, that's the mandate.

**clip_12_denied · 7.8s**
And a hard no is a hard no. I ask for an A100 GPU that smashes through my cap. Denied. Card never touched.

**clip_13_isolation · 8.7s**
Security's real too. This receipt is mine. Try to open it from a different browser, and you get nothing. Payments are locked to the session that made them.

**clip_14_limits · 28.6s**
There's a whole payment test lab, success, decline, 3DS, and real refunds, on payments I actually own. The webhook is real too: Hyperswitch sends the signed event through a narrow ingress, both layers verify the untouched body, and Cloud SQL records it. The remaining honest edge is recurring off-session billing. That code exists, but Stripe blocks this sandbox path until the account gets the required card-data capability, and the automatic scheduler is still deferred.

**clip_15_close · 18.0s**
So that's Metanoia. An agent that shops under a mandate it literally cannot break, settles real money through Juspay Hyperswitch, and proves everything it buys. Model proposes, server decides. That's the whole idea. And honestly, I think that's where this is all going.

## Next: the finished video

Once you're happy with the voice, I drive a Playwright recording of the deployed app
following `DEMO-VIDEO-SCRIPT.md` beat for beat, emit a per-action timestamp log, then
mux each clip onto its beat with ffmpeg into one `metanoia-demo.mp4`.
