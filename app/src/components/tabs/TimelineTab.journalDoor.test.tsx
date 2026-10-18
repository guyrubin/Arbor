import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* F-INT-1 — Moments (#/timeline) shows the journal door exactly once, in
   every view and every record state.

   On a phone, Moments closes with My child's doors (F-CHILD-4), the journal
   door left out because Moments carries its own. That own door used to sit
   only under the months over time with a non-empty record, so in places, in
   areas, or with an empty record a phone parent had no journal door at all.
   It now closes every view and every state, so the page holds one control
   that opens #/journal: Moments' own, before the three remaining doors. On a
   wide screen there is no doors grid and the same one door.

   The count is behavioural: every button the page builds is pressed and the
   presses that open #/journal are counted. Invented records only. */

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  phone: true,
  query: "",
  record: { observations: [] as Observation[], loading: false, error: false, more: false, confirmed: true },
  setActiveTab: vi.fn(),
  buttons: [] as { onClick?: () => void; "data-testid"?: string }[],
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  activeTab: "timeline", conversations: [], childProfile: { id: "child-invented", name: "Noa Example" }, milestones: [],
  setActiveTab: state.setActiveTab, seedCoach: () => undefined, openCaptureSheet: () => undefined, requestJournalFocus: () => undefined,
  pendingMemoryItems: [],
}) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "account-invented" } }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../../hooks/useObservationRecord", () => ({
  useObservationRecord: () => ({ ...state.record, sources: {}, loadMore: () => undefined, reload: () => undefined }),
}));
vi.mock("../../hooks/useHashQuery", () => ({ useHashQuery: () => new URLSearchParams(state.query), goToRoute: () => undefined }));
vi.mock("../../hooks/useSheetHistory", () => ({ useSheetHistory: () => (after?: () => void) => after?.() }));
vi.mock("../ui/Sheet", () => ({ Sheet: () => null, useCompactSurface: () => state.phone }));
vi.mock("../ui/Modal", () => ({ Modal: () => null }));
vi.mock("../layout/Breadcrumb", () => ({ SheetBreadcrumb: () => null }));
vi.mock("./JournalTab", () => ({ default: () => null }));
// The real doors; only the width seam is set by the test.
vi.mock("../companion/ChildDoors", async original => ({
  ...(await original<typeof import("../companion/ChildDoors")>()),
  useChildPhoneLayout: () => state.phone,
}));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => {
  if (type === "button" && props && typeof props === "object") state.buttons.push(props as typeof state.buttons[number]);
});
vi.mock("react/jsx-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime, jsx: (...a: Parameters<typeof runtime.jsx>) => { capture(a[0], a[1]); return runtime.jsx(...a); }, jsxs: (...a: Parameters<typeof runtime.jsxs>) => { capture(a[0], a[1]); return runtime.jsxs(...a); } };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...a: Parameters<typeof runtime.jsxDEV>) => { capture(a[0], a[1]); return runtime.jsxDEV(...a); } };
});
import TimelineTab from "./TimelineTab";
import { translate } from "../../lib/i18n";
import type { DomainId } from "../../lib/domains/registry";
import type { Observation } from "../../lib/observations";

let serial = 0;
/** An invented kept moment, `minutesAgo` before now, so it always falls inside the default three months. */
const kept = (minutesAgo: number, domains: DomainId[], context?: string): Observation => {
  serial += 1;
  return {
    id: `behaviorLogs:invented-${serial}`,
    childId: "child-invented",
    at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    domains,
    kind: "moment",
    value: { type: "moment", behaviorType: "Moment", ...(context ? { context } : {}) },
    source: "parent_typed",
    origin: "behaviorLogs",
    ageAtObservationMonths: null,
    pretermCorrected: false,
  };
};

const RECORDS = {
  kept: () => ({ observations: [kept(5, ["talking"], "Home"), kept(90, ["moving"], "Public"), kept(240, [])], loading: false, error: false, more: true, confirmed: true }),
  empty: () => ({ observations: [], loading: false, error: false, more: false, confirmed: true }),
  loading: () => ({ observations: [], loading: true, error: false, more: false, confirmed: false }),
  failed: () => ({ observations: [], loading: false, error: true, more: false, confirmed: false }),
} as const;
type RecordState = keyof typeof RECORDS;
type View = "time" | "places" | "areas";
const VIEWS: View[] = ["time", "places", "areas"];
const CASES: [View, RecordState][] = VIEWS.flatMap(view => (Object.keys(RECORDS) as RecordState[]).map((record): [View, RecordState] => [view, record]));

