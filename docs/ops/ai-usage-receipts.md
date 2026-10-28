# AI usage receipts: field audit and billing gaps (B-AIOPS-01)

What the app records for every paid AI call, against what B-AIOPS-01 asks a receipt to hold, and what still stands between those receipts and the provider bill. Audited 28 Oct 2026 on main `5fb5666f`. `app/src/ai/usageReceipts.test.ts` reads the field table below: CI fails when the `ai.usage` event gains or loses a field this table does not record, or when a receipt carries anything but ids, enums and numbers.

The receipt is one structured `ai.usage` log line per provider call (`app/src/ai/usage.ts`), written at the provider seam, plus a daily Firestore aggregate (`usageRollup/{date}`, `app/src/server/usageRollup.ts`) that the founder dashboard reads. Neither holds prompt text, replies, child names or audio.

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
| Journey (which product path) | not on the receipt; `requestId` joins the HTTP access log line that carries the path | derivable |
| Capability | not on the receipt (`route` is the model route class, not the capability) | missing |
| Context classes | not on the receipt | missing |
| Citation ids | not on the receipt (`sourceCardsUsed` stays in the reply) | missing |
| Action types | not on the receipt | missing |
| Safety result | not on the receipt (output-screen blocks are logged separately) | missing |
| Attempts and retries | not on the receipt | missing |
| Fallback taken | not on the receipt (image region fallback logs its own line) | missing |

## Paths

| Path | Receipt | Priced | Retries and fallback | Gap |
|---|---|---|---|---|
| Structured text (`generateJson`, Gemini and Claude) | `ai.usage` per successful call, before the output is parsed or screened, so a blocked or unparsable reply is still counted | Yes, `PRICE_TABLE` | Up to three attempts; only the returned attempt is recorded. Page A states non-200 responses are not charged | A call the route deadline abandons keeps running inside the Vertex SDK (it has no abort hook) and may complete and bill with no receipt |
| Text streams (`/chat`, `/council`, `/voice`) | `ai.usage` at the end of the stream; since 28 Oct also when the stream stops early (`endedEarly`) | Yes | As above | An early stop records the tokens seen so far; Gemini sends usage in its last chunk, so an early-stopped Gemini row is usually unpriced (explicit, not 0) |
| Images (scene, comic, avatar, hero pose, plan plates) | `ai.usage` per successful call, before the image is extracted, so a refused image is counted | Yes, output tokens at the image rate | Region fallback after 429s; 429 attempts are not charged | No `promptVersion` (recorded as `unversioned`) |
| Read-aloud `/tts` (Chirp 3 HD) | `ai.usage` with `characters` and cost (`recordTtsUsage`) | Yes, approved voices only | Browser speech on failure (no cost) | None found |
| Book and plan name pages (Gemini TTS) | A `tts.book` log line with model and characters | No | — | Outside `ai.usage` and the rollup; no price |
| Live voice | Session telemetry: observed connection time, `billingVerified: false` | No, by design | — | Observed connection time is not billed audio; provider-billed audio tokens are not captured |
| Output safety classifier | `ai.usage` on `analysis_structured` | Yes | — | Counted in the same daily total as family calls (it is a cost of serving them, so this is correct, but it is not split out) |
| Child speech recognition | Off in production (`CHILD_ASR_PROVIDER=none`) | — | — | — |

## Denominators

`costPerActiveFamily` (`app/src/server/adminMetrics.ts`) divides the 30-day estimated cost by active families with internal and demo families excluded. Two problems:

1. The numerator is the global daily rollup, which carries no account, so internal, demo, founder and smoke usage stay in the cost while their families are out of the denominator. The per-family figure is overstated by whatever the internal accounts spend.
2. There is no trial, non-converter, active or paid split: the rollup cannot attribute cost to a plan. The `ai.usage` lines carry `userUid`, so the split can be computed in the reconciliation query below, not in the app today.

## Reconciliation (Guy's half)

The receipts are list-price estimates. Matching them to money needs the provider bill, which only Guy can export:

1. Export the Cloud Billing detail for the production project (billing export to BigQuery, or a CSV for the last full month): cost by SKU and day.
2. Route `ai.usage` log lines to BigQuery (a log sink on `jsonPayload.message="ai.usage"`), then sum `estimatedCostUsd` and tokens by `resolvedModel` and day; count `endedEarly` rows and rows without `estimatedCostUsd` separately.
3. Compare per model and day. The remainder is what the receipts do not see: abandoned SDK calls, name-page TTS, Live audio, and pricing differences between the Non-global rate and the bill. Record the result as a dated file beside this one.
4. Split cost by plan state by joining `userUid` to entitlements (trial, converted, never converted, paid) and drop internal and demo accounts from the numerator, not only the denominator.
