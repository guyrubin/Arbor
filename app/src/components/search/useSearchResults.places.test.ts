/** v3 IA-05 — search as the universal fallback, through the real hook: every
 * row but Ask names its home (place or door) with that home's glyph, a route
 * row reads as a breadcrumb, "routines" lands on Plans, and the parent's saved
 * questions are searchable for the active child only. Offline hook evidence
 * (controlled context/memo seams), not browser-mounted QA. Invented examples.
 *
 * IA-05r: "routines" reads Together › Routines (nav.tab.plans renamed), and
 * every row of the Talk door opens the Talk panel through
 * requestCompanionConversation, never by moving to #/coach. A home's own row
 * has no crumb and no second line (its header names it), and a saved question
 * is chosen through the sheet's own path, so a set-aside one comes back first.
 *
 * Re-pins (IA-05r round 2, reviewer findings): the consult, coach and thread
 * rows no longer carry the one-part crumb that repeated their header; the
 * saved-question row opens its sheet once the choice has settled (await). */
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
  actions: { setActiveTab: vi.fn(), openConversation: vi.fn(), setSelectedLens: vi.fn(), requestJournalFocus: vi.fn(), seedCoach: vi.fn(), selectFamilyTopic: vi.fn(), updateFamilyTopic: vi.fn(async (_id: string, _patch: { aside?: boolean }) => {}) },
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
import { getSearchIndex, searchCatalog, ROUTINES_INTENT_TAB } from "../../lib/searchIndex";
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
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const HOME_IDS = [...COMPANION_PLACES, ...COMPANION_DOORS].map(home => home.id as string);

beforeEach(() => {
  vi.clearAllMocks();
  // A test's topic store must not outlive it (clearAllMocks keeps implementations).
  h.actions.selectFamilyTopic.mockReset();
  h.actions.updateFamilyTopic.mockReset();
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

  it.each(["en", "he"] as const)("consult (%s) sits under Care, together and does not say the door again", (lang) => {
    h.lang = lang;
    const care = { id: "care", label: translate(lang, "companion.door.care"), icon: "diversity_1" };
    expect(translate("en", "companion.door.care")).toBe("Care, together");
    const consult = row(render("consult").catalog, "route:consult");
    expect(consult.group).toEqual(care);
    expect(consult.icon).toBe("diversity_1");
    // IA-05r re-pin: the door's own route sits under the door's header, so it
    // has no crumb and no second line (it used to read [care.label] again).
    expect(consult.crumb).toBeUndefined();
    expect(consult.sub).toBe("");
  });

  it.each(["en", "he"] as const)("IA-05r: a home's own route never repeats the home's name under its header (%s)", (lang) => {
    h.lang = lang;
    const homes = [...COMPANION_PLACES, ...COMPANION_DOORS];
    const rows = render("").ordered;
    let seen = 0;
    for (const home of homes) {
      const own = rows.find(r => r.id === "route:" + home.tab);
      if (!own) continue;
      seen++;
      expect(own.group?.label, own.id).toBe(home[lang]);
      expect(own.crumb, own.id).toBeUndefined();
      expect(own.sub, own.id).toBe("");
    }
    // Talk with Arbor and Care, together are both listed, so both are checked.
    expect(seen).toBeGreaterThanOrEqual(2);
    expect(rows.some(r => r.id === "route:coach") && rows.some(r => r.id === "route:consult")).toBe(true);
    // A route named exactly like its home (Hebrew "My child" for the profile)
    // would say the name twice too, so it reads the same way.
    const namedLikeHome = rows.filter(r => r.label === r.group!.label);
    for (const twin of namedLikeHome) {
      expect(twin.crumb, twin.id).toBeUndefined();
      expect(twin.sub, twin.id).toBe("");
    }
    // NEGATIVE CONTROL: every other route row still reads home › destination.
    const others = rows.filter(r => !homes.some(home => "route:" + home.tab === r.id) && r.label !== r.group!.label);
    expect(others.length).toBeGreaterThan(5);
    for (const other of others) {
      expect(other.crumb, other.id).toEqual([other.group!.label, other.label]);
      expect(other.sub, other.id).not.toBe("");
    }
  });

  it.each(["routines", "Routine", "שגרות", "שגרה"])("%j opens Plans first, under Plans' own home", (query) => {
    for (const lang of ["en", "he"] as const) {
      h.lang = lang; h.memos = [];
      const result = render(query);
      const first = result.ordered[0];
      expect(first.id).toBe("route:" + ROUTINES_INTENT_TAB);
      const home = homeOf(ROUTINES_INTENT_TAB, lang);
      expect(first.group).toEqual(home);
      expect(first.icon).toBe(home.icon);
      // Should F-SHELL-1 retire plans into Together's own route, that row is
      // its home's own and has no crumb (IA-05r); until then it reads home › Routines.
      const ownRoute = [...COMPANION_PLACES, ...COMPANION_DOORS].some(named => named.tab === ROUTINES_INTENT_TAB);
      expect(first.crumb).toEqual(ownRoute ? undefined : [home.label, translate(lang, "nav.tab." + ROUTINES_INTENT_TAB)]);
      first.go();
      expect(h.actions.setActiveTab).toHaveBeenLastCalledWith(ROUTINES_INTENT_TAB);
    }
  });

  it.each(["plans", "Growth Plans", "תוכניות", "תוכניות התפתחות", translate("en", "plan.title"), translate("he", "plan.title")])(
    "IA-05r: the old name %j still opens the renamed Plans route first", (query) => {
      // Transitional, until F-SHELL-1 replaces the PlansTab heading.
      expect(ROUTINES_INTENT_TAB).toBe("plans");
      for (const lang of ["en", "he"] as const) {
        h.lang = lang; h.memos = [];
        const first = render(query).ordered[0];
        expect(first.id, lang).toBe("route:plans");
        expect(first.crumb, lang).toEqual([homeOf("plans", lang).label, translate(lang, "nav.tab.plans")]);
      }
    },
  );

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
            // IA-05r re-pin: home › destination, or (a home's own route) no
            // crumb and no second line at all.
            if (r.crumb) expect(r.crumb[0], r.id).toBe(r.group!.label);
            else expect(r.sub, r.id).toBe("");
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
    // IA-05r re-pin: a thread keeps its own line under the Talk header.
    expect(row(record, "thread-c").crumb).toBeUndefined();
    expect(row(record, "thread-c").sub).toBe(translate("en", "sm.threadSub"));
    expect(row(record, "thread-c").icon).toBe("forum");
    expect(row(record, "ms-m").group).toEqual(child);
    expect(row(record, "ms-m").crumb).toEqual([child.label, translate("en", "nav.tab.milestones")]);
    expect(row(record, "plan-p").group).toEqual(plans);
    expect(row(record, "plan-p").crumb).toEqual([plans.label, translate("en", "nav.tab.plans")]);
  });
});

