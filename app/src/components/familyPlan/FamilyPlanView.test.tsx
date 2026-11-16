/**
 * Family plan v1 — the screen, rendered (node, static markup) with synthetic
 * data and with none, in EN and HE, desk and phone. Pins: one h1; the four
 * sections in the same order on both compositions; figures with units and no
 * zero tiles; the week as a ribbon (V77: seven day tiles and the later
 * column, each date on its day; who has it in the dates rail); no "Sent is not accepted"
 * line exactly once; one primary move; nothing graded about the child.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { askAdult, createDate, takeIt, type FamilyPlanAdult, type FamilyPlanDate } from "../../lib/familyPlan/model";
import { datesInWindow, lanes, openRequests, planCounts, planWindow, reminders } from "../../lib/familyPlan/week";

const h = vi.hoisted(() => ({ lang: "en" as "en" | "he", composition: "desk" as "desk" | "phone", rows: [] as unknown[], loaded: true }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: "c1", name: "Alex Example" }, setActiveTab: () => {} }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ t: (k: string, v?: Record<string, string | number>) => translate(h.lang, k, v), uiLang: h.lang }) };
});
vi.mock("../../design/useComposition", () => ({ useComposition: () => h.composition }));
// The dialogs portal to <body>; closed, they render nothing.
vi.mock("./FpDialog", () => ({ FpDialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div data-fp-dialog="">{children}</div> : null) }));

const NOW = new Date();
const ISO = NOW.toISOString();
const me: FamilyPlanAdult = { uid: "owner-1", role: "owner", email: "parent.one@example.test" };
const co: FamilyPlanAdult = { uid: "co-1", role: "co_parent", email: "parent.two@example.test", grantId: "g1" };
const day = (n: number) => { const d = new Date(NOW); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

vi.mock("../../hooks/useFamilyPlan", () => ({
  useFamilyPlan: () => {
    const all = h.rows as FamilyPlanDate[];
    const w = planWindow(NOW);
    const dates = datesInWindow(all, w);
    return {
      loaded: h.loaded, all, window: w, dates, counts: planCounts(dates), reminders: reminders(dates, NOW), openRequests: openRequests(dates), now: NOW,
      roster: { state: "ready", adults: [me, co], invited: [] }, me, lanes: lanes(dates, [me, co]),
      receipt: null, dismissReceipt: () => {}, busy: false, error: false, clearError: () => {},
      addDates: async () => ({ added: 0, duplicates: 0 }), take: async () => true, ask: async () => true, change: async () => true, edit: async () => true,
      done: async () => true, cancel: async () => true, prep: async () => true, tickPrep: async () => {},
    };
  },
}));

import FamilyPlanView from "./FamilyPlanView";
import { familyPlanCopy } from "./familyPlanCopy";

const seed = () => {
  const form = takeIt(createDate({ id: "form", kind: "deadline", title: "Return the visit form", date: day(2), origin: "message", messageId: "m1", sourceLine: "Please return the signed form by Wednesday." }, me.uid, ISO), me, ISO);
  const visit = askAdult(createDate({ id: "visit", kind: "join", title: "Group visit", date: day(3), time: "10:00", origin: "message", messageId: "m1", sourceLine: "We ask one parent to join each group." }, me.uid, ISO), me.uid, co, "Can you take it?", ISO);
  const later = takeIt(createDate({ id: "later", kind: "event", title: "Class photo", date: day(9), time: "09:15", origin: "manual" }, me.uid, ISO), co, ISO);
  return [form, visit, later];
};
const render = () => renderToStaticMarkup(<FamilyPlanView />);
const count = (html: string, needle: string) => html.split(needle).length - 1;
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, "\"").replace(/&amp;/g, "&");

beforeEach(() => { h.lang = "en"; h.composition = "desk"; h.rows = seed(); h.loaded = true; });

describe("Family plan screen", () => {
  it.each(["desk", "phone"] as const)("%s, EN: one h1, the four sections in order, figures with units, the week ribbon, one primary move", (composition) => {
    h.composition = composition;
    const html = render();
    const t = text(html);
    const c = familyPlanCopy.en;
    expect(count(html, "<h1")).toBe(1);
    expect(t).toContain(c.pageTitle);
    const order = ["fp-who", "fp-dates", "fp-came", "fp-standing"].map((id) => html.indexOf(`id="${id}"`));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(count(html, "data-primary-move=")).toBe(1);
    // The Asked / Accepted / Done track says it; no three-part banner.
    expect(t).not.toContain("Sent is not accepted");
    expect(count(t, c.addMessage)).toBe(1);
    expect(count(t, c.addDate)).toBe(1);
    // 3 dates, 2 with an adult, 1 nobody yet (an asked date is not covered)
    expect(html).toMatch(/<b>3<\/b><span>dates/);
    expect(html).toMatch(/<b>2<\/b><span>with an adult/);
    expect(html).toMatch(/<b>1<\/b><span>nobody yet/);
    // V77: the week ribbon replaces the per-adult lanes (negative control: no lane markup).
    expect(count(html, 'class="rbd')).toBe(8);
    expect(count(html, 'class="rbd today"')).toBe(1);
    expect(html).not.toContain("nx-lane");
    expect(html).not.toContain('class="hasw"');
    expect(t).toContain(c.legendNone);
    // Who has each date is named in the dates rail (the co-parent's later date).
    expect(t).toContain("parent.two");
    expect(t).toContain(c.inAppOnly);
    expect(t).toContain("Return the visit form");
  });

  it("HE phone: the screen's own words are Hebrew", () => {
    h.lang = "he"; h.composition = "phone";
    const t = text(render());
    const c = familyPlanCopy.he;
    expect(t).toContain(c.pageTitle);
    expect(t).toContain(c.stops.who);
    expect(t).toContain(c.standingTile);
    for (const en of Object.values(familyPlanCopy.en.stops)) expect(t).not.toContain(en);
    expect(t).not.toContain(familyPlanCopy.en.inAppOnly);
  });

  it("empty: production's own empty state, the add actions, and no zero figures", () => {
    h.rows = [];
    for (const composition of ["desk", "phone"] as const) {
      h.composition = composition;
      const html = render();
      const t = text(html);
      // Each control once: one primary in the stage, "Add a date" in the dates section, no toolbar yet.
      expect(count(t, familyPlanCopy.en.emptyTitle)).toBe(1);
      expect(count(t, familyPlanCopy.en.addMessage)).toBe(1);
      expect(count(t, familyPlanCopy.en.addDate)).toBe(1);
      expect(t).not.toContain(familyPlanCopy.en.addToCalendar);
      expect(html).not.toMatch(/<b>0<\/b>/);
      expect(count(html, "data-primary-move=")).toBe(1);
    }
  });

  it("firewall: nothing graded, scored or coloured about the child", () => {
    for (const lang of ["en", "he"] as const) {
      h.lang = lang;
      const t = text(render()).toLowerCase();
      for (const word of ["score", "percent", "%", "level", "risk", "behind", "delay", "diagnos", "on track", "ציון", "אחוז", "סיכון", "עיכוב"]) expect(t, `${lang}: ${word}`).not.toContain(word);
    }
  });
});
