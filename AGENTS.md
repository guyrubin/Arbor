# AGENTS.md

Arbor is a parent-support app for child development: a React/Vite client and an Express API in one package (`app/`), shipped to the web (Firebase Hosting + Cloud Run) and to iOS/Android through Capacitor. Product background: `README.md`, `app/PRODUCT.md`. Facts below come from `app/package.json`, the workflows and the docs they cite; if one drifts, the source file wins.

## Where things live

| Path | What |
|---|---|
| `app/` | The application. Run every npm command from here. |
| `app/server.ts` | Entry point; wires `loadConfig()` → `createApp()` → `startHttpServer()` (Vite runs as Express middleware in dev). |
| `app/src/` | Source, tests beside code (`*.test.ts[x]`): `server/` (API, billing, quotas), `ai/` (model router, providers, prompts), `safety/`, `memory/`, `config/env.ts` (all env parsing and production invariants), `components/`, `routes/`, `lib/`, `content/`, `framework.json` (domains, age bands, prompt frames). |
| `app/scripts/` | Build helpers, gates (`framework-check`, `capability-floors`, `acceptance-eval`, `safety-eval`), the rendered sweep, demo-family seeding, smoke tests. `scripts/capture/` is the offline capture harness. |
| `app/ios/`, `app/android/` | Capacitor native shells (committed). See `app/MOBILE.md`, `app/STORE-SUBMISSION.md`. |
| `evals/` | Version-pinned AI eval suites (`*.eval.json`) and their `*.results.jsonl` logs. See `evals/README.md`. |
| `knowledge/` | Source cards for the AI wiki the backend retrieves from. |
| `docs/` | PRD, architecture (`docs/architecture/`), ADRs (`docs/adr/`), compliance, ops, and the production runbook `docs/deployment-production.md`. |
| `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `cloudbuild*.yaml`, `infra/` | Hosting, database rules and deploy config. |
| `.github/workflows/` | CI, capture, deploy and native-build workflows (below). |

## Commands (from `app/`, Node 22)

```bash
npm ci                      # install from the lockfile
cp .env.example .env.local  # local env; .env* is git-ignored except .env.example
npm run dev                 # tsx server.ts, http://localhost:3000 (PORT overrides)
npm run lint                # tsc --noEmit: the type check, there is no ESLint
npm test                    # vitest, all of src/** and scripts/**
npx vitest run --config scripts/vitest.config.mjs src/path/to/file.test.ts   # one file
npm run check:framework     # framework.json against docs/developmental-ai-operating-model.md
npm run check:floors        # capability floors F1–F18 (static source checks)
npm run eval:safety         # stale/clinical copy checks + the real output-safety screen on fixtures
npm run check:acceptance    # offline eval-suite schema, pinned-model and contract checks
npm run build               # vite build, public guides, service-worker stamp, server.ts → dist/server.cjs
npm start                   # node dist/server.cjs (after build)
```

- `npm test` includes `src/firestore.rules.test.ts`, which only runs when `FIRESTORE_EMULATOR_HOST` is set and is skipped otherwise.
- `MODEL_PROVIDER` is `gemini_dev` (local, needs `GEMINI_API_KEY`), `vertex` or `mock`. `mock` returns deterministic fixtures and makes no outbound model, speech-recognition or TTS calls; production refuses it.
- Rendered sweep: `npm run seed:demo -- --apply` writes the synthetic demo family, then `npm run sweep -- --out <dir>` renders every route against a running server (`--base`, default `http://localhost:4805`; it never starts one). Output goes to the git-ignored `sweeps/`. Viewport sizes are defined only in `app/scripts/capture/release-config.mjs`.
- Live AI evals (`npm run eval:judge -- <suite>`, `eval:loop`, `eval:voice-live`, the `*-smoke.mts` scripts) call real models and spend tokens; CI does not run them. Use synthetic profiles only.
- Mobile: `VITE_API_BASE=<origin> npm run build && npx cap sync`, then `npx cap open android|ios` (iOS needs macOS).

## CI and deploy

- **Arbor CI** (`arbor-ci.yml`, on pull requests and pushes to `main` and `claude/**`): `npm ci`, `lint`, four Playwright/Chromium browser checks (`scripts/kids-entry-browser.mjs`, `kids-update-browser.mjs`, `kids-performance-browser.mjs`, `voice-close-browser.mjs`, the third after a `studio-v2-preview` Vite build), `test`, `check:framework`, `check:floors`, `eval:safety`, `check:acceptance`, `build`. Run the same set before proposing a merge.
- **Arbor capture** (`arbor-capture.yml`, pull requests and `claude/**`/`codex/**` pushes touching `app/**` or `knowledge/**`): offline browser sweep of the release cells in a container. Evidence, not a required check. The `arbor-parent-*` workflows are one-off evidence runs on dedicated `codex/**` branches.
- **Arbor Deploy** (`arbor-deploy.yml`): a push to `main` runs the gate (`lint`, `test`, `check:framework`, `check:floors`, `eval:safety`), deploys a 0%-traffic candidate to Cloud Run and smoke-tests it against the pushed commit (`deploy-candidate`), then the `promote` job (environment `production`) shifts traffic and deploys hosting and Firestore config. Treat a push to `main` as a production release. Runbook: `docs/deployment-production.md`.
- `ios.yml` / `android.yml` build the native apps on push to `main` and on demand; `arbor-ai-evaluate.yml` is a manual live-eval run.

## Constraints from the product docs

- No diagnosis or treatment claims; saved child memory holds parent-approved observations, never diagnostic labels (`README.md` MVP guardrails). Every generation endpoint carries the non-diagnostic contract.
- Counts, never verdicts: nothing a parent sees renders a graded judgement of a child (no scores, percentiles or red/amber/green) (`app/PRODUCT.md`). Parent and kid-mode registers do not mix.
- Child data: export and erase are driven only by the `CHILD_SUBCOLLECTIONS` allow-list in `app/src/lib/childData.ts`; keep its guard test passing. Tests, evals, fixtures and seeds use synthetic data only; this repo is public, so never commit real family or child data, secrets, or `.env*` files.
- Production refuses to boot unless `MODEL_PROVIDER=vertex`, `MEMORY_ADAPTER=firestore`, `ENABLE_LOCAL_MEMORY_ADAPTER=false` and both project ids are set (`app/src/config/env.ts`, `docs/deployment-production.md` §1). Changing a prompt, model or knowledge card needs the matching eval run.
- Hebrew (RTL) and English are both first-class locales; user-facing strings need both.

## Read next

`app/README.md` (local setup, memory ledger), `app/DESIGN.md` (tokens and layout rules), `docs/architecture/environment-variables.md`, `docs/adr/`, `app/scripts/capture/README.md`.
