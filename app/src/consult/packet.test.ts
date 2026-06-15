import { describe, it, expect } from "vitest";
import { buildConsultPacket, serializePacket, countIncluded, type BuildPacketInput } from "./packet";

const NOW = new Date("2026-06-15T12:00:00").getTime();
const DAY = 86_400_000;

const base: BuildPacketInput = {
  profile: { name: "Dylan", age: 5, languages: ["Hebrew", "English"], schoolContext: "Bilingual kindergarten", strengths: ["curious"], challenges: ["transitions"] },
  logs: [
    { behaviorType: "Transition Refusal", intensity: 5, timestamp: new Date(NOW - 1 * DAY).toISOString() },
    { behaviorType: "Transition Refusal", intensity: 4, timestamp: new Date(NOW - 3 * DAY).toISOString() },
    { behaviorType: "Sibling Conflict", intensity: 3, timestamp: new Date(NOW - 2 * DAY).toISOString() },
  ],
  milestones: [
    { domain: "Language", title: "Two-word phrases", checked: true },
    { domain: "Motor", title: "Hops on one foot", checked: false },
  ],
  plans: [{ title: "Smoother mornings", issue: "leaving for school" }],
  memory: [
    { fact: "Calms fastest with a countdown.", status: "approved" },
    { fact: "Pending unreviewed note.", status: "pending" },
  ],
  nowMs: NOW,
};

describe("buildConsultPacket", () => {
  it("assembles the expected sections from the record", () => {
    const p = buildConsultPacket(base);
    expect(p.childLabel).toBe("Dylan");
    expect(p.sections.map((s) => s.id)).toEqual(["about", "patterns", "development", "tried", "memory"]);
  });

  it("ranks recent concerns by frequency and flags intensity", () => {
    const p = buildConsultPacket(base);
    const patterns = p.sections.find((s) => s.id === "patterns")!;
    expect(patterns.items[0].text).toMatch(/Transition Refusal: 2 times/);
    expect(patterns.items[0].text).toMatch(/intense/);
  });

  it("only includes approved memory facts (never pending)", () => {
    const p = buildConsultPacket(base);
    const mem = p.sections.find((s) => s.id === "memory")!;
    expect(mem.items).toHaveLength(1);
    expect(mem.items[0].text).toBe("Calms fastest with a countdown.");
  });

  it("excludes logs outside the window from patterns", () => {
    const stale: BuildPacketInput = { ...base, logs: [{ behaviorType: "Old", intensity: 5, timestamp: new Date(NOW - 90 * DAY).toISOString() }] };
    const p = buildConsultPacket(stale);
    expect(p.sections.find((s) => s.id === "patterns")).toBeUndefined();
  });

  it("omits sections with no source data", () => {
    const minimal: BuildPacketInput = { ...base, logs: [], milestones: [], plans: [], memory: [] };
    const p = buildConsultPacket(minimal);
    expect(p.sections.map((s) => s.id)).toEqual(["about"]);
  });
});

describe("serializePacket (redaction)", () => {
  it("renders Markdown with all items by default", () => {
    const p = buildConsultPacket(base);
    const md = serializePacket(p);
    expect(md).toMatch(/# Dylan — context for our conversation/);
    expect(md).toMatch(/Calms fastest with a countdown/);
    expect(md).toMatch(/non-diagnostic/i);
  });

  it("omits redacted items and drops a fully-redacted section", () => {
    const p = buildConsultPacket(base);
    const excluded = new Set(["mem-0"]);
    const md = serializePacket(p, excluded);
    expect(md).not.toMatch(/Calms fastest with a countdown/);
    expect(md).not.toMatch(/Context worth knowing/); // section emptied → dropped
  });

  it("countIncluded reflects redactions", () => {
    const p = buildConsultPacket(base);
    const total = countIncluded(p, new Set());
    const less = countIncluded(p, new Set(["mem-0", "about-basics"]));
    expect(less).toBe(total - 2);
  });
});
