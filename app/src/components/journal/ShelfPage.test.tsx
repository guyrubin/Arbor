import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

/* B-LOOP-11 — a shelf page: the suggestion block shows ONE practice (the
   chooser scoped to the shelf) and ONE Notice card for the shelf; "Try it
   today" makes it the day's practice through the B-LOOP-09 override; the
   entries are filtered by shelfOf only; EN + HE; one gradient (the coach
   band); three modules. */

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});

import ShelfPage, { type ShelfDayGroup } from "./ShelfPage";
import { PRACTICES } from "../../content/practices";
import { ALL_MILESTONES } from "../../lib/milestoneData";
import { shelfOfMilestone } from "../../lib/milestones/selectByShelf";
import { choosePractice, practiceCandidates } from "../../lib/practice/choosePractice";
import { readTodayPin, todayPinKey, writeTodayPin } from "../../lib/practice/todayPin";
import { shelfNotice, shelfPractice, shelfSignalIds, signalsOnShelf } from "../../lib/journal/shelfView";
import { toObservations } from "../../lib/observations";
import { translate } from "../../lib/i18n";
import { loopFirewallHits } from "../../lib/loop/firewall";
import type { BehaviorLog, Milestone } from "../../types";
import type { TimelineSignal } from "../../lib/signalTimeline";

const noop = () => undefined;
const practice = PRACTICES.find((p) => p.shelf === "words" && p.milestoneId)!;
const milestone = ALL_MILESTONES.find((m) => shelfOfMilestone(m) === "words")!;
const decode = (html: string) => html.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const groups: ShelfDayGroup[] = [{ key: "2026-10-05", label: "Yesterday", rows: [{ id: "moment-a", title: "A moment", words: "Said big ball at the park", when: "9:00" }] }];

const render = (opts: { lang?: "en" | "he"; count?: number; withPractice?: boolean; isToday?: boolean; withNotice?: boolean } = {}) => {
  state.lang = opts.lang ?? "en";
  return renderToStaticMarkup(
    <ShelfPage
      shelf="words"
      childName="Dylan"
      gender="boy"
      count={opts.count ?? 3}
      practice={opts.withPractice === false ? null : practice}
      practiceIsToday={opts.isToday}
      onTryToday={noop}
      notice={opts.withNotice === false ? null : milestone}
      noticeHandlers={{ onAnswer: noop }}
      groups={groups}
      onOpenEntry={noop}
      onBack={noop}
      onAdd={noop}
      primaryMoveProps={{ "data-primary-move": "open-shelf" }}
    />,
  );
};

