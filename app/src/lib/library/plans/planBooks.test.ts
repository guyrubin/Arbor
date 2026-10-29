/**
 * B-BOOK-75 / B-KID-167 — every authored pattern composes into a PLAN book
 * that keeps the standard (kid-everyday-plans-standard §0–§7): the ten-screen
 * skeleton, first person, no choice / repair / decision, ≤ 6 poses from the
 * shared list, every plate registered and briefed, the lint clean (diagnosis
 * nouns EN + HE, virtue nouns, second person, pressure modals, digits, the
 * 2 : 1 ratio, caps), the name only on the cover and the frame line, HE-f
 * present and NFC, no public figure named (B-KID-39), every step sourced,
 * the red lines in parent words, and the composed book reading with ZERO
 * network imports. Plus the firewall: no count, streak or done state in any
 * child string.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CANONICAL_BANDS } from "../../domains/ageBands";
import { allBookPages, bookChoices, decisionOf } from "../bookShape";
import { bookPoseIds } from "../bookPoses";
import { readPath, bookFlowReducer, initialBookFlow, isEnding, END, canTurnForward } from "../bookFlow";
import { bookNarrationFiles } from "../narrationFiles";
import { composePlanBook, defaultPlanComposition, validatePlanComposition } from "./composePlanBook";
import { authoredPatterns, DEFAULT_REVIEW_PLAN_BOOK, getPlanFixtureBook, PLAN_FIXTURE_BOOKS } from "./planBooks";
import { lintPlanBook, sentenceRatio } from "./planLint";
import { getPlanPlate, PLAN_PLATE_BRIEFS, planPlateFile, planPlateTable } from "./planPlates";
import { isPlanPose, PLAN_POSES, PLAN_POSES_PER_PATTERN_MAX } from "./planPoses";
import { PATTERN_IDS } from "./planVisibility";
import { getAnyBook, getLibraryBook } from "../books";
import { isPlanBook, type PlanBook } from "../types";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(here, "..", "__fixtures__");

/** B-KID-39: public figures product copy has drawn on (EN + HE spellings),
 *  plus the named sleep methods a plan never carries. The CHILD's text names
 *  nobody at all (the stricter list adds the authors of the public methods
 *  the standard §3 cites, which a parent source note may cite as a source). */
const PUBLIC_FIGURES = /\b(Peterson|Jordan|Jung|Campbell|Freud|Piaget|Montessori|Nietzsche|Solzhenitsyn|Ferber|Sears)\b|פיטרסון|יונג|קמפבל|פרויד|פיאז'ה|מונטסורי|ניטשה|פרבר/;
const CHILD_TEXT_NAMES = /\b(Gray|Satter|Rapee|Mindell|Meltzer|Tabbers)\b|גריי|סאטר/;
/** A parent string may cite an author only as a source, never as "an idea from". */
const ATTRIBUTION = /\b(?:idea|insight|concept|thought) (?:from|of|by) [A-Z][a-z]+/;
/** The firewall: nothing a child reads counts, streaks or grades. */
const COUNT_WORDS = /\b(\d+\s*(?:of|out of|\/)\s*\d+|streak|days? in a row|score|points?|stars?|level|percent|%|done!|completed|you did it|well done)\b|מתוך|רצף|ניקוד|נקודות|כוכב|אחוז|כל הכבוד/i;

const childStrings = (book: PlanBook): string[] => {
  const out: string[] = [book.title.en, book.title.he, book.coverLine.en, book.coverLine.he, book.coverNameLine?.en ?? "", book.coverNameLine?.he ?? ""];
  for (const p of allBookPages(book)) for (const l of [p.text, ...(p.closing ? [p.closing] : [])]) out.push(l.en, l.he.m, l.he.f);
  for (const b of book.box ?? []) out.push(b.label.en, b.label.he);
  return out;
};
const parentStrings = (book: PlanBook): string[] => {
  const pp = book.parent;
  return [pp.knows, pp.whyNow, pp.tomorrow, pp.together, pp.sourceNote, pp.firstWeek, ...pp.planSteps, ...pp.watchFor, ...pp.sources].flatMap((l) => (l ? [l.en, l.he] : [])).concat([pp.askAfter.en, pp.askAfter.he.m, pp.askAfter.he.f]);
};

