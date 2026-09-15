/**
 * nudgeTemplates.ts — N1-06: the name-free template set every OUT-OF-APP
 * channel must use.
 *
 * WHY THIS FILE EXISTS
 * ────────────────────
 * `lib/jitai.ts` `nextNudge` is the candidate generator, and every nudge it
 * produces carries `vars: { name }` — the child's first name (jitai.ts lines
 * 120, 135, 162, 176, 191). Inside the app, behind auth, that is fine and it is
 * what the bell renders today. On a LOCK SCREEN it is a breach: critic-vision
 * BLOCK #3 forbids a child's name, a behaviour pattern or a streak in any
 * notification payload.
 *
 * So the copy a channel sends is NOT the candidate's copy. It is one of the
 * constants below, chosen by the candidate's `kind` and nothing else.
 *
 * THE DESIGN THAT MAKES THE BREACH IMPOSSIBLE RATHER THAN FORBIDDEN
 * ─────────────────────────────────────────────────────────────────
 * A `NudgeTemplate` has exactly two fields — `titleKey` and `bodyKey`. There is
 * **no `vars` field at all**, so there is nothing for a caller to interpolate
 * and no field for a future edit to quietly populate. The strings behind those
 * keys (lib/i18nElevation/returnhooks.ts, `elev.rh.nudge.*`) contain no
 * placeholder token of any kind — `nudgeTemplates.test.ts` scans every one of
 * them, in EN and HE, for `{name}` / `{{` / `${` and pins the count at zero,
 * with the live `nextNudge` output as the negative control.
 *
 * KEYED BY `NudgeKind`, NOT BY `NudgeTypeKey` — a deliberate deviation from the
 * item text. `NudgeTypeKey` (guidance | milestone | weekly) is the PARENT's
 * preference switch and covers only 2 of the 5 kinds the engine can emit
 * (`NUDGE_KIND_PREF` in jitai.ts is a `Partial` record). A template set keyed
 * that way would have no copy for `log`, `practice` or `bedtime` — i.e. the
 * three kinds a day-1 family is most likely to get — and a channel reaching for
 * a missing template would fall back to the candidate's named copy, which is
 * precisely the breach this file exists to prevent. Keying by `NudgeKind` makes
 * coverage total and is asserted as such in the guard.
 *
 * CLINICAL FIREWALL / REGISTER: parent register, calm, no verdict, no grade, no
 * colour word, no streak, no "you missed", no count of anything about a child.
 * Each string describes the PARENT's own next move or a plain fact about what
 * Arbor holds. Nothing here names, describes or characterises a child.
 */
import type { NudgeKind } from "../lib/jitai";

/**
 * A deliverable payload: two i18n keys and NOTHING else. The absence of a
 * `vars` field is load-bearing — see the header. Do not add one.
 */
export interface NudgeTemplate {
  readonly titleKey: string;
  readonly bodyKey: string;
}

/**
 * The complete, name-free set. One entry per `NudgeKind` — the record is
 * exhaustive by type, so a new kind in jitai.ts fails the build here rather
 * than silently falling through to the candidate's named copy.
 */
export const NUDGE_TEMPLATES: Readonly<Record<NudgeKind, NudgeTemplate>> = {
  prep: {
    titleKey: "elev.rh.nudge.prep.title",
    bodyKey: "elev.rh.nudge.prep.body",
  },
  calm: {
    titleKey: "elev.rh.nudge.calm.title",
    bodyKey: "elev.rh.nudge.calm.body",
  },
  bedtime: {
    titleKey: "elev.rh.nudge.bedtime.title",
    bodyKey: "elev.rh.nudge.bedtime.body",
  },
  log: {
    titleKey: "elev.rh.nudge.log.title",
    bodyKey: "elev.rh.nudge.log.body",
  },
  practice: {
    titleKey: "elev.rh.nudge.practice.title",
    bodyKey: "elev.rh.nudge.practice.body",
  },
} as const;

/** Every key this module can put in front of a parent — the guard's scan list. */
export const NUDGE_TEMPLATE_KEYS: readonly string[] = Object.values(NUDGE_TEMPLATES)
  .flatMap((tpl) => [tpl.titleKey, tpl.bodyKey]);

/** The template for a kind. Total by construction — never null, never the
 *  candidate's copy. */
export function templateFor(kind: NudgeKind): NudgeTemplate {
  return NUDGE_TEMPLATES[kind];
}
