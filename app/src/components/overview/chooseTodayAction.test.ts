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
