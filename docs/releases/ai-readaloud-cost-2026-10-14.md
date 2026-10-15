# Read-aloud recovery and cost accounting — 14 October 2026

## Baseline and latest authority

Application baseline: `fa3f994715e2dba1ef782480c13863dfab0597cf` (Parent V3 + Kids Studio V2). Isolated release candidate, not deployed. Parallel PRs #138/#139 are not composed here.

The authority is ROS `CoS/decisions/log.md`, entry **2026-10-11 — Arbor Parent: Guy takes the defaults on every GUY row**. It ratifies B-RESID-08 / M1–M5. The older 10 October model-allocation reference still says decisions are open in its header; that header is stale and must not override the later decision.

The ratified target remains: M1 an OpenAI EU project for the bake-off (Guy's provisioning act); M2 voice per tier once the adapter exists; M3 text routing after the per-model evaluations pass; M4 the EU image successor through Kids B-BOOK-64; M5 the Vertex EU Live probe through GA B-GA-06. Approval is not evidence that provisioning, adapters, evaluations or live acceptance are complete. This patch implements the shared read-aloud and TTS accounting slice without prematurely activating other target models.

Owning rows (no fourth backlog): B-PROV-05 pinned read-aloud voices; B-PROV-04 priced usage/admin visibility; B-GA-26 TTS accounting slice only. B-SHELL-40 still needs actual EN/HE phone/desktop describe-question playback evidence. The full AI backlog is not closed by this PR.

## Source defects and implementation

- A non-OK or malformed `/api/tts` capability response previously latched initialization for the rest of the session. Only a valid boolean now latches. Concurrent probes share one request; a five-second deadline includes held auth/body work; retired sign-in responses cannot activate voice. Playback taps retry a failed probe without awaiting before gesture-bound playback; recovery may take the following tap. Online events retry too. A valid server-off response stays off.
- Capability is no longer confused with browser SpeechSynthesis availability. Natural-only webviews retain a retry control even after three failed starts. Where a browser floor exists, the existing three-miss degradation remains. No new controller or parent/kids redesign is introduced.
- Stopped/evicted/retired requests cancel. Stop during auth lookup prevents a later paid POST. Pending prefetch no longer disables the 1.5-second watchdog. The existing 16-entry bound, single-consumption cache, explicit EN/HE language and synchronous gesture priming remain.
- B-PROV-05 candidate pins: `en-US-Chirp3-HD-Sulafat` and `he-IL-Chirp3-HD-Sulafat`. This is a builder selection in the approved Chirp 3 HD class, not a claim of a completed audition. Book narration/model/voice paths stay unchanged, including restored read-aloud for legacy books.
- Successful Cloud TTS emits character-based `ai.usage` and feeds daily cost rollups without fabricated text tokens. Unknown/default voice prices are absent, not zero. This meter logs neither text nor audio.
- The founder dashboard shows priced 30-day USD spend, priced/all-call coverage and the pooled per-active-family estimate, instead of the stale generic euro estimate. The client cost contract matches the server and allows older responses during rollout. The legacy euro field remains for compatibility; no FX is invented.

These defects are present on the baseline. This review has not established by history bisect that the interface migration introduced them; authenticated production reproduction remains outstanding.

## Cost boundary

Official sources checked 14 October 2026:
- https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd — Sulafat female voice, EN-US and HE-IL supported, named voice format and MP3 synthesis.
- https://cloud.google.com/text-to-speech/pricing — Chirp 3 HD list price $30/million characters; 1,000 characters = $0.03 before free allowances, discounts, taxes or FX. Savings against an unknown default voice are not claimed.

The existing 150,000-character daily user allowance is unchanged: its theoretical cost at this class's list price is $4.50/user/day. This does not establish the €2/active-family/month objective or a monthly money cap. Cancellation cannot reverse charges already incurred. A request completed server-side can still be metered after client playback stops.

Still unfinished: B-GA-26 Live-minute accounting, complete tier quota enforcement, billing reconciliation, model/voice bake-offs and the other approved allocation work. Historical rollups are not backfilled. Existing provider routing, residency endpoints, safety screening, HMAC checks, prompts, image quotas, child export/erase and book generation/cache policies are not changed. Implementation tests use mocks, not paid model/voice calls.

## Validation and release

New deterministic suites cover configuration errors, malformed/parallel probes, held-auth timeout, stale owner responses, natural-only webviews, cancellation, prefetch/eviction, primed-question cancellation, language isolation, pricing, unknown costs, provider metering, production config/UI guards and the client/server cost contract.

Required for the exact final candidate: full CI type/lint/tests/framework/floors/offline safety/acceptance/build. Actual results are recorded on PR #140, not assumed in this note.

Before merge: signed-in EN/HE phone and desktop playback; Stop/navigation; offline/recovery; typed-versus-mic describe question; audition the selected voices; verify one EN and one HE successful `tts.synthesis`/`ai.usage` event and matching rollup. Confirm child book narration and avatar unchanged. Main is production-sensitive. Do not mark rows SHIPPED from source tests alone.

## Recovery follow-up — 15 October 2026

- Production frontend and API still identify `fa3f994715e2dba1ef782480c13863dfab0597cf`; PR #140 had not been deployed.
- Reproduced the remaining CI failure: the deployment guard counted model names inside YAML comments as duplicate runtime settings. The guard now compares exact deployed key/value entries and still rejects duplicate keys or unexpected values.
- Three consecutive natural-voice failures now open a 30-second cooldown instead of disabling natural speech for the rest of the session. The next speech request after that window retries natural voice. No background synthesis or automatic replay is introduced; explicitly selecting basic voice or retiring the session cancels recovery.
- Late natural start/end/error callbacks cannot reclaim or terminate the browser fallback after it has taken over.
- Focused validation: 82 voice/configuration/usage/hook/contract assertions passed; TypeScript passed. Full candidate CI is required separately.
- Official Google voice catalog and list pricing were rechecked on 15 October; both candidate Sulafat locale names remain listed. This does not replace an authenticated audition or a real synthesis/cost check.
- The browser reached the production sign-in screen. Authenticated playback and phone validation remain outstanding; no production fix is claimed from unit tests.
