/**
 * ONE icon family in parent mode (Guy, 9 Oct 2026).
 *
 * Every parent-mode interface icon is a Material Symbols Rounded glyph drawn
 * through the shared <Icon name> (components/ui/Icon.tsx). lucide-react survives
 * only inside Kid Mode (components/kidmode/), which is its own register. Two
 * families side by side read as two products: different stroke weights, corner
 * radii and optical sizes on the same screen.
 *
 * Three rules, each with a negative control so the guard is provably not
 * vacuous:
 *   (a) no lucide-react import anywhere in runtime src/ outside Kid Mode;
 *   (b) the three companion places (Now / My child / Together) take their
 *       glyphs from lib/companionPlaces.ts — the desktop Sidebar and the mobile
 *       dock both read it, neither hardcodes a place glyph (they used to
 *       disagree: My child was `person` on desktop and `eco` on the phone);
 *   (c) inside lib/navigation.ts, no two different destinations share a glyph
 *       (School Brief and the Learn hub were both `school`).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SECTIONS, primaryTabOf, type NavSection } from "../../lib/navigation";
import { COMPANION_PLACES } from "../../lib/companionPlaces";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const KID_MODE = "components/kidmode/";
const rel = (p: string) => path.relative(SRC, p).split(path.sep).join("/");
const read = (relPath: string) => readFileSync(path.join(SRC, relPath), "utf8");

/** Runtime source: every .ts/.tsx under src/, tests excluded. */
function runtimeFiles(dir = SRC, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) runtimeFiles(p, out);
    else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

// ── (a) lucide-react imports ────────────────────────────────────────────────

/** Any module reference to lucide-react (or a subpath): static, type-only and
 *  side-effect imports, re-exports, dynamic import() and require(). A bare
 *  mention in prose ("names from lucide-react") is not a reference. */
const LUCIDE_REF = /\b(?:from|import)\s*\(?\s*["']lucide-react(?:\/[^"']*)?["']|\brequire\(\s*["']lucide-react(?:\/[^"']*)?["']\s*\)/;

function lucideOffenders(files: ReadonlyArray<{ rel: string; text: string }>): string[] {
  return files
    .filter((f) => !f.rel.startsWith(KID_MODE) && LUCIDE_REF.test(f.text))
    .map((f) => f.rel)
    .sort();
}

describe("(a) lucide-react lives only in Kid Mode", () => {
  const files = runtimeFiles().map((p) => ({ rel: rel(p), text: readFileSync(p, "utf8") }));

  it("walks the real tree", () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files.map((f) => f.rel)).toContain("components/ui/Icon.tsx");
  });

  it("no runtime file outside components/kidmode/ imports lucide-react", () => {
    expect(
      lucideOffenders(files),
      "parent mode draws icons with <Icon name> (Material Symbols Rounded) only — replace these lucide imports",
    ).toEqual([]);
  });

  it("NEGATIVE CONTROL: every import shape is caught, prose is not, and only Kid Mode is exempt", () => {
    const shapes = [
      'import { X } from "lucide-react";',
      "import type { LucideIcon } from 'lucide-react';",
      'import {\n  Heart,\n  Moon,\n} from "lucide-react";',
      'import "lucide-react";',
      'export { Check } from "lucide-react";',
      'const icons = await import("lucide-react");',
      'const { X } = require("lucide-react");',
      'import X from "lucide-react/dist/esm/icons/x";',
    ];
    for (const text of shapes) {
      expect(lucideOffenders([{ rel: "components/tabs/Fixture.tsx", text }]), text).toEqual(["components/tabs/Fixture.tsx"]);
      expect(lucideOffenders([{ rel: `${KID_MODE}Fixture.tsx`, text }]), text).toEqual([]);
    }
    expect(lucideOffenders([{ rel: "practice/data.ts", text: "/** Icon name from lucide-react, rendered in the grid. */" }])).toEqual([]);
  });
});

// ── (b) one glyph per place ─────────────────────────────────────────────────

const PLACE_GLYPHS = { now: "home", child: "eco", together: "interests" } as const;
const PLACE_TABS = COMPANION_PLACES.map((p) => p.tab as string);

/** The `name` of every <Icon> in `src` between `start` and the first `end`
 *  after it that is NOT the place's own glyph (`place.icon` / `place?.icon`). */
