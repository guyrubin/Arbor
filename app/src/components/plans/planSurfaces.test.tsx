/**
 * B-BOOK-77/78 — the three parent surfaces of an Everyday plan render from
 * data alone (no server, no model call): the journal's "Everyday plans"
 * section (doors only for patterns the server opened, running plans as
 * COUNTS, the keep / change / close choice once the duration ran out), the
 * Today lead (the three parent lines, the night question in the evening, the
 * explicit journal tap only after a recorded night) and the composer's stage
 * order — the red lines come FIRST and one ticked sign is the care line and
 * no plan. Parent register throughout: the composer's preview does not wear
 * the kid register (IA-08, playShell.register.test).
 *
 * FIREWALL: nothing a parent sees here grades the child — no percentage, no
 * streak, no Low/Medium/High, no colour chip; a count of nights only.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});

import PlansSection from "./PlansSection";
import NowPlanLead from "./NowPlanLead";
import PlanComposer from "./PlanComposer";
import { getPattern } from "../../lib/library/plans/planBooks";
import type { PlanBookDoc } from "../../lib/library/plans/planBookDoc";
import { activePlans, recordNight } from "../../lib/plans/planWeek";
import { composerReducer, compositionOf, initialComposer, type ComposerAction, type ComposerState } from "../../lib/plans/composer";
import { composePlanBook } from "../../lib/library/plans/composePlanBook";
import type { PlanVisibility } from "../../lib/plans/planApi";
import type { BookReaderChild } from "../../lib/library/types";
import { sharedEscalation } from "../../content/hardMomentCards";

const def = getPattern("plan-poo-sit")!;
const NOA: BookReaderChild = { id: "demo-child", name: "Noa", gender: "girl", heroSheetId: "placeholder" };

const docAt = (approvedAt: string, extra: Partial<PlanBookDoc> = {}): PlanBookDoc => ({
  id: "plan-poo-sit.c1", bookId: "plan-poo-sit.c1", kind: "plan", pattern: "plan-poo-sit", lang: "en",
  stepMenuIds: ["sit-after-meal", "the-box", "just-try"], minutes: 5, time: "evening", boxItemIds: ["song"], durationDays: 14,
  approvedAt, approvedBy: "parent-1", createdAt: approvedAt, updatedAt: approvedAt, status: "active", ...extra,
});
const APPROVED = "2026-10-20T18:00:00.000Z";
const DAY_7 = new Date("2026-10-26T19:00:00.000Z");
const DAY_22 = new Date("2026-11-10T19:00:00.000Z");
const OPEN: PlanVisibility = { composable: { "plan-poo-sit": { en: true, he: true } } } as PlanVisibility;

const html = (node: React.ReactElement) => renderToStaticMarkup(node).replace(/<!-- -->/g, "");
const visible = (h: string) => h.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
/** The parent-side verdict firewall (app/PRODUCT.md "counts, never verdicts"). */
const VERDICT = /\d+\s?%|\bstreak\b|\b(?:low|medium|high) (?:risk|level)\b|\bon track\b|\bbehind\b|\bscore\b/i;
const noop = () => {};
const section = (props: Partial<React.ComponentProps<typeof PlansSection>>) =>
  html(<PlansSection childName="Noa" planRows={[]} visibility={null} now={DAY_7} onOpenDoor={noop} onOpenPlan={noop} onKeep={noop} onChange={noop} onClose={noop} onPrint={noop} {...props} />);

describe("the journal's Everyday plans section (B-BOOK-77)", () => {
  it("renders no door while the server's table is unknown or the pattern is dark for this family", () => {
    expect(section({ visibility: null })).not.toContain("data-plan-door");
    const dark: PlanVisibility = { composable: { "plan-poo-sit": { en: false, he: false } } } as PlanVisibility;
    expect(section({ visibility: dark })).not.toContain("data-plan-door");
  });

  it("opens one door per composable pattern, in the parent's own words, and the lede names the child", () => {
    const h = section({ visibility: OPEN });
    expect(h).toContain('data-plan-door="plan-poo-sit"');
    expect(h).toContain(def.parentWords.en);
    expect(visible(h)).toContain("Noa");
    expect(h).not.toContain('data-plan-door="plan-sleep-alone"');
  });

  it("a running plan shows its COUNT of nights and the days to go, and its pattern has no door", () => {
    const rows = [recordNight(recordNight(docAt(APPROVED), new Date("2026-10-21T19:00:00.000Z")), new Date("2026-10-22T19:00:00.000Z"))];
    const h = section({ visibility: OPEN, planRows: rows });
    expect(h).toContain('data-plan-running="plan-poo-sit"');
    expect(h).toContain('data-plan-nights="2"');
    expect(h).not.toContain("data-plan-door");
    expect(h).not.toContain("data-plan-review");
    expect(visible(h)).not.toMatch(VERDICT);
  });

  it("past the duration the parent chooses: keep, change or close — never a verdict", () => {
    const h = section({ visibility: OPEN, planRows: [docAt(APPROVED)], now: DAY_22 });
    expect(h).toContain("data-plan-review");
    for (const a of ["keep", "change", "close"]) expect(h).toContain(`data-plan-${a}=""`);
    expect(visible(h)).not.toMatch(VERDICT);
  });

  it("Hebrew: the section is RTL and the door speaks the pattern's Hebrew parent words", () => {
    state.lang = "he";
    try {
      const h = section({ visibility: OPEN });
      expect(h).toContain('dir="rtl"');
      expect(h).toContain(def.parentWords.he);
    } finally { state.lang = "en"; }
  });
});

