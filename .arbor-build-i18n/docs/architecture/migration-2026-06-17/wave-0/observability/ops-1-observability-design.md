# OPS-1 — Production-grade Observability: Design + Drop-in Wiring

**Mission:** OPS-1 (Spec A — Operational Excellence & DevOps)
**Wave:** 0 · **Date:** 2026-06-17 · **Severity:** High · **Effort:** M
**Status:** Code modules + alert policies **built and green**; wiring into the in-flight
`createApp.ts` / `logger.ts` / `usage.ts` is emitted as **SNIPPETS** below (the working
tree is dirty with unrelated billing/JITAI/MimicStudio work — a human or a later
clean-baseline run applies them).

---

## 1. What this mission delivers

OPS-1 is ~60% built on `main` already (`server/logger.ts` emits Cloud-Logging-native JSON;
`requestObservability` stamps a request id; `ai/usage.ts` emits an `ai.usage` line per model
call). The remaining gaps — and exactly what this mission closes — are:

| Gap (from spec) | Closed by |
| :--- | :--- |
| No Cloud Trace propagation | `lib/observability/trace.ts` + context-carried trace fields |
| Trace id not on `ai.usage` / error lines | trace fields stored in `requestContext`, merged by `logger.emit` |
| No provable PII-scrub guarantee on the request line | allow-list serializer in `lib/observability/logger.ts` + `logger.test.ts` |
| No alert policies (error-rate, latency, AI-failure) | `wave-0/artifacts/alert-policies.yaml` |
| Error Reporting shape unverified | `logger.error` stack-in-message preserved + regression test |

### The adversarial fix (must hold)

1. **Trace id must propagate to the `ai.usage` line and error lines, not just the request
   line.** The `ai.usage` line is emitted deep inside an AI provider that never sees the
   Express `req`. Therefore the trace fields are **carried in `requestContext`** (the
   existing `AsyncLocalStorage`) and merged by the logger on **every** line. Putting trace
   fields only on the request-completion line would fail this.
2. **The PII allow-list serializer must NOT strip `errorMessage` or `totalTokens`.** A naive
   "only method/path/status/latency/uid" allow-list would drop the operational fields that
   make errors triageable and AI cost sliceable. The allow-list explicitly **includes**
   `errorMessage`, `totalTokens`, `promptTokens`, `outputTokens` (operational, non-PII) while
   still dropping `email`, `body`, `prompt`, free text, and child-profile fields.

---

## 2. New files (built, collision-free)

All under a **new** directory `app/src/lib/observability/` — no existing tracked file is
touched. Self-consistent and importable; `npx vitest run` over the dir is **green (26/26)**
and an isolated `tsc --strict` over the three modules passes.

| File | Purpose |
| :--- | :--- |
| `app/src/lib/observability/requestContext.ts` | Standalone `AsyncLocalStorage` context carrying `{requestId, uid, trace}`. `bindUid`, `runWithRequestContext`, `makeRequestContext`. |
| `app/src/lib/observability/trace.ts` | `traceFieldsFromHeaders(headers, projectId)` — parses `X-Cloud-Trace-Context` + W3C `traceparent`; **no-ops to `{}` when `GCP_PROJECT_ID` is unset**. `resolveProjectId`, `isTracingEnabled`. |
| `app/src/lib/observability/logger.ts` | PII allow-list structured logger. `ALLOWED_FIELD_KEYS` (frozen), `applyAllowList`, `logger.{debug,info,warn,error}`. Auto-merges the active context's trace fields onto every line. |
| `app/src/lib/observability/trace.test.ts` | 16 tests — both header formats, precedence, malformed input, array headers, no-op-when-unset. |
| `app/src/lib/observability/logger.test.ts` | 10 tests — allow-list drops PII (email/body/prompt/child name), URL query-strip, key-set ⊆ allow-list, carve-outs (`errorMessage`/token counts kept), trace propagation onto `ai.usage` + error lines. |

