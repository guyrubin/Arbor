/**
 * B-PROG-12 — PILOT INSTRUMENTATION for the program kill criteria (thesis
 * §10): five cohort rows on the ADMIN cohort reader only (`GET
 * /api/admin/cohorts` → `programPilot`), counts and shares, NEVER per child,
 * NEVER on a parent surface.
 *
 *   programDose4plus — per program week n: of the families whose week n has
 *                      ended, how many logged ≥ 4 practice days in it
 *                      (thesis: 60 % by week 4). `byWeek` + the week-4 row.
 *   parentProxyMoved — of the families past week 6 (or the program's last
 *                      week, if shorter), how many show a parent-proxy count
 *                      in that week ABOVE their own week 1 (thesis: 50 %).
 *   kidProxyMoved    — = the pack's `childProxyMoved` (renamed: the cohort
 *                      reader's privacy guard, FORBIDDEN_RESPONSE_KEY
 *                      /child|name|note|text|transcript/i in
 *                      server/cohortMetrics.ts AND scripts/cohort-report.mjs,
 *                      refuses any response key containing "child"; the
 *                      guard stays). Of the families past week 8 (or the last
 *                      week), how many show the child proxy above their own
 *                      baseline (thesis: a majority).
 *   bridgePacketSent — of the enrolled families, how many granted a
 *                      PROFESSIONAL share (server `shares`, role
 *                      "professional") for the enrolled child on or after the
 *                      enrolment day (thesis: the bridge, 3 of 5). A packet
 *                      printed or e-mailed outside the app is not seen here.
 *   d30Active        — of the enrolled families old enough to answer, how
 *                      many were active on day 30 (lib/retention's classic
 *                      D-N over the family's retention rollup; thesis > 57 %).
 *
 * The family is the unit: one row per family (its FIRST enrolment by start
 * day), so a family with two enrolled children is counted once. Internal and
 * demo families (the rollup's `cohort` tag, B-MEAS-01 / B-DIST-01) are
 * excluded — demo always, internal unless the caller keeps it.
 *
 * PRIVACY — the ONE cohort reader that touches child sub-collections, and only
 * these four, projected at the egress of the store: `programs` (programId,
 * startedAt, status, currentWeek, baseline.childProxy), `actionLoops` practice
 * rows (id, source, status, outcome, selfCount — never the recommendation
 * text), `sleepLogs` (date, routine, the clock times, the computed stretch) and
 * `langObs` (the TIMESTAMP only — never the phrase). `shares` gives ownerUid,
 * childId, role and createdAt only. No uid, child id or name leaves this
 * module: the summary is counts and shares (guard: programPilot.test.ts).
 * The measure arithmetic is lib/programs/measures.ts's — one definition for
 * the program page and this reader.
 */
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import { logger } from "./logger.js";
import type { ActionLoopEntry } from "../actionLoop/model.js";
import type { SleepLogEntry } from "../types.js";
import { programById } from "../content/programs/index.js";
import { daysBetween, validEnrolments, type ProgramEnrolment } from "../lib/programs/enrolment.js";
import { programWeekMeasures, type ProgramMeasureInputs } from "../lib/programs/measures.js";
import { eligibleForDay, returnedOnDay, type RetentionRollup } from "../lib/retention.js";

/** One enrolled child's projected ledgers (what the store returns). */
export type PilotEnrolmentRecord = {
  /** The parent account — used to group by family and to drop internal / demo; never returned. */
  uid: string;
  enrolment: ProgramEnrolment;
  practiceRows: Pick<ActionLoopEntry, "id" | "source" | "status" | "outcome" | "selfCount">[];
  sleepLogs: SleepLogEntry[];
  /** langObs timestamps only (the "new words" entries; never the phrase). */
  wordEntryAts: string[];
  /** createdAt of every PROFESSIONAL share grant for this child. */
  professionalSharesAt: string[];
  /** The child id inside the uid — used only to key the practice rows (`practice.<childId>.<day>`); never returned. */
  childKey: string;
};

