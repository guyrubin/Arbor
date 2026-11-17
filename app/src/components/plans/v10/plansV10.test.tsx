/**
 * v10.1 Now › Plans — the new pieces render from data alone (synthetic rows,
 * no server, no model call): the Challenge plan page and list, the plan
 * picker, the deep-link address, the road geometry, and the copy module.
 * Firewall: counts only — no percentage, score or verdict reaches the text.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The composer reads the reader's language from context; these renders are English.
vi.mock("../../../context/LanguageContext", async () => {
  const { translate } = await import("../../../lib/i18n");
  return { useLanguage: () => ({ uiLang: "en", aiLang: "en", t: (k: string, v?: Record<string, string | number>) => translate("en", k, v) }) };
});
import { ChallengeScreen, type ChallengeScreenProps } from "./ChallengeScreen";
import { PlanPicker } from "./PlanPicker";
import { PLANS_COPY } from "./plansCopy";
import { mirrorPoints, wavePoints } from "./Road";
import { challengePlanHref, readChallengeQuery } from "../../../lib/plans/challengeLinks";
import { authoredPatterns, getPattern } from "../../../lib/library/plans/planBooks";
import { activePlans } from "../../../lib/plans/planWeek";
import { PLAN_STRINGS, planString } from "../../../lib/plans/planStrings";
import type { PlanBookDoc } from "../../../lib/library/plans/planBookDoc";
import type { ActionPlan } from "../../../types";

const NOW = new Date(2026, 10, 16, 18, 0, 0);
const dropoff = getPattern("plan-dropoff")!;
const row = (over: Partial<PlanBookDoc> = {}): PlanBookDoc => ({
  id: "plan-dropoff.c1", bookId: "plan-dropoff.c1", kind: "plan", pattern: "plan-dropoff", lang: "en",
  stepMenuIds: ["goodbye-ritual", "thing-from-home", "door-opens-again"], minutes: 3, time: "morning",
  boxItemIds: [dropoff.boxItems[0].id], durationDays: 14,
  approvedAt: new Date(2026, 10, 8, 19, 0, 0).toISOString(), approvedBy: "p",
  createdAt: new Date(2026, 10, 8, 18, 0, 0).toISOString(), updatedAt: "t", status: "active",
  nights: ["2026-11-08", "2026-11-09", "2026-11-11"], ...over,
});
const noop = () => {};
const screen = (over: Partial<ChallengeScreenProps> = {}) => renderToStaticMarkup(
  <ChallengeScreen lang="en" composition="desk" childName="Noa" gender="f" planRows={[row()]} composable={authoredPatterns()} now={NOW} focus={null}
    onFocus={noop} onStart={noop} onOpenBook={noop} onChange={noop} onPrint={noop} onKeep={noop} onClose={noop} onNight={noop} onUndoNight={noop} onJournal={noop} {...over} />,
);
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

describe("Challenge Plans page (N-Challenge)", () => {
  it("a running plan leads: its book title is the one <h1>, the night count, the journey, the three steps", () => {
    const html = screen();
    expect((html.match(/<h1[ >]/g) ?? []).length).toBe(1);
    expect(html).toMatch(/<h1 class="hero" dir="auto"[^>]*>The door opens again<\/h1>/);
    expect(text(html)).toContain("Night");
    expect(html).toContain("<b>9</b>");
    expect(html).toContain('data-plan-running="plan-dropoff"');
    for (const stop of Object.values(PLANS_COPY.en.stops)) expect(text(html)).toContain(stop);
    expect((html.match(/<li class="cp-st">/g) ?? []).length).toBe(3);
    // Every action the old card had: open, print, change, close; the night question.
    for (const a of ["data-plan-open", "data-plan-print", "data-plan-change", "data-plan-close", "data-plan-night-yes", "data-plan-night-no"]) expect(html).toContain(a);
  });

  it("nights are counts of what the parent confirmed; an unanswered night is unknown (dashed), never a miss", () => {
    const html = screen();
    // V77: the count is the nights tile's figure (said once; the stage no longer repeats it).
    expect(text(html)).toMatch(/\b3\s+nights you answered yes/);
    expect((text(html).match(/nights you answered yes/g) ?? []).length).toBe(1);
    expect(html).toContain("tok plan md none");
    // Fidelity audit: the legend reads as N-Challenge-D words it ("no answer: unknown, not a miss").
    expect(text(html)).toContain(PLANS_COPY.en.noAnswerLegend);
    expect(PLANS_COPY.en.noAnswerLegend).toBe("no answer: unknown, not a miss");
    expect(text(html.replace(/ style="[^"]*"/g, ""))).not.toMatch(/\d\s*%|missed|score|streak/i);
  });

  it("tonight already confirmed: the done line, Undo and the explicit journal door", () => {
    const html = screen({ planRows: [row({ nights: ["2026-11-16"] })] });
    expect(html).toContain("data-plan-night-done");
    expect(html).toContain("data-plan-night-undo");
    expect(html).toContain("data-plan-night-journal");
    expect(html).not.toContain("data-plan-night-yes");
  });

  it("past its duration: the keep / change / close review", () => {
    const html = screen({ planRows: [row({ approvedAt: new Date(2026, 9, 20, 19).toISOString() })] });
    expect(html).toContain("data-plan-review");
    expect(html).toContain("data-plan-keep");
  });

  it("with nothing running: the list only, every composable pattern offered once (dark patterns are not)", () => {
    const composable = authoredPatterns().filter((d) => d.id !== "plan-new-food");
    const html = screen({ planRows: [], composable });
    // No stage without a running plan, so the list's title is the screen's one h1.
    expect(html.match(/<h1\b/g) ?? []).toHaveLength(1);
    expect(html).toContain(`<h1 class="h3">${planString("section.hard", "en")}</h1>`);
    expect(text(html)).toContain(PLANS_COPY.en.noRunning);
    const doors = [...html.matchAll(/data-plan-door="([a-z-]+)"/g)].map((m) => m[1]);
    expect(doors).toEqual(composable.map((d) => d.id));
    expect(doors).not.toContain("plan-new-food");
  });

  it("Hebrew: the Hebrew book title, the renamed label, and the road starts on the right", () => {
    const html = screen({ lang: "he", planRows: [row({ lang: "he" })] });
    expect(html).toContain(dropoff.title.he);
    expect(text(html)).toContain(PLANS_COPY.he.challengePlan);
    const firstStop = html.match(/class="at tok plan[^"]*" style="left:([\d.]+)%/);
    expect(Number(firstStop?.[1])).toBeGreaterThan(50);
  });

  it("phone: N-Challenge-M's sections in its order (plan, steps, nights, all), one tree", () => {
    const html = screen({ composition: "phone" });
    // N-Challenge-M: the night question shares the stage's card; no Today rail and no "on one page" snap.
    expect(html).not.toContain('id="cp-today"');
    expect(html).not.toContain('id="cp-page"');
    expect((html.match(/data-plan-step-card=/g) ?? []).length).toBe(3);
    const order = ["cp-stage", "cp-steps", "cp-nights", "cp-all"].map((id) => html.indexOf(`id="${id}"`));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect((html.match(/data-plan-open=""/g) ?? []).length).toBe(1);
  });
});

describe("the plan picker (V77: your plans as tabs)", () => {
  const plan: ActionPlan = {
    id: "p1", title: "Calmer mornings", issue: "Leaving the house", scripts: [],
    phases: [{ name: "One", steps: [{ text: "a", status: "done" }, { text: "b" }] }],
  } as unknown as ActionPlan;
  const pick = (over: Partial<React.ComponentProps<typeof PlanPicker>> = {}) => renderToStaticMarkup(
    <PlanPicker actionPlans={[plan]} selectedId="p1" challenges={activePlans([row()], NOW)} lang="en" composition="desk" onSelect={noop} onOpenChallenge={noop} {...over} />,
  );
  it("one tab per plan: the action plan by its title, the Challenge plan by its night (book title in its label), counts only", () => {
    const html = pick();
    expect(html).toContain("Calmer mornings");
    expect(html).toContain('aria-label="Open The door opens again"');
    expect(text(html)).toContain("Night 9 of 14");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('href="#/plans?challenge=plan-dropoff"');
    expect(text(html)).not.toMatch(/\d\s*%/);
  });
  it("each plan is drawn once: no step count and no step text on the tab (the stage says them)", () => {
    const html = pick();
    expect(text(html)).not.toMatch(/steps done|of \d+ steps/);
    // negative control: the pre-V77 card carried the count beside the title
    expect("3 of 7 steps done").toMatch(/of \d+ steps/);
  });
  it("with no Challenge plan running, one tab opens the Challenge Plans list", () => {
    const html = pick({ challenges: [], challengeCount: 8, onAllChallenges: noop });
    expect(html).toContain('data-plan-pick="challenge-all"');
    expect(html).toContain('href="#/plans?challenge=all"');
    expect(pick({ challenges: [] })).not.toContain("challenge-all");
  });
});

describe("the Challenge Plans address", () => {
  it("reads and writes #/plans?challenge=…", () => {
    expect(challengePlanHref()).toBe("#/plans?challenge=all");
    expect(challengePlanHref("plan-dropoff")).toBe("#/plans?challenge=plan-dropoff");
    expect(challengePlanHref("plan-dropoff", { compose: true })).toBe("#/plans?challenge=plan-dropoff&compose=1");
    expect(readChallengeQuery(new URLSearchParams(""))).toEqual({ kind: "none" });
    expect(readChallengeQuery(new URLSearchParams("challenge=choose"))).toEqual({ kind: "all" });
    expect(readChallengeQuery(new URLSearchParams("challenge=plan-sleep-alone&compose=1"))).toEqual({ kind: "pattern", pattern: "plan-sleep-alone", compose: true, print: false });
    expect(readChallengeQuery(new URLSearchParams("challenge=plan-dropoff&printout=1"))).toMatchObject({ print: true });
    expect(challengePlanHref("plan-dropoff", { print: true })).toBe("#/plans?challenge=plan-dropoff&printout=1");
    expect(readChallengeQuery(new URLSearchParams("challenge=not-a-plan"))).toEqual({ kind: "all" });
  });
});

describe("road geometry and copy", () => {
  it("mirrors for a right-to-left reader", () => {
    const pts = wavePoints(5);
    expect(pts[0].x).toBeLessThan(pts[4].x);
    const m = mirrorPoints(pts, true);
    expect(m[0].x).toBeGreaterThan(m[4].x);
    expect(mirrorPoints(pts, false)).toBe(pts);
  });
  it("EN and HE copy have the same keys; the rename is in both languages", () => {
    expect(Object.keys(PLANS_COPY.he).sort()).toEqual(Object.keys(PLANS_COPY.en).sort());
    expect(PLAN_STRINGS.en["section.title"]).toBe("Challenge Plans");
    expect(PLAN_STRINGS.he["section.title"]).toBe("תוכניות אתגר");
    expect(JSON.stringify(PLAN_STRINGS)).not.toMatch(/Everyday plan|ליום-יום/);
  });
});

describe("CP-6 parent copy preview", async () => {
  const { PrintPreview } = await import("./PrintPreview");
  it("shows the page that will print, words only, in a frame that runs no script", () => {
    const html = renderToStaticMarkup(<PrintPreview input={{ doc: row(), child: { id: "c1", name: "Noa" } as never, lang: "en", now: NOW }} childName="Noa" lang="en" onPrint={noop} />);
    expect(html).toContain("data-plan-print-preview");
    expect(html).toMatch(/<iframe[^>]*sandbox=""/);
    expect(html).not.toMatch(/&lt;script|<script/);
    expect(html).toContain("data-plan-print-go");
    expect(text(html)).toContain("Print Noa's plan");
  });
});

describe("the composer on the journey road (CP-1 to CP-3)", async () => {
  const { default: PlanComposer } = await import("../PlanComposer");
  const { composerReducer, initialComposer } = await import("../../../lib/plans/composer");
  type Action = Parameters<typeof composerReducer>[2];
  const run = (...a: Action[]) => a.reduce((s, x) => composerReducer(dropoff, s, x), initialComposer(dropoff, "en"));
  const render = (state?: ReturnType<typeof run>) => renderToStaticMarkup(
    <PlanComposer def={dropoff} child={{ id: "c1", name: "Noa", gender: "female" } as never} onSaved={noop} onClose={noop} initialState={state} />,
  );
  it("Recognise: the typographic cover, the stop counter, the red lines first", () => {
    const door = render();
    expect(door).toContain('class="cp-book"');
    expect(text(door)).toContain("1 of 5 · Recognise");
    expect((door.match(/<h1[ >]/g) ?? []).length).toBe(1);
    const red = render(run({ type: "open" }));
    for (const w of dropoff.watchFor) expect(red).toContain(`data-plan-redline="${w.id}"`);
  });
  it("Agree: each step shows what the parent does (time filled in) beside the child's line", () => {
    const steps = render(run({ type: "open" }, { type: "redLinesDone" }));
    expect(text(steps)).toContain("2 of 5 · Agree");
    expect(steps).not.toMatch(/\{time\}|\{minutes\}/);
    expect((steps.match(/class="cp-kid"/g) ?? []).length).toBe(3);
    // CP-2: the first step's words open ("Noa hears, exactly"); the others fold to "Noa hears".
    expect(text(steps)).toContain("Noa hears, exactly");
    expect((steps.match(/<details class="cp-kidd/g) ?? []).length).toBe(2);
  });
  it("Agree: the box and the duration are real toggles", () => {
    const box = render(run({ type: "open" }, { type: "redLinesDone" }, { type: "stepsDone" }));
    expect(box).toContain('data-plan-duration-pick="21"');
    expect(box).toMatch(/aria-checked="true"[^>]*data-plan-duration-pick="14"/);
  });
});
