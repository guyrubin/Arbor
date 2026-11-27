// B-SHELL-42 — the tablet strip is truthful: it carries no "Working on" line (the one editable
// focus home is My child; v3 F-SHELL-3 removed the strip button that read the onboarding worry),
// and where it names the child in Hebrew it uses the child's gender, never a slash form.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { translate } from "../../lib/i18n";
import { resolveHebrewSlash } from "../../lib/hebrewSlashGender";

const here = path.dirname(fileURLToPath(import.meta.url));
const strip = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const read = (f: string) => strip(readFileSync(path.join(here, f), "utf8"));
// Everything the sm–lg strip renders: the shell row, its header, the child switcher, the phone dock.
const STRIP = ["Shell.tsx", "ChildContextHeader.tsx", "TopbarKidSwitcher.tsx", "MobileNav.tsx"];

/** A strip source that prints a focus line, or reads the onboarding worry / goals to make one. */
const focusLine = (src: string) =>
  /t\("top\.focus"\)|strip-working-on|elev\.shell\.focus\.|\bchallenges\s*\[\s*0\s*\]|\bfocusGoal\s*\(|\bactiveGoals\b/.test(src);

describe("B-SHELL-42 — the strip's Working on line is gone, everywhere it could come back", () => {
  it("no strip component prints a focus line or reads the worry or the goals", () => {
    for (const f of STRIP) expect(focusLine(read(f)), f).toBe(false);
  });

  it("NEGATIVE CONTROL: the 10 Oct strip button, put back into the real Shell, is caught", () => {
    const shell = read("Shell.tsx");
    const shipped = shell.replace("<SafetyRing />", '<button data-testid="strip-working-on">{t("top.focus")} {profile.challenges[0]}</button>\n              <SafetyRing />');
    expect(shipped).not.toBe(shell);
    expect(focusLine(shipped)).toBe(true);
  });
});

/** Hebrew intake-form slash pairs ("ילד/ה", "פעיל/ה"): Hebrew letters either side of a slash. */
const SLASH = /[א-ת]\/[א-ת]/;
/** Every translation key a strip component names literally (t("…")). */
const stripKeys = (src: string) => [...new Set([...src.matchAll(/\bt\("([A-Za-z0-9_.]+)"/g)].map((m) => m[1]))];
/** The strip's Hebrew strings that still carry a slash pair, for any child. */
const slashed = (lookup: (key: string) => string) =>
  STRIP.flatMap((f) => stripKeys(read(f))).filter((k) => SLASH.test(lookup(k)));

describe("B-SHELL-42 r3 — no slash form in the strip, known gender or not", () => {
  it("every Hebrew string the strip and its switcher name is slash-free", () => {
    const keys = STRIP.flatMap((f) => stripKeys(read(f)));
    expect(keys.length).toBeGreaterThan(15); // sanity: the scan reads real keys
    for (const k of ["aria.switchChild", "aria.activeChildSwitch", "aria.editChildProfile"]) expect(keys).toContain(k);
    expect(slashed((k) => translate("he", k, { name: "Dylan" }))).toEqual([]);
  });

  it("the switcher label is the same neutral sentence for a boy, a girl and an unknown gender", () => {
    const he = translate("he", "aria.activeChildSwitch", { name: "Dylan" });
    expect(he).toContain("Dylan");
    expect(he.endsWith(translate("he", "aria.switchChild"))).toBe(true);
    for (const gender of ["boy", "girl", undefined]) expect(resolveHebrewSlash(he, gender), String(gender)).toBe(he);
    const src = read("TopbarKidSwitcher.tsx");
    expect(src).toContain('const activeChildLabel = t("aria.activeChildSwitch", { name: activeChild.name });');
    expect(src).toContain("aria-label={activeChildLabel}");
    expect(src).toContain("aria-label={switchChild}");
    // EN carries no pairs and is unchanged
    expect(translate("en", "aria.activeChildSwitch", { name: "Dylan" }).replace(/[\u2066-\u2069]/g, "")).toBe("Active child: Dylan. Switch child");
  });

  it("NEGATIVE CONTROL: the 29 Oct tail (\"החלפת ילד/ה\"), put back into the real dictionary, is caught", () => {
    const shipped = (k: string) => (k === "aria.switchChild" ? "החלפת ילד/ה" : translate("he", k, { name: "Dylan" }));
    expect(slashed(shipped)).toEqual(["aria.switchChild"]);
    // and a girl's gendered head with the old generic tail still printed a slash
    const old = resolveHebrewSlash("ילד/ה פעיל/ה: Dylan. ", "girl") + "החלפת ילד/ה";
    expect(SLASH.test(old)).toBe(true);
  });
});
