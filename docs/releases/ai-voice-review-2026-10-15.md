# AI voice review — 15 October 2026

## Change and boundaries

The existing Talk voice session now ends with an English/Hebrew review of its
screened drafts. The parent can edit, explicitly save each line, or discard it.
Each line names its actual destination: Milestones, or Journal for all other
proposal types. Opening, readback and dismissal do not commit these drafts.
Conversation History continues to retain the transcript; the review says so.

Readback uses the existing central voice controller and the draft's language,
independently of interface language. It reads bounded chunks once, exposes Stop,
reports playback failure, and stops on edits/dismissal. The shared dialog owner
provides focus trapping, Escape, focus restoration and portal placement. Save
and close controls cannot compete with an in-progress commit.

Only explicit Stop retains an in-flight extraction for review. Thread/child
changes, discard and unmount invalidate it. Fatal microphone errors and hidden
panels do not open an automatic review. Safety callbacks remain authoritative.
No prompt/model changes, new voice entry points, provider grants or data
migrations are included.

This completes a bounded part of B-VOICE-04 for the existing Talk session.
The proposed next-action synthesis and future Tonight, practice and visit
rehearsal integrations are not implemented by this release.

## Verification

- Full local suite: 15,426 passed, 10 skipped, one todo; framework, capability
  floors, static/behavioural safety and offline acceptance passed. The existing
  coRegulationScript capability-floor warning remains.
- Actual production draft extraction/callback tests cover explicit-stop late
  responses and rejection after discard, thread changes and remote retirement.
- `app/scripts/voice-close-browser.mjs` bundles the actual review, tray, shared
  dialog stack, voice controller and hook. At 375 px EN/HE it verifies one
  StrictMode readback, chunking, Stop, edit/save/discard, disabled controls during
  a save, Escape, focus restoration, pending/error states, language selection,
  cancellation and lack of horizontal overflow. CI runs it after the build.
- Browser speech, records and provider I/O are synthetic, external requests are
  blocked, and text fonts use offline fallbacks. This is not real microphone,
  signed-in synthesis, Firebase persistence or phone audio-quality proof.
- Local build steps pass using `node --import tsx` for the public-guide step
  because this host disallows the tsx CLI's Unix socket. CI retains the normal
  `npm run build` gate; no build gate is removed.

## Current AI backlog reconciliation

Sources: Claude's historical AI backlog in this repo, ROS Parent/GA backlog,
one-backlog P8 voice pack, and the 10 October model-allocation reference.
Historical experiments superseded by later decisions are not release requests.

| Item | Current evidence / remaining dependency |
| --- | --- |
| B-AI-17 | Hebrew-name redaction deployed in PR #144; deterministic route tests pass. |
| B-PROV-05 | Read-aloud recovery and EN/HE Chirp pins deployed in PR #140. Signed-in synthesis logs and audible EN/HE phone proof remain. |
| B-GA-26 | Observed Live telemetry and price accounting deployed in #142/#143. Shared family caps, fallback accounting, bill verification and operational alerts remain. |
| B-VOICE-04 | This release adds Talk closing review. Next-action synthesis and other voice-door integrations remain. |
| B-VOICE-01 | Tonight voice feature remains; depends on closing review, caps and live prompt evaluation. |
| B-VOICE-02 | Practice/hard-moment voice feature remains; depends on closing review and clinical/safety review. |
| B-VOICE-03 | Visit rehearsal and confirmed packet-question writes remain; require clinical scan and live evaluation. |
| B-VOICE-08 | One-tap Now microphone flow remains; actual phone gesture/permission evidence is required. |
| B-PROV-08 | Approved provider split remains gated on exact-model live evaluations. No routing flip shipped. |
| B-AI-09 | Memory proposal wording/prompt change and live coach evaluation remain. |
| B-AI-11 | Companion-loop live evaluation remains; draft PR #130 is not passing production proof. |
| B-ASKJB-45 | Parent-wishes context allowlist/rules and voice/council/plan evaluation remain. |
| B-AI-18 | Council perspective output and EN/HE rubric remain; depends on wishes context and live evaluation. |
| B-PROV-11 | Approved OpenAI EU project provisioning and EN/HE audio bake-off remain. |
| B-PROV-09 | Alternative Live adapter remains gated on the provider bake-off decision. |
| B-GA-06 | Vertex EU Live token plus ten-turn probe remains. Existing regional exception is not universal fallback authorization. |
| B-BOOK-64 / B-BOOK-67 | Kids image/TTS model changes remain under their separate feature and provider gates. Child Live is not revived. |

Live evaluation run 38754249258 and its retry returned IAM_PERMISSION_DENIED:
`arbor-deployer@arborprd-westeu.iam.gserviceaccount.com` lacks
`aiplatform.endpoints.predict`. The identity authenticates but cannot invoke the
candidate or judge models. A project owner must grant the required Vertex
inference access to the evaluation identity before that evidence can be produced.
Deterministic tests cannot substitute for those live results.

The complete AI backlog is not closed. The pull request records exact CI,
production revision and public health/hosting checks after deployment.
