import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en, he } from "../lib/i18n";
import {
  BEHAVIOR_TYPES,
  CANONICAL_BEHAVIOR_TYPES,
  DEFAULT_BEHAVIOR_TYPE,
  extractionOpensIncidentReview,
  hasIncidentCue,
  mapExtractedLabelToType,
  mapLabelToType,
  normalizeExtractedLog,
  behaviorTypeLabel,
} from "./behaviorTaxonomy";

/**
 * AI-CAP-8 — the ONE shared behavior-type taxonomy (2026-07-25 AI-excellence
 * Wave 2). Unit tests for the mapping + clamps, plus structural guards that
 * both capture selects render from THIS module (no duplicated option
 * literals) — the code shape that makes "any extraction result renders a
 * valid visible selection in both forms" true at runtime.
 */

describe("AI-CAP-8 — mapLabelToType", () => {
  it("exact canonical values match case-insensitively", () => {
    for (const value of CANONICAL_BEHAVIOR_TYPES) {
      expect(mapLabelToType(value)).toEqual({ type: value, matched: true });
      expect(mapLabelToType(value.toUpperCase()).matched).toBe(true);
    }
  });

  it("maps the free extraction labels the prompt itself exemplifies", () => {
    expect(mapLabelToType("Morning refusal")).toEqual({ type: "Transition Refusal", matched: true });
    expect(mapLabelToType("Screen shutoff meltdown")).toEqual({ type: "Screentime Dispute", matched: true });
    expect(mapLabelToType("Sibling conflict")).toEqual({ type: "Sibling Conflict", matched: true });
  });

  it("maps common free labels onto the canonical set (EN + HE)", () => {
    expect(mapLabelToType("Bedtime resistance").type).toBe("Sleep Meltdown");
    expect(mapLabelToType("Dinner table standoff").type).toBe("Food Refusal");
    expect(mapLabelToType("Loud party overwhelm").type).toBe("Sensory Overload");
    expect(mapLabelToType("ריב בין אחים").type).toBe("Sibling Conflict");
    expect(mapLabelToType("סירוב בבוקר").type).toBe("Transition Refusal");
  });

  it("an unmatched label falls back to the documented default with matched:false", () => {
    const r = mapLabelToType("Glitter everywhere incident");
    expect(r.type).toBe(DEFAULT_BEHAVIOR_TYPE);
    expect(r.matched).toBe(false);
    expect(mapLabelToType("").matched).toBe(false);
  });
});

describe("AI-CAP-8 — normalizeExtractedLog clamps every field", () => {
  it("clamps an explicit intensity to 1..5; a missing one stays undefined (B-DATA-09: no invented 3)", () => {
    expect(normalizeExtractedLog({ intensity: 99 }).intensity).toBe(5);
    expect(normalizeExtractedLog({ intensity: -2 }).intensity).toBe(1);
    expect(normalizeExtractedLog({ intensity: "nope" }).intensity).toBeUndefined();
    expect(normalizeExtractedLog({}).intensity).toBeUndefined();
  });

  it("clamps duration to >= 1 with 10 as the unknown default", () => {
    expect(normalizeExtractedLog({ durationMinutes: -5 }).durationMinutes).toBe(1);
    expect(normalizeExtractedLog({ durationMinutes: 0 }).durationMinutes).toBe(10);
    expect(normalizeExtractedLog({}).durationMinutes).toBe(10);
  });

  it("restricts context to the schema enum with Home as the safe default", () => {
    expect(normalizeExtractedLog({ context: "School" }).context).toBe("School");
    expect(normalizeExtractedLog({ context: "Mars" }).context).toBe("Home");
    expect(normalizeExtractedLog({}).context).toBe("Home");
  });

  it("preserves an unmatched free label in notes — never dropped", () => {
    const n = normalizeExtractedLog({ behaviorType: "Glitter everywhere incident", notes: "calm after" });
    // B-ASKJB-48: an unmatched label is the neutral Moment, never a default incident type.
    expect(n.behaviorType).toBe(MOMENT_BEHAVIOR_TYPE);
    expect(n.typeMatched).toBe(false);
    expect(n.notes).toContain("Glitter everywhere incident");
    expect(n.notes).toContain("calm after");
    // no base notes → the label alone becomes the note
    expect(normalizeExtractedLog({ behaviorType: "Glitter everywhere incident" }).notes).toBe(
      "Glitter everywhere incident",
    );
  });

  it("a matched label does NOT pollute notes", () => {
    const n = normalizeExtractedLog({ behaviorType: "Screen shutoff meltdown", notes: "after dinner" });
    expect(n.behaviorType).toBe("Screentime Dispute");
    expect(n.notes).toBe("after dinner");
  });

  it("falls back to the provided trigger when extraction returned none", () => {
    expect(normalizeExtractedLog({ trigger: "" }, "she screamed in the bath").trigger).toBe(
      "she screamed in the bath",
    );
    expect(normalizeExtractedLog({ trigger: "bath started" }, "fallback").trigger).toBe("bath started");
  });
});

