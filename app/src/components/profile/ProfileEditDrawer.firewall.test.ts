/**
 * CI-29 clinical-gate guard — the child-interest WRITE boundary.
 *
 * Standing constraint: a condition name or clinical noun must never be PERSISTED
 * to `ChildProfile.interests[]`. The reason the write boundary (not just display)
 * is the line that matters: `exportChildData` returns `profile: child` verbatim
 * (app/src/lib/childData.ts), so any token stored on the profile is reproduced in
 * the child's GDPR export. A display-time sanitize in the play selector is
 * defense-in-depth; it cannot un-persist a stored word.
 *
 * History: `sanitizeInterestToken` shipped in app/src/playbank/select.ts with the
 * CONDITIONS + banned-clinical-noun lexicons and passing unit tests — but the
 * ProfileEditDrawer call site was never wired. `addCustomInterest` took raw
 * `interestInput.trim()` into state and `save()` persisted `interests:
 * activeInterests` unsanitized, so a parent typing "autism" as a custom interest
 * wrote a clinical token onto the child record, and into the export.
 *
 * This is a ProgressNarrative.firewall.test.ts-style SOURCE + BEHAVIOUR scan.
 * The negative-control half feeds the scanners the VERBATIM pre-fix lines, so the
 * guard can never rot into a vacuous pass.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sanitizeInterestToken } from "../../playbank/select";

const here = path.dirname(fileURLToPath(import.meta.url));
const rawSrc = readFileSync(path.join(here, "ProfileEditDrawer.tsx"), "utf8");
/** Comments explain the ban, so they legitimately quote the banned shapes. Only
 *  code + string literals are scanned. */
const src = rawSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* ── Required mechanism: sanitize at BOTH entry and write ──────────────────── */
const M_IMPORTS_GUARD = /import\s*\{[^}]*\bsanitizeInterestToken\b[^}]*\}\s*from\s*["'][^"']*playbank\/select["']/;
const M_ENTRY_SANITIZED = /sanitizeInterestToken\(\s*interestInput/;
const M_WRITE_SANITIZED = /interests:\s*activeInterests\s*\.map\(\s*sanitizeInterestToken\s*\)\s*\.filter\(/;

/* ── Banned mechanism: raw parent text reaching state or the persist call ──── */
const B_RAW_WRITE = /interests:\s*activeInterests\s*,/;
const B_RAW_ENTRY = /setActiveInterests\(\s*\(prev\)\s*=>\s*\[\s*\.\.\.prev,\s*trimmed\s*\]\s*\)/;

/* ── Negative controls: verbatim pre-fix fixtures ──────────────────────────── */
const OLD_ENTRY_LINES = [
  '    const trimmed = interestInput.trim().slice(0, 40);',
  '    if (!trimmed || activeInterests.includes(trimmed)) { setInterestInput(""); return; }',
  '    setActiveInterests((prev) => [...prev, trimmed]);',
].join("\n");
const OLD_WRITE_LINE = "        interests: activeInterests,";

describe("firewall guard — the scanners still catch the OLD unsanitized write", () => {
  it("catches the pre-fix persist line", () => {
    expect(B_RAW_WRITE.test(OLD_WRITE_LINE)).toBe(true);
    expect(M_WRITE_SANITIZED.test(OLD_WRITE_LINE)).toBe(false);
  });

  it("catches the pre-fix entry path putting raw text into state", () => {
    expect(B_RAW_ENTRY.test(OLD_ENTRY_LINES)).toBe(true);
    expect(M_ENTRY_SANITIZED.test(OLD_ENTRY_LINES)).toBe(false);
  });

  it("the banned write regex does NOT fire on the sanitized form", () => {
    const fixed = "        interests: activeInterests.map(sanitizeInterestToken).filter(Boolean),";
    expect(B_RAW_WRITE.test(fixed)).toBe(false);
    expect(M_WRITE_SANITIZED.test(fixed)).toBe(true);
  });

  it("the pre-fix lines are exactly what the current source no longer contains", () => {
    expect(src).not.toContain(OLD_WRITE_LINE);
    expect(src).not.toContain("[...prev, trimmed]");
  });
});

describe("firewall guard — ProfileEditDrawer sanitizes at entry AND at write", () => {
  it("imports the guard from the playbank selector (one lexicon, not a copy)", () => {
    expect(src).toMatch(M_IMPORTS_GUARD);
  });

  it("sanitizes the parent's free-text token at entry", () => {
    expect(src).toMatch(M_ENTRY_SANITIZED);
  });

  it("re-sanitizes the whole array at the persist boundary", () => {
    expect(src).toMatch(M_WRITE_SANITIZED);
  });

  it("never persists the raw state array", () => {
    expect(src).not.toMatch(B_RAW_WRITE);
    expect(src).not.toMatch(B_RAW_ENTRY);
  });
});

describe("firewall guard — the lexicon actually blocks what this surface must block", () => {
  // Behavioural half: proves the wired function rejects clinical tokens, so the
  // source scan above is guarding something real rather than a no-op call.
  const MUST_BLOCK = [
    "autism", "Autism", "autistic", "ADHD", "adhd", "asperger", "OCD",
    "anxiety disorder", "dyslexia", "developmental delay", "PTSD", "tourette",
    "restricted interests", "fixation", "obsession", "hyperfocus",
    "special interest", "stimming", "perseveration", "preoccupation",
  ];
  const MUST_KEEP = ["Trains", "Dinosaurs", "Space", "Cooking", "Trucks", "Music", "רכבות"];

  for (const token of MUST_BLOCK) {
    it(`blocks "${token}" from ever being persisted`, () => {
      expect(sanitizeInterestToken(token)).toBe("");
    });
  }

  for (const token of MUST_KEEP) {
    it(`keeps the ordinary interest "${token}"`, () => {
      expect(sanitizeInterestToken(token)).toBe(token);
    });
  }

  it("drops a clinical token out of a mixed array the way the write path does", () => {
    const stored = ["Trains", "autism", "Space", "restricted interests"];
    expect(stored.map(sanitizeInterestToken).filter(Boolean)).toEqual(["Trains", "Space"]);
  });
});
