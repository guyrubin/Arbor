# B-GA-26 — Live usage observation (15 October 2026)

Approved source: ROS `PAI/projects/arbor/reference/ai-model-allocation-2026-10-10.md`, as ratified by `CoS/decisions/log.md` on 11 October. Execution authorized by Guy's “Go” on 15 October after the read-aloud release.

This is the next accounting slice, not closure of B-GA-26 or the AI allocation roadmap.

## Behavior

Live token mint creates a short-lived, owner-bound session record containing the server-resolved family, plan and model. Successful audio setup reports open, then a heartbeat every 15 seconds, and one close after cleanup. Failed mic/socket setup does not count as an opened call. Server clocks determine observed connection time; the client cannot supply minutes, plan, family or money.

Firestore transactions update session state and daily plan aggregates together. Replayed closes cannot double count or resurrect a session. UTC midnight splits duration across days. Missing heartbeats beyond 45 seconds are explicitly incomplete and bounded. A browser crash may leave an unsettled session; this is not billing-grade usage. The existing aiQuota TTL field and account-deletion prefix include session records. No audio, transcript, child names or provider credentials are stored.

The founder dashboard shows observed Live connection minutes separately from cost. Live costs remain unpriced and are explicitly excluded from the estimate. `ai.usage` records have `billingVerified: false` and units `observed_connection_ms`. They must not be interpreted as provider-billed speech or used for charging a family.

Telemetry errors cannot interrupt voice playback or the existing crisis/output screens. Token responses without telemetry IDs remain compatible with rolling deployment.

## Remaining release gates

- B-GA-26: provider-billed audio reconciliation; fallback-loop session measurement; shared family budget with Free 3 / Plus and Family 20 minutes per day; overlap/retry/resume accounting; alerts and exercised typed fallback. No cap is enabled by this slice. Do not enforce caps from incomplete observations.
- Production signed-in EN/HE voice exercise, microphone cancellation, remote-close and dashboard observation require the test account in B-RESID-06. Earlier browser authentication timed out; no live audio result is claimed.
- Text routing requires green evaluations on each resolved model ID before a production flip (B-PROV-08).
- OpenAI bake-off requires the EU project/vendor setup (B-PROV-11); the adapter is conditional on Hebrew results.
- Kids image/narration migrations and EU Live probe remain separate release work.

Provider lifecycle reference: https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens (read 15 October 2026). Token expiry constrains the connection; issuance is not evidence that an audio session opened.
