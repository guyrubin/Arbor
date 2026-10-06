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
import type { BehaviorLog } from "../../types";

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
    expect(contractFor("overview")).toMatchObject({ primaryMove: "do-practice", moduleBudget: 3, demotionTarget: "disclosure" });
  });

  it("Tonight is a pointer line in the morning, the flow in the evening; the door is ONE collapsed disclosure", () => {
    expect(OV).toContain('data-testid="today-tonight-pointer"');
    expect(OV).toContain("<TonightFlow");
    expect(OV).toMatch(/<details data-module-disclosure="today-more" data-testid="today-door"(?![^>]*\bopen\b)/);
    const door = OV.slice(OV.indexOf('data-testid="today-door"'), OV.indexOf("</details>"));
    for (const tok of ["<WhatChanged", "today-door-hard", "today-door-week", "today-door-play", "<LifecycleMomentCard", "<FirstStepsRail", "<ArborNoticedCard", "<CompanionOfferSlot", "<FamilyOfferLines", "<TodayActionLoop"]) {
      expect(door, tok).toContain(tok);
    }
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
