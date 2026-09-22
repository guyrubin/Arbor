# Client recording verification — 2026-09-22

Scope: built-app recording startup and recovery, using the existing synthetic sandbox fixture. No actual family data was entered or saved.

The local app was rebuilt with `npm run build` and served from `dist/server.cjs` on port 4807. The final browser bundle is `index-CX8e3pOW.js`; the server runs without Vite HMR. The existing Chrome Playwright session `arbor-ai` was used at 390 × 844.

## Fault and outcomes

The browser recognition constructor was replaced in the test session only: every `start()` fires an empty `onend` after 10 ms. `/api/live/availability` is intercepted as unavailable, exercising the shared browser-recognition path. This is fault injection, not a test of the user's physical microphone or Chrome's external speech service.

| Surface | Observed attempts | Outcome | Recovery control height |
|---|---:|---|---:|
| Ask, English | 6 | Still listening at attempt 2; then persistent recovery beside Talk | 44 px |
| Ask, Hebrew | 6 | Still listening at attempt 2; then localized recovery beside דברו; RTL | 44 px |
| Today → Capture with voice | 3 | Recovery remains inside the Quick Log modal, beside the retained typed form | 44 px |
| Journal/Behaviors → Voice | 3 | Expanded capture form displays recovery beside Speak | 44 px |

All measured recovery notices were within the visible viewport. All routes had `scrollWidth === clientWidth === 375` inside the 390 px desktop Chrome viewport; the remaining 15 px is the native vertical scrollbar. Captured console errors and page exceptions were empty during each tested interaction.

English Ask also verifies the recovery action: Try voice again reopens listening; explicit End voice conversation closes the overlay, clears recovery, and leaves the attempt counter unchanged after 2.2 seconds. This distinguishes a deliberate stop from a failed recording.

The first Behaviors rendering exposed a real placement defect: its Voice tile scrolls to an expanded form, leaving a notice attached to the top capture bar offscreen. The final implementation renders the notice in the expanded form while it is open, and at the top only while collapsed. Its Speak and Close targets now meet the same 44 px floor. The built app was rebuilt and this actual flow was rechecked afterward.

## Evidence

- [English listening through retries](final-coach-en-listening-390.jpg)
- [English persistent recovery](final-coach-en-recovery-390.jpg)
- [Hebrew listening through retries](final-coach-he-listening-390.jpg)
- [Hebrew persistent recovery](final-coach-he-recovery-390.jpg)
- [Quick Log recovery](final-quicklog-en-recovery-390.jpg)
- [Behaviors expanded-form recovery](final-behaviors-en-recovery-390.jpg)
- [Exact geometry, counters and interaction results](client-voice-browser-verification.json)

All six final screenshots were rendered from the built app. Recovery images were inspected visually; modal entrance animation was allowed to settle before measuring controls. Earlier development screenshots and the initial blank/transitional Behaviors capture are not included as final evidence.

## Automated checks

The client module's focused run passed 209 tests across 14 files, including premature-empty-end recovery, permission/start errors, cancellation, provider setup readiness, timeout/cleanup of token/auth/audio startup, safety interruption while screening, optional speech-practice transcription failure and child consent. The new behavioral cases reproduced failures before fixes.

After the final Behaviors layout adjustment, 60 relevant capture/form/safety tests passed across four files. These are overlapping checks, not an additional unique-test total. The final build passed; its existing large-chunk warning remains. The root release report owns whole-app TypeScript, full-suite, safety-evaluation and deployment results.

Visual observation: the parent can see why recording ended, retry immediately, or continue typing in the same context. The screenshots support this specific recovery moment; they do not certify physical microphone operation, real human listening quality, or all app capabilities. Independent critic owns the overall gauntlet verdict.
