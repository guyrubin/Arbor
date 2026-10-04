/**
 * cohortMetrics — N1-05 (OBJ-INF-04): the read lane. Everything else in wave
 * N1 is a write; this is the only thing that can answer a question.
 *
 * THE DEFECT THIS CLOSES
 * ──────────────────────
 * Events land in `users/{uid}/events` and the only reader in the tree was
 * `components/tabs/AttributionTab.tsx`, which reads the SIGNED-IN USER's own
 * docs. `firestore.rules` is owner-scoped; there was no admin path, no
 * collection-group read, no rollup job. So "what is D1 across the product"
 * was not a hard question — it was an unaskable one. `server/adminMetrics.ts`
 * already proved the pattern (ADC + isAdmin + a Null store for local), and
 * stopped at users / paying / usageToday.
 *
 * THE SERVER DOES NO ARITHMETIC
 * ─────────────────────────────
 * Retention comes from `lib/retention.ts` `cohortRetention`. Funnel counts
 * come from `lib/attributionFunnel.ts` `aggregateFunnel`. This module decides
 * WHAT TO READ and hands it to code that is already tested, because a second
 * implementation of "did they come back on day 7" is how two dashboards start
 * disagreeing about the same week. The only counting written here is the
 * distinct-name census and the activation numerator/denominator, and NEITHER
 * produces a rate — see below.
 *
 * NO RATE IS EVER INVENTED. `cohortRetention` returns `rate: null` on an empty
 * denominator and this module passes that through untouched. Nothing here
 * divides. A percentage is the firewall's problem the moment it reaches a
 * surface, and the cheapest way to never render one is to never compute one.
 *
 * PRIVACY — WHY AN ADC READER IS SAFE HERE (critic C3)
 * ────────────────────────────────────────────────────
 * ADC bypasses Firestore rules by design, so ONE careless collectionGroup over
 * a child sub-collection would turn the founder's report into a cross-family
 * child-record reader, and no existing guard would notice. The containment is
 * that this module has exactly two inputs:
 *   1. `retentionRollups/{uid}` documents — day keys, counts and two
 *      acquisition props, by construction (N1-04's payload guard), and
 *   2. event NAMES, plus the three grouping props on EVENT_PROP_ALLOWLIST.
 * Event props are projected through that allow-list INSIDE the store, so a
 * call site that carried free text could not leak it even if one existed.
 * `users/{uid}/children/**` is never read from here, and the guard runs a
 * recursive key scan of a fully-populated response for
 * /child|name|note|text|transcript/i.
 */
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import { logger } from "./logger.js";
import { cohortRetention, dayKeyOf, type RetentionReport, type RetentionRollup } from "../lib/retention.js";
import { FUNNEL_EVENTS, aggregateFunnel, type FunnelEventDoc } from "../lib/attributionFunnel.js";

/**
 * The collection N1-04's client writer owns. Declared here rather than
 * imported, because `lib/retentionRollup.ts` imports the CLIENT firebase SDK
 * and must never be pulled into the server bundle. The guard pins this string
 * against that module's own exported constant by reading it as source, so the
 * two cannot drift without a test going red.
 */
export const RETENTION_ROLLUP_COLLECTION = "retentionRollups";

/** The only event props that may leave the store. Two grouping keys and the
 *  campaign filter `aggregateFunnel` needs — nothing else, ever. */
export const EVENT_PROP_ALLOWLIST = ["source", "market", "utm_campaign"] as const;

/** Hard ceilings on a single report, so a founder command can never become an
 *  unbounded scan of production. Both are reported in the response. */
export const MAX_ROLLUPS_SCANNED = 5000;
export const MAX_EVENTS_SCANNED = 20000;

/** How a funnel is named on the command line, and the event chain it means.
 *  `acquisition` is lib/attributionFunnel's own chain; `billing` is N1-02's. */
export const FUNNEL_CHAINS: Record<string, readonly string[]> = {
  acquisition: FUNNEL_EVENTS,
  billing: ["paywall_view", "checkout_start", "entitlement_active"],
  // B-MEAS-02: the pilot's primary metric — accept a step, report how it
  // went, and the next focus is built from that report.
  loop: ["today_action_accepted", "today_action_outcome", "loop_continued"],
};

/* ── the loop metric (B-MEAS-02) ──────────────────────────────────────────── */

