import { describe, it, expect } from "vitest";
import { resolveScholar, SCHOLARS } from "./scholars";

describe("scholar registry (D1)", () => {
  it("every advertised scholar is backed by at least one knowledge card", () => {
    for (const s of SCHOLARS) expect(s.cardIds.length).toBeGreaterThan(0);
  });

  it("every scholar has a real injected method", () => {
    for (const s of SCHOLARS) expect(s.method.length).toBeGreaterThan(40);
  });

  it("resolves free-text lens strings to the canonical scholar", () => {
    expect(resolveScholar("Lev Vygotsky").id).toBe("vygotsky");
    expect(resolveScholar("Vygotskian Scaffolding").id).toBe("vygotsky");
    expect(resolveScholar("Bowlby's Attachment Model").id).toBe("bowlby");
    expect(resolveScholar("Donald Winnicott").id).toBe("winnicott");
    expect(resolveScholar("Maria Montessori").id).toBe("montessori");
    expect(resolveScholar("Jean Piaget").id).toBe("piaget");
    expect(resolveScholar("Integrated Balanced").id).toBe("integrated");
  });

  it("defaults to Integrated for empty/unknown lenses", () => {
    expect(resolveScholar(undefined).id).toBe("integrated");
    expect(resolveScholar("").id).toBe("integrated");
    expect(resolveScholar("something unrelated").id).toBe("integrated");
  });
});
