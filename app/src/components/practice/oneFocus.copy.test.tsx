import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { translate } from "../../lib/i18n";
import { goalTileById, type ActiveGoal } from "../../practice/goalBuilder";

const h = vi.hoisted(() => ({ lang: "en" as "en" | "he", goals: [] as ActiveGoal[], setActiveTab: vi.fn(), buttons: [] as any[] }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "parent-a", displayName: "Parent" } }) }));
vi.mock("../../context/ProfileContext", () => ({ useProfile: () => ({ profiles: [{ id: "child-a" }] }) }));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  childProfile: { id: "child-a", name: "Noa", age: 4, birthDate: "2022-01-01", strengths: [], interests: [], languages: [], challenges: [], activeGoals: h.goals },
  milestones: [], behaviorLogs: [], approvedMemoryItems: [], pendingMemoryItems: [], playLogs: [], actionLoop: [],
  actionPlans: [{ id: "plan-a", title: "A small plan", issue: "Mornings together", phases: [{ name: "A small step", description: "Try it together", steps: [{ text: "Put a cup on the table", completed: false }] }], scripts: [], successIndicators: [] }],
  plansLoaded: true, planChallengeTopic: "", isPlanGenerating: false, activeTodayAction: null,
  setActiveTab: h.setActiveTab, updateChild: vi.fn(), setPlanChallengeTopic: vi.fn(), seedCoach: vi.fn(), openCaptureSheet: vi.fn(), requestJournalFocus: vi.fn(),
}), useArborOptional: () => null }));
vi.mock("../../hooks/useObservationRecord", () => ({ useObservationRecord: () => ({ observations: [], sources: { behaviorLogs: [] }, loading: false, error: false, more: false, confirmed: true }) }));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: [], loaded: true, error: false, remote: false, upsert: vi.fn(), remove: vi.fn() }) }));
vi.mock("../../lib/api", () => ({ api: { listShares: () => Promise.resolve({ shares: [] }) } }));
vi.mock("../ui/HeroAvatar", () => ({ HeroAvatar: () => null, useHeroAvatar: () => ({ hasHero: true, name: "Noa" }) }));
vi.mock("../profile/ProfileEditDrawer", () => ({ default: () => null }));
vi.mock("../ui/Modal", () => ({ Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? children : null }));
vi.mock("motion/react", () => ({ AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy({}, { get: (_, tag: string) => ({ children, initial, animate, exit, transition, ...props }: any) => React.createElement(tag, props, children) }) }));
const capture = (type: unknown, props: any) => { if (type === "button") h.buttons.push(props); };
vi.mock("react/jsx-runtime", async original => { const r = await original<typeof import("react/jsx-runtime")>(); return { ...r, jsx: (...args: Parameters<typeof r.jsx>) => { capture(args[0], args[1]); return r.jsx(...args); }, jsxs: (...args: Parameters<typeof r.jsxs>) => { capture(args[0], args[1]); return r.jsxs(...args); } }; });
vi.mock("react/jsx-dev-runtime", async original => { const r = await original<typeof import("react/jsx-dev-runtime")>(); return { ...r, jsxDEV: (...args: Parameters<typeof r.jsxDEV>) => { capture(args[0], args[1]); return r.jsxDEV(...args); } }; });

import ChildProfile from "../sections/ChildProfile";
import ChildPortrait from "../companion/ChildPortrait";
import DailyPlayTab from "../tabs/DailyPlayTab";
import PlansTab from "../tabs/PlansTab";
const fixture = (): ActiveGoal[] => ["transitions", "taking-turns", "early-talking"].map((goalId, i) => {
  const tile = goalTileById(goalId)!;
  return { goalId, label: tile.label, domainId: tile.domainId, addedAt: `2026-10-0${i + 1}T00:00:00Z` };
});
const visibleText = (html: string) => html.replace(/<span class="msr\b[^>]*>[^<]*<\/span>/g, " ").replace(/<[^>]*>/g, " ").replaceAll("&#x27;", "'");
beforeEach(() => { h.lang = "en"; h.goals = fixture(); h.buttons = []; vi.clearAllMocks(); vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() }); });
afterEach(() => vi.unstubAllGlobals());

for (const lang of ["en", "he"] as const) describe(`Current Parent routes · ${lang}`, () => {
  beforeEach(() => { h.lang = lang; });
  it.each([["profile", ChildProfile, "profile-goals-edit"], ["daily-play", DailyPlayTab, "daily-play-goals-edit"], ["development", ChildPortrait, "portrait-goals-edit"]] as const)("%s renders one newest-goal line from a stored three-goal profile", (_, Component, id) => {
    const html = renderToStaticMarkup(<Component />);
    const line = html.match(new RegExp(`<button[^>]*data-testid="${id}"[\\s\\S]*?</button>`))?.[0];
    expect(line).toBeTruthy();
    expect(visibleText(line!)).toContain(translate(lang, "elev.goal.tile.early-talking"));
    for (const old of ["transitions", "taking-turns"]) expect(visibleText(line!)).not.toContain(translate(lang, `elev.goal.tile.${old}`));
    expect(h.goals).toEqual(fixture());
    expect(visibleText(html)).not.toMatch(/\bfocus(?:es)?\b|מיקוד/i);
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
  });
  it.each([["profile", ChildProfile], ["daily-play", DailyPlayTab], ["development", ChildPortrait]] as const)("%s keeps the empty-goal invitation optional and uses the same plain words", (_, Component) => {
    h.goals = [];
    const html = renderToStaticMarkup(<Component />);
    expect(visibleText(html)).toContain(translate(lang, "elev.goal.profile.empty"));
    expect(visibleText(html)).not.toMatch(/\bfocus(?:es)?\b|מיקוד/i);
  });
  it("Profile's only goal door opens the current child page", () => {
    renderToStaticMarkup(<ChildProfile />);
    const door = h.buttons.find(button => button["data-testid"] === "profile-goals-edit");
    expect(door).toBeDefined(); door.onClick(); expect(h.setActiveTab).toHaveBeenCalledWith("development");
  });
  it.each([["profile", ChildProfile], ["daily-play", DailyPlayTab], ["development", ChildPortrait], ["plans", PlansTab]] as const)("%s has no second focus vocabulary in the current rendered main", (_, Component) => {
    const html = renderToStaticMarkup(<Component />);
    expect(visibleText(html)).not.toMatch(/\bfocus(?:es)?\b|מיקוד/i);
    expect(visibleText(html)).not.toMatch(/elev\.goal\.|companion\./);
  });
});

describe("current architecture boundaries", () => {
  it("the UI projection never truncates stored model context or enters the P5 arbiter", () => {
    const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
    expect(read("../../ai/prompts.ts")).not.toContain("focusGoal");
    for (const file of ["../companion/NowView.tsx", "../companion/useNowLoop.ts", "../../lib/practice/choosePractice.ts"]) expect(read(file)).not.toContain("focusGoal");
    expect(read("../tabs/DailyPlayTab.tsx")).toContain("activeGoals: displayGoals");
    for (const route of ["../tabs/DailyPlayTab.tsx", "../companion/ChildPortrait.tsx"]) {
      expect(read(route)).toContain("<GoalBuilderModal");
      expect(read(route)).not.toMatch(/updateChild\([^\n]*activeGoals/);
    }
    expect(read("./GoalBuilderModal.tsx")).toContain("getGoalSelection(childId)");
    expect(read("../../context/ProfileContext.tsx")).toContain("selectFocusGoal(state.goals, goal");
    expect(read("../companion/ChildPortrait.tsx")).toContain("<PortraitWatchRow key={childProfile.id}");
  });
});