const render = (view: View, record: RecordState) => {
  state.query = view === "time" ? "" : `view=${view}`;
  state.record = RECORDS[record]();
  state.buttons = [];
  return renderToStaticMarkup(<TimelineTab />);
};
const count = (html: string, needle: string) => html.split(needle).length - 1;
/** How many controls on the page open #/journal: press every button the render built. */
const journalPresses = () => {
  state.setActiveTab.mockClear();
  for (const button of state.buttons) button.onClick?.();
  return state.setActiveTab.mock.calls.filter(([tab]) => tab === "journal").length;
};
const DOOR = 'data-testid="moments-journal-door"';
const doorHtml = (html: string) => {
  const start = html.indexOf(DOOR);
  return html.slice(start, html.indexOf("</button>", start));
};
// Visible words: icon ligatures are glyphs, not text.
const words = (html: string) => html.replace(/<span class="msr[^"]*"[^>]*>[^<]*<\/span>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

beforeEach(() => { vi.clearAllMocks(); state.lang = "en"; state.phone = true; state.query = ""; state.buttons = []; });

describe("F-INT-1 — Moments on a phone shows the journal door exactly once", () => {
  it.each(CASES)("view %s, %s record: one journal door, Moments' own, then the three other doors", (view, record) => {
    const html = render(view, record);
    expect(html).toContain('data-testid="moments-body"');
    expect(count(html, DOOR)).toBe(1);
    expect(html).not.toContain('data-testid="child-door-journal"');
    expect(count(html, 'data-testid="child-doors"')).toBe(1);
    expect([...html.matchAll(/data-testid="child-door-([a-z]+)"/g)].map(m => m[1])).toEqual(["memory", "screening", "consult"]);
    expect(journalPresses()).toBe(1);
    expect(state.setActiveTab).toHaveBeenCalledWith("journal");
    // The door closes the view, inside its module; the doors grid follows it.
    expect(html.indexOf(DOOR)).toBeGreaterThan(html.indexOf('data-module="moments-view"'));
    expect(html.indexOf(DOOR)).toBeLessThan(html.indexOf('data-testid="child-doors"'));
    // Navigation adds no block and no move: two modules, one primary move.
    expect(count(html, "data-module=")).toBe(2);
    expect(count(html, "data-primary-move=")).toBe(1);
  });

  it.each(CASES)("wide screen, view %s, %s record: the same one door and no doors grid", (view, record) => {
    state.phone = false;
    const html = render(view, record);
    expect(count(html, DOOR)).toBe(1);
    expect(html).not.toContain('data-testid="child-doors"');
    expect(journalPresses()).toBe(1);
  });

  it("Load more stays with the months over time; the journal door does not bring it to the other views", () => {
    const more = translate("en", "companion.moments.loadMore");
    expect(count(words(render("time", "kept")), more)).toBe(1);
    for (const view of ["places", "areas"] as const) expect(words(render(view, "kept")), view).not.toContain(more);
    expect(words(render("time", "empty"))).not.toContain(more);
  });

  it.each(["en", "he"] as const)("the door says the journal's name, and its one arrow mirrors (%s)", lang => {
    state.lang = lang;
    for (const view of VIEWS) {
      const html = render(view, "empty");
      const door = doorHtml(html);
      expect(words(door.slice(door.indexOf(">") + 1)), view).toBe(translate(lang, "companion.moments.journal"));
      expect(door.match(/class="msr rtl:-scale-x-100"[^>]*>arrow_forward</g), view).toHaveLength(1);
      expect(html).toContain(`dir="${lang === "he" ? "rtl" : "ltr"}"`);
    }
    if (lang === "he") expect(translate("he", "companion.moments.journal")).not.toMatch(/[A-Za-z]/);
  });
});
