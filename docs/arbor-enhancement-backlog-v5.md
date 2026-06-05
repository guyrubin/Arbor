# Arbor — Enhancement Backlog v5 (The Multimodal, Generative-UI Leap)

**Date:** 2026-06-04
**Basis:** Deep read of the actual interaction surface — `CoachTab.tsx`,
`ArborContext.tsx`, `ai/modelRouter.ts`, `lib/speech.ts`, `lib/tts.ts`,
`lib/image.ts`, `BehaviorsTab.tsx`, `contracts/coach.ts`. Grounded in code.
**Relationship to prior docs:** v3 wired breadth; v4 put real value behind the AI
depth (scholars, evidence base, safety). **v5 is the interaction leap** — the
thing that turns Arbor from "a well-organized parenting chatbot with forms" into a
multimodal, generative, integrated product. This is the "next level."

---

## 1. The core finding — Arbor pays for frontier models and uses them like a 2010 text box

Arbor runs on Gemini and Claude-on-Vertex — natively multimodal, vision-capable,
audio-capable, realtime-capable models. The product uses **~1% of that surface**:

> **Every AI call is `parts: [{ text: prompt }]` → JSON → flattened to a markdown
> wall.** The model never sees a photo, never hears a voice, and its rich
> structured answer is downgraded to prose and then *regex-scraped back*.

Three structural facts, all verified:

1. **The model is blind.** Every provider call sends text only
   (`modelRouter.ts:80, 124, 138`). Photos attached to a behavior log
   (`image.ts` → `photoAttachment`) are stored and displayed but **never sent to
   the AI** — no `inlineData`/image part exists anywhere. The room, the drawing,
   the rash, the school letter, the messy morning — the model cannot see any of it.
2. **The model is deaf.** "Voice" is browser `SpeechRecognition` dictation
   (`speech.ts`) used only to *fill the behavior-log form* (`BehaviorsTab.tsx:98`).
   It is transcription, not audio understanding, and it is not even available in
   the Coach. TTS is browser `SpeechSynthesis` for reading stories. No realtime
   voice, no tone/affect, no hands-free.
3. **The output is text, not interface.** The server returns a rich structured
   `contract` (today plan, parent script, avoid, observe, escalate-if, hypotheses,
   six-frame routing, handoff notes). **The client throws it away** and renders
   only `data.text` (`ArborContext.tsx:544`) — a markdown blob via
   `TypewriterMarkdown` — then *regex-greps* "risk level: high" back out of the
   prose (`CoachTab.tsx:13`). Structured → text → regex. The "Log this" / "Save to
   plan" buttons then `replace(/[#*]/g,"")` and truncate that prose into another
   form. Lossy at every hop.

The product owner's three words map exactly:
- **"no intuitive input / camera"** → no camera capture, no photo-to-AI, no real voice. Input is a text field and a multi-field form.
- **"no off-the-shelf capabilities"** → vision, audio understanding, realtime voice, OCR, on-device camera — all available in the models/platform, all unused.
- **"not integrated / not visual enough"** → modalities don't flow as data; structured AI output is rendered as a paragraph.

---

## 2. The thesis — capture in the moment, let the AI perceive, answer as living interface

A stressed parent in a hard moment will not type three paragraphs. They will point
a camera, or speak ten words. The product that wins is the one where:

1. **Capture is one thumb / one photo / ten spoken words** — and richer than text.
2. **The AI perceives** what was captured (sees the scene, hears the tone, reads
   the document) instead of asking the parent to describe it.
3. **The answer is a living interface** — a checklist you can act on, a script with
   a "say this aloud" button, a risk panel that's actually computed — not a wall to
   read while a child screams.
4. **Every modality is one stream of structured signals** the coach reads back, so
   the app feels like one nervous system, not nine tabs.

This is also the **retention moat**: frictionless multimodal capture in the hard
moment is the habit; perception is the wow; generative UI is the premium feel.

---

## 3. Interaction maturity scorecard (today)