export type PilotRollup = RetentionRollup & { uid?: string; cohort?: "internal" | "family" | "demo" };

export type PilotCount = { count: number; eligible: number; share: number | null };
export type PilotWeekRow = PilotCount & { week: number };

export type ProgramPilotSummary = {
  /** Families in the summary (after exclusions), and per program. */
  families: number;
  byProgram: Record<string, number>;
  programDose4plus: { byWeek: PilotWeekRow[]; week4: PilotCount };
  parentProxyMoved: PilotCount;
  /** = the pack's childProxyMoved (see the module header for the rename). */
  kidProxyMoved: PilotCount;
  bridgePacketSent: PilotCount;
  d30Active: PilotCount;
  excluded: { internal: number; demo: number };
  scanned: { enrolments: number; mode: "firestore" | "null" };
};

const count = (n: number, of: number): PilotCount => ({ count: n, eligible: of, share: of > 0 ? Math.round((n / of) * 1000) / 1000 : null });

/** Has program week n ENDED by `asOfDay` (local day key)? */
const weekEnded = (e: ProgramEnrolment, n: number, asOfDay: string): boolean => daysBetween(e.startedAt, asOfDay) >= 7 * n;

const inputsOf = (r: PilotEnrolmentRecord): ProgramMeasureInputs => ({
  childId: r.childKey,
  actionLoops: r.practiceRows as ActionLoopEntry[],
  sleepLogs: r.sleepLogs,
  observations: r.wordEntryAts.map((at) => ({ at, shelf: "words" as const, value: { type: "word" as const, language: "", phrase: "" } })),
});

