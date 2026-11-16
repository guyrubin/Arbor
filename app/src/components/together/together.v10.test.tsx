import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChainStrip } from "./ChainStrip";
import { routineStepsThisWeek } from "./routinesWeek";
import { routineFace } from "./routineArt";
import { TOGETHER_COPY } from "./togetherCopy";
import { togetherFilterRoute } from "../companion/TogetherView";
import type { ActionPlan } from "../../types";

/* Design system v10.1 — Together's shared pieces: the chain strip, the week
   count, the routine faces, the old filter addresses and the copy module. */

const plan = (id: string, steps: number, runs: Record<string, number[]>): ActionPlan =>
  ({ id, phases: [{ steps: Array.from({ length: steps }, (_, i) => ({ id: `s${i}`, text: `step ${i}` })) }], routineRuns: runs } as unknown as ActionPlan);

describe("routineStepsThisWeek — counts what a parent ticked, never a share", () => {
  const now = new Date(2026, 10, 16, 17, 40);
  it("sums distinct ticked steps over the last seven local days and names those days", () => {
    const plans = [
      plan("plan-routine-bedtime-1763300000000", 4, { "2026-11-14": [0, 1], "2026-11-15": [0, 0, 2], "2026-11-01": [0, 1, 2] }),
      plan("plan-routine-morning-1763300000001", 5, { "2026-11-16": [4, 9] }),
    ];
    const week = routineStepsThisWeek(plans, now);
    // 2 (Sat) + 2 distinct (Sun) + 1 in range (Mon); 1 Nov is outside the week, index 9 is out of range.
    expect(week.steps).toBe(5);
    expect(week.days.map((d) => d.getDate())).toEqual([14, 15, 16]);
  });
  it("ignores plans that are not routine plans and is zero for a new family", () => {
    expect(routineStepsThisWeek([plan("plan-other-1", 3, { "2026-11-16": [0, 1] })], now)).toEqual({ steps: 0, days: [] });
    expect(routineStepsThisWeek([], now)).toEqual({ steps: 0, days: [] });
  });
});

describe("ChainStrip — real nodes only", () => {
  it("renders nothing with fewer than two nodes (the strip never invents a link)", () => {
    expect(renderToStaticMarkup(<ChainStrip composition="desk" label="x" nodes={[{ kind: "you", tag: "You", text: "one" }]} />)).toBe("");
  });
  it("draws one arrow between nodes and marks Arbor's node with the pencil", () => {
    const html = renderToStaticMarkup(<ChainStrip composition="desk" label="From your choice" nodes={[
      { kind: "you", tag: "Your focus", text: "Mornings" },
      { kind: "arbor", tag: "Arbor suggests", text: "Superhero rescue team" },
      { kind: "back", tag: "In your week", text: "3 routine steps ticked" },
    ]} />);
    expect(html).toContain('aria-label="From your choice"');
    expect(html.match(/class="chn-a"/g)).toHaveLength(2);
    expect(html).toContain('data-chain="arbor"');
    expect(html).not.toMatch(/%|score|level/i);
  });
  it("on a phone the last 'back' node takes its own row (no arrow into it)", () => {
    const html = renderToStaticMarkup(<ChainStrip composition="phone" label="x" nodes={[
      { kind: "you", tag: "a", text: "a" },
      { kind: "arbor", tag: "b", text: "b" },
      { kind: "back", tag: "c", text: "c" },
    ]} />);
    expect(html).toContain('class="chn m"');
    expect(html.match(/class="chn-a"/g)).toHaveLength(1);
  });
});

describe("old Together filter addresses land on the right pill", () => {
  it("games and offscreen open Play, stories opens Stories, routines and none stay", () => {
    expect(togetherFilterRoute("games")).toBe("daily-play");
    expect(togetherFilterRoute("offscreen")).toBe("daily-play");
    expect(togetherFilterRoute("stories")).toBe("stories");
    expect(togetherFilterRoute("routines")).toBeNull();
    expect(togetherFilterRoute("all")).toBeNull();
    expect(togetherFilterRoute(null)).toBeNull();
  });
});

describe("routine faces and copy", () => {
  it("scales the board's 40 px crop to the face size", () => {
    const small = routineFace("bedtime", 40);
    const big = routineFace("bedtime", 80);
    expect(big.width).toBeCloseTo(small.width * 2, 0);
    expect(big.crop.w).toBeCloseTo(small.crop.w * 2, 0);
    expect(routineFace("unknown-routine", 40).src).toMatch(/together-480/);
  });
  it("every copy key exists in both languages, Hebrew differs from English", () => {
    const en = TOGETHER_COPY.en as Record<string, unknown>;
    const he = TOGETHER_COPY.he as Record<string, unknown>;
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en)) {
      const a = en[key]; const b = he[key];
      const ea = typeof a === "function" ? (a as (...x: unknown[]) => string)("Dylan", "Dylan") : a;
      const eb = typeof b === "function" ? (b as (...x: unknown[]) => string)("Dylan", "Dylan") : b;
      if (key !== "arborSuggests") expect(eb, key).not.toBe(ea);
    }
    expect(TOGETHER_COPY.en.doneSteps(1)).toBe("1 routine step ticked");
    expect(TOGETHER_COPY.en.bandCount(3)).toBe("3 routines");
  });
  it("new parent copy avoids AI wording and price words", () => {
    const all = JSON.stringify(Object.values(TOGETHER_COPY.en).map((v) => (typeof v === "function" ? (v as (...x: unknown[]) => string)("Dylan", "Dylan") : v)));
    expect(all).not.toMatch(/\bAI\b|subscription|price/i);
  });
});
