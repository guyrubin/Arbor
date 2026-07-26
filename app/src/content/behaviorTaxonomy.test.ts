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
