import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * TODAY-5 / PLAT-4 / CODEX-6 — anti-regression guard for the i18n registry
 * migration (2026-07-23 next-level wave 3).
 *
 * The standing constraint routes ALL UI copy through app/src/lib/i18n.ts so
 * the en/he parity test (i18n.test.ts) is the HE/EN enforcement mechanism.
 * The banned pattern is the inline per-language copy object/string:
 *
 *   const copy = uiLang === "he" ? { ... } : { ... };
 *   const copy = he ? { ... } : { ... };
 *   uiLang === "he" ? "טקסט בעברית" : "English copy"
 *
 * Such copy is invisible to the parity guard and to translation tooling, so a
 * dropped HE string silently falls back to English and never fails CI. Locale
 * SWITCHES (`uiLang === "he" ? "he-IL" : "en-US"`, dir/icon flips) carry no
 * Hebrew-script literal and stay allowed.
 */

const SRC_ROOT = path.resolve(__dirname, "..");
const COMPONENTS = path.join(SRC_ROOT, "components");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

// Drop /* */ and // comments so prose about the rule can't trip the scans.
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

type Offender = { file: string; line: number; text: string };

/**
 * Pre-existing kid-world / academy surfaces that still carry inline HE string
 * ternaries (kid register; HE copy sits behind the native transcreation gate).
 * FROZEN: files may only ever LEAVE this list (migrate → delete the entry).
 * The copy-OBJECT check below has NO allowlist — that pattern is banned
 * everywhere. New files must never appear here.
 */
const LEGACY_INLINE_HE_FILES = new Set([
  "components/sections/FamilyFormation.tsx",
  "components/sections/Masterclasses.tsx",
  "components/tabs/BedtimeStoriesTab.tsx",
  "components/tabs/ComicsTab.tsx",
  "components/tabs/HeroJourneyTab.tsx",
  "components/ui/SpeakButton.tsx",
]);

function scan(re: RegExp, opts?: { allowLegacy?: boolean }): Offender[] {
  const offenders: Offender[] = [];
  for (const file of walk(COMPONENTS)) {
    const rel = path.relative(SRC_ROOT, file).split(path.sep).join("/");
    if (opts?.allowLegacy && LEGACY_INLINE_HE_FILES.has(rel)) continue;
    const code = stripComments(fs.readFileSync(file, "utf8"));
    for (const [i, lineText] of code.split("\n").entries()) {
      if (re.test(lineText)) {
        offenders.push({ file: rel, line: i + 1, text: lineText.trim().slice(0, 120) });
      }
    }
  }
  return offenders;
}

const format = (o: Offender[]) => o.map((x) => `${x.file}:${x.line} → ${x.text}`).join("\n");

describe("i18n registry migration stays migrated (TODAY-5/PLAT-4/CODEX-6)", () => {
  it("no inline he-ternary copy OBJECT in components/ (use lib/i18n.ts keys + t())", () => {
    // `= he ? {` / `= uiLang === "he" ? {` — a whole per-language dictionary
    // built inline. Every string inside it bypasses the parity test.
    // NO legacy allowlist: this pattern is banned everywhere.
    const offenders = scan(/=\s*(?:uiLang\s*===\s*["']he["']|he)\s*\?\s*\{/);
    expect(offenders, `inline per-language copy objects found — move the strings to lib/i18n.ts:\n${format(offenders)}`).toEqual([]);
  });

  it("no NEW inline he-ternary TEMPLATE copy in components/ (frozen legacy files only)", () => {
    const offenders = scan(/(?:uiLang\s*===\s*["']he["']|\bhe)\s*\?\s*`/, { allowLegacy: true });
    expect(offenders, `inline per-language template copy found — move the strings to lib/i18n.ts:\n${format(offenders)}`).toEqual([]);
  });

  it("no NEW he-ternary with a Hebrew-script string literal in components/ (locale switches stay allowed)", () => {
    // Catches `uiLang === "he" ? "לשחק יחד" : "Try together"` while allowing
    // `uiLang === "he" ? "he-IL" : "en-US"` (no Hebrew script in the literal).
    const offenders = scan(/(?:uiLang\s*===\s*["']he["']|\bhe)\s*\?\s*(["'])(?:(?!\1).)*[֐-׿]/, { allowLegacy: true });
    expect(offenders, `inline Hebrew copy ternaries found — move the strings to lib/i18n.ts:\n${format(offenders)}`).toEqual([]);
  });

  it("the legacy allowlist only shrinks (every listed file still exists and still needs it)", () => {
    for (const rel of LEGACY_INLINE_HE_FILES) {
      const full = path.join(SRC_ROOT, rel);
      expect(fs.existsSync(full), `${rel} no longer exists — remove it from LEGACY_INLINE_HE_FILES`).toBe(true);
      const code = stripComments(fs.readFileSync(full, "utf8"));
      const stillHasInlineHe = /(?:uiLang\s*===\s*["']he["']|\bhe)\s*\?\s*(?:`|(["'])(?:(?!\1).)*[֐-׿])/.test(code);
      expect(stillHasInlineHe, `${rel} is clean now — delete it from LEGACY_INLINE_HE_FILES so it stays clean`).toBe(true);
    }
  });

  it("the OnboardingFlow progressbar label goes through i18n (ob.progress.step)", () => {
    const src = fs.readFileSync(path.join(COMPONENTS, "auth", "OnboardingFlow.tsx"), "utf8");
    expect(src).toContain('t("ob.progress.step"');
    expect(src).not.toContain("`Step ${step} of ${total}`");
  });
});
