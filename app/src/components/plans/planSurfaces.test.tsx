/**
 * B-BOOK-77/78 → S1 (surfacing) — the parent surfaces of an Everyday plan
 * render from data alone (no server, no model call): the ONE "Everyday plans"
 * card (the running plan(s) as COUNTS with tonight's step and the five
 * actions, then "Something hard right now?" → the pattern chooser, hero
 * titles first, never the symptom sentence as the headline; the same card on
 * Today, where a plan already leading is not repeated), the Today lead (the
 * three parent lines, the night question in the evening, the explicit journal
 * tap only after a recorded night), the composer's stage order (the red lines
 * come FIRST and one ticked sign is the care line and no plan) and the owner's
 * auto-paint line (owner only). Parent register throughout: the composer's
 * preview does not wear the kid register (IA-08, playShell.register.test).
 *
 * FIREWALL: nothing a parent sees here grades the child — no percentage, no
 * streak, no Low/Medium/High, no colour chip; counts only. No plate code, no
 * "painted", no "owner" on a family surface.
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
import { authoredPatterns, getPattern } from "../../lib/library/plans/planBooks";
import type { PlanBookDoc } from "../../lib/library/plans/planBookDoc";
import { activePlans, recordNight, recordTry } from "../../lib/plans/planWeek";
import { composerReducer, compositionOf, initialComposer, type ComposerAction, type ComposerState } from "../../lib/plans/composer";
import { composePlanBook } from "../../lib/library/plans/composePlanBook";
import type { PlanVisibility } from "../../lib/plans/planApi";
import type { BookReaderChild } from "../../lib/library/types";
import { sharedEscalation } from "../../content/hardMomentCards";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => readFileSync(path.resolve(here, rel), "utf8").replace(/\r\n/g, "\n");

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
const ALL_OPEN: PlanVisibility = { composable: Object.fromEntries(authoredPatterns().map((d) => [d.id, { en: true, he: true }])) } as PlanVisibility;

const html = (node: React.ReactElement) => renderToStaticMarkup(node).replace(/<!-- -->/g, "");
const visible = (h: string) => h.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
/** The parent-side verdict firewall (app/PRODUCT.md "counts, never verdicts"). */
const VERDICT = /\d+\s?%|\bstreak\b|\b(?:low|medium|high) (?:risk|level)\b|\bon track\b|\bbehind\b|\bscore\b|\bmissed\b/i;
/** S1 terminology: no plate code, no painter state, no "owner", no "Make {name}'s plan" where a parent looks. */
const OWNER_WORDS = /\bP[PTSBDFEN]\d\b|\bpainted\b|\bnot painted\b|\bowner\b|Make Noa's plan|\bPaint plates\b/;
const noop = () => {};
const section = (props: Partial<React.ComponentProps<typeof PlansSection>>) =>
  html(<PlansSection childName="Noa" planRows={[]} visibility={null} now={DAY_7} onOpenDoor={noop} onOpenPlan={noop} onKeep={noop} onChange={noop} onClose={noop} onPrint={noop} {...props} />);

