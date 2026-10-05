/**
 * B-CAREPRO-45 (NEXTLEVEL critic round 1, P0) — the packet prints what the
 * ADULTS did, dated. The incident's `response` was read in at the seam and
 * never printed; the B-ASKJB-33 "held the plan" answers never reached it.
 * Now a "What the adults did" section directly under "tried" carries dated
 * lines in the parent's words (clinician presets only; never the teacher).
 * Numerator-free: no "x of y", no share, no trend word, in EN and HE.
 */
import { describe, expect, it } from "vitest";
import { CONSULT_PRESETS, buildConsultPacket, itemText, serializePacket, type BuildPacketInput } from "./packet";

const NOW = new Date("2026-06-15T12:00:00Z").getTime();
const DAY = 86_400_000;
const iso = (d: number) => new Date(NOW - d * DAY).toISOString();

const base: BuildPacketInput = {
  profile: { name: "Dylan", age: 5, languages: ["English"] },
  logs: [
    { behaviorType: "Transition Refusal", intensity: 4, timestamp: iso(1), response: "Moved him to the sofa and stayed close" },
    { behaviorType: "Transition Refusal", intensity: 3, timestamp: iso(4), response: "Named the feeling, held the limit" },
    { behaviorType: "Moment", intensity: 1, timestamp: iso(2), response: "should never print" },
    { behaviorType: "Transition Refusal", intensity: 3, timestamp: iso(60), response: "outside the window" },
  ],
  milestones: [],
  plans: [],
  memory: [],
  nowMs: NOW,
  heldOutcomes: [
    { at: iso(1), held: "yes" },
    { at: iso(3), held: "no" },
    { at: iso(90), held: "yes" },
  ],
};

const tried = (input: BuildPacketInput) => buildConsultPacket(input).sections.find((s) => s.id === "adults");

describe("B-CAREPRO-45 — the adults' side of a hard moment, dated", () => {
  it("prints each in-window incident response in the parent's words, newest first, dated", () => {
    const s = tried(base)!;
    expect(s).toBeTruthy();
    const did = s.items.filter((i) => i.id.startsWith("did-"));
    expect(did.map((i) => i.vars?.quote)).toEqual(["Moved him to the sofa and stayed close", "Named the feeling, held the limit"]);
    expect(itemText(did[0], "en")).toMatch(/what we did: .Moved him to the sofa and stayed close./);
  });

  it("never prints a moment's response, or one outside the window", () => {
    const text = serializePacket(buildConsultPacket(base));
    expect(text).not.toContain("should never print");
    expect(text).not.toContain("outside the window");
  });

  it("prints dated 'held the plan' answers (yes / not this time) inside the window only", () => {
    const held = tried(base)!.items.filter((i) => i.id.startsWith("held-"));
    expect(held).toHaveLength(2);
    expect(itemText(held[0], "en")).toMatch(/held the plan: yes$/);
    expect(itemText(held[1], "en")).toMatch(/held the plan: not this time$/);
    expect(itemText(held[0], "he")).toMatch(/עמדנו בתוכנית: כן$/);
  });

  it("is numerator-free in both locales: no 'of', no %, no ratio", () => {
    for (const lang of ["en", "he"] as const) {
      for (const it of tried(base)!.items) {
        const line = itemText(it, lang);
        expect(line).not.toMatch(/\d+\s*(of|\/|מתוך)\s*\d+|%/);
      }
    }
  });

  it("the teacher preset never carries it; every clinician preset does", () => {
    expect(CONSULT_PRESETS.teacher.sections).not.toContain("adults");
    for (const a of ["therapist", "pediatrician", "slp", "behavioral_health"] as const) expect(CONSULT_PRESETS[a].sections).toContain("adults");
    const order = buildConsultPacket({ ...base, plans: [{ title: "Calm-down corner", issue: "transitions" }] as BuildPacketInput["plans"] }).sections.map((s) => s.id);
    expect(order.indexOf("adults")).toBe(order.indexOf("tried") + 1);
  });

  it("negative control: with no responses and no held answers there is no section", () => {
    expect(tried({ ...base, logs: base.logs.map((l) => ({ ...l, response: undefined })), heldOutcomes: [] })).toBeUndefined();
  });
});