describe("the pattern registry", () => {
  it("authors at least the worked proof, each under a Tier-1 id, with a fixture book `<id>--demo`", () => {
    const defs = authoredPatterns();
    expect(defs.map((d) => d.id)).toContain("plan-poo-sit");
    for (const d of defs) {
      expect(PATTERN_IDS).toContain(d.id);
      expect(getPlanFixtureBook(`${d.id}--demo`)?.pattern).toBe(d.id);
    }
    expect(getPlanFixtureBook("plan-poo-sit--demo")).toBe(PLAN_FIXTURE_BOOKS[DEFAULT_REVIEW_PLAN_BOOK]);
    expect(getPlanFixtureBook("constructor")).toBeUndefined();
    expect(getAnyBook(DEFAULT_REVIEW_PLAN_BOOK)?.kind).toBe("plan");
    // a plan fixture is never a library book (the kid door's canonical list)
    expect(getLibraryBook(DEFAULT_REVIEW_PLAN_BOOK)).toBeUndefined();
  });

  it("every pattern's default composition is valid and every menu item sits in one slot with ≥ 1 source", () => {
    for (const def of authoredPatterns()) {
      const c = defaultPlanComposition(def, { bookId: "x", approvedAt: "t", approvedBy: "p" });
      expect(validatePlanComposition(def, c)).toEqual([]);
      expect(def.defaultSteps.map((id) => def.menu.find((m) => m.id === id)?.slot)).toEqual([1, 2, 3]);
      for (const m of def.menu) {
        expect([1, 2, 3]).toContain(m.slot);
        expect(m.sourceIds.length, m.id).toBeGreaterThanOrEqual(1);
        for (const s of m.sourceIds) expect(def.sources.some((x) => x.id === s), `${m.id} → ${s}`).toBe(true);
        expect(isPlanPose(m.pose), `${m.id} pose ${m.pose}`).toBe(true);
        expect(getPlanPlate(def.id, m.art.plateId), `${m.id} plate ${m.art.plateId}`).toBeDefined();
      }
      expect(def.minutesRange).toEqual([3, 10]);
      expect(def.watchFor.length).toBeGreaterThanOrEqual(3);
      expect(def.scepticsThree).toHaveLength(3);
      expect(def.boxItems.length).toBeGreaterThanOrEqual(3);
      expect(def.poses.length).toBeLessThanOrEqual(PLAN_POSES_PER_PATTERN_MAX);
      for (const p of def.poses) expect(isPlanPose(p)).toBe(true);
    }
  });

  it("the shared plan-pose list is exactly the standard's twelve, in the committed placeholder manifest", () => {
    expect([...PLAN_POSES]).toEqual(["sit-calm", "stand-tall", "point-up", "hug-knees", "hold-tummy", "wave", "lie-down", "sit-at-table", "open-mouth-wide", "hold-hand", "hold-box", "hands-up"]);
    const fixtures = readdirSync(fixturesDir).filter((f) => f.endsWith(".manifest.json"));
    expect(fixtures.length).toBeGreaterThan(0);
    for (const f of fixtures) {
      const man = JSON.parse(readFileSync(path.join(fixturesDir, f), "utf8")) as { poses: Record<string, unknown> };
      for (const pose of PLAN_POSES) expect(Object.keys(man.poses), `${f} lacks ${pose}`).toContain(pose);
    }
  });
});

/** What each authored pattern's default composition must say (the manuscript
 *  specifics the standard asks for: the step ids, the two refrains that return
 *  on the win page, the hooks, the chosen box, the duration, the sources). */
