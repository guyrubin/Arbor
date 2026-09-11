import { describe, it, expect } from "vitest";
import {
  buildConsultPacket,
  buildPresetPacket,
  serializePacket,
  serializePresetPacket,
  serializeForExport,
  presetPacketToPrintSections,
  sectionTitle,
  type BuildPacketInput,
} from "./packet";

/**
 * LC-13 / item 8 — the consult packet's own SCAFFOLD had no language.
 *
 * `serializePacket` hardcoded "# <name> — context for our conversation",
 * "## About <name>", "## What we've already tried" and the rest, so a Hebrew
 * family's export to a Hebrew-speaking gan teacher arrived as an English
 * skeleton wrapped around Hebrew items. The packet is the artefact this whole
 * hub exists to produce; it is the last place English should be assumed.
 */

const profile = {
  id: "c1",
  name: "Dylan",
  age: 5,
  languages: ["Hebrew", "English"],
  strengths: ["Building"],
  challenges: ["Mornings"],
  schoolContext: "Gan Shaked",
} as unknown as BuildPacketInput["profile"];

const input: BuildPacketInput = {
  profile,
  logs: [
    { id: "l1", behaviorType: "Transition", intensity: 3, timestamp: new Date().toISOString(), trigger: "leaving the house" },
  ],
  milestones: [],
  plans: [{ id: "p1", title: "Morning countdown", issue: "leaving the house" }],
  memory: [{ id: "m1", fact: "Dylan settles fastest with a two-minute warning.", status: "approved" }],
  reason: "Mornings are hard and I want a plan.",
  questions: ["What should we try first?"],
  nowMs: Date.UTC(2026, 8, 7),
} as unknown as BuildPacketInput;

const packet = buildConsultPacket(input);

/** The item's acceptance line: no Markdown heading that starts in Latin —
 *  excluding the child's own name, which is the family's spelling of it and is
 *  bidi-isolated by `translate`, not copy to transcreate. */
const LATIN_HEADING = /^#+ [A-Za-z]/m;
/** R22g (lib/bidi) — a Latin value inside a Hebrew paragraph is wrapped
 *  FSI…PDI so the heading's dash and prepositions stay on the Hebrew edge.
 *  The child's name is therefore `⁨Dylan⁩` in every Hebrew heading, and the
 *  bare `על Dylan` is the pre-R22g shape. */
const FSI = "⁨";
const PDI = "⁩";
const ISO_NAME = `${FSI}Dylan${PDI}`;
const stripName = (md: string) => md.replace(/Dylan/g, "").replace(/[⁦-⁩‎‏]/g, "").replace(/^(#+) +/gm, "$1 ");
const hasLatinHeading = (md: string) => LATIN_HEADING.test(stripName(md));

describe("negative control — the English scaffold is exactly what the scan catches", () => {
  it("the pre-fix header line trips the Latin-heading scan", () => {
    const PRE_FIX = "# Dylan — context for our conversation\n## About Dylan\n";
    expect(LATIN_HEADING.test(PRE_FIX)).toBe(true);
  });

  it("…and the default (English) serialization still trips it, by design", () => {
    // `lang` defaults to "en", so every existing caller is byte-unchanged.
    expect(LATIN_HEADING.test(serializePacket(packet))).toBe(true);
  });
});

describe('serializePacket({ lang: "he" }) renders a Hebrew scaffold', () => {
  const md = serializePacket(packet, new Set(), "he");

  it("has no Latin heading line", () => {
    expect(hasLatinHeading(md), md.split("\n").filter((l) => l.startsWith("#")).join("\n")).toBe(false);
  });

  it("carries the transcreated headings the item names", () => {
    expect(md).toContain("הקשר לשיחה שלנו");
    // The scaffold word is Hebrew and the family's Latin spelling of the name
    // rides inside it, bidi-isolated (R22g).
    expect(md).toContain(`## על ${ISO_NAME}`);
    expect(md).toContain(`# ${ISO_NAME} — הקשר לשיחה שלנו`);
    // Negative control: the unisolated form is the pre-R22g heading, which laid
    // the em dash out on the wrong edge for an RTL reader.
    expect(md).not.toContain("## על Dylan");
    expect(md).toContain("מה כבר ניסינו");
    expect(md).toContain("שאלות");
  });

  it("still carries the parent's and the log's own words untouched", () => {
    expect(md).toContain("Mornings are hard and I want a plan.");
    expect(md).toContain("What should we try first?");
  });

  it("the note lines under the headings are Hebrew too", () => {
    expect(md).toContain("במילים של ההורים");
  });
});

describe("the language reaches every export door", () => {
  it("serializePresetPacket passes it through and keeps the ceiling guards", () => {
    const teacher = buildPresetPacket("teacher", input);
    const md = serializePresetPacket("teacher", teacher, new Set(), "he");
    expect(hasLatinHeading(md)).toBe(false);
    expect(md).toContain(`## על ${ISO_NAME}`);
    expect(md).not.toContain("## על Dylan");
  });

  it("serializeForExport — the ONE Copy/Download/Send seam — passes it through", () => {
    const md = serializeForExport("clinician", packet, new Set(), "", "Parent note", "he");
    expect(hasLatinHeading(md)).toBe(false);
  });

  it("presetPacketToPrintSections — the PDF path — localizes headings and notes", () => {
    const clinician = buildPresetPacket("therapist", input);
    const sections = presetPacketToPrintSections("therapist", clinician, new Set(), "he");
    expect(sections.length).toBeGreaterThan(0);
    for (const s of sections) expect(s.heading.replace(/Dylan/g, "").trimStart()).not.toMatch(/^[A-Za-z]/);
  });
});

describe("nothing regresses for English callers", () => {
  it("every existing signature still defaults to English, byte-for-byte", () => {
    expect(serializePacket(packet)).toBe(serializePacket(packet, new Set(), "en"));
    const teacher = buildPresetPacket("teacher", input);
    expect(serializePresetPacket("teacher", teacher)).toBe(serializePresetPacket("teacher", teacher, new Set(), "en"));
  });

  it("a section with no key still renders its English title (no blank heading)", () => {
    expect(sectionTitle({ id: "x", title: "Ad-hoc section", items: [] }, "he")).toBe("Ad-hoc section");
  });

  it("every section the builder emits carries a title key", () => {
    const unkeyed = packet.sections.filter((s) => !s.titleKey).map((s) => s.id);
    expect(unkeyed, "sections still hardcoding an English title").toEqual([]);
  });
});
