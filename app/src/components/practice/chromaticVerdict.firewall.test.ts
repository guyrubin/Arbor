import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Clinical firewall — no CHROMATIC VERDICT on a parent surface.
 *
 * The standing rule is that parent surfaces never render scores as judgements:
 * no verdict tags, no weakest-domain pointers, and never a colour that means
 * "good" or "bad" about the child.
 *
 * The existing firewall test (DevelopmentCopilot.firewall.test.ts) reads two
 * named files. That is why this shipped: SpeechCoachTab rendered a practice
 * accuracy whose colour flipped at 70% — clay above, yellow below — in both a
 * chip and a progress bar, on the parent-register Practice Studio, for months.
 * Every leak so far has lived off the fixed file list, so this guard scans the
 * whole component tree instead of naming files.
 *
 * What it bans: a ternary whose CONDITION compares a numeric-looking identifier
 * against a threshold and whose BRANCHES are two different colour tokens. That
 * is the exact shape of a graded verdict. A single accent at every value, or a
 * colour chosen by category rather than by score, both pass.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const componentsRoot = path.join(here, "..");

const listTsx = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return listTsx(full);
    return /\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry) ? [full] : [];
  });

/**
 * `<numeric-ish> >=|>|<=|< <number> ? <colour> : <colour>` — the two branches
 * must be DIFFERENT colour tokens, so a ternary that picks the same colour, or
 * picks a width/label, does not trip.
 */
const COLOUR = String.raw`(?:"var\(--arbor-[\w-]+\)"|"#[0-9a-fA-F]{3,8}")`;
const CHROMATIC_VERDICT = new RegExp(
  String.raw`\b(\w*(?:accuracy|score|percent|pct|rate|progress|mastery|level)\w*)\s*(?:>=|<=|>|<)\s*\d+(?:\.\d+)?\s*\?\s*(${COLOUR})\s*:\s*(${COLOUR})`,
  "gi",
);

const offenders = listTsx(componentsRoot).flatMap((file) => {
  const src = readFileSync(file, "utf8");
  return [...src.matchAll(CHROMATIC_VERDICT)]
    .filter((m) => m[2] !== m[3])
    .map((m) => ({ file: path.relative(componentsRoot, file), snippet: m[0] }));
});

describe("clinical firewall — no score-thresholded colour on any component", () => {
  it("negative control: the regex catches the exact shapes that shipped", () => {
    const chip = `style={{ color: on ? "#fff" : st.recentAccuracy >= 70 ? "var(--arbor-clay)" : "var(--arbor-yellow-ink)" }}`;
    const bar = `background: s.recentAccuracy >= 70 ? "var(--arbor-clay)" : "var(--arbor-yellow)"`;
    expect([...chip.matchAll(CHROMATIC_VERDICT)].length).toBe(1);
    expect([...bar.matchAll(CHROMATIC_VERDICT)].length).toBe(1);
  });

  it("negative control: a single accent at every value is allowed", () => {
    const fixed = `background: "var(--arbor-clay)"`;
    const sameBothWays = `s.recentAccuracy >= 70 ? "var(--arbor-clay)" : "var(--arbor-clay)"`;
    expect([...fixed.matchAll(CHROMATIC_VERDICT)].length).toBe(0);
    expect(
      [...sameBothWays.matchAll(CHROMATIC_VERDICT)].filter((m) => m[2] !== m[3]).length,
    ).toBe(0);
  });

  it("the scan actually reaches the practice tree", () => {
    const files = listTsx(componentsRoot).map((f) => path.relative(componentsRoot, f).replace(/\\/g, "/"));
    expect(files).toContain("practice/SpeechCoachTab.tsx");
    expect(files.length).toBeGreaterThan(50);
  });

  it("no component grades a child with colour", () => {
    expect(
      offenders,
      `chromatic verdict(s):\n${offenders.map((o) => `  ${o.file}: ${o.snippet}`).join("\n")}`,
    ).toEqual([]);
  });
});
