import { describe, expect, it } from "vitest";
import { buildNewChildInput } from "./childProfileInput";

describe("buildNewChildInput", () => {
  it("stores months-precise age, approximate birthDate, and optional gender from Add Child", () => {
    const input = buildNewChildInput({
      name: " Lenny ",
      ageMonths: 13,
      gender: "boy",
      languages: ["Hebrew"],
      strengthsText: "curious\nkind",
      challengesText: "sleep transitions",
      now: new Date("2026-06-15T12:00:00Z"),
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
      now: new Date("2026-06-15T12:00:00Z"),
    });

    expect(input.name).toBe("New Child");
    expect(input.age).toBe(0);
    expect(input.ageMonths).toBe(0);
    expect(input.birthDate).toBe("2026-06-01");
    expect(input.gender).toBe("unspecified");
    expect(input.languages).toEqual(["English"]);
  });
});
