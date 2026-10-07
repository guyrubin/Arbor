import { describe, expect, it } from "vitest";
import { buildIntakePacket, type IntakePacketInput } from "./packet";
import { programPageModel } from "../lib/programPage";
import type { ActionLoopEntry } from "../actionLoop/model";

/* B-PROG-05 (packet) — the intake packet carries ONE program line while an
   enrolment is ACTIVE and the program's shelf belongs to the profession:
   "{Program}: week {n} of {N} · practice days {d}/7 this week · …" with the
   parent and child proxies as COUNTS. Numerator-only: no %, no ratio words,
   "{d}/7" is the only slash shape. Not enrolled (or paused) → no line. EN + HE. */

const NOW = Date.parse("2026-10-06T12:00:00");
const START = "2026-09-03"; // week 5 = 2026-10-01 … 2026-10-07
const enrolment = (status: "active" | "paused" | "done" = "active") => ({
  id: `talk-together.${START}`,
  programId: "talk-together",
  startedAt: START,
  enrolledAt: `${START}T08:00:00.000Z`,
  currentWeek: 5,
  status,
  ...(status === "paused" ? { pausedAt: "2026-10-05" } : {}),
  baseline: { childProxy: null, capturedAt: null },
  updatedAt: `${START}T08:00:00.000Z`,
});
const dose = (day: string, selfCount?: number): ActionLoopEntry =>
  ({ id: `practice.c1.${day}`, recommendation: "x", source: "practice", capacity: "tiny", status: "completed", acceptedAt: `${day}T08:00:00`, practiceId: `p-${day}`, shelf: "words", ...(selfCount !== undefined ? { selfCount } : {}) }) as ActionLoopEntry;
const loops = [dose("2026-09-04", 1), dose("2026-10-01", 2), dose("2026-10-02", 3), dose("2026-10-04"), dose("2026-10-05", 4)];
const model = (lang: "en" | "he", status: "active" | "paused" | "done" = "active") =>
  programPageModel([enrolment(status)], { childId: "c1", actionLoops: loops }, new Date(NOW), lang, "boy");

const input = (over: Partial<IntakePacketInput> = {}): IntakePacketInput => ({
  child: { id: "c1", name: "Dylan Demo", age: 3, gender: "boy" },
  milestones: [],
  behaviorLogs: [],
  actionLoops: loops,
  nowMs: NOW,
  ...over,
});
const programLine = (p: ReturnType<typeof buildIntakePacket>) => p.sections.find((s) => s.id === "intake-program");
const RATIO_WORDS = /%|percent|\brate\b|ratio|out of|average|score|\bof the time\b|אחוז|ממוצע|ציון|יחס/i;

describe("B-PROG-05 packet — the program line", () => {
  it("enrolled + the profession owns the program's shelf (SLP, Words) → one line with week, practice days d/7 and the proxies as counts", () => {
    const m = model("en")!;
    expect(m.status).toBe("active");
    const s = programLine(buildIntakePacket("slp", input({ program: m })));
    expect(s).toBeDefined();
    expect(s!.titleKey).toBe("elev.program.pro.line");
    expect(s!.items).toHaveLength(1);
    const text = s!.items[0].text;
    expect(text.startsWith(`Talk Together: week 5 of ${m.weeks} · practice days 4/7 this week`)).toBe(true);
    // the parent proxy as a count, from its practice days, beside the family's own first week
    expect(text).toContain("9 (from 3 practice days; first week 1)");
  });

  it("numerator-only: no %, no ratio words, and d/7 is the only slash shape", () => {
    for (const lang of ["en", "he"] as const) {
      const text = programLine(buildIntakePacket("slp", input({ program: model(lang), lang })))!.items[0].text;
      expect(text).not.toMatch(RATIO_WORDS);
      expect(text.match(/\d+\s*\/\s*\d+/g)).toEqual(["4/7"]);
    }
  });

  it("Hebrew: the line is in the packet's language", () => {
    const text = programLine(buildIntakePacket("slp", input({ program: model("he"), lang: "he" })))!.items[0].text;
    expect(text).toContain("מדברים ביחד: שבוע 5 מתוך");
    expect(text).toContain("ימי תרגול 4/7 השבוע");
  });

  it("a profession that does not own the shelf (OT, PT) gets no program line", () => {
    for (const p of ["ot", "pt"] as const) expect(programLine(buildIntakePacket(p, input({ program: model("en") })))).toBeUndefined();
  });

  it("not enrolled → no line; a paused enrolment → no line", () => {
    expect(programLine(buildIntakePacket("slp", input()))).toBeUndefined();
    expect(programLine(buildIntakePacket("slp", input({ program: null })))).toBeUndefined();
    expect(programPageModel([], { childId: "c1", actionLoops: loops }, new Date(NOW), "en")).toBeNull();
    const paused = model("en", "paused")!;
    expect(paused.status).toBe("paused");
    expect(programLine(buildIntakePacket("slp", input({ program: paused })))).toBeUndefined();
  });
});