const EXPECT: Record<string, { steps: string[]; refrainEn: RegExp[]; refrainHe: string[]; hardEnds: RegExp; box: string[]; durationDays: number; sourceIds: string[] }> = {
  "plan-poo-sit": {
    steps: ["s1-sit-after-meal-5m", "s2-the-box", "s3-just-try"],
    refrainEn: [/my tummy gets a chance/i, /we just try/i],
    refrainHe: ["הבטן שלי מקבלת הזדמנות", "אנחנו רק מנסים"],
    hardEnds: /holds on\.$/,
    box: ["book", "soap-bubbles", "story"],
    durationDays: 21,
    sourceIds: ["aap-constipation", "naspghan-espghan-2014", "nhs-constipation-children"],
  },
  "plan-sleep-alone": {
    steps: ["s1-four-steps", "s2-sit-further", "s3-morning-check-in"],
    refrainEn: [/my body knows how to sleep/i, /we do the same four steps/i],
    refrainHe: ["הגוף שלי יודע לישון", "אנחנו עושים את אותם ארבעה שלבים"],
    hardEnds: /I call again\.$/,
    box: ["cuddly", "night-light", "one-story"],
    durationDays: 21,
    sourceIds: ["aap-bedtime-routine", "meltzer-mindell-2014", "mindell-williamson-2018", "nhs-sleep-young-children"],
  },
  "plan-dropoff": {
    steps: ["s1-goodbye-ritual", "s2-thing-from-home", "s3-door-opens-again"],
    refrainEn: [/the door opens again/i, /our goodbye is short and the same/i],
    refrainHe: ["הדלת נפתחת שוב", "הפרידה שלנו קצרה ואותו דבר"],
    hardEnds: /I hold on\.$/,
    box: ["little-stone", "photo-card", "ribbon"],
    durationDays: 14,
    sourceIds: ["aap-separation", "rapee-helping-anxious-child"],
  },
  "plan-big-feelings": {
    steps: ["s1-notice-the-hot", "s2-calm-place", "s3-fix-and-start-again"],
    refrainEn: [/my body gets hot, then it cools down/i, /we fix it and start again/i],
    refrainHe: ["הגוף שלי מתחמם, ואז הוא מתקרר", "אנחנו מתקנים ומתחילים מחדש"],
    hardEnds: /see it coming\.$/,
    box: ["cushion", "soft-toy", "calm-book"],
    durationDays: 21,
    sourceIds: ["aap-discipline", "aap-tantrums", "parent-programme-evidence"],
  },
  "plan-screen-end": {
    steps: ["s1-warning-in-my-units", "s2-timer-i-can-see", "s3-next-thing-pictured"],
    refrainEn: [/my body gets ready for the next thing/i, /two more, then we go/i],
    refrainHe: ["הגוף שלי מתכונן לדבר הבא", "עוד שניים, ואז הולכים"],
    hardEnds: /like a wall\.$/,
    box: ["sand-timer", "picture-cards", "the-button"],
    durationDays: 14,
    sourceIds: ["aap-media-young-minds", "transition-warning-evidence"],
  },
  "plan-new-food": {
    steps: ["s1-sits-on-my-plate", "s2-tiny-taste", "s3-comes-back-many-times"],
    refrainEn: [/my tongue learns new tastes slowly/i, /sits on my plate, and I decide/i],
    refrainHe: ["הלשון שלי לומדת טעמים חדשים לאט", "יושב בצלחת שלי, ואני מחליט"],
    hardEnds: /push it away again\.$/,
    box: ["my-plate", "taste-spoon", "putting-back-bowl"],
    durationDays: 28,
    sourceIds: ["division-of-responsibility", "nhs-fussy-eating", "repeated-exposure"],
  },
  "plan-toilet-start": {
    steps: ["s1-sit-same-times", "s2-the-box", "s3-still-learning"],
    refrainEn: [/my body is still learning/i, /we sit, and then we go play/i],
    refrainHe: ["הגוף שלי עדיין לומד", "אנחנו יושבים, ואז הולכים לשחק"],
    hardEnds: /pants get wet\.$/,
    box: ["potty-book", "potty-song", "small-toy"],
    durationDays: 21,
    sourceIds: ["aap-toilet-training", "nhs-potty-training"],
  },
  "plan-stay-in-bed": {
    steps: ["s1-my-place-at-night", "s2-one-trip-card", "s3-morning-check-in"],
    refrainEn: [/my bed is my place at night/i, /one trip, then back/i],
    refrainHe: ["המיטה שלי היא המקום שלי בלילה", "סיבוב אחד, ואז חזרה"],
    hardEnds: /I get up again\.$/,
    box: ["trip-card", "water-cup", "cuddly"],
    durationDays: 21,
    sourceIds: ["aap-bedtime-routine", "bedtime-pass-friman-1999", "nhs-sleep-young-children"],
  },
};

