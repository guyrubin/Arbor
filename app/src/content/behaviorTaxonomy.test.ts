import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en, he } from "../lib/i18n";
import {
  BEHAVIOR_TYPES,
  CANONICAL_BEHAVIOR_TYPES,
  DEFAULT_BEHAVIOR_TYPE,
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
  it("clamps intensity to 1..5 with 3 as the unknown default", () => {
    expect(normalizeExtractedLog({ intensity: 99 }).intensity).toBe(5);
    expect(normalizeExtractedLog({ intensity: -2 }).intensity).toBe(1);
    expect(normalizeExtractedLog({ intensity: "nope" }).intensity).toBe(3);
    expect(normalizeExtractedLog({}).intensity).toBe(3);
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
    expect(n.behaviorType).toBe(DEFAULT_BEHAVIOR_TYPE);
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

  it("both forms map BEHAVIOR_TYPES into their <option> lists", () => {
    for (const surface of [behaviors, modal]) {
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

  it("momentLogFields never feeds the friction rhythm (intensity 1, duration 0, no response)", () => {
    const f = momentLogFields("  First full sentence today  ");
    expect(f.behaviorType).toBe(MOMENT_BEHAVIOR_TYPE);
    expect(f.intensity).toBe(1);
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
    expect(ctx).toContain("const addMoment = (text: string)");
  });

  it("QuickLogModal's default path is the ONE-field moment form writing through addMoment", () => {
    const modal = readSrc("components/overview/QuickLogModal.tsx");
    expect(modal).toContain('data-testid="quicklog-moment-form"');
    expect(modal).toMatch(/addMoment\(newLogTrigger\)/);
    // The incident branch still validates through the shared rule.
    expect(modal).toMatch(/validateLogDraft\(\{ behaviorType: newLogType/);
    expect(modal).not.toMatch(/!newLogTrigger\.trim\(\) \|\| !newLogResponse\.trim\(\)/);
  });

  it("BehaviorsTab's two write paths validate through the shared rule (no fillBoth hard-block)", () => {
    const tab = readSrc("components/tabs/BehaviorsTab.tsx");
    expect(tab).not.toMatch(/!newLogTrigger\.trim\(\) \|\| !newLogResponse\.trim\(\)/);
    expect((tab.match(/validateLogDraft\(\{ behaviorType: newLogType/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
