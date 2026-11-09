# Priority reliability candidate — 9 November 2026

Owning items: B-KID-162/167/143, B-BOOK-47/51, B-GA-33/34.

## Kids Studio parent return

The parent challenge was nested inside the header's stacking context. Later
content at the same stacking level could cover the answer and confirmation
controls, despite the challenge's own high z-index. The gate now portals to
the active Kids layer, inside the existing lock and focus boundary. It has
explicit EN/HE direction and a scrollable card for short viewports. Hold,
PIN-only mode, wrong-answer rejection and math-exit commerce restrictions stay.

`scripts/kids-exit-browser.mjs` exercises the real gate and translations with
synthetic stacking surfaces across `DEVICE_VIEWPORTS`. A negative control
removes the portal and must reproduce the inaccessible field. Both surface
layouts, both verification modes, rejection and dismissal are covered. This
does not establish real iPhone keyboard/audio or authenticated family proof.

## Pending Kids fixes integrated on current main

PRs #200, #201, #203, #204, #205 and #207 retain their source lineage:
book-cover load identity; current-visit/account parent recap; owner-scoped
device statue album and sign-out cleanup; saved-comic reader lifetime;
completed-book timestamp validity; hosted signed-out souvenir guard.
Current purchase/entitlement fixes remain intact. No new private data,
processing vendor, generated content or paid model use.

## B-GA-33 dependency remediation

A fresh production dependency audit found three compatible fixes beyond the
previous retained Firebase/grpc and uuid findings:

| Package | Previous lock | Candidate lock | Advisory / patched floor |
|---|---|---|---|
| body-parser | 1.20.8 | 1.20.9 | [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828), 1.20.9 |
| zod | 4.4.3 | 4.6.7 | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), 4.6.6 |
| vite | 6.4.4 | 6.4.6 | [GHSA-8g5g-mxqh-grgj](https://github.com/advisories/GHSA-8g5g-mxqh-grgj), 6.4.5 |

Only these three package entries changed, within existing declared ranges.
The offline dependency floor test prevents rollback. No Firebase downgrade,
forced override, gaxios rollback or exception extension was made. Retained
findings and their 17 November re-decision remain open under
`dependency-security-2026-10-18.md`.

## Acceptance boundary

The PR's exact-head CI and capture receipts are authoritative. The new browser
test and complete suite must pass after `npm ci` installs this lockfile.
Candidate smoke, promotion and matching frontend/API revision are required
before calling this deployed. Signed-in family acceptance and physical-device
proof remain separate, as do the broader Parent, clinical, billing and store
launch obligations. This candidate does not close entire backlog rows.