| Dimension | State | Rating |
|---|---|---|
| **Input modality** | Text box + structured forms; dictation only fills a form | ●○○○○ |
| **Camera / vision** | Photo is a decorative log thumbnail; model never sees it | ○○○○○ |
| **Audio / voice** | Local dictation→text; TTS for stories; no audio understanding, no realtime | ●○○○○ |
| **AI output rendering** | Rich structured contract flattened to markdown, regex-scraped | ●●○○○ |
| **Document intelligence** | None — no OCR, no school-report / form ingest | ○○○○○ |
| **Cross-modality integration** | Linked by navigation + lossy text dumps, not shared data | ●○○○○ |
| **Visual deliverables** | Print-to-PDF text reports; one illustrated story player | ●●○○○ |

---

## 4. Strategic bets (epics)

| Epic | One-liner | The unlock |
|---|---|---|
| **M1 — Camera-first capture** | Photograph or record the moment (scene, drawing, document, rash, room) and a short voice memo, from Home in one tap. | Effortless, richer-than-text input in the exact moment. |
| **M2 — Arbor can see & hear** | Send image + audio parts to Gemini/Claude; the coach analyzes the photo, transcribes + reads the *tone* of a voice memo, OCRs a document. | The off-the-shelf capability that's sitting unused; the product's "wow". |
| **M3 — Generative visual answers** | Render the structured `contract` as an interactive card stack (plan checklist, "say this" script card, live risk panel, frame chips) — never a markdown wall. | Premium, actionable, calm-in-the-moment UI. |
| **M4 — Realtime voice coach** | Hands-free "talk to Arbor" via streaming/Live voice — speak mid-meltdown, hear calm guidance, no typing. | The genuinely novel, defensible interaction. |
| **M5 — Document & artifact intelligence** | Camera/upload a school report, daycare form, or clinician note → OCR + structure → memory, handoff, plan. | Turns paperwork into the product's data; huge real value for parents. |
| **M6 — One nervous system (deep integration)** | Photos/voice/logs/coach all emit structured signals into one child timeline the coach reads back. | Kills the "nine siloed tabs" feel; the loop becomes data. |
| **M7 — Visual deliverables** | Illustrated routines, visual social stories, a visual growth timeline, shareable visual one-pagers. | Output worth sharing; marketing surface. |

---

## 5. Backlog

Priority: **P0** now / **P1** next / **P2** later. V/E = Value/Effort (H/M/L · S/M/L).
Off-the-shelf accelerator noted where it cuts effort.

### M1 — Camera-first, voice-first capture

| ID | Item | Pri | V/E | Off-the-shelf |
|---|---|---|---|---|
| **MM-1** | **"Capture the moment" from Home**: one primary action → camera/photo OR 10-sec voice memo OR quick type, then Arbor takes it from there. Replaces "fill a form" as the default entry. | P0 | H/M | PWA `getUserMedia` / `<input capture>`; existing `image.ts`, `speech.ts` |
| **MM-2** | **In-the-moment voice memo**: record a short clip in the Coach and on a log (not just dictation-to-form); store + transcribe. | P0 | H/M | `MediaRecorder` + Web Speech / server STT |
| **MM-3** | **Live camera capture (not just file pick)**: `capture="environment"` + a framing UI so a parent snaps the scene/drawing/document in-app. | P1 | M/S | native `<input capture>` |
| **MM-4** | **Multi-attach on any coach turn**: a message can carry text + photo(s) + a voice memo together. | P1 | H/M | — |

### M2 — Arbor can see & hear (the unused capability)

| ID | Item | Pri | V/E | Off-the-shelf |
|---|---|---|---|---|
| **VIS-1** | **Multimodal prompt parts.** Extend `GenerateJsonOptions` + every provider to accept image/audio parts (`inlineData`), not just `prompt` text. This is the single enabling change for M2/M5. | **P0** | **H/S** | Gemini/Vertex/Claude all support image parts natively |
| **VIS-2** | **Photo-aware coaching**: attach a photo to a coach question ("why won't she sleep here?" + a photo of the room; "what is this?" + a drawing) and have the model reason over the image, non-diagnostically. | P0 | H/M | VIS-1 |
| **VIS-3** | **Voice-memo understanding**: transcribe *and* let the model use the audio for tone/affect cues ("sounds like bedtime exhaustion"), with explicit non-diagnostic framing. | P1 | H/M | Gemini audio input / Vertex STT |
| **VIS-4** | **Behavior-log photos become signal**: when analyzing patterns, pass attached log photos to the model (context, environment), not just text fields. | P1 | M/S | VIS-1 |
| **VIS-5** | **Safety on multimodal input**: run escalation screening on transcripts/OCR text and add an image-content safety gate before any vision call. | **P0** | H/M | pairs with v4 SAFE-1/2 |