/** ISO-8601 week key (YYYY-Www) of an ISO timestamp, UTC. */
export function isoWeekOf(iso: string | null): string | null {
  const ms = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const year = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((thursday.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export type LoopWeek = { week: string; completed: number; eligible: number; share: number | null };
export type LoopSummary = { weeks: LoopWeek[]; completed: number; eligible: number; share: number | null };

/**
 * Per family per ISO week: COMPLETED = the family emitted `loop_continued`
 * that week (a focus was built from an outcome the parent reported — the last
 * link of the chain, which cannot fire before an outcome exists); ELIGIBLE =
 * the family was active that week (any event). `share` is null — printed "not
 * answerable yet" — when nobody was eligible. Counts only; no uid leaves here.
 */
export function summariseLoop(events: readonly CohortEventDoc[]): LoopSummary {
  const active = new Map<string, Set<string>>();
  const done = new Map<string, Set<string>>();
  for (const e of events) {
    const week = isoWeekOf(e.at);
    if (!week) continue;
    if (!active.has(week)) active.set(week, new Set());
    active.get(week)!.add(e.uid);
    if (e.event === "loop_continued") {
      if (!done.has(week)) done.set(week, new Set());
      done.get(week)!.add(e.uid);
    }
  }
  const weeks = [...active.keys()].sort().map((week) => {
    const eligible = active.get(week)!.size;
    const completed = done.get(week)?.size ?? 0;
    return { week, completed, eligible, share: eligible > 0 ? completed / eligible : null };
  });
  const completed = weeks.reduce((n, w) => n + w.completed, 0);
  const eligible = weeks.reduce((n, w) => n + w.eligible, 0);
  return { weeks, completed, eligible, share: eligible > 0 ? completed / eligible : null };
}

export type CohortEventDoc = {
  uid: string;
  event: string;
  at: string | null;
  props: Record<string, unknown>;
};

/** B-MEAS-01: `uid` is the rollup's document id — used ONLY to drop an
 *  internal family's events from the same report; it never reaches the
 *  response. `cohort` is the writer's tag; a doc without one is a family. */
export type StoredRollup = RetentionRollup & {
  source: string | null;
  market: string | null;
  uid?: string;
  cohort?: "internal" | "family" | "demo";
};

export interface CohortMetricsStore {
  /** Every family's rollup document, bounded. */
  listRetentionRollups(limit?: number): Promise<StoredRollup[]>;
  /** Events at or after `sinceIso`, bounded, props already allow-listed. */
  listEvents(sinceIso: string, limit?: number): Promise<CohortEventDoc[]>;
  /** How the events were fetched — for the report's own honesty line. */
  readonly mode: "firestore" | "null";
}

/** Local/sandbox: no ADC, no data. Returns empty rather than 500ing, which
 *  makes every downstream number "not answerable yet" instead of zero. */
export class NullCohortMetricsStore implements CohortMetricsStore {
  readonly mode = "null" as const;
  async listRetentionRollups(): Promise<StoredRollup[]> { return []; }
  async listEvents(): Promise<CohortEventDoc[]> { return []; }
}

/** Keep only the grouping props. The projection is here, at the egress, not at
 *  the call sites — a new event surface is covered the day it is written. */
const projectProps = (raw: unknown): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const key of EVENT_PROP_ALLOWLIST) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === "string" || typeof v === "number") out[key] = v;
  }
  return out;
};

const toIso = (v: unknown): string | null => {
  if (!v) return null;
  if (typeof v === "string") return v;
  const ts = v as { toDate?: () => Date };
  try {
    return typeof ts.toDate === "function" ? ts.toDate().toISOString() : null;
  } catch {
    return null;
  }
};

export class FirestoreCohortMetricsStore implements CohortMetricsStore {
  readonly mode = "firestore" as const;
  private readonly db: Firestore;

  constructor(config: ArborConfig) {
    if (!getApps().length) {
      initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    }
    this.db = getFirestore(config.firestoreDatabaseId);
  }

