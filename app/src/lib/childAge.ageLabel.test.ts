/**
 * GP-01 / MOB-32 / GP-03 / MOB-04 — the child's age is rendered ONLY through
 * `ageLabel()` (months-precise), and an age edit writes all three age fields.
 *
 * Why this guard exists: `ageLabel()` shipped with ZERO call sites while nine
 * parent-facing surfaces printed the legacy whole-years `profile.age` — a
 * 7-month-old read "Age 0" in the topbar, the switcher, the profile, the
 * language lab and the clinician printable. Its i18n keys also carried
 * `{plural}` tokens the translator never resolved ("9 month{plural}").
 *
 * Three halves:
 *  1. Behaviour through the REAL dictionary (`translate`): 7 months, 18
 *     months, 4 years in EN + HE — never "Age 0", never a stray `{plural}`.
 *  2. Source scan: no parent-facing .tsx renders `<x>.age` directly (JSX
 *     text interpolation, `age ${x.age}` templates, or `t(…, { age: x.age })`).
 *     Negative control = the verbatim pre-fix Shell line.
 *  3. The drawer's patch builder: changing the age MUST change
 *     `ageMonthsFromProfile(patched)` (the old `{ age }`-only patch did not).
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ChildProfile } from "../types";
import { ageLabel, ageLabelForMonths, ageMonthsFromProfile, agePatchFromMonths } from "./childAge";
import { translate, type UiLang } from "./i18n";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..");

const NOW = new Date("2026-09-03T12:00:00.000Z");

function profile(over: Partial<ChildProfile> = {}): ChildProfile {
  return {
    id: "c1",
    name: "Lior",
    age: 0,
    languages: ["Hebrew"],
    schoolContext: "",
    strengths: [],
    challenges: [],
    riskLevel: "Low",
    ...over,
  };
}

const tFor = (lang: UiLang) => (key: string, vars?: Record<string, number>) => translate(lang, key, vars);

describe("GP-01 — ageLabel through the real dictionary", () => {
  const cases: Array<[number, string, string]> = [
    [7, "7 months", "7 חודשים"],
    [1, "1 month", "חודש אחד"],
    [18, "1 year 6 months", "שנה ו-6 חודשים"],
    [13, "1 year 1 month", "שנה וחודש"],
    [24, "2 years", "שנתיים"],
    [48, "4 years", "4 שנים"],
    [50, "4 years 2 months", "4 שנים ו-2 חודשים"],
  ];
  for (const [months, en, he] of cases) {
    it(`${months} months → EN "${en}" / HE "${he}"`, () => {
      const p = profile({ ageMonths: months, age: Math.floor(months / 12) });
      expect(ageLabel(p, tFor("en"), NOW)).toBe(en);
      expect(ageLabel(p, tFor("he"), NOW)).toBe(he);
      // The no-shim default is the EN string.
      expect(ageLabel(p, undefined, NOW)).toBe(en);
    });
  }

  it("never prints the whole-years 'Age 0' for an infant and never leaks a {plural} token", () => {
    const infant = profile({ ageMonths: 7, age: 0 });
    for (const lang of ["en", "he"] as const) {
      const label = ageLabel(infant, tFor(lang), NOW);
      expect(label).not.toMatch(/\b0\b/);
      expect(label).not.toMatch(/\{m?plural\}/);
      expect(label).not.toMatch(/\{[a-z]+\}/);
    }
  });

  it("prefers birthDate over ageMonths over the legacy years (the B0 spine)", () => {
    expect(ageLabel(profile({ birthDate: "2026-02-03", ageMonths: 40, age: 3 }), undefined, NOW)).toBe("7 months");
    expect(ageLabel(profile({ ageMonths: 18, age: 5 }), undefined, NOW)).toBe("1 year 6 months");
    expect(ageLabel(profile({ age: 4 }), undefined, NOW)).toBe("4 years");
  });

  it("the age.* dictionary carries no unresolved {plural}/{mplural} tokens in either language", () => {
    for (const lang of ["en", "he"] as const) {
      for (const key of ["age.month1", "age.months", "age.year", "age.years2", "age.years", "age.yearMonth1", "age.yearMonths", "age.yearsMonth1", "age.yearsMonths"]) {
        const v = translate(lang, key, { n: 3, m: 3 });
        expect(v, `${lang}:${key} unresolved`).not.toBe(key);
        expect(v, `${lang}:${key} leaks a plural token`).not.toMatch(/\{m?plural\}/);
      }
    }
  });

  it("ageLabelForMonths rounds and clamps", () => {
    expect(ageLabelForMonths(12.2)).toBe("1 year");
    expect(ageLabelForMonths(-3)).toBe("0 months");
  });
});

/* ── Source scan ───────────────────────────────────────────────────────────── */

