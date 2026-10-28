# Model, price and lifecycle facts (B-AIOPS-06)

The dated record of every model the app deploys, pins or prices, and of the AI SDKs it calls them through, read against the provider's official pages. `app/src/ai/modelFacts.test.ts` reads this file: CI fails when a pinned model is past its recorded retirement, when an AI SDK is still installed on or after its recorded hard-fail date, when a pinned or priced model or an AI SDK has no row, when the app's price table, the recorded retirement dates or the installed SDK versions disagree with a row, or when the check is more than 90 days old. From 14 days before that age limit, and for an SDK past its announced removal until its hard-fail date, every run raises a GitHub `::warning` annotation instead (vitest's `annotate(…, "warning")`, rehearsed in a CI-like run on 28 Oct). A notice never flips a model by itself: changing a pin still needs the matching eval run (GG-3).

Checked on: 2026-10-28

Owner: AI platform engineering. Re-check within 90 days of the date above (sources A to D); CI warns from day 76 and fails after day 90. The limit follows the helpline record's shape (LC-15): long enough that a release is never blocked by a routine re-read, short enough that a retirement notice cannot go unread for a quarter.

## Sources

| Key | Page | Read 28 Oct 2026 |
|---|---|---|
| A | "Agent Platform Pricing", https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing (the old `/vertex-ai/generative-ai/pricing` address redirects here) | Yes, 18:35 UTC. The page carries no last-updated date |
| B | "Review pricing for Text-to-Speech", https://cloud.google.com/text-to-speech/pricing | Yes, 18:36 UTC |
| C | Model versions and retirement dates, https://cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions | No. It redirects (301) to `docs.cloud.google.com`, which this session's proxy refuses (`CONNECT tunnel failed, response 403`, 18:35 UTC). Last read 9 Oct 2026, as recorded in `evals/pinned-models.json` and `cloudbuild.prod.yaml` |
| D | npm registry entries, https://registry.npmjs.org/@google-cloud%2fvertexai (its README carries Google's deprecation note) and https://registry.npmjs.org/@google%2fgenai | Yes, 19:34 UTC. The migration guide the note links (`cloud.google.com/vertex-ai/generative-ai/docs/deprecations/genai-vertexai-sdk`) redirects to `docs.cloud.google.com` and was not read |

Processing policy: production admits only EU-region endpoints for text and images, with no training on customer data and retention of 30 days or less (`routePolicyFor`, `app/src/ai/capabilities/policy.ts`); Live runs under the Israel-only global exception to 2027-03-31 (B-AIOPS-05). The EU-residency gate B-GA-06 must read B-AIOPS-08 as well as B-AIOPS-05: read-aloud `/tts` declares EU from `VERTEX_LOCATION` but calls the global Cloud TTS endpoint with text that can name the child (`docs/architecture/ai-caller-inventory.md`, gap 6).

Prices are list prices in USD per 1M tokens unless the row says otherwise. "Non-global" is the rate for regional endpoints (about 10% above Global); the app runs text in `europe-west3`, the judge on `eu` and images in `europe-west4` first, so it estimates with the Non-global rate. Whether `eu` bills as Non-global is not stated on page A.

## Facts

"EU regional, derived" (the Claude rows): page A lists Global prices (Sonnet 5 and 5.5: 2.00 / 10.00; Haiku 5.5: 0.10 / 0.50) and, in later regional tables, prices 10% higher (2.20 / 11.00; 0.11 / 0.55); the text read could not tie a regional table to the EU multi-region, so the EU rate here is Global × 1.1, not a read value.

Retirement: a date is a scheduled retirement on Vertex; "none recorded" means no date has been read. Lifecycle last read: when source C was last read for that model. Price basis "unverified" means the row was not on page A on the check date; the app keeps the price so historical receipts stay priced.

| Model | App use | Region in use | Lifecycle | Retirement | Lifecycle last read | Price basis | In | Audio in | Out | Cached in | Cache write 5m / 1h | Source | Owner action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemini-3.5-flash | Production text (`VERTEX_MODEL_CHAT`); creative, analysis and handoff route pins | europe-west3 | GA; retires no earlier than 2027-05-19 (recorded 9 Oct). No Preview or retirement label on page A | none recorded | 2026-10-09 | Non-global | 1.65 | 1.65 | 9.9 | 0.165 | — | A | Read C for the scheduled date |
| gemini-3.8-flash | Eval judge | eu | GA 2 Sep 2026 (recorded 9 Oct). Introductory price to 2026-12-31; standard price from 2027-01-01 doubles it (a price step, not a retirement) | none recorded | 2026-10-09 | Non-global, introductory to 2026-12-31 | 0.825 | 0.825 | 4.125 | 0.0825 | — | A | None before 2027-01-01; the app already applies the step |
| gemini-3.8-live | Live voice (`LIVE_MODEL`) | Global exception to 2027-03-31 (B-AIOPS-05) | No Preview label on page A; validated live by setupComplete and returned audio (recorded) | none recorded | 2026-10-09 | Non-global; not priced by the app (observed connection time is not billed audio, B-AIOPS-01) | 0.75 | 3 | 12 | — | — | A | Price Live only from billed usage (B-AIOPS-01) |
| gemini-2.5-flash-image | Image generation (`VERTEX_MODEL_IMAGE`) | europe-west4, europe-west1, europe-west3 | Retirement recorded 9 Oct; not shown on page A | 2027-03-15 | 2026-10-09 | Single price; image output priced per output token (about 0.039 USD a 1024×1024 image) | 0.3 | — | 30 | — | — | A | Read C; plan the image-model move before the date (B-BOOK-64) |
| gemini-2.5-flash | None (retired); price row kept for historical receipts | — | Retired on Vertex (recorded) | 2026-10-20 | 2026-10-09 | Single price | 0.3 | 1 | 2.5 | 0.03 | — | A | None; `retiredModels` blocks it as a pin or judge |
| gemini-2.5-pro | None (retired former judge); price row kept | — | Retired on Vertex (recorded) | 2026-10-20 | 2026-10-09 | Single price, prompts up to 200K tokens | 1.25 | 1.25 | 10 | 0.125 | — | A | None; listed in `deadJudgeModels` |
| gemini-3.5-flash-lite | Approved candidate (allocation of 10 Oct) | not in use | No Preview label on page A | none recorded | not read | Non-global | 0.33 | 0.33 | 2.75 | 0.033 | — | A | Read C before any route uses it |
| gemini-2.5-flash-lite | None; legacy price row | — | Not read | none recorded | not read | Single price | 0.1 | 0.3 | 0.4 | 0.01 | — | A | Read C; drop the row when no receipt needs it |
| claude-sonnet-5 | `coach_high_stakes` code default; production overrides it (GG-3 not flipped) | not in use | Not read | none recorded | not read | EU regional, derived | 2.2 | — | 11 | 0.22 | 2.75 / 4.4 | A | Read C before any flip |
| claude-sonnet-5-5 | Approved candidate | not in use | Not read | none recorded | not read | EU regional, derived | 2.2 | — | 11 | 0.11 | 2.75 / 4.4 | A | Read C before any route uses it |
| claude-haiku-5-5 | Approved candidate | not in use | Not read | none recorded | not read | EU regional, derived; prompts over 100K tokens bill all tokens at 5× | 0.11 | — | 0.55 | 0.011 | 0.1375 / 0.22 | A | Read C before any route uses it |
| claude-sonnet-4 | None; legacy price row | — | Not on page A on 28 Oct | none recorded | not read | unverified (not on page A) | 3 | — | 15 | — | — | A | Decide: drop the row or source it |
| claude-3-5-sonnet | None; legacy pin (`legacy` in pinned-models.json) | — | Not on page A on 28 Oct | none recorded | not read | unverified (not on page A) | 3 | — | 15 | — | — | A | Decide: drop the row or source it |
| Chirp 3 HD voices `en-US-Chirp3-HD-Sulafat`, `he-IL-Chirp3-HD-Sulafat` | Read-aloud and voice replies (`TTS_VOICE_EN`, `TTS_VOICE_HE`) | Google Cloud TTS (no regional note on page B) | Not read: the voices page is on `docs.cloud.google.com` | none recorded | not read | Per 1M characters, after the free first 1M characters a month | 30 | — | — | — | — | B | Read the voices page for he-IL Sulafat availability |

## SDKs

The client libraries the server calls models through. Pinned is the `app/package.json` range, Installed the `app/package-lock.json` version. Removal is the date the provider announced the SDK surface stops being supported. An SDK past its removal is allowed only with a migration row and a hard-fail date that falls before the earliest recorded retirement of a pinned model (the image model, 2027-03-15): CI warns on every run until that date and fails from it. 2027-03-01 is the orchestrator's default for `@google-cloud/vertexai`, pending Guy's decision. The migration row cell starts with its backlog id (`B-AIOPS-n`); prose alone fails the check.

| Package | App use | Pinned | Installed | Lifecycle | Removal | Successor | Hard fail from | Migration row | Last read | Source | Owner action |
|---|---|---|---|---|---|---|---|---|---|---|---|
| @google-cloud/vertexai | Production text, streams and images (`VertexGeminiProvider` in `ai/modelRouter.ts`, `ai/vertexEndpoint.ts`) | ^1.12.0 | 1.12.0 | Past removal: Google's note says the `VertexAI` class and all its dependencies are deprecated since 2025-06-24 and removed on 2026-06-24; 1.12.0 (15 Apr 2026) is still the latest release and production still answers on it (wave 1, 28 Oct), but the surface is outside support | 2026-06-24 | @google/genai | 2027-03-01 | B-AIOPS-11: AI: migrate production text, streams, images and the safety classifier from the removed VertexAI class to @google/genai, live eval before the flip (id proposed as the next free B-AIOPS number; the orchestrator confirms it at write-back) | 2026-10-28 | D | Move `VertexGeminiProvider` to @google/genai (already a dependency) behind the existing provider seam, with the matching eval run before release (GG-3); needs its own backlog row |
| @google/genai | Live token mint (`POST /live/token`), the AI Studio dev provider | ^2.4.0 | 2.6.0 | Current: no deprecation on 2.6.0; latest 2.31.0 (23 Oct 2026) | none recorded | — | — | — | 2026-10-28 | D | Move to a current 2.x with the Vertex migration |

## What this check did not establish

- No retirement date was read on 28 Oct (source C unreachable). The dates above are the 9 Oct record.
- Page A names no `europe-west3`, `europe-west4` or `eu` row for Gemini; the Non-global rate is the app's assumption for every regional endpoint.
- Newer models on page A (Gemini 3.6, 3.7 and 3.8 Flash Cyber, Gemini 4 Argon with promotional pricing to 30 Nov 2026) carry no lifecycle statement here; none is pinned.
- Prices are list prices. Provider-bill reconciliation is B-AIOPS-01 and needs Guy's billing export.
