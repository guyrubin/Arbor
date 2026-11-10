/**
 * B-AIOPS-01: the per-family daily cost report.
 *
 * The household count is foldCoParents (server/cohortMetrics.ts) — the same
 * fold the cohort report uses — so a co-parent is one family, and internal
 * and demo cohorts stay out of both the numerator and the denominator.
 * A route with calls and no price is a gap, named, never a silent 0.
 * Provider-bill reconciliation is not this report: billMatch stays "partial"
 * until Guy can export the bill (B-AIOPS-01).
 */
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import { coParentLinksOf, foldCoParents, type CohortMetricsStore, type CoParentLink, type StoredRollup } from "./cohortMetrics.js";
import { FAMILY_COST_COLLECTION } from "./familyCostWriter.js";
import { usageDateKey } from "./usageRollup.js";
import { logger } from "./logger.js";

export type FamilyRouteTotals = {
  calls: number;
  retries: number;
  fallbacks: number;
  chargedFailures: number;
  promptTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  audioSeconds: number;
  imageCount: number;
  characters: number;
  observedMs: number;
  estimatedCostUsd: number;
  pricedCalls: number;
  unpricedCalls: number;
};

export type FamilyCostDay = {
  date?: string;
  familyId: string | null;
  memberUids: string[];
  routes: Record<string, Partial<FamilyRouteTotals>>;
};

export type PriceGap = { route: string; calls: number; reason: string };

export type FamilyCostRow = {
  familyId: string;
  cohort: "family" | "internal" | "demo";
  estimatedCostUsd: number | null;
  pricedCalls: number;
  unpricedCalls: number;
  routes: string[];
};

export type FamilyDailyCostReport = {
  date: string;
  /** Provider-bill match is Guy's export. This report does not claim it. */
  billMatch: "partial";
  /** Households active that day, after the cohort fold. Internal and demo out. */
  activeHouseholds: number;
  /** Co-parent accounts folded into the owner. Null when the shares were not read. */
  householdsFolded: number | null;
  estimatedCostUsd: number | null;
  perActiveFamilyUsd: number | null;
  pricedCalls: number;
  calls: number;
  /** Spend with no family id. Not in the per-family average. */
  unattributedUsd: number | null;
  /** Spend of internal and demo families. Not in the per-family average. */
  excludedCostUsd: number | null;
  gaps: PriceGap[];
  rows: FamilyCostRow[];
};

const GAP_REASON: Record<string, string> = {
  realtime_audio: "no billed audio price",
  book_narration: "no price",
};

