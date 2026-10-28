/**
 * B-AIOPS-03 — one content-free incident sink for AI and payment failures.
 *
 * Before this, an API 5xx storm, a rejected or failing RevenueCat webhook, a
 * Live token that could not be minted or a socket the provider closed before
 * setup (the depleted-prepay signature) were each one log line among
 * thousands; nobody was told. This module turns the four operational signals
 * into INCIDENTS with a named owner and a runbook, delivered to:
 *
 *  - the structured log, always (`message: "ops.incident"`, ERROR while
 *    firing, WARNING on recovery) — a Cloud Logging log-based alert can key
 *    on it with no further code;
 *  - an external webhook (`OPS_ALERT_WEBHOOK_URL`, default off) that receives
 *    one plain line `{ "text": … }` per incident (Slack / Google Chat style).
 *
 * CONTENT-FREE BY CONSTRUCTION: an incident is built only from closed enums
 * (signal, reason, state), counts, a window, the server clock, the configured
 * owner, a fixed runbook anchor, an Express route TEMPLATE (`/api/memory/:childId`,
 * never a concrete URL) and, for the prepay alarm, three numbers. There is no
 * free-text field: no child text, prompt, audio, transcript, email or uid can
 * reach an incident, whatever a caller passes.
 *
 * Each (signal, reason) is a small sliding window: it FIRES once when its
 * threshold is reached and RESOLVES once the signal's healthy path is seen
 * again after a full quiet window. Recording never throws and never awaits
 * in the request path; delivery failures are logged, not retried.
 */
import type { ArborConfig } from "../config/env.js";
import { logger } from "./logger.js";

const MIN = 60_000;

/** `quietMs`: how long after the last failure a healthy signal resolves the
 *  incident (default: the window). 0 = the first healthy reading resolves. */
type Rule = { threshold: number; windowMs: number; quietMs?: number };
type SignalSpec = { runbook: string; action: string; reasons: Record<string, Rule> };

/** The four signals, their closed reason enums, thresholds and runbooks. */
export const OPS_SIGNALS = {
  api_5xx_burst: {
    runbook: "docs/ops/incident-alerts.md#api-5xx-burst",
    action: "Check the Cloud Run revision and Error Reporting for the named route; roll back if a release caused it.",
    reasons: { burst: { threshold: 10, windowMs: 5 * MIN } },
  },
  billing_webhook_failure: {
    runbook: "docs/ops/incident-alerts.md#billing-webhook-failure",
    action: "Paid upgrades may not be applied. Check REVENUECAT_WEBHOOK_AUTH against the RevenueCat dashboard and the webhook delivery log; resend failed events.",
    reasons: {
      bad_signature: { threshold: 3, windowMs: 15 * MIN },
      not_configured: { threshold: 1, windowMs: 15 * MIN },
      store_read_only: { threshold: 1, windowMs: 15 * MIN },
      handler_error: { threshold: 1, windowMs: 15 * MIN },
    },
  },
  live_unavailable: {
    runbook: "docs/ops/incident-alerts.md#live-unavailable",
    action: "Families are falling back from Live voice. Check the AI Studio prepaid balance first, then the provider status; top up by hand (auto-reload stays off).",
    reasons: {
      mint_failed: { threshold: 3, windowMs: 15 * MIN },
      eu_mint_failed: { threshold: 3, windowMs: 15 * MIN },
      connect_failed: { threshold: 3, windowMs: 60 * MIN },
      residency_denied: { threshold: 1, windowMs: 60 * MIN, quietMs: 0 },
      budget_store_unavailable: { threshold: 3, windowMs: 15 * MIN },
    },
  },
  prepay_low: {
    runbook: "docs/ops/incident-alerts.md#prepay-low",
    action: "The AI Studio prepaid balance is at or below 20 % of the last top-up. Top up by hand (auto-reload stays off) and update AI_PREPAY_LEDGER.",
    reasons: { below_20_percent: { threshold: 1, windowMs: 24 * 60 * MIN, quietMs: 0 } },
  },
} as const satisfies Record<string, SignalSpec>;

export type OpsSignal = keyof typeof OPS_SIGNALS;
export type OpsReason<S extends OpsSignal> = keyof (typeof OPS_SIGNALS)[S]["reasons"] & string;

