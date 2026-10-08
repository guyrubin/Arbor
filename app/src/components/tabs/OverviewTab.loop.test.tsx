import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

/* B-LOOP-07 — Today = three blocks: Today's practice · Notice today ·
   Tonight, everything else behind ONE door. Source pins on OverviewTab (the
   leaf the framework check reads), the then/now words of the critic r3 G2
   ("it remembered what I wrote" shows a CHANGE in the parent's own words),
   and the firewall over every Today string. */

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

import PracticeCard from "../loop/PracticeCard";
import { PRACTICES } from "../../content/practices";
import { ALL_MILESTONES } from "../../lib/milestoneData";
import { en, he } from "../../lib/i18n";
import { loopFirewallHits } from "../../lib/loop/firewall";
import { shelfWordsThenNow, THEN_GAP_DAYS } from "../../lib/today/shelfWords";
import { contractFor } from "../../lib/surfaceContract";
import { planToday } from "../overview/todayModules";
import type { BehaviorLog } from "../../types";
import type { ActionLoopEntry } from "../../actionLoop/model";
import { lastNightWords } from "../../lib/today/shelfWords";
import { tonightLineEntry, tonightOutcomeEntry } from "../../lib/loop/tonight";
import { practiceDoseEntry } from "../../lib/practice/choosePractice";
import { translate as translateFor } from "../../lib/i18n";

const here = path.dirname(fileURLToPath(import.meta.url));
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");
const OV = strip(readFileSync(path.join(here, "OverviewTab.tsx"), "utf8").replace(/\r\n/g, "\n"));

describe("OverviewTab — three blocks and one door (source pins)", () => {
  it("chooseTodayAction is retired for Today; the old step chain is gone", () => {
    expect(OV).not.toMatch(/chooseTodayAction/);
    for (const tok of ["<TodayRecommendation", "<PromptCaptureCard", "<FromRecordCard", "<TonightCard", "<TodayStarterCard", "<WeekAnchorCard", "<WeekOpenAnchorCard", "<DailyPlayCard"]) {
      expect(OV, tok).not.toContain(tok);
    }
  });

  // P5 design r1 P0-1 re-pin: the ONE stamp literal sits on the first
  // block's ANSWER group (PracticeCard / TonightFlow stampMove, the slot
  // NoticeCard answersAttrs), never on a wrapper around the whole card.
  it("the blocks render in planToday's order; exactly ONE primary-move stamp (do-practice) on the first block's answers", () => {
    expect(OV).toContain("plan.order.map((id) => (");
    expect(OV).toContain('data-module={`today-${id}`}');
    expect(OV.match(/data-primary-move/g)?.length).toBe(1);
    expect(OV).toContain('const primaryStamp = { "data-primary-move": "do-practice" } as const;');
    expect(OV).toContain('stampMove={firstBlock === "practice" ? primaryMoveId : undefined}');
    expect(OV).toContain('stampMove={firstBlock === "tonight" ? primaryMoveId : undefined}');
    expect(OV).not.toMatch(/<div data-primary-move=/);
    expect(contractFor("overview")).toMatchObject({ primaryMove: "choose-next-step", moduleBudget: 3, demotionTarget: "disclosure" });
  });

  it("Tonight is a pointer line in the morning, the flow in the evening; the door is ONE collapsed disclosure", () => {
    expect(OV).toContain('data-testid="today-tonight-pointer"');
    expect(OV).toContain("<TonightFlow");
    expect(OV).toMatch(/<details data-module-disclosure="today-more" data-testid="today-door"(?![^>]*\bopen\b)/);
    const door = OV.slice(OV.indexOf('data-testid="today-door"'), OV.indexOf("</details>"));
    // P5 r1 pass A5 (option b): lines only, plus the ONE proactive slot, the
    // clinical watch signal and the sibling lines; no lifecycle card, no rail,
    // no step card (TodayStepLine is its line).
    for (const tok of ["<WhatChanged", "today-door-hard", "today-door-week", "today-door-play", "<TodayStepLine", "<ArborNoticedCard", "<CompanionOfferSlot", "<FamilyOfferLines"]) {
      expect(door, tok).toContain(tok);
    }
    for (const tok of ["<LifecycleMomentCard", "<FirstStepsRail", "<TodayActionLoop"]) expect(OV, tok).not.toContain(tok);
    expect(door).toContain("changed.lines.slice(0, 3)");
  });

  it("the practice is the B-LOOP-09 chooser with the AI pick only inside its candidates; Notice never shows the practice's shelf", () => {
    expect(OV).toContain("choosePractice({");
    expect(OV).toContain("aiPracticeId,");
    expect(OV).toContain("excludeShelves: pick ? [pick.shelf] : [],");
    expect(OV).toContain("(pick ? noticeCards : noticeCards.slice(1)).slice(0, 2)");
  });

  it("the parent's own words on the practice's shelf, THEN and NOW, sit in the practice card", () => {
    expect(OV).toContain("shelfWordsThenNow(observations, behaviorLogs, pick.shelf)");
    expect(OV).toContain("[words.then, words.now]");
    expect(OV).toContain("quotes={quotes}");
  });
});

