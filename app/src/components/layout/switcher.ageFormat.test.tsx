/**
 * B-INF-10 guard — the switcher prints each child's own age through the ONE
 * formatter (lib/age/format): months under three ("22 months" / "22 חודשים"),
 * whole years from three ("5 years" / "5 שנים"). The founder's family: Leni,
 * 22 months, and Dylan, 5 years.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { translate, type UiLang } from "../../lib/i18n";
import { formatAgeMonths, formatChildAge } from "../../lib/age/format";
import { SwitcherChildOption } from "./TopbarKidSwitcher";
import type { ChildProfile } from "../../types";

const NOW_ISO = new Date().toISOString().slice(0, 10);
const LENI = { id: "leni", name: "Leni", age: 1, ageMonths: 22, ageMonthsAsOf: NOW_ISO, languages: ["Hebrew"], schoolContext: "", strengths: [], challenges: [], gender: "girl" } as unknown as ChildProfile;
const DYLAN = { id: "dylan", name: "Dylan", age: 5, ageMonths: 62, ageMonthsAsOf: NOW_ISO, languages: ["Hebrew", "English"], schoolContext: "", strengths: [], challenges: [], gender: "boy" } as unknown as ChildProfile;

const tFor = (lang: UiLang) => (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const ageLine = (html: string) => /data-switcher-age[^>]*>([^<]*)</.exec(html)?.[1] ?? "";

describe("B-INF-10 · the switcher prints months under three, years from three", () => {
  const cases: Array<[ChildProfile, UiLang, string]> = [
    [LENI, "en", "22 months"],
    [LENI, "he", "22 חודשים"],
    [DYLAN, "en", "5 years"],
    [DYLAN, "he", "5 שנים"],
  ];
  for (const [child, lang, want] of cases) {
    it(`${child.name} · ${lang} → "${want}"`, () => {
      const html = renderToStaticMarkup(
        React.createElement(SwitcherChildOption, { p: child, active: child.id === "leni", t: tFor(lang), onPick: () => undefined }),
      );
      expect(ageLine(html)).toBe(want);
      expect(text(html)).toContain(child.name);
      // never the old "Age …" prefix and never an age group
      expect(text(html)).not.toMatch(/\bAge\b|גיל|year-olds|1 year 10 months/);
    });
  }

  it("the formatter's edges: 1 month, 35 months, 36 months, no age", () => {
    expect(formatAgeMonths(1)).toBe("1 month");
    expect(formatAgeMonths(35)).toBe("35 months");
    expect(formatAgeMonths(36)).toBe("3 years");
    expect(formatAgeMonths(95)).toBe("7 years");
    expect(formatAgeMonths(22, tFor("he"))).toBe("22 חודשים");
    expect(formatChildAge({ age: undefined as unknown as number })).toBe("");
    // { precise: true } (the packet a clinician reads) adds months from three only
    expect(formatAgeMonths(40, undefined, { precise: true })).toBe("3 years 4 months");
    expect(formatAgeMonths(37, undefined, { precise: true })).toBe("3 years 1 month");
    expect(formatAgeMonths(60, undefined, { precise: true })).toBe("5 years");
    expect(formatAgeMonths(15, undefined, { precise: true })).toBe("15 months");
    expect(formatAgeMonths(40)).toBe("3 years");
  });

  it("the switcher, Today's header, Profile and the packet all read lib/age/format", () => {
    const SRC = path.resolve(__dirname, "../..");
    for (const rel of [
      "components/layout/TopbarKidSwitcher.tsx",
      "components/profile/ProfileSwitcher.tsx",
      "components/tabs/OverviewTab.tsx",
      "components/sections/ChildProfile.tsx",
      "consult/packet.ts",
    ]) {
      const src = readFileSync(path.join(SRC, rel), "utf8");
      expect(src, rel).toMatch(/from "\.\.\/(\.\.\/)?lib\/age\/format"/);
      expect(src, rel).toMatch(/\bformat(ChildAge|AgeMonths)\(/);
    }
    const sw = readFileSync(path.join(SRC, "components/layout/TopbarKidSwitcher.tsx"), "utf8");
    expect(sw).toMatch(/<SwitcherChildOption\s/);
    expect(sw).not.toMatch(/fontSize: "1[01]px"/);
  });
});
