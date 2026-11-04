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

describe("B-SHELL-42 — no slash form when the child's gender is known", () => {
  it("the switcher genders the active-child sentence only; Switch child stays generic", () => {
    const src = read("TopbarKidSwitcher.tsx");
    expect(src).toContain('const knownGender = activeChild.gender === "boy" || activeChild.gender === "girl";');
    expect(src).toContain("return resolveHebrewSlash(head, activeChild.gender) + switchChild;");
    expect(src).toContain("aria-label={activeChildLabel}");
    expect(src).toContain("aria-label={switchChild}");
    // round 2 (critic P2): the list's own label is never gendered by the active child
    expect(src).not.toMatch(/resolveHebrewSlash\(t\("aria\.switchChild"\)/);
    expect(src).not.toContain('aria-label={t("aria.activeChildSwitch"');
  });

  it("HE reads the boy's and the girl's forms; EN is unchanged", () => {
    const raw = translate("he", "aria.activeChildSwitch", { name: "Dylan" });
    const tail = translate("he", "aria.switchChild");
    expect(raw).toMatch(/[א-ת]\/[א-ת]/); // the shipped string carries the slash pairs
    expect(raw.endsWith(tail)).toBe(true); // the label ends with the generic Switch child
    const label = (gender: string) => resolveHebrewSlash(raw.slice(0, raw.length - tail.length), gender) + tail;
    expect(label("boy")).toContain("ילד פעיל");
    expect(label("girl")).toContain("ילדה פעילה");
    // the active child is gendered; switching keeps the inclusive form over a mixed list
    expect(label("girl").endsWith("החלפת ילד/ה")).toBe(true);
    expect(label("girl").slice(0, -tail.length)).not.toMatch(/[א-ת]\/[א-ת]/);
    const en = translate("en", "aria.activeChildSwitch", { name: "Dylan" });
    expect(resolveHebrewSlash(en, "girl")).toBe(en);
  });
});
