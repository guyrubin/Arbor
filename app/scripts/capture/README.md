# Offline synthetic Parent capture

This dedicated CI harness captures the checked-out app without a production account,
real family records, Firebase, Vertex, API keys, service accounts, hosting or model spend.
It does not alter app source or `scripts/rendered-sweep.mjs`.

## Trigger and approval

Initial supported target: push the reviewed harness to branch
`guyrubin/Arbor:codex/parent-ui-capture`. Workflow file:
`.github/workflows/arbor-parent-capture.yml`, job `synthetic-capture`.
The parent/owner must authorize publication and that CI run before the push. No merge,
deployment or main-branch update is needed or authorized by this harness. Manual
`workflow_dispatch` is also defined, but GitHub must first know the workflow on its
default branch; do not merge merely to unlock dispatch. There are no secret grants.

Default scope `all` executes the existing canonical route/contract cross-check, every
route, retired-route loads and all existing named states at 375 EN/HE and 1280 EN
(the existing milestones extra 1280 HE cell remains). `priorities` is explicitly a
partial diagnostic scope, never a complete Parent audit. Alias source mappings and
actual final hashes are retained separately; aliases are not claimed as separately
rendered screens. Canonical inventory includes kid-facing/deep-link/internal IDs,
loaded in Parent mode with Kid Mode closed, so gated/redirected routes remain evidence.

Supplemental captures use the actual current shell launcher at 375 and 1280 in both
languages: text-only synthetic mock answer, visible report sections, help/sources
disclosures, desktop expanded panel. The baseline historical coach sweep still asks
for removed `coach-answer-more`; its unreachable states are retained honestly while
the current structured report is captured separately. My child (`development`) and
Together (`practice`, distinct from `daily-play`) get 3-second module-position/font
samples and screenshots with the dock closed/open/closed. Weekly captures current and
an existing history chip; absent historical fixture data is marked unreachable rather
than inventing a past report. No microphone/camera grants or voice/photo actions.

## Fail-closed execution

The image installs lockfile dependencies and bundled Chromium while networked, before
copying app source. Runtime is a new Docker container with `--network none`, no host
volumes, no published ports, no inherited credentials and no real records. The runner
rejects non-loopback network interfaces, non-container execution, `.env*` files and
pre-existing `.data` before app imports/seed/startup. It replaces its process environment
with a fixed allowlist: mock provider, local stores, blank Firebase client settings,
Live/TTS/child ASR disabled. It applies only `--target sandbox` synthetic fixtures and
checks both demo flags before starting the existing Express/Vite server. Unmocked HTTP,
WebSocket, SDK, DNS or raw socket paths cannot reach an external provider because the
container has no external interface. This is per-container isolation, not a change to
host firewall, VPN, credentials or production settings. Never run the entrypoint on a
networked machine to work around its guard.

Google-hosted text fonts on this baseline cannot load in offline runtime. Existing
bundled Material Symbols icons remain. Screenshots are NOT font-exact production
captures. `diagnostics.json` records actual document font status/faces and computed
content font families/sizes/line heights. No new/self-hosted font blobs are included.

Only generated synthetic PNGs and five explicitly named JSON files can become the
7-day workflow artifact. No raw environment, local-store, server, dependency or seed
logs are exported. `capture.json` identifies the exact checkout SHA (the image has no
`.git`), scope, completion/failure stage and missing current answer evidence. A missing
current answer screenshot fails the job; retained unreachable historical states are
findings, not silently passed tests. A successful capture is evidence collection,
not a visual-quality approval.

## Exact source fonts (`CAPTURE_FONT_MODE=exact`)

`prepare-font-cache.mjs` runs once per cell in a disposable, network-bridged CI container
(never inside the offline capture container) and fetches only the one stylesheet named in
`app/src/index.css` plus the WOFF2 resources that stylesheet declares. Its allow-list is
the provenance guarantee: the runtime later serves a font only when the browser asks for
the exact URL the stylesheet named, and `font-provenance.json` (the cache manifest)
records every URL with the hash of the bytes it resolved to. Nothing is substituted,
rewritten, redirected or fetched from another origin; a refused shape stops the cell.

Google Fonts is observed to serve the same family through two URL shapes, and the choice
is not deterministic across requests (the Hebrew kits flipped between them on 28 Oct 2026):

| Shape | Form | Recorded as |
|---|---|---|
| static | `https://fonts.gstatic.com/s/<family>/v<n>/<file>.woff2`, no query | `shape: "static"` |
| kit | `https://fonts.gstatic.com/l/font?kit=<id>&skey=<16 hex>&v=v<n>`, exactly those keys | `shape: "kit"` |

Both are canonical: same origin, no credentials, no fragment, URL equals its parsed
form. The kit shape is accepted only with that key set and those value classes; any other
path, query key, value shape or origin is still `FONT_RESOURCE_URL_DENIED`, diagnosed by
key names and hashes only (values are never logged). Contract tests:
`scripts/capture/font-cache.test.ts` and `scripts/captureFonts.test.ts`.

## Local verification without starting browsers

From `app`, run one file at a time:

    node --check scripts/capture/config.mjs
    node --check scripts/capture/diagnostics.mjs
    node --check scripts/capture/run.mjs
    npx vitest run --config scripts/vitest.config.mjs scripts/captureHarness.test.ts --maxWorkers=1
    npx vitest run --config scripts/vitest.config.mjs src/config/env.test.ts --maxWorkers=1

These verify source/pure contracts only. They do not build/run Docker, start the
sandbox, launch a browser, execute a provider or prove that screenshots were captured.