### M3 — Generative visual answers (stop rendering markdown)

| ID | Item | Pri | V/E |
|---|---|---|---|
| **GUI-1** | **Render the structured `contract`, not `.text`.** Stop discarding the server `contract`; render a **card stack**: *What may be happening* (hypotheses w/ confidence), *Today plan* (interactive checklist), *Parent script* (a "say this" card), *Avoid / Observe / Escalate* panels, *Frame chips*. Delete the regex `parseRisk` — use `contract.riskLevel`. | **P0** | **H/M** |
| **GUI-2** | **"Say this aloud" on the parent-script card** (TTS) so a parent can hear the exact words in the moment. | P0 | M/S |
| **GUI-3** | **Actionable cards = structured handoff**: "Add to plan", "Approve memory", "Add to handoff" carry the *structured fields* (not stripped prose) into Plans/Memory/Reports. | **P0** | H/M |
| **GUI-4** | **Generative response layout**: card set adapts to content (risk-high surfaces the escalation panel first; a script-only answer leads with the script). | P1 | M/M |
| **GUI-5** | **Inline visualizations in answers**: when the coach references a pattern, render the real sparkline/trend inline (reuse `Sparkline`/charts), not a sentence. | P1 | M/M |

### M4 — Realtime voice coach

| ID | Item | Pri | V/E | Off-the-shelf |
|---|---|---|---|---|
| **RT-1** | **Hands-free voice session**: press-and-hold "Talk to Arbor", stream audio, hear a calm spoken answer — for use mid-moment without typing or reading. | P1 | H/L | Gemini Live API / streaming TTS |
| **RT-2** | **Spoken-answer mode for any coach turn**: a toggle to auto-speak the script + today plan. | P1 | M/S | `tts.ts` |
| **RT-3** | **Voice barge-in + short-turn dialogue** tuned for stress (short sentences, one step at a time). | P2 | M/L | RT-1 |

### M5 — Document & artifact intelligence

| ID | Item | Pri | V/E | Off-the-shelf |
|---|---|---|---|---|
| **DOC-1** | **Snap a document → structured data**: photograph a school report / daycare form / clinician note → OCR + extract → proposed memory + handoff fields (parent approves). | P1 | H/M | Gemini vision OCR; Drive picker MCP for upload |
| **DOC-2** | **Camera → Teacher Handoff**: capture the week's artifacts and let Arbor assemble a recipient-ready brief (ties to v3 reports). | P1 | M/M | VIS-1 + reportExport |
| **DOC-3** | **Milestone-from-photo**: a photo/video of the child doing a skill becomes an "Observed" milestone with the image as evidence (non-diagnostic). | P2 | M/M | VIS-1 |

### M6 — One nervous system (deep integration)

| ID | Item | Pri | V/E |
|---|---|---|---|
| **INT-1** | **Unified child signal timeline**: logs, photos, voice memos, coach turns, plan outcomes, milestone changes all write a typed `signal` to one stream. | P1 | H/M |
| **INT-2** | **Coach reads the timeline**: recent signals (incl. photo/voice findings) are part of coach context automatically — no re-describing. | P1 | H/M |
| **INT-3** | **Replace lossy text-dump actions** (`replace(/[#*]/g,"")` + truncate) everywhere with structured signal passing. | P0 | M/S |
| **INT-4** | **Today's Focus + Home driven by the timeline** (ties v4 ART-5): the daily card reflects the latest real signals and active lens. | P1 | M/S |

### M7 — Visual deliverables

