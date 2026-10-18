# Dependency security remediation — B-GA-33

Follow-up to PR #151, which took the full-tree audit from 38 affected packages (5 critical, 15 high) to 17 (0 critical, 5 high). This pass remediates what remains with compatible, in-range changes only and records an explicit decision for every finding that stays. It is remediation, not a clean security audit, and nothing here is a blanket waiver.

Audit tool: `npm audit` (npm 10.9.4, Node 22.22.0, the CI/Dockerfile toolchain). npm 11 reports identical counts. Dates are 2026-10-18.

## Counts

| Tree | Before (post-#151) | After | Change |
|---|---|---|---|
| Full tree | 17 (0 critical · 5 high · 11 moderate · 1 low) | 13 (0 critical · 5 high · 8 moderate · 0 low) | −4 packages; low cleared, moderate −3 |
| `--omit=dev` | 13 (0 critical · 4 high · 8 moderate · 1 low) | 12 (0 critical · 4 high · 8 moderate · 0 low) | −1 package; low cleared |

The high count did not move. Both remaining high advisories trace to a single root (`@grpc/grpc-js` 1.9.16, see below) pinned by the Firebase client SDK's own `~1.9.0` range. No compatible path exists; the alternatives npm offers are a downgrade of `firebase` to 9.14.0 and a major bump of `firebase-admin` to 14.5.0, both refused by the row's "no forced incompatible SDK downgrade" rule.

## What changed

Rule applied: no major bump or downgrade of Capacitor, Firebase, Vite or React; no `overrides`; no `--force`; no peer bypass. `npm audit fix` under npm 10 crashes (`Cannot read properties of null (reading 'edgesOut')`, same as #151); resolution used npm 11 and the lockfile was then re-validated with a clean `npm ci` under npm 10.

| Package | Before | After | Why |
|---|---|---|---|
| `firebase` | 12.13.0 | 12.19.0 | In-range minor. Pulls `@firebase/*` to current 12.x line (`@firebase/firestore` 4.14.1 → 4.17.2, `@firebase/util` 1.15.1 → 1.15.3, adds `re2js`). Does not change the grpc pin (still `~1.9.0`). |
| `@grpc/grpc-js` (hoisted, used by `firebase-admin` / `google-gax`) | 1.14.4 | 1.14.6 | Clears GHSA-m9gg-hp2v-232j (high) and GHSA-f596-whhp-79r4 (low) on the server copy. |
| `vitest`, `@vitest/mocker`, `@vitest/coverage-v8` | 4.1.7 | 4.1.12 | Clears GHSA-82fw-gwwq-j7x9 (moderate, path traversal via mocker redirect). `package.json` dev ranges moved to `^4.1.12`. |
| `esbuild` (nested under `tsx`) | 0.28.0 | 0.28.2 | Clears GHSA-g7r4-m6w7-qqqr (low, dev-server file read on Windows). The top-level `esbuild` 0.25.12 was never affected. |
| `@firebase/rules-unit-testing` | 5.0.1 | 5.0.2 | In-range patch; still flagged only because it depends on `firebase`. |

Rejected on purpose:

- `npm audit fix` wanted to roll `gaxios` 6.7.1 → 6.3.0 in four nested copies to shed `uuid`. That is a downgrade that drops the error redactor, proxy support, interceptors and retry options that `@google-cloud/storage` 7.22 and `google-auth-library` 9.15 use. It trades a moderate `uuid` advisory in an unreachable code path for a behavioural regression on the production storage client. Reverted.
- `firebase@9.14.0` (downgrade, major), `firebase-admin@14.5.0` (major): refused per the row.

## Retained findings

Expiry is a hard review date, not an extension; each row is re-decided on or before it. Owner for every row: Guy (release owner); proposed executor: next Claude dependency pass.

| Root package (paths) | Severity | Reachability | Why retained | Owner | Expiry |
|---|---|---|---|---|---|
| `@grpc/grpc-js` 1.9.16 — `node_modules/@firebase/firestore/node_modules/@grpc/grpc-js` (surfaces as `@firebase/firestore`, `@firebase/firestore-compat`, `firebase`, `@firebase/rules-unit-testing`: all 5 high + 1 of the 4 prod-high) | High (GHSA-m9gg-hp2v-232j, CVSS 7.4) + Low (GHSA-f596-whhp-79r4) | **Not reachable.** Both advisories are gRPC **server**-side (`getAuthContext` with `requireClientCertificate: false`; server leaking handler error text in status). The copy sits under the Firebase **client** SDK, which only ever opens outbound gRPC client channels to Firestore; Arbor runs no gRPC server. In the browser bundle the grpc transport is not even included (WebChannel). The server bundle (`dist/server.cjs`) uses `firebase-admin`, whose hoisted `@grpc/grpc-js` is now 1.14.6 and patched. | Firebase pins `~1.9.0` in every published 12.x `@firebase/firestore` (checked through 4.18.0 / firebase 13.0.0); the only npm "fix" is `firebase@9.14.0`, a two-major downgrade. An `overrides` entry to 1.13.6/1.14.x would cross the dependent's declared range and is prohibited by the row. Upstream fix needed: firebase-js-sdk must lift the pin. | Guy | 2026-11-17 — re-check `npm view @firebase/firestore dependencies.@grpc/grpc-js`; if 12.x lifts the pin, bump in range. |
| `uuid` 9.0.1 — five nested copies under `@google-cloud/storage`, `@google-cloud/vertexai`, `google-gax`, `gtoken`, `teeny-request` (surfaces as `gaxios`, `google-gax`, `retry-request`, `teeny-request`, `@google-cloud/firestore`, `@google-cloud/storage`, `firebase-admin`: all 8 moderate) | Moderate (GHSA-w5hq-g745-h8pq) | **Not reachable.** The advisory is a missing bounds check in `v3`/`v5`/`v6` **only when a caller passes a `buf` argument**. Every dependent call in the installed tree is `uuid.v4()` with no buffer (`teeny-request/build/src/index.js:135`, `google-gax/build/src/util.js:108`, `gaxios` boundary generation). `@google-cloud/vertexai` carries its own nested copy but does not call `uuid` from its own sources. Server-side only; nothing ships to the browser. | Patched `uuid` is 11.1.1 (two majors up). The dependents declare `^9.0.x`; the only npm "fix" is `firebase-admin@14.5.0` (major). `gaxios` 6.3.0 rollback rejected as above. | Guy | 2026-11-17 — re-check whether `firebase-admin` 13.x / `@google-cloud/storage` 7.x publish a patch that lifts `uuid`; otherwise re-decide alongside the firebase-admin 14 migration row. |

Dev-only findings: none retained. The vitest and esbuild dev findings were fixed.

## Guards added

`app/scripts/dependencySecurity.test.ts` (extends the #151 rollback test):

- New floors: `vitest`, `@vitest/mocker`, `@vitest/coverage-v8` ≥ 4.1.11 on every lockfile occurrence.
- Retained-finding confinement: every `@grpc/grpc-js` copy outside the one reviewed Firebase-client path must be ≥ 1.14.5; every `uuid` copy outside the five reviewed nested paths must be ≥ 11.1.1. A new vulnerable copy appearing anywhere else, or the hoisted server grpc rolling back, fails the suite. The reviewed paths are listed explicitly so this file is also the machine-readable scope of the two retentions above.

## Checks

- `npm ci` (npm 10, as CI and the Dockerfile run it) installs the committed lockfile cleanly.
- `npm run lint` (tsc): pass. `npm run check:framework`: pass.
- `scripts/dependencySecurity.test.ts`: 18 tests pass.
- `npm run build`: pass; `dist/server.cjs` produced (3.2 MB, unchanged bundle-size notices).
- Full `npm test`: see the PR for the recorded result.

## What this does not establish

No runtime exploitability testing was performed; reachability above is by code-path inspection of the installed tree. No native (Android/iOS) build was run here. The retained rows expire 2026-11-17 and must be re-decided, not silently renewed.
