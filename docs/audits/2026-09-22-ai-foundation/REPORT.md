# Arbor AI foundation release — 2026-09-22

## Scope and product direction

User-authorized review, implementation and production deployment. Parent register; Ask Arbor should carry the selected child's permitted context from typed conversation into voice, handle a failed microphone visibly, and offer one practical next step. The complete capability inventory and next-level product plan is in ROS `PAI/projects/arbor/ARBOR-AI-COMPANION-PLAN-2026-09-22.md`.

The app already has coaching/council, spoken coaching, approved memory, conversational capture, photo/document understanding, contextual explanations, daily focus, plans and behavior reflection, digest, stories/adventures, generated artwork, child practice, and professional handoff. This release repairs the shared foundations and validates these routes instead of introducing another disconnected assistant.

## Defects repaired

- Chrome recognition could end before any speech and silently settle the recording. Shared dictation now restarts premature empty sessions within a bounded budget; the post-speech silence clock starts only after a result. The conversational fallback owns its own bounded restart loop. Ask Arbor, quick capture and behavior capture show localized retry/dismiss recovery at the recording surface.
- Live used a retired model and obsolete connection assumptions. Production explicitly selects `gemini-3.8-live` with v1beta constrained ephemeral tokens; microphone capture waits for setup completion. AudioContext, authentication, token and connection startup are bounded and abortable. Interrupting a turn invalidates pending screened audio.
- Voice dropped the recent conversation and approved memory. The server now assembles bounded, same-child, settled conversation and approved unexpired facts after authorization, with explicit private-mode omission. Live removes names/contact details from pinned context. Private or unavailable profile context does not disable redaction of names/contact details in the current message. A response must use an available accepted step, clarify genuinely missing history, and change an approach the parent reports did not help.
- Speech practice incorrectly marked recording inactive when optional browser recognition failed while MediaRecorder was still recording. Optional transcription failure no longer ends recording; true failures release tracks.
- Production image generation preferred a developer-key route with no quota. Vertex-configured deployments now use the configured regional Vertex image provider even when a Live API key is present.
- Legacy model calls lacked common deadlines; text and image operations now have bounded defaults. Google TTS has a bounded request and an explicit quota-project header.
- Six structured-generation routes now screen every returned string before delivery. Vision/photo/child-speech processing verifies child ownership before consent/provider use. Bedtime and conversation proposals now share hourly model quotas.
- Optional empty handoff fields no longer break a valid council response. Routine coaching and handoff prompts avoid inventing unrelated crisis conditions, while crisis screening remains strict. First-person imminent self-harm language now reaches the existing crisis path.
- TypeScript no longer recursively ingests generated/native output and browser captures through allowJs.

## Verification and evidence

All fixtures are synthetic. No actual family history, child image, production credential or bearer token belongs in this evidence directory.

- Baseline: main `e1b4d536e74654de0e75065d5e8f114966d8d2ea` (PR108); release uses existing layouts and design tokens. The prior local screenshot documents the pre-fix recovery placement; it is not falsely labeled a pristine baseline build.
- Browser: final 390px English/Hebrew screenshots and bounded recognition fault-injection metadata are attached separately. Tests use a simulated recognition failure, not the user's physical microphone.
- Real provider smoke: `capability-smoke-initial.json` preserves the initial failures, `capability-smoke-intermediate.json` preserves the intermediate retest, and `capability-smoke.json` records the final suite. Image/audio bytes and ephemeral credentials are omitted. Raw routine-output diagnostics are synthetic and retained to explain false crisis triggers.
- Live continuity: append-only `evals/companion-continuity-v1.results.jsonl`, pinned Gemini2.5Pro judge and unchanged rubric. Earlier failures remain recorded. Historical Claude-judged fixtures were updated with explicit offline revalidation notes, not relabeled as newly live-certified.
- Production smoke script: `app/scripts/ai-production-smoke.mts <exact-commit-sha>` verifies matching API/Hosting revisions, creates its own random synthetic account, checks key AI paths, and deletes that account and its data. Deployment and smoke receipts are recorded after release in ROS.

Current verification:

- TypeScript: passed (`node --max-old-space-size=1024 node_modules/typescript/bin/tsc --noEmit`). Final production build passed; the second build includes corrected behavior-capture placement.
- Full regression suite:7117 passed,8 skipped across461 passing files and1 skipped file (294.34s). Two earlier stale version/provenance assertions were repaired. Image capacity/privacy, deadlines and TTS focused pass:39 tests. The subsequent private-input redaction regression is recorded separately; PR CI must run the full suite on the exact final commit before merge.
- Framework passed43/43 surface stamps; capability floors27 passed,0 failed,1 documented pre-existing warning. Safety eval passed11 risky/9 benign outputs.
- Real providers:22/23 passed in the full run; comic hit transient Vertex429, then passed its targeted retry. All23 have successful execution evidence; the transient failure remains visible. Live minted-token session returned21 audio chunks.
- Live continuity:7/7 passed at2026-09-22T07:39:44.760Z, all cases safe, pinned judge gemini-2.5-pro, generation gemini-2.5-flash, suite1.4.0, voice1.6.0/live1.4.0. Earlier failed runs remain in the JSONL.
- Final independent critic verdict: passed, round3. G0 passed full base plus30 focused private-input/redaction/cadence tests; both new privacy regressions failed before the repair. G1 passed against the observed parent-layout reference. G2 passed: the parent keeps the same form and sees clear retry/typing choices when recording cannot continue. No P0/P1 finding remains in the reviewed release scope. Physical microphones and human listening quality are not certified. Exact-final-commit CI and production checks remain deployment gates.

## Limits and next work

- One cold local voice latency probe missed the 2-second first-token target (3.825s; total4.065s). Functional streaming succeeds; no blanket latency guarantee or human listening-quality claim is made.
- Regional Vertex `gemini-2.5-flash-image` succeeds today. A direct probe of `gemini-3.1-flash-image` in europe-west4 returned404 for this project; do not silently move family imagery to a global endpoint. Google's image-model deprecation requires an approved regional successor before retirement. Transient image capacity errors now return503 with Retry-After and a calm generic message; existing fallback artwork remains usable. The old Vertex SDK also emits its existing deprecation warning; SDK migration is a separate compatibility change.
- Server child ASR remains disabled (`CHILD_ASR_PROVIDER=none`). Browser practice remains available; this release adds no child-processing vendor or clinical-efficacy claim.
- Existing unreviewed clinical knowledge-card coverage and the capability-floor coRegulationScript warning are recorded, not certified away. Existing large frontend chunk warning remains.
- The next product tranche should connect parent-approved actions and outcomes across coach, vision and plans; make typed capture as reviewable as spoken capture; and coordinate one timely helpful offer. These are roadmap items, not capabilities this release pretends to ship.

## Review history

Round1 found missing structured-output screening, authorization/quota gaps and interrupted-audio race. Round2 confirmed those repairs and identified bounded-startup/recovery-placement and continuity quality requirements. Round3 caught and closed a private-input name-redaction edge case with regression-first tests, then passed G0/G1/G2. No capability was dropped; external model/clinical/hardware limits remain explicit. User explicitly requested production deployment, which authorizes merge despite the gauntlet skill's default handoff-only rule.

final result: passed — local release review; production receipt follows the authorized pipeline.
