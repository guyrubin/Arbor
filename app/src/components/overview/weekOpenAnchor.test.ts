/**
 * ENG-24 as SHIPPED — the week-open anchor.
 *
 * The recap-claiming variant (weekAnchor.test.ts) stays unmounted because Today
 * cannot verify that last week's report exists. This file covers the variant
 * that ships instead: a card that states only what the calendar states, spends
 * the same once-a-week marker, and is therefore honest on a device that has
 * never seen a report.
 *
 * Scan discipline (this repo has been bitten by vacuous scans): every source
 * read is asserted non-empty and asserted to contain a known landmark, comments
 * are stripped before any rule runs so prose cannot satisfy a rule, and every
 * rule carries a NEGATIVE CONTROL — for the copy rules the control is the
 * shipped recap copy, which must still trip the scanner it is written to catch.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WEEK_OPEN_ANCHOR_DAYS,
  markWeekAnchorSeen,
  readWeekAnchorSeen,
  weekAnchorSeenKey,
  weekOpenAnchorDue,
} from "./weekAnchor";
import { chooseTodayAction } from "./chooseTodayAction";
import { recapWeekId } from "../../hooks/useWeeklyRecap";
import { isChildScopedKey } from "../../lib/childLocalState";
import { elevationEn, elevationHe } from "../../lib/i18nElevation/index";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...rel: string[]) => readFileSync(path.join(here, ...rel), "utf8").replace(/\r\n/g, "\n");
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Minimal in-memory Storage stand-in (the suite runs in `environment: "node"`). */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

const MONDAY = 1;

/* ══════════════════════════════════════════════════════════════════════════
   1. The decision — a date and one storage read, nothing else.
   ══════════════════════════════════════════════════════════════════════════ */
