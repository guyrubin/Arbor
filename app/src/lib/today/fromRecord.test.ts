import { describe, expect, it } from "vitest";
import {
  answeredToday,
  factHasTimeWord,
  fromRecordEntry,
  fromRecordRowId,
  genderedEn,
  selectFromRecord,
  type FromRecordInput,
} from "./fromRecord";
import type { ActionPlan, BehaviorLog } from "../../types";
import type { ActionLoopEntry } from "../../actionLoop/model";
import { en, he } from "../i18n";

const NOW = new Date("2026-10-06T08:00:00");
const NOTE = "Calmed and put shoes on within 8 mins instead of usual 25. No screaming, just mild protest.";

const log = (over: Partial<BehaviorLog> = {}): BehaviorLog => ({
  id: "log-0709",
  timestamp: "2026-07-09T08:10:00.000Z",
  behaviorType: "Transition",
  intensity: 2,
  durationMinutes: 8,
  trigger: "Leaving for kindergarten",
  notes: NOTE,
  ...over,
});
const plan = (over: Partial<ActionPlan> = {}): ActionPlan => ({
  id: "plan-1751900000000",
  title: "Morning Departure Support Plan",
  issue: "mornings",
  phases: [{ name: "Observe", description: "", steps: [{ text: "Observe and log specific triggers for 3 days", completed: false }, { text: "Picture schedule by the door", completed: false }] }],
  scripts: [],
  successIndicators: [],
  ...over,
});
const facts = [
  { id: "m1", fact: "Dylan started a bilingual kindergarten.", createdAt: "2026-08-24T10:00:00.000Z", status: "approved" },
  { id: "m2", fact: "Dylan loves dinosaurs.", createdAt: "2026-08-25T10:00:00.000Z", status: "approved" },
];
const base = (over: Partial<FromRecordInput> = {}): FromRecordInput => ({ now: NOW, plans: [], loop: [], logs: [], facts: [], ...over });

/** The firewall vocabulary an opener may never carry. */
const VERDICT = /%|\b\d+\s*(of|\/)\s*\d+\b|\b(score|trend|improv\w*|declin\w*|better|worse|behind|delay\w*|risk|on track)\b/i;

describe("B-TODAY-28 — selectFromRecord priorities", () => {
  it("(1) a 9 Jul note + an active plan → the PLAN opener, quoting the note verbatim with its date", () => {
    const o = selectFromRecord(base({ plans: [plan()], logs: [log()], facts }));
    expect(o?.kind).toBe("plan");
    expect(o?.topic).toBe("Morning Departure Support Plan");
    expect(o?.quote).toBe(NOTE);
    expect(o?.quoteSource).toBe("parent");
    expect(o?.quoteAt).toBe("2026-07-09T08:10:00.000Z");
  });

  it("(1) a rated plan step is the quote (the step the parent tried)", () => {
    const rated: ActionLoopEntry = {
      id: "today.c1.2026-09-30", recommendation: "Picture schedule by the door", source: "plan", capacity: "standard",
      status: "completed", acceptedAt: "2026-09-30T07:00:00.000Z", outcome: "somewhat", outcomeAt: "2026-09-30T19:00:00.000Z",
      planId: "plan-1751900000000", phaseIdx: 0, stepIdx: 1,
    };
    const o = selectFromRecord(base({ plans: [plan()], logs: [log()], loop: [rated] }));
    expect(o).toMatchObject({ kind: "plan", quote: "Picture schedule by the door", quoteSource: "step" });
  });

  it("(2) no active plan → the parent's last note older than 14 days", () => {
    const done = plan({ phases: [{ name: "x", description: "", steps: [{ text: "a", completed: true }] }] });
    const o = selectFromRecord(base({ plans: [done], logs: [log()] }));
    expect(o).toMatchObject({ kind: "note", quote: NOTE, key: "note:log-0709" });
  });

  it("(2) a note from this week is fresh — no note opener", () => {
    const o = selectFromRecord(base({ logs: [log({ timestamp: "2026-10-03T08:00:00.000Z" })] }));
    expect(o).toBeNull();
  });

  it("(3) a remembered fact with a time word → 'Is that still so?' (EN + HE time words)", () => {
    const o = selectFromRecord(base({ facts }));
    expect(o).toMatchObject({ kind: "fact", quote: "Dylan started a bilingual kindergarten.", key: "fact:m1" });
    expect(factHasTimeWord("דילן התחיל גן דו-לשוני")).toBe(true);
    expect(factHasTimeWord("Dylan loves dinosaurs.")).toBe(false);
  });

  it("a Moment's words live in `trigger` (the capture sheet) — quoted through the shared parentWords reader", () => {
    const moment = log({ behaviorType: "Moment", trigger: NOTE, notes: undefined });
    expect(selectFromRecord(base({ logs: [moment] }))).toMatchObject({ kind: "note", quote: NOTE });
  });

  it("(4) a record with nothing → null (Today keeps its day-0 starter)", () => {
    expect(selectFromRecord(base())).toBeNull();
    expect(selectFromRecord(base({ facts: [facts[1]] }))).toBeNull();
  });

  it("pending (unapproved) facts are never quoted", () => {
    expect(selectFromRecord(base({ facts: [{ ...facts[0], status: "pending" }] }))).toBeNull();
  });

  it("an opener answered in the last 7 days stays quiet; the next priority speaks", () => {
    const o1 = selectFromRecord(base({ plans: [plan()], logs: [log()], facts }))!;
    const row = fromRecordEntry(o1, "easier", "c1", new Date("2026-10-04T08:00:00"));
    const o2 = selectFromRecord(base({ plans: [plan()], logs: [log()], facts, loop: [row] }));
    expect(o2?.kind).toBe("note");
  });

  it("the opener text never carries a count, %, or trend word", () => {
    for (const input of [base({ plans: [plan()], logs: [log()] }), base({ facts }), base({ logs: [log()] })]) {
      const o = selectFromRecord(input)!;
      const said = [o.topic, o.quote].filter(Boolean).join(" ");
      // the parent's own digits ("8 mins instead of usual 25") are quoted verbatim;
      // the opener adds none of its own
      expect(said.replace(NOTE, "")).not.toMatch(VERDICT);
    }
  });
});