export type PrepayFigures = { remaining: number; credit: number; currency: string };

export type OpsIncident = {
  signal: OpsSignal;
  reason: string;
  state: "firing" | "resolved";
  /** Server clock, ISO 8601. */
  at: string;
  /** Events inside the window when it fired (0 on recovery). */
  count: number;
  windowMinutes: number;
  /** The named human from OPS_ALERT_OWNER ("unassigned" while it is off). */
  owner: string;
  runbook: string;
  action: string;
  /** api_5xx_burst only: the Express route template that failed most. */
  route?: string;
  /** prepay_low only. */
  prepay?: PrepayFigures;
};

export interface OpsAlertSink {
  deliver(incident: OpsIncident): Promise<void>;
}

export type OpsExtra = { route?: string; prepay?: PrepayFigures };

export interface OpsAlerts {
  /** One failure of `signal`/`reason`. Never throws, never blocks. */
  record<S extends OpsSignal>(signal: S, reason: OpsReason<S>, extra?: OpsExtra): void;
  /** The signal's healthy path was seen (optionally only for these reasons):
   *  resolves a firing reason once its quiet window has passed. */
  ok<S extends OpsSignal>(signal: S, reasons?: readonly OpsReason<S>[]): void;
  /** Await pending deliveries (tests, shutdown). */
  flush(): Promise<void>;
  readonly owner: string;
  readonly delivery: "log" | "webhook";
}

/** Only a route TEMPLATE may travel: path characters and `:param` names. */
const ROUTE_TEMPLATE = /^\/[A-Za-z0-9_/:.-]{0,119}$/;
export const safeRouteTemplate = (route: unknown): string | undefined =>
  typeof route === "string" && ROUTE_TEMPLATE.test(route) ? route : undefined;

const finite = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.round(n * 100) / 100 : 0);
const CURRENCY = /^[A-Z]{3}$/;

/** One plain, content-free line for a chat webhook. */
export const formatIncidentText = (i: OpsIncident): string => [
  `[Arbor] ${i.state === "firing" ? "FIRING" : "RESOLVED"} ${i.signal}/${i.reason}`,
  i.state === "firing" ? `${i.count} in ${i.windowMinutes} min` : "quiet again",
  ...(i.route ? [`route ${i.route}`] : []),
  ...(i.prepay ? [`balance ${i.prepay.remaining} of ${i.prepay.credit} ${i.prepay.currency}`] : []),
  `owner ${i.owner}`,
  i.at,
  `runbook ${i.runbook}`,
  ...(i.state === "firing" ? [i.action] : []),
].join(" · ");

/** Always on: the structured log line a log-based alert keys on. */
export const logSink: OpsAlertSink = {
  async deliver(incident) {
    if (incident.state === "firing") logger.error("ops.incident", undefined, { ...incident });
    else logger.warn("ops.incident", { ...incident });
  },
};

/** The external delivery: one POST of `{ text }` per incident, 5 s bounded. */
export const webhookSink = (url: string, fetchImpl: typeof fetch = fetch): OpsAlertSink => ({
  async deliver(incident) {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: formatIncidentText(incident) }),
      signal: AbortSignal.timeout(5_000),
    });
    // The status only: a webhook's error body can echo the URL's secret path.
    if (!res.ok) throw new Error(`ops alert webhook answered ${res.status}`);
  },
});

type WindowState = { events: number[]; firing: boolean; lastFailureAt: number };

