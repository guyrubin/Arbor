/**
 * B-NEXT-01 — hearing first. The question, its kept answer and the packet line
 * (dark behind the pilot flag until the clinical wording review, GA B-GA-02).
 *
 *  1. The flag is off unless the device says "1"; a blocked store reads off.
 *  2. The answer is one bounded choice kept with its day; a malformed record
 *     reads as unanswered.
 *  3. The speech therapist's packet prints it FIRST, as the parent's own dated
 *     answer (EN + HE); no other profession gets it; without the flag the
 *     callers pass nothing, so nothing prints.
 *  4. The model never sees it (promptProfile's allow-list).
 *  5. Wording: no verdict, no risk word; "Not sure" points to a nurse or the
 *     paediatrician.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  HEARING_CHECK_ANSWERS,
  HEARING_QUESTION_FLAG_KEY,
  hearingAnswerKey,
  hearingCheckOf,
  hearingCheckPatch,
  hearingQuestionOn,
} from "./hearingCheck";
import { translate } from "./i18n";
import { buildIntakePacket, serializeForExport, type IntakePacketInput } from "../consult/packet";
import { MODEL_PROFILE_FIELDS, promptProfile } from "../ai/prompts";
import { ACCOUNT_DEVICE_KEYS } from "./childDataSinks";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..");
const strip = (code: string) => code.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const read = (rel: string) => strip(readFileSync(path.join(SRC, rel), "utf8"));

const store = (value: string | null) => ({ getItem: (k: string) => (k === HEARING_QUESTION_FLAG_KEY ? value : null) });
const NOW = Date.parse("2026-10-28T12:00:00Z");
const base = (over: Partial<IntakePacketInput> = {}): IntakePacketInput => ({
  child: { id: "c1", name: "Noa Example", age: 3, gender: "girl" },
  milestones: [],
  behaviorLogs: [],
  actionLoops: [],
  nowMs: NOW,
  ...over,
});

describe("B-NEXT-01 · the pilot flag", () => {
  it("is off by default, on only for \"1\", off when the store throws", () => {
    expect(hearingQuestionOn(store(null))).toBe(false);
    expect(hearingQuestionOn(store("0"))).toBe(false);
    expect(hearingQuestionOn(store("true"))).toBe(false);
    expect(hearingQuestionOn(store("1"))).toBe(true);
    expect(hearingQuestionOn({ getItem: () => { throw new Error("blocked"); } })).toBe(false);
    expect(hearingQuestionOn(null)).toBe(false);
  });

  it("is a registered device key (the whole-tree sink register)", () => {
    expect(ACCOUNT_DEVICE_KEYS[HEARING_QUESTION_FLAG_KEY]).toMatch(/feature flag/);
  });
});

describe("B-NEXT-01 · the kept answer is a dated fact", () => {
  it("one bounded choice with the day it was given", () => {
    const at = new Date("2026-10-28T09:30:00Z");
    expect(hearingCheckPatch("year", at)).toEqual({ hearingCheck: { answer: "year", answeredAt: "2026-10-28T09:30:00.000Z" } });
    expect(hearingCheckOf({ hearingCheck: { answer: "recent", answeredAt: "2026-10-28T09:30:00.000Z" } })).toEqual({ answer: "recent", answeredAt: "2026-10-28T09:30:00.000Z" });
  });

  it("a malformed or foreign record reads as unanswered", () => {
    for (const bad of [undefined, null, {}, { hearingCheck: { answer: "deaf", answeredAt: "2026-10-28" } }, { hearingCheck: { answer: "recent" } }, { hearingCheck: { answer: "recent", answeredAt: "not a date" } }]) {
      expect(hearingCheckOf(bad)).toBeNull();
    }
  });
});

describe("B-NEXT-01 · the speech therapist's packet asks hearing first", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: the answer leads the packet as the parent's dated words`, () => {
      const packet = buildIntakePacket("slp", base({ lang, hearing: { answer: "older", answeredAt: "2026-10-20T08:00:00.000Z" } }));
      expect(packet.sections[0].id).toBe("intake-hearing");
      expect(packet.sections[0].titleKey).toBe("elev.hearing.packet.title");
      const line = packet.sections[0].items[0].text;
      expect(line).toContain(translate(lang, "elev.hearing.answer.older"));
      expect(line).toMatch(lang === "en" ? /20 Oct 2026/ : /2026/);
      expect(serializeForExport("self", packet)).toContain(translate(lang, "elev.hearing.answer.older").replace(/[\u2068\u2069]/g, ""));
    });

    it(`${lang}: "not sure" is said plainly, with its day`, () => {
      const packet = buildIntakePacket("slp", base({ lang, hearing: { answer: "notSure", answeredAt: "2026-10-20T08:00:00.000Z" } }));
      const plain = (text: string) => text.replace(/[\u2068\u2069]/g, "");
      const day = lang === "en" ? "20 Oct 2026" : plain(packet.sections[0].items[0].text).match(/\(([^)]*)\)/)![1];
      expect(plain(packet.sections[0].items[0].text)).toBe(plain(translate(lang, "elev.hearing.packet.notSure", { date: day })));
    });
  }

  it("only the speech therapist's packet carries it; without an answer (or the flag) nothing prints", () => {
    const hearing = { answer: "recent" as const, answeredAt: "2026-10-20T08:00:00.000Z" };
    for (const p of ["ot", "pt", "psychology", "pediatrician"] as const) {
      expect(buildIntakePacket(p, base({ hearing })).sections.map((s) => s.id)).not.toContain("intake-hearing");
    }
    expect(buildIntakePacket("slp", base({ hearing: null })).sections.map((s) => s.id)).not.toContain("intake-hearing");
    expect(buildIntakePacket("slp", base()).sections.map((s) => s.id)).not.toContain("intake-hearing");
  });

  it("both packet callers pass the answer only while the pilot flag is on", () => {
    expect(read("components/journal/JournalShelves.tsx")).toContain("hearing: hearingOn ? hearingCheckOf(childProfile) : null,");
    expect(read("components/sections/AskSpecialist.tsx")).toContain("hearing: hearingQuestionOn() ? hearingCheckOf(childProfile) : null,");
  });
});

describe("B-NEXT-01 · the answer stays out of every prompt", () => {
  it("the model profile allow-list does not carry it", () => {
    expect(MODEL_PROFILE_FIELDS as readonly string[]).not.toContain("hearingCheck");
    const projected = promptProfile({ name: "Noa", age: 3, hearingCheck: { answer: "notSure", answeredAt: "2026-10-20T08:00:00.000Z" } }, undefined, { parentWishes: true });
    expect(JSON.stringify(projected)).not.toMatch(/hearing/i);
  });
});

describe("B-NEXT-01 · the words: a question and a route, never a verdict", () => {
  const VERDICT = /\b(loss|impair|deaf|delay|risk|concern|abnormal|fail|normal|behind)\b/i;
  const VERDICT_HE = /חירש|ליקוי|עיכוב|סיכון|תקין|לא תקין|פיגור/;
  it.each(["en", "he"] as const)("%s: every string exists, Hebrew is its own, no verdict word", (lang) => {
    const keys = ["elev.hearing.question", "elev.hearing.why", "elev.hearing.notSure", "elev.hearing.kept", "elev.hearing.change", "elev.hearing.saveError", "elev.hearing.packet.title", "elev.hearing.packet.line", "elev.hearing.packet.notSure", ...HEARING_CHECK_ANSWERS.map(hearingAnswerKey)];
    for (const k of keys) {
      const text = translate(lang, k);
      expect(text, k).not.toBe(k);
      expect(text, k).not.toMatch(lang === "en" ? VERDICT : VERDICT_HE);
      if (lang === "he") { expect(text, k).not.toBe(translate("en", k)); expect(text, k).toMatch(/[֐-׿]/); }
    }
    expect(translate(lang, "elev.hearing.notSure")).toMatch(lang === "en" ? /nurse[\s\S]*paediatrician/ : /אחות[\s\S]*רופא הילדים/);
  });
});
