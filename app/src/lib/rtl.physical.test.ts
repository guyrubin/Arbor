import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * OBJ-SHELL-03 / CR-13 — physical offsets and unmirrored directional glyphs.
 *
 * A physical inline offset (`borderRight`, `marginLeft`, …) does not flip with
 * `dir="rtl"`, so a seam drawn that way simply disappears in Hebrew: the
 * sidebar/content border at 1280 sat on the wrong edge and was invisible. The
 * logical properties (`borderInlineEnd`, `marginInlineStart`, …) flip for free.
 *
 * Part 1 is a hard scan with a named, shrink-only allowlist of the two sites
 * that belong to other files in this wave. Part 2 is a ceiling ratchet on
 * directional glyphs rendered with no mirror hint: it can only ever go down.
 */

const SRC = path.resolve(__dirname, "..");
const COMPONENTS = path.join(SRC, "components");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const rel = (f: string) => path.relative(SRC, f).split(path.sep).join("/");

/** Inline style keys that do not respond to `dir`. */
const PHYSICAL = /\b(borderRight|borderLeft|marginLeft|marginRight|paddingLeft|paddingRight)\s*:/;

/**
 * Sites owned by other files in this wave. FROZEN: entries may only ever LEAVE
 * this list. A new file must never appear here.
 *  - ProfileEditDrawer.tsx: the drawer's leading edge border (same defect).
 *  - HeroCrest.tsx: a negative marginLeft used for avatar-chip overlap, which
 *    is a visual stack, not a reading-order offset — still physical.
 */
const PHYSICAL_ALLOWLIST = new Set([
  "components/profile/ProfileEditDrawer.tsx",
  "components/ui/HeroCrest.tsx",
]);

describe("CR-13 · no physical inline offsets on layout seams", () => {
  it("negative control: the pre-fix Sidebar border is exactly what the scan rejects", () => {
    const PRE_FIX = `style={{ borderRight: "1px solid var(--arbor-rule)" }}`;
    expect(PHYSICAL.test(PRE_FIX)).toBe(true);
    expect(PHYSICAL.test(PRE_FIX.replace("borderRight", "borderInlineEnd"))).toBe(false);
  });

  it("components/** carry no physical inline offsets outside the frozen allowlist", () => {
    const offenders: string[] = [];
    for (const file of walk(COMPONENTS)) {
      const r = rel(file);
      if (PHYSICAL_ALLOWLIST.has(r)) continue;
      const code = stripComments(fs.readFileSync(file, "utf8"));
      for (const [i, line] of code.split("\n").entries()) {
        if (PHYSICAL.test(line)) offenders.push(`${r}:${i + 1} → ${line.trim().slice(0, 110)}`);
      }
    }
    expect(offenders, `physical offsets found — use borderInlineEnd/Start, marginInlineStart/End:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("the Sidebar and AiRail seams are logical", () => {
    const sidebar = fs.readFileSync(path.join(COMPONENTS, "layout", "Sidebar.tsx"), "utf8");
    const rail = fs.readFileSync(path.join(COMPONENTS, "layout", "AiRail.tsx"), "utf8");
    expect(sidebar).toContain('borderInlineEnd: "1px solid var(--arbor-rule)"');
    expect(sidebar).not.toContain("borderRight:");
    expect(rail).toContain('borderInlineStart: "1px solid var(--arbor-rule)"');
    expect(rail).not.toContain("borderLeft:");
  });

  it("the allowlist only shrinks (each entry still exists and still needs it)", () => {
    for (const r of PHYSICAL_ALLOWLIST) {
      const full = path.join(SRC, r);
      expect(fs.existsSync(full), `${r} no longer exists — remove it from PHYSICAL_ALLOWLIST`).toBe(true);
      const code = stripComments(fs.readFileSync(full, "utf8"));
      expect(PHYSICAL.test(code), `${r} is clean now — delete it from PHYSICAL_ALLOWLIST so it stays clean`).toBe(true);
    }
  });
});

/**
 * A directional glyph must either be mirrored by CSS (`rtl:-scale-x-100` /
 * `rtl:rotate-180`) or have its ligature swapped per direction
 * (`isRtl ? "chevron_right" : "chevron_left"`, `he ? "arrow_back" : …`).
 * Anything else points the wrong way in Hebrew.
 */
const DIRECTIONAL = /"(arrow_back|arrow_forward|chevron_left|chevron_right)"/;
const MIRRORED = /rtl:-scale-x-100|rtl:rotate-180|isRtl\s*\?|uiLang\s*===\s*"he"\s*\?|\bhe\s*\?/;

function unmirroredDirectionalSites(): string[] {
  const out: string[] = [];
  for (const file of walk(COMPONENTS)) {
    const code = stripComments(fs.readFileSync(file, "utf8"));
    for (const [i, line] of code.split("\n").entries()) {
      if (DIRECTIONAL.test(line) && !MIRRORED.test(line)) out.push(`${rel(file)}:${i + 1}`);
    }
  }
  return out;
}

/** Post-fix count at OBJ-SHELL-03. RATCHET: lower it when you fix more; an
 *  increase is a new unmirrored glyph and must fail. */
/* OBJ-TODAY-08 (Builder E1): the Day Windows and Smart Reminders back arrows
   both carried `msr` only — computed transform `none` under dir=rtl, so "Back
   to Today" pointed forward for a Hebrew parent on two of the three Today
   tools. Both are mirrored now, so the ceiling drops 22 -> 20. The tree
   measured 19 when this landed, but a concurrent builder's RTL work was
   uncommitted in it, so 20 is the number this commit can actually vouch for. */
const UNMIRRORED_CEILING = 20;

describe("CR-13 · directional glyph ratchet", () => {
  it("negative control: an unmirrored chevron is what the scan counts", () => {
    const line = `<Icon name="chevron_right" size={18} />`;
    expect(DIRECTIONAL.test(line) && !MIRRORED.test(line)).toBe(true);
    const fixed = `<Icon name="chevron_right" size={18} className="rtl:-scale-x-100" />`;
    expect(DIRECTIONAL.test(fixed) && !MIRRORED.test(fixed)).toBe(false);
  });

  it("the count of unmirrored directional glyphs never rises", () => {
    const sites = unmirroredDirectionalSites();
    expect(
      sites.length,
      `unmirrored directional glyphs rose to ${sites.length} (ceiling ${UNMIRRORED_CEILING}):\n${sites.join("\n")}`
    ).toBeLessThanOrEqual(UNMIRRORED_CEILING);
  });

  it("the AiRail glyphs are mirrored", () => {
    const rail = fs.readFileSync(path.join(COMPONENTS, "layout", "AiRail.tsx"), "utf8");
    for (const line of rail.split("\n")) {
      if (DIRECTIONAL.test(line)) expect(MIRRORED.test(line), `unmirrored in AiRail: ${line.trim()}`).toBe(true);
    }
  });
});
