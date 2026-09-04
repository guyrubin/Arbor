/* GP-07 / GP-10 / GP-34 — the Growth hub, from the parent's side.
 *
 *  GP-07 · The deep-dive door labelled "the month-by-month development
 *          timeline" pointed at `journey` — the PRACTICE hub, whose first tile
 *          is a numeric "practice consistency score". A parent tapping a
 *          timeline from the calm hub landed on a score.
 *  GP-07 · Noticing a milestone moved a COUNTER and nothing else. The hub's
 *          "recently" list carried moments and play but never the one act the
 *          surface exists for.
 *  GP-10 · `observationUpdatedAt` was written on every mark and never rendered.
 *  GP-34 · The thing the parent chose to watch for after a check now IS the
 *          weekly focus, and can be unchosen.
 *
 * Renders the REAL DevelopmentTab (static markup, node env) with the app
 * contexts and the heavy child surfaces stubbed.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { watchFocusKey } from "../../lib/screeningWatch";
import type { Milestone } from "../../types";

const ms = (over: Partial<Milestone> & Pick<Milestone, "id">): Milestone => ({
  domain: "language_communication", title: `title-${over.id}`, description: "d",
  checked: false, ageMonths: 18, ...over,
} as Milestone);

const state = {
  childProfile: { id: "c1", name: "Noa Levi", age: 1, birthDate: "2025-03-01", ageMonths: 18 },
  milestones: [] as Milestone[],
  behaviorLogs: [] as unknown[],
  playLogs: [] as unknown[],
  setActiveTab: vi.fn(),
};

vi.mock("../../context/ArborContext", () => ({ useArbor: () => state }));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ t: (k: string, v?: Record<string, unknown>) => (v ? `${k}|${Object.values(v).join("|")}` : k), uiLang: "en" }),
}));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: [], upsert: vi.fn(), loading: false }) }));
// Heavy sibling surfaces are not what this test is about.
vi.mock("../sections/DevScoreCard", () => ({ default: () => null }));
vi.mock("../sections/PhysicalGrowthCard", () => ({ default: () => null }));
vi.mock("../sections/ScreeningSheet", () => ({ default: () => null }));
vi.mock("../ui/SpineRibbon", () => ({ SpineRibbon: () => null }));
vi.mock("../ui/EvidenceChip", () => ({ EvidenceChip: () => null }));
vi.mock("../ui/HubHero", () => ({ HubHero: () => null }));

function installStorage() {
  const map = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    get length() { return map.size; },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
  } as Storage);
}

const render = async () => {
  const { default: DevelopmentTab } = await import("./DevelopmentTab");
  return renderToStaticMarkup(React.createElement(DevelopmentTab));
};

beforeEach(() => {
  installStorage();
  state.milestones = [];
  state.behaviorLogs = [];
  state.playLogs = [];
});

describe("GP-07 — the timeline door", () => {
  it("opens the Story timeline, and no longer the Practice hub's score tile", async () => {
    const html = await render();
    expect(html).toContain("Month by month, everything you have kept");
    // The old label came from `hub.journey` + elev.growth.link.journey.sub.
    expect(html).not.toContain("hub.journey");
    expect(html).not.toContain("elev.growth.link.journey.sub");
  });

  it("the door list is milestones + timeline only", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(new URL("./DevelopmentTab.tsx", import.meta.url), "utf8");
    const doors = src.slice(src.indexOf("Deep-dive doors"), src.indexOf("Deep-dive doors") + 1600);
    expect(doors).toContain('tab: "timeline"');
    expect(doors).not.toContain('tab: "journey"');
    // NEGATIVE CONTROL: the pre-change entry would fail both.
    const before = '{ tab: "journey", glyph: "calendar_month", label: t("hub.journey") }';
    expect(before).toContain('tab: "journey"');
  });
});

describe("GP-07 / GP-10 — noticing a milestone leaves a visible, dated trace", () => {
  it("a noticed milestone appears in the hub's recent list, with the date it was noticed", async () => {
    state.milestones = [ms({ id: "m1", title: "First two-word phrase", checked: true, observationUpdatedAt: "2026-08-14T10:00:00.000Z" })];
    const html = await render();
    expect(html).toContain("First two-word phrase");
    expect(html).toContain("Noticed Aug 14, 2026");
    // The empty state is gone precisely because the record grew.
    expect(html).not.toContain("growth.recent.empty");
  });

  it("NEGATIVE CONTROL: an unmarked milestone leaves no trace, and an undated mark is not invented", async () => {
    state.milestones = [ms({ id: "m1", title: "First two-word phrase" })];
    expect(await render()).toContain("growth.recent.empty");

    // checked but never dated (legacy rows): it must not fabricate a date.
    state.milestones = [ms({ id: "m1", title: "First two-word phrase", checked: true })];
    const html = await render();
    expect(html).not.toContain("Noticed Invalid");
    expect(html).not.toContain("NaN");
  });
});

describe("GP-34 — the parent's chosen watch item becomes the weekly focus", () => {
  it("the focus card shows the chosen milestone, says the parent chose it, and offers a way out", async () => {
    state.milestones = [
      ms({ id: "auto", title: "Derived pick", ageMonths: 18 }),
      ms({ id: "chosen", title: "Points to show you something", ageMonths: 18 }),
    ];
    localStorage.setItem(watchFocusKey("c1"), JSON.stringify({ milestoneId: "chosen", screenItemId: "b12-soc1", chosenAt: "x" }));
    const html = await render();
    expect(html).toContain("Points to show you something");
    expect(html).toContain("You chose to watch this");
    expect(html).toContain('data-testid="growth-focus-unwatch"');
  });

  it("NEGATIVE CONTROL: with no choice stored the derived focus wins and no unwatch control renders", async () => {
    state.milestones = [ms({ id: "auto", title: "Derived pick", ageMonths: 18 })];
    const html = await render();
    expect(html).toContain("Derived pick");
    expect(html).toContain("growth.focus.eyebrow");
    expect(html).not.toContain('data-testid="growth-focus-unwatch"');
  });

  it("a choice retires itself once the milestone is noticed", async () => {
    state.milestones = [
      ms({ id: "auto", title: "Derived pick", ageMonths: 18 }),
      ms({ id: "chosen", title: "Points to show you something", ageMonths: 18, checked: true, observationUpdatedAt: "2026-08-14T10:00:00.000Z" }),
    ];
    localStorage.setItem(watchFocusKey("c1"), JSON.stringify({ milestoneId: "chosen", screenItemId: "b12-soc1", chosenAt: "x" }));
    const html = await render();
    expect(html).not.toContain("You chose to watch this");
    expect(html).toContain("Derived pick");
  });
});
