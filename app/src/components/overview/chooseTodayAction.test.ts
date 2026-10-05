import { describe, it, expect } from "vitest";
import { chooseTodayAction } from "./chooseTodayAction";

/**
 * W1 1.2 — the guaranteed-action fallback chain (the Whoop rule): every open
 * of Today ends in exactly ONE offered primary action, including day-0,
 * AI-miss, and offline. All branches pinned here.
 */

const BASE = {
  hasActiveAction: false,
  focusHeadline: null as string | null,
  focusPending: false,
  promptKeys: ["elev.prompt.toddler.3", "elev.prompt.toddler.14", "elev.prompt.toddler.25"],
  hasDailyPlay: true,
};

describe("chooseTodayAction — deterministic fallback chain", () => {
  it("an accepted action owns the slot regardless of everything else", () => {
    expect(chooseTodayAction({ ...BASE, hasActiveAction: true, focusHeadline: "Do X" })).toEqual({ kind: "loop" });
  });

  it("a real AI focus headline renders the focus hero", () => {
    expect(chooseTodayAction({ ...BASE, focusHeadline: "One calm handoff before school" })).toEqual({ kind: "focus" });
  });

  it("an in-flight focus fetch keeps the hero (skeleton) — no prompt flicker", () => {
    expect(chooseTodayAction({ ...BASE, focusPending: true })).toEqual({ kind: "focus" });
  });

  it("day-0 / AI-miss falls to the promptBank capture prompt (first of today's rotation)", () => {
    expect(chooseTodayAction({ ...BASE })).toEqual({ kind: "prompt", promptKey: "elev.prompt.toddler.3" });
  });

  it("no band prompts (defensive — bandForAge always resolves) → Daily Play promotion", () => {
    expect(chooseTodayAction({ ...BASE, promptKeys: [] })).toEqual({ kind: "play" });
  });

  it("absolute floor: no prompts, no play → bare capture card (never an empty slot)", () => {
    expect(chooseTodayAction({ ...BASE, promptKeys: [], hasDailyPlay: false })).toEqual({ kind: "capture" });
  });

  it("every input combination yields an action (the guarantee itself)", () => {
    for (const hasActiveAction of [true, false]) {
      for (const focusHeadline of ["x", null]) {
        for (const focusPending of [true, false]) {
          for (const promptKeys of [BASE.promptKeys, []]) {
            for (const hasDailyPlay of [true, false]) {
              const choice = chooseTodayAction({ hasActiveAction, focusHeadline, focusPending, promptKeys, hasDailyPlay });
              expect(["loop", "focus", "prompt", "play", "capture"]).toContain(choice.kind);
            }
          }
        }
      }
    }
  });
});

/* ── ENG-24: the Monday anchor ──────────────────────────────────────────────
   The weekly recap is generated on app open and is firewall-clean, but it only
   ever surfaced as ONE LINE inside the since-last-visit strip — and only for
   returning parents WITH since-visit rows (that component's own "known v1
   limitation"). A week-boundary ritual is the cheapest habit anchor there is,
   and Today's chain had no `recap` kind at all.

   The rule pinned here: `recap` outranks prompt / play / focus, and NEVER an
   action the parent has already accepted. */
describe("ENG-24 — the week's recap can be the day's anchor", () => {
  it("does nothing when the caller does not raise the flag (every existing caller)", () => {
    expect(chooseTodayAction({ ...BASE })).toEqual({ kind: "prompt", promptKey: "elev.prompt.toddler.3" });
    expect(chooseTodayAction({ ...BASE, hasWeekAnchorRecap: false })).toEqual({
      kind: "prompt",
      promptKey: "elev.prompt.toddler.3",
    });
  });

  it("outranks the capture prompt", () => {
    expect(chooseTodayAction({ ...BASE, hasWeekAnchorRecap: true })).toEqual({ kind: "recap" });
  });

  it("outranks the daily-play fallback", () => {
    expect(chooseTodayAction({ ...BASE, promptKeys: [], hasWeekAnchorRecap: true })).toEqual({ kind: "recap" });
  });

  it("outranks the bare capture floor", () => {
    expect(
      chooseTodayAction({ ...BASE, promptKeys: [], hasDailyPlay: false, hasWeekAnchorRecap: true }),
    ).toEqual({ kind: "recap" });
  });

  it("outranks the AI focus hero and its pending state", () => {
    expect(
      chooseTodayAction({ ...BASE, focusHeadline: "One calm handoff before school", hasWeekAnchorRecap: true }),
    ).toEqual({ kind: "recap" });
    expect(chooseTodayAction({ ...BASE, focusPending: true, hasWeekAnchorRecap: true })).toEqual({ kind: "recap" });
  });

  it("NEVER outranks an action the parent already accepted", () => {
    expect(chooseTodayAction({ ...BASE, hasActiveAction: true, hasWeekAnchorRecap: true })).toEqual({ kind: "loop" });
  });

  it("still yields exactly ONE choice across the whole input space (Rule A)", () => {
    for (const hasActiveAction of [true, false]) {
      for (const hasWeekAnchorRecap of [true, false]) {
        for (const focusHeadline of ["Do X", null]) {
          for (const focusPending of [true, false]) {
            for (const promptKeys of [["k"], []]) {
              for (const hasDailyPlay of [true, false]) {
                const choice = chooseTodayAction({
                  hasActiveAction,
                  hasWeekAnchorRecap,
                  focusHeadline,
                  focusPending,
                  promptKeys,
                  hasDailyPlay,
                });
                expect(choice.kind).toBeTruthy();
                if (hasActiveAction) expect(choice.kind).toBe("loop");
                else if (hasWeekAnchorRecap) expect(choice.kind).toBe("recap");
              }
            }
          }
        }
      }
    }
  });
});

