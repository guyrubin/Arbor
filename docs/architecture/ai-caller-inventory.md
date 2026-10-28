# AI caller inventory and eligibility audit (B-AIOPS-08)

Every place the server sends family data to an AI provider, what it really carries, and which eligibility decision runs before the provider is chosen. `app/src/ai/callerInventory.test.ts` keeps this table honest: it finds every provider call and AI egress in `app/src/` and fails when one has no row, when a row names a caller that no longer exists, when a route row's consent, crisis-screen, output-screen or model-route column disagrees with the source, or when the "True-request result" column disagrees with what the existing policy (`selectProvider`) decides for the request written in the row.

Audited 28 Oct 2026 on main `5fb5666f`. The existing foundations are real and stay credited: `routeDecisionFor` runs `selectProvider` on every structured-text and stream call (region, no-training, retention; fail closed with `policy_denied`); images filter regions through `imageRegions()`; TTS, book narration and Live each run their own `selectProvider`; the TTS registry fails closed when its adapter is missing.

## Callers

Columns: Capability, Audience and Data classes are what the call really carries (the "true request"). Decision is the eligibility step that runs today. True-request result is what `selectProvider` decides for the true request against the candidates that step uses, in a production configuration (EU text region, the 28 Oct date for Live): `eligible`, `rejects: <reasons>` (the step currently admits the call only because it evaluates a different request), or `no shared decision` (the step is not `selectProvider`). Crisis screen and Output screen are checked against the route handler's source; "via caller" means the call runs inside a route that screens.

| Key | Capability | Audience | Data classes | Model route | Consent gate | Crisis screen | Output screen | Decision | True-request result | Kill switch | Receipt |
|---|---|---|---|---|---|---|---|---|---|---|---|
| api POST /chat | text_stream | parent | account, child_profile, child_image | coach_high_stakes | companion_attachments | yes | yes | routeDecisionFor | rejects: data_class | — | ai.usage |
| api POST /council | text_stream | parent | account, child_profile | coach_high_stakes | none | yes | yes | routeDecisionFor | eligible | — | ai.usage |
| api POST /voice | text_stream | parent | account, child_profile | analysis_structured | none | yes | yes | routeDecisionFor | eligible | — | ai.usage |
| api POST /extract-log | structured_text | parent | account, child_profile | analysis_structured | none | yes | yes | routeDecisionFor | eligible | — | ai.usage |
| api POST /describe-child | structured_text | parent | child_profile | analysis_structured | none | yes | yes | routeDecisionFor | eligible | — | ai.usage |
| api POST /conversation/proposals | structured_text | parent | account, child_profile | analysis_structured | none | yes | yes | routeDecisionFor | eligible | — | ai.usage |
| api POST /todays-focus | structured_text | parent | child_profile | analysis_structured | none | no | yes | routeDecisionFor | eligible | — | ai.usage |
| api POST /explain | structured_text | parent | child_profile | analysis_structured | none | yes | yes | routeDecisionFor | eligible | — | ai.usage |
| api POST /vision | vision_understanding | parent | child_image | analysis_structured | companion_attachments | yes | yes | routeDecisionFor | rejects: capability, data_class | — | ai.usage |
| api POST /generate-plan | structured_text | parent | child_profile | analysis_structured | none | yes | yes | routeDecisionFor | eligible | — | ai.usage |
| api POST /analyze-behavior | structured_text | parent | account, child_profile | analysis_structured | none | yes | yes | routeDecisionFor | eligible | — | ai.usage |
| api POST /generate-handoff | structured_text | professional | child_profile | handoff_structured | none | yes | yes | routeDecisionFor | eligible | — | ai.usage |
| api POST /digest | structured_text | parent | child_profile | analysis_structured | none | no | yes | routeDecisionFor | eligible | — | ai.usage |
| api POST /generate-adventure | structured_text | child | child_profile | creative_low_risk | none | yes | yes | routeDecisionFor | rejects: audience | — | ai.usage |
| api POST /generate-hero-journey | structured_text | child | child_profile | creative_low_risk | none | yes | yes | routeDecisionFor | rejects: audience | — | ai.usage |
| api POST /generate-bedtime-story | structured_text | child | child_profile | creative_low_risk | none | yes | yes | routeDecisionFor | rejects: audience | — | ai.usage |
| services/council.ts | structured_text | parent | account, child_profile | creative_low_risk | none | via caller | via caller | routeDecisionFor | eligible | — | ai.usage |
| safety/outputScreen.ts | structured_text | internal | account, child_profile | analysis_structured | none | via caller | via caller | routeDecisionFor | eligible | ENABLE_OUTPUT_SAFETY_CLASSIFIER | ai.usage |
| server/plans.ts | structured_text | parent | child_profile | analysis_structured | none | via caller | via caller | routeDecisionFor | eligible | — | ai.usage |
| server/childAsr.ts | speech_recognition | child | child_voice | analysis_structured | voice_processing | via caller | via caller | routeDecisionFor | rejects: capability, audience, data_class | CHILD_ASR_PROVIDER | ai.usage |
| api POST /score-utterance | speech_recognition | child | child_voice | analysis_structured | voice_processing | no | no | routeDecisionFor | rejects: capability, audience, data_class | CHILD_ASR_PROVIDER | ai.usage |
| api narrationCheck | speech_recognition | child | child_voice | analysis_structured | none | no | no | routeDecisionFor | rejects: capability, audience, data_class | CHILD_ASR_PROVIDER | ai.usage |
| api POST /generate-scene | image_generation | child | child_profile | — | none | yes | no | imageRegions | no shared decision | IMAGE_GEN_GLOBAL_DAILY_LIMIT | ai.usage |
| api POST /generate-comic | image_generation | child | child_profile | — | none | yes | no | imageRegions | no shared decision | IMAGE_GEN_GLOBAL_DAILY_LIMIT | ai.usage |
| api POST /generate-avatar | image_generation | child | child_image | — | face_processing | yes | no | imageRegions | no shared decision | IMAGE_GEN_GLOBAL_DAILY_LIMIT | ai.usage |
| api POST /hero-pose | image_generation | child | child_profile, child_image | — | none | no | no | imageRegions | no shared decision | IMAGE_GEN_GLOBAL_DAILY_LIMIT | ai.usage |
| api use createPlanPlatesRouter | image_generation | internal | public | — | none | no | no | imageRegions | no shared decision | IMAGE_GEN_GLOBAL_DAILY_LIMIT | ai.usage |
| api POST /tts | speech_synthesis | parent | account, child_profile | — | none | no | yes | synthesizeSpeech | rejects: data_class | TTS_DISABLED | ai.usage |
| server/tts.ts | speech_synthesis | parent | account, child_profile | — | none | via caller | via caller | synthesizeSpeech | rejects: data_class | TTS_DISABLED | ai.usage |
| server/bookNarration.ts | speech_synthesis | child | child_profile | — | none | via caller | via caller | own selectProvider | eligible | TTS_DISABLED | tts.book log |
| server/planNarration.ts | speech_synthesis | child | child_profile | — | none | via caller | via caller | own selectProvider | eligible | TTS_DISABLED | tts.book log |
| api POST /live/token | realtime_audio | parent | account, child_profile | coach_high_stakes | none | no | no | liveDecision | eligible | LIVE_ENABLED | live session telemetry |
| server/createApp.ts | structured_text | internal | public | — | none | via caller | via caller | registry adapter | no shared decision | — | ai.usage |

