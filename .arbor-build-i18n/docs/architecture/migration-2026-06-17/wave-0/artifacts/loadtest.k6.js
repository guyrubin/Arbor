// Arbor Cloud Run load test — PERF-2 (right-sizing) + PERF-1 (warm-instance baseline).
//
// Grounded against the REAL service:
//   - Express app: app/src/server/createApp.ts
//   - Routes:      app/src/routes/api.ts
//       * GET  /healthz          (added by PERF-1; public, no auth/CORS/rate-limit, never calls a model)
//       * POST /api/chat         (SSE when Accept: text/event-stream — long-lived, I/O-bound stream)
//       * POST /api/analyze-behavior (JSON — CPU/JSON-parse bound, calls modelProvider.generateJson)
//   - Guards on /api (createApp.ts):
//       * express-rate-limit:  windowMs 60_000, limit 30  -> 30 req/min PER CLIENT IP across ALL /api routes
//       * createAiQuota:       AI_USER_HOURLY_LIMIT default 80 -> 80/hr PER uid (or per IP if anon)
//       * createAuthMiddleware: REQUIRE_AUTH=true in prod -> bearer Firebase ID token REQUIRED on /api
//       * createCoachMeter on /api/chat: free-tier daily coach-message cap (FREE_COACH_MESSAGES_PER_DAY=10)
//   - Escalation: /api/chat and /api/analyze-behavior screen input first; an escalation-tripping
//       body short-circuits (no model call). Load-test bodies are deliberately BENIGN so the model
//       path actually runs (that is what we are sizing for).
//
// IMPORTANT — this script does NOT mutate prod. It only sends HTTP requests. Run it against a
// DEDICATED load-test Cloud Run revision (see load-test-plan.md), never against the live prod
// revision serving real families. Drive it from Cloud Shell in europe-west4 to remove WAN noise.
//
// ── Configuration (env vars) ─────────────────────────────────────────────────
//   BASE_URL   Base URL of the load-test revision, e.g. https://arbor-api-loadtest-xxxx-ew.a.run.app
//   ID_TOKEN   A valid Firebase ID token for a test account (REQUIRE_AUTH=true rejects /api without it).
//              Mint with the helper in load-test-plan.md (§4). Tokens expire in 1h — refresh for long runs.
//   SCENARIO   Which scenario set to run: "health" | "chat" | "analyze" | "all" (default "all").
//   CHAT_VUS, ANALYZE_VUS, HEALTH_VUS  Per-scenario peak VU overrides (optional).
//   RAMP       Ramp/hold seconds per stage (default 30). Keep stages long enough to let
//              Cloud Run autoscale settle before reading instance count.
//
// ── Usage ────────────────────────────────────────────────────────────────────
//   k6 run -e BASE_URL=https://<rev-host> -e ID_TOKEN="$TOKEN" -e SCENARIO=all loadtest.k6.js
//   # JSON summary for the runbook:
//   k6 run --summary-export=results.json -e BASE_URL=... -e ID_TOKEN="$TOKEN" loadtest.k6.js
//
// ── Rate-limit caveat (READ THIS before interpreting results) ────────────────
//   The 30 req/min/IP limit and 80/hr AI quota are PER CLIENT IP / per uid. From a single
//   Cloud Shell box every VU shares one egress IP, so /api scenarios will hit 429 quickly if you
//   push real RPS. Two correct ways to load-test the COMPUTE path rather than the rate-limiter:
//     (A) Sizing run (recommended for PERF-2): on the load-test revision, deploy with the
//         rate-limit + AI-quota relaxed via env (e.g. AI_USER_HOURLY_LIMIT=100000) OR mount the
//         load-test revision behind a config that raises express-rate-limit `limit`. This isolates
//         Cloud Run CPU/mem/concurrency from the app-level guards. (The guards are validated
//         separately in a small functional check — see plan §6.)
//     (B) Guard-aware run: keep guards on and treat 429 as expected; this measures end-to-end
//         user-facing behavior, not raw instance capacity. Use thresholds below tagged {expect_429}.
//   This script counts 429/401/409 separately so you can tell rate-limiting from real failures.

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend, Rate } from "k6/metrics";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
const ID_TOKEN = __ENV.ID_TOKEN || "";
const SCENARIO = (__ENV.SCENARIO || "all").toLowerCase();
const RAMP = Number(__ENV.RAMP || 30);

const authHeaders = ID_TOKEN ? { Authorization: `Bearer ${ID_TOKEN}` } : {};

