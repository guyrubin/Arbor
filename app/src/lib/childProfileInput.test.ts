import { describe, expect, it } from "vitest";
import {
  ageInputFromProfile,
  buildChildAgeFields,
  buildNewChildInput,
  dobBounds,
  isAgeInputComplete,
  isValidBirthDate,
} from "./childProfileInput";

const NOW = new Date("2026-06-15T12:00:00Z");

describe("buildNewChildInput", () => {
  it("stores months-precise age, approximate birthDate, and optional gender from Add Child", () => {
    const input = buildNewChildInput({
      name: " Lenny ",
      ageMonths: 13,
      gender: "boy",
      languages: ["Hebrew"],
      strengthsText: "curious\nkind",
      challengesText: "sleep transitions",
      now: NOW,
    });

    expect(input).toMatchObject({
      name: "Lenny",
      age: 1,
      ageMonths: 13,
      birthDate: "2025-05-01",
      gender: "boy",
      languages: ["Hebrew"],
      strengths: ["curious", "kind"],
      challenges: ["sleep transitions"],
      riskLevel: "Low",
    });
  });

  it("falls back to a safe name, English language, and unspecified gender", () => {
    const input = buildNewChildInput({
      name: " ",
      ageMonths: -4,
      gender: "unspecified",
      languages: [],
      strengthsText: "",
      challengesText: "",
      now: NOW,
    });

    expect(input.name).toBe("New Child");
    expect(input.age).toBe(0);
    expect(input.ageMonths).toBe(0);
    expect(input.birthDate).toBe("2026-06-01");
    expect(input.gender).toBe("unspecified");
    expect(input.languages).toEqual(["English"]);
  });

  it("MOB-10: a Hebrew interface defaults the home language to Hebrew", () => {
    const he = buildNewChildInput({ name: "Noa", ageMonths: 40, gender: "girl", languages: [], strengthsText: "", challengesText: "", uiLang: "he", now: NOW });
    expect(he.languages).toEqual(["Hebrew"]);
    const en = buildNewChildInput({ name: "Noa", ageMonths: 40, gender: "girl", languages: [], strengthsText: "", challengesText: "", uiLang: "en", now: NOW });
    expect(en.languages).toEqual(["English"]);
  });

  it("MOB-11: a ChildAgeField DOB value wins over the legacy months and is stored exactly", () => {
    const input = buildNewChildInput({
      name: "Noa",
      age: { mode: "dob", birthDate: "2023-03-15" },
      ageMonths: 99, // ignored
      gender: "girl",
      languages: [],
      strengthsText: "",
      challengesText: "",
      now: NOW,
    });
    expect(input).toMatchObject({ birthDate: "2023-03-15", ageMonths: 39, age: 3 });
  });
});

describe("buildChildAgeFields — the ONE age builder (MOB-11 / GP-03)", () => {
  it("DOB round-trips to the DAY (no fabricated day-01), months + years derived from it", () => {
    const fields = buildChildAgeFields({ mode: "dob", birthDate: "2023-03-15" }, NOW);
    expect(fields).toEqual({ birthDate: "2023-03-15", ageMonths: 39, age: 3 });
    // the day-of-month rule: born on the 20th → not yet 39 months on the 15th
    expect(buildChildAgeFields({ mode: "dob", birthDate: "2023-03-20" }, NOW)).toEqual({ birthDate: "2023-03-20", ageMonths: 38, age: 3 });
  });

  it("negative control: the pre-MOB-11 path (months only) fabricates day 01 — the DOB path must not", () => {
    const viaMonths = buildChildAgeFields({ mode: "age", ageMonths: 39 }, NOW);
    expect(viaMonths.birthDate).toBe("2023-03-01");
    expect(viaMonths.birthDate).not.toBe("2023-03-15");
  });

  it("age mode: clamps to 0..216 months and fills all three fields", () => {
    expect(buildChildAgeFields({ mode: "age", ageMonths: 13 }, NOW)).toEqual({ birthDate: "2025-05-01", ageMonths: 13, age: 1 });
    expect(buildChildAgeFields({ mode: "age", ageMonths: 999 }, NOW).ageMonths).toBe(216);
    expect(buildChildAgeFields({ mode: "age", ageMonths: -3 }, NOW)).toEqual({ birthDate: "2026-06-01", ageMonths: 0, age: 0 });
  });

  it("an empty / out-of-range DOB is incomplete and resolves to a newborn rather than throwing", () => {
    expect(isAgeInputComplete({ mode: "dob", birthDate: "" }, NOW)).toBe(false);
    expect(isAgeInputComplete({ mode: "dob", birthDate: "2027-01-01" }, NOW)).toBe(false); // future
    expect(isAgeInputComplete({ mode: "dob", birthDate: "2000-01-01" }, NOW)).toBe(false); // > 18y
    expect(isAgeInputComplete({ mode: "dob", birthDate: "2023-03-15" }, NOW)).toBe(true);
    expect(isAgeInputComplete({ mode: "age", ageMonths: 0 }, NOW)).toBe(true);
    expect(buildChildAgeFields({ mode: "dob", birthDate: "" }, NOW)).toEqual({ birthDate: "2026-06-01", ageMonths: 0, age: 0 });
  });

  it("dobBounds = today back to today − 18 years (the native picker's min/max)", () => {
    expect(dobBounds(NOW)).toEqual({ min: "2008-06-15", max: "2026-06-15" });
    expect(isValidBirthDate("2008-06-15", NOW)).toBe(true);
    expect(isValidBirthDate("2008-06-14", NOW)).toBe(false);
    expect(isValidBirthDate("2026-06-16", NOW)).toBe(false);
    expect(isValidBirthDate("not-a-date", NOW)).toBe(false);
  });
});

describe("ageInputFromProfile — seeding the field from a stored profile", () => {
  it("an exact stored DOB comes back as DOB mode", () => {
    expect(ageInputFromProfile({ birthDate: "2023-03-15", ageMonths: 39, age: 3 }, NOW)).toEqual({ mode: "dob", birthDate: "2023-03-15" });
  });

  it("an approximate (day-01) DOB is offered as an age, months recomputed from the date", () => {
    expect(ageInputFromProfile({ birthDate: "2023-03-01", ageMonths: 39, age: 3 }, NOW)).toEqual({ mode: "age", ageMonths: 39 });
  });

  it("legacy profiles: ageMonths, then whole years × 12", () => {
    expect(ageInputFromProfile({ ageMonths: 20, age: 1 }, NOW)).toEqual({ mode: "age", ageMonths: 20 });
    expect(ageInputFromProfile({ age: 4 }, NOW)).toEqual({ mode: "age", ageMonths: 48 });
  });
});
