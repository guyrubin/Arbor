---
type: spec
title: Arbor AI Integration — Current-State Spec
description: Canonical map of Arbor's entire AI-augmented capability layer, with an engaging/efficient/effective scorecard and a prioritized opportunity backlog.
status: current
last_updated: 2026-06-29
supersedes: [ai-pipeline.md, model-routing.md, arbor-ai-wiki.md]
---

# Arbor AI Integration — Current-State Spec

**Date:** 2026-06-29 · **Scope:** the entire AI-augmented layer of the Arbor app (the "Speaking" + every other model-backed capability). **Outcome:** a current-state spec + scorecard; the plan is Guy's to drive from the backlog at the end.

> **One-line verdict:** the *brain* is mature and well-governed — one routed model layer feeding ~17 augmented surfaces, every call redaction-wrapped, escalation-screened, COPPA-gated, and cost-metered. The *voice* is cheap: the premium speaking path (Gemini Live neural audio) is gated off in most deploys, and the default everywhere is the browser's robotic `SpeechSynthesis`. **We sound cheaper than we are.**

---

## 1. System shape

Arbor is **one routed brain → many surfaces**, not a pile of point integrations.

```
            ┌──────────────────────── Augmented surfaces ────────────────────────┐
            │ Coach (text)  Voice coach  Vision  Avatar  Story/Comic  Hero Journey│
            │ Extract-log  Analyze  Plan  Handoff  Digest  Adventure  Child-ASR   │
            └───────────────────────────────┬────────────────────────────────────┘
                                             │  (all calls)
        ┌────────────────────────────────────▼─────────────────────────────────────┐
        │ SAFETY + PRIVACY SPINE  escalation screen · redaction · output screen ·    │
        │                         COPPA consent gate · non-diagnostic contract       │
        └────────────────────────────────────┬─────────────────────────────────────┘
        ┌────────────────────────────────────▼─────────────────────────────────────┐
        │ MODEL ROUTER (ai/modelRouter.ts)                                           │
        │  4 routes → 3 providers, + image gen, + usage telemetry (ai/usage.ts)      │
        └────────────────────────────────────────────────────────────────────────── ┘
```

### 1.1 The router (the spine every surface inherits)

| Route | Default model | Provider | Used by |
|---|---|---|---|
| `coach_high_stakes` | `claude-3-5-sonnet@anthropic` | Vertex (Claude) | Parent coach chat, council |
| `creative_low_risk` | `gemini-2.5-flash` | Vertex (Gemini) | Story, bedtime, hero journey, adventure, comic/scene/avatar prompts |
| `analysis_structured` | `gemini-2.5-flash` | Vertex (Gemini) | Voice stream, vision, extract-log, analyze, plan, digest, child-ASR scoring |
| `handoff_structured` | `gemini-2.5-flash` | Vertex (Gemini) | School/therapist/pediatrician handoff brief |
| *(image)* | `gemini-2.5-flash-image` ("Nano Banana") | Gemini (separate quota pool) | All avatar/story/comic/scene generation; outputs carry SynthID + C2PA |

Providers: `vertex_claude` (high-stakes reasoning), `vertex_gemini` (everything else + multimodal), `gemini_dev` (local-dev key + the separate image quota pool that avoids Vertex 429s under arcade load). Provider selection is automatic: Claude for high-stakes text, Gemini whenever images are attached or the route isn't high-stakes. **Cost discipline is real** — the expensive model is used only where it earns its keep.

### 1.2 The safety + privacy spine (the moat)

Every model call passes through, server-side:

- **Escalation screen** — lexical match on abuse/self-harm/medical-emergency; returns `409` *before* generation; client shows professional-help messaging.
- **Redaction** — child name/age → aliases before the model seam; restored on parse (incl. a streaming restorer for voice). Child PII never reaches the model.
- **Output safety screen** — semantic + lexical; blocks diagnostic labels / medication advice / clinical leakage; replaces flagged text with a non-diagnostic fallback (used by chat, council, voice, analyze, vision). For voice, the buffer is screened **before** TTS plays.
- **COPPA consent gate** — purpose-scoped (`face_processing`, `voice_processing`, `ai_training`); `451` if missing; per-purpose revocable ledger.
- **Non-diagnostic contract** — enforced in prompt + schema across all parent-facing outputs.

This layer is best-in-class for a child-facing app and is a genuine differentiator. It is not the problem.

### 1.3 Measurement

- **Cost:** ✅ `ai.usage` log per call (route/provider/model/tokens/user) + daily Firestore rollup for a founder dashboard. (Maturity L4.)
- **Quality:** ❌ no automated eval gate on live outputs. A PAI `ai-eval-harness` skill exists but is not wired to the routes. We can measure *spend*, not *goodness* — so quality can't be improved-against over time.

---

## 2. The "Speaking" layer (the flagged concern)

"Speaking" is actually **four distinct mechanisms**, and the quality gap lives here:

