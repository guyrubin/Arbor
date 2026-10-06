import { describe, expect, it } from "vitest";
import { PRACTICES, PRACTICE_BANNED } from "../practices";
import { HE_VERDICT_WORDS } from "../../lib/milestoneHeRules";
import { findClinicalDiagnosisTerm } from "../../lib/clinicalScan";
import { ALL_MILESTONES } from "../../lib/milestoneData";
import { milestoneShelf } from "../../lib/shelves/registry";
import { PROGRAMS, PROGRAM_DOSE, STEADY_NIGHTS, TALK_TOGETHER, programById, programMeta, programName, programWeek } from "./index";

/* B-PROG-01 — the program engine's content contract, over EVERY program in
   the index (a third program is checked the moment it is registered):
   practices exist in content/practices and share the program's shelf; 6–12
   weeks numbered 1..n; every coach script EN + HE passes the firewall scan
   practices.test uses (PRACTICE_BANNED + the catalogue's HE verdict words +
   the diagnosis scan); watch-for ids are live catalogue rows on the shelf. */

const byId = new Map(PRACTICES.map((p) => [p.id, p]));
const catalogue = new Map(ALL_MILESTONES.map((m) => [m.id, m]));

const scan = (text: { en: string; he: string }): string[] => {
  const hits: string[] = [];
  for (const re of PRACTICE_BANNED.en) if (re.test(text.en)) hits.push(`en ${re}`);
  for (const w of [...PRACTICE_BANNED.he, ...HE_VERDICT_WORDS]) if (text.he.includes(w)) hits.push(`he "${w}"`);
  for (const lang of ["en", "he"] as const) {
    const term = findClinicalDiagnosisTerm(text[lang]);
    if (term) hits.push(`${lang} diagnosis "${term}"`);
  }
  return hits;
};

describe("B-PROG-01 — the program index", () => {
  it("exports both programs, their metas and the lookups", () => {
    expect(PROGRAMS.map((p) => p.id)).toEqual(["talk-together", "steady-nights"]);
    expect(programById("talk-together")).toBe(TALK_TOGETHER);
    expect(programById("steady-nights")).toBe(STEADY_NIGHTS);
    expect(programById("nope")).toBeUndefined();
    expect(programName("talk-together")).toEqual({ en: "Talk Together", he: "מדברים ביחד" });
    expect(programName("steady-nights")?.en).toBe("Steady Nights");
    expect(programMeta("toString")).toBeUndefined();
    for (const p of PROGRAMS) {
      expect(programMeta(p.id), p.id).toBeTruthy();
      expect(PROGRAM_DOSE[p.id as keyof typeof PROGRAM_DOSE].source, p.id).toBe("actionLoops");
    }
  });

  it("programWeek clamps to the program's weeks", () => {
    expect(programWeek(TALK_TOGETHER, 0)?.n).toBe(1);
    expect(programWeek(TALK_TOGETHER, 3)?.n).toBe(3);
    expect(programWeek(TALK_TOGETHER, 99)?.n).toBe(TALK_TOGETHER.weeks.length);
  });
});

describe("B-PROG-01 — every program's content contract", () => {
  for (const program of PROGRAMS) {
    describe(program.id, () => {
      it("runs 6–12 weeks, numbered 1..n", () => {
        expect(program.weeks.length).toBeGreaterThanOrEqual(6);
        expect(program.weeks.length).toBeLessThanOrEqual(12);
        expect(program.weeks.map((w) => w.n)).toEqual(program.weeks.map((_, i) => i + 1));
      });

      it("every week's practices exist in content/practices and share the program's shelf (5–7 per week)", () => {
        for (const w of program.weeks) {
          expect(w.practices.length, `week ${w.n}`).toBeGreaterThanOrEqual(5);
          expect(w.practices.length, `week ${w.n}`).toBeLessThanOrEqual(7);
          expect(new Set(w.practices).size, `week ${w.n} duplicates`).toBe(w.practices.length);
          for (const id of w.practices) {
            const p = byId.get(id);
            expect(p, `${program.id} week ${w.n}: ${id} is not in content/practices`).toBeTruthy();
            expect(p!.shelf, `${program.id} week ${w.n}: ${id}`).toBe(program.shelf);
          }
        }
      });

      it("watch-for ids are live catalogue rows on the program's shelf", () => {
        for (const w of program.weeks) {
          for (const id of w.watchFor) {
            const m = catalogue.get(id);
            expect(m, `${program.id} week ${w.n}: ${id}`).toBeTruthy();
            expect(milestoneShelf(m!), `${program.id} week ${w.n}: ${id}`).toBe(program.shelf);
          }
        }
      });

      it("every coach script and week skill is EN + HE and passes the firewall scan", () => {
        const hits: string[] = [];
        for (const w of program.weeks) {
          for (const [at, text] of [[`w${w.n}.skill`, w.skill] as const, ...w.coachScripts.map((s) => [`w${w.n}.${s.id}`, s.text] as const)]) {
            expect(text.en.trim().length, `${at}.en`).toBeGreaterThan(0);
            expect(text.he.trim().length, `${at}.he`).toBeGreaterThan(0);
            expect(/[֐-׿]/.test(text.he), `${at}.he is Hebrew`).toBe(true);
            for (const h of scan(text)) hits.push(`${at} ${h}`);
          }
        }
        expect(hits).toEqual([]);
      });
    });
  }

  it("NEGATIVE CONTROL: the scan flags a pressure line and a digit in Hebrew", () => {
    expect(scan({ en: "Get him to say five words.", he: "תגידו 5 מילים" }).length).toBeGreaterThan(0);
  });
});
