import { describe, expect, it, vi } from "vitest";
import { CHILD_SUBCOLLECTIONS } from "../lib/childData";
import { programById } from "../content/programs";
import { activeProgramWeek } from "../lib/programs/enrolment";
import { programWeekMeasures } from "../lib/programs/measures";
import { toObservations } from "../lib/observations";
import { weekLongestStretch, nightsInWeek, programWeekRange } from "../lib/sleepDiary";
import { DEMO_CHILD_ID } from "./demoFamily";
import { defaultChildProfile } from "../initialData";
import { buildDemoProgramState, buildDemoProgramStates, DEMO_PROGRAM_STATES } from "./demoPrograms";
import * as seedScript from "../../scripts/seed-demo-family.mjs";

/* B-PROG-12 — the program seed states: Talk Together week 1 and week 5 (with
   the family's own baseline and counts), Steady Nights (routine taps + diary),
   the guided tier's booked session. Opt-in states only (the base demo family
   carries no enrolment); every collection is export/erase-covered; the dry run
   lists every enrolment row and writes nothing. */

const NOW = Date.parse("2026-10-28T12:00:00.000Z");

describe("B-PROG-12 · the program seed states", () => {
  it("four states, each built by the engine's own writers, every collection in CHILD_SUBCOLLECTIONS", () => {
    const states = buildDemoProgramStates({ now: NOW });
    expect(states.map((s) => s.name)).toEqual([...DEMO_PROGRAM_STATES]);
    for (const s of states) {
      for (const name of Object.keys(s.collections)) expect(CHILD_SUBCOLLECTIONS, `${s.name}: ${name}`).toContain(name);
      const active = activeProgramWeek(s.collections.programs, new Date(NOW))!;
      expect(active.program.id, s.name).toBe(s.programId);
      expect(active.week, s.name).toBe(s.week);
      for (const row of s.collections.actionLoops) {
        expect(row.id.startsWith(`practice.${DEMO_CHILD_ID}.`), row.id).toBe(true);
        expect(row.programId).toBe(s.programId);
        expect(programById(s.programId)!.weeks.flatMap((w) => w.practices)).toContain(row.practiceId);
        if (s.programId === "talk-together") expect(row.selfCount).toBeGreaterThanOrEqual(0);
        if (typeof row.selfCount === "number") expect(row.selfCount).toBeLessThanOrEqual(5);
      }
    }
  });

  it("prog-week5: week 5 is counted against the family's own week 1 (dose, turns, new words) with the baseline captured", () => {
    const s = buildDemoProgramState("prog-week5", { now: NOW });
    const e = s.collections.programs[0];
    expect(e.baseline.childProxy).toBe(1);
    const inputs = { childId: DEMO_CHILD_ID, actionLoops: s.collections.actionLoops, observations: toObservations({ langObs: s.collections.langObs } as never, defaultChildProfile) };
    const w1 = programWeekMeasures(e, 1, inputs)!;
    const w5 = programWeekMeasures(e, 5, inputs)!;
    expect(w1.dose).toBe(3);
    expect(w1.parentProxy).toMatchObject({ id: "turns-waited", value: 4, from: 3 });
    expect(w5.dose).toBe(2);
    expect(w5.parentProxy).toMatchObject({ value: 9, from: 2 });
    expect(w5.childProxy?.value).toBeGreaterThan(e.baseline.childProxy!);
  });

  it("prog-steady-nights: routine taps and diary nights make both Steady Nights counts", () => {
    const s = buildDemoProgramState("prog-steady-nights", { now: NOW });
    const e = s.collections.programs[0];
    const nights = s.collections.sleepLogs!;
    for (const n of nights) expect(n.id).toBe(n.date);
    expect(weekLongestStretch(nightsInWeek(nights, programWeekRange(e.startedAt, 1)))?.nights).toBeGreaterThanOrEqual(3);
    const w2 = programWeekMeasures(e, 2, { childId: DEMO_CHILD_ID, actionLoops: s.collections.actionLoops, sleepLogs: nights })!;
    expect(w2.parentProxy?.id).toBe("routine-in-order");
    expect(w2.parentProxy!.value).toBeGreaterThan(0);
    expect(w2.childProxy?.id).toBe("longest-stretch");
  });

  it("prog-coach: the guided tier's first session is booked and the device flag rides with the state", () => {
    const s = buildDemoProgramState("prog-coach", { now: NOW });
    expect(s.collections.coachSessions).toHaveLength(1);
    expect(s.collections.coachSessions![0]).toMatchObject({ slot: "kickoff", programId: "talk-together", enrolmentId: s.collections.programs[0].id });
    expect(s.flags).toEqual({ "arbor.flags.guidedTier": "1" });
  });

  it("deterministic for a given now; Hebrew states carry the Hebrew say line", () => {
    expect(JSON.stringify(buildDemoProgramStates({ now: NOW }))).toBe(JSON.stringify(buildDemoProgramStates({ now: NOW })));
    const he = buildDemoProgramState("prog-week1", { now: NOW, lang: "he" });
    expect(he.collections.actionLoops[0].recommendation).toMatch(/[֐-׿]/);
    expect(he.collections.langObs![0].language).toBe("Hebrew");
  });

  it("the seed's dry run lists every state's enrolment row and writes nothing", async () => {
    const log = vi.fn();
    const sandbox = vi.fn();
    const dry = await seedScript.runDemoSeed(seedScript.parseArgs(["--now", new Date(NOW).toISOString()]), { log, apply: { sandbox, firestore: vi.fn() } });
    expect(dry.wrote).toEqual([]);
    expect(sandbox).not.toHaveBeenCalled();
    const out = String(log.mock.calls[0][0]);
    expect(out).toContain("program states (sweep cells only; never written by --apply):");
    for (const name of DEMO_PROGRAM_STATES) expect(out).toMatch(new RegExp(`\\n    ${name}\\s+(talk-together|steady-nights) · started \\d{4}-\\d{2}-\\d{2} · week \\d of \\d`));
    expect(out).toMatch(/prog-week5\s+talk-together · started 2026-09-28 · week 5 of 8 · baseline 1/);
    // the base family carries NO enrolment
    expect(Object.keys(dry.family.collections)).not.toContain("programs");
    expect(() => seedScript.planProgramStates([{ name: "x", collections: { notAChildCollection: [] } }])).toThrow(/not in CHILD_SUBCOLLECTIONS/);
  });
});
