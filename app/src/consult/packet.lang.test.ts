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
    const md = serializeForExport("therapist", packet, new Set(), "", "Parent note", "he");
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

/* ── B-CAREPRO-32 — packet ITEMS in Hebrew, not only the scaffold ─────────────
 * Headings were keyed (LC-13); the item lines were English sentences around
 * Hebrew data ("speaks … and …", "Setting:", "N times in the last 30 days",
 * "{n} of {m} milestones …", the three since lines, raw behaviorType enums,
 * English domain labels). Acceptance: a Hebrew clinician copy, PDF and
 * recipient view carry 0 Latin words except names, milestone titles and logged
 * phrases; the English output is unchanged. */
import { exportPrintSections, buildSharedScopePacket, itemText } from "./packet";
import { translate } from "../lib/i18n";

const HE_NOW = Date.UTC(2026, 9, 2);
const HE_DAY = 86_400_000;
const heInput: BuildPacketInput = {
  profile: { name: "Dylan", age: 5, ageMonths: 62, languages: ["Hebrew", "English"], schoolContext: "גן שקד", strengths: ["בונה מגדלים"], challenges: ["בקרים"] },
  logs: [
    { behaviorType: "Transition Refusal", intensity: 4, timestamp: new Date(HE_NOW - 2 * HE_DAY).toISOString(), trigger: "יציאה מהבית" },
    { behaviorType: "Transition Refusal", intensity: 2, timestamp: new Date(HE_NOW - 3 * HE_DAY).toISOString(), trigger: "יציאה מהבית" },
    { behaviorType: "Sibling Conflict", intensity: 2, timestamp: new Date(HE_NOW - 4 * HE_DAY).toISOString() },
  ],
  milestones: [
    { domain: "language_communication", title: "Says two-word phrases", checked: true, status: "yes", ageMonths: 60, observedAt: new Date(HE_NOW - 6 * HE_DAY).toISOString() },
    { domain: "social_development", title: "Takes turns in games", checked: false, status: "not_sure", ageMonths: 60 },
  ],
  plans: [{ title: "ספירה לאחור", issue: "יציאה מהבית", createdAt: HE_NOW - HE_DAY }],
  memory: [{ fact: "נרגע מהר עם התראה של שתי דקות", status: "approved" }],
  nowMs: HE_NOW,
  reason: "הבקרים קשים",
  questions: ["במה להתחיל?"],
  langObs: [{ phrase: "more juice", language: "English", at: new Date(HE_NOW - 3 * HE_DAY).toISOString() }],
  growthEntries: [{ date: "2026-09-20", heightCm: 108, weightKg: 18 }],
  lastExportedAt: new Date(HE_NOW - 10 * HE_DAY).toISOString(),
  lastExportedAudience: "pediatrician",
};
const hePacket = buildConsultPacket(heInput);
/** The Latin a Hebrew document may carry: the child's name, catalogued
 *  milestone titles (GD-6) and phrases the parent logged as heard. */
const ALLOWED_LATIN = ["Dylan", "Says two-word phrases", "Takes turns in games", "more juice"];
const latinLeft = (text: string) => {
  let rest = text;
  for (const a of ALLOWED_LATIN) rest = rest.split(a).join("");
  return rest.match(/[A-Za-z]+/g) ?? [];
};

describe("B-CAREPRO-32 · Hebrew packet items", () => {
  it("non-vacuity: the fixture fills every keyed item kind", () => {
    const ids = hePacket.sections.flatMap((s) => s.items.map((i) => i.id));
    for (const id of ["about-basics", "about-school", "about-strengths", "about-focus", "pattern-0", "dev-overall", "dev-observed", "dev-not-sure", "dev-0", "tried-0", "lang-0", "growth-0", "trigger-0", "delta-logs", "delta-plans", "delta-milestones"]) {
      expect(ids, id).toContain(id);
    }
  });

  for (const audience of ["pediatrician", "slp", "behavioral_health", "therapist", "self"] as const) {
    it(`${audience}: HE copy and PDF carry no Latin beyond names, milestone titles and logged phrases`, () => {
      const md = serializeForExport(audience, hePacket, new Set(), "", "הערת הורה", "he");
      expect(latinLeft(md), md).toEqual([]);
      const pdf = exportPrintSections(audience, hePacket, new Set(), "", "הערת הורה", "he").flatMap((s) => [s.heading, ...s.body]).join("\n");
      expect(latinLeft(pdf), pdf).toEqual([]);
    });
  }

  it("the recipient view (scope-capped packet rendered per item) is Hebrew too", () => {
    const shared = buildSharedScopePacket(["weekly_insight", "report_slp"], true, heInput);
    const text = shared.sections.flatMap((s) => [sectionTitle(s, "he"), ...s.items.map((i) => itemText(i, "he"))]).join("\n");
    expect(text.length).toBeGreaterThan(100);
    expect(latinLeft(text), text).toEqual([]);
  });

  it("behaviour types, domains, units and the language name are labelled, not printed raw", () => {
    const md = serializeForExport("pediatrician", hePacket, new Set(), "", "הערת הורה", "he");
    expect(md).not.toContain("Transition Refusal");
    expect(md).toContain(translate("he", "beh.type.transition"));
    expect(md).toContain(translate("he", "screen.domain.language_communication"));
    expect(md).toContain("ס״מ");
    const slp = serializeForExport("slp", hePacket, new Set(), "", "הערת הורה", "he");
    expect(slp).toContain(translate("he", "ob.lang.english"));
  });

  it("English output is unchanged: every keyed item renders its stored English text in EN", () => {
    for (const s of hePacket.sections) for (const it of s.items) expect(itemText(it, "en")).toBe(it.text);
    // …and the EN dictionary mirrors the stored text for every key-rendered line
    // (minus the bidi isolates translate adds around interpolations).
    const strip = (x: string) => x.replace(/[\u2066-\u2069]/g, "");
    const enPacket = buildConsultPacket({ ...heInput, profile: { ...heInput.profile, schoolContext: "Gan", strengths: ["building"], challenges: ["mornings"] } });
    for (const s of enPacket.sections) {
      for (const it of s.items) {
        if (!it.textKey || it.id === "about-basics" || it.id.startsWith("dev-") || it.id.startsWith("pattern") || it.id.startsWith("lang") || it.id.startsWith("growth")) continue;
        expect(strip(translate("en", it.textKey, Object.fromEntries(Object.entries(it.vars ?? {}).map(([k, v]) => [k, typeof v === "object" ? "" : v])))).length).toBeGreaterThan(0);
      }
    }
  });

  it("NEGATIVE CONTROL: the pre-change English item lines trip the Latin scan", () => {
    expect(latinLeft("- Dylan, 5 years, speaks Hebrew and English.\n- Setting: גן שקד.")).toEqual(["years", "speaks", "Hebrew", "and", "English", "Setting"]);
  });
});
