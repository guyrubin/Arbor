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
    expect(rows.find((r) => r.kind === "milestone")!.text).toBe("You noticed: Calms after you leave");
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

describe("#/development order, stamp and budget (W2-GROWTH r1)", () => {
  it("opens on What's new with {name}; New since sits above the focus card; no count trio", async () => {
    h.locale = "en";
    const html = await render();
    expect(html).toMatch(/<h1[^>]*>What&#x27;s new with Dylan<\/h1>/);
    const since = html.indexOf('data-testid="growth-new-since"');
    const focus = html.indexOf('id="growth-weekly-focus"');
    expect(since).toBeGreaterThan(-1);
    expect(since).toBeLessThan(focus);
    expect(html).not.toContain("growth-hub-hero-zero-line");
    expect(html).not.toMatch(/\d+ noticed · \d+ areas?/);
  });
  it("W2-GROWTH r2: at lg the focus takes the inline-start 7/12 and New since is a sticky 5/12 aside (grid lines, no order hacks)", async () => {
    h.locale = "en";
    const html = await render();
    expect(html).toMatch(/class="[^"]*lg:grid lg:grid-cols-12[^"]*"/);
    expect(html).toMatch(/data-module="growth-new-since"[^>]*class="[^"]*lg:sticky[^"]*lg:col-span-5 lg:col-start-8 lg:row-start-1/);
    expect(html).toMatch(/data-module="growth-weekly-focus" class="[^"]*lg:col-start-1 lg:row-start-1 lg:col-span-7/);
    expect(SRC).not.toMatch(/\blg:order-|\b(?:ml|mr|pl|pr|left|right)-\d/);
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
    expect(top).toEqual(["growth-new-since", "growth-weekly-focus", "growth-record", "growth-go-deeper"]);
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