function nonPlaceGlyphs(src: string, start: string, end: string): string[] {
  const from = src.indexOf(start);
  if (from < 0) return [`<block start "${start}" not found>`];
  const to = src.indexOf(end, from + start.length);
  if (to < 0) return [`<block end "${end}" not found>`];
  const block = src.slice(from, to);
  const names = [...block.matchAll(/<Icon\b[^>]*?\bname=(\{[^}]*\}|"[^"]*"|'[^']*')/g)].map((m) => m[1]);
  if (names.length === 0) return ["<no <Icon> in the place block>"];
  return names.filter((n) => !/^\{\s*place\??\.icon\b/.test(n));
}

/** A place glyph written as a literal (`icon: "eco"`, `name="home"`, …) or a
 *  place tab paired with a literal glyph — a second source of truth. */
function hardcodedPlaceGlyphs(src: string): string[] {
  const out: string[] = [];
  const glyphs = new Set<string>(Object.values(PLACE_GLYPHS));
  for (const m of src.matchAll(/["'`]([a-z][a-z0-9_]*)["'`]/g)) if (glyphs.has(m[1])) out.push(m[0]);
  const pair = new RegExp(`tab:\\s*["'](${PLACE_TABS.join("|")})["'][^}]*?\\bicon:\\s*["']([a-z0-9_]+)["']`, "g");
  for (const m of src.matchAll(pair)) out.push(`${m[1]} → ${m[2]}`);
  return out;
}

describe("(b) the three places take their glyphs from companionPlaces.ts", () => {
  const sidebar = read("components/layout/Sidebar.tsx");
  const mobileNav = read("components/layout/MobileNav.tsx");
  const SIDEBAR_BLOCK = ["COMPANION_PLACES.map(", "})}"] as const;
  const DOCK_BLOCK = ["primary.map(", "})}"] as const;

  it("companionPlaces.ts: Now home · My child eco · Together interests", () => {
    expect(Object.fromEntries(COMPANION_PLACES.map((p) => [p.id, p.icon]))).toEqual(PLACE_GLYPHS);
  });

  it("the desktop Sidebar renders each place's own glyph", () => {
    expect(sidebar).toContain('from "../../lib/companionPlaces"');
    expect(nonPlaceGlyphs(sidebar, ...SIDEBAR_BLOCK)).toEqual([]);
  });

  it("the mobile dock renders each place's own glyph, and every dock section IS a place", () => {
    expect(mobileNav).toContain('from "../../lib/companionPlaces"');
    expect(nonPlaceGlyphs(mobileNav, ...DOCK_BLOCK)).toEqual([]);
    // The dock's `?? sec.msIcon` fallback must be unreachable: each dock
    // section's landing tab is a place's tab.
    const ids = mobileNav.match(/PRIMARY_SECTION_IDS\s*=\s*\[([^\]]*)\]/)?.[1].match(/"([a-z-]+)"/g)?.map((s) => s.slice(1, -1)) ?? [];
    expect(ids.length).toBe(3);
    for (const id of ids) {
      const sec = SECTIONS.find((s) => s.id === id);
      expect(sec, `dock section ${id}`).toBeTruthy();
      expect(PLACE_TABS, `dock section ${id} lands on a place`).toContain(primaryTabOf(sec as NavSection));
    }
  });

  it("neither shell file hardcodes a place glyph", () => {
    expect(hardcodedPlaceGlyphs(sidebar)).toEqual([]);
    expect(hardcodedPlaceGlyphs(mobileNav)).toEqual([]);
  });

  it("NEGATIVE CONTROL: a section glyph or a literal in the place block, and a hardcoded place glyph, are caught", () => {
    const ok = `{COMPANION_PLACES.map(place => { return <button><Icon name={place.icon} size={24} /></button>; })}`;
    expect(nonPlaceGlyphs(ok, ...SIDEBAR_BLOCK)).toEqual([]);
    const fromSection = `{primary.map((sec) => { return <button><Icon name={sec.msIcon} size={21} chrome /></button>; })}`;
    expect(nonPlaceGlyphs(fromSection, ...DOCK_BLOCK)).toEqual(["{sec.msIcon}"]);
    const literal = `{COMPANION_PLACES.map(place => { return <Icon name="person" size={24} />; })}`;
    expect(nonPlaceGlyphs(literal, ...SIDEBAR_BLOCK)).toEqual(['"person"']);
    expect(nonPlaceGlyphs("{primary.map(() => { return null; })}", ...DOCK_BLOCK)).toEqual(["<no <Icon> in the place block>"]);
    expect(hardcodedPlaceGlyphs(`const links = [{ tab: "development", icon: "person" }];`)).toEqual(["development → person"]);
    expect(hardcodedPlaceGlyphs(`<Icon name="interests" size={21} />`)).toEqual(['"interests"']);
  });
});

// ── (c) one glyph per destination in navigation.ts ──────────────────────────

/** Glyphs that two DIFFERENT destinations share. A hub's destination is its
 *  landing tab (primaryTabOf), so a hub and its own landing pill may agree. */
function glyphCollisions(sections: readonly NavSection[]): string[] {
  const byGlyph = new Map<string, Set<string>>();
  const add = (glyph: string, dest: string) => {
    if (!byGlyph.has(glyph)) byGlyph.set(glyph, new Set());
    byGlyph.get(glyph)!.add(dest);
  };
  for (const s of sections) {
    add(s.msIcon, primaryTabOf(s));
    for (const it of [...s.items, ...s.primaryTabs, ...s.tools]) add(it.msIcon, it.tab);
  }
  return [...byGlyph]
    .filter(([, dests]) => dests.size > 1)
    .map(([glyph, dests]) => `${glyph}: ${[...dests].sort().join(", ")}`)
    .sort();
}

describe("(c) navigation.ts — one glyph per destination", () => {
  it("every hub, sub-tab and tool pill carries a glyph", () => {
    for (const s of SECTIONS) {
      expect(s.msIcon, s.id).toMatch(/^[a-z][a-z0-9_]+$/);
      for (const it of [...s.items, ...s.primaryTabs, ...s.tools]) expect(it.msIcon, it.tab).toMatch(/^[a-z][a-z0-9_]+$/);
    }
  });

  it("no two different destinations share a glyph", () => {
    expect(glyphCollisions(SECTIONS)).toEqual([]);
  });

  it("NEGATIVE CONTROL: the pre-fix School Brief `school` and a sprout shared by two Growth pills are caught", () => {
    const withGlyph = (tab: string, msIcon: string): NavSection[] =>
      SECTIONS.map((s) => {
        const swap = <T extends { tab: string; msIcon: string }>(list: T[]) => list.map((it) => (it.tab === tab ? { ...it, msIcon } : it));
        return { ...s, items: swap(s.items), primaryTabs: swap(s.primaryTabs), tools: swap(s.tools) };
      });
    expect(glyphCollisions(withGlyph("school-brief", "school"))).toEqual(["school: masterclasses, school-brief"]);
    expect(glyphCollisions(withGlyph("milestones", "eco"))).toEqual(["eco: development, milestones"]);
  });
});
