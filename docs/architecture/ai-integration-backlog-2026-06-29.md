---
type: backlog
title: Arbor AI Integration — Elevated Backlog
date: 2026-06-29
source_of_truth: Arbor/docs/architecture/ai-integration-spec-2026-06-29.md
method: 7-lens multi-agent design → adversarial verify → ship-readiness harden → synthesize
---

# Arbor AI Integration — Elevated Backlog (Final)

**source of truth:** `Arbor/docs/architecture/ai-integration-spec-2026-06-29.md` · **method:** 7-lens design + adversarial + ship-readiness critique, synthesized and locked.

## Executive frame

Arbor today is a mature, well-governed **silent** brain: one routed model (Claude-on-Vertex for high-stakes coaching, Gemini 2.5 Flash for creative/analysis/handoff, Gemini Flash Image for art), ~17 augmented surfaces, and a real moat — escalation, child-PII redaction, output safety screen, COPPA purpose-scoped consent, a non-diagnostic contract, and cost metering. Two things hold it back: it has **no real voice** (robotic browser `SpeechSynthesis`; the built neural Gemini Live path is gated off), and "better" is **asserted, not measured** (the `ai-eval-harness` skill is dormant, the semantic safety screen fails open and is English-only). This backlog gives the brain a real **voice**, makes quality **measurable and regression-gated**, **persists** the media it already pays to generate, and surfaces the breadth it already has — every move riding an existing seam (`childAsr.ts` provider pattern, `modelRouter` routes, `usageRollup` telemetry, the safety spine), never bypassing the moat. Lead with voice; everything sequences behind it.

**Two corrections honored throughout:** (a) the founder dashboard reads the Firestore **`usageRollup`**, never Cloud Logging — all eval signals land in the rollup; (b) **SynthID is not app-side verifiable** — provenance gates assert "image route ran + C2PA metadata present", never "SynthID verified".

---

## EPIC A — Give Arbor a Real Voice (the flagged gap) · **P0**

**Goal.** Kill the "we sound cheaper than we are" signal. Replace robotic browser TTS with neural voice across every narration surface, flip the already-built realtime path on by default, and do it well for Hebrew (the flagship market) — without ever voicing an un-screened span.

**Capabilities.**
- **Neural TTS provider seam** — new `/api/tts` behind a `TTS_PROVIDER` env flag mirroring `CHILD_ASR_PROVIDER`. **One live backend: `gemini`** (Gemini-TTS on the existing Vertex stack — no new vendor/secret). `browser` is the floor; `google` (Cloud TTS) ships as a tested-but-off config. **The `elevenlabs` stub is cut entirely** — the seam itself proves a vendor can be added later by config; a named dead entry only adds surface and implies DPA intent with zero shippable value.
- **`<SpeakButton>` + `useArborVoice()` UI keystone** — one component becomes the *sole* caller of voice (lint/grep-guarded). Owns idle/buffering/speaking/paused/error states, an honest **"Natural / Basic voice"** indicator, stop-on-navigate, best-effort highlight-as-spoken, RTL/he-IL, 44px targets, reduced-motion. Ships against the browser floor *first*, then config-swaps to neural.
- **Abort/queue rework (own tracked sub-item).** `lib/tts.ts` is a 19-line synchronous wrapper with no queue/abort; `CoachTab`'s `pumpTts` is a *separate* async loop. Barge-in/stop must cancel in-flight fetch + queued audio across **both** the SpeakButton path and the coach pump (AbortController + buffer stop). Tracked and tested separately so it is not silently absorbed into the seam item.
- **Default-on Gemini Live** — bump `LIVE_MODEL` off the removed `gemini-2.0-flash-live-001` preview, provision the ephemeral token in prod, make Live default with the browser-loop fallback. A **Live/Basic mode chip** (single source of truth, owned here) shows captions + an honest "why Live is unavailable" reason from the `liveToken` probe.
- **Avatar-bound voice persona** — stable `{voiceId, styleString}` derived **deterministically from the avatar-style enum (5 styles) + locale ONLY — never from any child audio sample.** Hero Journey only for v1: two-voice read (neutral narrator + in-character hero) over the already-authored `scene.dialogue`/`scene.sfx`, with a one-time "this voice is AI-generated" disclosure.
- **Hebrew parity** — per-locale voice pinning in the seam config; **force `he-IL`** (never auto-detect) when `uiLang=he`; native-Hebrew-reviewer sign-off (LOCALIZATION.md gate) is the IL ship gate, with a small internal A/B preview harness.

