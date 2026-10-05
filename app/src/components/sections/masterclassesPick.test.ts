/**
 * LC-04 mount guard — the Learn hub's ONE move runs the REAL ranking.
 *
 * The ranking itself is proven behaviourally in src/learn/todaysPick.test.ts.
 * This file proves it is actually MOUNTED on the hub (the finding was
 * "capability built, unmounted"), so a regression that reverts the hero CTA to
 * `catalog.find((m) => !done[m.id])` turns CI red.
 *
 * Scan discipline (this repo has been bitten twice by vacuous scans):
 *  · \r\n is normalised BEFORE any regex runs;
 *  · every extraction is asserted toBeTruthy() before it is used;
 *  · each assertion has a NEGATIVE CONTROL run against the pre-change source
 *    shape, so a scan that silently matches nothing cannot pass.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pickMoment, todaysLearnPick } from "../../learn/todaysPick";
import { LEARN_CARDS } from "../../learn/learnCards";
import { learnCardScore } from "../../learn/learnLibrary";
import { translate as tr } from "../../lib/i18n";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HUB = path.join(__dirname, "Masterclasses.tsx");
const src = readFileSync(HUB, "utf8").replace(/\r\n/g, "\n");

/** The pre-change hero: first unfinished course in FILE ORDER, no signals. */
const PRE_CHANGE = `
  const nextCourse = catalog.find((m) => !done[m.id]);
  const heroStats = [
    { value: total, label: t("elev.hero.academy.stat.courses") },
    { value: doneCount, label: t("elev.hero.academy.stat.completed") },
    ...(nextCourse ? [{ value: nextCourse.durationMin, label: t("elev.hero.academy.stat.minNext") }] : []),
  ];
        <HubHero
          cta={nextCourse ? {
            label: t("elev.hero.academy.cta"),
            onClick: () => setOpenId(nextCourse.id),
            testId: "academy-hero-cta",
          } : undefined}
        />
`.replace(/\r\n/g, "\n");

