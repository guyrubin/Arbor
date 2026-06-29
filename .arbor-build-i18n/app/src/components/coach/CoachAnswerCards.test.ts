import { describe, it, expect } from "vitest";
import { sourcesLabel } from "./CoachAnswerCards";

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
