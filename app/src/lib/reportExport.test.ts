import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { TRIGGER_QUOTE_MAX } from "../hooks/useWeeklyRecap";
import { buildReport, type ReportContext, type ReportDoc } from "./reportExport";

/**
 * N6 (RES-REPORT) — exported-report hygiene. The printable parent report
 * LEAVES the app (highest blast radius), so it gets the exact quarantine the
 * E7 fix gave WeeklyTab, through the SHARED topMomentDisplay helper:
 *   · behaviorType (schema vocabulary) may print as a computed stat line;
 *   · the parent's free-typed trigger prints ONLY quoted + truncated
 *     (TRIGGER_QUOTE_MAX) — visibly parent words, never a computed stat.
 * Also pins the E9 date rule: every date in this module renders through
 * lib/formatDate, never a raw locale call.
 */

const DAY = 86_400_000;

const LONG_TRIGGER = "little brother knocked the block tower over right before dinner";
const SHORT_TRIGGER = "iPad taken away mid-episode";
const TRUNCATED_LONG = `${LONG_TRIGGER.slice(0, TRIGGER_QUOTE_MAX).trimEnd()}…`;

const log = (daysAgo: number, over: Partial<ReportContext["logs"][number]> = {}) => ({
  id: `l${daysAgo}`,
  timestamp: new Date(Date.now() - daysAgo * DAY).toISOString(),
  behaviorType: "Transition Refusal",
  intensity: 3,
  durationMinutes: 10,
  trigger: LONG_TRIGGER,
  response: "Named the feeling",
  ...over,
});

const CTX: ReportContext = {
  child: {
    id: "c1",
    name: "Noa",
    age: 4,
    languages: ["Hebrew", "English"],
    schoolContext: "Bilingual preschool",
    strengths: ["warm with animals"],
    challenges: ["big transitions"],
    riskLevel: "Low",
  },
  logs: [
    log(1),
    log(2),
    log(3, { behaviorType: "Sibling Conflict", trigger: SHORT_TRIGGER }),
  ],
  plans: [],
  checkedMilestones: 6,
  totalMilestones: 10,
};

function flattenDoc(doc: ReportDoc): string {
  return [
    doc.title,
    doc.subtitle ?? "",
    ...doc.sections.flatMap((s) => [s.heading, ...(Array.isArray(s.body) ? s.body : [s.body])]),
  ].join("\n");
}

/** Every occurrence of `needle` in `text` must sit inside “quotes” — i.e. be
 *  immediately preceded by the opening quote mark. */
function occursOnlyQuoted(text: string, needle: string): boolean {
  let i = text.indexOf(needle);
  while (i !== -1) {
    if (text[i - 1] !== "“") return false;
    i = text.indexOf(needle, i + 1);
  }
  return true;
}

describe("N6 — free-typed trigger appears ONLY quoted + truncated in export output", () => {
  it("weekly: the top trigger's free text never prints raw — only the quoted, truncated form", () => {
    const text = flattenDoc(buildReport("weekly", CTX));
    expect(text, "full raw trigger leaked into the export").not.toContain(LONG_TRIGGER);
    expect(text).toContain(`“${TRUNCATED_LONG}”`);
    expect(occursOnlyQuoted(text, TRUNCATED_LONG), "trigger text printed outside quotes").toBe(true);
    // The quoted line names itself as parent words, never a bare stat value.
    expect(text).toContain("in the parent's words");
  });

  it("weekly: behaviorType still prints as the computed stat label", () => {
    const text = flattenDoc(buildReport("weekly", CTX));
    expect(text).toContain("Most-logged: Transition Refusal");
  });

  it("behavior: summary + every per-event line quarantine the trigger the same way", () => {
    const text = flattenDoc(buildReport("behavior", CTX));
    expect(text).not.toContain(LONG_TRIGGER);
    expect(occursOnlyQuoted(text, TRUNCATED_LONG)).toBe(true);
    // Short free text survives whole, but still only inside quotes.
    expect(text).toContain(`“${SHORT_TRIGGER}”`);
    expect(occursOnlyQuoted(text, SHORT_TRIGGER)).toBe(true);
    // The pre-N6 computed-looking form is gone for good.
    expect(text).not.toMatch(/,\s*trigger:/);
  });

  it("empty week degrades honestly: a counts placeholder, no quote line", () => {
    const text = flattenDoc(buildReport("weekly", { ...CTX, logs: [] }));
    expect(text).toContain("Most-logged: —");
    expect(text).not.toContain("“");
  });
});

