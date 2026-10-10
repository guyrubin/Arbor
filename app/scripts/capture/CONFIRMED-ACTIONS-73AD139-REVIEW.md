# Confirmed-action diagnostic: 73ad139

Run `38025518204`, exact source `73ad139d962899d23799b5429dd675d45fe5aba6`,
tree `f8d2c2325a79d771269866766cbb2eac60cb88f3`: 40/196 cells accepted, all
196 PNGs retained. Each EN/HE mobile/desktop shard accepted 10/49. This is a failed
diagnostic, not release evidence. Earlier `8802cea` failures remain retained too.

## Observed boundary

Pre-screenshot `failureFrame` exists for 152 of 156 failed cells. Eighty show the
mounted Shell motion parent at opacity 0; four rapid Family returns show fractional
opacity with running animations. Fresh loads fail as well as transitions. In
`record-local-retry`, its actual persistence assertions pass, then the mounted Shell
entrance remains at opacity 0 with one running animation after the 8s readiness
deadline. No TabSkeleton or main alert appears, and required assets have completed.
This disproves an exit-only explanation for the broad regression.

Screenshots are taken after these traces and use the existing `animations: 'disabled'`
option. Inspected mobile EN `record-local-retry` and `ritual-saved-child-return` PNGs
show normal visible content despite the failed pre-shot opacity evidence. These
post-processing pixels cannot establish natural animation completion. Several later
assertions depend on earlier timed-out actions, so their failures cannot independently
establish app defects.

## Verified dependency mechanism, remaining measurement

The pinned [Playwright 1.63 server clock](https://raw.githubusercontent.com/microsoft/playwright/v1.63.0/packages/playwright-core/src/server/clock.ts)
installs its clock for `setFixedTime` and logs operations for future documents.
Its [injected clock](https://raw.githubusercontent.com/microsoft/playwright/v1.63.0/packages/injected/src/clock.ts)
replaces performance, timers and animation-frame scheduling; replay accumulates wall-time
intervals into synthetic monotonic ticks across navigation. Native document animation
time is not replaced. Local installed/locked Motion 12.40 source derives animation
start times from `time.now()`/`performance.now()` and assigns them directly to WAAPI
`startTime` (`AsyncMotionValueAnimation`, `NativeAnimationExtended`, `NativeAnimation`).
That mismatched time origin can schedule native entries in the future after reloads.
This source mechanism fits the observed running entrances and screenshot-only recovery.

The failed run did not record native timeline/start/current times. Therefore numerical
confirmation of the mismatch and proof that the correction fixes it remain open.

## Bounded correction and acceptance

Only the confirmed-actions synthetic business-date fixture changes: a Date-only proxy
fixes no-argument Date and Date.now, preserving explicit constructors, parsing, UTC and
subclass behavior. It leaves native performance, timers, rAF, document.timeline and
Element.animate untouched. A fresh document gets the same initial date; Consult expiry
and recovery update only that fixture date. The current document's original Date
descriptor is restored in `finally`; the disposable capture context is then closed.
No app animation, wait policy, geometry floor, source metadata or network guard changes.

Pre/post/failure observations now retain Date/performance/document timeline readings,
native timing identity checks, before/after full-reload clock samples, and each observed native animation's start/current times,
playback rate, timeline time, duration, delay and progress. Strict readiness still
requires `nativeTimingPreserved === true` and rejects opacity, transform or running-animation defects.
Performance/timeline differences are recorded without an arbitrary millisecond equality gate. Original rapid Prepare,
closed-editor sibling selection and actual Family A→B→A probes remain unchanged.
The next exact-source capture must demonstrate natural completion before screenshots;
blank transitions remain a hard hold.

## Date-only correction verification

On integrated base `691c489`, final affected contracts passed 44/44: confirmed actions
18, release aggregation 10, and interactions 16, in three separate serial installed
Vitest processes with one worker, the offline network preload and mock provider.
A test-only observer stub initially lacked its cleanup method; that failed run is
retained separately, the stub was corrected, and the final rerun passed. JavaScript
syntax and diff checks passed. No local browser, typecheck, build or provider ran.
Exact-source CI and native-timeline/rendered confirmation remain required.
