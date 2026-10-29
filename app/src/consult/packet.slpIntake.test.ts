/**
 * B-CAREPRO-39 — the speech-therapist packet's Intake section answers each
 * schema question from the record or "Not recorded yet", EN + HE, no
 * thresholds. Built DARK: the shipped schema is unsigned, so no surface shows
 * it until the clinical reviewer signs (GA B-GA-01, D3). Old code fails: no
 * schema existed and the SLP packet had no Intake section at all.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildIntakePacket, intakeLangObs, slpIntakePacketItems, type IntakePacketInput } from "./packet";
import { SLP_INTAKE_SCHEMA, slpIntakeSigned, type SlpIntakeSchema } from "../content/consultPresets";
import { ALL_MILESTONES } from "../lib/milestoneData";
import { translate } from "../lib/i18n";
import { loopFirewallHits } from "../lib/loop/firewall";
import type { Milestone } from "../types";

const NOW = new Date(2026, 9, 20, 12).getTime();
const SIGNED: SlpIntakeSchema = { ...SLP_INTAKE_SCHEMA, signedBy: "Reviewer (synthetic)", signedOn: "2026-10-28" };
const ms = (id: string, observationStatus: Milestone["observationStatus"], at?: string): Milestone => {
  const row = (ALL_MILESTONES as Milestone[]).find((m) => m.id === id)!;
  return { ...row, checked: observationStatus === "yes", observationStatus, ...(at ? { observationUpdatedAt: at } : {}) };
};
const input = (over: Partial<IntakePacketInput> = {}): IntakePacketInput => ({
  child: { id: "c1", name: "Noa Demo", age: 2, gender: "girl" },
  milestones: [ms("cdc-15m-3", "yes", "2026-03-02T10:00:00Z"), ms("cdc-24m-3", "not_yet", "2026-10-01T10:00:00Z"), ms("cdc-18m-5", "not_sure")],
  behaviorLogs: [], actionLoops: [], nowMs: NOW,
  langObs: [{ phrase: "more", language: "English" }, { phrase: "עוד", language: "Hebrew" }, { phrase: "מים", language: "Hebrew" }],
  hearing: { answer: "recent", answeredAt: "2026-10-10T10:00:00Z" },
  ...over,
});
const intake = (p: ReturnType<typeof buildIntakePacket>) => p.sections.find((s) => s.id === "intake-slp-schema");

describe("B-CAREPRO-39 · dark until signed", () => {
  it("the shipped schema is unsigned, so the SLP packet carries no Intake section", () => {
    expect(SLP_INTAKE_SCHEMA.signedBy).toBeNull();
    expect(slpIntakeSigned()).toBe(false);
    expect(intake(buildIntakePacket("slp", input()))).toBeUndefined();
  });
  it("a half signature (name without date, or a bad date) stays dark", () => {
    expect(slpIntakeSigned({ signedBy: "R", signedOn: null })).toBe(false);
    expect(slpIntakeSigned({ signedBy: " ", signedOn: "2026-10-28" })).toBe(false);
    expect(slpIntakeSigned({ signedBy: "R", signedOn: "soon" })).toBe(false);
    expect(intake(buildIntakePacket("slp", input({ slpIntakeSchema: { ...SIGNED, signedOn: null } })))).toBeUndefined();
  });
  it("signed, it is the speech therapist's only: no other profession's packet carries it", () => {
    for (const p of ["ot", "pt", "psychology", "pediatrician"] as const) expect(intake(buildIntakePacket(p, input({ slpIntakeSchema: SIGNED })))).toBeUndefined();
  });
});

describe("B-CAREPRO-39 · signed: each question answered from the record or 'Not recorded yet'", () => {
  it("EN: every schema question, in order, with its answer", () => {
    const s = intake(buildIntakePacket("slp", input({ slpIntakeSchema: SIGNED })))!;
    expect(s.title).toBe("Intake: what a speech therapist asks");
    expect(s.items.map((i) => i.id)).toEqual(SLP_INTAKE_SCHEMA.questions.map((q) => `intake-slp-${q.id}`));
    const line = (id: string) => s.items.find((i) => i.id === `intake-slp-${id}`)!.text;
    expect(line("firstWords")).toMatch(/^When did Noa first say words\? — .+: yes, noted 2 Mar 2026$/);
    expect(line("wordsNow")).toBe("Which words does Noa use now, in each language? — English: 1; Hebrew: 2 (words and phrases you logged)");
    expect(line("twoWords")).toMatch(/: not yet, as of 1 Oct 2026$/);
    expect(line("understands")).toMatch(/: not sure yet$/);
    expect(line("hearing")).toContain(translate("en", "elev.hearing.answer.recent"));
    for (const id of ["understood", "feeding", "family", "lostWords"]) expect(line(id)).toMatch(/ — Not recorded yet$/);
  });

  it("an empty record answers every question 'Not recorded yet' (never a guess)", () => {
    const items = slpIntakePacketItems(SIGNED, input({ milestones: [], langObs: [], hearing: null }));
    expect(items).toHaveLength(SLP_INTAKE_SCHEMA.questions.length);
    for (const it of items) expect(it.text.endsWith("— Not recorded yet")).toBe(true);
  });

  it("HE: the same section in Hebrew", () => {
    const s = intake(buildIntakePacket("slp", input({ slpIntakeSchema: SIGNED, lang: "he" })))!;
    const all = s.items.map((i) => i.text).join("\n");
    expect(all).toContain(translate("he", "elev.words.consult.slp.q.wordsNow", { name: "Noa" }));
    expect(all).toContain(translate("he", "elev.words.consult.slp.a.notRecorded"));
    expect(all).not.toMatch(/Not recorded yet|noted|as of/);
  });
});

describe("B-CAREPRO-39 · the schema guard: no thresholds, no scoring", () => {
  it("every milestone a question reads is a catalogue row", () => {
    const ids = new Set((ALL_MILESTONES as { id: string }[]).map((m) => m.id));
    for (const q of SLP_INTAKE_SCHEMA.questions) if (q.source.kind === "milestones") for (const id of q.source.ids) expect(ids.has(id), id).toBe(true);
  });
  it("no question names an age, a number, a norm or a cut-off (EN + HE)", () => {
    for (const lang of ["en", "he"] as const) {
      for (const q of SLP_INTAKE_SCHEMA.questions) {
        const text = translate(lang, q.key, { name: "Noa" });
        expect(text, q.key).not.toMatch(/\d|%|should|by age|normal|typical|delay|behind|score|months|years|נורמ|עיכוב|ציון|חודשים|שנים/i);
      }
    }
  });
  it("answers are words and counts, never a verdict", () => {
    for (const lang of ["en", "he"] as const) {
      const text = slpIntakePacketItems(SIGNED, input({ lang })).map((i) => i.text).join("\n");
      expect(loopFirewallHits(text)).toEqual([]);
      expect(text).not.toMatch(/%|\/\d/);
    }
  });
});

describe("B-CAREPRO-39 round 2 · both intake call sites pass the logged words", () => {
  it("intakeLangObs maps the langObs rows once (phrase, language, when); empty phrases drop", () => {
    expect(intakeLangObs([
      { phrase: " more ", language: "English", timestamp: "2026-10-01T10:00:00Z" },
      { phrase: "", language: "Hebrew", timestamp: "2026-10-02T10:00:00Z" },
      { phrase: "מים", language: "Hebrew" },
    ])).toEqual([{ phrase: "more", language: "English", at: "2026-10-01T10:00:00Z" }, { phrase: "מים", language: "Hebrew" }]);
  });
  it("Care's packet and Journal's pro view both hand them to buildIntakePacket (old Journal said 'Not recorded yet' for logged words once signed)", () => {
    const read = (rel: string) => readFileSync(path.resolve(__dirname, "..", rel), "utf8");
    for (const rel of ["components/sections/AskSpecialist.tsx", "components/journal/JournalShelves.tsx"]) {
      const src = read(rel);
      expect(src, rel).toMatch(/useChildCollection<LangObservation>\(childProfile\.id, "langObs"/);
      const call = src.slice(src.indexOf("buildIntakePacket(", src.indexOf("const intakePacket")));
      expect(call.slice(0, call.indexOf("}) : null)")), rel).toContain("langObs: intakeLangObs(langObsCol.items)");
    }
  });
  it("signed, the logged words answer 'which words now' through the shared mapping", () => {
    const items = slpIntakePacketItems(SIGNED, input({ langObs: intakeLangObs([{ phrase: "ball", language: "English" }, { phrase: "כדור", language: "Hebrew" }]) }));
    expect(items.find((i) => i.id === "intake-slp-wordsNow")!.text).toBe("Which words does Noa use now, in each language? — English: 1; Hebrew: 1 (words and phrases you logged)");
  });
});
