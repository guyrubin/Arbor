# AI and payment incident alerts (B-AIOPS-03)

**Owner:** the named human in `OPS_ALERT_OWNER` (Guy). Agents never change the alert configuration or the secret.
**Code:** `app/src/server/opsAlerts.ts` (the sink), `app/src/server/prepayBalance.ts` (the balance), wired in `server/createApp.ts`, `server/billing.ts` and `routes/api.ts`.

## What an incident is

One content-free record per signal crossing its threshold (`firing`) and one when the signal is healthy again after a quiet window (`resolved`). Fields: `signal`, `reason` (closed enums), `state`, `at` (server clock, ISO), `count`, `windowMinutes`, `owner`, `runbook` (an anchor below), `action`, plus `route` (an Express route template such as `/api/memory/:childId`, 5xx only) or `prepay` (three numbers, prepay only). There is no free-text field: no child text, prompt, audio, transcript, uid, email or URL value can reach an incident.

Delivery:

1. **Always:** a structured log line, `message: "ops.incident"`, severity ERROR while firing and WARNING on recovery. A Cloud Logging log-based alert can key on `jsonPayload.message="ops.incident"` with no code change.
2. **When configured:** a POST of `{"text": "<one line>"}` to `OPS_ALERT_WEBHOOK_URL` (https only; Slack and Google Chat incoming webhooks accept it). A failed delivery is logged by status only and not retried.

Each Cloud Run instance keeps its own windows, so a multi-instance burst can page once per instance. Nothing here reloads, tops up or pays.

## Configuration (all default off)

| Variable | Default | Effect |
|---|---|---|
| `OPS_ALERT_OWNER` | `off` | The name on every incident; `off` → "unassigned". |
| `OPS_ALERT_WEBHOOK_URL` | `off` | Secret. The channel incidents are posted to; anything but an https URL is off (log only). |
| `AI_PREPAY_LEDGER` | `off` | JSON `{"credit":100,"currency":"EUR","since":"YYYY-MM-DD","perLiveMinute":0.05}`: the last top-up, its day and Guy's per-minute rate. Enables the readable balance and the 20 % alarm. |

At boot the server logs `Ops alert delivery: log|log_and_webhook; owner named|unassigned`.

## api-5xx-burst

**Fires:** 10 answers ≥ 500 on `/api` within 5 minutes. **Resolves:** a healthy `/api` answer 5 minutes after the last 5xx.
**Do:** open Error Reporting for the named route template and the current Cloud Run revision. If a release caused it, shift traffic back to the previous revision (`docs/deployment-production.md`). Check the Vertex region status for model routes.

## billing-webhook-failure