describe("shelfWordsThenNow — a change in the parent's own words", () => {
  const log = (id: string, trigger: string, daysAgo: number) =>
    ({ id, timestamp: new Date(Date.UTC(2026, 9, 6) - daysAgo * 86_400_000).toISOString(), behaviorType: "Moment", durationMinutes: 0, trigger }) as BehaviorLog;
  const obs = (l: BehaviorLog, shelf: string) => ({ id: `behaviorLogs:${l.id}`, origin: "behaviorLogs" as const, shelf: shelf as never, at: l.timestamp });
  const older = log("a", "Bath ended in tears again tonight", 40);
  const mid = log("b", "Bath was a little easier, he poured the water", 3);
  const newest = log("c", "Sang the whole bath song on his own", 1);
  const other = log("d", "Played with blocks for a long time today", 0);

  it("now = the newest note on the shelf; then = the newest note ≥ 7 days before it; other shelves never mix in", () => {
    const r = shelfWordsThenNow([obs(older, "sleep"), obs(mid, "sleep"), obs(newest, "sleep"), obs(other, "play")], [older, mid, newest, other], "sleep");
    expect(r.now?.text).toBe("Sang the whole bath song on his own");
    expect(r.then?.text).toBe("Bath ended in tears again tonight");
    expect(THEN_GAP_DAYS).toBe(7);
  });
  it("one note → now only; none → nothing (no generic line)", () => {
    expect(shelfWordsThenNow([obs(newest, "sleep")], [newest], "sleep")).toEqual({ now: { text: newest.trigger, at: newest.timestamp }, then: null });
    expect(shelfWordsThenNow([], [], "sleep")).toEqual({ now: null, then: null });
  });
  it("the card quotes both lines with their dates, verbatim, no verdict between them", () => {
    state.lang = "en";
    const p = PRACTICES.find((x) => x.milestoneId)!;
    const m = ALL_MILESTONES.find((x) => x.id === p.milestoneId)!;
    const html = renderToStaticMarkup(
      <PracticeCard practice={p} milestone={m} shelf={p.shelf} childName="Dylan" answered={null} onAnswer={() => undefined}
        quotes={[{ text: "Bath ended in tears again tonight", date: "27 Aug" }, { text: "Sang the whole bath song on his own", date: "5 Oct" }]} />,
    );
    expect(html.match(/data-testid="practice-quote"/g)).toHaveLength(2);
    expect(html.indexOf("Bath ended in tears")).toBeLessThan(html.indexOf("Sang the whole bath song"));
    expect(html).not.toMatch(/better|improv|progress|worse/i);
  });
});

