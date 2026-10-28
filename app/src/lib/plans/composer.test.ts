/**
 * B-BOOK-77 — the composer's flow, pinned: the red lines run first and a
 * ticked sign routes to care with no plan; the defaults compose without
 * typing; a swap stays inside the slot's sourced menu; the bounds hold; an
 * own-words step cannot pass the steps stage until the parent approves the
 * exact line (B-GA-11); the approval is an explicit, final tap.
 */
import { describe, expect, it } from "vitest";
import { composeRequestOf, composerProblems, composerReducer, compositionOf, initialComposer, redLinesOf, slotMenu, type ComposerAction, type ComposerState } from "./composer";
import { PLAN_POO_SIT } from "../library/plans/patterns/planPooSit";
import { composePlanBook, OWN_STEP } from "../library/plans/composePlanBook";
import { sharedEscalation } from "../../content/hardMomentCards";

const def = PLAN_POO_SIT;
const run = (...actions: ComposerAction[]): ComposerState => actions.reduce((s, a) => composerReducer(def, s, a), initialComposer(def, "en"));
const toSteps: ComposerAction[] = [{ type: "open" }, { type: "redLinesDone" }];
const own = { slot: 2 as const, sourceText: "the therapist said: bubbles while sitting", text: { en: "Step two: while I sit, I blow bubbles, slow and long. My tummy goes soft.", he: { m: "שלב שני: בזמן שאני יושב, אני מנשף בועות, לאט. הבטן שלי נעשית רכה.", f: "שלב שני: בזמן שאני יושבת, אני מנשפת בועות, לאט. הבטן שלי נעשית רכה." } }, aiPhrased: true as const };

describe("the composer flow", () => {
  it("opens on the door with the pattern's defaults proposed (no typing needed)", () => {
    const s = initialComposer(def, "he");
    expect(s.stage).toBe("door");
    expect(s.stepMenuIds).toEqual(def.defaultSteps);
    expect(s.minutes).toBe(5);
    expect(s.time).toBe("evening");
    expect(s.boxItemIds).toEqual(["book", "soap-bubbles", "story"]);
    expect(s.durationDays).toBe(21);
    expect(composerProblems(def, s)).toEqual([]);
  });

  it("the red lines run first: nothing ticked → steps; one ticked sign → care with the governed line and NO plan", () => {
    expect(run({ type: "open" }).stage).toBe("redLines");
    expect(run(...toSteps).stage).toBe("steps");
    const care = run({ type: "open" }, { type: "tick", id: "blood", on: true }, { type: "redLinesDone" });
    expect(care.stage).toBe("care");
    const out = redLinesOf(def, care);
    expect(out.offer).toBe("care");
    if (out.offer === "care") expect(out.careLine).toBe(sharedEscalation);
    // no action moves on from care but back; the plan stage is unreachable
    expect(composerReducer(def, care, { type: "stepsDone" }).stage).toBe("care");
    expect(composerReducer(def, care, { type: "approved" }).stage).toBe("care");
    expect(composerReducer(def, care, { type: "back" }).stage).toBe("redLines");
    // an unknown sign is ignored; unticking clears the route
    expect(run({ type: "open" }, { type: "tick", id: "not-a-sign", on: true }, { type: "redLinesDone" }).stage).toBe("steps");
    expect(run({ type: "open" }, { type: "tick", id: "blood", on: true }, { type: "tick", id: "blood", on: false }, { type: "redLinesDone" }).stage).toBe("steps");
  });

  it("swaps stay inside the slot's sourced menu; the bounds hold", () => {
    expect(slotMenu(def, 1).map((m) => m.id)).toEqual(["sit-after-meal", "sit-same-time"]);
    const s = run(...toSteps, { type: "swap", slot: 1, menuId: "sit-same-time" }, { type: "swap", slot: 2, menuId: "sit-same-time" }, { type: "minutes", minutes: 3 }, { type: "minutes", minutes: 30 }, { type: "time", time: "bedtime" });
    expect(s.stepMenuIds).toEqual(["sit-same-time", "the-box", "just-try"]);
    expect(s.minutes).toBe(3);
    expect(s.time).toBe("bedtime");
    expect(composerProblems(def, s)).toEqual([]);
  });

  it("an own-words step (B-GA-11) holds the steps stage until the parent approves the exact line", () => {
    const phrased = run(...toSteps, { type: "ownStepPhrased", step: own });
    expect(phrased.stepMenuIds[1]).toBe(OWN_STEP);
    expect(phrased.ownStep?.approvedAt).toBeUndefined();
    expect(composerProblems(def, phrased).map((p) => p.code)).toEqual(["own_step_unapproved"]);
    expect(composerReducer(def, phrased, { type: "stepsDone" }).stage).toBe("steps");
    // the unapproved line cannot become a book
    expect(() => composePlanBook(def, compositionOf(phrased))).toThrow(/own_step_unapproved/);
    const approved = composerReducer(def, phrased, { type: "ownStepApproved", at: "2026-10-27T18:00:00.000Z" });
    expect(composerProblems(def, approved)).toEqual([]);
    const next = composerReducer(def, approved, { type: "stepsDone" });
    expect(next.stage).toBe("the-box");
    const book = composePlanBook(def, { ...compositionOf(approved), bookId: "b", approvedAt: "t", approvedBy: "p" });
    expect(book.steps[1]).toMatchObject({ id: "s2-own", menuId: OWN_STEP, aiPhrased: true });
    expect(book.pages[5].text.en).toBe(own.text.en);
    expect(book.parent.planSteps[1].en).toContain("phrased by Arbor and approved by you");
    // dropping it restores the slot's default; swapping the slot drops it too
    expect(composerReducer(def, approved, { type: "ownStepDropped" }).stepMenuIds).toEqual(def.defaultSteps);
    expect(composerReducer(def, approved, { type: "swap", slot: 2, menuId: "blow-bubbles" }).ownStep).toBeUndefined();
  });

  it("box and duration are bounded; preview → the explicit approval → the request body", () => {
    const s = run(...toSteps, { type: "stepsDone" }, { type: "the-box", itemId: "song", on: true }, { type: "the-box", itemId: "sweets", on: true }, { type: "the-box", itemId: "book", on: false }, { type: "duration", durationDays: 28 }, { type: "duration", durationDays: 90 }, { type: "boxDone" });
    expect(s.stage).toBe("preview");
    expect(s.boxItemIds).toEqual(["soap-bubbles", "story", "song"]);
    expect(s.durationDays).toBe(28);
    // approval is final and explicit
    expect(composerReducer(def, s, { type: "boxDone" }).stage).toBe("preview");
    const done = composerReducer(def, s, { type: "approved" });
    expect(done.stage).toBe("approved");
    expect(composeRequestOf(done)).toEqual({ pattern: "plan-poo-sit", lang: "en", stepMenuIds: ["sit-after-meal", "the-box", "just-try"], minutes: 5, time: "evening", boxItemIds: ["soap-bubbles", "story", "song"], durationDays: 28 });
    expect(composerReducer(def, done, { type: "back" }).stage).toBe("approved");
  });
});
