/* ════════════════════════════════════════════════════════════════════════════
   todayModules — the Rule A module budget for Today (masterplan
   ARBOR-UI-MASTERPLAN-2026-08-11 §1: Today renders MAX 5 modules and EXACTLY
   ONE primary action ABOVE THE FOLD).

   WHY THIS EXISTS (P1-B, 2026-08-12 visual audit)
   ───────────────────────────────────────────────
   The first Rule-A implementation did the budget arithmetic through a PROXY:

       foldNoticed = isReturning && noticedWould && hardMomentWould

   `hardMomentWould` resolved via todayHardMomentOffer() →
   publishedHardMomentCards, which is `hardMomentCards.filter(isPublishableContent)`
   — and the only authored card is `reviewStatus: "draft"`, so that array is
   EMPTY by governance (GD-10). The proxy could therefore never be true, the
   fold never engaged, and Today shipped SIX sibling modules.

   The lesson is the rule this module encodes: **the budget counts the modules
   that actually render.** It never consults a content-governance gate, a
   publish state, or any other array a reviewer can empty. A governed array
   going empty must change what a module SAYS, never how many modules Today is
   allowed to show. (Guarded by todayConsolidation.test.ts.)

   ENG-10 / TJB-28 (Wave S+L): the evening rhythm. The Daily Play slot is ONE
   slot with three tenants that never co-exist — `play` by day, `tonight`
   from the wind-down hour (the day-rooted bedtime story + the wind-down
   routine), `dayclose` after bedtime (what you kept · tomorrow's reason ·
   good night). Today itself is never replaced: the anchor, the capture bar
   and the since-strip stay; only the play tenant changes (critic objection 2
   on ARBOR-NEXT-LEVEL-VISION: "Tonight is ONE module, never a takeover").

   Pure functions — no React, no context, no I/O, no imports (P1-B firewall:
   the budget module may reference nothing a reviewer can empty).
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * The Today modules that occupy a top-level slot in the column.
 *
 * NOT listed, deliberately:
 *  - the greeting header and the QuickCapture bar — ambient chrome, not modules
 *    (the capture bar is `fixed` on phones and carries no content),
 *  - the "More" disclosure — the collapsed SECONDARY drawer that RECEIVES
 *    demoted modules. Counting the drawer would make the overflow container
 *    compete with its own overflow,
 *  - the hard-moment offer — it renders INSIDE the anchor row's left column,
 *    so it is never a sibling module (the very confusion that produced P1-B),
 *  - the ENG-18 rhythm progress line and the ENG-11 nudge eyebrow — LINES
 *    inside existing modules, never siblings.
 */
export type TodayModuleId = "anchor" | "since" | "noticed" | "narrative" | "rail" | "play" | "tonight" | "dayclose";

/** Rule A: at most five visible modules on Today, in every state. */
export const TODAY_MODULE_BUDGET = 5;

/**
 * Priority, highest first. The tail loses its slot when the budget is spent.
 *
 * Only modules that DEGRADE GRACEFULLY may sit at the tail — a demoted module
 * must land somewhere, never just vanish:
 *   play    → the collapsed "More" drawer (and it keeps its full home in
 *             Growth › Daily Play),
 *   tonight / dayclose → the same drawer (the bedtime story keeps its full
 *             home in Stories › Bedtime; the day-close card is a close, not
 *             a record — losing it loses nothing),
 *   noticed → FOLDS into a since-strip row ("Arbor noticed something — look"),
 *             which only exists when the strip itself renders.
 *
 * Hence the two orders: when the strip is absent there is nothing to fold
 * into, so `noticed` climbs above `rail`/`play` and `play` takes the cut
 * instead. A watch signal never silently disappears to make room.
 *
 * `play`, `tonight` and `dayclose` are one slot's three tenants (see
 * eveningSlotFor) — OverviewTab wants at most one of them at a time.
 */