/** Parent-facing renders of the legacy whole-years field. Prop passes such as
 *  `ageYears={childProfile.age}` (a NUMBER for band selection) are data flow,
 *  not a render, and are deliberately NOT matched. */
export const AGE_RENDER_PATTERNS: ReadonlyArray<{ id: string; re: RegExp }> = [
  // JSX text interpolation: `… {childProfile.age}` (not `prop={x.age}`)
  { id: "jsx-text", re: /[^=]\{\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\.age\s*\}/ },
  // Template literal: `age ${childProfile.age}`
  { id: "template", re: /\$\{\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\.age\s*\}/ },
  // Translator var: t("…", { …, age: childProfile.age, … })
  { id: "t-var", re: /\bt\(\s*["'`][^"'`]+["'`]\s*,\s*\{[^}]*\bage:\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\.age\b/ },
];

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Lane G could not edit these files (other lanes own them). Each entry is the
 * exact offending line; the entry MUST be deleted when the line is fixed
 * (shrink-only — an entry whose line is gone fails the test). No new entry may
 * be added: the target state is an EMPTY list.
 */
// Wave T close-out: the four cross-lane renders were converted to ageLabel()
// by the orchestrator; the debt list is now EMPTY and must stay empty.
const CROSS_LANE_DEBT: ReadonlyArray<{ file: string; line: string }> = [];

describe("GP-01 — source scan: no parent-facing .tsx renders the whole-years `.age` field", () => {
  const files = walk(path.join(SRC, "components"));

  it("scans a real corpus", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("NEGATIVE CONTROL: the pre-fix Shell / Copilot / ChildProfile lines are caught", () => {
    const oldShell = '<strong style={{ color: "var(--arbor-ink)" }}>{childProfile.name} · {t("top.age")} {childProfile.age}</strong>';
    const oldCopilot = "<SectionCard title={`Domain picture — age ${childProfile.age}`} icon={<Icon name=\"monitoring\" size={20} />} tone=\"mint\">";
    const oldProfile = '<SectionCard title={t("cp.ch.who", { name: first, age: childProfile.age })} icon={<Icon name="person" size={20} />} tone="mint">';
    expect(AGE_RENDER_PATTERNS.some((p) => p.re.test(oldShell))).toBe(true);
    expect(AGE_RENDER_PATTERNS.some((p) => p.re.test(oldCopilot))).toBe(true);
    expect(AGE_RENDER_PATTERNS.some((p) => p.re.test(oldProfile))).toBe(true);
    // A numeric prop pass is NOT a render and must not be flagged.
    expect(AGE_RENDER_PATTERNS.some((p) => p.re.test("<MemoryMatch data={data} childAge={childProfile.age} />"))).toBe(false);
    expect(AGE_RENDER_PATTERNS.some((p) => p.re.test("ageYears={childProfile.age}"))).toBe(false);
  });

  it("every render of `.age` outside lib/childAge.ts is gone (or is a listed, shrink-only cross-lane debt line)", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = path.relative(SRC, file).replace(/\\/g, "/");
      const code = stripComments(readFileSync(file, "utf8"));
      for (const line of code.split(/\r?\n/)) {
        if (!AGE_RENDER_PATTERNS.some((p) => p.re.test(line))) continue;
        const debt = CROSS_LANE_DEBT.find((d) => d.file === rel && line.includes(d.line));
        if (!debt) offenders.push(`${rel}: ${line.trim()}`);
      }
    }
    expect(offenders, `whole-years age renders:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("the cross-lane debt list only shrinks: every entry still matches its file, or must be deleted", () => {
    for (const d of CROSS_LANE_DEBT) {
      const code = readFileSync(path.join(SRC, d.file), "utf8");
      expect(code, `${d.file} no longer contains "${d.line}" — delete the debt entry`).toContain(d.line);
    }
    expect(CROSS_LANE_DEBT.length).toBeLessThanOrEqual(4);
  });

  it("the nine GP-01 sites in lane G's files call ageLabel()", () => {
    for (const rel of [
      "components/layout/Shell.tsx",
      "components/layout/TopbarKidSwitcher.tsx",
      "components/profile/ProfileSwitcher.tsx",
      "components/profile/FamilyGlanceCard.tsx",
      "components/practice/DevelopmentCopilot.tsx",
      "components/sections/ChildProfile.tsx",
      "components/sections/Screening.tsx",
      "components/tabs/LanguageLabTab.tsx",
      "components/tabs/DailyPlayTab.tsx",
    ]) {
      const code = stripComments(readFileSync(path.join(SRC, rel), "utf8"));
      expect(code, `${rel} does not render through ageLabel()`).toMatch(/\bageLabel\(/);
    }
    const drawer = stripComments(readFileSync(path.join(SRC, "components/profile/ProfileEditDrawer.tsx"), "utf8"));
    expect(drawer).toMatch(/\bageLabelForMonths\(/);
  });
});

/* ── GP-03 / MOB-04 — the age patch builder ────────────────────────────────── */

describe("GP-03 — agePatchFromMonths writes { birthDate, ageMonths, age } from ONE months value", () => {
  it("changing the age CHANGES ageMonthsFromProfile(patched)", () => {
    const before = profile({ birthDate: "2023-09-01", ageMonths: 36, age: 3 });
    expect(ageMonthsFromProfile(before, NOW)).toBe(36);
    const patched = { ...before, ...agePatchFromMonths(48, NOW) };
    expect(ageMonthsFromProfile(patched, NOW)).toBe(48);
    expect(patched.age).toBe(4);
    expect(patched.ageMonths).toBe(48);
    expect(patched.birthDate).toBe("2022-09-01");
  });

  it("NEGATIVE CONTROL: the pre-fix `{ age }`-only patch leaves the months spine stale", () => {
    const before = profile({ birthDate: "2023-09-01", ageMonths: 36, age: 3 });
    const stale = { ...before, age: 4 }; // what save() used to write
    expect(ageMonthsFromProfile(stale, NOW)).toBe(36);
    expect(stale.age).toBe(4);
  });

  it("round-trips an infant age without collapsing to a whole year", () => {
    const patched = { ...profile(), ...agePatchFromMonths(7, NOW) };
    expect(ageMonthsFromProfile(patched, NOW)).toBe(7);
    expect(patched.age).toBe(0);
    expect(ageLabel(patched, undefined, NOW)).toBe("7 months");
  });

  it("clamps garbage to a sane range", () => {
    expect(agePatchFromMonths(-5, NOW).ageMonths).toBe(0);
    expect(agePatchFromMonths(999, NOW).ageMonths).toBe(216);
    expect(agePatchFromMonths(Number.NaN, NOW).ageMonths).toBe(0);
  });

  it("the drawer's save() goes through the builder and never patches `age` alone", () => {
    const code = stripComments(readFileSync(path.join(SRC, "components/profile/ProfileEditDrawer.tsx"), "utf8"));
    expect(code).toMatch(/agePatchFromMonths\(ageMonths\)/);
    // The pre-fix shape: a bare `age,` shorthand inside the updateChild patch.
    expect(code).not.toMatch(/updateChild\([^)]*\{\s*\n?\s*name:[^}]*\n\s*age,\n/);
    expect(code).not.toMatch(/type="range"/);
  });
});
