import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildIntakePacket, INTAKE_PROFESSIONS, type IntakePacketInput } from "./packet";
import { archiveGoal, scoreGoal, type FamilyGoal } from "../lib/goals";

/* B-PROG-07 (packet) — the goal attainment number lives ONLY in the
   professional's packet, under the "family-set scale" title, as the number
   plus the family's own word for it. Unmarked goals carry the words alone; a
   goal put aside is not carried. The parent's own surfaces (ProView's lines,
   FamilyGoals, TonightFlow) never print the number. EN + HE. */

const here = path.dirname(fileURLToPath(import.meta.url));
const NOW = Date.parse("2026-10-06T20:00:00");
const scale = { "-2": "Still hitting every day", "-1": "Hitting most days", "0": "A few times a week", "1": "Once a week", "2": "No hitting" };
const goal = (id: string, text: string): FamilyGoal => ({ id, text, setAt: "2026-09-01T08:00:00.000Z", scale, scores: [], updatedAt: "2026-09-01T08:00:00.000Z" });
let marked = scoreGoal(goal("g1", "Gentle hands with his sister"), -1, new Date("2026-09-20T20:00:00"));
marked = scoreGoal(marked, 1, new Date("2026-10-04T20:00:00"));
const once = scoreGoal(goal("g3", "Stays in bed after the story"), -2, new Date("2026-10-04T20:00:00"));
const unmarked = goal("g2", "Asks for help with words");
const aside = archiveGoal(scoreGoal(goal("g4", "An old hope"), 2, new Date("2026-09-10T20:00:00")), new Date("2026-09-12T08:00:00"));

const input = (over: Partial<IntakePacketInput> = {}): IntakePacketInput => ({
  child: { id: "c1", name: "Dylan Demo", age: 3, gender: "boy" },
  milestones: [],
  behaviorLogs: [],
  actionLoops: [],
  nowMs: NOW,
  familyGoals: [marked, unmarked, once, aside],
  ...over,
});
const goalsSection = (p: ReturnType<typeof buildIntakePacket>) => p.sections.find((s) => s.id === "intake-goals");

describe("B-PROG-07 packet — family goals on the family-set scale", () => {
  it("EN: the title names the family-set scale; a marked goal = words + signed number + the family's word + times marked", () => {
    const s = goalsSection(buildIntakePacket("psychology", input()))!;
    expect(s.title).toBe("Family goals (family-set scale)");
    expect(s.items.map((i) => i.text)).toEqual([
      "Gentle hands with his sister: +1 on the family's scale (Once a week) · marked 2 times",
      "Asks for help with words",
      "Stays in bed after the story: -2 on the family's scale (Still hitting every day) · marked once",
    ]);
  });

  it("a goal put aside is not carried; no goals → no section", () => {
    const text = goalsSection(buildIntakePacket("slp", input()))!.items.map((i) => i.text).join("\n");
    expect(text).not.toContain("An old hope");
    expect(goalsSection(buildIntakePacket("slp", input({ familyGoals: [] })))).toBeUndefined();
    expect(goalsSection(buildIntakePacket("slp", input({ familyGoals: undefined })))).toBeUndefined();
  });

  it("every profession's packet carries the goals (they are the family's, not a shelf's)", () => {
    for (const p of INTAKE_PROFESSIONS) expect(goalsSection(buildIntakePacket(p, input()))?.items).toHaveLength(3);
  });

  it("HE: the title and line are Hebrew; the number is an isolate so its sign stays put; no %", () => {
    const s = goalsSection(buildIntakePacket("slp", input({ lang: "he" })))!;
    expect(s.titleKey).toBe("elev.program.goals.packet.title");
    const lines = s.items.map((i) => i.text);
    // the family's Latin words arrive bidi-isolated by translate(); the number is its own isolate
    expect(lines[0]).toContain("Gentle hands with his sister");
    expect(lines[0]).toContain(`: ${String.fromCodePoint(0x2068)}+1${String.fromCodePoint(0x2069)} בסולם של המשפחה (`);
    expect(lines[0]).toContain("Once a week");
    expect(lines[0]).toMatch(/· סומן 2 פעמים$/);
    expect(lines[2]).toContain("סומן פעם אחת");
    expect(lines.join("\n")).not.toMatch(/%/);
  });

  it("the number never reaches a parent surface: ProView's packet lines, FamilyGoals and TonightFlow do not read goalForPacket or intake-goals", () => {
    const pro = readFileSync(path.join(here, "../components/journal/ProView.tsx"), "utf8");
    expect(pro).not.toMatch(/intake-goals/);
    for (const rel of ["../components/journal/ProView.tsx", "../components/program/FamilyGoals.tsx", "../components/loop/TonightFlow.tsx"]) {
      expect(readFileSync(path.join(here, rel), "utf8")).not.toMatch(/goalForPacket|goals\.packet\./);
    }
  });
});