describe("ShelfPage — the suggestion block", () => {
  it("one practice and one Notice card for the shelf, above the entries", () => {
    const html = render();
    expect((html.match(/data-testid="shelf-practice"/g) || []).length).toBe(1);
    expect(html).toContain(`data-practice-id="${practice.id}"`);
    expect((html.match(/data-testid="notice-card"/g) || []).length).toBe(1);
    expect(html).toContain(`data-milestone-id="${milestone.id}"`);
    expect(html.indexOf('data-testid="shelf-practice"')).toBeLessThan(html.indexOf('data-module="shelf-entries"'));
    expect(html.indexOf('data-testid="notice-card"')).toBeLessThan(html.indexOf('data-module="shelf-entries"'));
  });

  it('"Try it today" carries the page stamp; once it is today\'s practice the button becomes a receipt and the stamp moves to the add row', () => {
    const open = render();
    expect(open).toMatch(/data-testid="shelf-try-today"[^>]*data-primary-move="open-shelf"/);
    expect((open.match(/data-primary-move=/g) || []).length).toBe(1);
    const done = render({ isToday: true });
    expect(done).not.toContain('data-testid="shelf-try-today"');
    expect(text(done)).toContain(translate("en", "elev.shelfJournal.tryToday.done"));
    expect(done).toMatch(/data-testid="shelf-add-moment"[^>]*data-primary-move="open-shelf"/);
    expect((done.match(/data-primary-move=/g) || []).length).toBe(1);
  });

  it("an empty shelf reads as normal (editorial line), never 0 or empty, EN + HE", () => {
    for (const lang of ["en", "he"] as const) {
      const html = render({ lang, count: 0 });
      expect(text(html)).toContain(translate(lang, "elev.shelfJournal.page.empty.lead"));
      expect(text(html)).toContain(translate(lang, "elev.shelfJournal.page.none"));
      expect(html.match(/data-testid="shelf-page-count"[^>]*>([^<]*)</)![1]).not.toMatch(/\b0\b/);
      expect(loopFirewallHits(text(html))).toEqual([]);
    }
  });

  it("P5-LOOP c2 r1: the empty line promises only what renders — no Notice card, no 'one thing to notice' (EN + HE)", () => {
    for (const lang of ["en", "he"] as const) {
      const noNotice = text(render({ lang, count: 0, withNotice: false }));
      expect(noNotice).toContain(translate(lang, "elev.shelfJournal.page.empty.bodyTry"));
      expect(noNotice).not.toMatch(lang === "en" ? /one thing to notice/i : /לשים לב/);
      const both = render({ lang, count: 0 });
      expect(text(both)).toContain(translate(lang, "elev.shelfJournal.page.empty.body"));
      expect(both).toContain('data-testid="notice-card"');
      const noticeOnly = text(render({ lang, count: 0, withPractice: false }));
      expect(noticeOnly).toContain(translate(lang, "elev.shelfJournal.page.empty.bodyNotice"));
      expect(noticeOnly).not.toMatch(lang === "en" ? /thing to try/i : /לנסות/);
      const neither = text(render({ lang, count: 0, withPractice: false, withNotice: false }));
      expect(neither).toContain(translate(lang, "elev.shelfJournal.page.empty.lead"));
      expect(neither).not.toMatch(lang === "en" ? /thing to try|thing to notice/i : /לנסות|לשים לב/);
    }
  });

  it("P5-LOOP c2 r1: the coach wash is the caption row's own block; the H2 starts below it on white (no absolute h-14 band)", () => {
    const html = render();
    expect(html).toMatch(/data-testid="shelf-practice-caption"[^>]*style="background:var\(--arbor-coach-grad\)/);
    const cap = html.slice(html.indexOf('data-testid="shelf-practice-caption"'));
    expect(cap.indexOf("</p>")).toBeLessThan(cap.indexOf("<h2"));
    const src = readFileSync(path.resolve(__dirname, "ShelfPage.tsx"), "utf8");
    expect(src).not.toMatch(/absolute inset-x-0 top-0 h-14/);
    expect(src).toMatch(/<div className="px-4 pb-4 pt-3">\s*<h2/);
  });

  it("B-LOOP-NEW-1d: the latest entry in the parent's words leads 'On this shelf' (44 px, clay-dim rule, day caption) and is not repeated below", () => {
    for (const lang of ["en", "he"] as const) {
      const html = render({ lang });
      const lead = html.match(/<button[^>]*data-testid="shelf-lead-quote"[^>]*>/)![0];
      expect(lead).toMatch(/min-h-11/);
      expect(html).toMatch(/border-s-2 ps-3 t-lg[^"]*" style="border-color:var\(--arbor-clay-dim\);font-family:var\(--font-editorial\);color:var\(--arbor-ink-soft\)"/);
      expect(html.indexOf('id="shelf-entries-title"')).toBeLessThan(html.indexOf('data-testid="shelf-lead-quote"'));
      expect(html.indexOf('data-testid="shelf-lead-quote"')).toBeLessThan(html.indexOf('data-testid="shelf-add-moment"'));
      expect((text(html).match(/Said big ball at the park/g) || []).length).toBe(1);
      expect(html).not.toContain('data-testid="shelf-entry"');
      expect(text(html)).toContain("Yesterday");
    }
  });

  it("no practice → one quiet line, the stamp on the add row", () => {
    const html = render({ withPractice: false });
    expect(html).toContain('data-testid="shelf-no-practice"');
    expect(html).toMatch(/data-testid="shelf-add-moment"[^>]*data-primary-move="open-shelf"/);
  });

  it("three modules; ONE gradient (the coach band); 44 px controls; logical properties", () => {
    const html = render();
    expect([...html.matchAll(/data-module="([a-z-]+)"/g)].map((m) => m[1])).toEqual(["shelf-header", "shelf-suggested", "shelf-entries"]);
    const src = readFileSync(path.resolve(__dirname, "ShelfPage.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect((src.match(/gradient|-grad[)"]/gi) || []).length).toBe(1);
    expect((src.match(/var\(--arbor-coach-grad\)/g) || []).length).toBe(1);
    expect(src).not.toMatch(/\b(ml|mr|pl|pr)-\d|\bleft-\d|\bright-\d/);
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    for (const b of html.match(/<button[^>]*>/g) ?? []) expect(b).toMatch(/min-h-11|min-h-\[44px\]/);
  });

  it("the entries are the caller's day groups (the parent's words lead), EN + HE chrome", () => {
    for (const lang of ["en", "he"] as const) {
      const html = render({ lang });
      expect(text(html)).toContain("Said big ball at the park"); // (as the lead quote, B-LOOP-NEW-1d)
      expect(text(html)).toContain(translate(lang, "elev.shelfJournal.add", { shelf: translate(lang, "elev.shelves.words") }));
      expect(text(html)).toContain(translate(lang, "elev.shelfJournal.back"));
    }
  });
});