const RANKED_PICK = /todaysLearnPick\(\s*LEARN_CARDS/;
const SEEDED_DAY = /dayKey:\s*pickDayKey\(/;
const CTA_OPENS_PICK = /onClick=\{\(\) => todaysRead \? requestLearnRead\(\{ cardId: todaysRead\.card\.id/;
// B-PLAY-18: the stat trio is gone; the pick's reading minutes ride its own line.
const PICK_MINUTES = /const pickMinutes = todaysRead \? todaysRead\.card\.minutes/;
const WHY_LINE = /data-testid="academy-pick-why"/;

describe("LC-04 · the hub hero runs the real ranking", () => {
  it("the source was actually read (guard against a vacuous scan)", () => {
    expect(src.length).toBeGreaterThan(1000);
    expect(src).toContain("export default function Masterclasses");
  });

  it("today's read comes from rankLearnCards' scorer over the Learn catalogue", () => {
    expect(RANKED_PICK.exec(src)).toBeTruthy();
    expect(RANKED_PICK.exec(PRE_CHANGE)).toBeNull(); // negative control
  });

  it("the pick is seeded per day, so it is stable today and rotates tomorrow", () => {
    expect(SEEDED_DAY.exec(src)).toBeTruthy();
    expect(SEEDED_DAY.exec(PRE_CHANGE)).toBeNull();
  });

  it("the hero CTA opens today's read, not the first unfinished course", () => {
    expect(CTA_OPENS_PICK.exec(src)).toBeTruthy();
    expect(CTA_OPENS_PICK.exec(PRE_CHANGE)).toBeNull();
  });

  it("the pick line shows the pick's own reading minutes (no stat trio)", () => {
    expect(src).not.toMatch(/const heroStats = \[/);
    expect(PICK_MINUTES.exec(src)).toBeTruthy();
    expect(PICK_MINUTES.exec(PRE_CHANGE)).toBeNull();
  });

  it("an honest why-line renders beside the hero", () => {
    expect(WHY_LINE.exec(src)).toBeTruthy();
    expect(WHY_LINE.exec(PRE_CHANGE)).toBeNull();
  });

  it("the ranking signals are the parent's own inputs, never a child score", () => {
    const block = /const learnSignals: LearnRankSignals = \{([\s\S]*?)\};/.exec(src);
    expect(block).toBeTruthy();
    const body = block![1];
    for (const signal of ["ageYears", "focusDomain", "recentConcerns", "helpfulness", "savedIds"]) {
      expect(body).toContain(signal);
    }
    // FIREWALL: no readiness/risk/percentage figure reaches the hub hero.
    expect(body).not.toMatch(/riskLevel|milestonesPercent|percent/i);
  });
});

describe("W2-SHELLPLAY r1 · the pick reads first; the rail never stacks two empty states", () => {
  it("the pick CTA is the page's --gradient-cta with on-accent ink (never the success green as a fill)", () => {
    const cta = src.slice(src.indexOf('data-testid="academy-hero-cta"'), src.indexOf("</button>", src.indexOf('data-testid="academy-hero-cta"')));
    expect(cta).toContain('style={{ background: "var(--gradient-cta)", color: "var(--arbor-on-accent)" }}');
    expect(cta).not.toContain('background: "var(--arbor-green-ink)"');
  });

  it("the pick title outranks the quiet 'All courses' heading", () => {
    expect(src).toMatch(/<h2 className="text-xl font-bold leading-snug" dir="auto" style=\{\{ color: "var\(--arbor-ink\)", fontFamily: "var\(--font-display\)" \}\}>\{todaysRead/);
    expect(src).toMatch(/<h2 className="text-lg font-bold" style=\{\{ color: "var\(--arbor-muted\)" \}\}>\s*\{t\("academy\.courses\.title"\)\}/);
  });

  it("with no map signal, ONE muted line with a 44 px door stands in for For You + Scholar Hub", () => {
    expect(src).toMatch(/\{devMapHasSignal\(devScore\) \? \(\s*<>[\s\S]*<AcademyForYou \/>[\s\S]*<ScholarHubCard \/>[\s\S]*<\/>\s*\) : \(/);
    const line = src.slice(src.indexOf('data-testid="academy-rail-nosignal"'), src.indexOf("</button>", src.indexOf('data-testid="academy-rail-nosignal"')));
    expect(line).toContain("min-h-11");
    expect(line).toContain('setActiveTab("milestones")');
    expect(line).toContain('t("elev.growthTruth.learn.rail.noSignal", { name: childName })');
  });
});

/* ── W2-SHELLPLAY r2 · B-SHELL-NEW-2j — the pick's why quotes the parent's own note ── */

describe("B-SHELL-NEW-2j — today's pick quotes the note that moved it, never a domain, score or count", () => {
  const now = new Date(2026, 9, 5, 19, 0);
  const signals = { ageYears: 3, focusDomain: null, recentConcerns: [] as never[] };
  const card = LEARN_CARDS.find((c) => learnCardScore(c, { ...signals, recentConcerns: ["transitions"] }) > learnCardScore(c, signals));

  it("pickMoment returns the NEWEST in-window note whose own concern moves the card, with its own words", () => {
    expect(card, "a transitions card exists in the catalogue").toBeTruthy();
    const logs = [
      { behaviorType: "Transition Refusal", timestamp: new Date(2026, 9, 1, 8).toISOString(), trigger: "Fell apart leaving the park" },
      { behaviorType: "Transition Refusal", timestamp: new Date(2026, 9, 4, 8).toISOString(), trigger: "Cried at the daycare door" },
      { behaviorType: "Transition Refusal", timestamp: new Date(2026, 9, 5, 9).toISOString(), trigger: "   " },
    ];
    expect(pickMoment(card!, signals, logs, now)).toEqual({ text: "Cried at the daycare door", at: new Date(2026, 9, 4, 8) });
    // NEGATIVE CONTROLS: out of window, in the future, or a log whose concern does not move this card
    expect(pickMoment(card!, signals, [{ behaviorType: "Transition Refusal", timestamp: new Date(2026, 8, 1).toISOString(), trigger: "old" }], now)).toBeNull();
    expect(pickMoment(card!, signals, [{ behaviorType: "Transition Refusal", timestamp: new Date(2026, 9, 6).toISOString(), trigger: "future" }], now)).toBeNull();
    expect(pickMoment(card!, signals, [{ behaviorType: "Moment", timestamp: new Date(2026, 9, 5, 8).toISOString(), trigger: "Sang the bath song" }], now)).toBeNull();
  });

  it("todaysLearnPick carries fromMoment only when concerns exist; null without logs", () => {
    const pick = todaysLearnPick(LEARN_CARDS, { ...signals, recentConcerns: [] }, { childId: "c", dayKey: "2026-10-05" });
    expect(pick?.fromMoment).toBeNull();
  });

  it("the hub renders the quote on the logs branch only, in the editorial face, with a peach-ink inline-start rule", () => {
    expect(src).toContain("const pickMoment = todaysRead && !todaysRead.fromSaved && todaysRead.fromConcerns ? todaysRead.fromMoment : null;");
    expect(src).toContain('borderInlineStart: "3px solid var(--arbor-peach-ink)", paddingInlineStart: 12');
    expect(src).toContain('fontFamily: "var(--font-editorial)" }}>“<bdi>{pickMoment.text}</bdi>”');
    expect(src).toContain("logs: behaviorLogs,");
    for (const k of ["today", "yesterday", "weekday", "date", "tail"]) {
      const key = `elev.learnCare.pick.moment.${k}`;
      expect(tr("en", key), key).not.toBe(key);
      expect(tr("he", key, { day: "x" }).replace("x", ""), key).not.toMatch(/[A-Za-z]/);
      expect(tr("en", key, { day: "Tuesday" })).not.toMatch(/\d+%|score|weakest|domain/i);
    }
  });
});