/**
 * B-ASKJB-48 — a context-only label stays a neutral moment. Before this, a
 * free label that only named a context ("Sister reading together", "Family
 * dinner", "Goodnight routine", "Played on the tablet", "First word this
 * morning") hit the keyword map and came back matched:true as an incident type,
 * so a joyful moment opened the incident review with an intensity.
 */
describe("B-ASKJB-48 — context-only extraction labels stay neutral", () => {
  const CONTEXT_ONLY = {
    en: [
      "Sister reading together", "Brother and sister playing", "Family dinner", "Dinner with grandparents",
      "Bedtime routine", "Goodnight routine", "Played on the tablet", "Tablet drawing app",
      "First word this morning", "Pillow fight with brother", "Problem-solving with blocks at breakfast",
    ],
    he: [
      "אחים משחקים ביחד", "אחות קוראת איתו ספר", "ארוחת ערב משפחתית", "ארוחת בוקר עם ריבה",
      "שגרת שינה", "שגרת לילה טוב", "משחק בטאבלט", "מילה ראשונה בבוקר", "בקשה לעוד ארוחה",
    ],
  };
  const CONCERN = {
    en: [
      ["Morning refusal", "Transition Refusal"], ["Screen shutoff meltdown", "Screentime Dispute"],
      ["Sibling dispute over toys", "Sibling Conflict"], ["Bedtime resistance", "Sleep Meltdown"],
      ["Dinner table standoff", "Food Refusal"], ["Loud party overwhelm", "Sensory Overload"],
      ["Crying at bedtime", "Sleep Meltdown"], ["Won't eat dinner", "Food Refusal"],
      ["Fight with sister", "Sibling Conflict"],
    ],
    he: [
      ["ריב בין אחים", "Sibling Conflict"], ["סירוב בבוקר", "Transition Refusal"],
      ["בכי לפני השינה", "Sleep Meltdown"], ["צעקות על המסך", "Screentime Dispute"],
      ["לא רצה לישון במיטה", "Sleep Meltdown"],
    ],
  } as const;

  it.each([...CONTEXT_ONLY.en, ...CONTEXT_ONLY.he])("%s → neutral Moment, typeMatched false, label kept in notes, no incident review", (label) => {
    expect(hasIncidentCue(label), label).toBe(false);
    expect(mapExtractedLabelToType(label)).toEqual({ type: MOMENT_BEHAVIOR_TYPE, matched: false });
    const draft = normalizeExtractedLog({ behaviorType: label, intensity: 3, notes: "kept words" });
    expect(draft.behaviorType).toBe(MOMENT_BEHAVIOR_TYPE);
    expect(draft.typeMatched).toBe(false);
    expect(draft.notes).toContain(label);
    expect(draft.notes).toContain("kept words");
    expect(extractionOpensIncidentReview(draft)).toBe(false);
  });

  it("negative control: the pre-change keyword map promoted these context labels to incidents", () => {
    for (const label of ["Sister reading together", "Family dinner", "Bedtime routine", "Played on the tablet", "First word this morning", "אחים משחקים ביחד", "משחק בטאבלט"]) {
      const legacy = mapLabelToType(label);
      expect(legacy.matched, label).toBe(true);
      expect(legacy.type, label).not.toBe(MOMENT_BEHAVIOR_TYPE);
    }
  });

  it.each([...CONCERN.en, ...CONCERN.he])("%s still reaches the %s review", (label, type) => {
    expect(hasIncidentCue(label), label).toBe(true);
    const draft = normalizeExtractedLog({ behaviorType: label });
    expect(draft).toMatchObject({ behaviorType: type, typeMatched: true });
    expect(extractionOpensIncidentReview(draft)).toBe(true);
  });

  it("every canonical label still matches as itself, without a cue; Moment is never an incident", () => {
    for (const value of CANONICAL_BEHAVIOR_TYPES) {
      expect(mapExtractedLabelToType(value)).toEqual({ type: value, matched: true });
      expect(mapExtractedLabelToType(value.toLowerCase()).matched).toBe(true);
    }
    expect(extractionOpensIncidentReview(normalizeExtractedLog({ behaviorType: "Moment" }))).toBe(false);
    expect(extractionOpensIncidentReview(normalizeExtractedLog({ behaviorType: "Sibling Conflict" }))).toBe(true);
  });

  it("a declared hard moment keeps the keyword choice of incident type (the parent's toggle is the cue)", () => {
    expect(mapExtractedLabelToType("Bedtime routine", { incidentDeclared: true })).toEqual({ type: "Sleep Meltdown", matched: true });
    expect(mapExtractedLabelToType("Glitter everywhere incident", { incidentDeclared: true })).toEqual({ type: MOMENT_BEHAVIOR_TYPE, matched: false });
    expect(normalizeExtractedLog({ behaviorType: "Family dinner" }, "", { incidentDeclared: true })).toMatchObject({ behaviorType: "Food Refusal", typeMatched: true });
  });

  // Critic round 1 (P1): a real concern must never read as neutral. These
  // labels opened the incident review before the cue gate and must still.
  const AGGRESSION_PROBES = [
    ["Hit his brother", "Sibling Conflict"], ["Pushed sister off the couch", "Sibling Conflict"],
    ["Kicking during bedtime", "Sleep Meltdown"], ["Screen time ended in tears", "Screentime Dispute"],
    ["Threw toys at dinner", "Food Refusal"], ["Bit his sister at bath time", "Sibling Conflict"],
    ["Shoved brother off the slide", "Sibling Conflict"], ["Sibling jealousy", "Sibling Conflict"],
    ["Hitting at drop-off", "Transition Refusal"],
    ["הרביץ לאח שלו", "Sibling Conflict"], ["דחף את אחותו מהספה", "Sibling Conflict"],
    ["בעט בזמן השינה", "Sleep Meltdown"], ["המסך נגמר בדמעות", "Screentime Dispute"],
    ["זרק צעצועים בארוחת הערב", "Food Refusal"], ["נשך את אחותו באמבטיה", "Sibling Conflict"],
    ["קנאה בין אחים", "Sibling Conflict"],
  ] as const;
  it.each(AGGRESSION_PROBES)("aggression is a concern: %s still opens the %s review", (label, type) => {
    expect(hasIncidentCue(label), label).toBe(true);
    const draft = normalizeExtractedLog({ behaviorType: label, intensity: 4 });
    expect(draft).toMatchObject({ behaviorType: type, typeMatched: true, intensity: 4 });
    expect(extractionOpensIncidentReview(draft)).toBe(true);
  });

  it("'a bit' is not biting, and the context-only list stays neutral beside the aggression words", () => {
    expect(hasIncidentCue("A bit tired at bedtime")).toBe(false);
    expect(hasIncidentCue("A little bit of quiet time with sister")).toBe(false);
    expect(hasIncidentCue("Bit his sister")).toBe(true);
  });

  it("NEGATIVE CONTROL: every incident fixture label that opened the review before the cue gate still opens it, with the same type", () => {
    // The repo's incident fixtures: the capture-extract-v1 stubbed labels, the
    // AI-CAP-8 alias labels, this row's concern lists and the critic's probes.
    const evalSuite = fs.readFileSync(path.resolve(__dirname, "..", "..", "..", "evals", "capture-extract-v1.eval.json"), "utf8");
    const evalLabels = [...evalSuite.matchAll(/"behaviorType":\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(evalLabels.length).toBeGreaterThanOrEqual(4);
    const fixtures = [
      ...evalLabels,
      "Morning refusal", "Screen shutoff meltdown", "Sibling conflict", "Bedtime resistance", "Dinner table standoff",
      "Loud party overwhelm", "ריב בין אחים", "סירוב בבוקר",
      ...CONCERN.en.map(([label]) => label), ...CONCERN.he.map(([label]) => label),
      ...AGGRESSION_PROBES.map(([label]) => label),
    ];
    let compared = 0;
    for (const label of fixtures) {
      const legacy = mapLabelToType(label);
      if (!legacy.matched || legacy.type === MOMENT_BEHAVIOR_TYPE) continue; // never opened the review
      compared++;
      const draft = normalizeExtractedLog({ behaviorType: label });
      expect(extractionOpensIncidentReview(draft), label).toBe(true);
      expect(draft.behaviorType, label).toBe(legacy.type);
    }
    expect(compared).toBeGreaterThanOrEqual(30);
  });

  it("saved records are not re-read: legacy stored free labels keep their localized label", () => {
    const t = (key: string) => en[key] ?? key;
    expect(behaviorTypeLabel("Sensory Meltdown", t)).toBe(en["ql.type.sensory"]);
    expect(behaviorTypeLabel("Bedtime routine", t)).toBe(en["ql.type.sleep"]);
    expect(DEFAULT_BEHAVIOR_TYPE).toBe("Transition Refusal");
  });
});

describe("AI-CAP-8 — labels are localized in both dictionaries", () => {
  it("every canonical type has EN+HE full and short labels", () => {
    for (const b of BEHAVIOR_TYPES) {
      for (const key of [b.labelKey, b.shortLabelKey]) {
        expect(en[key], `en missing ${key}`).toBeTruthy();
        expect(he[key], `he missing ${key}`).toBeTruthy();
      }
    }
  });

  it("behaviorTypeLabel localizes canonical types and passes legacy free labels through", () => {
    const t = (k: string) => he[k] ?? k;
    expect(behaviorTypeLabel("Sibling Conflict", t)).toBe(he["ql.type.sibling"]);
    expect(behaviorTypeLabel("Sibling Conflict", t, "full")).toBe(he["beh.type.sibling"]);
    expect(behaviorTypeLabel("Old Free Label", t)).toBe("Old Free Label");
  });
});

describe("AI-CAP-8 — both capture selects render from the shared module (structural)", () => {
  const SRC_ROOT = path.resolve(__dirname, "..");
  const read = (rel: string) => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
  const stripComments = (code: string) =>
    code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const behaviors = stripComments(read("components/tabs/BehaviorsTab.tsx"));
  const modal = stripComments(read("components/overview/QuickLogModal.tsx"));

  it("the shared form maps BEHAVIOR_TYPES into its <option> list; the launcher has none", () => {
    expect(behaviors).not.toMatch(/<select|<option|setNewLogType/);
    for (const surface of [modal]) {
      expect(surface).toMatch(/import \{[^}]*BEHAVIOR_TYPES[^}]*\} from ["'].*content\/behaviorTaxonomy["']/);
      expect(surface).toMatch(/BEHAVIOR_TYPES\.map\(/);
    }
  });

  it("no duplicated hardcoded option literals remain in either form", () => {
    for (const surface of [behaviors, modal]) {
      expect(surface).not.toMatch(/<option value="Transition Refusal"/);
      expect(surface).not.toMatch(/<option value="Sleep Meltdown"/);
    }
  });

  it("the /extract-log prompt names the canonical six from the SAME module", () => {
    const routes = stripComments(read("routes/api.ts"));
    expect(routes).toMatch(/import \{ CANONICAL_BEHAVIOR_TYPES \} from ["']\.\.\/content\/behaviorTaxonomy\.js["']/);
    expect(routes).toMatch(/CANONICAL_BEHAVIOR_TYPES\.join\(/);
  });
});

/* ── TJB-01 — a joyful moment saves WITHOUT inventing "what you tried" ───────
   The data contract, not the composer chrome: `response` is optional on
   BehaviorLog, required only for incident types; the neutral "Moment" type is
   the default shape of the Journal's "catch the moment" promise; and no
   capture surface may block on a window alert() again. */
import {
  INCIDENT_TYPES,
  MOMENT_BEHAVIOR_TYPE,
  isIncidentType,
  validateLogDraft,
  momentLogFields,
} from "./behaviorTaxonomy";

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const readSrc = (rel: string) => stripComments(fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8"));

describe("TJB-01 — validateLogDraft: response is required for incidents only", () => {
  it("a one-sentence positive moment saves with NO response", () => {
    expect(validateLogDraft({ behaviorType: MOMENT_BEHAVIOR_TYPE, trigger: "She said 'butterfly' for the first time", response: "" })).toBeNull();
    expect(validateLogDraft({ behaviorType: MOMENT_BEHAVIOR_TYPE, trigger: "Laughed at the dog for a full minute" })).toBeNull();
  });

  it("NEGATIVE CONTROL — an incident without a response is still refused", () => {
    expect(validateLogDraft({ behaviorType: "Transition Refusal", trigger: "Would not put boots on", response: "" })).toBe("beh.toast.fillBoth");
    expect(validateLogDraft({ behaviorType: "Sleep Meltdown", trigger: "x", response: "   " })).toBe("beh.toast.fillBoth");
  });

  it("a moment still needs the one field it has (what happened)", () => {
    expect(validateLogDraft({ behaviorType: MOMENT_BEHAVIOR_TYPE, trigger: "   " })).toBe("beh.toast.fillTrigger");
  });

  it("INCIDENT_TYPES is exactly the canonical set minus Moment, and Moment is listed for both selects", () => {
    expect(INCIDENT_TYPES.has(MOMENT_BEHAVIOR_TYPE)).toBe(false);
    expect(isIncidentType("Transition Refusal")).toBe(true);
    expect([...INCIDENT_TYPES].length).toBe(BEHAVIOR_TYPES.length - 1);
    expect(BEHAVIOR_TYPES.some((b) => b.value === MOMENT_BEHAVIOR_TYPE)).toBe(true);
    for (const dict of [en, he]) {
      expect(dict["beh.type.moment"]).toBeTruthy();
      expect(dict["ql.type.moment"]).toBeTruthy();
      expect(dict["beh.toast.fillTrigger"]).toBeTruthy();
    }
  });

  it("momentLogFields never feeds the friction rhythm (no intensity, duration 0, no response)", () => {
    const f = momentLogFields("  First full sentence today  ");
    expect(f.behaviorType).toBe(MOMENT_BEHAVIOR_TYPE);
    expect("intensity" in f).toBe(false);
    expect(f.durationMinutes).toBe(0);
    expect(f.trigger).toBe("First full sentence today");
    expect(f.response).toBeUndefined();
  });
});

describe("TJB-01 — no capture surface renders a blocking alert()", () => {
  const CAPTURE_SURFACES = [
    "context/ArborContext.tsx",
    "components/overview/QuickLogModal.tsx",
    "components/overview/QuickCaptureBar.tsx",
    "components/overview/PromptCaptureCard.tsx",
    "components/tabs/BehaviorsTab.tsx",
    "components/tabs/JournalTab.tsx",
  ];
  const ALERT_CALL = /(^|[^.\w])alert\s*\(/;

  it("NEGATIVE CONTROL — the matcher catches the pre-fix handleAddLog alert", () => {
    const preFix = `    if (!newLogTrigger.trim() || !newLogResponse.trim()) {
      alert("Please provide trigger details and active response summary.");
      return;
    }`;
    expect(ALERT_CALL.test(stripComments(preFix))).toBe(true);
    // A word that merely ends in "alert" (role="alert", escalationAlert) is not a call.
    expect(ALERT_CALL.test('<div role="alert" dir="auto">')).toBe(false);
  });

  for (const rel of CAPTURE_SURFACES) {
    it(`${rel} has no alert( call`, () => {
      expect(readSrc(rel)).not.toMatch(ALERT_CALL);
    });
  }

  it("handleAddLog validates through validateLogDraft and toasts (never blocks)", () => {
    const ctx = readSrc("context/ArborContext.tsx");
    expect(ctx).toMatch(/const invalid = validateLogDraft\(\{ behaviorType: newLogType, trigger: newLogTrigger, response: newLogResponse \}\)/);
    expect(ctx).toContain("toast(t(invalid), \"error\")");
    // B-TODAY-19: addMoment takes the photo + prompt key, through the ONE
    // pure builder that keeps the same validateLogDraft rule.
    expect(ctx).toMatch(/const addMoment = async \(\s*text: string,/);
    expect(ctx).toContain('buildMomentLog(text, context ?? "", buildOpts)');
    expect(readSrc("content/behaviorTaxonomy.ts")).toMatch(/export function buildMomentLog[\s\S]{0,400}if \(validateLogDraft\(fields\)\) return null;/);
  });

  it("QuickLogModal's default path is the ONE-field moment form writing through addMoment", () => {
    const modal = readSrc("components/overview/QuickLogModal.tsx");
    expect(modal).toContain('data-testid="quicklog-moment-form"');
    expect(modal).toMatch(/addMoment\(words, \{/);
    expect(modal).toContain("const words = newLogTrigger.trim()");
    // The incident branch still validates through the shared rule.
    expect(modal).toMatch(/validateLogDraft\(\{ behaviorType: newLogType/);
    expect(modal).not.toMatch(/!newLogTrigger\.trim\(\) \|\| !newLogResponse\.trim\(\)/);
  });

  it("the shared sheet validates both submit and confirm through the shared rule", () => {
    const tab = readSrc("components/overview/QuickLogModal.tsx");
    expect(readSrc("components/tabs/BehaviorsTab.tsx")).not.toMatch(/validateLogDraft|handleAddLog/);
    expect(tab).not.toMatch(/!newLogTrigger\.trim\(\) \|\| !newLogResponse\.trim\(\)/);
    expect((tab.match(/validateLogDraft\(\{ behaviorType: newLogType/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