  async listRetentionRollups(limit = MAX_ROLLUPS_SCANNED): Promise<StoredRollup[]> {
    try {
      const snap = await this.db.collection(RETENTION_ROLLUP_COLLECTION).limit(limit).get();
      const out: StoredRollup[] = [];
      for (const d of snap.docs) {
        const data = d.data() as Record<string, unknown>;
        const firstSeen = typeof data.firstSeen === "string" ? data.firstSeen : null;
        const activeDays = Array.isArray(data.activeDays) ? data.activeDays.filter((x): x is string => typeof x === "string") : [];
        if (!firstSeen || activeDays.length === 0) continue;
        out.push({
          firstSeen,
          activeDays,
          source: typeof data.source === "string" ? data.source : null,
          market: typeof data.market === "string" ? data.market : null,
          uid: d.id,
          cohort: data.cohort === "internal" ? "internal" : data.cohort === "demo" ? "demo" : "family",
        });
      }
      return out;
    } catch (error) {
      logger.error("Cohort rollup scan failed", error);
      return [];
    }
  }

  /**
   * The event scan. Ordering by `at` needs a COLLECTION_GROUP-scoped index on
   * that field, which `firestore.indexes.json` does not declare (only
   * `events.event` is declared). Rather than fail, the scan falls back to an
   * unordered bounded read and filters by date in memory, and the report says
   * which path it took — a number whose provenance is unclear is worse than a
   * missing one. The index entry to add is in FOLLOW-UPS-N1.md.
   */
  async listEvents(sinceIso: string, limit = MAX_EVENTS_SCANNED): Promise<CohortEventDoc[]> {
    const since = new Date(sinceIso);
    const collect = (docs: FirebaseFirestore.QueryDocumentSnapshot[]): CohortEventDoc[] => {
      const out: CohortEventDoc[] = [];
      for (const d of docs) {
        const data = d.data() as Record<string, unknown>;
        const event = typeof data.event === "string" ? data.event : null;
        if (!event) continue;
        const at = toIso(data.at);
        if (at && Date.parse(at) < since.getTime()) continue;
        // users/{uid}/events/{id} — the uid is the grandparent document id.
        const uid = d.ref.parent.parent?.id ?? "unknown";
        out.push({ uid, event, at, props: projectProps(data.props) });
      }
      return out;
    };
    try {
      const snap = await this.db.collectionGroup("events").orderBy("at", "desc").limit(limit).get();
      return collect(snap.docs);
    } catch (error) {
      logger.warn("Ordered event scan unavailable — falling back to an unordered bounded scan", {
        errorMessage: (error as { message?: string })?.message,
      });
      try {
        const snap = await this.db.collectionGroup("events").limit(limit).get();
        return collect(snap.docs);
      } catch (fallbackError) {
        logger.error("Cohort event scan failed", fallbackError);
        return [];
      }
    }
  }
}

export const createCohortMetricsStore = (config: ArborConfig): CohortMetricsStore =>
  config.memoryAdapter === "firestore" ? new FirestoreCohortMetricsStore(config) : new NullCohortMetricsStore();

/* ── activation ──────────────────────────────────────────────────────────── */

export type ActivationSummary = {
  /** Families that met the definition. A COUNT, never a rate. */
  count: number;
  /** Families whose onboarding is old enough for the question to be asked. */
  denominator: number;
  /** Always null on this route — see ACTIVATION_DEFINITION_READER. The
   *  sentence is printed by the script, which can read the owning module's
   *  source without dragging the client SDK into the server bundle. */
  definition: string | null;
};

/**
 * WHY THE DEFINITION IS NOT READ HERE.
 *
 * `lib/activation.ts` owns the sentence, and it imports `lib/kpiEvents` ->
 * `lib/analytics` -> `lib/firebase`, i.e. the CLIENT Firebase SDK. Importing
 * it from the server — even dynamically — pulls that whole module graph into
 * `dist/server.cjs`, where `import.meta.env` is empty and the client SDK has
 * no business being (measured: +24 KB and seven `import.meta` warnings on the
 * production esbuild). So the route returns `definition: null`, and the READER
 * the measure plan actually names — `cohort-report.mjs --activation` — prints
 * the definition by reading that module's SOURCE, which is both safe and
 * drift-proof. If a surface ever needs the sentence server-side, move it to a
 * dependency-free module of its own; do not import activation here.
 */
export const ACTIVATION_DEFINITION_READER = "app/scripts/cohort-report.mjs --activation";

