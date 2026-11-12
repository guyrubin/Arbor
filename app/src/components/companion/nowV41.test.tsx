/**
 * v4.1 Now — Right now and Arbor learned this week, rendered against a
 * synthetic family. Every state comes from the record; with nothing for this
 * part of the day the line is absent, and only this week's proposals are asked.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { routineTemplatesForAge, routineToPlan } from "../../lib/routineTemplates";
import type { MemoryReviewItem } from "../../types";

const harness = vi.hoisted(() => ({
  locale: "en" as "en" | "he",
  actionPlans: [] as unknown[],
  behaviorLogs: [] as unknown[],
  pending: [] as unknown[],
  hardDoor: true,
}));
vi.mock("../../context/ArborContext", () => ({
  useArborOptional: () => null,
  useArbor: () => ({
    childProfile: { id: "c1", name: "Noa Levi", gender: "girl", birthDate: "2022-03-01" },
    actionPlans: harness.actionPlans, behaviorLogs: harness.behaviorLogs, pendingMemoryItems: harness.pending,
    handleMemoryDecision: vi.fn(async () => true), isMemoryUpdating: null, openHardMomentNow: vi.fn(),
  }),
}));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ uiLang: harness.locale, aiLang: harness.locale, t: (k: string, v?: Record<string, string | number>) => translate(harness.locale, k, v) }),
}));
vi.mock("../../content/selectCards", () => ({ availableHardMomentCards: () => (harness.hardDoor ? [{ id: "card" }] : []) }));
vi.mock("../ui/HeroAvatar", () => ({ HeroAvatar: () => <span data-testid="hero" />, default: () => <span data-testid="hero" /> }));

import NowRightNow from "./NowRightNow";
import NowLearned, { learnedThisWeek } from "./NowLearned";
import { LEARNED_COPY, RIGHT_NOW_COPY } from "./nowV41Copy";

const at = (day: number, hour: number, minute: number) => new Date(2026, 10, day, hour, minute);
const render = (node: React.ReactElement) => renderToStaticMarkup(node);
const reset = () => { harness.locale = "en"; harness.actionPlans = []; harness.behaviorLogs = []; harness.pending = []; harness.hardDoor = true; };
const startRoutine = (id: string) => {
  const routine = routineTemplatesForAge(56).find((r) => r.id === id);
  if (!routine) throw new Error(`no ${id} routine at 56 months`);
  harness.actionPlans = [routineToPlan(routine, "en", "Noa", at(1, 9, 0).getTime())];
  return routine;
};

describe("Right now", () => {
  it("offers the started morning routine's next step in the morning", () => {
    reset();
    const routine = startRoutine("morning");
    const html = render(<NowRightNow now={at(12, 7, 30)} lang="en" visit={null} onTonight={null} />);
    expect(html).toContain('data-state="routine"');
    expect(html).toContain("Right now · 07:30");
    expect(html).toContain(`Next: ${routine.steps[0].label.en}`);
    expect(html).toContain("Start the routine");
  });

  it("names the window the parent's own hard moments fell in, before dinner", () => {
    reset();
    harness.behaviorLogs = [at(11, 16, 47), at(10, 17, 2), at(9, 17, 18), at(8, 9, 0)].map((d, i) => ({ id: `b${i}`, timestamp: d.toISOString(), intensity: 4 }));
    const html = render(<NowRightNow now={at(12, 16, 30)} lang="en" visit={null} onTonight={null} />);
    expect(html).toContain('data-state="hard"');
    expect(html).toContain("3 of the last 4 hard moments you kept fell between 16:45 and 17:20.");
    expect(html).toContain("Open the words");
    harness.hardDoor = false;
    expect(render(<NowRightNow now={at(12, 16, 30)} lang="en" visit={null} onTonight={null} />)).toBe("");
  });

  it("puts the visit at midday and tonight's questions in the evening, in Hebrew too", () => {
    reset();
    const visit = { head: "Speech therapist · Friday 14 Nov", sub: "Look over the page.", cta: "Look over the page", onOpen: () => {} };
    expect(render(<NowRightNow now={at(12, 13, 0)} lang="en" visit={visit} onTonight={null} />)).toContain("Speech therapist · Friday 14 Nov");
    harness.locale = "he";
    const html = render(<NowRightNow now={at(12, 20, 30)} lang="he" visit={visit} onTonight={() => {}} />);
    expect(html).toContain('data-state="tonight"');
    expect(html).toContain(RIGHT_NOW_COPY.he.tonightHead);
    expect(html).toContain("עכשיו · 20:30");
  });

  it("draws nothing when the record has nothing for this part of the day", () => {
    reset();
    expect(render(<NowRightNow now={at(12, 16, 30)} lang="en" visit={null} onTonight={null} />)).toBe("");
    startRoutine("morning");
    expect(render(<NowRightNow now={at(12, 20, 30)} lang="en" visit={null} onTonight={null} />)).toBe("");
  });
});

const proposal = (id: string, createdAt: string, status: "pending" | "approved" = "pending"): MemoryReviewItem => ({
  memoryId: id, childId: "c1", status, fact: `Fact ${id}`, source: "chat", retention: "90 days", createdAt, latestEventId: `e-${id}`,
});

describe("Arbor learned this week", () => {
  const now = at(12, 9, 0);

  it("asks only this week's waiting proposals, newest first, at most two on Now", () => {
    const items = [
      proposal("old", at(1, 9, 0).toISOString()),
      proposal("a", at(10, 9, 0).toISOString()),
      proposal("b", at(11, 9, 0).toISOString()),
      proposal("c", at(9, 9, 0).toISOString()),
      proposal("kept", at(11, 8, 0).toISOString(), "approved"),
      proposal("later", at(13, 9, 0).toISOString()),
    ];
    expect(learnedThisWeek(items, now.getTime()).map((m) => m.memoryId)).toEqual(["b", "a", "c"]);
    reset();
    harness.pending = items;
    const html = render(<NowLearned now={now} />);
    expect(html.match(/data-testid="now-learned-row"/g)).toHaveLength(2);
    expect(html).toContain("Fact b");
    expect(html).not.toContain("Fact old");
    expect(html).toContain("That&#x27;s right");
    expect(html).toContain("Not quite");
  });

  it("has no card when nothing waits this week", () => {
    reset();
    harness.pending = [proposal("old", at(1, 9, 0).toISOString())];
    expect(render(<NowLearned now={now} />)).toBe("");
  });
});

describe("v4.1 copy", () => {
  const keys = (o: object) => Object.keys(o).sort();
  it("says the same things in English and Hebrew", () => {
    expect(keys(RIGHT_NOW_COPY.he)).toEqual(keys(RIGHT_NOW_COPY.en));
    expect(keys(RIGHT_NOW_COPY.he.hardHead)).toEqual(["afternoon", "evening", "midday", "morning"]);
    expect(keys(LEARNED_COPY.he)).toEqual(keys(LEARNED_COPY.en));
    for (const value of [...Object.values(LEARNED_COPY.he), ...Object.values(RIGHT_NOW_COPY.he.hardHead), RIGHT_NOW_COPY.he.hardCta]) {
      expect(value).toMatch(/[֐-׿]/);
    }
  });
});

describe("v4.1 wiring", () => {
  const read = (rel: string) => readFileSync(path.resolve(__dirname, rel), "utf8");
  it("mounts Right now under the question row and the learned card under the plans", () => {
    const view = read("NowView.tsx");
    expect(view.indexOf("<NowRightNow")).toBeGreaterThan(view.indexOf("<NowQuestionRow"));
    expect(view.indexOf("<NowLearned")).toBeGreaterThan(view.indexOf("<PlansSection"));
  });
  it("lets Together open a routine by address and drops it on close", () => {
    const src = read("TogetherRoutines.tsx");
    expect(src).toContain('useHashQuery().get("routine")');
    expect(src).toContain('routeHash("practice", { f: "routines" })');
  });
});
