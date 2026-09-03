/**
 * CR-19 — the dead accent-theme picker is gone for good.
 *
 * Behaviour: restoreTheme() is a migration that CLEARS the legacy key and
 * attribute, never sets one. Source: no code path under src/ sets a
 * `data-theme` attribute any more (the [data-theme] CSS blocks in index.css are
 * lane N's to purge; with no setter they are dead selectors). Negative control:
 * the verbatim pre-fix applyTheme body still trips the scanner.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import * as theme from "./theme";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Any write of the attribute: setAttribute("data-theme", …) or dataset.theme = … */
const SETS_DATA_THEME = /setAttribute\(\s*["'`]data-theme["'`]|dataset\.theme\s*=[^=]|setAttribute\(\s*ATTR\b/;

const OLD_APPLY_THEME = `
export function applyTheme(theme: AccentTheme): void {
  const root = document.documentElement;
  if (theme === "green") {
    root.removeAttribute(ATTR);
  } else {
    root.setAttribute(ATTR, theme);
  }
}`;

function fakeDom() {
  const store = new Map<string, string>();
  const attrs = new Map<string, string>();
  const g = globalThis as Record<string, unknown>;
  const prevLs = g.localStorage;
  const prevDoc = g.document;
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  g.document = {
    documentElement: {
      getAttribute: (k: string) => attrs.get(k) ?? null,
      setAttribute: (k: string, v: string) => void attrs.set(k, v),
      removeAttribute: (k: string) => void attrs.delete(k),
    },
  };
  return {
    store,
    attrs,
    restore: () => {
      g.localStorage = prevLs;
      g.document = prevDoc;
    },
  };
}

describe("restoreTheme is a clearing migration, never a setter", () => {
  let dom: ReturnType<typeof fakeDom> | null = null;
  afterEach(() => dom?.restore());

  it("a device that saved 'teal' boots with the key gone and NO data-theme attribute", () => {
    dom = fakeDom();
    dom.store.set("arbor-accent-theme", "teal");
    dom.attrs.set("data-theme", "teal"); // a stale attribute from a previous boot
    theme.restoreTheme();
    expect(dom.store.has("arbor-accent-theme")).toBe(false);
    expect(dom.attrs.has("data-theme")).toBe(false);
  });

  it("does not throw without localStorage / document (SSR, private mode)", () => {
    expect(() => theme.restoreTheme()).not.toThrow();
  });

  it("the module exports no picker surface any more (no ACCENT_THEMES / setTheme / applyTheme)", () => {
    expect(Object.keys(theme).sort()).toEqual(["restoreTheme"]);
  });
});

describe("no code path under src/ sets a data-theme attribute", () => {
  it("negative control: the pre-fix applyTheme body trips the scanner", () => {
    expect(SETS_DATA_THEME.test(OLD_APPLY_THEME)).toBe(true);
  });

  it("src/**/*.{ts,tsx} (tests excluded) contains no data-theme setter", () => {
    const offenders = walk(SRC)
      .filter((f) => SETS_DATA_THEME.test(stripComments(readFileSync(f, "utf8"))))
      .map((f) => path.relative(SRC, f));
    expect(offenders).toEqual([]);
  });

  it("SettingsModal no longer renders the accent picker (set.theme.* keys, ACCENT_THEMES)", () => {
    const src = stripComments(readFileSync(path.join(SRC, "components", "layout", "SettingsModal.tsx"), "utf8"));
    expect(src).not.toContain("ACCENT_THEMES");
    expect(src).not.toContain("set.theme.");
    expect(src).not.toContain('from "../../lib/theme"');
  });
});
