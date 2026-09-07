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

  /**
   * R16 — the whole CHROME, with no allowlist at all.
   *
   * The scan above carries a frozen allowlist, and an allowlist is exactly how
   * a seam comes back: the sidebar border was fixed once (b41d0acb), the layout
   * was then restructured twice, and the rendered 1280 HE check still measured
   * a physical right border with nothing on the content side. `components/layout`
   * is the shell every route renders inside — one physical offset there is
   * wrong on every screen in Hebrew — so this directory gets a HARD zero that
   * no entry may ever be added to.
   */
  it("components/layout/** has ZERO physical inline offsets — no allowlist", () => {
    const LAYOUT = path.join(COMPONENTS, "layout");
    const offenders: string[] = [];
    for (const file of walk(LAYOUT)) {
      const code = stripComments(fs.readFileSync(file, "utf8"));
      for (const [i, line] of code.split("\n").entries()) {
        if (PHYSICAL.test(line)) offenders.push(`${rel(file)}:${i + 1} → ${line.trim().slice(0, 110)}`);
      }
    }
    expect(offenders, `the shell must be direction-agnostic:\n${offenders.join("\n")}`).toEqual([]);
    // The allowlist may never be used to excuse a layout file.
    for (const r of PHYSICAL_ALLOWLIST) expect(r.startsWith("components/layout/")).toBe(false);
  });

  it("negative control: the pre-fix Sidebar line fails the layout scan", () => {
    // The exact line b41d0acb replaced. Run through the same predicate the
    // scan uses, it is an offender; run the shipped line through, it is not.
    const preFix = `    <aside className="hidden lg:flex" style={{ borderRight: "1px solid var(--arbor-rule)" }}>`;
    const shipped = fs
      .readFileSync(path.join(COMPONENTS, "layout", "Sidebar.tsx"), "utf8")
      .split("\n")
      .find((l) => l.includes("borderInlineEnd:"))!;
    expect(PHYSICAL.test(preFix)).toBe(true);
    expect(PHYSICAL.test(shipped)).toBe(false);
  });

  it("the sidebar stamps the node the rendered acceptance measures", () => {
    // A 1280 HE validator reads the computed border of THIS element rather
    // than whichever <aside> it happened to hit-test at x=1000.
    const sidebar = fs.readFileSync(path.join(COMPONENTS, "layout", "Sidebar.tsx"), "utf8");
    expect(sidebar).toContain('data-testid="app-sidebar"');
    expect(sidebar).toContain('data-arbor-seam="inline-end"');
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


/* ═══════════════════════════════════════════════════════════════════════════
   OBJ-SHELL-03 fix-up (Builder M) — the sidebar seam stays logical in CSS too.

   The scan above covers inline styles in components/**. The defect that
   actually reached a Hebrew parent lived in index.css and was invisible to it:
   the aside borders were ALREADY logical (`border-inline-end`), and a
   `html[dir="rtl"]`-keyed override then re-flipped them by hand, so at 1280 HE
   the sidebar drew its rule on the window edge and NO seam faced the content
   (rendered probe: borderInlineStartWidth 1px / borderInlineEndWidth 0).

   The lesson generalises: a logical border plus a dir-keyed override of it is
   always a physical fix wearing logical clothes, and it is exactly the edit a
   later reader makes when the seam "looks wrong" in one language. So the rule
   is absolute — no `[dir=…]`-keyed rule may set ANY border on `aside`. The
   removed override is pasted below as the negative control.

   Second rule, from the follow-through commit: `aside:last-of-type` targets the
   AI rail, but a lone sidebar is BOTH first- and last-of-type, so the selector
   matched it too and drew a border on both inline edges. Any `:last-of-type`
   aside rule must carry `:not(:first-of-type)`.
   ═══════════════════════════════════════════════════════════════════════════ */

const INDEX_CSS = fs.readFileSync(path.join(SRC, "index.css"), "utf8");

/** Flat (selector, body) pairs — index.css has no nested at-rule blocks. */
function cssRules(css: string): { selector: string; body: string }[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: { selector: string; body: string }[] = [];
  for (const m of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ selector: m[1].trim().replace(/\s+/g, " "), body: m[2] });
  }
  return out;
}

/** Any border declaration — shorthand, physical or logical. */
const SETS_BORDER = /(?:^|;|\s)border(?:-[a-z-]+)?\s*:/;
const DIR_KEYED = /\[dir\s*=/;

/** The exact override removed in OBJ-SHELL-03, as a fixture. */
const REMOVED_OVERRIDE = `html[dir="rtl"] .arbor-app aside:first-of-type {
  border-inline-end: none !important;
  border-inline-start: 1px solid var(--arbor-rule) !important;
}`;

describe("OBJ-SHELL-03 · no dir-keyed border override on the shell asides", () => {
  it("the CSS parser really reads index.css (it finds the aside rules that ARE there)", () => {
    const rules = cssRules(INDEX_CSS);
    expect(rules.length).toBeGreaterThan(100);
    const asideBorders = rules.filter((r) => /\baside\b/.test(r.selector) && SETS_BORDER.test(r.body));
    expect(asideBorders.length, "the two logical aside seam rules must still be found").toBeGreaterThanOrEqual(2);
  });

  it("negative control: the removed RTL override is exactly what this rule rejects", () => {
    const rules = cssRules(REMOVED_OVERRIDE);
    expect(rules).toHaveLength(1);
    expect(DIR_KEYED.test(rules[0].selector)).toBe(true);
    expect(/\baside\b/.test(rules[0].selector)).toBe(true);
    expect(SETS_BORDER.test(rules[0].body)).toBe(true);
    // …and the same parser sees no offence in the logical rule that replaced it.
    const kept = cssRules(`.arbor-app aside:first-of-type { border-inline-end: 1px solid var(--arbor-rule) !important; }`);
    expect(DIR_KEYED.test(kept[0].selector)).toBe(false);
  });

  it("no [dir=…]-keyed rule in index.css sets a border on an aside", () => {
    const offenders = cssRules(INDEX_CSS)
      .filter((r) => DIR_KEYED.test(r.selector) && /\baside\b/.test(r.selector) && SETS_BORDER.test(r.body))
      .map((r) => r.selector);
    expect(
      offenders,
      `a dir-keyed aside border override is back — the aside borders are logical and flip on their own:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("every aside:last-of-type rule excludes the lone sidebar (:not(:first-of-type))", () => {
    const offenders = cssRules(INDEX_CSS)
      .filter((r) => /aside:last-of-type/.test(r.selector) && !/aside:last-of-type[^,{]*:not\(:first-of-type\)/.test(r.selector))
      .map((r) => r.selector);
    expect(
      offenders,
      `a lone sidebar is BOTH first- and last-of-type, so this rule double-borders it:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("negative control: the pre-fix :last-of-type selector fails that same rule", () => {
    const preFix = cssRules(`.arbor-app aside:last-of-type { border-inline-start: 1px solid var(--arbor-rule) !important; }`);
    expect(/aside:last-of-type[^,{]*:not\(:first-of-type\)/.test(preFix[0].selector)).toBe(false);
    const fixed = cssRules(`.arbor-app aside:last-of-type:not(:first-of-type) { border-inline-start: 1px solid var(--arbor-rule) !important; }`);
    expect(/aside:last-of-type[^,{]*:not\(:first-of-type\)/.test(fixed[0].selector)).toBe(true);
  });
});