/** The five rows, pure. `asOfDay` is the reader's day key (YYYY-MM-DD). */
export function summariseProgramPilot(
  records: readonly PilotEnrolmentRecord[],
  rollups: readonly PilotRollup[],
  opts: { asOfDay: string; includeInternal?: boolean; mode?: "firestore" | "null" },
): ProgramPilotSummary {
  const cohortOf = new Map<string, PilotRollup>();
  for (const r of rollups) if (r.uid) cohortOf.set(r.uid, r);

  // One row per family: its first enrolment (by start day) with a known program.
  const firstByUid = new Map<string, PilotEnrolmentRecord>();
  const excludedUids = { internal: new Set<string>(), demo: new Set<string>() };
  for (const rec of records) {
    if (!validEnrolments([rec.enrolment]).length) continue;
    const tag = cohortOf.get(rec.uid)?.cohort;
    if (tag === "demo") { excludedUids.demo.add(rec.uid); continue; }
    if (tag === "internal" && !opts.includeInternal) { excludedUids.internal.add(rec.uid); continue; }
    const prev = firstByUid.get(rec.uid);
    if (!prev || rec.enrolment.startedAt < prev.enrolment.startedAt) firstByUid.set(rec.uid, rec);
  }
  const fams = [...firstByUid.values()];

  const byProgram: Record<string, number> = {};
  for (const f of fams) byProgram[f.enrolment.programId] = (byProgram[f.enrolment.programId] ?? 0) + 1;

  // programDose4plus — by program week.
  const maxWeeks = Math.max(0, ...fams.map((f) => programById(f.enrolment.programId)?.weeks.length ?? 0));
  const byWeek: PilotWeekRow[] = [];
  for (let n = 1; n <= maxWeeks; n += 1) {
    let eligible = 0;
    let hit = 0;
    for (const f of fams) {
      const program = programById(f.enrolment.programId)!;
      if (n > program.weeks.length || !weekEnded(f.enrolment, n, opts.asOfDay)) continue;
      eligible += 1;
      const m = programWeekMeasures(f.enrolment, n, inputsOf(f));
      if ((m?.dose ?? 0) >= 4) hit += 1;
    }
    if (eligible > 0) byWeek.push({ week: n, ...count(hit, eligible) });
  }
  const week4 = byWeek.find((w) => w.week === 4);

  // parentProxyMoved — week 6 (or the last week) vs the family's own week 1.
  let pEligible = 0;
  let pMoved = 0;
  // kidProxyMoved — week 8 (or the last week) vs the family's own baseline.
  let kEligible = 0;
  let kMoved = 0;
  for (const f of fams) {
    const program = programById(f.enrolment.programId)!;
    const pWeek = Math.min(6, program.weeks.length);
    if (weekEnded(f.enrolment, pWeek, opts.asOfDay)) {
      const first = programWeekMeasures(f.enrolment, 1, inputsOf(f))?.parentProxy;
      const later = programWeekMeasures(f.enrolment, pWeek, inputsOf(f))?.parentProxy;
      if (first && later) {
        pEligible += 1;
        if (later.value > first.value) pMoved += 1;
      }
    }
    const kWeek = Math.min(8, program.weeks.length);
    if (weekEnded(f.enrolment, kWeek, opts.asOfDay)) {
      const baseline = f.enrolment.baseline?.childProxy ?? programWeekMeasures(f.enrolment, 1, inputsOf(f))?.childProxy?.value ?? null;
      const later = programWeekMeasures(f.enrolment, kWeek, inputsOf(f))?.childProxy;
      if (typeof baseline === "number" && later) {
        kEligible += 1;
        if (later.value > baseline) kMoved += 1;
      }
    }
  }

  // bridgePacketSent — a professional share on or after the enrolment day.
  const bridged = fams.filter((f) => f.professionalSharesAt.some((at) => typeof at === "string" && at.slice(0, 10) >= f.enrolment.startedAt)).length;

  // d30Active — lib/retention's classic D30 over the family's rollup.
  let dEligible = 0;
  let dActive = 0;
  for (const f of fams) {
    const rollup = cohortOf.get(f.uid);
    if (!rollup || !eligibleForDay(rollup, 30, opts.asOfDay)) continue;
    dEligible += 1;
    if (returnedOnDay(rollup, 30)) dActive += 1;
  }

  return {
    families: fams.length,
    byProgram,
    programDose4plus: { byWeek, week4: week4 ? { count: week4.count, eligible: week4.eligible, share: week4.share } : count(0, 0) },
    parentProxyMoved: count(pMoved, pEligible),
    kidProxyMoved: count(kMoved, kEligible),
    bridgePacketSent: count(bridged, fams.length),
    d30Active: count(dActive, dEligible),
    excluded: { internal: excludedUids.internal.size, demo: excludedUids.demo.size },
    scanned: { enrolments: records.length, mode: opts.mode ?? "null" },
  };
}

/* ── the store ─────────────────────────────────────────────────────────── */

export const MAX_PILOT_ENROLMENTS = 500;

export interface ProgramPilotStore {
  listEnrolmentRecords(limit?: number): Promise<PilotEnrolmentRecord[]>;
  readonly mode: "firestore" | "null";
}

