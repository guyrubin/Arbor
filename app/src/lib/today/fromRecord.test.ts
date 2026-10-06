import { describe, expect, it } from "vitest";
import {
  answersFor,
  fromRecordAnswerKey,
  fromRecordQuestionKey,
  noteMatchesPlan,
  recordTopic,
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
import { en, he, translate } from "../i18n";

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

describe("NEXTLEVEL critic r1 — the plan opener quotes only words on its own topic", () => {
  const bath = log({ id: "log-bath", timestamp: "2026-10-04T19:00:00.000Z", behaviorType: "Moment", trigger: "Sang the whole bath song on his own", notes: "" });
  it("a newer bath-song win does NOT become the morning plan's quote; the topic is named", () => {
    const o = selectFromRecord(base({ plans: [plan()], logs: [log(), bath] }));
    expect(o?.kind).toBe("plan");
    expect(o?.quote).toBe(NOTE); // the 9 Jul mornings note, not the newer bath win
    expect(o?.topicKey).toBe("mornings");
    expect(fromRecordQuestionKey(o!)).toBe("today.record.q.topic.mornings");
  });
  it("with only an off-topic note the plan opener carries the topic alone (no quote)", () => {
    const o = selectFromRecord(base({ plans: [plan()], logs: [bath] }));
    expect(o).toMatchObject({ kind: "plan", quote: null, quoteSource: null, topicKey: "mornings" });
  });
  it("a stale plain-moment note opens as a JOY: 'again since?', never 'Hard again'", () => {
    const old = { ...bath, timestamp: "2026-09-01T19:00:00.000Z" };
    const o = selectFromRecord(base({ logs: [old] }));
    expect(o).toMatchObject({ kind: "note", tone: "joy" });
    expect(fromRecordQuestionKey(o!)).toBe("today.record.q.win");
    expect(fromRecordAnswerKey(o!, "hard_again")).toBe("today.record.a.joy.hard_again");
  });
  it("topics resolve in EN and HE; matching is by topic or a shared content word", () => {
    expect(recordTopic("Preschool Transition & Morning Arrival Plan")).toBe("mornings");
    expect(recordTopic("בוקר בגן")).toBe("mornings");
    expect(recordTopic("שעת השינה")).toBe("bedtime");
    expect(noteMatchesPlan("Leaving for kindergarten took ages", plan())).toBe(true);
    expect(noteMatchesPlan("Sang the whole bath song on his own", plan())).toBe(false);
  });
  it("every topic and joy key ships in both languages", () => {
    for (const k of ["mornings", "bedtime", "bath", "meals", "screens", "siblings", "feelings", "transitions"]) {
      for (const d of [en, he] as Record<string, string>[]) {
        expect(d[`today.record.topic.${k}`], k).toBeTruthy();
        expect(d[`today.record.q.topic.${k}`], k).toContain("{name}");
      }
    }
    for (const a of ["easier", "hard_again", "other"]) expect((he as Record<string, string>)[`today.record.a.joy.${a}`]).toBeTruthy();
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

/* B-GROWTH-36 — priority 0: a quote kept YESTERDAY with a say-back leads,
   asking about the PARENT's act ("Did you get to say it back in Hebrew?
   Yes / Not today"); nothing counts the child. */
describe("B-GROWTH-36 — the say-back opener (priority 0)", () => {
  const GUY = ["Hebrew (Native)", "English (Transition)"];
  const quote = (over: Partial<{ id: string; note: string; noticedOn: string; language: string }> = {}) => ({
    id: "quote-2026-10-05-aa",
    note: "Daddy, the moon is following our car",
    noticedOn: "2026-10-05",
    language: "English",
    ...over,
  });
  const base = (quotes: ReturnType<typeof quote>[], over: Partial<FromRecordInput> = {}): FromRecordInput => ({
    now: NOW,
    plans: [plan()],
    loop: [],
    logs: [log()],
    facts: [],
    said: { quotes, languages: GUY, months: 64 },
    ...over,
  });

  it("the day after a cross-language quote, the opener is the say-back — ahead of an active plan", () => {
    const o = selectFromRecord(base([quote()]))!;
    expect(o.kind).toBe("said");
    expect(o.key).toBe("said:quote-2026-10-05-aa");
    expect(o.quote).toBe("Daddy, the moon is following our car");
    expect(o.quoteSource).toBe("child");
    expect(o.sayBackMode).toBe("cross");
    expect(o.sayBackIn).toBe("Hebrew");
    expect(fromRecordQuestionKey(o)).toBe("elev.words.today.q.cross");
    expect(answersFor(o)).toEqual(["yes", "not_today"]);
    expect(fromRecordAnswerKey(o, "not_today")).toBe("elev.words.today.a.not_today");
    expect(translate("en", "elev.words.today.q.cross", { kept: "Hebrew" })).toBe("Did you get to say it back in Hebrew?");
    expect(translate("he", "elev.words.today.q.cross", { kept: "עברית" })).toBe("הספקתם להגיד את זה בחזרה בעברית?");
  });

  it("not on the same day, not two days later, not for a kept-language quote (no say-back)", () => {
    expect(selectFromRecord(base([quote({ noticedOn: "2026-10-06" })]))?.kind).toBe("plan");
    expect(selectFromRecord(base([quote({ noticedOn: "2026-10-04" })]))?.kind).toBe("plan");
    expect(selectFromRecord(base([quote({ note: "אבא, הירח נוסע איתנו", language: "Hebrew" })]))?.kind).toBe("plan");
  });

  it("a monolingual family gets 'say it back and add one'", () => {
    const o = selectFromRecord(base([quote()], { said: { quotes: [quote()], languages: ["English"], months: 64 } }))!;
    expect(o.sayBackMode).toBe("same");
    expect(o.sayBackIn).toBeNull();
    expect(fromRecordQuestionKey(o)).toBe("elev.words.today.q.same");
  });

  it("an answer writes one from-record row and the opener goes quiet; the plan speaks next", () => {
    const o = selectFromRecord(base([quote()]))!;
    const row = fromRecordEntry(o, "yes", "c1", NOW);
    expect(row.sayBack).toBe("yes");
    expect(row.reflection).toBeUndefined();
    expect(row.recordKey).toBe("said:quote-2026-10-05-aa");
    expect(selectFromRecord(base([quote()], { loop: [row] }))?.kind).toBe("plan");
  });

  it("without said input the selector is unchanged (no opener of kind said)", () => {
    const { said: _s, ...rest } = base([quote()]);
    expect(selectFromRecord(rest)?.kind).toBe("plan");
  });
});