describe("weekOpenAnchorDue — the top of a new week, once", () => {
  it("is due at the top of a week this device has never been anchored for", () => {
    expect(weekOpenAnchorDue({ weekId: "2026-W36", dayOfWeek: MONDAY, anchorSeenWeekId: null })).toBe(true);
  });

  it("is NOT due once this week's anchor has been offered", () => {
    expect(weekOpenAnchorDue({ weekId: "2026-W36", dayOfWeek: MONDAY, anchorSeenWeekId: "2026-W36" })).toBe(false);
  });

  it("IS due again when the week id turns over", () => {
    expect(weekOpenAnchorDue({ weekId: "2026-W37", dayOfWeek: MONDAY, anchorSeenWeekId: "2026-W36" })).toBe(true);
  });

  it("is only due on the week's OPENING days — never mid-week", () => {
    for (const dayOfWeek of [0, 1, 2, 3, 4, 5, 6]) {
      expect(
        weekOpenAnchorDue({ weekId: "2026-W36", dayOfWeek, anchorSeenWeekId: null }),
        `day ${dayOfWeek}`,
      ).toBe(WEEK_OPEN_ANCHOR_DAYS.includes(dayOfWeek));
    }
    // NEGATIVE CONTROL: the window is a real restriction, not the whole week.
    expect(WEEK_OPEN_ANCHOR_DAYS.length).toBeLessThan(7);
    expect([...WEEK_OPEN_ANCHOR_DAYS]).toEqual([0, 1, 2]);
  });

  it("is never due without a resolvable week id", () => {
    expect(weekOpenAnchorDue({ weekId: "", dayOfWeek: MONDAY, anchorSeenWeekId: null })).toBe(false);
  });

  it("needs NOTHING the network owns — no report, no log, no child field", () => {
    // The whole input surface, spelled out: if this ever grows a field that
    // describes the child or a stored document, the card stops being safe to
    // mount without a signal and this test is where that shows up.
    const source = stripComments(read("weekAnchor.ts"));
    expect(source.length).toBeGreaterThan(800);
    expect(source).toContain("export function weekOpenAnchorDue");
    const decl = source.slice(source.indexOf("export function weekOpenAnchorDue"));
    const params = decl.slice(decl.indexOf("{"), decl.indexOf("}): boolean"));
    expect(params).toContain("weekId");
    expect(params).toContain("dayOfWeek");
    expect(params).toContain("anchorSeenWeekId");
    expect(params).not.toMatch(/recap|report|unopened|count|logs?\b|child(?!Id)/i);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   2. The day window is the WEEK'S OWN opening — derived, not guessed.
   ══════════════════════════════════════════════════════════════════════════ */
describe("the anchor days really are the first days of a recap week", () => {
  it("recapWeekId turns over on a Sunday, in every year it is asked about", () => {
    let turnovers = 0;
    let checked = 0;
    for (let year = 2026; year <= 2030; year++) {
      for (let i = 1; i < 365; i++) {
        const day = new Date(year, 0, 1 + i);
        const prev = new Date(year, 0, i);
        // The id carries the calendar year, so 1 January turns over whatever
        // weekday it lands on. Both variants share that seam; ids stay unique.
        if (day.getFullYear() !== prev.getFullYear()) continue;
        checked++;
        if (recapWeekId(day) !== recapWeekId(prev)) {
          turnovers++;
          expect(day.getDay(), `${day.toDateString()} started a new week id`).toBe(0);
        }
      }
    }
    // NEGATIVE CONTROL: prove the loop actually saw week boundaries, so a
    // silently-constant id could not pass this vacuously.
    expect(checked).toBeGreaterThan(1_500);
    expect(turnovers).toBeGreaterThan(200);
  });

  it("so day 0/1/2 of that week id are Sunday, Monday and Tuesday", () => {
    expect(WEEK_OPEN_ANCHOR_DAYS.map((d) => new Date(2026, 8, 6 + d).getDay())).toEqual([0, 1, 2]);
    expect(new Date(2026, 8, 6).getDay()).toBe(0);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   3. ONE marker, no new key.
   ══════════════════════════════════════════════════════════════════════════ */
describe("the week's single appearance is shared with the recap variant", () => {
  const KID = "kid-weekopen-sentinel";

  it("spends the recap anchor's own marker, not a second one", () => {
    const store = fakeStorage();
    expect(weekOpenAnchorDue({ weekId: "2026-W36", dayOfWeek: MONDAY, anchorSeenWeekId: readWeekAnchorSeen(KID, store) })).toBe(true);
    markWeekAnchorSeen(KID, "2026-W36", store);
    expect(weekOpenAnchorDue({ weekId: "2026-W36", dayOfWeek: MONDAY, anchorSeenWeekId: readWeekAnchorSeen(KID, store) })).toBe(false);
    // …and the next week is offered again.
    expect(weekOpenAnchorDue({ weekId: "2026-W37", dayOfWeek: MONDAY, anchorSeenWeekId: readWeekAnchorSeen(KID, store) })).toBe(true);
  });

  it("that marker is swept when the child is deleted", () => {
    expect(isChildScopedKey(weekAnchorSeenKey(KID), KID)).toBe(true);
    // NEGATIVE CONTROL: the sweep matcher is not trivially true.
    expect(isChildScopedKey(`vendor.week.anchor.seen.${KID}`, KID)).toBe(false);
  });

  it("the module mints exactly ONE arbor key template", () => {
    const source = read("weekAnchor.ts");
    expect(source.length).toBeGreaterThan(2_000);
    const templates = [...stripComments(source).matchAll(/`arbor\.[^`]*`/g)].map((m) => m[0]);
    expect(templates).toEqual(["`arbor.week.anchor.seen.${childId}`"]);
  });

  it("the card writes through the shared helper and touches no storage itself", () => {
    const card = stripComments(read("WeekOpenAnchorCard.tsx"));
    expect(card.length).toBeGreaterThan(1_500);
    expect(card).toContain("markWeekAnchorSeen(childId, weekId)");
    expect(card).not.toMatch(/localStorage|sessionStorage|`arbor\./);
  });

  it("the appearance itself spends the week — not only a dismissal (no nagging)", () => {
    const card = stripComments(read("WeekOpenAnchorCard.tsx"));
    // The marker write lives in an effect, so an anchor the parent scrolled
    // past is never re-offered on the next open of the same week.
    expect(card).toMatch(/useEffect\(\(\) => \{\s*markWeekAnchorSeen\(childId, weekId\);\s*\}, \[childId, weekId\]\)/);
    // NEGATIVE CONTROL: the shape this rule rejects is a marker written only
    // from a click handler.
    const clickOnly = "const dismiss = () => { markWeekAnchorSeen(childId, weekId); };";
    expect(/useEffect\(\(\) => \{\s*markWeekAnchorSeen\(/.test(clickOnly)).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   4. The copy claims nothing the device cannot check.
   ══════════════════════════════════════════════════════════════════════════ */
const WEEKOPEN_KEYS = [
  "elev.waveR.weekopen.eyebrow",
  "elev.waveR.weekopen.title",
  "elev.waveR.weekopen.titleGeneric",
  "elev.waveR.weekopen.body",
  "elev.waveR.weekopen.cta",
  "elev.waveR.weekopen.later",
] as const;

/** Words that assert a stored artefact exists, or point at last week. */
const EXISTENCE_EN = /\bwaiting\b|\bwritten\b|\breport\b|\brecap\b|\bready\b|\blast week\b|\bsummar/i;
// "כתוב" only as its own word: the infinitive "לכתוב" ("to write") is the
// card's own forward-looking CTA, not a claim that something is written.
const EXISTENCE_HE = /מחכה|(?:^|\s)כתוב|דו"?ח|סיכום|השבוע שעבר|מוכן/;
/** Words that would make a parent who logged nothing feel counted at. */
const SCOLD_EN = /\bmissed\b|\bforgot\b|\bnothing\b|\bempty\b|\bcatch up\b|\bstill\b|\bhaven't\b|\bdidn't\b/i;
const SCOLD_HE = /פספסת|שכחת|לא תיעדת|ריק|כלום|עדיין לא/;

describe("ENG-24 — the shipped copy is true for a parent who logged nothing", () => {
  it("every key exists in BOTH dictionaries and carries real text", () => {
    for (const key of WEEKOPEN_KEYS) {
      expect(elevationEn[key], `en missing ${key}`).toBeTruthy();
      expect(elevationHe[key], `he missing ${key}`).toBeTruthy();
      expect(elevationEn[key].length, key).toBeGreaterThan(3);
      expect(elevationHe[key].length, key).toBeGreaterThan(3);
    }
    // The named child appears in both titles, or one language loses the child.
    expect(elevationEn["elev.waveR.weekopen.title"]).toContain("{name}");
    expect(elevationHe["elev.waveR.weekopen.title"]).toContain("{name}");
  });

  it("claims no report, no summary, and never points at last week", () => {
    for (const key of WEEKOPEN_KEYS) {
      expect(EXISTENCE_EN.test(elevationEn[key]), `${key}: "${elevationEn[key]}"`).toBe(false);
      expect(EXISTENCE_HE.test(elevationHe[key]), `${key}: "${elevationHe[key]}"`).toBe(false);
    }
  });

  it("NEGATIVE CONTROL — the shipped recap copy DOES trip both scanners", () => {
    // If this ever stops failing the scan, the scanner has gone blind and the
    // rule above is worthless. These are the exact strings that kept the recap
    // variant unmounted.
    expect(EXISTENCE_EN.test(elevationEn["elev.waveR.recap.body"])).toBe(true);
    expect(EXISTENCE_EN.test(elevationEn["elev.waveR.recap.cta"])).toBe(true);
    expect(EXISTENCE_HE.test(elevationHe["elev.waveR.recap.body"])).toBe(true);
  });

  it("never scolds, and never names a gap", () => {
    for (const key of WEEKOPEN_KEYS) {
      expect(SCOLD_EN.test(elevationEn[key]), `${key}: "${elevationEn[key]}"`).toBe(false);
      expect(SCOLD_HE.test(elevationHe[key]), `${key}: "${elevationHe[key]}"`).toBe(false);
    }
    // NEGATIVE CONTROL: the shapes this rule is written to catch.
    expect(SCOLD_EN.test("You missed last week — nothing was logged.")).toBe(true);
    expect(SCOLD_HE.test("פספסתם את השבוע שעבר")).toBe(true);
  });

  it("carries no number, percentage or verdict about the child (clinical firewall)", () => {
    for (const key of WEEKOPEN_KEYS) {
      for (const value of [elevationEn[key], elevationHe[key]]) {
        expect(value, key).not.toMatch(/\d|%|\bscore\b|\bon[\s-]?track\b|\bbehind\b|\bdelay/i);
      }
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   5. The card is a door forward, never a second report surface.
   ══════════════════════════════════════════════════════════════════════════ */
describe("ENG-24 — the week-open card", () => {
  const RAW = read("WeekOpenAnchorCard.tsx");
  const CARD = stripComments(RAW);

  it("the card was actually read (extraction proven)", () => {
    expect(RAW.length).toBeGreaterThan(2_000);
    expect(RAW).toContain("export default function WeekOpenAnchorCard");
  });

  it("offers a capture and a way out, both at 44px", () => {
    expect(CARD).toContain('data-testid="today-week-open-capture"');
    expect(CARD).toContain('data-testid="today-week-open-later"');
    const buttons = CARD.match(/data-testid="today-week-open-(capture|later)"[\s\S]{0,400}?className="([^"]+)"/g) ?? [];
    expect(buttons.length).toBe(2);
    for (const b of buttons) expect(b).toContain("min-h-11");
  });

  it("does NOT send the parent to a weekly surface that may hold nothing", () => {
    expect(CARD).not.toMatch(/setActiveTab\(/);
    expect(CARD).not.toMatch(/elev\.waveR\.recap\./);
  });

  it("renders NOTHING about the child — no counts, no narrative, no verdict", () => {
    expect(CARD).not.toMatch(/behaviorLogs|playLogs|milestones|digest|stats|streak/i);
    expect(CARD).not.toMatch(/%|\bscore\b|\bon[\s-]?track\b|\bbehind\b|\bdelay(ed)?\b/i);
  });

  it("paints through tokens only — no raw hex anywhere in the file", () => {
    expect(RAW).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(RAW).toContain("var(--arbor-clay)");
  });

  it("every visible string goes through the dictionary", () => {
    for (const key of WEEKOPEN_KEYS) expect(CARD).toContain(key);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   6. Ranking — reused, not duplicated.
   ══════════════════════════════════════════════════════════════════════════ */
const BASE = {
  hasActiveAction: false,
  focusHeadline: null as string | null,
  focusPending: false,
  promptKeys: ["elev.prompt.toddler.3"],
  hasDailyPlay: true,
};

describe("ENG-24 — where the week-open anchor sits in the one ranking function", () => {
  it("does nothing unless the caller raises the flag", () => {
    expect(chooseTodayAction({ ...BASE }).kind).toBe("prompt");
    expect(chooseTodayAction({ ...BASE, hasWeekOpenAnchor: false }).kind).toBe("prompt");
  });

  it("outranks the capture prompt, play and the capture floor", () => {
    expect(chooseTodayAction({ ...BASE, hasWeekOpenAnchor: true })).toEqual({ kind: "weekOpen" });
    expect(chooseTodayAction({ ...BASE, promptKeys: [], hasWeekOpenAnchor: true })).toEqual({ kind: "weekOpen" });
    expect(chooseTodayAction({ ...BASE, promptKeys: [], hasDailyPlay: false, hasWeekOpenAnchor: true })).toEqual({ kind: "weekOpen" });
  });

  it("B-TODAY-08: NEVER displaces a grounded step — focus (or a focus in flight) wins", () => {
    expect(chooseTodayAction({ ...BASE, focusHeadline: "One calm handoff", hasWeekOpenAnchor: true })).toEqual({ kind: "focus" });
    expect(chooseTodayAction({ ...BASE, focusPending: true, hasWeekOpenAnchor: true })).toEqual({ kind: "focus" });
  });

  it("NEVER outranks an accepted action, nor a VERIFIED recap", () => {
    expect(chooseTodayAction({ ...BASE, hasActiveAction: true, hasWeekOpenAnchor: true })).toEqual({ kind: "loop" });
    expect(chooseTodayAction({ ...BASE, hasWeekAnchorRecap: true, hasWeekOpenAnchor: true })).toEqual({ kind: "recap" });
  });

  it("still yields exactly ONE choice across the whole input space (Rule A)", () => {
    for (const hasActiveAction of [true, false]) {
      for (const hasWeekAnchorRecap of [true, false]) {
        for (const hasWeekOpenAnchor of [true, false]) {
          for (const focusHeadline of ["Do X", null]) {
            for (const promptKeys of [["k"], []]) {
              for (const hasDailyPlay of [true, false]) {
                const choice = chooseTodayAction({
                  hasActiveAction,
                  hasWeekAnchorRecap,
                  hasWeekOpenAnchor,
                  focusHeadline,
                  focusPending: false,
                  promptKeys,
                  hasDailyPlay,
                });
                if (hasActiveAction) expect(choice.kind).toBe("loop");
                else if (hasWeekAnchorRecap) expect(choice.kind).toBe("recap");
                else if (focusHeadline) expect(choice.kind).toBe("focus");
                else if (hasWeekOpenAnchor) expect(choice.kind).toBe("weekOpen");
                else expect(choice.kind).not.toBe("weekOpen");
              }
            }
          }
        }
      }
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   7. Wiring — Today mounts it, and buys no subscription doing so.
   ══════════════════════════════════════════════════════════════════════════ */
describe("ENG-24 — Today mounts the honest anchor, and only the honest one", () => {
  const RAW = read("..", "tabs", "OverviewTab.tsx");
  const OVERVIEW = stripComments(RAW);

  it("the Today hub source was actually read", () => {
    expect(OVERVIEW.length).toBeGreaterThan(20_000);
    expect(OVERVIEW).toContain("export default function OverviewTab");
  });

  // B-LOOP-07 re-pin: the week anchors left Today; the week is ONE door line
  // ("This week's letter" → #/weekly) when a recap exists. The anchor
  // decisions (weekOpenAnchorDue, weekAnchorRecapDue) keep their own suites.
  it("Today mounts no week anchor card; the week is one door line when a recap exists", () => {
    expect(OVERVIEW).not.toContain("<WeekOpenAnchorCard");
    expect(OVERVIEW).not.toContain("<WeekAnchorCard");
    expect(OVERVIEW).toContain('{weeklyRecap.currentReport && doorLine("today-door-week", "auto_stories", t("elev.loop.door.week"), () => setActiveTab("weekly"))}');
  });

  it("B-TODAY-08: buys NO second recap subscription — the overview tree mounts useWeeklyRecap exactly once", () => {
    // The subscription already existed (SinceLastVisit mounted it on Today);
    // B-TODAY-08 hoisted it into OverviewTab and passes it down as a prop —
    // since B-TODAY-21 to the ONE What-changed card.
    const since = stripComments(read("WhatChanged.tsx"));
    const mounts = (OVERVIEW.match(/useWeeklyRecap\(/g) ?? []).length + (since.match(/useWeeklyRecap\(/g) ?? []).length;
    expect(mounts).toBe(1);
    expect(OVERVIEW).toMatch(/const weeklyRecap = useWeeklyRecap\(\);/);
    expect(OVERVIEW).toContain("recap={weeklyRecap}");
    expect(OVERVIEW).not.toMatch(/useChildCollection\(/);
    // NEGATIVE CONTROL: the shape this rule counts.
    expect(/useWeeklyRecap\(/.test("const recap = useWeeklyRecap();")).toBe(true);
  });

  it("B-TODAY-08: the recap line claims a letter only from the verified signal (the recap hook's report)", () => {
    expect(OVERVIEW).toContain("weeklyRecap.currentReport &&");
    expect(OVERVIEW).not.toContain("hasWeekAnchorRecap");
  });

  it("an accepted step from Ask keeps its loop behind the door; the chain order stays pinned for its importers", () => {
    // P5 r1 pass A5: the accepted step is ONE line in the door (TodayStepLine
    // reads activeTodayAction and writes through recordTodayOutcome).
    const door = OVERVIEW.slice(OVERVIEW.indexOf('data-testid="today-door"'), OVERVIEW.indexOf("</details>"));
    expect(door).toContain("<TodayStepLine />");
    const chain = stripComments(read("chooseTodayAction.ts"));
    const at = (s: string) => chain.indexOf(s);
    expect(at("input.hasActiveAction")).toBeLessThan(at("input.hasWeekAnchorRecap"));
    expect(at("input.hasWeekAnchorRecap")).toBeLessThan(at("input.focusHeadline ||"));
    expect(at("input.focusHeadline ||")).toBeLessThan(at("input.hasWeekOpenAnchor)"));
    expect(at("input.hasWeekOpenAnchor)")).toBeLessThan(at("input.promptKeys.length"));
  });

  it("costs the module budget nothing (todayModules v3 has no week id)", () => {
    const budget = stripComments(read("todayModules.ts"));
    // the read is real: the planner itself is in the file (P5-LOOP c2 r1 dropped
    // the evening outcome strip, so the bare size floor moved from 1 000 to 800)
    expect(budget).toMatch(/export function planToday\(/);
    expect(budget.length).toBeGreaterThan(800);
    expect(budget).not.toMatch(/weekOpen|"anchor"/);
  });
});