/** Local / sandbox: no ADC, no enrolments. */
export class NullProgramPilotStore implements ProgramPilotStore {
  readonly mode = "null" as const;
  async listEnrolmentRecords(): Promise<PilotEnrolmentRecord[]> { return []; }
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** Egress projection of one enrolment document (never the parent-typed notes). */
export const projectEnrolment = (raw: Record<string, unknown>, id: string): ProgramEnrolment => {
  const baseline = (raw.baseline && typeof raw.baseline === "object" ? raw.baseline : {}) as Record<string, unknown>;
  return {
    id,
    programId: str(raw.programId) ?? "",
    startedAt: str(raw.startedAt) ?? "",
    enrolledAt: str(raw.enrolledAt) ?? "",
    currentWeek: typeof raw.currentWeek === "number" ? raw.currentWeek : 1,
    status: raw.status === "paused" ? "paused" : raw.status === "done" ? "done" : raw.status === "active" ? "active" : ("invalid" as never),
    baseline: { childProxy: typeof baseline.childProxy === "number" ? baseline.childProxy : null, capturedAt: null },
    updatedAt: "",
  };
};

/** Egress projection of a practice row (no recommendation text). */
export const projectPracticeRow = (raw: Record<string, unknown>, id: string): PilotEnrolmentRecord["practiceRows"][number] => ({
  id,
  source: raw.source as ActionLoopEntry["source"],
  status: raw.status as ActionLoopEntry["status"],
  ...(raw.outcome === "helped" || raw.outcome === "somewhat" || raw.outcome === "not_today" ? { outcome: raw.outcome } : {}),
  ...(typeof raw.selfCount === "number" ? { selfCount: raw.selfCount } : {}),
});

/** Egress projection of a diary night (clock times and taps only). */
export const projectSleepLog = (raw: Record<string, unknown>, id: string): SleepLogEntry => ({
  date: str(raw.date) ?? id,
  ...(str(raw.bedtime) ? { bedtime: str(raw.bedtime)! } : {}),
  ...(Array.isArray(raw.wakings) ? { wakings: raw.wakings.filter((w): w is string => typeof w === "string") } : {}),
  ...(str(raw.wake) ? { wake: str(raw.wake)! } : {}),
  ...(typeof raw.longestStretchMinutes === "number" ? { longestStretchMinutes: raw.longestStretchMinutes } : {}),
  ...(raw.routine === "done_in_order" || raw.routine === "not_tonight" ? { routine: raw.routine } : {}),
  updatedAt: "",
});

export class FirestoreProgramPilotStore implements ProgramPilotStore {
  readonly mode = "firestore" as const;
  private readonly db: Firestore;

  constructor(config: ArborConfig) {
    if (!getApps().length) {
      initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    }
    this.db = getFirestore(config.firestoreDatabaseId);
  }

  async listEnrolmentRecords(limit = MAX_PILOT_ENROLMENTS): Promise<PilotEnrolmentRecord[]> {
    try {
      const snap = await this.db.collectionGroup("programs").limit(limit).get();
      const out: PilotEnrolmentRecord[] = [];
      for (const d of snap.docs) {
        // users/{uid}/<child path>/{childId}/programs/{id}
        const childRef = d.ref.parent.parent;
        const uid = childRef?.parent.parent?.id;
        if (!childRef || !uid) continue;
        const enrolment = projectEnrolment(d.data() as Record<string, unknown>, d.id);
        if (!programById(enrolment.programId)) continue;
        const [loops, nights, words, shares] = await Promise.all([
          childRef.collection("actionLoops").where("source", "==", "practice").get(),
          childRef.collection("sleepLogs").get(),
          childRef.collection("langObs").select("timestamp").get(),
          this.db.collection("shares").where("ownerUid", "==", uid).get(),
        ]);
        out.push({
          uid,
          childKey: childRef.id,
          enrolment,
          practiceRows: loops.docs.map((x) => projectPracticeRow(x.data() as Record<string, unknown>, x.id)),
          sleepLogs: nights.docs.map((x) => projectSleepLog(x.data() as Record<string, unknown>, x.id)),
          wordEntryAts: words.docs.map((x) => str((x.data() as Record<string, unknown>).timestamp)).filter((x): x is string => !!x),
          professionalSharesAt: shares.docs
            .map((x) => x.data() as Record<string, unknown>)
            .filter((s) => s.role === "professional" && s.childId === childRef.id)
            .map((s) => str(s.createdAt))
            .filter((x): x is string => !!x),
        });
      }
      return out;
    } catch (error) {
      logger.error("Program pilot scan failed", error);
      return [];
    }
  }
}

export const createProgramPilotStore = (config: ArborConfig): ProgramPilotStore =>
  config.memoryAdapter === "firestore" ? new FirestoreProgramPilotStore(config) : new NullProgramPilotStore();
