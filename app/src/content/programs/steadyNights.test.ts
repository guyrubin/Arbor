import { describe, expect, expectTypeOf, it } from "vitest";
import { HE_VERDICT_WORDS } from "../../lib/milestoneHeRules";
import { findClinicalDiagnosisTerm } from "../../lib/clinicalScan";
import { diaryBaseline, longestStretchLine, nightsInWeek, programWeekRange, recordRoutineTap, recordSleepDiaryNight, routineDoneInOrderCount, weekLongestStretch } from "../../lib/sleepDiary";
import { PRACTICES, PRACTICE_BANNED, PRACTICE_TECHNIQUES } from "../practices";
import type { LocalizedText } from "../governance";
import type { SleepLogEntry } from "../../types";
import { STEADY_NIGHTS, STEADY_NIGHTS_DOSE, STEADY_NIGHTS_META, STEADY_NIGHTS_SOURCES } from "./steadyNights";
import { TALK_TOGETHER } from "./talkTogether";
import { PROGRAMS, programById } from "./index";
import type { MeasureDef, Program } from "./types";

/**
 * B-PROG-06 — Steady Nights v0.1, the guard (pack P6-PRACTICE acceptance, as
 * B-PROG-02's test, on the `sleep` shelf): six weeks; each week 5–7 practice
 * ids that exist on the Sleep shelf; three coach scripts EN + HE, ≤ 20 words,
 * passing the practice scan lists, the diagnosis scan and the Hebrew rules;
 * ZERO watch-for every week (the catalogue has no sleep row); the
 * RESTRICTED-METHOD scan over every string of the program (and the program's
 * practices); no brand; every week has a source; measures carry both locales
 * and counting rules; a draft; and the diary measure renders the longest
 * stretch as hours with the first diary week beside it.
 */

const P = STEADY_NIGHTS;
const words = (s: string): number => s.split(/\s+/).filter(Boolean).length;
const PRACTICE_BY_ID = new Map(PRACTICES.map((p) => [p.id, p]));

/** The sleep-method safety rule (B-LOOP-08 + B-PROG-06): never a method that
 *  leaves a distressed child without a response, never a named method or
 *  brand, never "sleep training" as a claim, never a minutes schedule, never
 *  an amount of sleep. EN regexes, HE substrings. */
const RESTRICTED_METHOD = {
  en: [
    /cry(?:ing)?[- ]it[- ]out/i, /controlled crying/i, /\bextinction\b/i, /\bferber/i, /\bweissbluth/i,
    /\blet (?:him|her|them|your child|the child|the baby|your baby) cry\b/i, /\bleave (?:him|her|them|your child|the baby) to cry\b/i,
    /\bsleep[- ]train/i, /\bcheck(?:ing)?[- ]and[- ]console\b/i, /\bpick[- ]up[,]?[- ]put[- ]down\b/i, /\bchair method\b/i, /\bcamping out\b/i,
    // minutes schedules ("5 minutes, then 10" / "five minutes longer each night")
    /\b\d+\s*(?:min|mins|minutes?)\b[^.]*\bthen\b[^.]*\b\d+/i,
    /\b(?:one|two|three|four|five|ten|fifteen|twenty)\s+minutes?\b/i,
    /\bminutes?\s+(?:longer|more|less)\s+each\s+night\b/i,
    // amounts of sleep
    /\bhours?\s+of\s+sleep\b/i, /\b\d+(?:\.\d+)?\s*(?:-|–|to)\s*\d+(?:\.\d+)?\s*hours?\b/i, /\b(?:needs?|should (?:get|sleep))\s+\d+/i,
  ],
  he: [
    "לתת לו לבכות", "לתת לה לבכות", "להשאיר אותו לבכות", "להשאיר אותה לבכות", "לבכות עד", "בכי מבוקר",
    "שיטת", "אימון שינה", "אילוף שינה", "הכחדה", "פרבר", "וייסבלוט", "שעות שינה",
  ],
};

/** Brand / licensed program names (E5), sleep brands included. */
const BRAND = {
  en: [/\bhanen\b/i, /\bpcit\b/i, /\btriple p\b/i, /\bincredible years\b/i, /\bferber/i, /\bweissbluth/i, /\bsleep lady\b/i, /\bno[- ]cry sleep\b/i, /\bbaby whisperer\b/i, /\bhuckleberry\b/i, /\btaking cara\b/i],
  he: ["האנן", "טריפל פי", "פרבר", "וייסבלוט", "האקלברי"],
};
const CLINICAL_CLAIM = { en: [/\bclinical\b/i, /\btherap/i, /\btreat/i], he: ["קליני", "טיפול", "תרפי"] };

