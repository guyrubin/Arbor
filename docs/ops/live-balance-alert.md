# Live voice balance alert (B-PROV-06)

**Owner:** Guy (creates the metric and the alert; agents never run `gcloud`).
**Why:** Live voice runs on a prepaid AI Studio balance with auto-reload OFF (Guy's decision). When the balance runs out, the provider accepts the socket and closes it before setup. The coach falls back to browser voice with a toast, and nothing else happened until now. A depleted balance was invisible (22 Sep: found only by a manual smoke).

## What the app emits

`CoachTab.tsx` `toggleVoice` emits exactly **one** first-party event per failed Live attempt, via `lib/kpiEvents.ts` `trackLiveUnavailable`:

| event | prop | values |
|---|---|---|
| `live_unavailable` | `reason` | `closed_before_open` (the depleted-prepay signature), `closed_during_start`, `token_error` (the token mint failed or answered unavailable) |

The enum is closed and the event carries no text. Kid Mode never emits it. Mic denials, paywall, quota (429) and consent (451) refusals are not counted, because each is already told to the parent and is not an availability signal.

Events land in Firestore `users/{uid}/events` (the existing first-party sink). They do not reach Cloud Logging on their own.

## The server-side signal for the alert

Cloud Logging cannot see client events, so the alert keys on the server's own log line. `/live/token` logs each decision as `"Live provider decision"` with `provider`, `region` and `exception_until` (B-PROV-01). A depleted balance does not fail the mint: the token is issued and the socket then closes. The alert therefore pairs two signals:

1. **Client truth (daily read):** `node app/scripts/cohort-report.mjs --since <date> --events` lists `live_unavailable` counts by reason. Read it at the weekly review; any `closed_before_open` > 0 means the balance needs checking.
2. **Server alert (real time):** a log-based metric on the token route + an alert when mints keep coming but browser fallbacks follow. Guy creates it once:

```
# 1. Log-based counter metric: Live token mints
#    Cloud Console > Logging > Log-based metrics > Create (Counter)
#    Name:   arbor_live_token_decision
#    Filter: resource.type="cloud_run_revision"
#            resource.labels.service_name="arbor-api"
#            jsonPayload.message="Live provider decision"
#
# 2. Alert policy on the client signal, mirrored server-side:
#    Logging > Log-based metrics > Create (Counter)
#    Name:   arbor_live_unavailable
#    Filter: resource.type="cloud_run_revision"
#            resource.labels.service_name="arbor-api"
#            jsonPayload.message="live_unavailable"
#    Alert:  Monitoring > Alerting > Create policy
#            metric = logging/user/arbor_live_unavailable
#            condition: sum over 1 h > 3
#            notification: Guy's email
```

Step 2 needs the server to log the event. That mirror is a follow-up and is not built in B-PROV-06. Until it exists, the alert is the weekly `cohort-report` read in step 1.

## When it fires

1. Check the AI Studio prepaid balance (Google AI Studio > Billing).
2. Top up by hand. Auto-reload stays OFF (Guy's decision).
3. Verify with one real audio-chunk smoke on production. That smoke is the only proof Live voice works; a token mint alone is not.