describe.each(Object.values(PLAN_FIXTURE_BOOKS))("plan book $id", (book) => {
  const def = authoredPatterns().find((d) => d.id === book.pattern)!;
  const want = EXPECT[book.pattern];

  it("is a PLAN book: kind, no decision / repair / choice, three steps, the pattern's plates and ≤ 6 shared poses", () => {
    expect(isPlanBook(book)).toBe(true);
    expect(decisionOf(book)).toBeNull();
    expect(bookChoices(book)).toEqual([]);
    expect((book as unknown as { decision?: unknown }).decision).toBeUndefined();
    expect((book as unknown as { rejoinPageId?: unknown }).rejoinPageId).toBeUndefined();
    for (const p of allBookPages(book)) expect(p.repair, p.id).toBeUndefined();
    expect(book.steps).toHaveLength(3);
    expect(book.steps.map((s) => s.menuId)).toEqual(def.defaultSteps);
    const poses = bookPoseIds(book);
    expect(poses.length).toBeLessThanOrEqual(PLAN_POSES_PER_PATTERN_MAX);
    for (const p of poses) expect(def.poses, p).toContain(p);
    const table = planPlateTable(book.pattern);
    for (const p of allBookPages(book)) {
      const plate = table[p.plateId];
      expect(plate, `${p.id} → ${p.plateId}`).toBeDefined();
      // the committed static path when the build manifest lists it, else the shared-storage route
      expect(plate.file).toBe(planPlateFile(book.pattern, p.plateId));
      expect(plate.file).toMatch(new RegExp(`^(?:/visuals/plans/${book.pattern}/${p.plateId}\\.webp|/api/plans/plates/${book.pattern}/${p.plateId})$`));
      expect(Math.abs(plate.width / plate.height - 1.5)).toBeLessThan(0.01);
      expect(PLAN_PLATE_BRIEFS[book.pattern]?.[p.plateId]?.brief, `${p.plateId} brief`).toBeTruthy();
      // provenance starts empty: nothing is claimed child-free before Fable has viewed it
      expect(plate.provenance).toEqual({ childFree: false, textFree: false, reviewedBy: null });
    }
  });

  it("reads as the ten-screen skeleton: cover · body good · how it works · hard · plan · three steps · the win · END (no choice ever)", () => {
    expect(book.pages.map((p) => p.id)).toEqual(["p1", "p2", "p3", "p4", ...book.steps.map((s) => s.id), "p8"]);
    expect(want, `${book.pattern} has an expectations row`).toBeDefined();
    expect(book.steps.map((s) => s.id)).toEqual(want.steps);
    expect(readPath(book, null).map((p) => p.id)).toEqual(book.pages.map((p) => p.id));
    expect(readPath(book, "a")).toEqual(readPath(book, null));
    let s = initialBookFlow();
    const screens: string[] = [s.at];
    for (let i = 0; i < 20 && s.at !== END; i++) {
      expect(canTurnForward(book, s), s.at).toBe(true);
      s = bookFlowReducer(book, s, { type: "next" });
      screens.push(s.at);
    }
    expect(screens).toEqual(["cover", "p1", "p2", "p3", "p4", ...want.steps, "p8", END]);
    expect(screens).toHaveLength(10);
    expect(isEnding(book, { ...initialBookFlow(), at: "p8" })).toBe(true);
    // a choice or a go changes nothing
    const mid = { ...initialBookFlow(), at: "p4" };
    expect(bookFlowReducer(book, mid, { type: "choose", choiceId: "a" })).toEqual(mid);
    expect(bookFlowReducer(book, mid, { type: "go" })).toEqual(mid);
    // the win page carries the frame line; the cover the name line
    expect(book.pages[book.pages.length - 1].closing?.en).toContain("{name}");
    expect(book.coverNameLine?.en).toContain("{name}");
    expect(book.cover.type).toBe("spread");
  });

  it("the lint is clean: first person, no diagnosis or virtue noun EN/HE, no digit but a time, caps, 2:1, NFC, HE-f", () => {
    const hits = lintPlanBook(book, { bannedEn: def.bannedWords.en, bannedHe: def.bannedWords.he });
    expect(hits, JSON.stringify(hits, null, 1)).toEqual([]);
    const { descriptive, directive } = sentenceRatio(book);
    expect(directive).toBeGreaterThan(0);
    expect(descriptive / directive).toBeGreaterThanOrEqual(2);
  });

  it("the two refrains (body, plan) return on the win page; screens 3 and 4 end unresolved", () => {
    const win = book.pages[book.pages.length - 1].text;
    for (const r of want.refrainEn) expect(win.en).toMatch(r);
    for (const r of want.refrainHe) expect(win.he.m).toContain(r);
    // screen 3 ends on the held hard part; screen 4 announces the plan and stops
    expect(book.pages[2].text.en).toMatch(want.hardEnds);
    expect(book.pages[3].text.en).toMatch(/plan\.|together\.$/);
  });

  it("the firewall: no count, streak, score or done state in any child string; no public figure anywhere", () => {
    for (const s of childStrings(book)) {
      expect(s, s).not.toMatch(COUNT_WORDS);
      expect(s, s).not.toMatch(PUBLIC_FIGURES);
      expect(s, s).not.toMatch(CHILD_TEXT_NAMES);
    }
    for (const s of parentStrings(book)) {
      expect(s, s).not.toMatch(PUBLIC_FIGURES);
      expect(s, s).not.toMatch(ATTRIBUTION);
    }
    // a step's minutes are the ONLY number a child reads
    for (const s of childStrings(book)) for (const m of s.matchAll(/\d+/g)) expect(s.slice(m.index!, m.index! + 12), s).toMatch(/^\d+ (minutes|דקות)/);
  });

  it("the parent panel is complete in the lexicon: steps, red lines, sources, first week; 'developmentally informed', never a treatment claim", () => {
    const pp = book.parent;
    expect(pp.planSteps).toHaveLength(3);
    expect(pp.watchFor.length).toBeGreaterThanOrEqual(3);
    expect(pp.sources.length).toBeGreaterThanOrEqual(1);
    for (const l of [pp.knows!, pp.whyNow!, pp.tomorrow!, pp.together!, pp.sourceNote, pp.firstWeek, ...pp.planSteps, ...pp.watchFor, ...pp.sources]) {
      expect(l.en.trim()).not.toBe("");
      expect(/[֐-׿]/.test(l.he), l.en).toBe(true);
    }
    const all = parentStrings(book).join(" ");
    expect(all).toMatch(/developmentally informed/);
    expect(all).toMatch(/מבוסס התפתחות/);
    expect(all).not.toMatch(/\b(treats?|treatment|cure|therapy|diagnos\w*)\b(?! claim)/i);
    expect(all).not.toMatch(/מרפא|טיפול רפואי|אבחון/);
    // a step that takes minutes carries the minutes the parent set, in the panel too
    if (book.steps[0].minutes) expect(pp.planSteps[0].en).toContain(`${book.steps[0].minutes} minutes`);
    // the red lines are the parent's door to care, not a checklist with a score
    for (const w of pp.watchFor) expect(w.en).not.toMatch(/\d|score|sign of|symptom/i);
    // no `{name}` on a child page but the cover and the frame line (the lint), and none in the panel
    expect(all).not.toContain("{name}");
  });

  it("every page has a hero slot inside the plate with head room; the box page is named when items were chosen", () => {
    for (const p of allBookPages(book)) {
      expect(p.hero, p.id).not.toBeNull();
      const s = p.hero!;
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(1);
      expect(s.y - s.scale).toBeGreaterThan(0);
      expect(s.pose).toMatch(/^[a-z0-9-]+$/);
    }
    expect(book.box?.map((b) => b.id)).toEqual(want.box);
    expect(book.boxPageId).toBe(want.steps[1]);
    expect(book.durationDays).toBe(want.durationDays);
    expect(book.sourceIds.sort()).toEqual(want.sourceIds);
  });

  it("has canonical age bands only, and its narration list is linear (no choice clips, no path variants)", () => {
    const ids = new Set(CANONICAL_BANDS.map((b) => b.id));
    for (const b of book.ageBands) expect(ids.has(b), b).toBe(true);
    const files = bookNarrationFiles(book, "en");
    expect(files.map((f) => f.file)).toEqual(["cover.mp3", "p1.mp3", "p2.mp3", "p3.mp3", "p4.mp3", ...want.steps.map((id) => `${id}.mp3`), "p8.mp3"]);
    expect(files.some((f) => /-choice\.|-after\.mp3$|-prompt\./.test(f.file))).toBe(false);
    // a different minutes value is a different (shared) file only where minutes are spoken; the frame pages are the same
    const other = composePlanBook(def, { ...defaultPlanComposition(def, { bookId: "y", approvedAt: "t", approvedBy: "p" }), minutes: 3 });
    if (book.steps[0].minutes) {
      expect(other.steps[0].id).toBe(want.steps[0].replace(/-\d+m$/, "-3m"));
      expect(other.steps[0].text.en).toContain("3 minutes");
    } else expect(other.steps[0].id).toBe(want.steps[0]);
    expect(other.pages[0]).toEqual(book.pages[0]);
  });
});

describe("the plan module reaches no network and no model", () => {
  it("imports nothing from api/*, server/*, firebase or fetch", () => {
    const dir = here;
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    const files = walk(dir).filter((f) => /\.ts$/.test(f) && !/\.test\.ts$/.test(f));
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/from "[^"]*(?:\/api\/|\/server\/|firebase|\.\.\/\.\.\/api)/);
      expect(src, f).not.toMatch(/\bfetch\(|speechSynthesis|\/api\/generate|\/api\/tts/);
    }
  });
});
