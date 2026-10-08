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

import ShelfPage, { shelfEntryGroups, type ShelfDayGroup } from "./ShelfPage";
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

const render = (opts: { lang?: "en" | "he"; count?: number; withPractice?: boolean; isToday?: boolean; withNotice?: boolean; groups?: ShelfDayGroup[]; leadWords?: { id: string; text: string; day: string } | null } = {}) => {
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
      groups={opts.groups ?? groups}
      leadWords={opts.leadWords ?? null}
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

  /* P7-DESIGN fix r1 (framer ruling R5; journal design "lead quote" ruling):
     the shelf's words keep their words and lose the accent — no 2 px rule, not
     lifted above the list: the FIRST ordinary entry row under their day head,
     in the entry rows' editorial face; on Words they are the tile's own quote. */
  it("R5: the parent's words are the first ordinary entry row under their day head — no lifted lead, no rule (EN + HE)", () => {
    for (const lang of ["en", "he"] as const) {
      const html = render({ lang });
      expect(html).not.toContain('data-testid="shelf-lead-quote"');
      expect(html).not.toContain("--arbor-clay-dim");
      const add = html.indexOf('data-testid="shelf-add-moment"');
      const head = html.indexOf(">Yesterday<");
      const row = html.indexOf('data-testid="shelf-entry"');
      expect(add).toBeGreaterThan(-1);
      expect(add).toBeLessThan(head);
      expect(head).toBeLessThan(row);
      expect(html.slice(row - 200, row + 400)).toMatch(/data-lead="true"/);
      expect((text(html).match(/Said big ball at the park/g) || []).length).toBe(1);
      expect(html).toMatch(/data-testid="shelf-entry-words" class="leading-snug line-clamp-3" style="font-family:var\(--font-editorial\)/);
    }
    const src = readFileSync(path.resolve(__dirname, "ShelfPage.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/border-s-2/);
    // NEGATIVE CONTROL: no clamp on a `block` element (the built CSS orders .block after .line-clamp-*)
    const classes = [...src.matchAll(/className="([^"]*)"/g)].map((m) => m[1]);
    expect(classes.filter((c) => /\bline-clamp-\d/.test(c) && /(^|\s)block(\s|$)/.test(c))).toEqual([]);
  });

  it("R5: shelfEntryGroups — the words row moves to the top of ITS day; tile words that are no row (Words' kept quote) open their own day group first", () => {
    const g: ShelfDayGroup[] = [
      { key: "d1", label: "Today", rows: [{ id: "a", title: "Bath", when: "9:00" }] },
      { key: "d2", label: "Yesterday", rows: [{ id: "b", title: "Park", when: "8:00" }, { id: "c", title: "Song", words: "Sang it all", when: "7:00" }] },
    ];
    const moved = shelfEntryGroups(g, null);
    expect(moved.map((x) => x.rows.map((r) => r.id))).toEqual([["a"], ["c", "b"]]);
    expect(moved[1].rows[0].lead).toBe(true);
    const kept = shelfEntryGroups(g, { id: "keepsakes:q1", text: "I did it all by my own self!", day: "6 Oct" });
    expect(kept[0]).toMatchObject({ label: "6 Oct", rows: [{ id: "keepsakes:q1", words: "I did it all by my own self!", lead: true, keptQuote: true }] });
    expect(kept.slice(1)).toEqual(g);
    const same = shelfEntryGroups(g, { id: "x", text: "Sang  it all", day: "Yesterday" });
    expect(same.map((x) => x.rows.map((r) => r.id))).toEqual([["a"], ["c", "b"]]);
    expect(shelfEntryGroups([], null)).toEqual([]);
  });

  it("R5 on Words: the tile's kept quote is the first row (no chevron, opens nothing), its day as the head; HE quote pair ״…״", () => {
    for (const lang of ["en", "he"] as const) {
      const html = render({ lang, groups: [], leadWords: { id: "keepsakes:q1", text: "I did it all by my own self!", day: "6 Oct" } });
      const row = /<div[^>]*data-testid="shelf-entry"[^>]*data-kept-quote="true"[^>]*>([\s\S]*?)<\/div>/.exec(html);
      expect(row).toBeTruthy();
      expect(row![1]).not.toContain("chevron_right");
      expect(text(html)).toContain("6 Oct");
      expect(text(html).replace(/[⁨⁩]/g, "")).toContain(translate(lang, "elev.loop.ms.quoted", { text: "I did it all by my own self!" }).replace(/[\u2068\u2069]/g, ""));
      if (lang === "he") expect(html).not.toMatch(/[\u201C\u201D]/);
    }
  });

  it("P2-21: the practice say carries its 'Say' label (a script, not a second accent), quoted through the one key", () => {
    for (const lang of ["en", "he"] as const) {
      const html = render({ lang });
      const say = /data-testid="shelf-practice-say"[^>]*>([\s\S]*?)<\/p>/.exec(html)![1];
      expect(say).toMatch(new RegExp(`data-testid="shelf-practice-say-label"[^>]*>${translate(lang, "elev.loop.practice.say")}<`));
      if (lang === "he") expect(say).toContain("\u05F4");
      expect(say).not.toMatch(lang === "he" ? /[\u201C\u201D]/ : /\u05F4/);
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
      expect(text(html)).toContain("Said big ball at the park"); // (the first entry row, R5)
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

/* P5-LOOP c2 r2 (journal P1 G1-2 / design P1): the Notice card's rendered
   proof is the orchestrator's sweep state loop-shelf-page-notice on
   ?shelf=words — this pins that the catalogue SUPPLIES that card for the
   demo child (Dylan, 38 m), and that Sleep has none (the framer's open ask). */
describe("the shelf page's Notice card has a row on Words for the demo child (c2 r2)", () => {
  it("shelfNotice(words, 38 m) is an in-window row; Sleep has none until a sourced row exists", () => {
    const fresh = ALL_MILESTONES.map((m) => ({ ...m, checked: false })) as Milestone[];
    const words = shelfNotice(fresh, 38, "words", new Date(2026, 9, 7, 9));
    expect(words).not.toBeNull();
    expect(words!.shelf).toBe("words");
    expect(shelfNotice(fresh, 38, "sleep", new Date(2026, 9, 7, 9))).toBeNull();
  });
});

/* B-DESIGN-04 (P7-DESIGN blend frames 03 / 03b, 8 Oct): the header band on the
   shelf's FIXED wash with the 44 px duotone glyph on a white chip and the 96 px
   glyph at 12 % bleeding off the inline-END corner (logical inset, direction
   inherit — RTL lands it on the left); that is the screen's ONE accent (no
   editorial words accent in the header); the Notice card answers segmented;
   "On this shelf" and the day heads read in the body face. */
describe("B-DESIGN-04 · the shelf page header and sections", () => {
  const SRC = readFileSync(path.resolve(__dirname, "ShelfPage.tsx"), "utf8");
  it("the header band: the shelf's wash, the white-chip duotone glyph, the H1 at --t-hero, the bleed at the inline end", () => {
    const hero = /<div\s+data-testid="shelf-page-hero"[\s\S]*?\{count === 0 &&/.exec(SRC)![0];
    expect(hero).toContain("background: tone.wash");
    expect(hero).toContain("<ShelfGlyph shelf={shelf} onWash />");
    expect(hero).toContain('<h1 className="arbor-type-hero"');
    expect(hero).toMatch(/data-testid="shelf-page-bleed"[\s\S]{0,200}insetInlineEnd: -16[\s\S]{0,120}direction: "inherit"/);
    expect(hero).toContain("fontSize: 96");
    expect(hero).toContain("${tone.jewel} 12%");
    expect(hero).not.toMatch(/insetInlineStart|\bleft:|\bright:/);
    expect(hero).not.toMatch(/font-editorial|arbor-accent-rule/); // the bleed is the one accent
    expect(SRC).toContain("const tone = shelfTone(shelf);");
    expect(SRC).not.toMatch(/from "\.\.\/loop\/ShelfGlyph"/);
  });
  it("the Notice card answers segmented under a section head; On this shelf + the day heads in the body face", () => {
    expect(SRC).toMatch(/<NoticeCard[\s\S]{0,300}hideShelf\s*answers="segmented"/);
    expect(SRC).toContain('<SectionHead icon="visibility" title={t("elev.shelfJournal.notice")} />');
    expect(SRC).toMatch(/<h2 id="shelf-entries-title"[^>]*><span style=\{\{ fontFamily: "var\(--font-sans\)"/);
    expect(SRC).toMatch(/<h3 className="t-sm font-semibold"><span style=\{\{ fontFamily: "var\(--font-sans\)"/);
  });
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: the wash is the shelf's own token (sleep → sky), the count reads no zero, the bleed glyph is the registry's`, () => {
      state.lang = lang;
      const html = renderToStaticMarkup(
        <ShelfPage shelf="sleep" childName="Dylan" count={0} practice={null} onTryToday={() => undefined} notice={null} noticeHandlers={{ onAnswer: () => undefined }} groups={[]} onOpenEntry={() => undefined} onBack={() => undefined} onAdd={() => undefined} />,
      );
      expect(html).toMatch(/data-testid="shelf-page-hero"[^>]*style="background:var\(--arbor-sky-wash\)/);
      expect(html).toMatch(/data-testid="shelf-page-bleed"[^>]*>bedtime</);
      expect(html.match(/data-testid="shelf-glyph-duotone"/g)).toHaveLength(1);
    });
  }
});
