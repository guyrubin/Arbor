import { describe, expect, it } from "vitest";
import { pickCoRegulationScript, CO_REGULATION_SCRIPTS } from "./coRegulation.js";

describe("pickCoRegulationScript (E-01)", () => {
  it("matches situations from free text", () => {
    expect(pickCoRegulationScript("he keeps getting up and won't sleep at night").id).toBe("bedtime");
    expect(pickCoRegulationScript("rage when I turned off the tablet").id).toBe("screen");
    expect(pickCoRegulationScript("the kids are hitting each other").id).toBe("hitting");
    expect(pickCoRegulationScript("I am completely overwhelmed").id).toBe("overwhelm");
  });

  it("falls back to a safe default for empty or unmatched text", () => {
    expect(pickCoRegulationScript().id).toBe(CO_REGULATION_SCRIPTS[0].id);
    expect(pickCoRegulationScript("xyzzy").id).toBe(CO_REGULATION_SCRIPTS[0].id);
  });

  it("every script has a parent-first action, a script, and an avoid", () => {
    for (const s of CO_REGULATION_SCRIPTS) {
      expect(s.forParent.length).toBeGreaterThan(0);
      expect(s.say.length).toBeGreaterThan(0);
      expect(s.avoid.length).toBeGreaterThan(0);
    }
  });
});
