import { describe, expect, it } from "vitest";
import { buildIntakePacket, type IntakePacketInput } from "./packet";
import { acceptProposedGoal, startHomeProgram, toggleExerciseDay, type HomeProgramEnrolment } from "../content/programs/homeProgram";
import { scoreGoal, type FamilyGoal } from "../lib/goals";
import { translate } from "../lib/i18n";

/* B-PROG-09 (adherence out) — the professional's packet carries the home
   program THIS professional gave: the week, the practice days as counts (d/7
   the only slash shape), one line per exercise in the family's words with its
   days, and each proposed goal in the family's words with the family's own
   last word. The goal NUMBER stays in the family-goals section under the
   "family-set scale" title (3eb513a5) — never in this section. EN + HE. */

const START = new Date(2026, 9, 1, 9);
const NOW = new Date(2026, 9, 9, 20).getTime(); // week 2 of the program
const SCALE = { "-2": "Not at all", "-1": "Once or twice", "0": "Some mornings", "1": "Most mornings", "2": "Every morning" };

const make = (): { e: HomeProgramEnrolment; goals: FamilyGoal[] } => {
  const r = startHomeProgram([], { profession: "ot", exercises: [{ text: "Thread five big beads after breakfast", shelf: "hands" }, { text: "Crawl through the cushion tunnel twice", shelf: "moving" }], nextVisit: "2026-10-29" }, START);
  if (!("enrolment" in r)) throw new Error("no enrolment");
  let e = r.enrolment;
  for (const d of [2, 8, 9]) e = toggleExerciseDay(e, "ex-1", new Date(2026, 9, d, 9));
  e = toggleExerciseDay(e, "ex-1", new Date(2026, 9, 9, 9)); // undone again on the 9th
  e = toggleExerciseDay(e, "ex-1", new Date(2026, 9, 9, 10)); // and re-marked
  const a = acceptProposedGoal([], { text: "Puts on the top half alone", scale: SCALE }, "ot", START);
  if (!("goal" in a)) throw new Error("no goal");
  const b = acceptProposedGoal([a.goal], { text: "Holds the spoon by himself", scale: SCALE }, "ot", new Date(START.getTime() + 1));
  if (!("goal" in b)) throw new Error("no goal");
  return { e, goals: [scoreGoal(a.goal, 1, new Date(2026, 9, 8, 20)), b.goal] };
};

const input = (over: Partial<IntakePacketInput> = {}): IntakePacketInput => {
  const { e, goals } = make();
  return { child: { id: "c1", name: "Dylan Demo", age: 3, gender: "boy" }, milestones: [], behaviorLogs: [], actionLoops: [], nowMs: NOW, homePrograms: [e], familyGoals: goals, ...over };
};
const homeSection = (p: ReturnType<typeof buildIntakePacket>) => p.sections.find((s) => s.id === "intake-home-program");

describe("B-PROG-09 packet — the home program's adherence", () => {
  it("EN: the OT packet carries week, practice days as counts, the exercises' days and the goals in the family's words", () => {
    const s = homeSection(buildIntakePacket("ot", input()))!;
    expect(s.title).toBe("Home program");
    const lines = s.items.map((i) => i.text);
    expect(lines[0]).toMatch(/^Home program · Occupational therapist: week 2 of 4 · practice days 2\/7 this week · 3 practice days since 1 Oct 2026$/);
    expect(lines.slice(1, 3)).toEqual([
      "Thread five big beads after breakfast: done on 3 days",
      "Crawl through the cushion tunnel twice: not marked yet",
    ]);
    expect(lines.slice(3)).toEqual([
      "Puts on the top half alone · Proposed by the occupational therapist · last marked, in the family's words: “Most mornings”",
      "Holds the spoon by himself · Proposed by the occupational therapist · not marked yet",
    ]);
    const all = lines.join("\n");
    // counts and words only: d/7 the only slash, no %, no signed number, no rate words
    expect(all.match(/\d+\/\d+/g)).toEqual(["2/7"]);
    expect(all).not.toMatch(/%|[+−-]\d|rate|ratio|score|adherence/i);
  });

  it("the goal NUMBER stays in the family-goals section (family-set scale), never in the home-program section", () => {
    const p = buildIntakePacket("ot", input());
    expect(homeSection(p)!.items.map((i) => i.text).join(" ")).not.toMatch(/\+1/);
    const goals = p.sections.find((s) => s.id === "intake-goals")!;
    expect(goals.items[0].text).toContain("+1 on the family's scale (Most mornings)");
  });

  it("HE: the same section in Hebrew", () => {
    const s = homeSection(buildIntakePacket("ot", input({ lang: "he" })))!;
    const lines = s.items.map((i) => i.text);
    const name = translate("he", "elev.homeProgram.name", { profession: translate("he", "elev.carehonesty.consult.audience.ot") });
    expect(lines[0].startsWith(`${name}: שבוע 2 מתוך 4 · ימי תרגול 2/7 השבוע · 3 ימי תרגול מאז`)).toBe(true);
    expect(lines[1]).toBe("Thread five big beads after breakfast: נעשה ב-3 ימים");
    expect(lines[3]).toContain(translate("he", "elev.homeProgram.goal.proposedBy", { profession: translate("he", "elev.carehonesty.consult.audience.ot") }));
  });

  it("another profession's packet, a finished program or no program carries no home-program section", () => {
    expect(homeSection(buildIntakePacket("slp", input()))).toBeUndefined();
    const { e } = make();
    expect(homeSection(buildIntakePacket("ot", input({ homePrograms: [{ ...e, status: "done" }] })))).toBeUndefined();
    expect(homeSection(buildIntakePacket("ot", input({ homePrograms: [] })))).toBeUndefined();
    expect(homeSection(buildIntakePacket("ot", input({ homePrograms: undefined })))).toBeUndefined();
  });
});