describe("P5-LOOP c2 r1 — the words slot is fed by the loop (last night's line), then the shelf, then nothing", () => {
  const NOW = new Date(2026, 9, 7, 7, 30);
  const yesterday = new Date(2026, 9, 6, 9);
  const row = (at: Date, extra: Partial<ActionLoopEntry> = {}): ActionLoopEntry => ({
    ...practiceDoseEntry({ practice: PRACTICES.find((p) => p.shelf === "feelings")!, milestone: null, shelf: "feelings" }, "did", "kid-1", "x", at),
    ...extra,
  });

  it("lastNightWords: yesterday's dose row with its 'What happened?' line, quoted with its shelf; nothing else counts", () => {
    const night = tonightLineEntry(tonightOutcomeEntry(row(yesterday), "helped", new Date(2026, 9, 6, 21)), "  he picked   the pyjamas himself ")!;
    expect(lastNightWords([night], "kid-1", NOW)).toEqual({ text: "he picked the pyjamas himself", at: night.outcomeAt, shelf: "feelings" });
    // no line → null; a line from two nights ago is not "last night"; another child's row never
    expect(lastNightWords([row(yesterday)], "kid-1", NOW)).toBeNull();
    expect(lastNightWords([tonightLineEntry(row(new Date(2026, 9, 5, 9)), "older")!], "kid-1", NOW)).toBeNull();
    expect(lastNightWords([night], "kid-2", NOW)).toBeNull();
    expect(tonightLineEntry(row(yesterday), "   ")).toBeNull();
  });

  it("OverviewTab feeds the slot from lastNightWords first, the shelf's THEN/NOW notes second, and writes the night line through tonightLineEntry", () => {
    expect(OV).toContain("lastNightWords(actionLoop, childProfile.id, now)");
    // c2 r2 (P1-1, B-LOOP-NEW-2a): last night's line is shelved AND dated
    expect(OV).toMatch(/const quotes: PracticeQuote\[\] = lastNight[\s\S]{0,120}\?\s*\[\{ text: lastNight\.text, lead: t\("elev\.loop\.practice\.lastNight"\), shelf: `\$\{shelfLabel\(lastNight\.shelf, t\)\} · \$\{dateOf\(lastNight\.at\)\}`, onShelf: !!pick && lastNight\.shelf === pick\.shelf \}\]\s*:\s*\[words\.then, words\.now\]/);
    expect(OV).toContain("tonightLineEntry(dose ?? practiceDoseEntry(pick, \"did\", childProfile.id, sayText), text)");
    expect(OV).not.toMatch(/whatHappened: line/);
    // the why answers the quotes; the chosen reason holds after the answer (P2-1)
    expect(OV).toContain('return "since";');
    expect(OV).toContain('return shelfNewestAt ? "empty" : "startsPage";');
    expect(OV).toContain("if (pick && !dose) frozenWhy.current = { id: pick.practice.id, reason: liveWhy };");
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: c2 r2 P1-2 — the tonight-mode card OFFERS the practice (caption, 'for tonight' say, do-line, stamped Did it), never 'Did you try it today?'`, () => {
      state.lang = lang;
      const p = PRACTICES.find((x) => x.shelf === "sleep")!;
      const html = renderToStaticMarkup(
        <PracticeCard practice={p} milestone={null} shelf="sleep" childName="Dylan" answered={null} onAnswer={() => undefined} stampMove="do-practice" mode="tonight" />,
      ).replace(/&#x27;/g, "'");
      expect(html).toContain('data-mode="tonight"');
      expect(html).toContain(translateFor(lang, "elev.loop.tonight.practice.caption"));
      expect(html).toContain(translateFor(lang, "elev.loop.practice.sayTonight"));
      expect(html).not.toContain(translateFor(lang, "elev.loop.tonight.practice.q"));
      expect(html.match(/data-primary-move="do-practice"/g)).toHaveLength(1);
      expect(html).toMatch(/data-testid="practice-answers"[^>]*data-primary-move="do-practice"|data-primary-move="do-practice"[^>]*data-testid="practice-answers"/);
      // the day card is unchanged
      const day = renderToStaticMarkup(<PracticeCard practice={p} milestone={null} shelf="sleep" childName="Dylan" answered={null} onAnswer={() => undefined} />).replace(/&#x27;/g, "'");
      expect(day).toContain('data-mode="day"');
      expect(day).toContain(translateFor(lang, "elev.loop.practice.caption"));
    });
  }

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: line 1 is last night's words with its shelf; the quotes and the say share ONE --arbor-ink rule; the why answers the words`, () => {
      state.lang = lang;
      const p = PRACTICES.find((x) => x.shelf === "sleep")!;
      const lead = translateFor(lang, "elev.loop.practice.lastNight");
      const html = renderToStaticMarkup(
        <PracticeCard practice={p} milestone={null} shelf="sleep" childName="Dylan" answered={null} onAnswer={() => undefined}
          quotes={[{ text: "he picked the pyjamas himself", lead, shelf: lang === "he" ? "רגשות" : "Feelings" }]}
          whyReason="since" whyDate="29 Aug" />,
      );
      const words = html.match(/<div data-testid="practice-words"[^>]*>/)![0];
      // B-DESIGN-04: the ONE rule is .arbor-accent-rule (2 px --arbor-ink, index.css)
      expect(words).toMatch(/\barbor-accent-rule\b/);
      expect(html).not.toMatch(/data-testid="practice-say"[^>]*border-s-2/);
      expect(html).not.toMatch(/data-testid="practice-quotes"[^>]*border/);
      expect(html.indexOf(lead)).toBeLessThan(html.lastIndexOf("he picked the pyjamas himself"));
      expect(html).toMatch(/data-testid="practice-quote-shelf"[^>]*>[^<]*<bdi>(Feelings|רגשות)<\/bdi>/);
      expect(html.match(/data-testid="practice-quote"/g)).toHaveLength(1);
      expect(html).toContain("29 Aug");
      expect(html).not.toMatch(/better|improv|progress|worse|streak/i);
      // nothing on the shelf at all → "tonight's answer starts that page"
      const empty = renderToStaticMarkup(
        <PracticeCard practice={p} milestone={null} shelf="sleep" childName="Dylan" answered={null} onAnswer={() => undefined} whyReason="startsPage" />,
      );
      expect(empty).not.toContain('data-testid="practice-quotes"');
      expect(empty).toContain(translateFor(lang, "elev.loop.practice.whyStartsPage", { name: "Dylan", shelf: translateFor(lang, "elev.shelves.sleep") }).slice(0, 12));
      // "since" without a date never renders a dangling "from ;" — the plain line instead
      const noDate = renderToStaticMarkup(
        <PracticeCard practice={p} milestone={null} shelf="sleep" childName="Dylan" answered={null} onAnswer={() => undefined} whyReason="since" />,
      );
      expect(noDate).not.toMatch(/from ;|מ־;/);
    });
  }
});