| # | Mechanism | File | What it is | State |
|---|---|---|---|---|
| 1 | **Realtime voice coach** | `lib/geminiLiveClient.ts` | True bidirectional neural audio via **Gemini Live** (mic→16kHz PCM→Live→24kHz out), ephemeral-token auth | ✅ Built · ⚠️ **gated off** unless server provisions a Live token |
| 2 | **Browser fallback voice loop** | `CoachTab.tsx` + `lib/speech.ts` + `lib/tts.ts` | STT → stream LLM → sentence-chunked **browser TTS** | ✅ Default path in most deploys |
| 3 | **Story/character narration** | `lib/tts.ts` (used by `HeroScenePlayer`, `CoachAnswerCards`, `EarlyReadingTrack`) | Browser `SpeechSynthesis`, single default voice, rate 0.92, no voice selection | ✅ Built · ❌ robotic, locale-poor |
| 4 | **Child articulation ASR** | `server/childAsr.ts` + `lib/speechScorer.ts` | Pluggable kid-pronunciation scorer (Gemini default / Whisper / SoapBox), on-device Web Speech as floor | ✅ Built · ⚠️ phoneme-level (SoapBox) unlicensed |

**Why it disappoints:**

1. **The default voice is the browser's.** Mechanisms 2 and 3 both fall back to `window.speechSynthesis` — flat, robotic, no persona, weak on Hebrew/non-English. In a child-facing, avatar-led, premium-positioned app, this is the single loudest "cheap" signal.
2. **The characters are voiceless.** Avatars and hero comics are visually rich (Nano Banana, SynthID, cel-shaded) and the model even authors SFX + dialogue per beat — but that dialogue is read by the robot voice. The character we spent the most on never gets a real voice.
3. **The premium path is hidden.** Gemini Live (mechanism 1) is the good experience, but it only switches on when the server has a Live token provisioned; otherwise users silently get the browser loop. The best capability is off by default.
4. **Therapy credibility is capped.** Child-ASR default (Gemini multimodal, lenient got/almost/missed) is right for a *game*, but it's not phoneme-level. SoapBox (the clinical-grade path) is scaffolded but unlicensed, so articulation precision — the thing a speech-therapy claim rests on — isn't there yet.

There is **no neural TTS** anywhere (no Gemini TTS / Google Cloud TTS / ElevenLabs). That is the root of #1–#3.

---

## 3. Full capability catalog

All surfaces are **BUILT** unless noted. Route/provider per §1.1; safety/privacy per §1.2.

### Conversational
- **Coach chat** (`/api/chat`, `coach_high_stakes`/Claude) — 30 scholar lenses, lead scholar + age/domain knowledge cards (5 max), parent-approved memory facts, structured `CoachContract` (today plan / parent script / non-diagnostic hypotheses / handoff notes). Output-screened.
- **Scholar Council** (`/api/council`) — 3-agent deliberation (lead + 2 domain-matched) → synthesis; all text safety-screened.
- **Voice coach** (`/api/voice`, streaming) — see §2 #1/#2.

### Vision
- **Arbor Vision** (`/api/vision`, `analysis_structured`) — `observe` (photo → observations / try-today / avoid) and `document` (school report → summary / questions-for-professional / handoff). On-device downscale, 6 MB cap, image-safety gate, `face_processing` consent.

### Generative media
- **Avatar** (`/api/generate-avatar`, image) — 5 tuned styles (storybook/soft3d/watercolor/flat/comichero); descriptor or consent-gated photo; reference photo never stored.
- **Story / Bedtime** (`/api/generate-story`, `/api/generate-bedtime-story`) — generate-and-discard, non-pathologizing, `ai_training` off by default.
- **Hero Journey** (`/api/generate-hero-journey`) — **fixed vetted plot spine**; model writes only narration + personalized choices + SFX + dialogue; full Hebrew support.
- **Comic / Scene** (`/api/generate-comic`, `/api/generate-scene`) — cel-shaded panels with avatar-consistency steering; **memory-only LRU cache** (cross-session persistence deferred to Firebase Storage, Guy-gated → repeat regen cost).

### Structured intelligence
- **Extract-log** (`/api/extract-log`) — free text → structured `BehaviorLog`.
- **Analyze behavior** (`/api/analyze-behavior`) — logs → trends/triggers/insights; numeric fields kept even if free-text blocked.
- **Generate plan** (`/api/generate-plan`) — challenge → phased `ActionPlan` with scripts.
- **Handoff brief** (`/api/generate-handoff`, `handoff_structured`) — audience-tuned (teacher/therapist/pediatrician), crisis-escalation trigger.
- **Weekly digest** (`/api/digest`) — deterministic stats baseline + AI narrative (AI optional; deterministic fallback always ships).

### Child practice / play
- **Child ASR scoring** — see §2 #4.
- **Cognitive Adventures** (`/api/generate-adventure`) — schema-normalized scenarios (≤4 scenes, 3 choices, always a correct one); curated fallback on failure.
- **Development Copilot** — **no AI**; deterministic signal aggregation → clinician summary (by design).
- MimicStudio / HeroArcade / WorldScene / FeelingsLab — play surfaces; no generative calls.