describe("v3 IA-05 · saved questions, this child's only", () => {
  const now = (lang: "en" | "he") => ({ id: "now", label: translate(lang, "companion.place.now"), icon: "home" });

  it.each(["en", "he"] as const)("a saved question matches on-device, leads the records and opens its sheet (%s)", async (lang) => {
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
    await flush();
    expect(h.actions.selectFamilyTopic).toHaveBeenCalledWith("t1");
    // Not set aside: nothing to bring back, so no write.
    expect(h.actions.updateFamilyTopic).not.toHaveBeenCalled();
    expect(h.actions.setActiveTab).toHaveBeenLastCalledWith("overview");
    expect(h.openSheet).toHaveBeenCalledOnce();
    expect(h.openSheet).toHaveBeenCalledWith();
    // The sheet opens on the chosen question.
    expect(h.actions.selectFamilyTopic.mock.invocationCallOrder[0]).toBeLessThan(h.openSheet.mock.invocationCallOrder[0]);
    // The kind travels in analytics; the question never enters the index.
    expect(JSON.stringify(getSearchIndex())).not.toContain("invented puddle game");
    expect(searchCatalog("puddle game calm")).toEqual([]);
  });

  /** A small stand-in for the topic store: the active question and each
   *  question's aside flag, written the way useFamilyTopics writes them. */
  function topicStore(topics: FamilyTopic[]) {
    const store = { topics: topics.map(item => ({ ...item })), activeId: null as string | null, failWrite: false };
    h.topics = store.topics;
    h.actions.updateFamilyTopic.mockImplementation(async (id: string, patch: { aside?: boolean }) => {
      await Promise.resolve();
      if (store.failWrite) throw new Error("invented write failure");
      const item = store.topics.find(entry => entry.id === id)!;
      if (patch.aside) item.asideAt = "2026-10-11T00:00:00Z"; else delete item.asideAt;
      if (patch.aside && store.activeId === id) store.activeId = null;
    });
    // Like ArborContext.selectFamilyTopic: any open question can be chosen; it
    // never clears the aside flag itself.
    h.actions.selectFamilyTopic.mockImplementation((id: string) => { store.activeId = id; });
    return store;
  }

  it("IA-05r: a set-aside question found in search comes back first, then becomes the active one", async () => {
    const store = topicStore([topic("t1", "Invented meadow question"), { ...topic("t2", "Invented meadow nap question", "child-a", "support"), asideAt: "2026-10-05T00:00:00Z" }]);
    const found = row(render("meadow nap").record, "topic-t2");
    found.go();
    await flush();
    expect(h.actions.updateFamilyTopic).toHaveBeenCalledWith("t2", { aside: false });
    expect(h.actions.updateFamilyTopic.mock.invocationCallOrder[0]).toBeLessThan(h.actions.selectFamilyTopic.mock.invocationCallOrder[0]);
    expect(store.topics.find(item => item.id === "t2")!.asideAt).toBeUndefined();
    expect(store.activeId).toBe("t2");
    expect(h.openSheet).toHaveBeenCalledOnce();
    expect(h.actions.selectFamilyTopic.mock.invocationCallOrder[0]).toBeLessThan(h.openSheet.mock.invocationCallOrder[0]);
  });

  it("IA-05r: if bringing it back fails, nothing is chosen and the sheet opens on the list", async () => {
    const store = topicStore([{ ...topic("t2", "Invented meadow nap question"), asideAt: "2026-10-05T00:00:00Z" }]);
    store.failWrite = true;
    row(render("meadow").record, "topic-t2").go();
    await flush();
    expect(h.actions.selectFamilyTopic).not.toHaveBeenCalled();
    expect(store.activeId).toBeNull();
    expect(store.topics[0].asideAt).toBe("2026-10-05T00:00:00Z");
    expect(h.openSheet).toHaveBeenCalledOnce();
  });

  it("NEGATIVE CONTROL: choosing directly (the old search row) leaves the question set aside while making it active", () => {
    const store = topicStore([{ ...topic("t2", "Invented meadow nap question"), asideAt: "2026-10-05T00:00:00Z" }]);
    // The round-1 row called selectFamilyTopic(topic.id) and nothing else.
    h.actions.selectFamilyTopic("t2");
    expect(store.activeId).toBe("t2");
    expect(store.topics[0].asideAt).toBe("2026-10-05T00:00:00Z");
    expect(h.actions.updateFamilyTopic).not.toHaveBeenCalled();
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
    expect(thread).toMatchObject({ kind: "thread", icon: "forum", group: { id: "talk", label: door, icon: "forum" }, sub: translate(lang, "sm.threadSub") });
    // IA-05r re-pin: the header already says Talk with Arbor; no crumb repeats it.
    expect(thread.crumb).toBeUndefined();
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
    // IA-05r re-pin: header, label and second line no longer all read "Talk with Arbor".
    expect(coach.label).toBe("Talk with Arbor");
    expect(coach.group?.label).toBe("Talk with Arbor");
    expect(coach.crumb).toBeUndefined();
    expect(coach.sub).toBe("");
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

  it.each(["en", "he"] as const)("IA-05r: no line of a Talk row names the old Ask route (%s)", (lang) => {
    h.lang = lang;
    h.records = { ...empty(), conversations: [conversation] };
    const result = render("harbour");
    const lines = [result.ask!.sub, row(result.record, "thread-c7").sub];
    for (const line of lines) {
      expect(line).not.toMatch(/\bAsk\b/);
      expect(line).not.toContain("שאל את ארבור");
    }
    if (lang === "en") expect(result.ask!.sub).toContain("Talk with Arbor");
    else expect(/[A-Za-z]/.test(lines.join(" "))).toBe(false);
  });

  it("NEGATIVE CONTROL: a row of a place still moves the page", () => {
    const milestones = row(render("milestones").catalog, "route:milestones");
    milestones.go();
    expect(h.actions.setActiveTab).toHaveBeenCalledWith("milestones");
    expect(h.talk).not.toHaveBeenCalled();
  });
});
