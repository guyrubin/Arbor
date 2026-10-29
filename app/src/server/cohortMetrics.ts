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
import { cohortRetention, dayIndex, dayKeyOf, type RetentionReport, type RetentionRollup } from "../lib/retention.js";
import { FUNNEL_EVENTS, aggregateFunnel, type FunnelEventDoc } from "../lib/attributionFunnel.js";
import { OFFER_IDS } from "../lib/offers.js";
import { ACQUISITION_CHANNELS, channelOfSource } from "../lib/acquisitionChannel.js";
import { CONTRACT_WINDOW_DAYS, GATE_A, MATURITY_DAYS, MEASURE_DEFINITIONS, METRIC_CONTRACT_VERSION, PAID_EVENT, STANDING_MISSING_DATA, VALUE_EVENTS, W4_DAYS } from "../lib/metricContract.js";
import { recordStillEntitles, type EntitlementRecord } from "./entitlements.js";
import { legacyRedemptionsFromLedgers } from "./referral.js";

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

/** B-BOOK-51 / B-GAME-18: the Kid Mode play events, and the ONLY props they
 *  may carry out of the store (catalogue ids, language, own|stock, replay,
 *  the kid-mode tag). Projected for these events alone; never a child id or a
 *  choice id (the client projection refuses both, kidPlayEvents.guard.test). */
export const KID_PLAY_EVENTS = ["game_sitting", "book_opened", "book_finished"] as const;
export const KID_EVENT_PROP_ALLOWLIST = ["game", "replay", "book_id", "lang", "hero", "kid_mode"] as const;
/** A weekly cell about fewer families than this is hidden (B-BOOK-51 boundary). */
export const MIN_CELL_FAMILIES = 5;

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
  // B-RESID-05: a send of the invite link, then a referred family's first
  // activation (lib/share shareInviteLink → lib/referralActivation). Names
  // only; the grouping props are the allow-listed source/market.
  share: ["share_completed", "invite_activated"],
};

/** B-RESID-05: chains whose stages are done by DIFFERENT families (one sends,
 *  another activates). Grouped by each family's own source the one chain
 *  would split across rows (the sender's source 1 → 0, "share" 0 → 1), so it
 *  is counted in ONE row, keyed ONE_ROW_KEY. Mirrored in cohort-report.mjs. */
