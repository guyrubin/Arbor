/**
 * PLAT-1 / PLAT-3 guards — one palette for the whole parent shell, and no
 * dead chrome controls.
 *
 * PLAT-1 (split-brain token scope): the shell chrome (Topbar, Sidebar,
 * MobileNav, AiRail, …) historically rendered OUTSIDE the .arbor-parent
 * token scope, so chrome resolved the legacy :root "glass" palette while
 * content resolved the flat clinical one — and --arbor-topbar-band was
 * undefined at its only usage. The fix hoisted the override block to
 * `.arbor-app, .arbor-parent` (index.css) with .arbor-app on the Shell root,
 * keeping the kid `.arbor-play` scope as a separate re-override. This test
 * parses every var(--*) referenced in components/layout/*.tsx and asserts it
 * is declared in index.css at a scope that actually covers the layout chrome
 * (:root or .arbor-app) — so a future token can never again be declared only
 * at a narrower scope and silently render as `unset` in the chrome.
 *
 * PLAT-3 (dead rail toggle): the Topbar "how Arbor helps" toggle, the AiRail
 * <aside> and Shell's third grid column must all gate on the SAME Tailwind
 * breakpoint, otherwise the toggle renders at widths where the rail cannot —
 * aria-pressed flips with zero visible change (the 1280-1535px silent no-op).
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const layoutDir = here;
const indexCss = readFileSync(path.join(here, "..", "..", "index.css"), "utf8");

/* ── tiny CSS walker: map each custom-property declaration to the selector
      list of its enclosing block (brace-tracking; @media wrappers ignored —
      a conditional re-declaration still needs a base declaration to count,
      because we only accept :root / .arbor-app selector lists). ─────────── */
function declarationScopes(rawCss: string): Map<string, Set<string>> {
  const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, ""); // comments may contain { } ; : — strip first
  const scopes = new Map<string, Set<string>>();
  const stack: string[] = [];
  let buf = "";
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") {
      stack.push(buf.trim());
      buf = "";
    } else if (ch === "}") {
      stack.pop();
      buf = "";
    } else if (ch === ";") {
      const decl = buf.trim();
      const m = decl.match(/^(--[a-zA-Z0-9-]+)\s*:/);
      if (m && stack.length > 0) {
        // nearest non-at-rule selector on the stack
        const sel = [...stack].reverse().find((s) => !s.startsWith("@"));
        if (sel) {
          if (!scopes.has(m[1])) scopes.set(m[1], new Set());
          scopes.get(m[1])!.add(sel);
        }
      }
      buf = "";
    } else {
      buf += ch;
    }
  }
  return scopes;
}

/** A selector list covers the layout chrome iff one of its selectors is
 *  :root or targets .arbor-app itself (the Shell root wrapper). */
function coversChrome(selectorList: string): boolean {
  return selectorList
    .split(",")
    .map((s) => s.trim())
    .some((s) => s === ":root" || s === ".arbor-app" || s.startsWith(":root["));
}

const scopes = declarationScopes(indexCss);

const layoutFiles = readdirSync(layoutDir).filter((f) => f.endsWith(".tsx"));

describe("PLAT-1 — every var() in layout chrome resolves at chrome scope", () => {
  it("sanity: parser sees the core tokens", () => {
    expect(scopes.has("--arbor-paper")).toBe(true);
    expect(scopes.has("--arbor-ink")).toBe(true);
  });

  it("the UC-1 chrome tokens are declared at .arbor-app scope (not content-only)", () => {
    for (const token of ["--arbor-topbar-band", "--arbor-subtab-active", "--arbor-subtab-on-ink"]) {
      const sels = scopes.get(token);
      expect(sels, `${token} must be declared in index.css`).toBeDefined();
      expect(
        [...sels!].some(coversChrome),
        `${token} is declared only at [${[...sels!].join(" | ")}] — it must be declared at :root or .arbor-app so the shell chrome can resolve it`,
      ).toBe(true);
    }
  });

  it.each(layoutFiles)("%s references only chrome-resolvable custom properties", (file) => {
    const src = readFileSync(path.join(layoutDir, file), "utf8");
    // var(--name) or var(--name, fallback) — a literal fallback makes the
    // reference self-sufficient, so only fallback-less refs are asserted.
    for (const m of src.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*([,)])/g)) {
      const [, name, terminator] = m;
      if (terminator === ",") continue; // has an explicit fallback
      const sels = scopes.get(name);
      expect(sels, `${file}: var(${name}) is not declared anywhere in index.css`).toBeDefined();
      expect(
        [...sels!].some(coversChrome),
        `${file}: var(${name}) is declared only at [${[...sels!].join(" | ")}] — undefined at the layout-chrome render scope; declare it at :root or .arbor-app`,
      ).toBe(true);
    }
  });
});

describe("PLAT-3 — rail toggle, AiRail and Shell grid share one breakpoint", () => {
  const topbar = readFileSync(path.join(layoutDir, "Topbar.tsx"), "utf8");
  const aiRail = readFileSync(path.join(layoutDir, "AiRail.tsx"), "utf8");
  const shell = readFileSync(path.join(layoutDir, "Shell.tsx"), "utf8");

  const railBp = aiRail.match(/hidden (2?xl|lg|md):flex/)?.[1];
  const toggleBp = topbar.match(/hidden (2?xl|lg|md):inline-flex/)?.[1];
  const gridBp = shell.match(/(2?xl|lg|md):grid-cols-\[[^\]]*_320px\]/)?.[1];

  it("all three breakpoints are found by the guard (guard stays honest)", () => {
    expect(railBp, "AiRail visibility breakpoint not found").toBeDefined();
    expect(toggleBp, "Topbar rail-toggle visibility breakpoint not found").toBeDefined();
    expect(gridBp, "Shell third-column breakpoint not found").toBeDefined();
  });

  it("toggle is never visible at a width where the rail cannot render", () => {
    expect(toggleBp).toBe(railBp);
  });

  it("Shell opens the third grid column at the same breakpoint the rail shows", () => {
    expect(gridBp).toBe(railBp);
  });
});
