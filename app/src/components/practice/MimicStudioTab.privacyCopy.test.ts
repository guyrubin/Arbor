import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { translate } from "../../lib/i18n";

const source = readFileSync(new URL("./MimicStudioTab.tsx", import.meta.url), "utf8");

describe("parent mirror privacy explanation", () => {
  it.each(["en", "he"] as const)("resolves the title and full notice in %s", (lang) => {
    for (const key of ["elev.mimic.mirror.privacyTitle", "elev.mimic.mirror.privacyBody"]) {
      const text = translate(lang, key);
      expect(text).not.toBe(key);
      expect(source).toContain(`t("${key}")`);
      if (lang === "he") expect(text).toMatch(/[א-ת]/);
    }
  });
  it("keeps the assurance in the parent register and describes stored practice metadata", () => {
    expect(source).toMatch(/!kidMode && \([\s\S]*?t\("elev\.mimic\.mirror\.privacyTitle"\)[\s\S]*?t\("elev\.mimic\.mirror\.privacyBody"\)/);
    expect(source).not.toContain("> Camera privacy");
    expect(translate("en", "elev.mimic.mirror.privacyBody")).toContain("round, time and the rating");
    expect(translate("en", "elev.mimic.mirror.privacyBody")).not.toContain("Only your star rating");
  });
});
