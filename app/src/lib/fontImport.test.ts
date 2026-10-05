/**
 * B-SHELL-24 (partial) — the web-font import loads only what the tokens name.
 *
 * index.css:1 imported SEVEN Google families render-blocking; two of them
 * (Baloo 2, Plus Jakarta Sans) were named by no `--font-*` token, so every
 * first paint waited on fonts nothing used. This pins the import to the token
 * set. The self-hosting half (no fonts.googleapis.com request at all) is
 * filed in REJECTIONS.md — the woff2 binaries are not on disk.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const css = readFileSync(path.resolve(__dirname, "..", "index.css"), "utf8");
const importLine = css.split("\n").find((l) => l.includes("fonts.googleapis.com/css2")) ?? "";

/** Families named in the import URL, `+` → space. */
function importedFamilies(line: string): string[] {
  return [...line.matchAll(/family=([^:&']+)/g)].map((m) => decodeURIComponent(m[1]).replace(/\+/g, " "));
}

/** Families named first or second in any --font-* token (generic/system names excluded). */
function tokenFamilies(src: string): Set<string> {
  const out = new Set<string>();
  const GENERIC = /^(serif|sans-serif|system-ui|-apple-system|BlinkMacSystemFont|Georgia|Times New Roman|Assistant)$/;
  for (const m of src.matchAll(/--font-[a-z]+:\s*([^;]+);/g)) {
    for (const raw of m[1].split(",")) {
      const fam = raw.trim().replace(/^['"]|['"]$/g, "");
      if (fam && !GENERIC.test(fam)) out.add(fam);
    }
  }
  return out;
}

describe("B-SHELL-24 · the font import loads only token-named families", () => {
  const imported = importedFamilies(importLine);
  const named = tokenFamilies(css);

  it("every imported family is named by a --font-* token", () => {
    expect(imported.length).toBeGreaterThan(0);
    expect(imported.filter((f) => !named.has(f))).toEqual([]);
  });

  it("every web family a token names is imported (no silent system fallback)", () => {
    expect([...named].filter((f) => !imported.includes(f))).toEqual([]);
  });

  it("the import keeps font-display: swap", () => {
    expect(importLine).toContain("display=swap");
  });

  it("NEGATIVE CONTROL: the pre-change import carried two families no token names", () => {
    const pre = "@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz&family=Nunito:wght@400&family=Plus+Jakarta+Sans:wght@400&family=Baloo+2:wght@500&display=swap');";
    expect(importedFamilies(pre).filter((f) => !named.has(f))).toEqual(["Plus Jakarta Sans", "Baloo 2"]);
  });
});
