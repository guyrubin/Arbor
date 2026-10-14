# Read-aloud recovery and cost accounting — 14 October 2026

## Baseline and authority

Application baseline: `fa3f994715e2dba1ef782480c13863dfab0597cf` (Parent V3 + Kids Studio V2). This is an isolated release candidate, not a production deployment. Parallel PRs #138/#139 are not composed here.

Existing owning rows in ROS (no fourth backlog): B-PROV-05 (pinned read-aloud voices), B-PROV-04 (priced usage and admin visibility), B-GA-26 (TTS accounting slice only). B-SHELL-40 still needs real EN/HE phone/desktop describe-question playback evidence. The 10 October model allocation reference is marked ANALYSIS + RECOMMENDATION with M1–M5 decisions open: it is not authority to switch text, realtime, images, or book narration.

## Verified source defects and implementation

- An HTTP 429/500/503 or malformed `/api/tts` capability response previously latched voice initialization for the rest of the session. Only a valid boolean now latches. Concurrent probes share one request, a 5-second deadline includes held auth/body work, and late responses from a retired sign-in cannot activate voice. Playback taps retry a failed probe without awaiting before gesture-bound playback; restoration may take the following tap. Online events also retry. A valid server-off response remains off.
- `voiceSupported()` previously tested browser SpeechSynthesis only, hiding the common control in natural-audio-capable webviews. Capability and browser-floor checks are now separate. This does not add a second voice controller or change the current UI design.
- Stopped/evicted/retired requests now cancel; a stop during auth lookup prevents a later paid POST. Pending prefetch no longer masquerades as finished audio and disables the 1.5-second watchdog. Existing 16-entry prefetch cap, single-consumption token/cached-audio semantics, explicit EN/HE speech language, three-miss browser fallback and synchronous audio gesture priming remain.
- B-PROV-05 candidate configuration pins `en-US-Chirp3-HD-Sulafat` / `he-IL-Chirp3-HD-Sulafat`, a builder selection within the existing approved Chirp 3 HD class. This is not a claim that either voice was auditioned or human-approved. Existing book narration/model/voice paths are unchanged.
- Successful Cloud TTS responses emit character-based `ai.usage` estimates and feed the existing daily cost rollup with zero fabricated text tokens. Unknown/default voice prices remain absent, not zero. Text and audio are never logged by this meter.
- The founder dashboard displays the existing priced 30-day USD rollup, priced/all-call coverage, and the pooled per-active-family estimate. It no longer displays the stale provider-generic euro calculation. The legacy API field remains for compatibility; no FX conversion is invented.

These are source-proven defects present on the release baseline. Their introduction by the interface migration has not been established by bisecting history; authenticated production reproduction remains outstanding.

## Costs and remaining limits

Official Google sources checked 14 October 2026:
- https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd — Sulafat female voice; EN-US and HE-IL supported; named voice format; MP3 synthesis.
- https://cloud.google.com/text-to-speech/pricing — Chirp 3 HD list price $30 per million characters. Thus 1,000 characters are estimated at $0.03 before free allowances, discounts, taxes or FX. No claim of savings against an unknown default voice.

The existing 150,000-character daily user quota is unchanged: at this class's list price its theoretical ceiling is $4.50/day/user. This is NOT proof of the €2/active-family/month objective or a new money cap. A tighter tier allowance is a separate product decision, not silently imposed here. Cancellation cannot undo provider charges already incurred; provider requests which finish server-side can still be counted even if client playback was stopped.

B-GA-26 Live-minute accounting, full voice-tier money/minute enforcement, billing reconciliation, and model/voice bake-offs remain open. Historical rollups are not backfilled. Existing models, provider, residency endpoint, safety screening, HMAC checks, prompts, image quotas, child collection/export/erase registry and book generation/cache policies are not changed. No paid model or voice calls were made for these tests.

## Validation and release checklist

New deterministic regression suites cover retryable configuration errors, malformed/parallel probes, held-auth timeout, stale owner response, natural-only webviews, cancellation before/after dispatch, pending prefetch, eviction, primed-question cancellation, speech-language isolation, character pricing, unknown cost, successful/failed provider metering and production config/UI guards.

Required on exact final candidate: full CI type/lint/tests/framework/floors/offline safety/acceptance/build. Test results are recorded on the PR, not assumed in this note.

Before merge: signed-in EN/HE phone + desktop read-aloud, Stop/navigation, offline/recovery and typed-versus-mic describe question; listen to the selected voices; verify one EN and one HE successful `tts.synthesis`/`ai.usage` event and matching cost rollup. Confirm approved child book narration and avatar remain unchanged. Merge to main is production-sensitive and remains Guy-gated. Do not mark the owning backlog rows SHIPPED merely because source tests pass.