const measures = (): MeasureDef[] => [P.measures.parentProxy, P.measures.childProxy, STEADY_NIGHTS_DOSE];
const parentStrings = (): { at: string; text: LocalizedText }[] => [
  { at: "parentSkill", text: P.parentSkill },
  { at: "meta.name", text: STEADY_NIGHTS_META.name },
  { at: "meta.describedAs", text: STEADY_NIGHTS_META.describedAs },
  { at: "meta.week5Safety", text: STEADY_NIGHTS_META.boundaries.week5Safety },
  ...STEADY_NIGHTS_META.parentNotes.map((n) => ({ at: `meta.note.${n.id}`, text: n.prompt })),
  ...P.weeks.flatMap((w) => [{ at: `w${w.n}.skill`, text: w.skill }, ...w.coachScripts.map((s) => ({ at: `w${w.n}.${s.id}`, text: s.text }))]),
  ...measures().flatMap((m) => [{ at: `${m.id}.label`, text: m.label }, { at: `${m.id}.unit`, text: m.unit }]),
];
const ruleStrings = (): { at: string; text: LocalizedText }[] => [
  ...measures().map((m) => ({ at: `${m.id}.countingRule`, text: m.countingRule })),
  { at: "meta.professional", text: STEADY_NIGHTS_META.boundaries.professional },
];
/** EVERY string of the program: parent strings, rules, the weeks' reviewer text, source titles, and the program's practices. */
const everyString = (): { at: string; en: string; he: string }[] => [
  ...[...parentStrings(), ...ruleStrings()].map(({ at, text }) => ({ at, en: text.en, he: text.he })),
  ...STEADY_NIGHTS_META.weekEvidence.map((e) => ({ at: `w${e.n}.why`, en: e.why, he: "" })),
  ...P.evidence.sources.map((s) => ({ at: `source ${s.title}`, en: `${s.org} ${s.title}`, he: "" })),
  ...[...new Set(P.weeks.flatMap((w) => w.practices))].flatMap((id) => {
    const p = PRACTICE_BY_ID.get(id)!;
    return [{ at: `${id}.do`, en: p.do.en, he: p.do.he }, { at: `${id}.say`, en: p.say.en, he: p.say.he }, ...(p.materials ? [{ at: `${id}.materials`, en: p.materials.en, he: p.materials.he }] : [])];
  }),
];