export function createOpsAlerts(opts: { owner?: string; sinks?: OpsAlertSink[]; now?: () => number; delivery?: "log" | "webhook" } = {}): OpsAlerts {
  const owner = opts.owner?.trim() || "unassigned";
  const sinks = opts.sinks ?? [logSink];
  const now = opts.now ?? Date.now;
  const windows = new Map<string, WindowState>();
  const pending = new Set<Promise<void>>();

  const emit = (incident: OpsIncident) => {
    for (const sink of sinks) {
      const p = sink.deliver(incident)
        .catch((error) => logger.error("Ops alert delivery failed", undefined, {
          signal: incident.signal, reason: incident.reason, state: incident.state,
          errorMessage: error instanceof Error ? error.message.slice(0, 120) : "unknown",
        }))
        .finally(() => pending.delete(p));
      pending.add(p);
    }
  };

  const incident = (signal: OpsSignal, reason: string, state: OpsIncident["state"], at: number, count: number, rule: Rule, extra?: OpsExtra): OpsIncident => {
    const spec: SignalSpec = OPS_SIGNALS[signal];
    const route = signal === "api_5xx_burst" ? safeRouteTemplate(extra?.route) : undefined;
    const prepay = signal === "prepay_low" && extra?.prepay
      ? { remaining: finite(extra.prepay.remaining), credit: finite(extra.prepay.credit), currency: CURRENCY.test(extra.prepay.currency) ? extra.prepay.currency : "EUR" }
      : undefined;
    return {
      signal, reason, state, at: new Date(at).toISOString(), count,
      windowMinutes: Math.round(rule.windowMs / MIN),
      owner, runbook: spec.runbook, action: spec.action,
      ...(route ? { route } : {}),
      ...(prepay ? { prepay } : {}),
    };
  };

  return {
    owner,
    delivery: opts.delivery ?? "log",
    record(signal, reason, extra) {
      try {
        const spec: SignalSpec | undefined = OPS_SIGNALS[signal];
        const rule = spec?.reasons[reason as string];
        if (!spec || !rule) return; // closed enums: an unknown pair is dropped
        const t = now();
        const key = `${signal}/${reason}`;
        const state = windows.get(key) ?? { events: [], firing: false, lastFailureAt: 0 };
        state.events = state.events.filter((e) => t - e < rule.windowMs);
        state.events.push(t);
        state.lastFailureAt = t;
        windows.set(key, state);
        if (!state.firing && state.events.length >= rule.threshold) {
          state.firing = true;
          emit(incident(signal, reason as string, "firing", t, state.events.length, rule, extra));
        }
      } catch {
        /* alerting must never break the request it observes */
      }
    },
    ok(signal, reasons) {
      try {
        const t = now();
        const spec: SignalSpec | undefined = OPS_SIGNALS[signal];
        if (!spec) return;
        for (const [reason, rule] of Object.entries(spec.reasons)) {
          if (reasons && !(reasons as readonly string[]).includes(reason)) continue;
          const state = windows.get(`${signal}/${reason}`);
          if (!state?.firing || t - state.lastFailureAt < (rule.quietMs ?? rule.windowMs)) continue;
          state.firing = false;
          state.events = [];
          emit(incident(signal, reason, "resolved", t, 0, rule));
        }
      } catch {
        /* never throws */
      }
    },
    async flush() {
      while (pending.size) await Promise.all([...pending]);
    },
  };
}

export { opsWebhookUrl } from "../config/env.js";

/** The app's alert sink from config: always the log; the webhook only when set. */
export function createOpsAlertsFromConfig(config: Pick<ArborConfig, "opsAlertOwner" | "opsAlertWebhookUrl">, fetchImpl?: typeof fetch): OpsAlerts {
  const url = config.opsAlertWebhookUrl;
  return createOpsAlerts({
    owner: config.opsAlertOwner,
    sinks: url ? [logSink, webhookSink(url, fetchImpl)] : [logSink],
    delivery: url ? "webhook" : "log",
  });
}

/**
 * B-AIOPS-03: Express middleware counting 5xx answers on the API. A burst
 * fires `api_5xx_burst` with the route TEMPLATE that failed; a healthy answer
 * after a quiet window resolves it. Status and route only — never a body.
 */
export const apiFailureObserver = (alerts: OpsAlerts) =>
  (req: { baseUrl?: string; route?: { path?: unknown } }, res: { statusCode: number; on: (event: "finish", cb: () => void) => void }, next: () => void) => {
    res.on("finish", () => {
      if (res.statusCode >= 500) {
        const path = typeof req.route?.path === "string" ? `${req.baseUrl ?? ""}${req.route.path}` : undefined;
        alerts.record("api_5xx_burst", "burst", { route: path ?? "/unmatched" });
      } else {
        alerts.ok("api_5xx_burst");
      }
    });
    next();
  };
