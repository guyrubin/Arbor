/**
 * W2-GROWTH critic round 1 (#/development) + B-GROWTH-NEW-1A/1B — the guards
 * that keep the round's findings from returning:
 *  - Law 8: the Hebrew hub prints no Latin chrome — language names and the
 *    stored English context ("Home") never reach the page; the parent's own
 *    words (notes, phrases) and the child's name are data and are exempt.
 *  - The page opens on "What's new with {name}" + New-since rows in the
 *    parent's own words (no count trio, no type labels as titles).
 *  - The primary-move stamp is on the observe GROUP; the focus section is not
 *    stamped (the 851 px container false positive).
 *  - Law 7: top-level modules = stamps minus demoted ≤ the contract budget;
 *    Words and Tree are views of ONE record card; the tail is demoted.
 *  - After "Not sure" the card names the date (an open loop, not a nudge).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { buildNewSince, newSinceAnchor, noteSnippet, NEW_SINCE_MAX } from "../../lib/growthNewSince";
import { SURFACE_CONTRACTS } from "../../lib/surfaceContract";
import type { BehaviorLog, Milestone } from "../../types";

const DAY = 86_400_000;
const NOW = Date.now();
const ago = (d: number) => new Date(NOW - d * DAY).toISOString();

const h = vi.hoisted(() => ({
  locale: "he" as "en" | "he",
  langObs: [] as Array<{ id: string; timestamp: string; language: string; phrase: string }>,
  state: {
    childProfile: { id: "c1", name: "Dylan", age: 1, birthDate: "2025-03-01", ageMonths: 18 } as Record<string, unknown>,
    milestones: [] as unknown[],
    behaviorLogs: [] as unknown[],
    playLogs: [] as unknown[],
    setActiveTab: () => {},
    setMilestoneObservation: () => {},
  },
}));

vi.mock("../../context/ArborContext", () => ({ useArbor: () => h.state, useArborOptional: () => h.state }));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ uiLang: h.locale, t: (k: string, v?: Record<string, string | number>) => translate(h.locale, k, v) }),
}));
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: (_id: string, name: string) => ({ items: name === "langObs" ? h.langObs : [], upsert: () => {}, loading: false }),
}));
vi.mock("../sections/DevScoreCard", () => ({ default: () => null }));
vi.mock("../sections/ScreeningSheet", () => ({ default: () => null }));
vi.mock("../ui/EvidenceChip", () => ({ EvidenceChip: () => null }));
// W2-GROWTH r2: RecordByDomain is the Map view inside the one Record card (no stamp of its own).
vi.mock("../growth/RecordByDomain", () => ({ default: () => <div data-testid="record-by-domain" /> }));
vi.mock("../growth/MonthInReview", () => ({ default: () => null }));
vi.mock("../growth/ArborTreeCard", () => ({ default: () => null }));
vi.mock("../ui/ContentActionBar", () => ({ ContentWhyLine: () => null }));

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

const SRC = readFileSync(new URL("./DevelopmentTab.tsx", import.meta.url), "utf8");

const ms = (over: Partial<Milestone> & Pick<Milestone, "id">): Milestone =>
  ({ domain: "language_communication", title: `title-${over.id}`, description: "d", checked: false, ageMonths: 18, ...over }) as Milestone;
const log = (over: Partial<BehaviorLog> & Pick<BehaviorLog, "id" | "timestamp">): BehaviorLog =>
  ({ behaviorType: "Moment", intensity: 1, durationMinutes: 0, trigger: "", context: "Home", ...over }) as BehaviorLog;

const render = async () => {
  const { default: DevelopmentTab } = await import("./DevelopmentTab");
  return renderToStaticMarkup(<DevelopmentTab />);
};
const text = (html: string) =>
  html.replace(/<span class="msr\b[^"]*"[^>]*>[^<]*<\/span>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
function latinChrome(html: string, data: string[]): string[] {
  let s = text(html);
  for (const d of data) s = s.split(d).join(" ");
  return s.match(/[A-Za-z]{2,}/g) ?? [];
}

beforeAll(async () => { await import("./DevelopmentTab"); }, 60_000);
beforeEach(() => {
  h.locale = "he";
  h.langObs = [
    { id: "w1", timestamp: ago(1), language: "English", phrase: "moon" },
    { id: "w2", timestamp: ago(2), language: "English", phrase: "more juice" },
    { id: "w3", timestamp: ago(40), language: "Hebrew", phrase: "old word" },
  ];
  h.state.milestones = [
    ms({ id: "m1", title: "Calms after you leave", checked: true, observationStatus: "yes", observationUpdatedAt: ago(1) }),
    ms({ id: "m2", title: "Points to show you", observationStatus: "not_sure", observationUpdatedAt: ago(3) }),
  ];
  h.state.behaviorLogs = [
    log({ id: "b1", timestamp: ago(2), notes: "Dylan laughed at the dog" }),
    log({ id: "b2", timestamp: ago(3), behaviorType: "Departure Refusal" }),
  ];
  h.state.childProfile = { id: "c1", name: "Dylan", age: 1, birthDate: "2025-03-01", ageMonths: 18 };
});

describe("lib/growthNewSince — the parent's own words, counts only", () => {
  const t = (k: string, v?: Record<string, string | number>) => translate("en", k, v);
  it("builds dated rows since the anchor: noticed milestone, words per language, the newest note", () => {
    const rows = buildNewSince({
      sinceMs: NOW - 7 * DAY, milestones: h.state.milestones as Milestone[], langObs: h.langObs,
      behaviorLogs: h.state.behaviorLogs as BehaviorLog[], milestoneTitle: (m) => m.title, t,
    });
    expect(rows.map((r) => r.kind).sort()).toEqual(["milestone", "moment", "words"]);
    expect(rows.find((r) => r.kind === "milestone")!.text).toBe("You marked ‘Seen it’: Calms after you leave");
    const words = rows.find((r) => r.kind === "words")!;
    expect(words.text).toBe("2 new words in English:");
    expect(words.quote).toBe("“moon”, “more juice”");
    const moment = rows.find((r) => r.kind === "moment")!;
    expect(moment.quote).toBe("“Dylan laughed at the dog”");
    // nothing older than the anchor; a not-sure mark is not "noticed"
    expect(JSON.stringify(rows)).not.toContain("old word");
    expect(JSON.stringify(rows)).not.toContain("Points to show you");
    // the type label is never a row title
    expect(JSON.stringify(rows)).not.toMatch(/Departure Refusal|A moment/);
    // counts only — no ratio, no comparison words
    expect(JSON.stringify(rows)).not.toMatch(/\bof \d|%|more than|fewer|behind|ahead/i);
  });
  it("caps at four rows and collapses on a zero-event visit", () => {
    const many = Array.from({ length: 6 }, (_, i) => ms({ id: `x${i}`, checked: true, observationUpdatedAt: ago(1) }));
    expect(buildNewSince({ sinceMs: NOW - DAY * 7, milestones: many, langObs: [], behaviorLogs: [], milestoneTitle: (m) => m.title, t })).toHaveLength(NEW_SINCE_MAX);
    expect(buildNewSince({ sinceMs: NOW, milestones: many, langObs: [], behaviorLogs: [], milestoneTitle: (m) => m.title, t })).toEqual([]);
  });
  it("anchors on the previous visit, else the last seven days; notes are cut on a word", () => {
    expect(newSinceAnchor(ago(2), NOW)).toBe(NOW - 2 * DAY);
    expect(newSinceAnchor(null, NOW)).toBe(NOW - 7 * DAY);
    const cut = noteSnippet("word ".repeat(30));
    expect(cut.length).toBeLessThanOrEqual(61);
    expect(cut.endsWith("…")).toBe(true);
  });
});

describe("#/development Hebrew screen — no Latin chrome (Law 8)", () => {
  it("the New-since rows, focus card and record print no Latin outside the parent's words", async () => {
    const html = await render();
    expect(html).toContain('data-testid="growth-new-since"');
    const leftovers = latinChrome(html, ["Dylan laughed at the dog", "moon", "more juice", "Calms after you leave", "Points to show you", "Dylan"]);
    expect(leftovers).toEqual([]);
    expect(html).toContain("אנגלית"); // the words row names the language in Hebrew
    expect(html).not.toContain(">Home");
  });
  it("the words ledger (Record → Words) prints language names in Hebrew", async () => {
    const { default: FirstWordsLedger } = await import("../growth/FirstWordsLedger");
    const html = renderToStaticMarkup(<FirstWordsLedger />);
    expect(latinChrome(html, ["moon", "more juice", "old word", "Dylan"])).toEqual([]);
    expect(html).toContain("אנגלית");
  });
});

describe("B-GROWTH-NEW-2B — the child's word leads New since; a count never leads", () => {
  it("rows: words → milestone → moment; the word row names the child (EN + HE); no year on a row", async () => {
    for (const lang of ["en", "he"] as const) {
      const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
      const rows = buildNewSince({
        sinceMs: NOW - 7 * DAY, milestones: h.state.milestones as Milestone[], langObs: h.langObs,
        behaviorLogs: h.state.behaviorLogs as BehaviorLog[], milestoneTitle: (m) => m.title, t, name: "Dylan",
      });
      expect(rows.map((r) => r.kind)).toEqual(["words", "milestone", "moment"]);
      expect(rows[0].text).toContain(lang === "en" ? "Dylan's new words in English:" : "המילים החדשות של");
    }
    const t = (k: string, v?: Record<string, string | number>) => translate("en", k, v);
    const one = buildNewSince({
      sinceMs: NOW - 7 * DAY, milestones: [], langObs: [h.langObs[0]], behaviorLogs: h.state.behaviorLogs as BehaviorLog[],
      milestoneTitle: (m) => m.title, t, name: "Dylan",
    });
    expect(one[0].text).toBe("Dylan's new word:");
    expect(one[0].quote).toBe("“moon”");
    expect(translate("he", "elev.growth.newSince.word.oneNamed", { name: "Dylan" })).toContain("המילה החדשה של");
    // with no word and no milestone the moments row is alone; with a milestone it never leads
    const noWord = buildNewSince({
      sinceMs: NOW - 7 * DAY, milestones: h.state.milestones as Milestone[], langObs: [], behaviorLogs: h.state.behaviorLogs as BehaviorLog[],
      milestoneTitle: (m) => m.title, t,
    });
    expect(noWord[0].kind).toBe("milestone");
    h.locale = "en";
    const html = await render();
    const well = html.slice(html.indexOf('data-testid="growth-new-since"')).split('</aside>')[0];
    expect(well).toBeTruthy();
    expect(well).not.toMatch(/\b20\d\d\b/);
    expect(SRC).toMatch(/data-testid="growth-focus-hint"/);
    expect(SRC.match(/<p[^>]*data-testid="growth-focus-hint"[^>]*>/)?.[0] ?? "").toContain("var(--arbor-muted)");
  });
});

describe("#/development Hebrew takes the child's gender from the profile — never a slash (W2-GROWTH r2, Law 8)", () => {
  const SLASH = /[א-ת]\/[א-ת]/;
  const setCatalogue = (gender?: string) => {
    h.locale = "he";
    h.state.childProfile = { id: "c1", name: "Dylan", age: 1, birthDate: "2025-03-01", ageMonths: 18, gender };
    h.state.milestones = [
      ms({ id: "cdc-36m-1", title: "Calms after you leave", observationStatus: "not_sure", observationUpdatedAt: ago(3) }),
      ms({ id: "cdc-36m-2", title: "Notices other children and joins them to play", checked: true, observationStatus: "yes", observationUpdatedAt: ago(1) }),
    ];
  };
  it("a girl: the focus H2 and the New-since row are feminine, one form each", async () => {
    setCatalogue("girl");
    const html = await render();
    expect(html).toMatch(/<h2 id="growth-weekly-focus"[^>]*>נרגעת אחרי שאתם הולכים<\/h2>/);
    expect(html).toContain("סימנתם ‘ראיתי’: מצטרפת לילדים אחרים");
    expect(text(html).match(new RegExp(`.{0,24}${SLASH.source}.{0,24}`))?.[0]).toBeUndefined();
  });
  it("a boy, and no gender on file: one masculine form, never a slash", async () => {
    for (const g of ["boy", undefined]) {
      setCatalogue(g);
      const html = await render();
      expect(html).toMatch(/<h2 id="growth-weekly-focus"[^>]*>נרגע אחרי שאתם הולכים<\/h2>/);
      expect(html).toContain("סימנתם ‘ראיתי’: מצטרף לילדים אחרים");
      expect(text(html).match(new RegExp(`.{0,24}${SLASH.source}.{0,24}`))?.[0]).toBeUndefined();
    }
  });
  it("negative control: the catalogue itself still carries the slash the seam resolves", () => {
    expect(translate("he", "ms.item.cdc-36m-1.title")).toMatch(SLASH);
  });
});

describe("#/development order, stamp and budget (W2-GROWTH r1)", () => {
  it("opens on the child; focus and record precede recent updates in reading order", async () => {
    h.locale = "en";
    const html = await render();
    expect(html).toMatch(/<h1[^>]*>What&#x27;s new with Dylan<\/h1>/);
    const since = html.indexOf('data-testid="growth-new-since"');
    const focus = html.indexOf('id="growth-weekly-focus"');
    expect(since).toBeGreaterThan(-1);
    expect(focus).toBeLessThan(html.indexOf('data-module="growth-record"'));
    expect(html.indexOf('data-module="growth-record"')).toBeLessThan(since);
    expect(html).not.toContain("growth-hub-hero-zero-line");
    expect(html).not.toMatch(/\d+ noticed · \d+ areas?/);
  });
  it("the portrait retains a named record and one notice action in both languages", async () => {
    for (const locale of ["en", "he"]) {
      h.locale = locale;
      const html = await render();
      expect(html).toContain('aria-labelledby="growth-record-title"');
      expect(html).toContain('aria-labelledby="growth-weekly-focus"');
      expect(html.match(/data-primary-move=/g)).toHaveLength(1);
      expect(html).not.toMatch(/\b(?:ml|mr|pl|pr|left|right)-\d/);
    }
  });
  it("stamps the observe group, never the section", async () => {
    h.locale = "en";
    const html = await render();
    expect(html).toMatch(/<div class="[^"]*" role="group" aria-label="[^"]*" data-primary-move="notice-milestone">/);
    expect(html).not.toMatch(/<section[^>]*data-primary-move/);
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
  });
  it("top-level modules = stamps minus demoted ≤ the contract budget; Words + Tree live in the one record card", async () => {
    const html = await render();
    const stamps = [...html.matchAll(/<[^>]*data-module="([^"]+)"[^>]*>/g)];
    const top = stamps.filter((m) => !m[0].includes("data-module-demoted")).map((m) => m[1]);
    const budget = SURFACE_CONTRACTS.find((c) => c.route === "development")!.moduleBudget;
    // W2-GROWTH r2: the four blocks B-GROWTH-02 names, by name; RecordByDomain
    // is the Record card's Map view, never a second top-level record object.
    expect(top).toEqual(["growth-weekly-focus", "growth-record", "growth-new-since", "growth-go-deeper"]);
    const record = html.slice(html.indexOf('data-module="growth-record"'), html.indexOf('data-module="growth-go-deeper"'));
    expect(record).toContain('data-testid="record-by-domain"');
    expect(SRC).not.toMatch(/\n {6}<RecordByDomain \/>/);
    expect(top.length).toBeLessThanOrEqual(budget);
    expect(html).toContain('data-module-disclosure="growth-more"');
    for (const tab of ["map", "words", "tree"]) expect(html).toContain(`data-testid="growth-record-tab-${tab}"`);
    // no unstamped top-level object besides the page header and the disclosure
    expect(SRC).not.toMatch(/\n {6}<FirstWordsLedger \/>|\n {6}<ArborTreeCard \/>|\n {6}<MonthInReview \/>/);
  });
  it("after 'Not sure' the card names the date to look again (an open loop, not a nudge)", async () => {
    h.locale = "en";
    h.state.milestones = [ms({ id: "m2", title: "Points to show you", observationStatus: "not_sure", observationUpdatedAt: ago(3) })];
    const html = await render();
    expect(html).toContain('data-testid="growth-observe-again"');
    expect(html).toMatch(/You marked ‘Not sure’ on [A-Z][a-z]{2} \d{1,2}, \d{4} — look again this week/);
  });
});