describe("every Today / practice / tonight string — no streak, no count of days, no verdict (EN + HE)", () => {
  it("scan", () => {
    for (const dict of [en, he]) {
      for (const [k, v] of Object.entries(dict)) {
        if (!/^elev\.loop\.(today|practice|tonight|door)\./.test(k)) continue;
        expect(loopFirewallHits(v), k).toEqual([]);
        expect(v, k).not.toMatch(/ברצף|in a row|\bstreak/i);
      }
    }
  });
});

/* B-DESIGN-04 (P7-DESIGN, blend frame 01 — 8 Oct): Today takes the chosen
   direction. The practice card is the ONE primary card (the deep shadow lives
   in PracticeCard alone — PracticeCard.fold pins it); "Notice today" opens on
   the editorial section head (glyph · title · hairline) over ONE card on the
   hairline-ring depth; every Notice answer on the route is the ONE segmented
   control; the door keeps its content and loses the dashed border. */
describe("B-DESIGN-04 · Today takes the blend frame", () => {
  const TF = strip(readFileSync(path.join(here, "..", "loop", "TonightFlow.tsx"), "utf8").replace(/\r\n/g, "\n"));
  it("Notice today = SectionHead (visibility glyph, the h2 id the section is labelled by, the sub-line) over one card", () => {
    const block = OV.slice(OV.indexOf('data-testid="today-notice"'), OV.indexOf("const tonightBlock"));
    expect(block).toContain('<SectionHead id="today-notice-title" icon="visibility" title={t("elev.loop.today.notice.title")} sub={t("elev.loop.today.notice.sub")} />');
    expect(block).toContain('aria-labelledby="today-notice-title"');
    expect(block).toMatch(/className="arbor-depth-card mt-3/);
    expect(block).not.toMatch(/rounded-\[|text-\[\d/);
  });
  it("every NoticeCard on Today (the slot card, the Notice rows, Tonight's step 3) answers segmented", () => {
    expect(OV.match(/<NoticeCard\b/g)).toHaveLength(2);
    expect(OV.match(/<NoticeCard\b[^>]*answers="segmented"/g)).toHaveLength(2);
    expect(TF.match(/<NoticeCard\b/g)).toHaveLength(1);
    expect(TF).toMatch(/<NoticeCard[\s\S]{0,400}answers="segmented"/);
  });
  it("the deep shadow belongs to the day's ONE primary card — the morning practice card or, at 21:00, the Tonight card (R6; they never render together); the door is a solid hairline", () => {
    expect(OV).not.toMatch(/arbor-depth-primary|--arbor-shadow-primary/);
    // P7-DESIGN fix r1 (framer ruling R6, overview design P1-1): Tonight is the evening's primary card —
    // the morning card's depth on the token radius, the caption in the label style, "1 of 3" inside the
    // header row, the say at .arbor-type-say, no hard-coded text-[Npx]
    expect(TF.match(/arbor-depth-primary/g)).toHaveLength(1);
    expect(TF).toContain('data-testid="tonight-card" className="arbor-depth-primary p-4 sm:p-5" style={{ background: "var(--arbor-paper-elevated)", borderRadius: "var(--r-xl)" }}');
    expect(TF).toMatch(/data-testid="tonight-kicker" className="arbor-type-kicker"/);
    const band = TF.slice(TF.indexOf('data-testid="tonight-band"'), TF.indexOf("</header>"));
    expect(band).toContain("{progress(1)}");
    expect(TF).toContain('data-testid="tonight-say" className="mt-2 arbor-accent-rule arbor-type-say"');
    expect(TF).not.toMatch(/text-\[\d/);
    expect(TF).not.toMatch(/rounded-\[18px\]/);
    // the evening plan never mounts the practice card beside Tonight (one deep card on screen)
    for (const practiceShown of [true, false, undefined]) {
      const order = planToday({ evening: true, tonight: true, notice: true, practice: true, practiceShown } as Parameters<typeof planToday>[0]).order;
      expect(order.includes("practice") && order.includes("tonight"), String(practiceShown)).toBe(false);
    }
    const door = OV.slice(OV.indexOf('data-testid="today-door"'), OV.indexOf("</summary>"));
    expect(door).toContain('border: "1px solid var(--arbor-rule)"');
    expect(door).not.toMatch(/dashed/);
  });
  it("the flat loop glyph is gone from Today: PracticeCard, NoticeCard and TonightFlow mount the duotone one", () => {
    for (const rel of ["PracticeCard.tsx", "NoticeCard.tsx", "TonightFlow.tsx"]) {
      const src = readFileSync(path.join(here, "..", "loop", rel), "utf8");
      expect(src, rel).toMatch(/import \{ ShelfGlyph \} from "\.\.\/ui\/ShelfGlyph";/);
      expect(src, rel).not.toMatch(/<ShelfGlyph\b[^>]*size=\{(?:36|40)\}/);
    }
  });
});
