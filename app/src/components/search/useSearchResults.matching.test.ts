/** Execute the real hook's search branches with controlled context/memo seams.
 * This is offline hook evidence, not browser-mounted or provider ownership QA. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionPlan, BehaviorLog, Milestone } from "../../types";
import type { Conversation } from "../../context/ArborContext";
import type { SearchIndexModule } from "./useSearchResults";

type Records = { behaviorLogs: BehaviorLog[]; conversations: Conversation[]; milestones: Milestone[]; actionPlans: ActionPlan[] };
const h = vi.hoisted(() => ({
  records: null as unknown as Records, childId: "child-a", lang: "en" as "en" | "he",
  index: null as SearchIndexModule | null, cursor: 0,
  memos: [] as { deps: unknown[]; value: unknown }[],
  actions: { setActiveTab: vi.fn(), openConversation: vi.fn(), setSelectedLens: vi.fn(), requestJournalFocus: vi.fn(), seedCoach: vi.fn() },
}));
vi.mock("react", () => ({
  useState: () => { h.cursor++; return [h.index, vi.fn()]; },
  // Index loading is represented by h.index; no asynchronous import is needed.
  useEffect: () => { h.cursor++; },
  useMemo: (compute: () => unknown, deps: unknown[]) => {
    const slot = h.cursor++, old = h.memos[slot];
    if (!old || old.deps.length !== deps.length || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
      h.memos[slot] = { deps, value: compute() };
    }
    return h.memos[slot].value;
  },
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ ...h.records, childProfile: { id: h.childId, age: 4 }, ...h.actions }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ t: translations[h.lang], uiLang: h.lang }) }));
import { useSearchResults } from "./useSearchResults";
import { getSearchIndex, searchCatalog } from "../../lib/searchIndex";
import { translate } from "../../lib/i18n";
import { normalizeSearchText } from "../../lib/searchNormalize";
import { LEARN_CARDS } from "../../learn/learnCards";
import { searchLearnCards } from "../../learn/learnLibrary";
import { matchesJournalFilter } from "../../lib/journalFilters";

const translations = {
  en: (key: string, vars?: Record<string, string | number>) => translate("en", key, vars),
  he: (key: string, vars?: Record<string, string | number>) => translate("he", key, vars),
};
const catalogSearch = vi.fn(searchCatalog);
const empty = (): Records => ({ behaviorLogs: [], conversations: [], milestones: [], actionPlans: [] });
function records(text: string, id = "a"): Records {
  return {
    behaviorLogs: [{ id, timestamp: "2026-10-10T00:00:00Z", behaviorType: "Moment", trigger: text, durationMinutes: 0 }],
    conversations: [{ id, title: text, messages: [], updatedAt: "2026-10-10T00:00:00Z" }],
    milestones: [{ id, domain: "sensory_motor_patterns", ageGroup: "Age 4", title: text, description: "Description only", checked: false }],
    actionPlans: [{ id, title: text, issue: "", phases: [], scripts: [], successIndicators: [] }],
  };
}
const ids = (id = "a") => [`log-${id}`, `thread-${id}`, `ms-${id}`, `plan-${id}`];
const render = (query: string, opts: Partial<Parameters<typeof useSearchResults>[1]> = {}) => {
  h.cursor = 0;
  return useSearchResults(query, { enabled: true, ...opts });
};
beforeEach(() => {
  vi.clearAllMocks();
  h.records = empty(); h.childId = "child-a"; h.lang = "en"; h.cursor = 0; h.memos = [];
  h.index = { getSearchIndex, searchCatalog: catalogSearch };
});

describe("shared normalization in the actual global private-record branch", () => {
  it.each([
    ["Café", "CAFE"], ["CAFE", "cafe\u0301"],
    ["שָׁל֑וֹם", "שלומ"], ["שלומ", "  שָׁל֑וֹם  "],
    ["ך ם ן ף ץ", "כ מ נ פ צ"], ["כ מ נ פ צ", "ך ם ן ף ץ"],
  ])("matches all four record kinds for %j / %j in either UI language", (text, query) => {
    h.records = records(text);
    for (const lang of ["en", "he"] as const) {
      h.lang = lang;
      expect(render(query).record.map(row => row.id)).toEqual(ids());
    }
  });

  it.each([false, true])("matches the same real Learn title in all public/private/local consumers (HE=%s)", (he) => {
    const card = LEARN_CARDS.find(card => card.id === "tantrums-development")!;
    const query = he ? "  הִתְקְפֵי זַעַם  " : "  TÁNTRUMS  ";
    h.records = records(he ? card.title.he : card.title.en);
    h.lang = he ? "he" : "en";
    const result = render(query);
    expect(result.record.map(row => row.id)).toEqual(ids());
    expect(result.catalog.map(row => row.id)).toContain(`learn:${card.id}`);
    expect(searchLearnCards(LEARN_CARDS, query, he).map(card => card.id)).toContain(card.id);
    expect(matchesJournalFilter({ id: "moment-a", kind: "moment", at: null, tone: "lav" }, {
      query, filter: "all", logsById: new Map([["a", h.records.behaviorLogs[0]]]), keptIds: new Set(), labelOf: () => "",
    })).toBe(true);
  });

  it.each(["behaviorType", "trigger", "response", "notes"] as const)("normalizes the existing log %s field", (field) => {
    h.records = empty();
    h.records.behaviorLogs = [{ ...records("").behaviorLogs[0], [field]: "שָׁל֑וֹם" }];
    expect(render("שלומ").record.map(row => row.id)).toEqual(["log-a"]);
  });

  it("still matches both localized labels for an English-stored log type", () => {
    h.records = empty(); h.records.behaviorLogs = [{ ...records("").behaviorLogs[0], behaviorType: "Sensory Overload" }];
    for (const query of ["SÉNSORY", "חוּשִׁי"]) expect(render(query).record.map(row => row.id)).toEqual(["log-a"]);
  });

  it("preserves separate thread messages, milestone title-only and plan title/issue boundaries", () => {
    h.records = records("");
    h.records.conversations[0] = { ...h.records.conversations[0], title: "Café", messages: [{ sender: "user", text: "שָׁלוֹם" }, { sender: "ai", text: "after school" }] };
    h.records.milestones[0].description = "search-excluded-description";
    h.records.actionPlans[0] = { ...h.records.actionPlans[0], title: "Café", issue: "שָׁלוֹם" };
    expect(render("שלומ").record.map(row => row.id)).toEqual(["thread-a", "plan-a"]);
    expect(render("cafe שלומ").record.map(row => row.id)).toEqual(["plan-a"]);
    expect(render("שלומ after").record).toEqual([]);
    expect(render("search-excluded-description").record).toEqual([]);
  });

  it("does not search previously excluded private fields", () => {
    const hidden = "private-excluded-token";
    h.records = records("");
    h.records.behaviorLogs[0].resolutionNotes = hidden;
    h.records.conversations[0].messages = [{ sender: "user", text: "", displayText: hidden }];
    h.records.milestones[0].description = hidden;
    h.records.actionPlans[0].successIndicators = [hidden];
    expect(render(hidden).record).toEqual([]);
  });
});

describe("private query activation, literal symbols and ownership boundaries", () => {
  it.each(["", " \t\n ", "\u05B0\u05B7\u0301"])("never scans private records for an empty-normalized query %j", (query) => {
    const unread = new Proxy([], { get: () => { throw new Error("private source was scanned"); } });
    h.records = { behaviorLogs: unread, conversations: unread, milestones: unread, actionPlans: unread };
    const result = render(query);
    expect(result.record).toEqual([]);
    expect(result.catalog).toEqual([]);
    expect(result.ask).toBeNull();
    expect(h.actions.seedCoach).not.toHaveBeenCalled();
    if (query.trim()) {
      // Diacritics alone are neither a private-record query nor a useful
      // question. Do not fabricate an Ask affordance from standalone marks.
      expect(result.ordered).toEqual([]);
    } else {
      expect(result.ask).toBeNull();
      expect(result.ordered.length).toBeGreaterThan(0);
      expect(result.ordered.every(row => row.kind === "route")).toBe(true);
    }
  });

  it.each(["en", "he"] as const)("keeps marks-only results empty before and after a real query in %s", (lang) => {
    h.lang = lang;
    for (const index of [null, { getSearchIndex, searchCatalog: catalogSearch }]) {
      h.index = index;
      expect(render("\u05B0\u05B7\u0301").ordered).toEqual([]);
      const meaningful = render("  שָׁלוֹם?  ");
      expect(meaningful.ask).not.toBeNull();
      meaningful.ask!.go();
      expect(h.actions.seedCoach).toHaveBeenLastCalledWith({ prompt: "שָׁלוֹם?", source: "search" });
      h.actions.seedCoach.mockClear();
      expect(render("\u05B0\u05B7\u0301").ordered).toEqual([]);
      expect(h.actions.seedCoach).not.toHaveBeenCalled();
    }
  });

  it.each(["־", "׀", "׃", "׆", "׳", "״", "+", "❤️"])("matches punctuation-only query %s literally", (query) => {
    const withSymbol = records(`אב${query}גד`, "with"), withoutSymbol = records("אבגד", "without");
    h.records = {
      behaviorLogs: [...withSymbol.behaviorLogs, ...withoutSymbol.behaviorLogs],
      conversations: [...withSymbol.conversations, ...withoutSymbol.conversations],
      milestones: [...withSymbol.milestones, ...withoutSymbol.milestones],
      actionPlans: [...withSymbol.actionPlans, ...withoutSymbol.actionPlans],
    };
    expect(render(query).record.map(row => row.id)).toEqual(ids("with"));
  });

  it("switches only with the active context arrays, including empty transition, without indexing private words", () => {
    const index = getSearchIndex(), snapshot = JSON.stringify(index);
    const a = "private-child-a-search-7f2", b = "private-child-b-search-9c4";
    h.records = records(a, "a");
    expect(render(a).record.map(row => row.id)).toEqual(ids("a"));
    h.childId = "child-b"; h.records = empty();
    expect(render(a).record).toEqual([]);
    h.records = records(b, "b");
    expect(render(a).record).toEqual([]);
    expect(render(b).record.map(row => row.id)).toEqual(ids("b"));
    expect(searchCatalog(a)).toEqual([]); expect(searchCatalog(b)).toEqual([]);
    expect(getSearchIndex()).toBe(index); expect(JSON.stringify(index)).toBe(snapshot);
  });

  it("keeps labels, source order, limits, raw Ask text and every navigation callback", () => {
    const raw = "  שָׁלוֹם?  ", text = "שלומ?";
    h.records = records(text);
    h.records.behaviorLogs.push({ ...h.records.behaviorLogs[0], id: "second" });
    const expected = ["log-a", "log-second", "thread-a", "ms-a", "plan-a"];
    const result = render(raw);
    expect(result.record.map(row => row.id)).toEqual(expected);
    expect(result.record.slice(2).map(row => row.label)).toEqual([text, text, text]);
    expect(result.record[0].sub).toBe(text);
    expect(result.ordered[0].kind).toBe("ask");
    result.ask!.go();
    expect(h.actions.seedCoach).toHaveBeenCalledWith({ prompt: raw.trim(), source: "search" });
    expect(catalogSearch).toHaveBeenLastCalledWith(raw.trim(), 12, expect.objectContaining({ locale: "en", ageMonths: 48 }));
    expect(normalizeSearchText(raw)).not.toBe(raw.trim());
    result.record[0].go(); expect(h.actions.requestJournalFocus).toHaveBeenLastCalledWith("moment-a"); expect(h.actions.setActiveTab).toHaveBeenLastCalledWith("journal");
    result.record[2].go(); expect(h.actions.openConversation).toHaveBeenLastCalledWith("a"); expect(h.actions.setActiveTab).toHaveBeenLastCalledWith("coach");
    result.record[3].go(); expect(h.actions.setActiveTab).toHaveBeenLastCalledWith("milestones");
    result.record[4].go(); expect(h.actions.setActiveTab).toHaveBeenLastCalledWith("plans");
    expect(render(raw, { recordLimit: 2 }).record.map(row => row.id)).toEqual(expected.slice(0, 2));
    expect(render(raw, { recordLimit: 0 }).record).toEqual([]);
  });

  it("keeps catalog before records before Ask and private search available without a loaded index", () => {
    h.records = records("tantrums");
    const result = render("tantrums", { catalogLimit: 1 });
    expect(result.catalog).toHaveLength(1);
    expect(result.ordered.map(row => row.id)).toEqual([result.catalog[0].id, ...ids(), "ask"]);
    h.index = null;
    const withoutIndex = render("tantrums", { enabled: false });
    expect(withoutIndex.indexReady).toBe(false);
    expect(withoutIndex.catalog).toEqual([]);
    expect(withoutIndex.record.map(row => row.id)).toEqual(ids());
  });

  it("keeps the default twelve-record cap and original source ordering", () => {
    h.records = records("private-cap-token");
    h.records.behaviorLogs = Array.from({ length: 13 }, (_, i) => ({ ...h.records.behaviorLogs[0], id: String(i) }));
    expect(render("private-cap-token").record.map(row => row.id)).toEqual(Array.from({ length: 12 }, (_, i) => `log-${i}`));
  });

  it.each([
    ["visit", "appointments"], ["בִּיקוּר", "appointments"],
    ["Prepare for a visit", "consult"], ["מתכוננים לפגישה", "consult"],
  ] as const)("%j navigates to the existing %s destination without changing private matches", (query, tab) => {
    h.records = records(query);
    const result = render(query);
    expect(result.ordered[0].id).toBe(`route:${tab}`);
    expect(result.record.map(row => row.id)).toEqual(ids());
    result.ordered[0].go();
    expect(h.actions.setActiveTab).toHaveBeenLastCalledWith(tab);
  });
});