export function priceGapReason(route: string): string {
  return GAP_REASON[route] ?? "no price";
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
const round6 = (v: number) => Math.round(v * 1_000_000) / 1_000_000;
const round4 = (v: number) => Math.round(v * 10_000) / 10_000;

/**
 * Households active on `date`, counted the way the cohort report counts
 * families: co-parents fold into the owner, internal and demo are out.
 */
export function activeHouseholdsOn(
  rollups: readonly StoredRollup[],
  coParents: readonly CoParentLink[] | null,
  date: string,
  dates: readonly string[] = [date],
): { households: number; folded: number | null } {
  const folded = foldCoParents({ rollups: costHouseholdRollups(rollups, coParents), events: [], offers: null, billing: null, coParents });
  const households = folded.rollups.filter((r) =>
    r.cohort !== "internal" && r.cohort !== "demo"
    && Array.isArray(r.activeDays) && r.activeDays.some((day) => dates.includes(day)),
  ).length;
  return { households, folded: folded.folded };
}

/** Keep either parent's activity and the household's exclusion tag before
 * the shared cohort fold drops the recipient row. No source records change. */
function costHouseholdRollups(rollups: readonly StoredRollup[], links: readonly CoParentLink[] | null): StoredRollup[] {
  const byUid = new Map(rollups.filter((r) => r.uid).map((r) => [r.uid!, r]));
  const ownerOf = new Map<string, string>();
  for (const link of links ?? []) {
    if (byUid.has(link.ownerUid) && link.ownerUid !== link.recipientUid && !ownerOf.has(link.recipientUid)) ownerOf.set(link.recipientUid, link.ownerUid);
  }
  const groups = new Map<string, StoredRollup[]>();
  for (const row of rollups) {
    if (!row.uid) continue;
    const owner = ownerOf.get(row.uid) ?? row.uid;
    groups.set(owner, [...(groups.get(owner) ?? []), row]);
  }
  return rollups.map((row) => {
    const group = row.uid ? groups.get(ownerOf.get(row.uid) ?? row.uid) ?? [row] : [row];
    return { ...row,
      activeDays: [...new Set(group.flatMap((r) => r.activeDays ?? []))],
      cohort: group.some((r) => r.cohort === "internal") ? "internal" : group.some((r) => r.cohort === "demo") ? "demo" : "family",
    };
  });
}

function cohortOf(day: FamilyCostDay, byUid: Map<string, StoredRollup["cohort"]>): FamilyCostRow["cohort"] | "unattributed" {
  if (!day.familyId) return "unattributed";
  const tags = day.memberUids.map((uid) => byUid.get(uid));
  if (tags.includes("internal")) return "internal";
  if (tags.includes("demo")) return "demo";
  return tags.includes("family") ? "family" : "unattributed";
}

function dayUsd(day: FamilyCostDay): { usd: number; priced: number; calls: number; unpriced: number } {
  let usd = 0;
  let priced = 0;
  let calls = 0;
  let unpriced = 0;
  for (const route of Object.values(day.routes)) {
    usd += num(route.estimatedCostUsd);
    priced += num(route.pricedCalls);
    calls += num(route.calls);
    unpriced += num(route.unpricedCalls);
  }
  return { usd, priced, calls, unpriced };
}

/** Pure. `coParents: null` means the shares were not read (the cohort report's own signal). */
export function familyDailyCostReport(input: {
  date: string;
  costs: readonly FamilyCostDay[];
  rollups: readonly StoredRollup[];
  coParents: readonly CoParentLink[] | null;
  /** Window consumers count each active household once across these dates. */
  activeDates?: readonly string[];
}): FamilyDailyCostReport {
  const dates = input.activeDates ?? [input.date];
  const rollups = costHouseholdRollups(input.rollups, input.coParents);
  const { households, folded } = activeHouseholdsOn(rollups, input.coParents, input.date, dates);
  const byUid = new Map(rollups.filter((r) => r.uid).map((r) => [r.uid as string,
    r.cohort === "internal" || r.cohort === "demo" ? r.cohort : r.activeDays.some((day) => dates.includes(day)) ? "family" as const : undefined,
  ]));
  const gaps = new Map<string, number>();
  const rows: FamilyCostRow[] = [];
  let includedUsd = 0;
  let includedPriced = 0;
  let includedCalls = 0;
  let unattributed = 0;
  let unattributedPriced = 0;
  let excluded = 0;
  let excludedPriced = 0;
  for (const day of input.costs) {
    for (const [route, totals] of Object.entries(day.routes)) {
      const unpriced = num(totals.unpricedCalls);
      if (unpriced > 0) gaps.set(route, (gaps.get(route) ?? 0) + unpriced);
    }
    const spent = dayUsd(day);
    const cohort = cohortOf(day, byUid);
    if (cohort === "unattributed") {
      unattributed += spent.usd;
      unattributedPriced += spent.priced;
      continue;
    }
    rows.push({
      familyId: day.familyId as string,
      cohort,
      estimatedCostUsd: spent.priced > 0 ? round6(spent.usd) : null,
      pricedCalls: spent.priced,
      unpricedCalls: spent.unpriced,
      routes: Object.keys(day.routes).sort(),
    });
    if (cohort === "family") {
      includedUsd += spent.usd;
      includedPriced += spent.priced;
      includedCalls += spent.calls;
    } else {
      excluded += spent.usd;
      excludedPriced += spent.priced;
    }
  }
  rows.sort((a, b) => a.familyId.localeCompare(b.familyId));
  const estimatedCostUsd = includedPriced > 0 ? round6(includedUsd) : null;
  return {
    date: input.date,
    billMatch: "partial",
    activeHouseholds: households,
    householdsFolded: folded,
    estimatedCostUsd,
    perActiveFamilyUsd: input.coParents !== null && estimatedCostUsd !== null && households > 0 ? round4(includedUsd / households) : null,
    pricedCalls: includedPriced,
    calls: includedCalls,
    unattributedUsd: unattributedPriced > 0 ? round6(unattributed) : null,
    excludedCostUsd: excludedPriced > 0 ? round6(excluded) : null,
    gaps: [...gaps.entries()].map(([route, calls]) => ({ route, calls, reason: priceGapReason(route) })).sort((a, b) => a.route.localeCompare(b.route)),
    rows,
  };
}

function routeTotals(raw: unknown): Record<string, Partial<FamilyRouteTotals>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, Partial<FamilyRouteTotals>> = {};
  for (const [route, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[a-z][a-z0-9_]{0,40}$/.test(route) || !value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    out[route] = {
      calls: num(v.calls), retries: num(v.retries), fallbacks: num(v.fallbacks), chargedFailures: num(v.chargedFailures),
      promptTokens: num(v.promptTokens), outputTokens: num(v.outputTokens), cacheReadTokens: num(v.cacheReadTokens),
      audioSeconds: num(v.audioSeconds), imageCount: num(v.imageCount), characters: num(v.characters), observedMs: num(v.observedMs),
      estimatedCostUsd: num(v.estimatedCostUsd), pricedCalls: num(v.pricedCalls), unpricedCalls: num(v.unpricedCalls),
    };
  }
  return out;
}

function costDay(data: Record<string, unknown>): FamilyCostDay {
  return {
    date: typeof data.date === "string" ? data.date : undefined,
    familyId: typeof data.familyId === "string" && data.familyId ? data.familyId : null,
    memberUids: Array.isArray(data.memberUids) ? data.memberUids.filter((u): u is string => typeof u === "string") : [],
    routes: routeTotals(data.routes),
  };
}

/** Bounded admin read. Failure or a full scan cannot masquerade as a complete
 * denominator. Read inactive owners too, since only a co-parent may be active. */
export async function readFamilyCostWindow(db: Firestore, dates: readonly string[]) {
  const limit = 5000;
  const keys = [...dates].sort();
  try {
    const [costs, rollups, shares] = await Promise.all([
      db.collection(FAMILY_COST_COLLECTION).where("date", ">=", keys[0]).where("date", "<=", keys[keys.length - 1]).limit(limit + 1).get(),
      db.collection("retentionRollups").limit(limit + 1).get(),
      db.collection("shares").where("role", "==", "co_parent").limit(limit + 1).get(),
    ]);
    if ([costs, rollups, shares].some((snap) => snap.docs.length > limit)) return { status: "truncated" as const };
    return {
      status: "complete" as const,
      familyCosts: costs.docs.map((d) => costDay(d.data())),
      rollups: rollups.docs.map((d): StoredRollup => {
        const data = d.data();
        return { uid: d.id, firstSeen: typeof data.firstSeen === "string" ? data.firstSeen : keys[0],
          activeDays: Array.isArray(data.activeDays) ? data.activeDays.filter((day): day is string => typeof day === "string") : [],
          cohort: data.cohort === "internal" ? "internal" : data.cohort === "demo" ? "demo" : "family", source: null, market: null };
      }),
      coParents: coParentLinksOf(shares.docs.map((d) => d.data())),
    };
  } catch (error) {
    logger.error("Admin family cost window read failed", error);
    return { status: "unavailable" as const };
  }
}

/** Admin read. Local/sandbox (no Firestore) returns an empty day; the count is still the cohort fold. */
export async function loadFamilyDailyCostReport(
  config: ArborConfig,
  cohort: CohortMetricsStore,
  date = usageDateKey(),
): Promise<FamilyDailyCostReport> {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : usageDateKey();
  const [rollups, coParents, costs] = await Promise.all([
    cohort.listRetentionRollups().catch((error) => { logger.error("Family cost rollup read failed", error); return [] as StoredRollup[]; }),
    cohort.listCoParentLinks ? cohort.listCoParentLinks().catch((error) => { logger.error("Family cost co-parent read failed", error); return null; }) : Promise.resolve(null),
    readFamilyCosts(config, safeDate),
  ]);
  return familyDailyCostReport({ date: safeDate, costs, rollups, coParents });
}

async function readFamilyCosts(config: ArborConfig, date: string): Promise<FamilyCostDay[]> {
  if (config.memoryAdapter !== "firestore") return [];
  try {
    if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    const snap = await getFirestore(config.firestoreDatabaseId).collection(FAMILY_COST_COLLECTION).where("date", "==", date).get();
    return snap.docs.map((doc) => costDay(doc.data()));
  } catch (error) {
    logger.error("Family cost day read failed", error, { date });
    return [];
  }
}