describe("B-TODAY-28 — the answer write (existing actionLoops ledger, one row a day)", () => {
  it("writes ONE from-record row: completed, the reflection enum, no outcome", () => {
    const o = selectFromRecord(base({ plans: [plan()], logs: [log()] }))!;
    const row = fromRecordEntry(o, "hard_again", "c1", NOW);
    expect(row).toMatchObject({ id: fromRecordRowId("c1", NOW), source: "from-record", status: "completed", reflection: "hard_again", recordKey: o.key });
    expect(row.outcome).toBeUndefined();
    expect(row.id.startsWith("today.")).toBe(false); // never Today's accepted-step slot
    expect(answeredToday([row], "c1", NOW)).toEqual(row);
    expect(answeredToday([row], "c1", new Date("2026-10-07T08:00:00"))).toBeNull();
  });
});

describe("B-TODAY-28 — pronouns", () => {
  const prompts = Object.entries(en).filter(([k]) => k.startsWith("today.record.") || k.startsWith("today.identity") || k.startsWith("today.when."));
  it("no 'they ' in Today strings when gender is boy/girl (record strings + the prompt bank)", () => {
    const bank = [
      "What did they wonder about out loud today?",
      "What are they curious about this week?",
      "What from today showed the person they're growing into?",
      "What did they figure out on their own today?",
      "What took them by surprise today?",
    ];
    for (const g of ["boy", "girl"] as const) {
      for (const [, s] of prompts) expect(genderedEn(s, g)).not.toMatch(/\bthey\b|\btheir\b|\bthem\b/i);
      for (const s of bank) expect(genderedEn(s, g)).not.toMatch(/\bthey\b|\btheir\b|\bthem\b/i);
    }
    expect(genderedEn(bank[0], "boy")).toBe("What did he wonder about out loud today?");
    expect(genderedEn(bank[1], "girl")).toBe("What is she curious about this week?");
    expect(genderedEn(bank[2], "boy")).toBe("What from today showed the person he's growing into?");
    expect(genderedEn(bank[3], "girl")).toBe("What did she figure out on her own today?");
    expect(genderedEn(bank[0], "unspecified")).toBe(bank[0]);
    expect(genderedEn(bank[0], "other")).toBe(bank[0]);
  });

  it("every record key ships in BOTH languages", () => {
    const keys = Object.keys(en).filter((k) => k.startsWith("today.record.") || k.startsWith("today.identity") || k.startsWith("today.when."));
    expect(keys.length).toBeGreaterThanOrEqual(19);
    for (const k of keys) expect((he as Record<string, string>)[k], k).toBeTruthy();
  });
});