Not callers: the provider implementations (`ai/modelRouter.ts`, `ai/claudeVertexProvider.ts`, `ai/mockProvider.ts`, `ai/modelDeadlines.ts`) and the offline evaluation harness (`eval/`), which runs only on demand with synthetic data. The Live audio itself travels from the browser (`lib/geminiLiveClient.ts`) on the token `POST /live/token` mints; `POST /live/turn` screens its turns.

## Gaps found (28 Oct 2026)

The test holds the number of `rejects` and `no shared decision` rows at 16 (shrink-only). Closing one means changing the decision, then this table.

1. **One fixed request for every text caller.** `routeDecisionFor` evaluates `{ audience: "parent", dataClasses: ["child_profile"], locale: "en" }` whatever the caller carries, so the six child-audience routes, photo attachments and vision (`child_image`) and child speech recognition (`child_voice`) are admitted without their real audience or data class being evaluated. The candidates declare no `child` audience and no image or voice class, so passing the true request today would deny those calls. Closing it is a processing decision before it is code: Guy states which provider may process child-audience content, child images and child voice (the DPA and consent basis), then each caller passes its true request.
2. **Images filter by region only.** `imageRegions()` drops non-EU regions in production, but no `selectProvider` decision checks training, retention or audience for image generation, avatar photos or hero poses.
3. **`/tts` declares `public` data.** Coach replies and kid read-aloud can name the child (`child_profile`), which `ttsCandidateFor` does not admit; book narration already declares it correctly.
4. **Book and plan narration depend on `BOOK_TTS_ENDPOINT`.** Their decision is the true request (child audience, `child_profile`), and it is eligible on the EU endpoint. `cloudbuild.prod.yaml` does not set `BOOK_TTS_ENDPOINT`; the default global endpoint is denied in production (fail closed), so name pages work only if the service carries the EU value outside the file (`--update-env-vars` keeps it). Guy confirms the Cloud Run value.
5. **One cross-provider fallback skips the decision.** `modelForGeminiRequest` moves an image-bearing call on a Claude route to the first configured Gemini model without a new `selectProvider` run. It is inactive in production (the chat model is Gemini) and becomes live if GG-3 flips chat to Claude.
6. **Read-aloud declares EU residency but calls the global endpoint.** `ttsCandidateFor` declares its region from `VERTEX_LOCATION` (EU in production), while `synthesizeGoogle` posts to `https://texttospeech.googleapis.com`, the global endpoint; book narration derives its region from the endpoint it calls. The production EU-only policy therefore admits `/tts` on a declared region that is not where the call goes. Fix: call the EU endpoint (as book narration does on `BOOK_TTS_ENDPOINT`) or declare the endpoint's real region and let the policy decide.
7. **Locale is never an eligibility input.** Every shared decision passes `locale: "en"`; no policy uses locale yet.

Kill switches named above are environment variables read in `app/src/config/env.ts`, `app/src/server/imageQuota.ts` or `app/src/safety/outputScreen.ts` (the test checks each name is read there); their behaviour is covered by existing tests (`routes/liveGate.test.ts`, `routes/ttsRegistryDispatch.test.ts`, `routes/imageResting.test.ts`, `config/env.test.ts`, `safety/outputScreen.test.ts`).