**Platform leverage.** Gemini-TTS + Gemini Live ride the same GCP project + ADC the router already uses — zero new vendor. Live native audio is a first-class GCP realtime capability already coded.

**Integration + interface.** Every narration surface (HeroScenePlayer, CoachAnswerCards, EarlyReadingTrack, CoachTab pump) re-voices through one component. **TTFB budget: target ≤1.5s time-to-first-audio on `/api/tts`; on timeout (configurable, default ~3s) or mid-stream failure, auto-fall-back to the browser floor — never spinner-forever on a child surface.** Loading/error/fallback chip on every narratable block; captions on Live.

**Safety gate (mandatory).**
- **`/api/tts` runs `screenModelOutput` server-side on every text span before synthesis — HARD blocker.** Verified: `/generate-hero-journey` emits narration+dialogue+sfx with **no** output screen today (only an escalation check on the comic image prompt). The Hero-Journey two-voice item **explicitly depends on this** and ships a test proving a diagnostic line authored in a hero beat cannot be voiced.
- Synthesis fires **only on explicit speaker-tap**, never auto-play; every call flows through `recordUsage`, including a **new per-minute/turn meter for the Live bidi path** (none today).
- Stock neural voices only — **real-person AND child voice cloning forbidden; this extends to persona derivation** (persona never incorporates child-provided audio characteristics).
- Live realtime audio is **not** output-buffer-screened (impossible on a bidi stream): the control is a **non-diagnostic-constrained system instruction + post-hoc turn-logging (the Epic-E sliver, pulled into Wave 0).** Live default-on is **gated behind that turn-logging landing** — the highest-risk audio path never ships with only the system instruction. Affective-dialog / proactive-VAD preview flags ship only after the eval gate (Epic B) is green on Live turns.
- **Parent-facing disclosure:** the Live (and Look-Together) consent/disclosure copy states plainly that realtime audio relies on a system-instruction guardrail, **not** the buffered output screen used for text. State honestly; do not claim "same posture as buffered `/api/tts`".
- TTS is output-only → **no new consent purpose.** `voice_processing` continues to gate inbound child voice only.
- **Prod kill-switch (AC):** one env flip reverts `TTS_PROVIDER` to `browser` and Live to token-gated/off, restoring the floor without a deploy — required because cost is metered live but quality lands async.

**Acceptance criteria.**
1. Every narration surface plays neural `gemini` TTS via the single `<SpeakButton>`; `browser` floor on failure with no dead air — including a verified working floor on the **Capacitor iOS/Android WebView targets** (confirm native `SpeechSynthesis` voices exist or supply a packaged fallback; "no dead air" is unmet otherwise).
2. `/api/tts` rejects any span that fails `screenModelOutput`; a test proves an unscreened span (incl. a diagnostic hero beat) cannot be voiced.
3. `stopSpeaking()`/barge-in cancels in-flight fetch + queued audio across both SpeakButton and the reworked `pumpTts` (abort controller + buffer stop), tested separately.
4. Live is default-on in prod **only after** the turn-logging sliver lands; mode chip reflects real probe state; Live minutes appear on the cost dashboard.
5. `he-IL` forced on the Hebrew path; Hebrew neural voice does **not** ship to IL until the Hebrew adversarial safety suite + Hebrew semantic-screen decision (Epic B) pass.
6. Hero Journey plays narrator + hero two-voice with the AI-voice disclosure.
7. TTFB budget enforced with auto-fallback-to-floor on timeout; prod kill-switch reverts to floor without deploy.

---

## EPIC B — Make "Better" Measurable: AI Eval & Safety Gate · **P0/P1**

**Goal.** Close the L1 quality gap. Turn the moat from *asserted* to *measured/regression-gated* — the prerequisite that lets Epic A flip Live's affective flags, lets Hebrew voice ship, and lets every other epic swap providers/prompts safely.