export function todayModulePriority(opts: { noticedCanFold: boolean }): readonly TodayModuleId[] {
  return opts.noticedCanFold
    ? ["anchor", "since", "narrative", "rail", "tonight", "dayclose", "play", "noticed"]
    : ["anchor", "since", "narrative", "noticed", "rail", "tonight", "dayclose", "play"];
}

export type TodayModuleWants = Partial<Record<TodayModuleId, boolean>>;

export interface TodayModulePlan {
  /** Modules that render as top-level siblings — never more than `budget`. */
  visible: ReadonlySet<TodayModuleId>;
  /** Modules that wanted a slot and did not get one, in priority order. */
  demoted: readonly TodayModuleId[];
}

/**
 * Resolve which requested modules render.
 *
 * `wants` is keyed by each module's REAL render condition (e.g. `rail` = "the
 * rail component would return markup", from useFirstStepsRail().visible) — not
 * by a stand-in for it, and never by a content-publish gate. The anchor is
 * implicit: it always holds a slot.
 */
export function resolveTodayModules(
  wants: TodayModuleWants,
  opts: { budget?: number; noticedCanFold?: boolean } = {},
): TodayModulePlan {
  const budget = opts.budget ?? TODAY_MODULE_BUDGET;
  const visible = new Set<TodayModuleId>();
  const demoted: TodayModuleId[] = [];

  for (const id of todayModulePriority({ noticedCanFold: opts.noticedCanFold === true })) {
    const wanted = id === "anchor" ? true : wants[id] === true;
    if (!wanted) continue;
    // The anchor is exempt from the cap — a Today with no primary action is a
    // worse failure than a Today with one module too many, and the priority
    // order puts it first anyway, so this is belt-and-braces.
    if (id === "anchor" || visible.size < budget) visible.add(id);
    else demoted.push(id);
  }

  return { visible, demoted };
}

/* ── ENG-10 / TJB-28 — the play slot's evening tenants ─────────────────────── */

/** Which of the three tenants the play slot holds right now. */
export type EveningSlot = "play" | "tonight" | "dayclose";

/** Default bedtime when the rhythm has none: 21:30 local (critic card: "the
 *  after-bedtime parent is the largest logging hour and gets a close, not a
 *  story"). Minutes since local midnight. */
export const TODAY_DEFAULT_BEDTIME_MINUTES = 21 * 60 + 30;

/**
 * Pure tenant selection. `dayPart` is lib/timeOfDay dayPartFor(hour) — passed
 * in (not imported) so this module stays import-free.
 *
 *  - after bedtime (rhythm bedtime, else 21:30 default)          → "dayclose"
 *  - evening by clock, OR at/after the rhythm's wind-down hour   → "tonight"
 *  - otherwise                                                    → "play"
 *
 * Wind-down is the ONLY personalised input; a `null` wind-down (no rhythm
 * read yet) leaves the clock rule in charge. Bedtime never falls before the
 * wind-down hour (a rhythm bedtime earlier than its own wind-down is a data
 * fault, not a reason to close the day mid-afternoon).
 */
export function eveningSlotFor(input: {
  dayPart: "morning" | "afternoon" | "evening";
  hour: number;
  minute?: number;
  windDownHour?: number | null;
  bedtimeMinutes?: number | null;
}): EveningSlot {
  const minutes = input.hour * 60 + (input.minute ?? 0);
  const windDown = typeof input.windDownHour === "number" && Number.isFinite(input.windDownHour) ? input.windDownHour : null;
  const bedtimeRaw = typeof input.bedtimeMinutes === "number" && Number.isFinite(input.bedtimeMinutes) ? input.bedtimeMinutes : TODAY_DEFAULT_BEDTIME_MINUTES;
  const bedtime = windDown == null ? bedtimeRaw : Math.max(bedtimeRaw, windDown * 60);
  if (minutes >= bedtime) return "dayclose";
  if (input.dayPart === "evening" || (windDown != null && input.hour >= windDown)) return "tonight";
  return "play";
}