export const ONE_ROW_CHAINS: readonly string[] = ["share"];
export const ONE_ROW_KEY = "all";

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
  /** B-GROWTH-43: each family's one offer redemption (`offerRedemptions/{uid}`),
   *  projected to the offer id. Optional: a store without it reads as "not read". */
  listOfferRedemptions?(limit?: number): Promise<HouseholdOffer[]>;
  /** B-GROWTH-43: each family's billing state from `entitlements/{uid}`,
   *  projected to two booleans in the store; no plan, product or date leaves. */
  listBillingStates?(limit?: number, now?: number): Promise<HouseholdBilling[]>;
  /** BD-25: accepted co-parent shares, projected to the two uids, so a
   *  co-parent folds into the owner's household. */
  listCoParentLinks?(limit?: number): Promise<CoParentLink[]>;
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
/** Exported for the guard: the egress projection of one event's props. */
export const projectEventProps = (raw: unknown, event?: string): Record<string, unknown> => projectProps(raw, event);
function projectProps(raw: unknown, event?: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const key of EVENT_PROP_ALLOWLIST) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === "string" || typeof v === "number") out[key] = v;
  }
  if (event && (KID_PLAY_EVENTS as readonly string[]).includes(event)) {
    for (const key of KID_EVENT_PROP_ALLOWLIST) {
      const v = (raw as Record<string, unknown>)[key];
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[key] = v;
    }
  }
  return out;
}

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

  listOfferRedemptions(limit?: number): Promise<HouseholdOffer[]> {
    return new FirestoreHouseholdReads(this.db).offers(limit);
  }

  listBillingStates(limit?: number, now?: number): Promise<HouseholdBilling[]> {
    return new FirestoreHouseholdReads(this.db).billing(limit, now);
  }

  listCoParentLinks(limit?: number): Promise<CoParentLink[]> {
    return new FirestoreHouseholdReads(this.db).coParents(limit);
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
        out.push({ uid, event, at, props: projectProps(data.props, event) });
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

/** B-GROWTH-43: the Firestore reads of the household line, bounded like the rest. */
export class FirestoreHouseholdReads {
  constructor(private readonly db: Firestore) {}
  async offers(limit = MAX_ROLLUPS_SCANNED): Promise<HouseholdOffer[]> {
    try {
      const [snap, ledgers] = await Promise.all([
        this.db.collection(OFFER_REDEMPTIONS_COLLECTION).limit(limit).get(),
        this.db.collection("referralGrants").limit(limit).get(),
      ]);
      const explicit = snap.docs.flatMap((d) => {
        const offerId = (d.data() as Record<string, unknown>).offerId;
        return typeof offerId === "string" ? [{ uid: d.id, offerId }] : [];
      });
      return withLegacyRedemptions(explicit, legacyRedemptionsFromLedgers(ledgers.docs.map((d) => d.data())));
    } catch (error) {
      logger.error("Cohort offer scan failed", error);
      return [];
    }
  }
  async coParents(limit = MAX_ROLLUPS_SCANNED): Promise<CoParentLink[]> {
    try {
      const snap = await this.db.collection("shares").where("role", "==", "co_parent").limit(limit).get();
      return coParentLinksOf(snap.docs.map((d) => d.data()));
    } catch (error) {
      logger.error("Cohort co-parent scan failed", error);
      return [];
    }
  }
  async billing(limit = MAX_ROLLUPS_SCANNED, now = Date.now()): Promise<HouseholdBilling[]> {
    try {
      const snap = await this.db.collection("entitlements").limit(limit).get();
      return snap.docs.map((d) => ({ uid: d.id, ...billingStateOf(d.data() as EntitlementRecord, now) }));
    } catch (error) {
      logger.error("Cohort billing scan failed", error);
      return [];
    }
  }
}

export const createCohortMetricsStore = (config: ArborConfig): CohortMetricsStore =>
  config.memoryAdapter === "firestore" ? new FirestoreCohortMetricsStore(config) : new NullCohortMetricsStore();

/* ── Kid Mode play (B-GAME-18 / B-BOOK-51) ─────────────────────────────────── */

/** One game in one ISO week. Every number is null when the cell is hidden. */
export type KidGameWeek = {
  week: string;
  game: string;
  hidden: boolean;
  families: number | null;
  sittings: number | null;
  /** Sittings that were a Play again — the replay share is replays of sittings
   *  (two counts; this module never divides, the reader prints "n of m"). */
  replays: number | null;
  /** Families that came back to this game unprompted on a later day within 7
   *  days of their first sitting that week (Kid Mode has no push into a game). */
  returned7d: number | null;
};
export type KidBookWeek = { week: string; book: string; hidden: boolean; families: number | null; opened: number | null; finished: number | null };
export type KidPlaySummary = { minFamilies: number; games: KidGameWeek[]; books: KidBookWeek[] };

const DAY = 86_400_000;
const dayOf = (ms: number) => Math.floor(ms / DAY);

/**
 * Weekly Kid Mode play, per game and per book, aggregated across families —
 * counts and shares of PLAY, never a statement about any child (no
 * developmental inference, no per-family row). A cell about fewer than
 * MIN_CELL_FAMILIES families is hidden: its numbers are null. Only events the
 * client tagged `kid_mode: true` count.
 */
export function summariseKidPlay(events: readonly CohortEventDoc[], minFamilies = MIN_CELL_FAMILIES): KidPlaySummary {
  const kid = events.filter((e) => e.props?.kid_mode === true && (KID_PLAY_EVENTS as readonly string[]).includes(e.event) && e.at && Number.isFinite(Date.parse(e.at)));
  // every sitting of a (uid, game), by day, for the return check
  const sittingDays = new Map<string, number[]>();
  type GameCell = { uids: Set<string>; sittings: number; replays: number; first: Map<string, number> };
  const games = new Map<string, GameCell>();
  type BookCell = { uids: Set<string>; opened: number; finished: number };
  const books = new Map<string, BookCell>();
  for (const e of kid) {
    const ms = Date.parse(e.at!);
    const week = isoWeekOf(e.at);
    if (!week) continue;
    if (e.event === "game_sitting") {
      const game = typeof e.props.game === "string" ? e.props.game : null;
      if (!game) continue;
      const key = `${week}|${game}`;
      const cell = games.get(key) ?? { uids: new Set(), sittings: 0, replays: 0, first: new Map() };
      cell.uids.add(e.uid);
      cell.sittings += 1;
      if (e.props.replay === true) cell.replays += 1;
      const prev = cell.first.get(e.uid);
      if (prev === undefined || ms < prev) cell.first.set(e.uid, ms);
      games.set(key, cell);
      const k = `${e.uid}|${game}`;
      sittingDays.set(k, [...(sittingDays.get(k) ?? []), dayOf(ms)]);
    } else {
      const book = typeof e.props.book_id === "string" ? e.props.book_id : null;
      if (!book) continue;
      const key = `${week}|${book}`;
      const cell = books.get(key) ?? { uids: new Set(), opened: 0, finished: 0 };
      cell.uids.add(e.uid);
      if (e.event === "book_opened") cell.opened += 1;
      else cell.finished += 1;
      books.set(key, cell);
    }
  }
  const gameRows: KidGameWeek[] = [...games.entries()].map(([key, c]) => {
    const [week, game] = key.split("|");
    const families = c.uids.size;
    if (families < minFamilies) return { week, game, hidden: true, families: null, sittings: null, replays: null, returned7d: null };
    let returned = 0;
    for (const [uid, firstMs] of c.first) {
      const d0 = dayOf(firstMs);
      if ((sittingDays.get(`${uid}|${game}`) ?? []).some((d) => d > d0 && d <= d0 + 7)) returned += 1;
    }
    return { week, game, hidden: false, families, sittings: c.sittings, replays: c.replays, returned7d: returned };
  });
  const bookRows: KidBookWeek[] = [...books.entries()].map(([key, c]) => {
    const [week, book] = key.split("|");
    const families = c.uids.size;
    return families < minFamilies
      ? { week, book, hidden: true, families: null, opened: null, finished: null }
      : { week, book, hidden: false, families, opened: c.opened, finished: c.finished };
  });
  const order = <T extends { week: string }>(rows: T[], k: (r: T) => string) => rows.sort((a, b) => b.week.localeCompare(a.week) || k(a).localeCompare(k(b)));
  return { minFamilies, games: order(gameRows, (r) => r.game), books: order(bookRows, (r) => r.book) };
}

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

/* ── B-GROWTH-43: source → offer → activation → paying, per household ────── */

/** Mirrors server/referral.ts OFFER_REDEMPTIONS_COLLECTION (pinned by the test). */
export const OFFER_REDEMPTIONS_COLLECTION = "offerRedemptions";

export type HouseholdOffer = { uid: string; offerId: string };

/** B-GROWTH-43: a family a referrer ledger credits but with no redemption
 *  record redeemed the referral month before the per-family claim existed;
 *  it counts under that offer, never as full price. Pure. */
export function withLegacyRedemptions(offers: readonly HouseholdOffer[], legacyUids: readonly string[]): HouseholdOffer[] {
  const seen = new Set(offers.map((o) => o.uid));
  return [...offers, ...legacyUids.filter((uid) => !seen.has(uid)).map((uid) => ({ uid, offerId: "referral_month" }))];
}
/** `billed`: the record came from a store (App Store, Play, web checkout), not
 *  a comp. `paying`: billed, a paid plan, past any store trial, still entitling.
 *  `lapsed`: billed and no longer entitling: expired, refunded, a store trial
 *  that ended unpaid, or a subscription moved to another account. */
export type HouseholdBilling = { uid: string; billed: boolean; paying: boolean; lapsed: boolean };

const BILLED_PROVIDERS = new Set(["stripe", "app_store", "play_store"]);

/** The two booleans a billing record is reduced to before it leaves the store. */
export function billingStateOf(record: EntitlementRecord | null | undefined, now = Date.now()): Omit<HouseholdBilling, "uid"> {
  const billed = !!record?.provider && BILLED_PROVIDERS.has(record.provider);
  if (!record || !billed) return { billed: false, paying: false, lapsed: false };
  const entitles = record.plan !== "free" && recordStillEntitles(record, now);
  return { billed, paying: entitles && record.status !== "in_trial", lapsed: !entitles };
}

/** BD-37: the group a household falls in — its first-touch source, market, or
 *  acquisition channel (lib/acquisitionChannel.ts). */
export const householdGroupKey = (r: Pick<StoredRollup, "source" | "market">, groupBy: "source" | "market" | "channel"): string =>
  groupBy === "channel" ? channelOfSource(r.source) : String(r[groupBy] ?? "unknown");

/** One group of households. Counts of families, never rates. */
export type HouseholdLine = {
  key: string;
  /** Every family that started in the group, activated or not, paying or not. */
  households: number;
  /** Families per redeemed offer, in lib/offers.ts order, then `none`. */
  offers: { offer: string; households: number }[];
  activated: number;
  paying: number;
  lapsed: number;
};
export type HouseholdReport = {
  lines: HouseholdLine[];
  /** False when the offer or billing records were not read: those columns are then unknown, not zero. */
  offersRead: boolean;
  billingRead: boolean;
};

/**
 * The household line: one row per group (`source` or `market`, the rollup's
 * first-touch props), counting FAMILIES (one rollup per uid, so devices and
 * children collapse into the family that owns them) that STARTED on or after
 * `startedSince` (YYYY-MM-DD), so the event window holds their whole story.
 * The denominator is every start, including families that never activated
 * and never paid. Joined by uid, never by name; a uid never leaves here.
 */
export function summariseHouseholds(
  rollups: readonly StoredRollup[],
  events: readonly CohortEventDoc[],
  offers: readonly HouseholdOffer[] | null,
  billing: readonly HouseholdBilling[] | null,
  groupBy: "source" | "market" | "channel",
  startedSince: string | null = null,
): HouseholdReport {
  const activated = new Set(events.filter((e) => e.event === ACTIVATION_EVENT).map((e) => e.uid));
  const offerOf = new Map((offers ?? []).map((o) => [o.uid, o.offerId]));
  const billingOf = new Map((billing ?? []).map((b) => [b.uid, b]));
  const groups = new Map<string, HouseholdLine>();
  const seen = new Set<string>();
  for (const r of rollups) {
    if (!r.uid || seen.has(r.uid)) continue;
    if (startedSince && r.firstSeen < startedSince) continue;
    seen.add(r.uid);
    const key = householdGroupKey(r, groupBy);
    const line = groups.get(key) ?? {
      key,
      households: 0,
      offers: [...OFFER_IDS, "none"].map((offer) => ({ offer, households: 0 })),
      activated: 0,
      paying: 0,
      lapsed: 0,
    };
    line.households += 1;
    const offer = offerOf.get(r.uid);
    const slot = line.offers.find((o) => o.offer === (offer && (OFFER_IDS as string[]).includes(offer) ? offer : "none"));
    if (slot) slot.households += 1;
    if (activated.has(r.uid)) line.activated += 1;
    const b = billingOf.get(r.uid);
    if (b?.paying) line.paying += 1;
    if (b?.lapsed) line.lapsed += 1;
    groups.set(key, line);
  }
  return {
    lines: [...groups.values()].sort((a, b) => b.households - a.households || a.key.localeCompare(b.key)),
    offersRead: offers !== null,
    billingRead: billing !== null,
  };
}

/* ── BD-25: one household per family — co-parents fold into the owner ────── */

/** The default first day of the contract's households: CONTRACT_WINDOW_DAYS ago,
 *  so D7, W4 and D30 have matured cohorts (a 7-day report window has none). */
export const defaultContractSince = (now: Date = new Date()): string =>
  new Date(now.getTime() - CONTRACT_WINDOW_DAYS * DAY).toISOString();

/** An accepted co-parent share: the owner's account and the co-parent's. */
export type CoParentLink = { ownerUid: string; recipientUid: string };

/** Share documents → co-parent links (accepted co_parent grants only). Pure. */
export function coParentLinksOf(shares: ReadonlyArray<Record<string, unknown>>): CoParentLink[] {
  return shares.flatMap((s) =>
    s.role === "co_parent" && typeof s.ownerUid === "string" && typeof s.recipientUid === "string" && s.ownerUid && s.recipientUid && s.ownerUid !== s.recipientUid
      ? [{ ownerUid: s.ownerUid, recipientUid: s.recipientUid }]
      : []);
}

/**
 * A co-parent who accepted the family's share is the same household as the
 * owner: their rollup is dropped and their events, offer and billing are
 * re-keyed to the owner's uid (billing merged: paying if either pays). Only
 * when the owner has a rollup of its own; otherwise the co-parent stays a
 * household. Pure; `folded` is how many accounts were folded.
 */
export function foldCoParents(input: {
  rollups: readonly StoredRollup[];
  events: readonly CohortEventDoc[];
  offers: readonly HouseholdOffer[] | null;
  billing: readonly HouseholdBilling[] | null;
  coParents: readonly CoParentLink[] | null;
}): { rollups: StoredRollup[]; events: CohortEventDoc[]; offers: HouseholdOffer[] | null; billing: HouseholdBilling[] | null; folded: number | null } {
  const { rollups, events, offers, billing, coParents } = input;
  if (coParents === null) return { rollups: [...rollups], events: [...events], offers: offers ? [...offers] : null, billing: billing ? [...billing] : null, folded: null };
  const owners = new Set(rollups.map((r) => r.uid).filter((u): u is string => !!u));
  const ownerOf = new Map<string, string>();
  for (const l of coParents) if (owners.has(l.ownerUid) && !ownerOf.has(l.recipientUid) && l.recipientUid !== l.ownerUid) ownerOf.set(l.recipientUid, l.ownerUid);
  const canon = (uid: string) => ownerOf.get(uid) ?? uid;
  const keptRollups = rollups.filter((r) => !r.uid || !ownerOf.has(r.uid));
  const folded = rollups.length - keptRollups.length;
  const foldedOffers = offers === null ? null : (() => {
    const by = new Map<string, HouseholdOffer>();
    for (const o of offers) if (!ownerOf.has(o.uid)) by.set(o.uid, o);
    for (const o of offers) if (ownerOf.has(o.uid) && !by.has(canon(o.uid))) by.set(canon(o.uid), { uid: canon(o.uid), offerId: o.offerId });
    return [...by.values()];
  })();
  const foldedBilling = billing === null ? null : (() => {
    const by = new Map<string, HouseholdBilling>();
    for (const b of billing) {
      const uid = canon(b.uid);
      const prev = by.get(uid);
      if (!prev) { by.set(uid, { ...b, uid }); continue; }
      const paying = prev.paying || b.paying;
      by.set(uid, { uid, billed: prev.billed || b.billed, paying, lapsed: !paying && (prev.lapsed || b.lapsed) });
    }
    return [...by.values()];
  })();
  return { rollups: keptRollups, events: events.map((e) => (ownerOf.has(e.uid) ? { ...e, uid: canon(e.uid) } : e)), offers: foldedOffers, billing: foldedBilling, folded };
}

/* ── BD-25: the metric contract (lib/metricContract.ts), per household ────── */

/** A count with the denominator it was taken over. Never a rate. */
export type Fraction = { n: number; of: number };
export type ContractRow = {
  key: string;
  /** Households that started in the window (every start). */
  starts: number;
  d7: Fraction;
  w4: Fraction;
  /** Paid by day 30 after access (the client's paid event), confirmed by a
   *  store billing record. Null when the billing records were not read. */
  d30Paid: Fraction | null;
};
export type MetricContractReport = {
  version: string;
  asOfDay: string;
  definitions: Record<string, string>;
  overall: ContractRow;
  /** Per first-touch group (the report's groupBy): direct, sponsored and partner sources stay apart. */
  byGroup: ContractRow[];
  /** Per redeemed offer, then `none`: legacy offers stay apart from full price. */
  byOffer: ContractRow[];
  /** BD-37: per acquisition channel, in lib/acquisitionChannel.ts order, channels with no start left out. */
  byChannel: ContractRow[];
  gateA: {
    activatedMaturedW4: { n: number; required: number };
    /** Null when billing or offers were not read. */
    fullPricePayers: { n: number | null; required: number };
    /** Null when a half cannot be answered. */
    met: boolean | null;
  };
  /** Everything this readout cannot answer, in words. Always present. */
  missing: string[];
  /** The first day of the households the contract is about. */
  startedSince: string | null;
  /** Co-parent accounts folded into their family's household; null when the shares were not read. */
  coParentsFolded: number | null;
};

/**
 * The contract over the households that started on or after `startedSince`.
 * Pure; the only arithmetic is counting, by lib/retention.ts day indices.
 */
export function summariseMetricContract(input: {
  rollups: readonly StoredRollup[];
  events: readonly CohortEventDoc[];
  offers: readonly HouseholdOffer[] | null;
  billing: readonly HouseholdBilling[] | null;
  groupBy: "source" | "market";
  asOfDay: string;
  startedSince?: string | null;
  eventsTruncated?: boolean;
  /** Null (or absent) when the co-parent shares were not read. */
  coParents?: readonly CoParentLink[] | null;
}): MetricContractReport {
  const folded = foldCoParents({ rollups: input.rollups, events: input.events, offers: input.offers, billing: input.billing, coParents: input.coParents ?? null });
  const { rollups, events, offers, billing } = folded;
  const { groupBy, asOfDay } = input;
  const activated = new Set(events.filter((e) => e.event === ACTIVATION_EVENT).map((e) => e.uid));
  const paidDays = new Map<string, string[]>();
  for (const e of events) {
    if (e.event !== PAID_EVENT || !e.at) continue;
    const d = dayKeyOf(e.at);
    if (d) paidDays.set(e.uid, [...(paidDays.get(e.uid) ?? []), d]);
  }
  const valueDays = new Map<string, string[]>();
  for (const e of events) {
    if (!(VALUE_EVENTS as readonly string[]).includes(e.event) || !e.at) continue;
    const d = dayKeyOf(e.at);
    if (d) valueDays.set(e.uid, [...(valueDays.get(e.uid) ?? []), d]);
  }
  const offerOf = new Map((offers ?? []).map((o) => [o.uid, (OFFER_IDS as string[]).includes(o.offerId) ? o.offerId : "none"]));
  const billingOf = new Map((billing ?? []).map((b) => [b.uid, b]));

  type H = { uid: string; group: string; channel: string; offer: string; age: number; firstSeen: string };
  const households: H[] = [];
  const seen = new Set<string>();
  for (const r of rollups) {
    if (!r.uid || seen.has(r.uid)) continue;
    if (input.startedSince && r.firstSeen < input.startedSince) continue;
    const age = dayIndex(r.firstSeen, asOfDay);
    if (age === null) continue;
    seen.add(r.uid);
    households.push({ uid: r.uid, group: householdGroupKey(r, groupBy), channel: channelOfSource(r.source), offer: offerOf.get(r.uid) ?? "none", age, firstSeen: r.firstSeen });
  }

  const paidByDay30 = (h: H) => (paidDays.get(h.uid) ?? []).some((d) => {
    const i = dayIndex(h.firstSeen, d);
    return i !== null && i >= 0 && i <= MATURITY_DAYS.d30;
  });
  let unconfirmedPaid = 0;
  for (const h of households) if (h.age >= MATURITY_DAYS.d30 && paidByDay30(h) && billing !== null && !billingOf.get(h.uid)?.billed) unconfirmedPaid += 1;
  const row = (key: string, hs: readonly H[]): ContractRow => {
    const d7 = { n: 0, of: 0 };
    const w4 = { n: 0, of: 0 };
    const d30 = { n: 0, of: 0 };
    for (const h of hs) {
      if (h.age >= MATURITY_DAYS.d7) {
        d7.of += 1;
        if (activated.has(h.uid)) d7.n += 1;
      }
      if (h.age >= MATURITY_DAYS.w4) {
        w4.of += 1;
        const inWeek4 = (valueDays.get(h.uid) ?? []).some((d) => {
          const i = dayIndex(h.firstSeen, d);
          return i !== null && i >= W4_DAYS.from && i <= W4_DAYS.to;
        });
        if (inWeek4) w4.n += 1;
      }
      if (h.age >= MATURITY_DAYS.d30) {
        d30.of += 1;
        if (paidByDay30(h) && billingOf.get(h.uid)?.billed) d30.n += 1;
      }
    }
    return { key, starts: hs.length, d7, w4, d30Paid: billing === null ? null : d30 };
  };
  const split = (by: (h: H) => string, order?: readonly string[]): ContractRow[] => {
    const groups = new Map<string, H[]>();
    for (const k of order ?? []) groups.set(k, []);
    for (const h of households) groups.set(by(h), [...(groups.get(by(h)) ?? []), h]);
    const rows = [...groups.entries()].map(([k, hs]) => row(k, hs));
    return order ? rows : rows.sort((a, b) => b.starts - a.starts || a.key.localeCompare(b.key));
  };

  const activatedMaturedW4 = households.filter((h) => h.age >= MATURITY_DAYS.w4 && activated.has(h.uid)).length;
  const fullPricePayers = billing === null || offers === null
    ? null
    : households.filter((h) => h.offer === "none" && billingOf.get(h.uid)?.paying).length;
  const missing: string[] = [...STANDING_MISSING_DATA];
  if (offers === null) missing.push("offers: the redemption records were not read; the offer split and full-price payers are unknown");
  if (billing === null) missing.push("billing: the entitlement records were not read; D30 paid and full-price payers are unknown");
  if (input.eventsTruncated) missing.push("events: the scan hit its ceiling; activation, W4 and D30 counts may be low");
  if (unconfirmedPaid > 0) missing.push(`D30 paid: ${unconfirmedPaid} household(s) show a paid event with no store billing record; not counted until billing confirms`);
  if (folded.folded === null) missing.push("household: the co-parent shares were not read; a co-parent's own account counts as a second household");

  return {
    version: METRIC_CONTRACT_VERSION,
    asOfDay,
    definitions: { ...MEASURE_DEFINITIONS },
    overall: row("all", households),
    byGroup: split((h) => h.group),
    byOffer: split((h) => h.offer, [...OFFER_IDS, "none"]),
    byChannel: split((h) => h.channel, ACQUISITION_CHANNELS).filter((r) => r.starts > 0),
    gateA: {
      activatedMaturedW4: { n: activatedMaturedW4, required: GATE_A.activatedMaturedW4 },
      fullPricePayers: { n: fullPricePayers, required: GATE_A.fullPricePayers },
      met: fullPricePayers === null ? null : activatedMaturedW4 >= GATE_A.activatedMaturedW4 && fullPricePayers >= GATE_A.fullPricePayers,
    },
    missing,
    startedSince: input.startedSince ?? null,
    coParentsFolded: folded.folded,
  };
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
  /** B-GAME-18 / B-BOOK-51: weekly Kid Mode play; small cells hidden. */
  kidPlay: KidPlaySummary;
  /** B-GROWTH-43: source → offer → activation → paying, per household; BD-37: grouped by acquisition channel. */
  households: HouseholdReport;
  /** BD-25: the metric contract (D7, W4, D30 paying, Gate A, missing data). */
  contract: MetricContractReport;
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
    /** BD-25: the first day of the households the metric contract is about.
     *  When it is earlier than `since`, events are read from it, and every
     *  other section still counts only events since `since`. Absent: `since`. */
    contractSince?: string;
  },
): Promise<CohortReport> {
  const now = opts.now ?? new Date();
  const groupBy = opts.groupBy === "market" ? "market" : "source";
  const asOfDay = dayKeyOf(now) ?? new Date(now).toISOString().slice(0, 10);
  const sinceMs = Date.parse(opts.since);
  const contractSince = opts.contractSince && Number.isFinite(Date.parse(opts.contractSince)) ? opts.contractSince : opts.since;
  const widened = Number.isFinite(sinceMs) && Date.parse(contractSince) < sinceMs;

  const [allRollups, scannedEvents, offerDocs, billingDocs, coParentLinks] = await Promise.all([
    store.listRetentionRollups(),
    store.listEvents(widened ? contractSince : opts.since),
    store.listOfferRedemptions ? store.listOfferRedemptions() : Promise.resolve(null),
    store.listBillingStates ? store.listBillingStates(undefined, now.getTime()) : Promise.resolve(null),
    store.listCoParentLinks ? store.listCoParentLinks() : Promise.resolve(null),
  ]);
  // The contract reads the wider scan; every other section keeps its own window.
  const allEvents = widened ? scannedEvents.filter((e) => !e.at || Date.parse(e.at) >= sinceMs) : scannedEvents;
  const includeInternal = opts.includeInternal === true;
  const { rollups, events, excluded, demoExcluded } = excludeInternal(allRollups, allEvents, includeInternal);
  const contractEvents = widened ? excludeInternal(allRollups, scannedEvents, includeInternal).events : events;
  const householdInputs = foldCoParents({ rollups, events, offers: offerDocs, billing: billingDocs, coParents: coParentLinks });

  const census = new Map<string, number>();
  for (const e of events) census.set(e.event, (census.get(e.event) ?? 0) + 1);

  const funnels: Record<string, FunnelGroupRow[]> = {};
  for (const name of opts.funnels ?? []) {
    const chain = FUNNEL_CHAINS[name];
    if (!chain) continue;
    const counted = ONE_ROW_CHAINS.includes(name) ? events.map((e) => ({ ...e, props: { ...e.props, [groupBy]: ONE_ROW_KEY } })) : events;
    funnels[name] = countFunnelChain(counted, chain, groupBy);
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
    kidPlay: summariseKidPlay(events),
    households: summariseHouseholds(householdInputs.rollups, householdInputs.events, householdInputs.offers, householdInputs.billing, "channel", dayKeyOf(new Date(opts.since)) ?? null),
    contract: summariseMetricContract({
      rollups,
      events: contractEvents,
      offers: offerDocs,
      billing: billingDocs,
      coParents: coParentLinks,
      groupBy,
      asOfDay,
      startedSince: dayKeyOf(new Date(contractSince)) ?? null,
      eventsTruncated: scannedEvents.length >= MAX_EVENTS_SCANNED,
    }),
    eventCensus: [...census.entries()]
      .map(([stage, count]) => ({ stage, count }))
      .sort((a, b) => b.count - a.count || a.stage.localeCompare(b.stage)),
    scanned: { rollups: rollups.length, events: events.length, mode: store.mode },
    internal: { excluded, included: includeInternal },
    demo: { excluded: demoExcluded },
    generatedAt: now.toISOString(),
  };
}

/**
 * B-GAME-18 / B-BOOK-51: the founder panel's ONE read — the weekly Kid Mode
 * play summary alone (no retention, funnels or census), over the same bounded
 * scan and the same internal/demo exclusion as the cohort report.
 */
export async function buildKidPlayReport(
  store: CohortMetricsStore,
  opts: { since: string; now?: Date; includeInternal?: boolean },
): Promise<{ since: string; kidPlay: KidPlaySummary; scanned: { events: number; mode: "firestore" | "null" }; generatedAt: string }> {
  const [allRollups, allEvents] = await Promise.all([store.listRetentionRollups(), store.listEvents(opts.since)]);
  const kidEvents = allEvents.filter((e) => (KID_PLAY_EVENTS as readonly string[]).includes(e.event));
  const { events } = excludeInternal(allRollups, kidEvents, opts.includeInternal === true);
  return { since: opts.since, kidPlay: summariseKidPlay(events), scanned: { events: events.length, mode: store.mode }, generatedAt: (opts.now ?? new Date()).toISOString() };
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