describe('"Try it today" — the B-LOOP-09 override, no chooser change', () => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  afterEach(() => store.clear());

  it("the pinned practice becomes the day's practice (via today); a dose row wins", () => {
    const today = new Date(2026, 9, 6, 9);
    const input = { childId: "c1", milestones: ALL_MILESTONES.map((m) => ({ ...m })) as Milestone[], comparisonMonths: 30, practices: PRACTICES, coverage: {}, today };
    const shelf = shelfPractice(input, "words");
    expect(shelf?.shelf).toBe("words");
    const chooserDefault = choosePractice(input);
    expect(writeTodayPin("c1", shelf!.practice.id, today)).toBe(true);
    expect(store.has(todayPinKey("c1", today))).toBe(true);
    const pinned = choosePractice({ ...input, todayPracticeId: readTodayPin("c1", today) });
    expect(pinned).toMatchObject({ via: "today", practice: { id: shelf!.practice.id }, shelf: "words" });
    // the pin expires with the day
    expect(readTodayPin("c1", new Date(2026, 9, 7, 9))).toBeUndefined();
    expect(chooserDefault).not.toBeNull();
  });

  it("the shelf practice is the chooser's own candidate for that shelf (scoped by the candidateFilter seam)", () => {
    const today = new Date(2026, 9, 6, 9);
    const input = { childId: "c1", milestones: ALL_MILESTONES.map((m) => ({ ...m })) as Milestone[], comparisonMonths: 30, practices: PRACTICES, coverage: {}, today };
    const all = practiceCandidates(input, 9);
    const words = all.find((c) => c.shelf === "words");
    expect(shelfPractice(input, "words")?.practice.id).toBe(words?.practice.id);
    expect(shelfNotice(input.milestones, 30, "words", today)?.shelf).toBe("words");
    expect(shelfNotice(input.milestones, null, "words", today)).toBeNull();
  });
});

describe("the shelf's entries — filtered by shelfOf only", () => {
  it("maps observations on the shelf to the thread's signal ids and keeps nothing else", () => {
    const log = (id: string, behaviorType: string, extra: Partial<BehaviorLog> = {}): BehaviorLog =>
      ({ id, behaviorType, timestamp: "2026-10-05T08:00:00Z", trigger: "x", response: "", intensity: 1, context: "home", ...extra }) as BehaviorLog;
    const observations = toObservations(
      { behaviorLogs: [log("a", "Sleep Meltdown"), log("b", "A moment", { shelf: "words" }), log("c", "A moment")] },
      { id: "c1", age: 3 },
    );
    expect([...shelfSignalIds(observations, "sleep")]).toEqual(["moment-a"]);
    expect([...shelfSignalIds(observations, "words")]).toEqual(["moment-b"]);
    const signals = ["moment-a", "moment-b", "moment-c", "plan-x"].map((id) => ({ id, kind: "moment", at: "2026-10-05T08:00:00Z", tone: "lav" }) as TimelineSignal);
    expect(signalsOnShelf(signals, observations, "words").map((s) => s.id)).toEqual(["moment-b"]);
    expect(signalsOnShelf(signals, observations, "feelings").map((s) => s.id)).toEqual(["moment-c"]);
  });
});