**Capabilities.**
- **Wire the dormant `ai-eval-harness` skill to live routes** via `modelRouter.generateJson` (produce + judge). Judge pinned to `claude-opus-4-8`; suites versioned; `evals/<feature>.eval.json` + `results.jsonl` appended verbatim; hard `safe===true` gate; human golden-set sign-off as ground truth.
- **Thin first cut (CI ship-gate):** `coach_high_stakes` non-diagnostic/clinical-firewall + groundedness-vs-`sourceCardsUsed` + warmth + Hebrew naturalness. **Merge the adversarial safety red-team suite in here** (one gate, not two) — expand `safety-eval.mts`'s fixture set into a versioned adversarial suite incl. **Hebrew/RTL dosing-evasion + diagnosis-evasion** + a BENIGN false-positive regression set. **Test the lexical floor AND the semantic layer with a real provider** (semantic is off-by-default/fails-open and English-only — measuring only lexical over-credits the screen).
- **Spoken-narration coverage (new, from critic):** the hero-journey/story **narration text that Epic A newly voices** is an explicit eval target — the most safety-relevant new surface is spoken child-facing narration, especially in Hebrew. Not just coach/council/handoff.
- **Hebrew semantic-screen decision (gating artifact):** the suite produces a recorded decision — extend the semantic classifier to Hebrew, or block the Hebrew TTS path until it is. This decision is the hard predecessor of Epic A's IL voice launch.
- **Media-appropriateness sliver:** small multimodal-judge child-safety gate for avatar/comic + an automatable assert that the **image route ran and C2PA metadata is present** (drop SynthID-verify). On-model consistency scoring (validates Epic C's character sheet) and Veo/Lyria cases are **deferred** until those seams land.
- **In-production drift signal (P1 fast-follow):** sample 1–5% of post-screen/aliased outputs, judge on **Gemini Flash** (cheap, fire-and-forget), write the score **into the Firestore `usageRollup`** as a second metered dimension.

**Platform leverage.** Reuses the existing `vertex_claude`/Gemini providers as judges (no new vendor) and the `recordUsage`→`usageRollup` sink. Vertex Gen AI Eval Service / Gecko autoraters are an **implementation detail, explicitly deferred** — do not rebuild the skill.

**Integration + interface.** CI gate first (invisible, load-bearing). Founder-facing quality tile sequences last (Epic F).

**Safety gate.** **Zero real child data in fixtures — synthetic personas only**, enforced as a hard harness rule. Judged copy is post-screen + aliased; PII never reaches the judge. A low score never alters the delivered response (logging only). `verdict.reason` logs *category*, not raw flagged text.

**Acceptance criteria.**
1. `npm run` eval gate blocks a PR that regresses non-diagnostic compliance or groundedness on coach/council/handoff (warmth/Hebrew = trend-not-block initially to avoid flaky gates).
2. Adversarial suite exercises lexical floor (hard guarantee) and semantic layer (real provider) separately, including Hebrew/RTL evasion cases.
3. Spoken hero-journey/story narration text is an eval target (incl. Hebrew); a recorded Hebrew semantic-screen decision exists before IL voice ships.
4. Media check hard-fails on unsafe imagery + missing C2PA.
5. Online quality score lands in `usageRollup`; no Cloud Logging read path introduced.
6. Judge model/version pinned; threshold uses a margin, not exact scores.

---

## EPIC C — Persist & Personalize Generative Media · **P1/P2 (Guy-gated)**

**Goal.** Stop paying twice for the same art, and make the hero look unmistakably like *this child's* character across every panel — the #1 engagement signal.

**Capabilities.**
- **Two-tier media persistence** — keep the in-memory LRU, add content-hashed **Firebase Storage** backing keyed by `comicKey`; hydrate on `HeroComicsTab` mount. (`localStorage`-quota trap avoided.)
- **Persistent character sheet** — at AvatarCreator "Lock {name}'s look", generate a 2–3-pose sheet once (Nano Banana multi-image reference) and feed it as the consistency reference on every subsequent `generate-comic`/`generate-scene`. The avatar `dataUrl` is **already** threaded into `generateComic` — this is a server-side prompt-builder enrichment, no new call sites.
- **Shareable illustrated keepsake** — illustrate the deterministic, G2-governed `childStory` (text stays model-free); same hero on the cover via the character sheet. **First cut if Wave 2 slips** — it rides two gated items and delivers keepsake value, not core capability; it must never pull the character-sheet/persistence schedule.
- **Voice-audio caching** — cache deterministic, output-screened spine narration audio as one more artifact under the *same* Storage rollout; `audioKey = (beat, voiceId, modelId, locale)` to avoid stale-voice serving.

**Platform leverage.** Firebase Storage + content-hash + immutable `Cache-Control`. (Vertex explicit context-caching of the avatar style preamble is **deferred** as a separate pure-cost item.)

**Integration + interface.** Instant re-open of comics/scenes; cover art on the share card with a provenance badge.

**Safety gate (the binding constraint — fails CLOSED).**
- Persisted generated media (art + cached audio) is **child data:** register every object as a `CHILD_SUBCOLLECTIONS`-equivalent sink and **add Storage + audio hard-delete to `/api/privacy/erase`** (verified gap: erase covers memoryEvents/shares/consents only, **no** Storage delete today). The **erase guard test is a precondition that fails closed — the Storage write path is not enabled in ANY environment until the guard test exists and passes**, so persisted child art can never outlive an erase even in a partial rollout.
- Per-child scoping; content-hash path includes consent-scope so a revoked-consent child cannot read prior media. SynthID/C2PA persist with the asset.
- Share path: only G2-approved text leaves the device; no real photo; provenance on the exported image; falls back to plain-text export on illustration failure.
- **Enablement is the existing Guy-gated Storage decision.** Gate closed → epic does not ship; no standalone build.

**Acceptance criteria.**
1. Comics/scenes/character-sheets/audio persist + hydrate cross-session; the guard test fails closed and the write path stays disabled until it passes.
2. Character sheet measurably improves cross-panel consistency (proven by Epic B's consistency judge, not asserted).
3. Erase hard-deletes all Storage objects + cached audio; revoked consent blocks reads.

---

## EPIC D — Smarter Conversational & Structured Intelligence · **P1/P2**

**Goal.** Make the coach grounded, longitudinally aware, and able to assemble a professional handoff — all on existing routes, all eval-gated by Epic B.

**Capabilities.**
- **Resolved provenance citations** — the citations strip **already exists** in `CoachAnswerCards` (toggle, a11y, RTL) but prints raw ids. Add `GET /api/architecture/knowledge-by-ids` (backed by `loadCardsByIds`), render **title + source + `[reviewed]` badge** with raw-id as fetch-pending/failed fallback + skeleton-chip loading; reuse for the council strip. **Edit the existing component — do not rebuild the shell.**
- **Longitudinal behavior context** — inject **whitelisted numeric-only** trend fields (`intensityTrend`, top `triggerBreakdown` by %) into the coach prompt; never free-text even if screened. Min-log threshold (silent-omit below it) + an "Arbor is also looking at N weeks of your logs" disclosure.
- **RAG grounding** — swap `retrieveKnowledgeCards` scorer behind the same signature: **v1 = in-process embeddings + cosine over the small `review_status==='reviewed'` corpus** (anti-overkill — no managed vector DB); Vertex Vector Search is the upgrade path only if the corpus grows. Keep the tag-filter fallback (no regression). Redaction runs **before** embedding. Powers a "Based on" source-chip row.
- **Agentic handoff pack** — a **fixed, deterministic** orchestrator `/api/handoff-pack`: signals → analyze → handoff brief → top-3 questions → optional cover, each step verified against the non-diagnostic schema, **degrade-to-single-brief on any step failure.** Rendered into the existing Consult surface as editable/removable sections (one audience `select`, **not** a multi-step wizard). Plus-entitlement gated (`requirePlusFeature` already wraps handoff).
- **Web grounding** — `tools:[{googleSearch:{}}]` on **`handoff_structured` + vision-document routes only**, via an explicit **per-route allowlist** (not a flag that can leak to coach/child). RTL-aware sources footer.

**Platform leverage.** Vertex managed RAG as a deferred upgrade; Gemini google-search grounding scoped to professional routes.

**Integration + interface.** Citations + source chips build clinical credibility inline; handoff pack is parent-reviewed editable sections; web-sources footer on professional briefs.

**Safety gate.** Numeric-only injection (free-text trend prose never bypasses the screen). RAG retrieves reviewed-only cards + redacted question only. Handoff: existing escalation + per-section output screen + **non-diagnostic framing enforced on the assembled cover, not just the parts** + mandatory human approval (no auto-send). Web-grounded text re-runs the output screen **after** grounding (it can reintroduce diagnostic/medication phrasing); grounding **never reachable by coach/child routes** (enforced in code).

**Acceptance criteria.**
1. Coach + council strips show resolved title/source/`[reviewed]`; by-ids endpoint behind chat auth, static metadata only.
2. Coach prompt carries numeric trends above threshold with disclosure; sparse data silently omits.
3. RAG keeps the tag-filter fallback; redaction precedes embedding (test-proven).
4. Handoff pack degrades to single brief on failure; cover is output-screened + non-diagnostic; parent approves before share.
5. Grounding allowlist test proves coach/child routes cannot enable web search.

---

## EPIC E — Live Vision Co-Play (the one net-new engaging surface) · **P2**

**Goal.** Highest engaging+effective net-new lever: the avatar can *see and talk about* what the child shows it — ride the working Gemini Live bidi session (which natively accepts a video media part).

**Capabilities.**
- **"Look together" mode** inside the existing avatar/WorldScene surface (**not** a new tab). A downsampled frame sampler on the existing Live session is the only net-new code path.
- **v1 = a single bounded co-play** ("show me something red" / "narrate your drawing") — **not** open-ended always-on vision.

> Note: the Live turn-logging sliver that this epic owns is **pulled forward to Wave 0** to gate Epic A's default-on Live. The co-play *surface* itself remains P2/Wave 3.

**Platform leverage.** Reuses `geminiLiveClient.ts` (mic 16kHz PCM in / 24kHz out, ephemeral token) — adds a video track, not new infra. Depends on Epic A only for voice quality, not function.

**Integration + interface.** Parent-initiated start, persistent **on-air indicator**, one-tap **STOP**, session timeout, captions, RTL, audio-only/browser fallback ladder.

**Safety gate (highest-sensitivity surface in the app).**
- Continuous child video = a **fresh consent sheet** (`face_processing` + `voice_processing`), not silent reuse; **parent gate enforced server-side**, not UI-only. The consent copy states realtime audio relies on the system-instruction guardrail + turn-logging, not the buffered screen.
- **No-store guarantee:** frames streamed for inference, **never persisted** (mirror the childAsr no-store rule); verified by test.
- Output buffer passes the existing pre-playback screen + escalation; Live audio relies on the non-diagnostic system instruction + turn-logging.
- **No "ambient / always-watching" framing** — bounded, parent-started co-play only.

**Acceptance criteria.**
1. Mode is parent-started, time-boxed, with on-air indicator + one-tap stop; server-side parent gate blocks unconsented start.
2. A test proves no frame is persisted.
3. Falls back to audio-only/browser when Live is unavailable.

---

## EPIC F — Trust, Discoverability & Ops Surface · **P2/P3**

**Goal.** Make the breadth and the governance *visible* — to parents (trust), to kids (calm provenance), to the founder (a quality/safety heartbeat next to cost).

**Capabilities.**
- **Shared trust vocabulary** — generalize `ProvenanceBadge` (AI-made badge onto MimicStudio/HeroArcade/avatar picker, calm/low-contrast on kid surfaces) + generalize the CoachAnswerCards "Grounded in N sources" drawer. **Mode-chip stays in Epic A** (single source of truth).
- **"Ask Arbor to…" command group** — add an AI-actions source to the existing `SearchModal` deep-linking into story/comic/handoff/avatar/analyze; entitlement-gated rows show a lock chip. Deep-links **stage** intent, never auto-fire a model call. **Gate before build: validate it adds NET discoverability** rather than becoming a fourth overlapping entry point (rail + AskArbor button + SearchModal already exist). Long-press AskArbor mini-menu **deferred** (fragile gesture).
- **Consent-as-capability-unlock reframe** — re-frame the existing per-purpose consent prompts as unlock cards writing the **same** ledger entries; Skip/Maybe-later always visible + re-openable from Settings. Previews are **static-by-default** (a still sample); the one "hear a sample line" button depends on Epic A. **Ship the consent reframe regardless of previews.**
- **"One thing to try this week" card** — surface the digest's existing `tryThisWeek` as an in-app home/coach card that deep-links into the seeded coach (reuses `setChatInput` + "From your weekly digest" banner). **No new Cloud Scheduler/Function, no push.**
- **Founder quality/safety tile** — extend the existing ADM-1 per-route table (reads `usageRollup`) with quality trend + block-rate + CI pass-rate alongside cost; trust UI shows judge model id / sample rate / suite version. RTL-aware. **Reads the rollup the same way cost is read — no Cloud Logging client.**

**Platform leverage.** Firestore `usageRollup` (existing) + existing components; zero new model calls.

**Safety gate.** Provenance copy holds the G2 no-outcome-claim rule. Consent previews use sample/non-child assets only; declining leaves the feature gracefully disabled (existing `451` gate). Dashboard is aggregate-only, no raw output rendered. Discoverability deep-links still hit each destination's full consent/entitlement gate.

**Acceptance criteria.**
1. AI-made badge + sources drawer reused across surfaces; one mode-chip source of truth (in Epic A).
2. SearchModal exposes a curated top-N AI actions only after net-discoverability validation; locked rows show a chip; deep-link does not execute a model call on arrival.
3. Consent reframe writes identical ledger entries; previews never request mic/child input pre-consent.
4. Founder tile reads quality/safety/pass-rate from `usageRollup`; built only after Epic B produces signal (no empty tile).

---

## Prioritized item table

| P | Item | Epic | Kind | Effort | Depends on | Maturity | Goal(s) |
|---|---|:--:|:--:|:--:|---|:--:|:--:|
| **P0** | `<SpeakButton>`+`useArborVoice()` keystone (browser floor first) | A | enhance | M | — | L2→L3 | 1,3,4 |
| **P0** | Neural TTS seam `/api/tts` (`gemini` live; `google` off) + server output-screen + TTFB-fallback + kill-switch | A | new | M | SpeakButton | L2→L3 | 1,2,5 |
| **P0** | Abort/queue rework (SpeakButton + `pumpTts` barge-in) | A | enhance | S→M | SpeakButton | L1→L3 | 4 |
| **P0** | Live turn-logging sliver (gates default-on Live) | E | new | S | Live token | L0→L3 | 2,5 |
| **P0** | Default-on Gemini Live (model bump + prod token + mode chip + captions + Live meter) | A | enhance | S→M | turn-logging sliver | L2→L3 | 1,2,5 |
| **P0** | Eval/safety CI gate — wire `ai-eval-harness` to coach/council/handoff + **narration** + merged adversarial suite (lexical+semantic, Hebrew) | B | new | L | — | L1→L4 | 2 |
| **P1** | Avatar-bound voice persona — Hero Journey two-voice (depends HARD on `/api/tts` output-screen) | A | enhance | M | TTS seam + server output-screen, eval gate | L1→L3 | 1,3 |
| **P1** | Hebrew voice parity (force he-IL + reviewer harness) — blocked by Hebrew adversarial+semantic decision | A | enhance | S | TTS seam, Hebrew eval suite/decision | L2→L3 | 1,4,5 |
| **P1** | Resolved provenance citations (`knowledge-by-ids` + render delta) | D | enhance | S | — | L3→L3 | 3,4 |
| **P1** | Longitudinal numeric behavior context in coach | D | enhance | M | eval gate | L3→L3 | 1,2 |
| **P1** | RAG grounding (in-process embeddings, reuse scorer signature) | D | enhance | M | — | L3→L3 | 1,2,5 |
| **P1** | In-production quality drift sampling → `usageRollup` | B | new | M | eval gate | L1→L4 | 2,5 |
| **P2** | Media persistence (Storage + erase guard test, fails closed) | C | new | M | **Guy Storage gate** | L3→L4 | 2,3,5 |
| **P2** | Persistent character sheet (consistency reference) | C | new | M | media persistence | L1→L3 | 1,3 |
| **P2** | Voice-audio caching (`audioKey`+erase) | C | enhance | S | media persistence, TTS seam | L3→L4 | 3,5 |
| **P2** | Agentic handoff pack (fixed pipeline) | D | new | L | RAG/citations, eval gate | L3→L4 | 2,3 |
| **P2** | Live Vision co-play ("Look together") | E | new | L | Live default-on, fresh consent | L0→L3 | 2,3 |
| **P2** | Media-appropriateness + C2PA presence check | B | new | M | eval gate | L1→L4 | 2,5 |
| **P2** | Shared trust vocabulary (badges + sources drawer) | F | enhance | S | — | L3→L3 | 3,4 |
| **P2** | "Ask Arbor to…" command group (net-discoverability gate first) | F | enhance | S | — | L2→L3 | 3,4 |
| **P2** | Consent-as-capability-unlock reframe | F | enhance | M | (previews→TTS) | L2→L3 | 3,4 |
| **P3** | Web grounding on professional routes (allowlist) | D | new | S | eval gate | L3→L3 | 2,5 |
| **P3** | Shareable illustrated keepsake (first cut if Wave 2 slips) | C | new | M | persistence, character sheet | L3→L3 | 3 |
| **P3** | "One thing to try this week" in-app card | F | enhance | S | — | L2→L3 | 3 |
| **P3** | Founder quality/safety tile | F | new | M | eval gate, drift sampling | L1→L4 | 4,5 |

---

## Sequencing

**Wave 0 — unblock everything (ship first, in parallel):**
- **`<SpeakButton>` keystone** against the browser floor — decoupled from the backend so the voice epic can't stall. Confirm the floor works on Capacitor targets here.
- **Eval CI gate (Epic B thin cut)** — must land first/alongside so every later prompt/provider/context change is regression-protected on day one, and so Live's affective flags + TTS swaps + Hebrew voice have a gate to clear. Includes spoken-narration coverage from the start.
- **Live turn-logging sliver**, then **Default-on Live + mode chip** — Live default-on does **not** ship until turn-logging lands (the highest-risk audio path never runs with only the system instruction).

**Wave 1 — the real voice + grounded coach:**
- **Neural TTS seam + server-side `screenModelOutput` + abort/queue rework + TTFB-fallback + kill-switch** (config-swap behind the keystone). The server output-screen is the **hard predecessor** of any hero/narration voicing.
- **Avatar voice persona / Hero Journey two-voice** (unblocked by the output-screen + eval gate).
- **Hebrew parity** — blocked until the **Hebrew adversarial suite + Hebrew semantic-screen decision** (Epic B) pass; native-reviewer is the IL ship gate. Line the reviewer up early.
- **Citations + numeric context + RAG** (each eval-gated by Wave 0).

**Wave 2 — persistence + composition (Guy-gated):**
- **Media persistence** is the dependency root for **character sheet**, **voice-audio caching**, and the **keepsake** — none ship until the Storage gate opens AND the erase guard test passes (write path stays disabled until then).
- **Agentic handoff pack** after RAG/citations.
- **Drift sampling** + **media-appropriateness check** once the gate produces signal.

**Wave 3 — net-new surface + ops:**
- **Live Vision co-play** (needs Live default-on + a fresh consent sheet; turn-logging already exists from Wave 0).
- **Trust/discoverability/consent reframe** + **founder tile** (tile last — built only once Epic B emits signal).

**Critical-path one-liner:** Eval gate + SpeakButton + Live turn-logging → default-on Live; TTS seam + server output-screen → voice persona; Hebrew adversarial+semantic decision → Hebrew voice; Storage gate + green erase-guard → all persistence. Everything composes on the safety spine; nothing bypasses it.

---

## Build status (this branch)

- **Wave-0 keystone shipped to `claude/arbor-ai-voice` (build-to-green):** `lib/voice.ts` central controller + `useArborVoice()` + `<SpeakButton>`; `lib/tts.ts` now delegates to the controller (CoachTab pump + EarlyReadingTrack unchanged); HeroScenePlayer + CoachAnswerCards refactored to the keystone; `lib/voice.test.ts` (8 cases). Pure frontend, browser floor, no new vendor, no prod side-effects. `tsc` clean; full suite green. **Prod promotion = Guy merge (Tier-C).**

---

## The one decision

**Approve Epic A (real voice) + the Epic B thin eval gate as the next Arbor AI workstream — ship Wave 0 (SpeakButton on the browser floor, eval CI gate incl. spoken narration, Live turn-logging → default-on Live) this cycle, then the neural TTS seam with its mandatory server-side output screen + the Hebrew safety gate.** It is wiring on proven seams; the only new hard rule is that voice synthesis cannot run on an un-screened span (closing a real gap — hero narration is un-screened today), and Live default-on waits for turn-logging. The eval gate makes every subsequent change provably non-regressive. Everything else (persona, persistence, RAG, handoff pack, vision co-play, trust surface) sequences cleanly behind that yes — and the **Firebase Storage gate** is the only external decision that blocks Epic C.
