/** v3 IA-05 — search as the universal fallback, through the real hook: every
 * row but Ask names its home (place or door) with that home's glyph, a route
 * row reads as a breadcrumb, "routines" lands on Plans, and the parent's saved
 * questions are searchable for the active child only. Offline hook evidence
 * (controlled context/memo seams), not browser-mounted QA. Invented examples.
 *
 * IA-05r: "routines" reads Together › Routines (nav.tab.plans renamed), and
 * every row of the Talk door opens the Talk panel through
 * requestCompanionConversation, never by moving to #/coach. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionPlan, BehaviorLog, Milestone } from "../../types";
import type { Conversation } from "../../context/ArborContext";
import type { FamilyTopic } from "../../lib/familyTopics";
import type { SearchIndexModule, SearchRow } from "./useSearchResults";

type Records = { behaviorLogs: BehaviorLog[]; conversations: Conversation[]; milestones: Milestone[]; actionPlans: ActionPlan[] };
const h = vi.hoisted(() => ({
  records: null as unknown as Records, topics: [] as unknown, childId: "child-a", lang: "en" as "en" | "he",
  index: null as SearchIndexModule | null, cursor: 0,
  memos: [] as { deps: unknown[]; value: unknown }[],
  actions: { setActiveTab: vi.fn(), openConversation: vi.fn(), setSelectedLens: vi.fn(), requestJournalFocus: vi.fn(), seedCoach: vi.fn(), selectFamilyTopic: vi.fn() },
  openSheet: vi.fn(), talk: vi.fn(),
}));
vi.mock("react", () => ({
  useState: () => { h.cursor++; return [h.index, vi.fn()]; },
  useEffect: () => { h.cursor++; },
  useMemo: (compute: () => unknown, deps: unknown[]) => {
    const slot = h.cursor++, old = h.memos[slot];
    if (!old || old.deps.length !== deps.length || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
      h.memos[slot] = { deps, value: compute() };
    }
    return h.memos[slot].value;
  },
}));
vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({ ...h.records, familyTopics: h.topics, childProfile: { id: h.childId, age: 4 }, ...h.actions }),
}));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ t: translations[h.lang], uiLang: h.lang }) }));
// FEAT-05's one door into the question sheet; Shell owns the only listener.
vi.mock("../companion/familyTopicEvents", () => ({ openFamilyTopicSheet: h.openSheet }));
// The Talk panel's one door (CompanionWorkspace holds the listener).
vi.mock("../../lib/companionConversation", () => ({ requestCompanionConversation: h.talk }));
import { useSearchResults } from "./useSearchResults";
import { getSearchIndex, searchCatalog } from "../../lib/searchIndex";
import { translate } from "../../lib/i18n";
import { COMPANION_DOORS, COMPANION_PLACES, homeForTab } from "../../lib/companionPlaces";

const translations = {
  en: (key: string, vars?: Record<string, string | number>) => translate("en", key, vars),
  he: (key: string, vars?: Record<string, string | number>) => translate("he", key, vars),
};
const empty = (): Records => ({ behaviorLogs: [], conversations: [], milestones: [], actionPlans: [] });
const topic = (id: string, title: string, childId = "child-a", intent: FamilyTopic["intent"] = "understand"): FamilyTopic => ({
  id, childId, title, intent, status: "active", observationIds: [], createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z",
});
const render = (query: string) => { h.cursor = 0; return useSearchResults(query, { enabled: true, catalogLimit: 12, recordLimit: 12 }); };
const homeOf = (tab: Parameters<typeof homeForTab>[0], lang: "en" | "he") => {
  const home = homeForTab(tab);
  const named = home.kind === "place" ? home.place : home.door;
  return { id: named.id, label: named[lang], icon: named.icon };
};
const row = (rows: SearchRow[], id: string) => rows.find(r => r.id === id)!;
const HOME_IDS = [...COMPANION_PLACES, ...COMPANION_DOORS].map(home => home.id as string);

beforeEach(() => {
  vi.clearAllMocks();
  h.records = empty(); h.topics = []; h.childId = "child-a"; h.lang = "en"; h.cursor = 0; h.memos = [];
  h.index = { getSearchIndex, searchCatalog };
});

describe("v3 IA-05 · a route row names its home and reads as a crumb", () => {
  it.each([
    ["en", "My child", "Milestones"],
    ["he", "הילד שלי", "אבני דרך"],
  ] as const)("milestones (%s) sits under My child with the eco glyph", (lang, home, page) => {
    h.lang = lang;
    expect(translate(lang, "companion.place.child")).toBe(home);
    expect(translate(lang, "nav.tab.milestones")).toBe(page);
    const milestones = row(render("milestones").catalog, "route:milestones");
    expect(milestones.group).toEqual({ id: "child", label: home, icon: "eco" });
    expect(milestones.icon).toBe("eco");
    expect(milestones.label).toBe(page);
    expect(milestones.crumb).toEqual([home, page]);
  });

  it.each(["en", "he"] as const)("consult (%s) sits under Care, together and reads as the door alone", (lang) => {
    h.lang = lang;
    const care = { id: "care", label: translate(lang, "companion.door.care"), icon: "diversity_1" };
    expect(translate("en", "companion.door.care")).toBe("Care, together");
    const consult = row(render("consult").catalog, "route:consult");
    expect(consult.group).toEqual(care);
    expect(consult.icon).toBe("diversity_1");
    // The door's own route: no "Care, together › Consult" echo.
    expect(consult.crumb).toEqual([care.label]);
  });

  it.each(["routines", "Routine", "שגרות", "שגרה"])("%j opens Plans first, under Plans' own home", (query) => {
    for (const lang of ["en", "he"] as const) {
      h.lang = lang; h.memos = [];
      const result = render(query);
      const first = result.ordered[0];
      expect(first.id).toBe("route:plans");
      const home = homeOf("plans", lang);
      expect(first.group).toEqual(home);
      expect(first.icon).toBe(home.icon);
      expect(first.crumb).toEqual([home.label, translate(lang, "nav.tab.plans")]);
      first.go();
      expect(h.actions.setActiveTab).toHaveBeenLastCalledWith("plans");
    }
  });

  it.each([
    ["en", ["Together", "Routines"]],
    ["he", ["ביחד", "שגרות"]],
  ] as const)("IA-05r: a routines query reads Together › Routines with the interests glyph (%s)", (lang, crumb) => {
    h.lang = lang;
    const first = render("routines").ordered[0];
    expect(first.id).toBe("route:plans");
    expect(first.label).toBe(crumb[1]);
    expect(first.crumb).toEqual(crumb);
    expect(first.group).toEqual({ id: "together", label: crumb[0], icon: "interests" });
    expect(first.icon).toBe("interests");
    // A Routines plan row reads the same crumb when it has no words of its own.
    h.records = { ...empty(), actionPlans: [{ id: "p", title: "Invented kite routine", issue: "", phases: [], scripts: [], successIndicators: [] }] };
    expect(row(render("kite").record, "plan-p").crumb).toEqual(crumb);
  });

  it("no row wears the old generic route arrow; every catalogue row has a home", () => {
    for (const query of ["", "milestones", "consult", "routines", "tantrums", "sleep"]) {
      for (const lang of ["en", "he"] as const) {
        h.lang = lang; h.memos = [];
        const rows = render(query).ordered;
        expect(rows.some(r => r.icon === "arrow_forward"), query).toBe(false);
        for (const r of rows.filter(r => r.kind !== "ask")) {
          expect(HOME_IDS, r.id).toContain(r.group?.id);
          if (r.kind === "route") {
            expect(r.icon, r.id).toBe(r.group!.icon);
            expect(r.crumb?.[0], r.id).toBe(r.group!.label);
          } else {
            expect(r.crumb, r.id).toBeUndefined();
          }
        }
      }
    }
  });

  it("zero query lists the go-anywhere routes home by home, Sidebar order", () => {
    const rows = render("").ordered;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(r => r.kind === "route")).toBe(true);
    const rank = rows.map(r => HOME_IDS.indexOf(r.group!.id));
    expect(rank.every(i => i >= 0)).toBe(true);
    expect(rank).toEqual([...rank].sort((a, b) => a - b));
    // NEGATIVE CONTROL: the index's own order is not already home by home.
    const prior = getSearchIndex().filter(e => e.kind === "route").map(e => HOME_IDS.indexOf(homeOf(e.tab, "en").id));
    expect(prior).not.toEqual([...prior].sort((a, b) => a - b));
    // Within a home the index order holds (a stable sort).
    const indexOrder = getSearchIndex().filter(e => e.kind === "route").map(e => e.id);
    for (const home of HOME_IDS) {
      const mine = rows.filter(r => r.group!.id === home).map(r => r.id);
      expect(mine).toEqual(indexOrder.filter(id => mine.includes(id)));
    }
  });
});

describe("v3 IA-05 · records name where they open", () => {
  it("a record keeps its own words; the crumb only stands in when it has none", () => {
    h.records = {
      behaviorLogs: [
        { id: "worded", timestamp: "2026-10-10T00:00:00Z", behaviorType: "Moment", trigger: "invented-garden-word", durationMinutes: 0 },
        { id: "bare", timestamp: "2026-10-10T00:00:00Z", behaviorType: "Moment", trigger: "", notes: "invented-garden-word", durationMinutes: 0 },
      ],
      conversations: [{ id: "c", title: "invented-garden-word", messages: [], updatedAt: "2026-10-10T00:00:00Z" }],
      milestones: [{ id: "m", domain: "sensory_motor_patterns", ageGroup: "Age 4", title: "invented-garden-word", description: "", checked: false }],
      actionPlans: [{ id: "p", title: "invented-garden-word", issue: "", phases: [], scripts: [], successIndicators: [] }],
    };
    const { record } = render("invented-garden-word");
    const journal = homeOf("journal", "en"), talk = homeOf("coach", "en"), plans = homeOf("plans", "en"), child = homeOf("milestones", "en");
    expect(row(record, "log-worded").group).toEqual(journal);
    expect(row(record, "log-worded").sub).toBe("invented-garden-word");
    expect(row(record, "log-worded").crumb).toBeUndefined();
    expect(row(record, "log-bare").crumb).toEqual([journal.label, translate("en", "nav.tab.journal")].filter((v, i, a) => a.indexOf(v) === i));
    expect(row(record, "thread-c").group).toEqual(talk);
    expect(row(record, "thread-c").crumb).toEqual([translate("en", "companion.door.talk")]);
    expect(row(record, "thread-c").icon).toBe("forum");
    expect(row(record, "ms-m").group).toEqual(child);
    expect(row(record, "ms-m").crumb).toEqual([child.label, translate("en", "nav.tab.milestones")]);
    expect(row(record, "plan-p").group).toEqual(plans);
    expect(row(record, "plan-p").crumb).toEqual([plans.label, translate("en", "nav.tab.plans")]);
  });
});

describe("v3 IA-05 · saved questions, this child's only", () => {
  const now = (lang: "en" | "he") => ({ id: "now", label: translate(lang, "companion.place.now"), icon: "home" });

  it.each(["en", "he"] as const)("a saved question matches on-device, leads the records and opens its sheet (%s)", (lang) => {
    h.lang = lang;
    h.records = { ...empty(), actionPlans: [{ id: "p", title: "Invented puddle plan", issue: "", phases: [], scripts: [], successIndicators: [] }] };
    h.topics = [topic("t1", "Why does the invented puddle game calm her?", "child-a", "support"), topic("t2", "Something else entirely")];
    const result = render("PUDDLE");
    expect(result.record.map(r => r.id)).toEqual(["topic-t1", "plan-p"]);
    const saved = result.record[0];
    const sheetTitle = translate(lang, "companion.family-topic-sheet.what-we-re-exploring");
    expect(saved).toMatchObject({ kind: "family-topic", label: "Why does the invented puddle game calm her?", icon: "volunteer_activism", group: now(lang), crumb: [now(lang).label, sheetTitle] });
    expect(result.kindLabel("family-topic")).toBe(lang === "en" ? "Saved question" : "שאלה שמורה");
    saved.go();
    expect(h.actions.selectFamilyTopic).toHaveBeenCalledWith("t1");
    expect(h.actions.setActiveTab).toHaveBeenLastCalledWith("overview");
    expect(h.openSheet).toHaveBeenCalledOnce();
    expect(h.openSheet).toHaveBeenCalledWith();
    // The kind travels in analytics; the question never enters the index.
    expect(JSON.stringify(getSearchIndex())).not.toContain("invented puddle game");
    expect(searchCatalog("puddle game calm")).toEqual([]);
  });

  it("after switching child the question is gone; a question filed under another child never shows", () => {
    h.topics = [topic("t1", "Invented lantern question", "child-a")];
    expect(render("lantern").record.map(r => r.id)).toEqual(["topic-t1"]);
    h.childId = "child-b"; h.topics = [];
    expect(render("lantern").record).toEqual([]);
    h.topics = [topic("t1", "Invented lantern question", "child-a")];
    expect(render("lantern").record).toEqual([]);
    h.topics = [topic("t9", "Invented lantern question", "child-b")];
    expect(render("lantern").record.map(r => r.id)).toEqual(["topic-t9"]);
  });

  it.each(["", "  ", "ְַ"])("never reads saved questions for an empty-normalized query %j", (query) => {
    h.topics = new Proxy([], { get: () => { throw new Error("saved questions were scanned"); } });
    expect(render(query).record).toEqual([]);
  });

  it("the ask row stays the one row without a home", () => {
    h.topics = [topic("t1", "Invented kite question")];
    const result = render("kite");
    expect(result.ask).not.toBeNull();
    expect(result.ask!.group).toBeUndefined();
    expect(result.ask!.crumb).toBeUndefined();
    expect(result.ordered[result.ordered.length - 1]).toBe(result.ask);
    expect(render("kite?").ordered[0].kind).toBe("ask");
  });
});

describe("v3 IA-05r · the Talk door's rows open the Talk panel over the page", () => {
  const conversation = { id: "c7", title: "Invented harbour talk", messages: [], updatedAt: "2026-10-10T00:00:00Z" };

  it.each([
    ["en", "Talk with Arbor"],
    ["he", "לדבר עם ארבור"],
  ] as const)("a thread wears forum under Talk with Arbor and opens the conversation in the panel (%s)", (lang, door) => {
    h.lang = lang;
    expect(translate(lang, "nav.tab.coach")).toBe(door);
    expect(translate(lang, "companion.door.talk")).toBe(door);
    h.records = { ...empty(), conversations: [conversation] };
    const thread = row(render("harbour").record, "thread-c7");
    expect(thread).toMatchObject({ kind: "thread", icon: "forum", group: { id: "talk", label: door, icon: "forum" }, crumb: [door] });
    thread.go();
    expect(h.actions.openConversation).toHaveBeenCalledWith("c7");
    expect(h.talk).toHaveBeenCalledOnce();
    expect(h.talk).toHaveBeenCalledWith({ source: "search" });
    // The conversation is chosen before the panel opens on it.
    expect(h.actions.openConversation.mock.invocationCallOrder[0]).toBeLessThan(h.talk.mock.invocationCallOrder[0]);
    // The panel lays over the page the parent is on: no move to #/coach.
    expect(h.actions.setActiveTab).not.toHaveBeenCalled();
  });

  it("the coach route row and a scholar lens open the panel; the lens is chosen first", () => {
    const coach = row(render(translate("en", "nav.tab.coach")).catalog, "route:coach");
    expect(coach.crumb).toEqual(["Talk with Arbor"]);
    expect(coach.icon).toBe("forum");
    coach.go();
    expect(h.talk).toHaveBeenLastCalledWith({ source: "search" });
    const scholar = getSearchIndex().find(e => e.kind === "scholar")!;
    const lens = row(render(scholar.title.en).catalog, scholar.id);
    expect(lens.group?.id).toBe("talk");
    lens.go();
    expect(h.actions.setSelectedLens).toHaveBeenCalledWith(scholar.lens);
    expect(h.talk).toHaveBeenCalledTimes(2);
    expect(h.actions.setSelectedLens.mock.invocationCallOrder[0]).toBeLessThan(h.talk.mock.invocationCallOrder[1]);
    expect(h.actions.setActiveTab).not.toHaveBeenCalled();
  });

  it("the ask row prefills through seedCoach, which opens the panel itself; it never moves to #/coach", () => {
    const ask = render("invented harbour question").ask!;
    ask.go();
    expect(h.actions.seedCoach).toHaveBeenCalledWith({ prompt: "invented harbour question", source: "search" });
    expect(h.actions.setActiveTab).not.toHaveBeenCalled();
    // One door per tap: seedCoach already requests the panel.
    expect(h.talk).not.toHaveBeenCalled();
  });

  it("NEGATIVE CONTROL: a row of a place still moves the page", () => {
    const milestones = row(render("milestones").catalog, "route:milestones");
    milestones.go();
    expect(h.actions.setActiveTab).toHaveBeenCalledWith("milestones");
    expect(h.talk).not.toHaveBeenCalled();
  });
});