describe("B-PROG-06 — Steady Nights v0.1: the six weeks", () => {
  it("is a draft program on the Sleep shelf with six weeks, numbered 1–6, each adding its own skill", () => {
    expect(P.id).toBe("steady-nights");
    expect(P.shelf).toBe("sleep");
    expect(P.reviewStatus).toBe("draft");
    expect(P.weeks.map((w) => w.n)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(P.weeks.map((w) => w.skill.en)).size).toBe(6);
    expect(new Set(P.weeks.map((w) => w.skill.he)).size).toBe(6);
  });

  it("each week has 5–7 distinct practice ids that exist in PRACTICES and sit on the sleep shelf (the allowed set: pr-sleep-02…21; never pr-sleep-01)", () => {
    const allowed = new Set(Array.from({ length: 20 }, (_, i) => `pr-sleep-${String(i + 2).padStart(2, "0")}`));
    for (const w of P.weeks) {
      expect(w.practices.length >= 5 && w.practices.length <= 7, `week ${w.n}: ${w.practices.length}`).toBe(true);
      expect(new Set(w.practices).size, `week ${w.n} repeats a practice`).toBe(w.practices.length);
      for (const id of w.practices) {
        expect(allowed.has(id), `week ${w.n}: ${id} is outside the allowed set`).toBe(true);
        const practice = PRACTICE_BY_ID.get(id);
        expect(practice, `week ${w.n}: ${id} is not in PRACTICES`).toBeTruthy();
        expect(practice!.shelf, `week ${w.n}: ${id}`).toBe("sleep");
      }
    }
    expect(P.weeks.flatMap((w) => w.practices)).not.toContain("pr-sleep-01");
  });

  it("age fit: enrols from 12 months; weeks 1–4 and 6 keep ≥ 3 practices anchored at 15 months or younger; week 5 starts from 18 months", () => {
    expect(STEADY_NIGHTS_META.enrolFromMonths).toBe(12);
    expect(STEADY_NIGHTS_META.builtFor).toEqual({ fromMonths: 12, toMonths: 72 });
    for (const w of P.weeks) {
      const young = w.practices.filter((id) => PRACTICE_BY_ID.get(id)!.ageMonths <= 15).length;
      if (w.n === 5) expect(STEADY_NIGHTS_META.weekBands.find((b) => b.n === 5)?.fromMonths).toBe(18);
      else expect(young, `week ${w.n}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("each week has three coach scripts, EN + HE, ≤ 20 words, unique ids", () => {
    const ids = P.weeks.flatMap((w) => w.coachScripts.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const w of P.weeks) {
      expect(w.coachScripts, `week ${w.n}`).toHaveLength(3);
      for (const s of w.coachScripts) {
        expect(s.id).toMatch(new RegExp(`^sn-w${w.n}-s[1-3]$`));
        for (const loc of ["en", "he"] as const) {
          expect(s.text[loc].trim().length, `${s.id}.${loc}`).toBeGreaterThan(0);
          expect(words(s.text[loc]), `${s.id}.${loc} = ${words(s.text[loc])} words`).toBeLessThanOrEqual(20);
        }
      }
    }
  });

  it("watch-for is EMPTY every week — the catalogue has no sleep row (Steady Nights only; Talk Together keeps ≥ 1)", () => {
    for (const w of P.weeks) expect(w.watchFor, `week ${w.n}`).toEqual([]);
    for (const w of TALK_TOGETHER.weeks) expect(w.watchFor.length, `talk-together week ${w.n}`).toBeGreaterThanOrEqual(1);
  });

  it("every week has a source: its evidence lists ≥ 1 of the program's sources, each with org, title, year and a verified flag; only a verified source carries a URL", () => {
    expect(STEADY_NIGHTS_META.weekEvidence.map((e) => e.n)).toEqual(P.weeks.map((w) => w.n));
    for (const e of STEADY_NIGHTS_META.weekEvidence) {
      expect(e.sources.length, `week ${e.n}`).toBeGreaterThanOrEqual(1);
      expect(e.why.trim().length).toBeGreaterThan(0);
      for (const s of e.sources) expect(P.evidence.sources, `week ${e.n}: ${s.title}`).toContain(s);
    }
    expect(P.evidence.sources).toEqual(Object.values(STEADY_NIGHTS_SOURCES));
    expect(P.evidence.sources).toHaveLength(12);
    for (const s of P.evidence.sources) {
      expect(s.org.trim().length).toBeGreaterThan(0);
      expect(Number.isInteger(s.year) && s.year >= 1980 && s.year <= 2026, s.title).toBe(true);
      expect(typeof s.verified, s.title).toBe("boolean");
      if (s.url) expect(s.url, s.title).toMatch(/^https:\/\//);
      if (!s.verified) expect(s.url, s.title).toBeUndefined();
    }
    // the five sources the author opened on 6 Oct (S1, S2, S3, S6, S9)
    expect(P.evidence.sources.filter((s) => s.verified).map((s) => s.org + " " + s.title).length).toBe(5);
    for (const t of P.evidence.techniques) expect(PRACTICE_TECHNIQUES).toContain(t);
    expect(P.evidence.techniques).toEqual(["routine_building", "responsive_interaction", "specific_praise"]);
  });
});

describe("B-PROG-06 — the firewall and the sleep-method safety rule", () => {
  it("skills, scripts, labels, units, notes and the week-5 safety line pass the practice scan lists (PRACTICE_BANNED + HE verdict words), EN + HE", () => {
    const hits: string[] = [];
    for (const { at, text } of parentStrings()) {
      for (const re of PRACTICE_BANNED.en) if (re.test(text.en)) hits.push(`${at}.en ${re}`);
      for (const w of [...PRACTICE_BANNED.he, ...HE_VERDICT_WORDS]) if (text.he.includes(w)) hits.push(`${at}.he "${w}"`);
    }
    expect(hits).toEqual([]);
  });

  it("findClinicalDiagnosisTerm is null on every string, counting rules, the professional line and the weeks' reviewer text included", () => {
    const all = [...parentStrings(), ...ruleStrings()].flatMap(({ at, text }) => [{ at: `${at}.en`, s: text.en }, { at: `${at}.he`, s: text.he }]);
    all.push(...STEADY_NIGHTS_META.weekEvidence.map((e) => ({ at: `w${e.n}.why`, s: e.why })));
    const hits = all.map((x) => ({ ...x, term: findClinicalDiagnosisTerm(x.s) })).filter((x) => x.term).map((x) => `${x.at}: ${x.term}`);
    expect(hits).toEqual([]);
  });

  it("the RESTRICTED-METHOD scan is green over EVERY string of the program (strings, rules, reviewer text, source titles, the program's practices)", () => {
    const hits: string[] = [];
    for (const { at, en, he } of everyString()) {
      for (const re of RESTRICTED_METHOD.en) if (re.test(en)) hits.push(`${at}.en ${re}`);
      for (const w of RESTRICTED_METHOD.he) if (he.includes(w)) hits.push(`${at}.he "${w}"`);
    }
    expect(hits).toEqual([]);
    expect(everyString().length).toBeGreaterThan(80);
  });

  it("NEGATIVE CONTROL: the restricted-method and brand scans fire on the shapes they forbid", () => {
    for (const bad of [
      "Let him cry it out.", "Try controlled crying.", "Graduated extinction works.", "The Ferber way.", "Weissbluth says so.",
      "Let her cry for a while.", "Sleep training in a week.", "Wait 5 minutes, then 10.", "Leave for five minutes.",
      "Stay five minutes longer each night.", "She needs 11 hours of sleep.", "Toddlers need 11-14 hours.", "He should sleep 12 hours.",
    ]) expect(RESTRICTED_METHOD.en.some((re) => re.test(bad)), bad).toBe(true);
    for (const bad of ["אפשר לתת לו לבכות קצת", "להשאיר אותה לבכות", "שיטת פרבר", "אימון שינה בשבוע", "צריך 12 שעות שינה"]) {
      expect(RESTRICTED_METHOD.he.some((w) => bad.includes(w)), bad).toBe(true);
    }
    expect(BRAND.en.some((re) => re.test("The Huckleberry SweetSpot schedule"))).toBe(true);
    // the allowed public guidance (orchestrator ruling) does NOT trip the scan
    for (const ok of ["sitting by the door instead of the bed", "walk them back calmly with as few words as possible"]) {
      expect(RESTRICTED_METHOD.en.some((re) => re.test(ok)), ok).toBe(false);
    }
  });

  it("no brand or licensed program name anywhere; never 'clinical', 'therapy' or 'treat' on a parent string", () => {
    const hits: string[] = [];
    for (const { at, en, he } of everyString()) {
      for (const re of BRAND.en) if (re.test(en) || re.test(he)) hits.push(`${at} ${re}`);
      for (const w of BRAND.he) if (he.includes(w) || en.includes(w)) hits.push(`${at} "${w}"`);
    }
    for (const { at, text } of parentStrings()) {
      for (const re of CLINICAL_CLAIM.en) if (re.test(text.en)) hits.push(`${at}.en ${re}`);
      for (const w of CLINICAL_CLAIM.he) if (text.he.includes(w)) hits.push(`${at}.he "${w}"`);
    }
    expect(hits).toEqual([]);
    expect(STEADY_NIGHTS_META.describedAs.en).toMatch(/developmentally informed/i);
  });

  it("Hebrew strings carry no Latin letters", () => {
    const hits = [...parentStrings(), ...ruleStrings()].filter(({ text }) => /[A-Za-z]/.test(text.he)).map(({ at }) => at);
    expect(hits).toEqual([]);
  });

  it("safe sleep under 12 months is never paraphrased here: a verbatim placeholder for the reviewer, and pr-sleep-01 is not in the program", () => {
    expect(STEADY_NIGHTS_META.boundaries.safeSleepUnder12m).toBe("[AAP 2022 safe-sleep wording — reviewer to supply verbatim]");
    expect(P.evidence.sources).toContain(STEADY_NIGHTS_SOURCES.aapSafeSleep);
  });
});

describe("B-PROG-06 — the three measures", () => {
  it("dose is the actionLoops count; the parent proxy is the routine tap (selfCount); the child proxy is the sleep diary (sleepLogs)", () => {
    expect(P.measures.dose).toBe(true);
    expect(STEADY_NIGHTS_DOSE.source).toBe("actionLoops");
    expect(P.measures.parentProxy.source).toBe("selfCount");
    expect(P.measures.parentProxy.label.en).toBe("Routine done in order");
    expect(P.measures.childProxy.source).toBe("sleepLogs");
    expect(P.measures.childProxy.unit.en).toBe("hours");
  });

  it("every measure carries both locales of its label, unit and counting rule; never a grade or a recommended number of hours", () => {
    for (const m of measures()) {
      for (const field of ["label", "unit", "countingRule"] as const) {
        expect(m[field].en.trim().length, `${m.id}.${field}.en`).toBeGreaterThan(0);
        expect(m[field].he.trim().length, `${m.id}.${field}.he`).toBeGreaterThan(0);
      }
      expect(m.countingRule.en, m.id).not.toMatch(/%|\bscore|\bbehind\b|\bon track\b|\baverage\b|\bnormal|\bbetter\b|\bworse\b/i);
    }
    expect(P.measures.parentProxy.countingRule.en).toMatch(/your own first week/);
    expect(P.measures.parentProxy.countingRule.he).toContain("השבוע הראשון שלכם");
    expect(P.measures.parentProxy.countingRule.en).toMatch(/not anything the child did/);
    expect(P.measures.childProxy.countingRule.en).toMatch(/your first diary week/);
    expect(P.measures.childProxy.countingRule.he).toContain("שבוע היומן הראשון שלכם");
    expect(P.measures.childProxy.countingRule.en).toMatch(/Never a recommended number of hours/);
    expect(STEADY_NIGHTS_DOSE.countingRule.en).toMatch(/never shown as missed/);
  });

  it("the diary measure: a week of diary entries renders the longest stretch as hours with the first diary week's number beside it", () => {
    const NOW = "2026-10-06T07:00:00.000Z";
    const start = "2026-10-05";
    const n = (date: string, bedtime: string, wake: string, wakings?: string[]): SleepLogEntry =>
      recordSleepDiaryNight(recordRoutineTap(undefined, { date, answer: "done_in_order", now: NOW, programId: P.id }), { date, bedtime, wake, wakings, now: NOW })!;
    // week 1: three nights (the family's first diary week) — 19:45→06:15 (10.5), 20:00→01:30→06:00 (5.5 / 4.5 → 5.5), 20:15→02:45→06:30 (6.5)
    const week1 = [n("2026-10-05", "19:45", "06:15"), n("2026-10-06", "20:00", "06:00", ["01:30"]), n("2026-10-07", "20:15", "06:30", ["02:45"])];
    // week 4: four nights — 7.5, 9, 6.5, 8 → lower middle 7.5
    const week4 = [n("2026-10-26", "20:00", "06:00", ["03:30"]), n("2026-10-27", "20:00", "05:00"), n("2026-10-28", "20:00", "06:00", ["02:30"]), n("2026-10-29", "20:00", "04:00")];
    const all = [...week1, ...week4];
    const weeks = [1, 2, 3, 4].map((k) => nightsInWeek(all, programWeekRange(start, k)));
    const baseline = diaryBaseline(weeks);
    expect(baseline).toEqual({ week: 1, hours: 6.5, nights: 3 });
    const thisWeek = weekLongestStretch(weeks[3])!;
    expect(thisWeek).toEqual({ hours: 7.5, nights: 4 });
    expect(longestStretchLine(thisWeek, baseline, "en")).toBe("7.5 hours · from 4 nights in your diary · 6.5 in your first diary week");
    expect(longestStretchLine(thisWeek, baseline, "he")).toBe("7.5 שעות · מתוך 4 לילות ביומן שלכם · 6.5 בשבוע היומן הראשון שלכם");
    // the parent proxy from the same diary documents
    expect(routineDoneInOrderCount(all, programWeekRange(start, 4))).toBe(4);
    // before the first diary week exists, the baseline slot is blank (no message)
    expect(longestStretchLine(weekLongestStretch(week1.slice(0, 2))!, diaryBaseline([week1.slice(0, 2)]), "en")).toBe("5.5 hours · from 2 nights in your diary");
  });
});

describe("B-PROG-06 — the registry and the B-PROG-01 shape", () => {
  it("PROGRAMS holds Talk Together then Steady Nights; programById finds both", () => {
    expect(PROGRAMS.map((p) => p.id)).toEqual(["talk-together", "steady-nights"]);
    expect(programById("steady-nights")).toBe(STEADY_NIGHTS);
  });

  it("runtime shape: the program's keys are exactly the pack's (no extra field rides inside Program)", () => {
    expect(Object.keys(P).sort()).toEqual(["evidence", "id", "measures", "parentSkill", "reviewStatus", "shelf", "weeks"]);
    for (const w of P.weeks) expect(Object.keys(w).filter((k) => k !== "lesson").sort()).toEqual(["coachScripts", "n", "practices", "skill", "watchFor"]);
    expect(Object.keys(P.measures).sort()).toEqual(["childProxy", "dose", "parentProxy"]);
    expectTypeOf(STEADY_NIGHTS).toEqualTypeOf<Program>();
  });
});
