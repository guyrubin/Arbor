# Book, image, game and guide routes (B-AIOPS-07)

Measured 18 Nov 2026. The sample is the route handlers on a local server with a stub provider: no outbound model call, so these times are the route machinery. They are not a Vertex p50 or p95, and the dollar figures are list price for a stated token count, not a provider bill. Provider-bill match stays with B-AIOPS-01.

The one dated live run in the repo is `docs/audits/2026-09-22-ai-foundation/capability-smoke.json` (22 Sep 2026, 07:33 UTC, n=1 per route, chat and analysis on `gemini-2.5-flash`, images on `gemini-2.5-flash-image`). That chat model is retired. Current pins are `gemini-3.5-flash` for text and `gemini-2.5-flash-image` for images (`docs/ops/model-facts.md`). `/generate-story` answered in that run and has since been removed. No 152-failure artifact is in the repo; that September run is 22 of 23, with the comic the one failure.

## What was measured

`app/src/routes/creationRoutes.measure.test.ts` posts each route 20 times after one warm-up. Explain uses a new detail on every sample, because a repeated subject is cached for the day and would not call the model. Every sample returned 200. Nearest-rank handler latency on this machine:

| Family | Route | Model route | n | ok | p50 | p95 |
|---|---|---|---|---|---|---|
| Book | `/generate-hero-journey` | `creative_low_risk` | 20 | 20 | 2 ms | 5 ms |
| Book | `/generate-bedtime-story` | `creative_low_risk` | 20 | 20 | 2 ms | 2 ms |
| Image | `/generate-scene` | image | 20 | 20 | 1 ms | 2 ms |
| Image | `/generate-comic` | image | 20 | 20 | 1 ms | 2 ms |
| Image | `/generate-avatar` | image | 20 | 20 | 1 ms | 2 ms |
| Game | `/generate-adventure` | `creative_low_risk` | 20 | 20 | 1 ms | 2 ms |
| Guide | `/explain` | `analysis_structured` | 20 | 20 | 2 ms | 2 ms |

The test asserts p95 under 5 seconds. A repeat of the same run moved individual cells by a few milliseconds, so the contract is that bound, not a cell. A second identical `/explain` made no further model call (the day cache). The other six routes call the model once per request. Public guide pictures are shipped files (`app/src/lib/guideArt.ts`), not a request-time model call.

Kid mode does not call `/generate-scene` (`app/src/components/practice/WorldScene.test.tsx`). `/generate-adventure` has a client method and no call site (`app/src/safety/escalation409.guard.test.ts`). The route stays.

## Refusals, retries, deadlines, cancellation

Eight refusals, each with zero model calls: unknown hero story 404; bedtime, scene, comic, avatar, adventure and explain crisis text 409; book narration with a name in the body 400. One hero journey whose narration was a diagnostic claim returned 422 `outputBlocked` after one model call, and the claim was not in the body.

With the coach, analysis and image budgets set to 200 ms and a provider that never returns, all seven routes answered 504 with "Arbor is taking longer than usual" in under 5 seconds. The body did not contain the provider error. Aborting the client aborted the budget signal on all seven, so a parent who leaves does not keep the call running. Hero journey, bedtime story and adventure gained that budget in this change; image routes and explain already had it. The coach budget is 45 seconds, the same ceiling the text routes already had through the model deadline.

An image provider error of `RESOURCE_EXHAUSTED` on `/generate-scene` returned 503, `Retry-After: 15`, and did not include the provider text. A thrown provider error on adventure and explain returned 500 with the calm sentence only. Charged image failures (billed, then rejected, no second region) stay covered by `app/src/ai/costAttempts.test.ts`.

## List price per useful result

From `app/src/ai/priceTable.ts`, non-global `gemini-3.5-flash` at 800 input and 400 output tokens: **$0.00528**. `gemini-2.5-flash-image` at 200 input and 1,290 output tokens (the model-facts "about $0.039" 1024 image, plus a short prompt): **$0.03876**. A refusal makes no call, so its paid cost is none. These are estimates for those token counts. The September run did not record tokens.

## Historical live times (n=1, 22 Sep 2026)

| Route | Status | ms |
|---|---|---|
| `/explain` (Hebrew) | 200 | 1603 |
| `/generate-hero-journey` | 200 | 18374 |
| `/generate-bedtime-story` | 200 | 9105 |
| `/generate-adventure` | 200 | 10814 |
| `/generate-avatar` | 200 | 6736 |
| `/generate-scene` | 200 | 6281 |
| `/generate-comic` | 500 | 19746 |
| `/generate-comic` retry (`capability-smoke-summary.json`) | 200 | 10827 |

All of those sit inside the current budgets (text 45 s, image 60 s). They are not a sample of the current model.

## Not measured

Current Vertex p50 and p95, and the provider bill for these routes. This environment has no model credentials, and a live image sample spends money. Receipts already carry `totalMs` and `estimatedCostUsd` (`docs/ops/ai-usage-receipts.md`); matching them to the bill is B-AIOPS-01.