describe("B-TODAY-08 — chain order loop > recap > focus > weekOpen", () => {
  const B = { hasActiveAction: false, focusHeadline: null as string | null, focusPending: false, promptKeys: ["k"], hasDailyPlay: true };

  it("focus > weekOpen: a grounded step is never displaced by the week-open invitation", () => {
    expect(chooseTodayAction({ ...B, focusHeadline: "Do X", hasWeekOpenAnchor: true })).toEqual({ kind: "focus" });
    expect(chooseTodayAction({ ...B, focusPending: true, hasWeekOpenAnchor: true })).toEqual({ kind: "focus" });
  });

  it("recap > focus: a written, unopened recap takes the slot once a week", () => {
    expect(chooseTodayAction({ ...B, focusHeadline: "Do X", hasWeekAnchorRecap: true, hasWeekOpenAnchor: true })).toEqual({ kind: "recap" });
  });

  it("loop > recap", () => {
    expect(chooseTodayAction({ ...B, hasActiveAction: true, hasWeekAnchorRecap: true })).toEqual({ kind: "loop" });
  });

  it("weekOpen still outranks the prompt floor when no focus exists", () => {
    expect(chooseTodayAction({ ...B, hasWeekOpenAnchor: true })).toEqual({ kind: "weekOpen" });
  });
});

describe("B-TODAY-12 — a grounded hard-moment step when there is no focus", () => {
  const BASE2 = { hasActiveAction: false, focusHeadline: null as string | null, focusPending: false, promptKeys: ["elev.prompt.toddler.1"], hasDailyPlay: true };
  it("focus > hardMoment: the guide's Say-this rides on the focus instead", () => {
    expect(chooseTodayAction({ ...BASE2, focusHeadline: "Do X", hasHardMomentStep: true })).toEqual({ kind: "focus" });
    expect(chooseTodayAction({ ...BASE2, focusPending: true, hasHardMomentStep: true })).toEqual({ kind: "focus" });
  });
  it("hardMoment > weekOpen > prompt > play", () => {
    expect(chooseTodayAction({ ...BASE2, hasHardMomentStep: true, hasWeekOpenAnchor: true })).toEqual({ kind: "hardMoment" });
    expect(chooseTodayAction({ ...BASE2, hasHardMomentStep: true })).toEqual({ kind: "hardMoment" });
  });
  it("loop and recap still outrank it; absent flag = unchanged chain", () => {
    expect(chooseTodayAction({ ...BASE2, hasActiveAction: true, hasHardMomentStep: true })).toEqual({ kind: "loop" });
    expect(chooseTodayAction({ ...BASE2, hasWeekAnchorRecap: true, hasHardMomentStep: true })).toEqual({ kind: "recap" });
    expect(chooseTodayAction({ ...BASE2 }).kind).toBe("prompt");
  });
});

/* ── B-TODAY-26 — Tonight takes the step slot in the evening ─────────────── */
import { bedtimeDoorOpen } from "../../lib/timeOfDay";
import { chooseContinuation, dayCloseDue, DAY_CLOSE_LINE_HOUR } from "./continuation";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

