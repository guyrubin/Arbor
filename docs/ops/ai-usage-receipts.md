# AI usage receipts: field audit and billing gaps (B-AIOPS-01)

What the app records for every paid AI call, against what B-AIOPS-01 asks a receipt to hold, and what still stands between those receipts and the provider bill. Field audit 28 Oct 2026 on `5fb5666f`; the code-side receipt (family id, retries, fallback, charged failure, price version, per-family daily report) landed after that. Provider-bill match stays **partial** until Guy can export the bill. `app/src/ai/usageReceipts.test.ts` reads the field table below: CI fails when the `ai.usage` event gains or loses a field this table does not record, or when a receipt carries anything but ids, enums and numbers.

The receipt is one structured `ai.usage` log line per provider call (`app/src/ai/usage.ts`), written at the provider seam, plus a daily Firestore aggregate (`usageRollup/{date}`, `app/src/server/usageRollup.ts`) and a per-family day (`familyCostDaily/{familyId}_{date}`, `app/src/server/familyCostWriter.ts`) that `GET /api/admin/family-cost` reads. None of them holds prompt text, replies, child names or audio.

## Receipt fields

| Required by the row | On the receipt | Status |
|---|---|---|
| Provider | `provider` | present |
| Model and version | `model`, `resolvedModel`, `promptVersion` | present |
| Route class | `route` | present |
| Who and which request | `requestId`, `userUid` | present |
| Tokens by kind | `promptTokens`, `outputTokens`, `thoughtsTokens`, `totalTokens`, `cacheReadTokens`, `cacheWrite5mTokens`, `cacheWrite1hTokens`, `audioInputTokens` | present |
| Cost | `estimatedCostUsd` (absent, never 0, when the model is unpriced or no usage came back) | present |
| Timing and latency | `totalMs`, `firstChunkMs` | present |
| Early stop | `endedEarly` (added 28 Oct: a stream stopped by the output screen, an abort, a deadline or a closed client still bills what was generated) | present |
| Price table version | `priceTableAsOf` | present |
| Family | `familyId` (null when the value is not an account id; a name does not pass) | present |
| Attempts and retries | `retries` (failed attempts before this record; 0 is the first try) | present |
| Fallback taken | `fallback` | present |
| Charged failure | `chargedFailure` (the provider billed the call and the product rejected the result) | present |
| Images | `imageCount` (0 on a charged image failure) | present |
| Billed audio seconds | `audioSeconds` (absent when the provider did not report billed audio) | present |
| Journey (which product path) | not on the receipt; `requestId` joins the HTTP access log line that carries the path | derivable |
| Capability | not on the receipt (`route` is the model route class, not the capability) | missing |
| Context classes | not on the receipt | missing |
| Citation ids | not on the receipt (`sourceCardsUsed` stays in the reply) | missing |
| Action types | not on the receipt | missing |
| Safety result | not on the receipt (output-screen blocks are logged separately) | missing |

## Paths

| Path | Receipt | Priced | Retries and fallback | Gap |
|---|---|---|---|---|
| Structured text (`generateJson`, Gemini and Claude) | `ai.usage` per returned call, and again when a thrown attempt carried usage or the reply was billed and then rejected (`chargedFailure`) | Yes, `PRICE_TABLE` | `retries` counts failed attempts before this record. A non-200 with no usage is not a receipt (Page A: not charged). Usage on the error is a charged failure | A call the route deadline abandons keeps running inside the Vertex SDK (it has no abort hook) and may complete and bill with no receipt |
| Text streams (`/chat`, `/council`, `/voice`) | `ai.usage` at the end of the stream; since 28 Oct also when the stream stops early (`endedEarly`) | Yes | As above | An early stop records the tokens seen so far; Gemini sends usage in its last chunk, so an early-stopped Gemini row is usually unpriced (explicit, not 0). The Claude seam also cancels the upstream body on an early stop, so generation stops instead of billing into a dropped reader; whether the Vertex SDK stream closes its connection when the consumer stops was not verified |
| Images (scene, comic, avatar, hero pose, plan plates) | `ai.usage` with `imageCount` 1 when an image comes back; a billed response with no image is `chargedFailure` and `imageCount` 0, and is not tried in another region | Yes, output tokens at the image rate | `fallback` on a later region. A 429 with no usage is not a receipt | No `promptVersion` (recorded as `unversioned`) |
| Read-aloud `/tts` (Chirp 3 HD) | `ai.usage` with `characters` and cost (`recordTtsUsage`) | Yes, approved voices only | Browser speech on failure (no cost) | None found |
| Book and plan name pages (Gemini TTS) | `ai.usage` route `book_narration` with characters only (`recordBookNarrationUsage`) | No | Each successful synthesize is its own record (`retries` 0). A non-200 before audio is not a receipt | No Chirp character price applies; the daily report lists the route as a gap (`no price`), never 0 |
| Live voice | `ai.usage` route `realtime_audio` when observed connection time advances, `billingVerified: false` | No, by design | — | Observed milliseconds are not billed audio (`audioSeconds` is not set). The daily report lists the route as a gap (`no billed audio price`). Provider-billed audio tokens are still not captured |
| Output safety classifier | `ai.usage` on `analysis_structured` | Yes | — | Counted in the same daily total as family calls (it is a cost of serving them, so this is correct, but it is not split out) |
| Child speech recognition | Off in production (`CHILD_ASR_PROVIDER=none`) | — | — | — |

## Denominators

`GET /api/admin/family-cost` (`app/src/server/familyCostReport.ts`) is the per-family daily cost. The household count is `foldCoParents` (`app/src/server/cohortMetrics.ts`): a co-parent is one family, and internal and demo cohorts are out of both the numerator and the denominator. Spend with no family id is `unattributedUsd` and is not in the per-family average. A route with calls and no price is listed under `gaps`. `billMatch` is `partial`.

`costPerActiveFamily` (`app/src/server/adminMetrics.ts`) is unchanged. Its numerator is still the global daily rollup and its denominator is still active uids, so that figure does not match the household count above. There is still no trial, non-converter, active or paid split in the app; `userUid` on the receipt is what the reconciliation query joins.

## Reconciliation (Guy's half) — PARTIAL

The receipts are list-price estimates. Matching them to the provider bill needs Guy's billing export, which this change does not do. `billMatch` stays `partial`.

1. Export the Cloud Billing detail for the production project (billing export to BigQuery, or a CSV for the last full month): cost by SKU and day.
2. Route `ai.usage` log lines to BigQuery (a log sink on `jsonPayload.message="ai.usage"`), then sum `estimatedCostUsd` and tokens by `resolvedModel` and day; count `endedEarly` rows and rows without `estimatedCostUsd` separately.
3. Compare per model and day. The remainder is what the receipts still do not see: abandoned SDK calls, Live audio tokens (observed connection time is an unpriced gap, not billed audio), book-narration characters with no price row, and pricing differences between the table and the bill. Record the result as a dated file beside this one.
4. Split cost by plan state by joining `userUid` to entitlements (trial, converted, never converted, paid) and drop internal and demo accounts from the numerator, not only the denominator.
