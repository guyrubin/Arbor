/**
 * B-KID-11 guard — ONE entry seam into Kid Mode, and it arrives where it was asked.
 *
 * Before: three parent doors called `openKidMode()` directly (Practice door,
 * Practice tiles, Consult's "At home while you wait"); none ran the hero-first
 * step and every one landed the child on the Kid Mode HOME, while the tile
 * named a world. Now every door calls `request({ view, worldId })` from
 * `useKidModeEntry`, and the overlay arrives on the persisted surface.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

// Calls of the raw context opener. homePractice's `seams.openKidMode(...)` is
// a pure-module seam parameter (its caller hands it the context function).
const ALLOWED = new Set(["components/kidmode/useKidModeEntry.tsx", "consult/homePractice.ts"]);

describe("B-KID-11 · one entry seam", () => {
  const files = walk(SRC);

  it("the tree walk is real (a vacuous scan is not a pass)", () => {
    expect(files.length).toBeGreaterThan(200);
  }, 60_000);

  it("openKidMode( is called only inside the seam", () => {
    const offenders = files
      .map((f) => path.relative(SRC, f).replace(/\\/g, "/"))
      .filter((rel) => !ALLOWED.has(rel))
      .filter((rel) => /(?<![\w.])openKidMode\(/.test(strip(read(rel))));
    expect(offenders).toEqual([]);
  }, 120_000);

  it("NEGATIVE CONTROL: a direct door call is caught", () => {
    expect(/(?<![\w.])openKidMode\(/.test('onClick={() => { openKidMode(); }}')).toBe(true);
    expect(/(?<![\w.])openKidMode\(/.test("seams.openKidMode({})")).toBe(false);
  });

  it("the seam runs hero-first, then opens on the asked target", () => {
    const seam = strip(read("components/kidmode/useKidModeEntry.tsx"));
    expect(seam).toContain("shouldOfferHeroStep(");
    expect(seam).toContain("openKidMode(target);");
    const ctx = strip(read("components/kidmode/KidModeContext.tsx"));
    expect(ctx).toContain('writeKidModeState({ open: true, view: target?.view ?? "home", worldId: target?.worldId ?? null });');
  });

  it("the overlay arrives on the persisted surface on a closed→open transition (not always home)", () => {
    const overlay = strip(read("components/kidmode/KidModeOverlay.tsx"));
    const effect = overlay.slice(overlay.indexOf("if (isKidModeOpen && !wasOpenRef.current) {"), overlay.indexOf("wasOpenRef.current = isKidModeOpen;"));
    expect(effect).toContain("const p = readKidModeState();");
    expect(effect).toContain("p.view in SURFACE_META");
    expect(effect).not.toMatch(/setView\("home"\);\s*setArcadeWorldId\(null\);/);
  });
});
