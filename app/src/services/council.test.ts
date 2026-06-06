import { describe, expect, it } from "vitest";
import { selectCouncil } from "./council.js";
import { getScholarById, INTEGRATED } from "./scholars.js";

describe("selectCouncil (SAGE-2)", () => {
  it("always returns the requested size, no duplicates, never 'integrated'", () => {
    const c = selectCouncil(INTEGRATED, [], 3);
    expect(c).toHaveLength(3);
    expect(new Set(c.map((s) => s.id)).size).toBe(3);
    expect(c.some((s) => s.id === "integrated")).toBe(false);
  });

  it("puts the chosen lead scholar first", () => {
    const winnicott = getScholarById("winnicott")!;
    const c = selectCouncil(winnicott, [], 3);
    expect(c[0].id).toBe("winnicott");
  });

  it("prefers scholars whose domains match the child", () => {
    // attachment-heavy child → Bowlby (attachment_regulation) should be on the council
    const c = selectCouncil(INTEGRATED, ["attachment_regulation"], 3);
    expect(c.map((s) => s.id)).toContain("bowlby");
  });

  it("falls back to a sensible relationship-first triad with no domain signal", () => {
    const c = selectCouncil(INTEGRATED, [], 3);
    expect(c.map((s) => s.id)).toEqual(["bowlby", "vygotsky", "bronfenbrenner"]);
  });
});