describe("N6 — source pins (shared quarantine + E9 dates)", () => {
  const src = fs.readFileSync(path.join(__dirname, "reportExport.ts"), "utf8");

  it("reuses the SHARED topMomentDisplay from hooks/useWeeklyRecap (imported, never re-implemented)", () => {
    expect(src).toMatch(/import\s*{[^}]*topMomentDisplay[^}]*}\s*from\s*["']\.\.\/hooks\/useWeeklyRecap["']/);
  });

  it("E9: dates render through lib/formatDate only — no raw locale/date formatting calls", () => {
    expect(src).toMatch(/from\s*["']\.\/formatDate["']/);
    expect(src).not.toMatch(/toLocale(Date|Time)?String|Intl\.DateTimeFormat/);
  });
});

/* LC-19 — the Language Transition Note carries the child's RECORD, never
 * canned sentences presented as observations. With empty observations every
 * child-specific body line must be derived from the profile (or be empty);
 * the one general block is labelled on every line. The pre-fix constants are
 * kept as the negative control. */
import { GENERAL_SUGGESTION_LABEL, SUGGESTED_SCHOOL_PHRASES } from "./reportExport";

const PRE_FIX_CANNED = [
  "Emotional vocabulary still developing",
  "Pair new English words with familiar home-language anchors",
  "Celebrate attempts, not just correctness",
];

/** A body line is honest when it is empty, quotes a profile value, or is an
 *  explicitly labelled general suggestion. */
function lineIsDerivedOrLabelled(line: string, child: ReportContext["child"]): boolean {
  if (!line.trim()) return true;
  if (line.startsWith(GENERAL_SUGGESTION_LABEL)) return true;
  const profileValues = [...child.languages, child.schoolContext, ...child.challenges, ...child.strengths].filter(Boolean);
  return profileValues.some((v) => line.includes(v));
}

describe("LC-19 — Language Transition Note is built from the record", () => {
  // Sentinel profile values: no canned English sentence can accidentally
  // "contain" a real language name, so the honesty checker is exact.
  const empty: ReportContext = {
    ...CTX,
    logs: [],
    langObs: [],
    child: { ...CTX.child, languages: ["Zorbish", "Quenya"], schoolContext: "Sentinel kindergarten 7", strengths: ["sentinel-strength"], challenges: [] },
  };

  it("with empty observations, no section body is a constant sentence about the child", () => {
    const doc = buildReport("language", empty);
    for (const s of doc.sections) {
      const lines = Array.isArray(s.body) ? s.body : [s.body];
      for (const line of lines) {
        expect(lineIsDerivedOrLabelled(line, empty.child), `${s.heading}: "${line}"`).toBe(true);
      }
    }
  });

  it("the pre-fix canned lines are gone from the document", () => {
    const text = flattenDoc(buildReport("language", empty));
    for (const canned of PRE_FIX_CANNED) expect(text).not.toContain(canned);
    expect(text).not.toContain("Comfort & gaps");
    expect(text).not.toContain("Parent support plan");
  });

  it("logged phrases appear as per-language counts + the parent's quoted words", () => {
    const withObs: ReportContext = {
      ...CTX,
      langObs: [
        { id: "a", timestamp: "2026-08-30T10:00:00.000Z", language: "Hebrew", phrase: "עוד פעם" },
        { id: "b", timestamp: "2026-08-31T10:00:00.000Z", language: "English", phrase: "more please" },
        { id: "c", timestamp: "2026-09-01T10:00:00.000Z", language: "English", phrase: "all done" },
      ],
    };
    const text = flattenDoc(buildReport("language", withObs));
    expect(text).toContain("English: 2 words or phrases the parent has noticed");
    expect(text).toContain("Hebrew: 1 word or phrase the parent has noticed");
    expect(text).toContain("in the parent's words: “all done”");
    expect(text).toContain("in the parent's words: “עוד פעם”");
    expect(text).toContain("Bilingual preschool");
  });

  it("general phrases stay, but every line is labelled as Arbor's suggestion", () => {
    const doc = buildReport("language", empty);
    const general = doc.sections.find((s) => s.heading === "Phrases that help at school")!;
    const lines = Array.isArray(general.body) ? general.body : [general.body];
    expect(lines.length).toBe(SUGGESTED_SCHOOL_PHRASES.length);
    for (const line of lines) expect(line.startsWith(GENERAL_SUGGESTION_LABEL)).toBe(true);
  });

  it("NEGATIVE CONTROL: the pre-fix constant sentence is flagged by the honesty checker", () => {
    for (const canned of PRE_FIX_CANNED) expect(lineIsDerivedOrLabelled(canned, empty.child)).toBe(false);
  });
});