**Fires:** `bad_signature` 3 times in 15 minutes (RevenueCat's secret no longer matches); `not_configured`, `store_read_only` or `handler_error` once (a paid upgrade may not have been applied). **Resolves:** an accepted delivery 15 minutes after the last failure.
**Do:** compare `REVENUECAT_WEBHOOK_AUTH` (Secret Manager `arbor-rc-webhook-auth`) with the RevenueCat dashboard's webhook Authorization header; read the RevenueCat webhook delivery log and resend the failed events once fixed. A handler error names no customer here: find the event in RevenueCat by time.

## live-unavailable

**Fires:** `mint_failed` / `eu_mint_failed` 3 times in 15 minutes (the provider refused or did not answer the token mint within 8 s); `connect_failed` 3 times in an hour (a token was minted but the audio never came up — the depleted-prepay signature, reported by the client as the `failed` usage event and logged as `message: "live_unavailable"`); `residency_denied` once (production refused Live under the residency policy: the dated exception lapsed); `budget_store_unavailable` 3 times in 15 minutes (the family voice allowance store failed, so voice was refused). **Resolves:** a delivered token (mint, residency and store reasons) or an opened session (`connect_failed`) after the quiet window; `residency_denied` on the next delivered token.
**Do:** follow `live-balance-alert.md` (check the AI Studio prepaid balance first, top up by hand, verify with a real audio smoke). For `residency_denied`, decide on `LIVE_GLOBAL_EXCEPTION_UNTIL`; families meanwhile use the EU browser voice loop. For the store, check Firestore status.

## prepay-low

**Fires:** the readable AI Studio balance is at or below 20 % of the last top-up. **Resolves:** the balance reads above 20 % (a new `since` day after a top-up starts a fresh counter).
**Readable balance:** `GET /api/admin/prepay` (founder accounts only) returns `credit`, `currency`, `since`, `liveMinutes`, `spent`, `remaining`, `low` and `basis: "reserved_live_minutes"`, or `{ "configured": false }`. The balance is read from Arbor's own meter: every delivered Live token's reserved slice (B-AIOPS-02) since the top-up day × the configured rate. Reserved minutes bound connection time from above, so a rate at or above the real per-minute cost makes the alarm early, never late. Text, image and TTS routes run on Vertex and Cloud TTS, not on the AI Studio prepay.
**Do:** top up in Google AI Studio by hand (auto-reload stays off), then update `AI_PREPAY_LEDGER` with the new credit and `since` day.

## Cost and budget outputs (B-GA-26, BD-06, BD-52)

The AI cost gate (B-GA-26), the trial/paid AI cost measure (BD-06) and the true-profit and cash model (BD-52) read these fields. Every one is a count, milliseconds or money; none carries a family, uid or content.

| Field (where it is written) | Read at | Feeds |
|---|---|---|
| `usageRollup/{day}.live.reservedMs`, `.reservations`, `.byPlan.{plan}.reservedMs` (every delivered Live slice, `routes/api.ts` → `recordLiveBudgetRollup`) | `GET /api/admin/overview` → `usageToday.live.reservedMs` | B-GA-26: the upper bound of provider-billable Live time per day, Free vs paid; BD-06: trial/paid split by plan |
| `usageRollup/{day}.live.fallbackTurnMs`, `.fallbackTurns` (settled browser-loop turns) | `usageToday.live.fallbackTurnMs` | B-GA-26: voice time that ran on the EU text path instead of Live |
| `usageRollup/{day}.live.restingRefusals` (mints or turns refused because the family's time was spent) | `usageToday.live.restingRefusals` | BD-06: how often the 3/20-minute allowance binds |
| `usageRollup/{day}.live.observedSessionMs`, `.openedSessions` (client-reported connection time, `liveUsage.ts`) | `usageToday.live.observedSessionMs` | B-GA-26: observed vs reserved Live time |
| `usageRollup/{day}.estimatedCostUsd`, `.pricedCalls`, `.calls` (priced text/image calls) | `GET /api/admin/overview` → `cost30d.estimatedCostUsd`, `cost30d.perActiveFamilyUsd` | B-GA-26 and BD-52: the €2 per active family read (text and image only; Live is not priced there) |
| `opsLedger/aiStudioPrepay_{since}.reservedMs` × `AI_PREPAY_LEDGER.perLiveMinute` | `GET /api/admin/prepay` → `liveMinutes`, `spent`, `remaining`, `low` | BD-52: Live spend against the prepaid balance; the 20 % alarm |
| `aiQuota/live_family_{familyId}_{day}` `consumedMs` and `reservations` (per family-day; Admin SDK only) | the allowance itself (`server/liveBudget.ts`) | B-AIOPS-02 enforcement; not a reporting source |
| `studioCostLedger/{kind}:{ref}` `calls.{modality}`, `estimatedCostUsd`, `unpricedCalls`; `billedCostUsd`, `billedSource`, `billedPeriod`, `acceptedSeconds` set by `scripts/studio-ledger-import.mts` (B-KID-150: production of shared kid assets — plan plates painted in product, book plates, shared narration, video, music) | `studioCostReport` (server/studioCostLedger.ts) | Studio production, reported APART from the €2 per active family read (BD-36): a call made as studio production never writes `usageRollup` (`ai/usage.ts`, `ai/ttsUsage.ts`) |

## Proof (28 October 2026)

Dated delivery and recovery tests with a fake sink per signal: `app/src/server/opsAlerts.test.ts` (sink thresholds and recovery, 5xx through Express, all four billing reasons through the real webhook router, webhook payload and config defaults), `app/src/routes/opsAlertsRoute.test.ts` (mint, connect, residency and store failures through the real token and usage routes; the prepay alarm and the founder-only balance) and `app/src/server/prepayBalance.test.ts` (parsing, balance arithmetic, once-per-crossing, recovery after a top-up, no reload). Every incident in those tests is checked for the child's name, ids, uid, email and secrets.

Not proved here: delivery to Guy's real channel, the Cloud Logging alert policy and the real AI Studio balance. Those are Guy's half: set the three variables on the Cloud Run service and confirm the boot line reads `Ops alert delivery: log_and_webhook; owner named`.