// ── Custom metrics ───────────────────────────────────────────────────────────
const healthLatency = new Trend("health_latency_ms", true);
const chatTtfbStream = new Trend("chat_ttfb_ms", true); // time to first SSE byte (proxy for first-token)
const chatFullStream = new Trend("chat_full_stream_ms", true); // full SSE completion
const analyzeLatency = new Trend("analyze_latency_ms", true);
const rate429 = new Rate("rate_limited_429");
const rate401 = new Rate("unauthorized_401");
const rate409 = new Rate("escalation_409");
const serverErrors = new Counter("server_errors_5xx");

// ── Benign test bodies (deliberately do NOT trip screenForImmediateEscalation) ─
// childProfile.name is redacted server-side before the model call (createRedaction),
// so using a placeholder name is realistic and PII-safe.
const childProfile = {
  name: "TestChild",
  ageBand: "3-4y",
  domains: ["language", "social-emotional"],
};

const chatBody = JSON.stringify({
  message: "My toddler keeps refusing to put on shoes before we leave. Any gentle routine ideas?",
  childProfile,
  scholarLens: "vygotsky",
  language: "en",
});

// A small, benign behavior-log set — JSON-parse + model fan-out, no escalation keywords.
const analyzeBody = JSON.stringify({
  childProfile,
  logs: [
    { behaviorType: "transition resistance", trigger: "leaving the house", response: "offered a choice", notes: "calmed after 2 min" },
    { behaviorType: "transition resistance", trigger: "ending screen time", response: "5-minute warning", notes: "minor protest" },
    { behaviorType: "frustration", trigger: "puzzle too hard", response: "co-regulated", notes: "recovered quickly" },
  ],
});

// ── Scenarios ────────────────────────────────────────────────────────────────
// Each scenario is opt-in via SCENARIO env so you can run them in isolation while
// watching `gcloud run services describe` / Cloud Monitoring for the matching revision.
const buildScenarios = () => {
  const all = {};

  // 1) /healthz — cheap, no model, no auth. Validates warm-instance latency floor (PERF-1)
  //    and establishes the network/container-only baseline. Should be single-digit ms warm.
  if (SCENARIO === "all" || SCENARIO === "health") {
    all.health = {
      executor: "ramping-vus",
      exec: "health",
      startVUs: 0,
      stages: [
        { duration: `${RAMP}s`, target: Number(__ENV.HEALTH_VUS || 20) },
        { duration: `${RAMP}s`, target: Number(__ENV.HEALTH_VUS || 20) },
        { duration: `${RAMP}s`, target: 0 },
      ],
      tags: { scenario: "health" },
    };
  }

  // 2) /api/chat SSE — the connection-count-bound, long-lived path. CAPPED concurrency:
  //    these hold a stream open for the full model generation. This probes how many
  //    concurrent streams ONE instance can hold => informs --concurrency (PERF-2).
  if (SCENARIO === "all" || SCENARIO === "chat") {
    all.chat = {
      executor: "ramping-vus",
      exec: "chat",
      startVUs: 0,
      stages: [
        { duration: `${RAMP}s`, target: Number(__ENV.CHAT_VUS || 10) }, // cap: kept low on purpose (see rate-limit caveat)
        { duration: `${RAMP * 2}s`, target: Number(__ENV.CHAT_VUS || 10) },
        { duration: `${RAMP}s`, target: 0 },
      ],
      tags: { scenario: "chat" },
      startTime: SCENARIO === "all" ? `${RAMP * 3 + 5}s` : "0s", // stagger after health when running all
    };
  }

  // 3) /api/analyze-behavior — the structured-JSON, CPU/parse-bound path. This is the
  //    profile that most directly stresses CPU + the firebase-admin/@google-cloud/vertexai
  //    resident set => informs --cpu and --memory (PERF-2). Also the prime PERF-4 cache target.
  if (SCENARIO === "all" || SCENARIO === "analyze") {
    all.analyze = {
      executor: "ramping-vus",
      exec: "analyze",
      startVUs: 0,
      stages: [
        { duration: `${RAMP}s`, target: Number(__ENV.ANALYZE_VUS || 8) },
        { duration: `${RAMP * 2}s`, target: Number(__ENV.ANALYZE_VUS || 8) },
        { duration: `${RAMP}s`, target: 0 },
      ],
      tags: { scenario: "analyze" },
      startTime: SCENARIO === "all" ? `${RAMP * 6 + 10}s` : "0s", // stagger after chat when running all
    };
  }

  return all;
};

