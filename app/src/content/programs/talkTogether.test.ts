import { describe, expect, expectTypeOf, it } from "vitest";
import { ALL_MILESTONES, RETIRED_MILESTONE_IDS } from "../../lib/milestoneData";
import { milestoneShelf, shelfDef, type ShelfId } from "../../lib/shelves/registry";
import { HE_VERDICT_WORDS } from "../../lib/milestoneHeRules";
import { findClinicalDiagnosisTerm } from "../../lib/clinicalScan";
import { PRACTICES, PRACTICE_BANNED, PRACTICE_TECHNIQUES, type PracticeSource, type PracticeTechnique } from "../practices";
import type { LocalizedText } from "../governance";
import { TALK_TOGETHER, TALK_TOGETHER_DOSE, TALK_TOGETHER_META, TALK_TOGETHER_SOURCES } from "./talkTogether";
import { PROGRAMS, programById } from "./index";
import type { CoachScript, LearnCardId, MeasureDef, MilestoneId, PracticeId, Program, ProgramKidWorld, ProgramWeek } from "./types";

/**
 * B-PROG-02 — Talk Together v0.1, the guard (pack P6-PRACTICE acceptance):
 * eight weeks; each week 5–7 practice ids that exist on the Words shelf;
 * three coach scripts EN + HE, ≤ 20 words, passing the practice scan lists,
 * the diagnosis scan and the Hebrew catalogue rules; ≥ 1 watch-for row per
 * week (live, talking domain); no brand or licensed program name anywhere;
 * every week has a source; measures carry both locales and a counting rule;
 * the program ships as a draft. Plus the B-PROG-01 shape, pinned at type level
 * so the engine (session A) compiles against this file.
 */

const P = TALK_TOGETHER;
const words = (s: string): number => s.split(/\s+/).filter(Boolean).length;
const PRACTICE_BY_ID = new Map(PRACTICES.map((p) => [p.id, p]));
const MILESTONE_BY_ID = new Map(ALL_MILESTONES.map((m) => [m.id, m]));

/** Brand / licensed program names (E5): never in a program, in any language. */
const BRAND = {
  en: [/\bhanen\b/i, /hanen-type/i, /\bit takes two\b/i, /\bpcit\b/i, /\btriple p\b/i, /\bincredible years\b/i],
  he: ["האנן", "איט טייקס טו", "טריפל פי", "אינקרדיבל", "פי סי איי טי"],
};
/** The program is "developmentally informed", never clinical, never therapy. */
const CLINICAL_CLAIM = { en: [/\bclinical\b/i, /\btherap/i, /\btreat/i], he: ["קליני", "טיפול", "תרפי"] };

const parentStrings = (): { at: string; text: LocalizedText }[] => [
  { at: "parentSkill", text: P.parentSkill },
  { at: "meta.name", text: TALK_TOGETHER_META.name },
  { at: "meta.describedAs", text: TALK_TOGETHER_META.describedAs },
  ...P.weeks.flatMap((w) => [{ at: `w${w.n}.skill`, text: w.skill }, ...w.coachScripts.map((s) => ({ at: `w${w.n}.${s.id}`, text: s.text }))]),
  ...[P.measures.parentProxy, P.measures.childProxy, TALK_TOGETHER_DOSE, TALK_TOGETHER_META.phrasesMeasure].flatMap((m) => [
    { at: `${m.id}.label`, text: m.label },
    { at: `${m.id}.unit`, text: m.unit },
  ]),
];
const ruleStrings = (): { at: string; text: LocalizedText }[] =>
  [P.measures.parentProxy, P.measures.childProxy, TALK_TOGETHER_DOSE, TALK_TOGETHER_META.phrasesMeasure].map((m) => ({ at: `${m.id}.countingRule`, text: m.countingRule }));