describe("the ONE Everyday plans card (S1)", () => {
  it("renders nothing while the server's table is unknown, or when every pattern is dark for this family", () => {
    expect(section({ visibility: null, initialChooserOpen: true })).toBe("");
    const dark: PlanVisibility = { composable: { "plan-poo-sit": { en: false, he: false } } } as PlanVisibility;
    expect(section({ visibility: dark, initialChooserOpen: true })).toBe("");
  });

  it("one card: the 'Something hard right now?' line is collapsed by default and opens the chooser; a door is never a bare symptom", () => {
    const closed = section({ visibility: OPEN });
    expect(closed).toContain('data-module="everyday-plans"');
    expect(closed).toContain('data-plans-chooser-toggle=""');
    expect(closed).toContain('aria-expanded="false"');
    expect(visible(closed)).toContain("Something hard right now?");
    expect(closed).not.toContain("data-plan-door");
    expect(closed).not.toContain('data-plans-chooser=""');
    const open = section({ visibility: OPEN, initialChooserOpen: true });
    expect(open).toContain('data-plan-door="plan-poo-sit"');
    expect(open).not.toContain('data-plan-door="plan-sleep-alone"');
    // the hero title is the headline, the parent's words the subtitle, the age range a quiet tag
    expect(open).toMatch(new RegExp(`data-plan-door-title="">${def.title.en}</b>`));
    expect(open).toContain(def.parentWords.en);
    expect(open).toContain(`data-plan-door-age="">Ages ${def.ageText}</small>`);
    expect(open.indexOf(def.title.en)).toBeLessThan(open.indexOf(def.parentWords.en));
    expect(visible(open)).not.toMatch(OWNER_WORDS);
    expect(visible(open)).not.toMatch(VERDICT);
  });

  it("the chooser lists every composable pattern once, as eight hero titles, and never a running one", () => {
    const all = section({ visibility: ALL_OPEN, initialChooserOpen: true });
    for (const d of authoredPatterns()) {
      expect(all).toContain(`data-plan-door="${d.id}"`);
      expect(all).toContain(d.title.en);
    }
    expect((all.match(/data-plan-door="/g) ?? []).length).toBe(8);
    const running = section({ visibility: ALL_OPEN, initialChooserOpen: true, planRows: [docAt(APPROVED)] });
    expect(running).not.toContain('data-plan-door="plan-poo-sit"');
    expect((running.match(/data-plan-door="/g) ?? []).length).toBe(7);
  });

  it("a running plan: 'A plan for Noa', the hero title, Night n of total, tries this week as a COUNT, tonight's step as the grown-ups do it, five actions", () => {
    const rows = [recordTry(recordNight(recordNight(docAt(APPROVED), new Date("2026-10-18T19:00:00.000Z")), new Date("2026-10-25T19:00:00.000Z")), DAY_7)];
    const h = section({ visibility: OPEN, planRows: rows });
    expect(h).toContain('data-plan-running="plan-poo-sit"');
    expect(visible(h)).toContain("A plan for Noa");
    expect(visible(h)).toContain(def.title.en);
    expect(h).toContain('data-plan-night="7"');
    expect(h).toContain('data-plan-tries="2"'); // the 25th (a parent night) and the 26th (the child's try); the 18th is eight days back
    expect(visible(h)).toContain("Night 7 of 14");
    expect(visible(h)).toContain("2 tries this week");
    expect(h).toContain('data-plan-tonight=""');
    expect(visible(h)).toContain("Tonight: ");
    for (const a of ["open", "print", "keep", "change", "close"]) expect(h).toContain(`data-plan-${a}=""`);
    expect(h).not.toContain("data-plan-review");
    expect(h).not.toContain("data-plan-door");
    expect(visible(h)).not.toMatch(VERDICT);
    expect(visible(h)).not.toMatch(OWNER_WORDS);
    // one try reads in the singular
    expect(visible(section({ visibility: OPEN, planRows: [recordTry(docAt(APPROVED), DAY_7)] }))).toContain("1 try this week");
  });

  it("past the duration the parent chooses: keep, change or close — the night never exceeds the total, never a verdict", () => {
    const h = section({ visibility: OPEN, planRows: [docAt(APPROVED)], now: DAY_22 });
    expect(h).toContain('data-plan-review=""');
    expect(h).toContain('data-plan-night="14"');
    for (const a of ["keep", "change", "close"]) expect(h).toContain(`data-plan-${a}=""`);
    expect(visible(h)).not.toMatch(VERDICT);
  });

  it("on Today the same card carries no module stamp and does not repeat the plan already leading", () => {
    const rows = [docAt(APPROVED)];
    const today = section({ visibility: ALL_OPEN, planRows: rows, surface: "today", excludePlanId: "plan-poo-sit.c1" });
    expect(today).toContain('data-everyday-plans="today"');
    expect(today).not.toContain("data-module=");
    expect(today).not.toContain("data-plan-running");
    expect(today).toContain('data-plans-chooser-toggle=""');
    const todayOther = section({ visibility: ALL_OPEN, planRows: rows, surface: "today" });
    expect(todayOther).toContain('data-plan-running="plan-poo-sit"');
    // a lead plan excluded with nothing else to choose: no card at all
    expect(section({ visibility: null, planRows: rows, surface: "today", excludePlanId: "plan-poo-sit.c1" })).toBe("");
  });

  it("the owner's plate painter never renders on a family surface, whatever the table says (it lives under Settings › Owner tools)", () => {
    for (const vis of [{ ...OPEN, admin: true }, { ...OPEN, admin: false }]) {
      const h = section({ visibility: vis, initialChooserOpen: true, planRows: [docAt(APPROVED)] });
      expect(h).not.toContain("data-plan-plates");
      expect(visible(h)).not.toMatch(OWNER_WORDS);
    }
    expect(src("PlansSection.tsx")).not.toContain("PlanPlatePainter");
    const settings = src("../layout/SettingsModal.tsx");
    expect(settings).toContain("planVisibility?.admin === true && (");
    expect(settings).toContain('import OwnerTools from "../plans/OwnerTools";');
    expect(settings).toMatch(/planVisibility\?\.admin === true && \([\s\S]{0,400}<OwnerTools lang=/);
    expect(src("OwnerTools.tsx")).toContain("<PlanPlatePainter");
  });

  it("Hebrew: the card is RTL, the door's headline is the pattern's Hebrew title and the lines are Hebrew", () => {
    state.lang = "he";
    try {
      const h = section({ visibility: OPEN, initialChooserOpen: true, planRows: [docAt(APPROVED, { id: "plan-sleep-alone.c1", bookId: "plan-sleep-alone.c1", pattern: "plan-sleep-alone", stepMenuIds: ["four-steps", "sit-further", "morning-check-in"] })] });
      expect(h).toContain('dir="rtl"');
      expect(h).toContain(def.title.he);
      expect(h).toContain(def.parentWords.he);
      expect(visible(h)).toContain("משהו קשה עכשיו?");
      expect(visible(h)).toContain("תוכנית לNoa");
      expect(visible(h)).toContain("לילה 7 מתוך 14");
      expect(visible(h)).not.toMatch(/Night|Tonight|tries/);
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
  const composer = (initialState?: ComposerState, extra: Partial<React.ComponentProps<typeof PlanComposer>> = {}) => html(<PlanComposer def={def} child={NOA} onSaved={noop} onClose={noop} initialState={initialState} {...extra} />);

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

  it("S1 4(b): the auto-paint line shows for an OWNER while the plates paint, with the count; a family never sees it, even mid-paint", () => {
    const painting = { painting: true, done: 3, total: 8 };
    const owner = composer(undefined, { ownerPaint: true, initialPaint: painting });
    expect(owner).toContain('data-plan-painting="3"');
    expect(visible(owner)).toContain("Painting the pictures… 3 of 8");
    expect(owner).not.toMatch(/<button[^>]*data-plan-plates/); // zero buttons on the normal path
    const family = composer(undefined, { initialPaint: painting });
    expect(family).not.toContain("data-plan-painting");
    expect(visible(family)).not.toContain("Painting the pictures");
    const idle = composer(undefined, { ownerPaint: true, initialPaint: { painting: false, done: 8, total: 8 } });
    expect(idle).not.toContain("data-plan-painting");
    // the hook is gated by the flag: a family's composer never reaches the routes
    expect(src("PlanComposer.tsx")).toContain("useAutoPaint(def.id, ownerPaint, initialPaint)");
    expect(src("../../lib/plans/useAutoPaint.ts")).toContain("if (!enabled) return;");
    expect(src("../journal/JournalShelves.tsx")).toContain("ownerPaint={planVisibility?.admin === true}");
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