export const options = {
  scenarios: buildScenarios(),
  // Thresholds double as pass/fail gates AND as the numbers you copy into the runbook.
  // Tune targets after the first baseline run; these are launch-readiness starting bars.
  thresholds: {
    // Warm /healthz must be fast — this is the warm-instance signal for PERF-1.
    "health_latency_ms": ["p(95)<150"],
    // First SSE byte ~ first-token latency. PERF-1 target: warm < 3s to first token.
    "chat_ttfb_ms": ["p(95)<3000"],
    // Structured analysis is a full model round-trip; generous bar, watch the trend not the absolute.
    "analyze_latency_ms": ["p(95)<8000"],
    // Real server failures must stay near zero. 429/401/409 are tracked separately (expected, not failures).
    "server_errors_5xx": ["count<1"],
    // Surface rate-limiting so you can tell it apart from capacity exhaustion.
    "rate_limited_429": ["rate<0.5"],
  },
  // Abort SSE reads that hang so a stuck stream doesn't pin a VU forever.
  noConnectionReuse: false,
};

// ── Scenario functions ───────────────────────────────────────────────────────

export function health() {
  const res = http.get(`${BASE_URL}/healthz`, { tags: { name: "healthz" } });
  healthLatency.add(res.timings.duration);
  check(res, {
    "healthz 200": (r) => r.status === 200,
    "healthz status ok": (r) => {
      try { return JSON.parse(r.body).status === "ok"; } catch { return false; }
    },
    // Guard: /healthz must NOT leak config (NL note in spec). Only status + env allowed.
    "healthz does not leak project/model": (r) =>
      !/project|model|gemini|vertex|count|uid/i.test(r.body || ""),
  });
  if (res.status >= 500) serverErrors.add(1);
  sleep(0.5);
}

export function chat() {
  // SSE: set Accept so the route streams (wantsSse() checks for text/event-stream).
  // http.post buffers the whole stream; we approximate first-token latency with
  // res.timings.waiting (TTFB) and full-stream with res.timings.duration. For true
  // per-event timing use a streaming client (see plan §7 — k6 SSE / xk6-sse note).
  const res = http.post(`${BASE_URL}/api/chat`, chatBody, {
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...authHeaders,
    },
    tags: { name: "api_chat" },
    timeout: "60s",
  });

  rate429.add(res.status === 429);
  rate401.add(res.status === 401);
  rate409.add(res.status === 409);
  if (res.status >= 500) serverErrors.add(1);

  if (res.status === 200) {
    chatTtfbStream.add(res.timings.waiting); // TTFB ~ time to first SSE byte
    chatFullStream.add(res.timings.duration);
  }

  check(res, {
    "chat 200 or expected-guard": (r) => [200, 401, 409, 429].includes(r.status),
    "chat streamed events": (r) => r.status !== 200 || /event:\s*(status|chunk|done)/.test(r.body || ""),
  });
  sleep(1); // pace below 30/min/IP when running guard-aware (Scenario B)
}

export function analyze() {
  const res = http.post(`${BASE_URL}/api/analyze-behavior`, analyzeBody, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    tags: { name: "api_analyze" },
    timeout: "60s",
  });

  rate429.add(res.status === 429);
  rate401.add(res.status === 401);
  rate409.add(res.status === 409);
  if (res.status >= 500) serverErrors.add(1);

  if (res.status === 200) analyzeLatency.add(res.timings.duration);

  check(res, {
    "analyze 200 or expected-guard": (r) => [200, 401, 409, 429].includes(r.status),
    "analyze returned structured json": (r) => {
      if (r.status !== 200) return true;
      try {
        const j = JSON.parse(r.body);
        return "triggerBreakdown" in j && "effectivenessRating" in j;
      } catch { return false; }
    },
  });
  sleep(1);
}

// ── Summary: human-readable + a compact line for the runbook table ────────────
export function handleSummary(data) {
  const m = data.metrics;
  const p = (name, q) => (m[name] && m[name].values[q] != null ? m[name].values[q].toFixed(0) : "n/a");
  const runbookLine = [
    `health p95=${p("health_latency_ms", "p(95)")}ms`,
    `chat_ttfb p95=${p("chat_ttfb_ms", "p(95)")}ms`,
    `analyze p95=${p("analyze_latency_ms", "p(95)")}ms`,
    `5xx=${m.server_errors_5xx ? m.server_errors_5xx.values.count : 0}`,
    `429rate=${m.rate_limited_429 ? (m.rate_limited_429.values.rate * 100).toFixed(1) : 0}%`,
  ].join("  ");
  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }) +
      `\n\n── Copy into perf runbook results table ──\n${runbookLine}\n`,
    "results.json": JSON.stringify(data, null, 2),
  };
}