### Entry points / quota
- **AskArbor button**, **AI rail**, **Search modal** — navigation/command, no model calls.
- **Entitlements** (`/api/entitlement`) — Free/Plus/Family quotas; `402` on coach-message limit.
- **GDPR** — `/api/privacy/export`, `/api/privacy/erase` (hard delete of memory ledger + child doc + shares + consents).

---

## 4. Scorecard — engaging / efficient / effective

Scored 1–5 against Guy's three goals. The capability-maturity column uses the ROS scale (L0 ad-hoc → L5 delegated).

| Cluster | Engaging | Efficient | Effective | Maturity | Note |
|---|:--:|:--:|:--:|:--:|---|
| Model router + providers | — | **5** | **5** | L4 | Right model per route; cost-metered. Quietly excellent. |
| Safety + privacy spine | — | 4 | **5** | L4 | The moat. Best-in-class for child-facing AI. |
| Coach (text) + council | **4** | 4 | **5** | L3 | Rich, lens-driven, well-governed. |
| **Voice / Speaking** | **2** | 3 | 3 | L2 | **Premium path gated off; default is robotic browser TTS.** ← the gap |
| Vision | 4 | 4 | 4 | L3 | Strong, consent-gated. |
| Generative media (avatar/comic/story) | **5** | 3 | 4 | L3 | Genuinely differentiated; cache not persisted → repeat spend. |
| Structured intelligence | 3 | 4 | **5** | L3 | Professional-grade, deterministic fallbacks. |
| Child-ASR | 3 | 4 | 3 | L2 | Fine as a game; not phoneme-level → therapy claim capped. |
| **Quality measurement** | — | **1** | **2** | **L1** | Cost measured; **output quality not** → can't improve over time. |

**Read:** engagement is carried by generative *media*; it's dragged down by *voice*. Efficiency is strong on routing/cost, weak on (a) un-persisted media cache and (b) absent quality measurement. Effectiveness is high wherever safety governs output, capped where the *speaking* and *ASR precision* fall short.

---

## 5. Findings (ranked)

1. **No neural TTS — the app sounds cheap.** Voice output across coach-fallback + all narration uses the browser engine. Highest-visibility, highest-leverage gap. *(Engaging)*
2. **The premium voice path is off by default.** Gemini Live is built but only activates when a server token is provisioned; most users silently get the worse loop. *(Engaging/Effective)*
3. **Characters are voiceless.** Avatar/hero dialogue + SFX are authored but read by the robot voice; no avatar-bound voice persona. *(Engaging)*
4. **Quality is unmeasured.** No eval gate on coach/voice/vision outputs; the `ai-eval-harness` skill isn't wired to live routes. We can't prove or track "better." *(Effective/Efficient)*
5. **Generated media isn't persisted.** Scene/comic cache is memory-only; cross-session = regenerate = repeat spend. *(Efficient)*
6. **Child-ASR precision capped.** Phoneme-level (SoapBox) scaffolded but unlicensed; therapy credibility limited to encouragement. *(Effective)*
7. **Locale voice gap.** Hebrew (flagship market) is poorly served by browser TTS specifically. *(Engaging/Effective)*

---

## 6. Opportunity backlog (Guy drives)

Framed in the ROS capability-optimization format (P0 = highest leverage). See `ai-integration-backlog-2026-06-29.md` for the elevated, sequenced version.

| P | Capability | Now → Target | Move | Goal it serves |
|---|---|:--:|---|---|
| **P0** | **Neural TTS layer** | L2 → L3 | Add a `tts` provider seam mirroring the `childAsr` seam: Gemini TTS / Google Cloud TTS / ElevenLabs, browser as floor. Route narration + voice-fallback through it. | Engaging |
| **P0** | **Default-on premium voice** | L2 → L3 | Provision the Gemini Live token in prod; make Live the default with graceful fallback (already coded). | Engaging/Effective |
| **P1** | **Avatar-bound voice persona** | L1 → L3 | One stable neural voice per avatar/hero; speak comic dialogue + SFX in-character. | Engaging |
| **P1** | **Quality eval gate** | L1 → L4 | Wire `ai-eval-harness` to coach/voice/vision with LLM-as-judge rubrics; gate on regression before ship. | Effective/Efficient |
| **P2** | **Persist generated media** | L3 → L4 | Move scene/comic cache to Firebase Storage (Guy-gated); dedup by `comicKey`. | Efficient |
| **P2** | **Hebrew voice parity** | L2 → L3 | Validate neural TTS quality for `he-IL`; native-reviewer gate. | Engaging/Effective |
| **P3** | **Phoneme-level child-ASR** | L2 → L3 | License SoapBox (seam ready) to unlock clinical-grade articulation scoring. | Effective |

---

## 7. The one decision

**Approve a "give Arbor a real voice" workstream — P0 neural-TTS seam + default-on Gemini Live — as the next Arbor AI epic?** Everything else sequences behind that yes. The seam pattern already exists (`childAsr.ts`), the safety screen already gates pre-playback, and Live is already coded — this is wiring, not invention.
