/**
 * v10.1 Now › Plans — the new pieces render from data alone (synthetic rows,
 * no server, no model call): the Challenge plan page and list, the plan
 * picker, the deep-link address, the road geometry, and the copy module.
 * Firewall: counts only — no percentage, score or verdict reaches the text.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChallengeScreen, type ChallengeScreenProps } from "./ChallengeScreen";
import { PlanPicker } from "./PlanPicker";
import { PLANS_COPY } from "./plansCopy";
import { mirrorPoints, wavePoints } from "./Road";
import { challengePlanHref, readChallengeQuery } from "../../../lib/plans/challengeLinks";
import { authoredPatterns, getPattern } from "../../../lib/library/plans/planBooks";
import { activePlans } from "../../../lib/plans/planWeek";
import { PLAN_STRINGS } from "../../../lib/plans/planStrings";
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
const text = (html: string) => html.replace(/<[^>]+>/g, " ");

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
    expect(text(html)).toContain("3 nights confirmed");
    expect(html).toContain("tok plan md none");
    expect(text(html)).toContain("No answer");
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
    expect(html).not.toContain("<h1");
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

  it("phone: the same sections in the same order, one tree", () => {
    const html = screen({ composition: "phone" });
    const order = ["cp-stage", "cp-today", "cp-page", "cp-all"].map((id) => html.indexOf(`id="${id}"`));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect((html.match(/data-plan-open=""/g) ?? []).length).toBe(1);
  });
});

describe("the plan picker", () => {
  const plan: ActionPlan = {
    id: "p1", title: "Calmer mornings", issue: "Leaving the house", scripts: [],
    phases: [{ name: "One", steps: [{ text: "a", status: "done" }, { text: "b" }] }],
  } as unknown as ActionPlan;
  it("names the action plan by its title and the Challenge plan by its book title, counts only", () => {
    const running = activePlans([row()], NOW);
    const html = renderToStaticMarkup(
      <PlanPicker actionPlans={[plan]} selectedId="p1" todaySteps={{ p1: "b" }} challenges={running} lang="en" composition="desk" onSelect={noop} onOpenChallenge={noop} />,
    );
    expect(html).toContain("Calmer mornings");
    expect(html).toContain("The door opens again");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('href="#/plans?challenge=plan-dropoff"');
    expect(text(html)).not.toMatch(/\d\s*%/);
  });
});

describe("the Challenge Plans address", () => {
  it("reads and writes #/plans?challenge=…", () => {
    expect(challengePlanHref()).toBe("#/plans?challenge=all");
    expect(challengePlanHref("plan-dropoff")).toBe("#/plans?challenge=plan-dropoff");
    expect(challengePlanHref("plan-dropoff", { compose: true })).toBe("#/plans?challenge=plan-dropoff&compose=1");
    expect(readChallengeQuery(new URLSearchParams(""))).toEqual({ kind: "none" });
    expect(readChallengeQuery(new URLSearchParams("challenge=choose"))).toEqual({ kind: "all" });
    expect(readChallengeQuery(new URLSearchParams("challenge=plan-sleep-alone&compose=1"))).toEqual({ kind: "pattern", pattern: "plan-sleep-alone", compose: true });
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
