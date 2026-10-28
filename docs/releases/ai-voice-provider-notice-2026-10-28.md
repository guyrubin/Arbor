# B-PROV-12 — The voice provider notice follows the runtime route (28 October 2026)

Reuses the B-VOICE-06 before-voice notice. No new provider, region or purpose is activated; the approved current Google route is unchanged. This row makes the notice and its acknowledgement follow whatever route the server actually selects.

## Inventory (processor → approved notice → copy)

| Runtime route (`ai/liveResidency.ts`) | Notice id (`ai/voiceProviderNotice.ts`) | Approved copy (`lib/voiceProviderNotice.ts`) |
|---|---|---|
| `google-ai-studio-live`, region `global` (dated exception) | `google-global-realtime-v1` | `elev.wave2Daily.capture.voice.dataUse` + `elev.coachcontract.uses.liveResidencyUndated` |
| `vertex-live`, region `eu` (`LIVE_VERTEX_EU`) | `google-eu-realtime-v1` | `elev.wave2Daily.capture.voice.dataUse` + `elev.coachcontract.uses.liveResidencyEu` (new) |
| no Live route (device speech → text coach) | `device-speech-v1` | `elev.wave2Daily.capture.voice.dataUseDevice` (new) |

A Live notice also describes the device speech fallback the client takes when Live fails ("This device's speech service turns your words into text …"), so that fallback rides the same acknowledgement. Any other provider or region has no notice: `/live/availability` reports Live unavailable and `/live/token` answers `503 voice_provider_unapproved`. Adding a processor means adding an inventory row, reviewed EN/HE copy and a new id; changing processor, region, purpose, retention or copy bumps the version suffix so every parent acknowledges again.

## Behaviour

- `GET /api/live/availability` carries `notice: { id }` for the route a tap would take (config only, no SDK call).
- `POST /api/live/token` requires `noticeAck` equal to that id. Otherwise `428 { code: "voice_notice_required", notice: { id } }`, before any reservation or provider call.
- The one voice path (Ask's voice button, reached from the composer and from the capture bar's "Talk it through"): when the route's notice is not yet acknowledged on this device, the first tap shows it in the existing B-VOICE-06 line under the composer as ONE short line (who hears the words, where, the device fallback, no recording kept; at most 26 words) and one start line ("Tap the voice button again to start."). The next tap acknowledges and starts; nothing (microphone included) is opened before that. Remembered per device and per notice id; a Live notice also covers the device speech fallback it names. Leaving, stopping or a new thread cancels a showing notice and typing instead declines it; either way nothing is acknowledged and the next tap shows it again. A 428 for a changed route shows the new notice and keeps voice off (no silent fallback).
- The capture bar's first-use line is the runtime route's notice (it was the fixed global line); it counts as seen only once it has rendered, and choosing "Talk it through" with that line on screen acknowledges it.
- The data-use panel's spoken-Live residency clause follows the route (EU line on the EU route).

## Entries covered

Every entry that reaches a selected voice provider goes through Ask's voice button: the composer's button and the capture bar's "Talk it through" (which only opens Ask ready to talk). Dictation entries (capture sheet "Note something", the composer's dictate, Tell Arbor about your child) use only the device speech service and never reach a selected provider; they keep their existing device line. Tonight, practice/hard-moment and visit voice doors are not built (B-VOICE-01/02/03); they will start through the same button.

## Receipts

- Inventory/copy and EN/HE guard: `app/src/lib/voiceProviderNotice.test.ts` (every server notice has full and short EN/HE copy and no orphan copy; complete, translated, no Latin brand in HE; global/EU/device lines differ as the route does; acknowledgement per id; storage failure shows again; 428 mapping; start, cancel, decline and retry receipts for the one-tap decision).
- Enforcement: `app/src/routes/voiceProviderNoticeRoute.test.ts` (no ack, wrong-route ack, malformed ack → 428 with nothing reserved or minted; matching ack mints; decline never mints however often; retry after 428 mints once; cancel after acknowledging is charged nothing).
- Client gate: `app/src/components/tabs/voiceProviderNoticeGate.test.ts`; capture bar: `app/src/components/overview/voiceDoor.test.tsx`.
- Rendered EN/HE evidence at 390×844 is listed in the wave report.

## Gate not passed here

Selected-provider evidence for any new processor, its privacy/residency review and B-PROV-11 bake-off results remain required before activating anything beyond the two Google routes above.