/**
 * The DENOMINATOR's window in days: a family whose onboarding is younger than
 * this cannot yet have failed to activate, and counting them as a miss is the
 * same lie `eligibleForDay` exists to prevent on the retention side.
 *
 * Mirrors `ACTIVATION_WINDOW_DAYS` in `lib/activation.ts` — pinned against that
 * file's SOURCE by the guard (not imported, see above), so a change there turns
 * this red rather than making the two quietly disagree.
 */
export const ACTIVATION_WINDOW_DAYS = 7;

const ACTIVATION_EVENT = "activated";
const ONBOARDING_EVENT = "onboarding_completed";

/**
 * Count activated families and the families eligible to be asked. Counts only:
 * this function has no division in it, and the report has no place to put one.
 * `windowDays` is how old an onboarding must be before "did they activate" is
 * answerable — the same window the definition names.
 */
export function summariseActivation(
  events: readonly CohortEventDoc[],
  opts: { asOf: number; windowDays: number },
): { count: number; denominator: number } {
  const activated = new Set<string>();
  const eligible = new Set<string>();
  const cutoff = opts.asOf - opts.windowDays * 86_400_000;
  for (const e of events) {
    if (e.event === ACTIVATION_EVENT) activated.add(e.uid);
    if (e.event === ONBOARDING_EVENT) {
      const at = e.at ? Date.parse(e.at) : NaN;
      if (Number.isFinite(at) && at <= cutoff) eligible.add(e.uid);
    }
  }
  return { count: activated.size, denominator: eligible.size };
}

/* ── the funnel slice: aggregateFunnel, remapped, never reimplemented ─────── */

export type FunnelStageCount = { stage: string; count: number };
export type FunnelGroupRow = { key: string; stages: FunnelStageCount[] };

/**
 * Count one named chain, grouped by `source` or `market`.
 *
 * `aggregateFunnel` only knows its own three stage names, so an arbitrary
 * chain is mapped ONTO those positions, aggregated by the tested function, and
 * mapped back. That is deliberate: the alternative is a second grouped-count
 * implementation in the server, which is precisely the drift this wave is
 * trying to stop. The mapping is positional and total — if the library ever
 * carries fewer stages than a chain needs, this throws rather than silently
 * dropping the tail.
 */
export function countFunnelChain(
  events: readonly CohortEventDoc[],
  chain: readonly string[],
  groupBy: "source" | "market",
): FunnelGroupRow[] {
  if (chain.length > FUNNEL_EVENTS.length) {
    throw new Error(`funnel chain of ${chain.length} stages cannot be mapped onto ${FUNNEL_EVENTS.length} aggregateFunnel positions`);
  }
  const toPosition = new Map<string, string>();
  const fromPosition = new Map<string, string>();
  chain.forEach((stage, i) => {
    toPosition.set(stage, FUNNEL_EVENTS[i]);
    fromPosition.set(FUNNEL_EVENTS[i], stage);
  });
  const remapped: FunnelEventDoc[] = [];
  for (const e of events) {
    const position = toPosition.get(e.event);
    if (position) remapped.push({ event: position, props: e.props });
  }
  return aggregateFunnel(remapped, groupBy, "__all__").map((row) => ({
    key: row.key,
    stages: chain.map((stage) => ({
      stage,
      count: (row as unknown as Record<string, number>)[toPosition.get(stage) as string] ?? 0,
    })),
  }));
}

/* ── the report ──────────────────────────────────────────────────────────── */

export type CohortReport = {
  since: string;
  asOfDay: string;
  groupBy: "source" | "market";
  retention: RetentionReport;
  activation: ActivationSummary;
  funnels: Record<string, FunnelGroupRow[]>;
  /** B-MEAS-02: present when the `loop` funnel was asked for. */
  loop?: LoopSummary;
  eventCensus: FunnelStageCount[];
  scanned: { rollups: number; events: number; mode: "firestore" | "null" };
  /** B-MEAS-01: internal families (founder, comped, smoke) left out of every
   *  number above, and whether the caller asked to keep them in. */
  internal: { excluded: number; included: boolean };
  /** B-DIST-01: the demo family (invented data) — always left out, even with
   *  includeInternal; also counted in `internal.excluded`. */
  demo: { excluded: number };
  generatedAt: string;
};

/**
 * B-MEAS-01: split the rollups into the families a cohort number is about and
 * the internal ones. Events of an internal uid are dropped with them, so the
 * funnels, activation and census exclude the same accounts the retention does.
 */