describe("B-PROG-02 — Talk Together v0.1: the eight weeks", () => {
  it("is a draft program on the Words shelf with eight weeks, numbered 1–8, each adding its own skill", () => {
    expect(P.id).toBe("talk-together");
    expect(P.shelf).toBe("words");
    expect(P.reviewStatus).toBe("draft");
    expect(P.weeks.map((w) => w.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(P.weeks.map((w) => w.skill.en)).size).toBe(8);
    expect(new Set(P.weeks.map((w) => w.skill.he)).size).toBe(8);
  });

  it("each week has 5–7 distinct practice ids that exist in PRACTICES and sit on the words shelf", () => {
    for (const w of P.weeks) {
      expect(w.practices.length >= 5 && w.practices.length <= 7, `week ${w.n}: ${w.practices.length}`).toBe(true);
      expect(new Set(w.practices).size, `week ${w.n} repeats a practice`).toBe(w.practices.length);
      for (const id of w.practices) {
        const practice = PRACTICE_BY_ID.get(id);
        expect(practice, `week ${w.n}: ${id} is not in PRACTICES`).toBeTruthy();
        expect(practice!.shelf, `week ${w.n}: ${id}`).toBe("words");
      }
    }
  });

  it("each week has three coach scripts, EN + HE, ≤ 20 words, unique ids", () => {
    const ids = P.weeks.flatMap((w) => w.coachScripts.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const w of P.weeks) {
      expect(w.coachScripts, `week ${w.n}`).toHaveLength(3);
      for (const s of w.coachScripts) {
        expect(s.id, s.id).toMatch(new RegExp(`^tt-w${w.n}-s[1-3]$`));
        for (const loc of ["en", "he"] as const) {
          expect(s.text[loc].trim().length, `${s.id}.${loc}`).toBeGreaterThan(0);
          expect(words(s.text[loc]), `${s.id}.${loc} = ${words(s.text[loc])} words`).toBeLessThanOrEqual(20);
        }
      }
    }
  });

  it("each week watches for ≥ 1 live catalogue row on the Words shelf, talking domain (never a retired id)", () => {
    for (const w of P.weeks) {
      expect(w.watchFor.length, `week ${w.n}`).toBeGreaterThanOrEqual(1);
      for (const id of w.watchFor) {
        const m = MILESTONE_BY_ID.get(id);
        expect(m, `week ${w.n}: ${id} is not in ALL_MILESTONES`).toBeTruthy();
        expect(RETIRED_MILESTONE_IDS, `week ${w.n}: ${id}`).not.toContain(id);
        expect(milestoneShelf(m!), `week ${w.n}: ${id}`).toBe("words");
        expect(shelfDef(milestoneShelf(m!)).domain, `week ${w.n}: ${id}`).toBe("talking");
      }
    }
  });

  it("every week has a source: its evidence lists ≥ 1 of the program's sources, each with org, title and year", () => {
    expect(TALK_TOGETHER_META.weekEvidence.map((e) => e.n)).toEqual(P.weeks.map((w) => w.n));
    for (const e of TALK_TOGETHER_META.weekEvidence) {
      expect(e.sources.length, `week ${e.n}`).toBeGreaterThanOrEqual(1);
      expect(e.why.trim().length, `week ${e.n}`).toBeGreaterThan(0);
      for (const s of e.sources) expect(P.evidence.sources, `week ${e.n}: ${s.title}`).toContain(s);
    }
    expect(P.evidence.sources).toEqual(Object.values(TALK_TOGETHER_SOURCES));
    for (const s of P.evidence.sources) {
      expect(s.org.trim().length, s.title).toBeGreaterThan(0);
      expect(s.title.trim().length).toBeGreaterThan(0);
      expect(Number.isInteger(s.year) && s.year >= 1980 && s.year <= 2026, s.title).toBe(true);
      if (s.url) expect(s.url, s.title).toMatch(/^https:\/\//);
    }
    for (const t of P.evidence.techniques) expect(PRACTICE_TECHNIQUES).toContain(t);
    expect(P.evidence.techniques).toEqual(["responsive_interaction", "serve_and_return", "dialogic_reading"]);
  });
});

describe("B-PROG-02 — the firewall scans", () => {
  it("coach scripts, skills, labels and units pass the practice scan lists (PRACTICE_BANNED + the catalogue's HE verdict words), EN + HE", () => {
    const hits: string[] = [];
    for (const { at, text } of parentStrings()) {
      for (const re of PRACTICE_BANNED.en) if (re.test(text.en)) hits.push(`${at}.en ${re}`);
      for (const w of [...PRACTICE_BANNED.he, ...HE_VERDICT_WORDS]) if (text.he.includes(w)) hits.push(`${at}.he "${w}"`);
    }
    expect(hits).toEqual([]);
  });

  it("findClinicalDiagnosisTerm is null on every string, counting rules and the weeks' reviewer text included", () => {
    const all = [...parentStrings(), ...ruleStrings()].flatMap(({ at, text }) => [{ at: `${at}.en`, s: text.en }, { at: `${at}.he`, s: text.he }]);
    all.push(...TALK_TOGETHER_META.weekEvidence.map((e) => ({ at: `w${e.n}.why`, s: e.why })));
    const hits = all.map((x) => ({ ...x, term: findClinicalDiagnosisTerm(x.s) })).filter((x) => x.term).map((x) => `${x.at}: ${x.term}`);
    expect(hits).toEqual([]);
  });

  it("no brand or licensed program name anywhere (strings, rules, reviewer text, source titles); never 'clinical' or 'therapy' on a parent string", () => {
    const hits: string[] = [];
    const scan = (at: string, en: string, he: string) => {
      for (const re of BRAND.en) if (re.test(en) || re.test(he)) hits.push(`${at} ${re}`);
      for (const w of BRAND.he) if (he.includes(w) || en.includes(w)) hits.push(`${at} "${w}"`);
    };
    for (const { at, text } of [...parentStrings(), ...ruleStrings()]) scan(at, text.en, text.he);
    for (const e of TALK_TOGETHER_META.weekEvidence) scan(`w${e.n}.why`, e.why, "");
    for (const s of P.evidence.sources) scan(`source ${s.title}`, `${s.org} ${s.title}`, "");
    for (const { at, text } of parentStrings()) {
      for (const re of CLINICAL_CLAIM.en) if (re.test(text.en)) hits.push(`${at}.en ${re}`);
      for (const w of CLINICAL_CLAIM.he) if (text.he.includes(w)) hits.push(`${at}.he "${w}"`);
    }
    expect(hits).toEqual([]);
    expect(TALK_TOGETHER_META.describedAs.en).toMatch(/developmentally informed/i);
  });

  it("NEGATIVE CONTROL: the brand and claim scans fire on the shapes they forbid", () => {
    for (const bad of ["A Hanen-type program", "Inspired by It Takes Two to Talk", "Like PCIT", "Triple P style", "The Incredible Years way"]) {
      expect(BRAND.en.some((re) => re.test(bad)), bad).toBe(true);
    }
    expect(BRAND.he.some((w) => "תוכנית האנן להורים".includes(w))).toBe(true);
    expect(CLINICAL_CLAIM.en.some((re) => re.test("A clinical speech therapy program"))).toBe(true);
    expect(PRACTICE_BANNED.en.some((re) => re.test("Get him to say five words."))).toBe(true);
  });

  it("Hebrew strings carry no Latin letters; the PEER acronym stays in English only", () => {
    const hits = [...parentStrings(), ...ruleStrings()].filter(({ text }) => /[A-Za-z]/.test(text.he)).map(({ at }) => at);
    expect(hits).toEqual([]);
    expect(P.weeks[6].skill.en).toContain("PEER");
    expect(P.weeks[6].skill.he).not.toContain("PEER");
  });
});

describe("B-PROG-02 — the three measures", () => {
  const measures: MeasureDef[] = [P.measures.parentProxy, P.measures.childProxy, TALK_TOGETHER_DOSE, TALK_TOGETHER_META.phrasesMeasure];

  it("dose is the actionLoops count; the parent proxy is a self-count; the child proxy reads the Words shelf entries (+ the phrases companion from the milestone)", () => {
    expect(P.measures.dose).toBe(true);
    expect(TALK_TOGETHER_DOSE.source).toBe("actionLoops");
    expect(P.measures.parentProxy.source).toBe("selfCount");
    expect(P.measures.childProxy.source).toBe("shelfEntries");
    expect(TALK_TOGETHER_META.phrasesMeasure.source).toBe("milestone");
    expect(TALK_TOGETHER_META.phrasesMeasure.countingRule.en).toContain("cdc-24m-3");
    expect(MILESTONE_BY_ID.get("cdc-24m-3")?.title).toBe("Says two words together");
  });

  it("every measure carries both locales of its label, unit and counting rule; each rule counts against the family's own first week (or the day ledger), never a grade", () => {
    for (const m of measures) {
      for (const field of ["label", "unit", "countingRule"] as const) {
        expect(m[field].en.trim().length, `${m.id}.${field}.en`).toBeGreaterThan(0);
        expect(m[field].he.trim().length, `${m.id}.${field}.he`).toBeGreaterThan(0);
      }
      expect(m.countingRule.en, m.id).not.toMatch(/%|\bscore|\bbehind\b|\bon track\b|\baverage\b|\bnormal/i);
    }
    for (const m of [P.measures.parentProxy, P.measures.childProxy, TALK_TOGETHER_META.phrasesMeasure]) {
      expect(m.countingRule.en, m.id).toMatch(/your own first week/);
      expect(m.countingRule.he, m.id).toContain("השבוע הראשון שלכם");
    }
    expect(P.measures.parentProxy.countingRule.en).toMatch(/not your child/);
    expect(TALK_TOGETHER_DOSE.countingRule.en).toMatch(/never shown as missed/);
  });
});

describe("B-PROG-02 — the registry and the B-PROG-01 shape (session A builds the engine on this file)", () => {
  it("PROGRAMS holds Talk Together first (B-PROG-06 adds Steady Nights second); programById finds it, and nothing unknown", () => {
    expect(PROGRAMS.map((p) => p.id)).toEqual(["talk-together", "steady-nights"]);
    expect(programById("talk-together")).toBe(TALK_TOGETHER);
    expect(programById("no-such-program")).toBeUndefined();
  });

  it("runtime shape: the program's keys are exactly the pack's (no extra field rides inside Program)", () => {
    expect(Object.keys(P).sort()).toEqual(["evidence", "id", "measures", "parentSkill", "reviewStatus", "shelf", "weeks"]);
    // B-PROG-13: `kidWorld` is optional like `lesson` (weeks 6-8 name one).
    for (const w of P.weeks) expect(Object.keys(w).filter((k) => k !== "lesson" && k !== "kidWorld").sort()).toEqual(["coachScripts", "n", "practices", "skill", "watchFor"]);
    expect(P.weeks.map((w) => w.kidWorld ?? null)).toEqual([null, null, null, null, null, "word-world", "word-world", "sound-lab"]);
    expect(Object.keys(P.measures).sort()).toEqual(["childProxy", "dose", "parentProxy"]);
    expect(Object.keys(P.measures.parentProxy).sort()).toEqual(["countingRule", "id", "label", "source", "unit"]);
    expect(Object.keys(P.evidence).sort()).toEqual(["sources", "techniques"]);
  });

  it("type level: Program / ProgramWeek / MeasureDef / CoachScript match the P6 B-PROG-01 definition", () => {
    expectTypeOf<keyof Program>().toEqualTypeOf<"id" | "shelf" | "weeks" | "parentSkill" | "evidence" | "measures" | "reviewStatus">();
    expectTypeOf<Program["shelf"]>().toEqualTypeOf<ShelfId>();
    expectTypeOf<Program["weeks"]>().toEqualTypeOf<ProgramWeek[]>();
    expectTypeOf<Program["parentSkill"]>().toEqualTypeOf<LocalizedText>();
    expectTypeOf<Program["evidence"]>().toEqualTypeOf<{ techniques: PracticeTechnique[]; sources: PracticeSource[] }>();
    expectTypeOf<Program["measures"]>().toEqualTypeOf<{ dose: true; parentProxy: MeasureDef; childProxy: MeasureDef }>();
    expectTypeOf<Program["reviewStatus"]>().toEqualTypeOf<"draft" | "approved" | "retired">();
    expectTypeOf<keyof ProgramWeek>().toEqualTypeOf<"n" | "skill" | "lesson" | "practices" | "coachScripts" | "watchFor" | "kidWorld">();
    expectTypeOf<ProgramWeek["kidWorld"]>().toEqualTypeOf<ProgramKidWorld | undefined>();
    expectTypeOf<ProgramWeek["lesson"]>().toEqualTypeOf<LearnCardId | undefined>();
    expectTypeOf<ProgramWeek["practices"]>().toEqualTypeOf<PracticeId[]>();
    expectTypeOf<ProgramWeek["coachScripts"]>().toEqualTypeOf<CoachScript[]>();
    expectTypeOf<ProgramWeek["watchFor"]>().toEqualTypeOf<MilestoneId[]>();
    expectTypeOf<keyof MeasureDef>().toEqualTypeOf<"id" | "label" | "countingRule" | "source" | "unit">();
    expectTypeOf<MeasureDef["source"]>().toEqualTypeOf<"actionLoops" | "selfCount" | "shelfEntries" | "milestone" | "sleepLogs">();
    expectTypeOf<keyof CoachScript>().toEqualTypeOf<"id" | "text">();
    expectTypeOf<PracticeSource>().toEqualTypeOf<{ org: string; title: string; url?: string; year: number; verified?: boolean }>(); // B-PROG-06 adds `verified`
    expectTypeOf(TALK_TOGETHER).toEqualTypeOf<Program>();
  });
});
