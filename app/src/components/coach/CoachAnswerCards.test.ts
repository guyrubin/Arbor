import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CoachAnswerCards, { sourcesLabel, escalationTier } from "./CoachAnswerCards";
import type { CoachContract } from "../../types";

/**
 * R1 — Render coach citations
 *
 * Unit tests for the pure `sourcesLabel` helper and G2 gate:
 *   - G2: copy states mechanism/source only (never an outcome claim).
 *   - Empty sourceCardsUsed yields no badge (empty string).
 *   - Singular / plural strings are correct in both languages.
 *
 * No full-component render test — the component uses browser APIs (clipboard,
 * speech) that require a DOM harness. The pure helper covers the logic that
 * would otherwise have no test surface.
 */
describe("sourcesLabel (R1 citation helper)", () => {
  it("returns empty string for 0 sources — no badge on empty array", () => {
    expect(sourcesLabel(0, "en")).toBe("");
    expect(sourcesLabel(0, "he")).toBe("");
  });

  it("returns singular form for exactly 1 source (EN)", () => {
    const label = sourcesLabel(1, "en");
    expect(label).toBe("Grounded in 1 source");
  });

  it("returns singular form for exactly 1 source (HE)", () => {
    const label = sourcesLabel(1, "he");
    expect(label).toBe("מבוסס על מקור אחד");
  });

  it("returns plural form for 2 sources (EN)", () => {
    const label = sourcesLabel(2, "en");
    expect(label).toContain("2");
    expect(label.toLowerCase()).toContain("source");
  });

  it("returns plural form for 2 sources (HE)", () => {
    const label = sourcesLabel(2, "he");
    expect(label).toContain("2");
    expect(label).toContain("מקור");
  });

  it("returns plural form for 5 sources (EN)", () => {
    const label = sourcesLabel(5, "en");
    expect(label).toContain("5");
  });

  // G2 gate: source label must NEVER contain outcome/effect claims.
  it("G2: label does not contain forbidden outcome-claim words (EN)", () => {
    const forbidden = ["proven", "validated", "clinically", "clinical", "evidence-based", "effect"];
    for (const n of [1, 2, 5]) {
      const label = sourcesLabel(n, "en").toLowerCase();
      for (const word of forbidden) {
        expect(label, `label for n=${n} must not contain "${word}"`).not.toContain(word);
      }
    }
  });

  it("G2: label does not contain condition/diagnostic terms (EN)", () => {
    const conditions = ["autism", "adhd", "anxiety", "delay", "disorder", "diagnosis"];
    for (const n of [1, 3]) {
      const label = sourcesLabel(n, "en").toLowerCase();
      for (const word of conditions) {
        expect(label, `label for n=${n} must not contain "${word}"`).not.toContain(word);
      }
    }
  });
});

/**
 * Escalation footer tiering — the "Reach out for help if" content is ALWAYS
 * rendered when escalateIf is non-empty; only its PROMINENCE changes with
 * riskLevel. Low risk = quiet collapsed disclosure; moderate+ = the full
 * warning panel. Unknown levels fail safe upward to prominent.
 *
 * The component is exercised via renderToStaticMarkup (no DOM harness needed;
 * clipboard/speech surfaces are only reached through event handlers).
 */
const ESCALATE_ITEM = "sleep disruption lasts more than two weeks";

function makeContract(riskLevel: string): CoachContract {
  return {
    riskLevel,
    ageBand: "",
    domains: [],
    nonDiagnosticHypotheses: [],
    todayPlan: [],
    parentScript: "",
    avoid: [],
    observe: [],
    escalateIf: [ESCALATE_ITEM],
    frameRouting: { aim: "", twoAxes: "", story: "", shadow: "", marriage: "", shepherd: "" },
    memoryProposals: [],
    handoffNotes: { teacher: "", professional: "" },
  };
}

const noop = () => {};

function renderCards(riskLevel: string): string {
  return renderToStaticMarkup(
    React.createElement(CoachAnswerCards, {
      contract: makeContract(riskLevel),
      onSaveToPlan: noop,
      onCreateLog: noop,
      onAddToHandoff: noop,
    })
  );
}

describe("escalationTier (prominence helper)", () => {
  it("low / absent risk is quiet", () => {
    expect(escalationTier("low")).toBe("quiet");
    expect(escalationTier("Low")).toBe("quiet");
    expect(escalationTier("")).toBe("quiet");
    expect(escalationTier(undefined)).toBe("quiet");
  });

  it("moderate and above are prominent", () => {
    for (const level of ["moderate", "elevated", "high", "severe", "urgent"]) {
      expect(escalationTier(level), `"${level}" must be prominent`).toBe("prominent");
    }
  });

  it("unrecognized levels fail safe to prominent", () => {
    expect(escalationTier("unexpected")).toBe("prominent");
  });
});

describe("escalation footer rendering", () => {
  it("low risk: escalateIf content is present in the DOM inside the quiet disclosure", () => {
    const html = renderCards("low");
    expect(html).toContain(ESCALATE_ITEM);
    expect(html).toContain("When to seek help");
    expect(html).not.toContain("Reach out for help if");
    // Collapsed by default — hidden, never unmounted.
    expect(html).toContain("hidden");
    expect(html).toContain('aria-expanded="false"');
  });

  it("moderate risk: escalateIf content is present in the full warning panel", () => {
    const html = renderCards("moderate");
    expect(html).toContain(ESCALATE_ITEM);
    expect(html).toContain("Reach out for help if");
  });

  it("high risk: warning panel keeps maximum prominence", () => {
    const html = renderCards("high");
    expect(html).toContain(ESCALATE_ITEM);
    expect(html).toContain("Reach out for help if");
  });
});