describe("the Today lead of a running plan (B-BOOK-78)", () => {
  const plan = (doc: PlanBookDoc, now: Date) => activePlans([doc], now)[0];
  const lead = (doc: PlanBookDoc, now: Date, evening: boolean) =>
    html(<NowPlanLead plan={plan(doc, now)} lang="en" childName="Noa" now={now} evening={evening} onNight={noop} onUndoNight={noop} onJournal={noop} onOpen={noop} />);

  it("carries the three steps as the parent will do them, the day of the plan and the count of nights", () => {
    const h = lead(docAt(APPROVED), DAY_7, false);
    expect(h).toContain('data-module="now-plan"');
    expect((h.match(/<li /g) ?? []).length).toBe(3);
    expect(visible(h)).toContain("Noa");
    expect(h).not.toContain("data-plan-night-yes");
    expect(visible(h)).not.toMatch(VERDICT);
  });

  it("in the evening asks the night question in one tap; once recorded, offers undo and the EXPLICIT journal tap", () => {
    const fresh = lead(docAt(APPROVED), DAY_7, true);
    expect(fresh).toContain('data-plan-night-yes=""');
    expect(fresh).toContain('data-plan-night-no=""');
    expect(fresh).not.toContain("data-plan-night-journal");
    const done = lead(recordNight(docAt(APPROVED), DAY_7), DAY_7, true);
    expect(done).toContain("data-plan-night-done");
    expect(done).toContain('data-plan-night-undo=""');
    expect(done).toContain('data-plan-night-journal=""');
    expect(done).not.toContain("data-plan-night-yes");
  });
});

describe("the composer's stage order (B-BOOK-77)", () => {
  const run = (...actions: ComposerAction[]): ComposerState => actions.reduce((s, a) => composerReducer(def, s, a), initialComposer(def, "en"));
  const composer = (initialState?: ComposerState) => html(<PlanComposer def={def} child={NOA} onSaved={noop} onClose={noop} initialState={initialState} />);

  it("opens on the door, then the red lines come FIRST — before any step is shown", () => {
    const door = composer();
    expect(door).toContain('data-plan-stage="door"');
    expect(door).toContain('data-plan-start=""');
    const red = composer(run({ type: "open" }));
    expect(red).toContain('data-plan-stage="redLines"');
    for (const w of def.watchFor) expect(red).toContain(`data-plan-redline="${w.id}"`);
    expect(red).not.toContain("data-plan-step");
  });

  it("one ticked sign is the care line and NO plan: the care stage has no step, no box and no approval", () => {
    const care = composer(run({ type: "open" }, { type: "tick", id: def.watchFor[0].id, on: true }, { type: "redLinesDone" }));
    expect(care).toContain('data-plan-stage="care"');
    expect(care).toContain("data-plan-care-line");
    expect(visible(care).replace(/\s+/g, " ")).toContain(sharedEscalation.en.slice(0, 24)); // the family's own doctor: the existing hard-moment care line
    for (const attr of ["data-plan-step", "data-plan-box", "data-plan-approve"]) expect(care).not.toContain(attr);
  });

  it("no sign ticked: the three proposed steps, each swappable, with the minutes and the time of day", () => {
    const steps = composer(run({ type: "open" }, { type: "redLinesDone" }));
    expect(steps).toContain('data-plan-stage="steps"');
    expect((steps.match(/data-plan-step="/g) ?? []).length).toBe(3);
    expect(steps).toContain("data-plan-swap");
    expect(steps).toContain("data-plan-minutes");
    expect(steps).toContain("data-plan-time");
  });

  it("door (a): the own-words entry offers whose step it is, and a step relayed from the child's professional is labelled as such on the step and in the parent panel", () => {
    const steps = composer(run({ type: "open" }, { type: "redLinesDone" }));
    expect(steps).toContain('data-plan-own-origin-pick="parent"');
    expect(steps).toContain('data-plan-own-origin-pick="practitioner"');
    expect(visible(steps)).toContain("A step from the professional who works with Noa");
    const own = { slot: 2 as const, origin: "practitioner" as const, sourceText: "bubbles while sitting", aiPhrased: true as const, text: { en: "Step two: while I sit, I blow bubbles, slow and long.", he: { m: "שלב שני: בזמן שאני יושב, אני מנשף בועות, לאט.", f: "שלב שני: בזמן שאני יושבת, אני מנשפת בועות, לאט." } } };
    const phrased = composer(run({ type: "open" }, { type: "redLinesDone" }, { type: "ownStepPhrased", step: own }));
    expect(phrased).toContain('data-plan-own-origin="practitioner"');
    expect(visible(phrased)).toContain("A step from the professional who works with Noa, in your words");
    expect(phrased).toContain('data-plan-own-approve=""'); // still approved as the exact line, like any own step
    const book = composePlanBook(def, { ...compositionOf(run({ type: "open" }, { type: "redLinesDone" }, { type: "ownStepPhrased", step: own }, { type: "ownStepApproved", at: "2026-10-26T19:00:00Z" }), "t"), approvedAt: "t", approvedBy: "t" });
    expect(book.parent.planSteps[1].en).toContain("a step from the professional who works with your child");
    expect(book.parent.planSteps[1].en).not.toContain("your own step");
  });

  it("the preview is the whole book in the reader, inside the parent register (no kid-register wrapper), behind the explicit approval tap", () => {
    const preview = composer(run({ type: "open" }, { type: "redLinesDone" }, { type: "stepsDone" }, { type: "boxDone" }));
    expect(preview).toContain('data-plan-stage="preview"');
    expect(preview).toContain("data-plan-preview");
    expect(preview).toContain("data-book-page");
    expect(preview).toContain('data-plan-approve=""');
    expect(preview).not.toContain("arbor-play");
    expect(visible(preview)).toContain("Noa");
  });
});