### Why a standalone module set (not edits to `server/logger.ts`)

The mission's hard rule is "write only NEW files; do not modify any existing tracked file."
`server/logger.ts`, `server/requestContext.ts`, `ai/usage.ts`, and `createApp.ts` are all in
the dirty tree. So the production-grade logic lives in `lib/observability/` as a drop-in
replacement, and §4 gives the exact, minimal patches to point the existing modules at it
(or to inline the two behaviours). The new modules mirror the existing log shape exactly
(`severity`/`message`/`time`/`httpRequest`/`latencyMs`/`requestId`/`userUid`) so the cutover
is behaviour-preserving plus trace + allow-list.

---

## 3. Design detail

### 3.1 Trace propagation (`trace.ts`)

- Pure header parsing — **no SDK, no network, zero runtime cost, no new dependency.**
- `X-Cloud-Trace-Context: TRACE_ID/SPAN_ID;o=1` (GCP legacy; span decimal, `o=1` sampled) and
  W3C `traceparent: VERSION-TRACE-PARENT-FLAGS` are both parsed. Legacy GCP header takes
  precedence (it is what Cloud Run's own LB attaches).
- Returns the Cloud-Logging special keys fully qualified:
  `logging.googleapis.com/trace = projects/<pid>/traces/<traceId>`, plus `…/spanId` and
  `…/trace_sampled` when derivable.
- **No-op contract:** when `GCP_PROJECT_ID` is unset (local/dev/test), it returns `{}` — the
  half-formed `projects//traces/…` resource name is never emitted. This is the spec's
  "no-ops when GCP_PROJECT_ID is unset" requirement.
- Validation: trace ids must be hex (W3C rejects all-zero); malformed/garbage headers yield
  `{}` rather than throwing.

### 3.2 Request context (`requestContext.ts`)

Carries `trace: TraceFields` **in addition to** `requestId`/`uid`. This is the mechanism that
makes trace ids reach the `ai.usage` and error lines: the request middleware computes the
trace fields once (from headers) and stores them in the context; the logger reads
`currentRequestContext()?.trace` on every emit. AI providers and error handlers inherit the
trace for free through `AsyncLocalStorage`.

### 3.3 PII allow-list logger (`logger.ts`)

- `applyAllowList(fields)` keeps only keys in `ALLOWED_FIELD_KEYS` (plus the trace special
  keys, passed through verbatim) and **drops everything else**, including accidental
  `email` / `user` / `body` / `prompt` / `childName`.
- `httpRequest` is recursively sanitized: only `requestMethod`, **query-stripped**
  `requestUrl`, `status`, `latency` survive — so `?token=…&email=…` can never leak.
- Carve-outs (the adversarial fix): `errorMessage`, `totalTokens`, `promptTokens`,
  `outputTokens` are on the allow-list.
- `logger.error(msg, err)` keeps the stack in `message` (Error Reporting auto-groups on the
  `severity:ERROR` + stack shape — preserved from the current implementation) and adds a
  sanitized one-line `errorMessage`.
- Every line auto-merges `currentRequestContext()?.trace`, so request / `ai.usage` / error
  lines share one trace id.

---

## 4. Drop-in wiring SNIPPETS (apply on a clean baseline — DO NOT apply to the dirty tree now)

These are the only changes to existing tracked files. Each is minimal and behaviour-
preserving except for the added trace + allow-list. Apply order: trace into the request
middleware → carry trace in context → logger reads context trace.

### 4.1 `app/src/server/requestContext.ts` — carry trace fields in the context

```diff
-export type RequestContext = { requestId: string; uid: string | null };
+import type { TraceFields } from "../lib/observability/requestContext.js"; // or inline the type
+export type RequestContext = { requestId: string; uid: string | null; trace: TraceFields };

 export const requestContextMiddleware: RequestHandler = (req, res, next) => {
   const ctx: RequestContext = {
     requestId: (req as any).arborRequestId || "unknown",
     uid: (req as any).user?.uid || null,
+    // Trace fields were computed in requestObservability and stashed on req (see 4.2).
+    trace: (req as any).arborTrace || {},
   };
   storage.run(ctx, () => next());
 };
```

### 4.2 `app/src/server/logger.ts` — parse trace once, allow-list the line, merge trace on emit

Touch only `requestObservability` (add the trace parse + stash + merge) and `emit` (route
fields through the allow-list and merge the active context's trace). Do **not** change the
`logger` export signature.

```diff
-import { randomUUID } from "crypto";
-import type { RequestHandler } from "express";
+import { randomUUID } from "crypto";
+import type { RequestHandler } from "express";
+import { traceFieldsFromHeaders } from "../lib/observability/trace.js";
+import { applyAllowList } from "../lib/observability/logger.js";
+import { currentRequestContext } from "./requestContext.js";

 const emit = (severity: Severity, message: string, fields: Fields = {}) => {
+  const trace = currentRequestContext()?.trace ?? {};
   const line = JSON.stringify({
     severity,
     message,
     time: new Date().toISOString(),
-    ...fields,
+    ...trace,                 // trace id reaches ai.usage + error lines, not just the request line
+    ...applyAllowList(fields), // GDPR/AVG: drop anything not on the allow-list
   });
   if (severity === "ERROR") console.error(line);
   else console.log(line);
 };

 export const requestObservability: RequestHandler = (req, res, next) => {
   const incoming = req.headers["x-request-id"];
   const requestId = (typeof incoming === "string" && incoming.slice(0, 64)) || randomUUID();
   (req as any).arborRequestId = requestId;
+  // Parse the inbound trace headers ONCE; no-ops to {} when GCP_PROJECT_ID is unset.
+  (req as any).arborTrace = traceFieldsFromHeaders(req.headers as any, process.env.GCP_PROJECT_ID);
   res.setHeader("X-Request-Id", requestId);
   const startedAt = Date.now();
   ...
 };
```

> Note: `requestObservability` runs **before** `requestContextMiddleware` (createApp.ts:78
> then :80), so it stashes the trace on `req`; the context middleware copies it into the
> `AsyncLocalStorage` store (4.1). The request-completion log lines emitted at logger.ts:70-72
> already run inside the context, so they pick up the trace via `emit`.
> **`userUid` stays the opaque uid; `req.user.email` is never added** — confirmed at
> logger.ts:68 it is not, and the allow-list now makes that structural.

### 4.3 `app/src/ai/usage.ts` — no change required

`recordUsage` already calls `logger.info("ai.usage", …)`; once 4.2 lands, the `ai.usage`
line inherits the trace from the active context automatically. The allow-list keeps
`totalTokens`/`promptTokens`/`outputTokens`/`route`/`provider`/`model` (all on the list).
**No edit needed** — this is the payoff of carrying trace in the context.

### 4.4 `app/src/server/createApp.ts` — no change required

Middleware order is already correct: `requestObservability` (line 78) → `requestContextMiddleware`
(line 80). No new middleware to insert.

---

## 5. Alert policies + log-based metrics (config, no code)

Primary artifact: **`docs/architecture/migration-2026-06-17/wave-0/artifacts/alert-policies.yaml`**
(also the canonical home is `infra/monitoring/alert-policies.yaml` per the spec; this Wave-0
copy is the build-ready source).

Three policies, all derived from log lines Arbor **already emits** (zero new instrumentation,
free-tier):

| Policy | Fires when | Backing metric(s) |
| :--- | :--- | :--- |
| 5xx error rate | `arbor_api_5xx / arbor_api_requests` > **2%** over **5 min** | `arbor_api_5xx`, `arbor_api_requests` |
| p95 latency | p95 of `latencyMs` > **5000 ms** over **10 min** | `arbor_api_latency_ms` (distribution) |
| AI failure burst | `arbor_ai_failures` > **5** over **5 min** | `arbor_ai_failures` (+ `arbor_ai_calls`, `arbor_ai_tokens` for volume tiles) |

`${PROJECT_ID}` and `${NOTIFICATION_CHANNEL_ID}` are substituted at apply time. The AI-failure
metric matches `severity=ERROR` lines naming a model call; tighten the regex to the exact
prefix the provider logs once 4.2 lands and the provider emits a stable `ai.error` message.

### Apply (human-run, NOT executed here — requires GCP auth/spend)

```bash
PID=arbor-prod   # your GCP project
# 1. One-time: create the founder email notification channel and capture its id.
gcloud beta monitoring channels create \
  --display-name="Arbor founder email" --type=email \
  --channel-labels=email_address=bguy.rubin@gmail.com --project="$PID"
#   -> record the returned channel id in infra/monitoring/README.md as NOTIFICATION_CHANNEL_ID

# 2. Create the log-based metrics (one per entry under logBasedMetrics:).
#    e.g. arbor_api_5xx:
gcloud logging metrics create arbor_api_5xx \
  --description="5xx responses on arbor-api" \
  --log-filter='resource.type="cloud_run_revision" resource.labels.service_name="arbor-api" jsonPayload.httpRequest.status>=500' \
  --project="$PID"
#    (repeat for arbor_api_requests, arbor_api_latency_ms, arbor_ai_failures, arbor_ai_calls, arbor_ai_tokens —
#     latency + tokens use --value-extractor; see the yaml valueExtractor fields)

# 3. Create each alert policy from the yaml (split into per-policy json or use the gcloud
#    --policy-from-file form). EU scope only.
gcloud alpha monitoring policies create --policy-from-file=<policy>.json --project="$PID"
```

All metric/policy resources are **independently deletable** (`gcloud logging metrics delete`
/ `gcloud alpha monitoring policies delete`) — the rollback for this config.

---

## 6. Test + verification plan

- **Unit (done, green):** `npx vitest run --config scripts/vitest.config.mjs src/lib/observability/`
  → 26 passed. Covers both header formats, malformed input, no-op-when-unset, allow-list drops
  PII, URL query-strip, carve-outs, trace propagation onto `ai.usage` + error lines.
- **Typecheck (done):** isolated `tsc --strict` over the three modules passes. (Full-repo `tsc`
  intentionally NOT run — the dirty tree will not compile.)
- **Integration (after 4.x applied on a clean baseline):** supertest a forced-500 route, assert
  `severity:ERROR` + stack in `message`; assert the request line and a triggered `ai.usage`
  line share `logging.googleapis.com/trace`.
- **Live (post-deploy, human):** curl a known route, find `X-Request-Id` in Cloud Logging,
  confirm the trace link resolves and the `ai.usage` line shares the trace; force a 500 and
  confirm it groups in Error Reporting; trip the error-rate alert in a staging burst.

---

## 7. NL / IL notes

- **NL (GDPR/AVG):** the allow-list + `logger.test.ts` is the **auditable DPIA evidence** that
  a children's product logs no personal data. EU residency: keep all log sinks + metric scopes
  in `europe-west4` / EU — **no US log routing**.
- **IL (Amendment 13):** the alert policies are the **breach-detection layer** feeding OPS-5's
  breach-notification clock. No content is logged, so Hebrew/RTL has no impact on the log line.

## 8. Cost + rollback

- **Cost:** ~zero. Log-based metrics + alert policies are free-tier on existing logs. **Sentry
  is explicitly deferred** (recurring SaaS bill) — revisit only if Error Reporting grouping
  proves insufficient.
- **Rollback:** revert the §4 diffs (request logging falls back to current behaviour); delete
  the gcloud metrics/policies individually.
