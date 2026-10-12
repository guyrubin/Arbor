import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * v3 F-SHELL-2 (shell-global-status-strips) — the post-capture offer never
 * covers the launcher.
 *
 * The strip used to be `fixed … bottom-20 … lg:bottom-6`, centred on the
 * viewport: at lg the launcher rail (z-29) sits in the bottom 16-72 px of the
 * page, so the strip (z-30) landed on it, and it was centred across the
 * sidebar rather than on the page. Now Shell mounts it inside the
 * CompanionWorkspace grid, absolutely positioned with `grid-area: 1 / 1`: the
 * page's own cell (main's row and column) is its containing block, so it rests
 * just above the rail (row 2) at every width and is centred on the content
 * column, beside a docked conversation panel rather than under it.
 *
 * Node-only vitest env → source-based structural guards (house pattern, see
 * postCaptureHandoff.test.ts beside this file).
 */

const SRC_ROOT = path.resolve(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
// JSX comments first (the whole `{/* … */}`), then block and line comments.
const stripComments = (code: string) =>
  code.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const strip = stripComments(read("components/overview/PostCaptureCoachStrip.tsx"));
const shell = stripComments(read("components/layout/Shell.tsx"));
const workspace = stripComments(read("components/companion/CompanionWorkspace.tsx"));
const css = read("components/companion/companionWorkspace.css").replace(/\/\*[\s\S]*?\*\//g, "");

/** The class list of the strip's outer element (the one carrying its test id). */
function stripClasses(src: string): string[] {
  const at = src.indexOf('data-testid="post-capture-coach-strip"');
  const m = /className="([^"]*)"/.exec(src.slice(at));
  return m ? m[1].split(/\s+/) : [];
}
/** The declarations of the one CSS rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const at = css.indexOf(`${selector} {`);
  expect(at, `rule not found: ${selector}`).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("}", at));
}
/** True when the class list would park the strip over the launcher rail. */
const coversLauncher = (classes: string[]) =>
  classes.includes("fixed") || classes.some(c => /^(?:lg:|md:)?bottom-(?:6|20)$/.test(c)) || !classes.includes("absolute");

describe("v3 F-SHELL-2 · the post-capture strip sits in the page's cell, above the launcher", () => {
  it("the strip is absolute in grid area 1 / 1, 12 px off the cell's end, z-30", () => {
    const classes = stripClasses(strip);
    expect(classes).toEqual(expect.arrayContaining(["absolute", "inset-x-3", "bottom-3", "z-30", "mx-auto", "max-w-md"]));
    expect(coversLauncher(classes)).toBe(false);
    expect(strip).toContain('gridArea: "1 / 1"');
  });

  it("Shell mounts it once, inside the workspace, after the page", () => {
    const mainEnd = shell.lastIndexOf("</main>");
    const at = shell.indexOf("<PostCaptureCoachStrip />");
    const workspaceEnd = shell.indexOf("</CompanionWorkspace>");
    expect(shell.split("<PostCaptureCoachStrip />")).toHaveLength(2);
    expect(mainEnd).toBeGreaterThan(-1);
    expect(at).toBeGreaterThan(mainEnd);
    expect(workspaceEnd).toBeGreaterThan(at);
    // Nothing else sits between the page and the strip: it is a direct grid item.
    expect(shell.slice(mainEnd + "</main>".length, at).trim()).toBe("");
  });

  it("the workspace is the positioned grid that makes the cell its containing block", () => {
    // Children render as direct grid items of the workspace element (as the
    // expression's last operand too, so a held-page ternary still passes).
    expect(workspace).toMatch(/className=\{`companion-workspace[^`]*`\}>\s*\{[^\n]*\bchildren\}/);
    const ws = rule(".companion-workspace");
    expect(ws).toContain("display: grid");
    expect(ws).toContain("position: relative");
    expect(ws).toContain("grid-template-rows: minmax(0,1fr) auto");
    const main = rule(".companion-workspace > main");
    expect(main).toContain("grid-row: 1");
    expect(main).toContain("grid-column: 1");
    const rail = rule(".companion-launcher-rail");
    expect(rail).toContain("grid-row: 2");
    expect(rail).toContain("grid-column: 1");
  });

  it("NEGATIVE CONTROL: the pre-fix viewport-fixed strip fails the placement check", () => {
    const preFix = `<div role="status" dir="auto" data-testid="post-capture-coach-strip" className="fixed inset-x-3 bottom-20 z-30 mx-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl lg:bottom-6">`;
    expect(coversLauncher(stripClasses(preFix))).toBe(true);
    // …and the same markup with only `fixed` swapped still fails on its offsets.
    expect(coversLauncher(stripClasses(preFix.replace("fixed", "absolute")))).toBe(true);
  });
});