export function excludeInternal<E extends { uid: string }>(
  rollups: readonly StoredRollup[],
  events: readonly E[],
  includeInternal = false,
): { rollups: StoredRollup[]; events: E[]; excluded: number; demoExcluded: number } {
  // B-DIST-01: a demo family is never a family — out even when internal is kept.
  const dropped = new Set<string>();
  const kept: StoredRollup[] = [];
  let demoExcluded = 0;
  for (const r of rollups) {
    const drop = r.cohort === "demo" || (!includeInternal && r.cohort === "internal");
    if (drop) {
      if (r.cohort === "demo") demoExcluded += 1;
      if (r.uid) dropped.add(r.uid);
    } else kept.push(r);
  }
  return {
    rollups: kept,
    events: events.filter((e) => !dropped.has(e.uid)),
    excluded: rollups.length - kept.length,
    demoExcluded,
  };
}

/**
 * Build the whole report. Pure orchestration over the store plus two library
 * functions; the only thing invented here is the census, which is a
 * distinct-name tally and nothing else.
 *
 * `eventCensus` is an ARRAY of `{ stage, count }`, not an object keyed by
 * event name. Keyed by name, a future event called anything matching
 * /child|name|note|text|transcript/i would put that word in a response KEY and
 * the guard would be asserting about the shape of the sink rather than the
 * shape of the data.
 */
export async function buildCohortReport(
  store: CohortMetricsStore,
  opts: {
    since: string;
    groupBy?: "source" | "market";
    now?: Date;
    funnels?: readonly string[];
    activationWindowDays?: number;
    /** B-MEAS-01: keep internal families in (default: excluded). */
    includeInternal?: boolean;
  },
): Promise<CohortReport> {
  const now = opts.now ?? new Date();
  const groupBy = opts.groupBy === "market" ? "market" : "source";
  const asOfDay = dayKeyOf(now) ?? new Date(now).toISOString().slice(0, 10);

  const [allRollups, allEvents] = await Promise.all([
    store.listRetentionRollups(),
    store.listEvents(opts.since),
  ]);
  const includeInternal = opts.includeInternal === true;
  const { rollups, events, excluded, demoExcluded } = excludeInternal(allRollups, allEvents, includeInternal);

  const census = new Map<string, number>();
  for (const e of events) census.set(e.event, (census.get(e.event) ?? 0) + 1);

  const funnels: Record<string, FunnelGroupRow[]> = {};
  for (const name of opts.funnels ?? []) {
    const chain = FUNNEL_CHAINS[name];
    if (!chain) continue;
    funnels[name] = countFunnelChain(events, chain, groupBy);
  }

  const loop = (opts.funnels ?? []).includes("loop") ? summariseLoop(events) : undefined;

  const windowDays = opts.activationWindowDays ?? ACTIVATION_WINDOW_DAYS;
  const activationCounts = summariseActivation(events, { asOf: now.getTime(), windowDays });

  return {
    since: opts.since,
    asOfDay,
    groupBy,
    // The arithmetic is lib/retention.ts's. `rate` is null, never 0, on an
    // empty denominator, and that null travels all the way to the printer.
    retention: cohortRetention(rollups, asOfDay),
    activation: { ...activationCounts, definition: null },
    funnels,
    ...(loop ? { loop } : {}),
    eventCensus: [...census.entries()]
      .map(([stage, count]) => ({ stage, count }))
      .sort((a, b) => b.count - a.count || a.stage.localeCompare(b.stage)),
    scanned: { rollups: rollups.length, events: events.length, mode: store.mode },
    internal: { excluded, included: includeInternal },
    demo: { excluded: demoExcluded },
    generatedAt: now.toISOString(),
  };
}

/** The key pattern no response value may ever be filed under. Exported so the
 *  guard and any future reader assert against ONE definition. */
export const FORBIDDEN_RESPONSE_KEY = /child|name|note|text|transcript/i;

/** Recursive key scan. Returns every offending path, so a failure names the
 *  field rather than just failing. */
export function scanForbiddenKeys(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => scanForbiddenKeys(v, `${path}[${i}]`));
  if (!value || typeof value !== "object") return [];
  const hits: string[] = [];
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_RESPONSE_KEY.test(key)) hits.push(`${path}.${key}`);
    hits.push(...scanForbiddenKeys(v, `${path}.${key}`));
  }
  return hits;
}
