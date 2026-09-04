/* familyRitualsCadence — ENG-25. The Family Rituals cadence, made real.
 *
 * THE DEFECT: every FamilyRitual carried a cadence as PROSE ("Weekly, same
 * evening each week, 10 to 15 minutes around the table") rendered as a grey
 * chip in Arbor Academy, and nothing in the product ever acted on it. A ritual
 * a parent read once and meant to run weekly simply never came back.
 *
 * THE FIX, deliberately in-app: `cadenceDays` on each ritual is now a real
 * number, this module keeps a device-local record of when each ritual was last
 * practised, and the ritual whose turn has come is surfaced the NEXT TIME THE
 * PARENT OPENS ARBOR. No notification is sent — Arbor has no delivery path
 * (see lib/pushPriming) and a family ritual is not an alarm.
 *
 * DEVICE-LOCAL BY DESIGN: the record is a family fact, not a child fact — it
 * holds ritual ids and timestamps only, never a name, never an observation, so
 * it is not child data and stays out of the child collections entirely.
 *
 * PURE CORE: every decision function takes `nowMs` and the record as arguments,
 * so the whole cadence is unit-testable with no clock and no storage.
 */
import { FAMILY_RITUALS, type FamilyRitual } from "./familyRituals";

export const DAY_MS = 86_400_000;

/** ritual id → epoch ms it was last practised. */
export type RitualRecord = Readonly<Record<string, number>>;

const STORE = "arbor.familyRituals.practised";

/* ── Storage (thin, always best-effort) ─────────────────────────────────── */

export function readRitualRecord(): RitualRecord {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [id, at] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof at === "number" && Number.isFinite(at)) out[id] = at;
    }
    return out;
  } catch {
    return {};
  }
}

/** Records a run and returns the record as it now stands (also when unwritable). */
export function markRitualPractised(id: string, nowMs: number): RitualRecord {
  const next = { ...readRitualRecord(), [id]: nowMs };
  try {
    localStorage.setItem(STORE, JSON.stringify(next));
  } catch {
    /* private mode / quota — the cadence degrades to "always due", never crashes */
  }
  return next;
}

/** Wipes the record. Used by the device-local sweep and by tests. */
export function clearRitualRecord(): void {
  try {
    localStorage.removeItem(STORE);
  } catch {
    /* nothing to do */
  }
}

/* ── The cadence itself (pure) ──────────────────────────────────────────── */

export interface RitualTurn {
  ritual: FamilyRitual;
  /** Never practised on this device. */
  firstTime: boolean;
  /** Whole days past its turn. 0 for a first-timer and for one due exactly now. */
  daysOverdue: number;
}

/** Whole days since a ritual was last practised, or null if it never was. */
export function daysSincePractised(id: string, nowMs: number, record: RitualRecord): number | null {
  const at = record[id];
  if (typeof at !== "number") return null;
  return Math.floor((nowMs - at) / DAY_MS);
}

/** Is this ritual's turn up? Never-practised counts as due. */
export function ritualIsDue(ritual: FamilyRitual, nowMs: number, record: RitualRecord): boolean {
  const since = daysSincePractised(ritual.id, nowMs, record);
  return since === null || since >= ritual.cadenceDays;
}

/** Every ritual whose turn is up, most overdue first (catalogue order breaks ties). */
export function dueRituals(nowMs: number, record: RitualRecord): RitualTurn[] {
  return FAMILY_RITUALS.filter((r) => ritualIsDue(r, nowMs, record))
    .map((ritual) => {
      const since = daysSincePractised(ritual.id, nowMs, record);
      return {
        ritual,
        firstTime: since === null,
        daysOverdue: since === null ? 0 : Math.max(0, since - ritual.cadenceDays),
      };
    })
    .sort((a, b) => {
      if (a.daysOverdue !== b.daysOverdue) return b.daysOverdue - a.daysOverdue;
      const order = (t: RitualTurn) => FAMILY_RITUALS.findIndex((r) => r.id === t.ritual.id);
      return order(a) - order(b);
    });
}

/**
 * ONE ritual to surface on this open, or null when nothing is waiting. One is
 * the whole point: a list of four overdue practices is a chore chart, and a
 * chore chart is the thing parents close the app to get away from.
 */
export function ritualOfTheMoment(nowMs: number, record: RitualRecord): RitualTurn | null {
  return dueRituals(nowMs, record)[0] ?? null;
}

/** Whole days until this ritual comes back around; null if its turn is up now. */
export function daysUntilNextTurn(ritual: FamilyRitual, nowMs: number, record: RitualRecord): number | null {
  const since = daysSincePractised(ritual.id, nowMs, record);
  if (since === null) return null;
  const left = ritual.cadenceDays - since;
  return left > 0 ? left : null;
}

/** The human sentence for a cadence, as an i18n key + vars (never raw copy). */
export function cadenceLabel(ritual: FamilyRitual): { key: string; vars?: Record<string, number> } {
  if (ritual.cadenceDays === 7) return { key: "elev.rh.ritual.every.week" };
  if (ritual.cadenceDays >= 28 && ritual.cadenceDays <= 31) return { key: "elev.rh.ritual.every.month" };
  return { key: "elev.rh.ritual.every.days", vars: { n: ritual.cadenceDays } };
}