describe("B-TODAY-26 — Tonight and the day-close: the hour table", () => {
  const FOCUS = { ...BASE, focusHeadline: "Mornings ran smoother this week" };
  const at = (hour: number, windDownHour: number | null = null, over: Partial<typeof BASE> = {}) =>
    chooseTodayAction({ ...FOCUS, ...over, tonight: bedtimeDoorOpen(hour, windDownHour) }).kind;

  it("09:00 → the step card; 20:00 → Tonight", () => {
    expect(at(9)).toBe("focus");
    expect(at(20)).toBe("tonight");
  });

  it("every hour: closed in the morning and afternoon (no wind-down known), open from 18:00", () => {
    for (let h = 0; h < 24; h++) {
      const expected = h >= 18 ? "tonight" : "focus";
      expect(at(h), `hour ${h}`).toBe(expected);
    }
  });

  it("the family's own wind-down hour opens it earlier in the afternoon, never in the morning", () => {
    expect(at(17, 17)).toBe("tonight");
    expect(at(16, 17)).toBe("focus");
    expect(at(10, 9)).toBe("focus");
  });

  it("an open step and the week's recap still outrank it; it outranks every daytime step", () => {
    expect(at(20, null, { hasActiveAction: true })).toBe("loop");
    expect(chooseTodayAction({ ...BASE, hasWeekAnchorRecap: true, tonight: true }).kind).toBe("recap");
    for (const over of [{ hasHardMomentStep: true }, { hasWeekOpenAnchor: true }, { hasDailyPlay: true, promptKeys: [] as string[] }]) {
      expect(chooseTodayAction({ ...BASE, ...over, tonight: true }).kind).toBe("tonight");
    }
  });

  it("the day-close line: after 21:00, until Good night, and never over a carry-over or tomorrow's reason", () => {
    expect(DAY_CLOSE_LINE_HOUR).toBe(21);
    expect(dayCloseDue({ hour: 20, dismissedDay: null, today: "2026-10-02" })).toBe(false);
    expect(dayCloseDue({ hour: 21, dismissedDay: null, today: "2026-10-02" })).toBe(true);
    expect(dayCloseDue({ hour: 22, dismissedDay: "2026-10-02", today: "2026-10-02" })).toBe(false);
    expect(dayCloseDue({ hour: 22, dismissedDay: "2026-10-01", today: "2026-10-02" })).toBe(true);
    expect(chooseContinuation({ offerKind: null, dayClose: true })).toBe("dayClose");
    expect(chooseContinuation({ offerKind: "follow-up", dayClose: true })).toBe("carry");
    expect(chooseContinuation({ offerKind: "tomorrow-reason", dayClose: true })).toBe("reason");
    expect(chooseContinuation({ offerKind: "rhythm", dayClose: false })).toBe("none");
  });
});

describe("B-TODAY-26 — Today wiring: one voice, no generation, no timer", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const strip = (c: string) => c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const overview = strip(readFileSync(path.join(here, "../tabs/OverviewTab.tsx"), "utf8"));
  const card = strip(readFileSync(path.join(here, "TonightCard.tsx"), "utf8"));

  it("the clock feeds the chain through bedtimeDoorOpen; Tonight renders in the step slot", () => {
    expect(overview).toMatch(/const tonightOpen = bedtimeDoorOpen\(nowHour, rhythm\.windDownHour\)/);
    expect(overview).toMatch(/tonight: tonightOpen && behaviorLogs\.length \+ playLogs\.length > 0/);
    expect(overview).toMatch(/todayChoice\.kind === "tonight" \? \(\s*<TonightCard/);
  });

  it("the coordinator's evening cue is not rendered while Tonight holds the slot", () => {
    expect(overview).toMatch(/const shownOffer = todayChoice\.kind === "tonight" && todayOffer\.offer\?\.kind === "tonight" \? null : todayOffer\.offer/);
    expect(overview).toContain("offer={shownOffer}");
  });

  it("the count is the day-close signal; the card navigates and generates nothing", () => {
    expect(overview).toMatch(/deriveReturnSignals\(\{[^}]*\}\)\.momentsToday/);
    expect(overview).toContain('onRead={() => setActiveTab("bedtime-stories")}');
    // B-GROWTH-25: #/routines retired to Plans — the routine door opens Plans' templates.
    expect(overview).toContain('onRoutine={() => setActiveTab("plans")}');
    expect(card).not.toMatch(/fetch\(|api\.|generate|setTimeout|setInterval|streak|tomorrow/i);
  });

  it("EN + HE keys for Tonight and the day-close line", async () => {
    const { translate } = await import("../../lib/i18n");
    for (const k of ["elev.tonight.eyebrow", "elev.tonight.headline.many", "elev.tonight.headline.one", "elev.tonight.headline.none", "elev.tonight.read", "elev.tonight.routine", "elev.dayclose.kept.many", "elev.dayclose.kept.one", "elev.dayclose.kept.none", "elev.dayclose.goodnight"]) {
      expect(translate("en", k), k).not.toBe(k);
      expect(translate("he", k), k).not.toBe(k);
      expect(translate("he", k)).not.toBe(translate("en", k));
    }
    expect(translate("en", "elev.tonight.headline.many", { n: 4 })).toBe("Read tonight's story from today's 4 moments");
  });
});
