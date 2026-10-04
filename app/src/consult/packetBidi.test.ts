/**
 * W2-CAREPRO critic round 1 (school-brief P1, product + design) — a Hebrew
 * parent gets the same job. The HE teacher draft read "מדבר/ת Hebrew (Native)
 * וEnglish (Transition)": proficiency labels in English, the "and" prefix glued
 * to a Latin word, a slash for gender. Now: language name AND proficiency are
 * keyed, a Latin list part is its own bidi isolate with a maqaf after ו, and
 * the verb follows the profile's gender (neutral wording when unknown).
 */
import { describe, expect, it } from "vitest";
import { buildConsultPacket, buildPacketInput, itemText } from "./packet";
import type { ChildProfile } from "../types";

const FSI = "⁨";

function basics(lang: "en" | "he", languages: string[], gender?: string): string {
  const profile = { id: "c1", name: "Dylan", age: 4, languages, schoolContext: "", strengths: [], challenges: [], interests: [], gender } as unknown as ChildProfile;
  const packet = buildConsultPacket(buildPacketInput({ profile, logs: [], milestones: [], plans: [], memory: [] }, Date.now()));
  const item = packet.sections.find((s) => s.id === "about")!.items.find((i) => i.id === "about-basics")!;
  return itemText(item, lang);
}

describe("HE basics line: keyed proficiency, isolated Latin parts, no slash gender", () => {
  it("negative control: the pre-change HE line shape is caught", () => {
    const pre = "Dylan, 4, מדבר/ת Hebrew (Native) וEnglish (Transition).";
    expect(/\/ת|ו[A-Za-z]|\((Native|Transition)\)/.test(pre)).toBe(true);
  });

  it("proficiency labels are keyed in HE", () => {
    const he = basics("he", ["Hebrew (Native)", "English (Transition)"], "boy");
    expect(he).toContain("עברית (שפת אם)");
    expect(he).toContain("אנגלית (בשלב מעבר)");
    expect(he).not.toMatch(/Native|Transition/);
  });

  it("a Latin language name after ו takes a maqaf and its own isolate", () => {
    const he = basics("he", ["Hebrew", "Tagalog"], "girl");
    expect(he).toContain(`ו־${FSI}Tagalog`);
    expect(he).not.toMatch(/ו[A-Za-z]/);
  });

  it("the verb follows the profile's gender; never a slash", () => {
    expect(basics("he", ["Hebrew"], "boy")).toContain("מדבר ");
    expect(basics("he", ["Hebrew"], "girl")).toContain("מדברת ");
    const neutral = basics("he", ["Hebrew"]);
    expect(neutral).not.toMatch(/\/ת/);
    expect(neutral).toContain("שפות:");
  });

  it("English stays byte-identical", () => {
    expect(basics("en", ["Hebrew (Native)", "English (Transition)"], "boy")).toMatch(/speaks Hebrew \(Native\) and English \(Transition\)\.$/);
  });
});