| ID | Item | Pri | V/E |
|---|---|---|---|
| **VZ-1** | **Visual growth timeline**: an illustrated, scrollable history (moments, wins, milestones, photos) — the emotional "look how far we've come". | P1 | M/M |
| **VZ-2** | **Illustrated routines & visual social stories**: generate a picture-card routine (morning, bedtime) the child can follow. | P2 | M/M |
| **VZ-3** | **Shareable visual one-pager**: a designed (not print-to-PDF-text) teacher/clinician summary with the child's strengths, current focus, and what helps. | P1 | M/M |
| **VZ-4** | **Visual answer export**: save a coach card stack as an image/one-pager to share with a co-parent. | P2 | M/S |

---

## 6. Recommended sequence — the enabling spine first

**Now (P0 — unlock multimodal + fix the output, in this order):**
1. **VIS-1** — multimodal prompt parts (the one change that unlocks everything else).
2. **GUI-1 + GUI-3** — render the structured contract as actionable cards; structured handoff. *(Biggest perceived-quality jump; uses data that already exists server-side.)*
3. **MM-1 + MM-2** — camera/voice "capture the moment" from Home.
4. **VIS-2** — photo-aware coaching (the wow).
5. **VIS-5** — multimodal safety gate (must ship with VIS-1/2; pairs with v4 SAFE).
6. **GUI-2** — "say this aloud" script card.
7. **INT-3** — kill the lossy text-dump handoffs.

**Next (P1):**
MM-3/4 · VIS-3/4 · GUI-4/5 · DOC-1/2 · INT-1/2/4 · RT-1/2 · VZ-1/3.

**Later (P2):**
DOC-3 · RT-3 · VZ-2/4.

### Top 5 moves that take Arbor to the next level
1. **VIS-1 → VIS-2** — make Arbor *see*. One enabling change + photo-aware coaching turns a text bot into a multimodal product. The capability is already paid for.
2. **GUI-1 + GUI-3** — render the structured answer as a living, actionable card stack instead of a markdown wall (and stop regex-scraping your own data).
3. **MM-1 + MM-2** — camera/voice capture in the moment: the retention habit.
4. **RT-1** — hands-free realtime voice coach: the genuinely novel, defensible interaction no forms-app has.
5. **INT-1 → INT-3** — one signal timeline the coach reads back: the app finally feels like one intelligence, not nine tabs.

---

## 7. Why this "guarantees success" (the strategic logic)

- **Retention** comes from frictionless capture in the hard moment (MM-1/2): a
  parent who can snap a photo or speak ten words will log; a parent who must fill a
  form will not. Logging is the top of every Arbor loop.
- **Differentiation** comes from perception (VIS-2, RT-1): "the parenting app you
  can *show* and *talk to*" is a category claim no forms-and-chat competitor can
  match, and it's built on capability Arbor already pays for.
- **Premium feel** comes from generative visual answers (GUI-1): the same model
  output rendered as an interactive workspace instead of prose is the difference
  between "a chatbot" and "a product".
- **Real value / trust** comes from document intelligence (DOC-1) and the safety
  gate (VIS-5): turning a parent's paperwork into structured, shareable insight,
  safely, is concrete utility, not novelty.

---

## 8. Guardrails

Non-diagnostic on every modality (a photo/voice answer is *more* tempting to
over-read — keep "may/could/observe" discipline and the escalation gate). Vision
and audio run through the same safety screen as text (VIS-5). Child images/audio
are sensitive data: on-device downscale where possible, parent-approved before any
upload, covered by the v4 memory/sharing expiry. No child-facing autonomous AI;
realtime voice is parent-facing.

---

## 9. One-paragraph brief for the product owner

Arbor runs on multimodal frontier models and uses them as a text box: every call
is text-only, photos are never shown to the AI, "voice" just fills a form, and the
model's rich structured answer is flattened to a paragraph and then regex-scraped.
The next level is not more tabs — it's a new interaction model. Make one enabling
change (multimodal prompt parts), then let parents capture the moment with a camera
or ten spoken words, let Arbor actually see and hear it, and render the answer as a
living card stack you can act on and hear aloud — with a realtime voice coach for
the moments when typing is impossible. That is a defensible, premium, habit-forming
product built on capability you already pay for. Ship VIS-1 → GUI-1 → MM-1 → VIS-2
and Arbor stops being a chatbot with forms and becomes the parenting app you can
show and talk to.
