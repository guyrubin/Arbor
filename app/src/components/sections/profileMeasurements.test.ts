import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { translate } from "../../lib/i18n";

/* B-GROWTH-05 — physical measurements leave the Growth hub for Profile's
   Measurements disclosure (spine domain 7). The card itself is unchanged
   (out of scope: redesign, percentiles — never); the pediatrician packet keeps
   reading the same `growthEntries` collection. */

const SRC = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("B-GROWTH-05 — Measurements live on Profile, not on Growth", () => {
  const dev = stripComments(read("components/tabs/DevelopmentTab.tsx"));
  const profile = stripComments(read("components/sections/ChildProfile.tsx"));

  it("DevelopmentTab does not import or mount PhysicalGrowthCard; ChildProfile does", () => {
    expect(dev).not.toContain("PhysicalGrowthCard");
    expect(profile).toContain('import PhysicalGrowthCard from "./PhysicalGrowthCard";');
    expect(profile).toContain("<PhysicalGrowthCard />");
  });

  it("the card sits inside the Measurements disclosure, part of the Who chapter (profile budget unchanged)", () => {
    const open = profile.indexOf('<details data-testid="profile-measurements"');
    const card = profile.indexOf("<PhysicalGrowthCard />");
    const close = profile.indexOf("</details>", open);
    expect(open).toBeGreaterThan(-1);
    expect(card).toBeGreaterThan(open);
    expect(card).toBeLessThan(close);
    // no stamp of its own: the route keeps exactly ONE demotion disclosure
    expect(profile).not.toContain('data-module="profile-measurements"');
    expect((profile.match(/data-module-disclosure=/g) ?? []).length).toBe(1);
    // inside the Who chapter, before the Family Circle
    expect(open).toBeGreaterThan(profile.indexOf('data-module="profile-who"'));
    expect(open).toBeLessThan(profile.indexOf('aria-labelledby="profile-family-title"'));
  });

  it("the disclosure and the card's empty state read in EN and HE", () => {
    for (const key of ["elev.growthTruth.profile.measurements.title", "elev.growthTruth.profile.measurements.sub", "growth.empty.cta"]) {
      const en = translate("en", key);
      const he = translate("he", key);
      expect(en, key).not.toBe(key);
      expect(he, key).toMatch(/[֐-׿]/);
      expect(he, key).not.toMatch(/[A-Za-z]/);
    }
    expect(translate("en", "growth.empty.cta")).toBe("Add first measurement");
  });

  it("the pediatrician packet still reads growthEntries (the collection the card writes)", () => {
    const card = read("components/sections/PhysicalGrowthCard.tsx");
    expect(card).toMatch(/useChildCollection<GrowthEntry>\(childProfile\.id, "growthEntries"/);
    const ask = read("components/sections/AskSpecialist.tsx");
    expect(ask).toMatch(/useChildCollection<GrowthEntry>\(childProfile\.id, "growthEntries"/);
    expect(ask).toContain("growthEntries: growthCol.items.map(");
    const packet = read("consult/packet.ts");
    expect(packet).toContain("if (input.growthEntries?.length) {");
  });

  it("NEGATIVE CONTROL — the pre-fix hub mount trips the scan", () => {
    const preFix = 'import PhysicalGrowthCard from "../sections/PhysicalGrowthCard";\n      <PhysicalGrowthCard />';
    expect(preFix).toContain("PhysicalGrowthCard");
  });
});
