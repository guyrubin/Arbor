import { describe, expect, it } from "vitest";
import { ageFromBirth, ageBandFor, createChildProfile, updateChildProfile } from "./children.js";

describe("ageFromBirth (A-01)", () => {
  const now = new Date("2026-06-02T00:00:00Z");
  it("computes whole-year age, accounting for month", () => {
    expect(ageFromBirth("2021-03", now)).toBe(5);
    expect(ageFromBirth("2021-09", now)).toBe(4); // birthday not yet reached
    expect(ageFromBirth("2026-01", now)).toBe(0);
  });
  it("is defensive against bad input", () => {
    expect(ageFromBirth("nonsense", now)).toBe(0);
  });
});

describe("ageBandFor", () => {
  it("maps ages to framework bands", () => {
    expect(ageBandFor(0)).toBe("0-12m");
    expect(ageBandFor(2)).toBe("12-36m");
    expect(ageBandFor(5)).toBe("3-5y");
    expect(ageBandFor(7)).toBe("6-8y");
    expect(ageBandFor(11)).toBe("9-12y");
  });
});

describe("createChildProfile / updateChildProfile", () => {
  it("creates a profile with a derived age and a unique id", () => {
    const a = createChildProfile({ name: "Noa", birthMonthYear: "2022-01" });
    const b = createChildProfile({ name: "Noa", birthMonthYear: "2022-01" });
    expect(a.name).toBe("Noa");
    expect(a.age).toBeGreaterThan(0);
    expect(a.id).not.toBe(b.id);
    expect(a.languages.length).toBeGreaterThan(0);
  });

  it("updates name and language without losing identity", () => {
    const a = createChildProfile({ name: "Noa", age: 4 });
    const updated = updateChildProfile(a, { name: "Noa R.", languages: ["Dutch", "English"] });
    expect(updated.id).toBe(a.id);
    expect(updated.name).toBe("Noa R.");
    expect(updated.languages).toEqual(["Dutch", "English"]);
  });
});
