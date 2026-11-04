// B-SHELL-35 (agent half) — consolidate, never add: the Kid Mode doors are a closed inventory.
// v3 keeps one chrome door per surface (the phone strip, the desktop top bar, the More sheet's
// header) plus Together's hand-over and the in-context world doors. Whether Kid Mode leaves the
// chrome for Together alone (P4) is Guy's open decision; until then no NEW door may appear.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) walk(file);
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) files.push(file);
  }
};
walk(src);
const strip = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const rel = (f: string) => path.relative(src, f).split(path.sep).join("/");
const using = (pattern: RegExp, list = files) => list.filter((f) => pattern.test(strip(readFileSync(f, "utf8")))).map(rel).sort();

/** Chrome doors: the KidModeButton mounts. */
export const CHROME_KID_DOORS = ["components/layout/MobileNav.tsx", "components/layout/Shell.tsx", "components/layout/Topbar.tsx"];
/** Content doors: Together's hand-over and the worlds a parent hands over from inside a tool. */
export const CONTENT_KID_DOORS = [
  "components/companion/TogetherView.tsx",
  "components/practice/AdventuresTab.tsx",
  "components/practice/FeelingsLabTab.tsx",
  "components/practice/SpeechCoachTab.tsx",
  "components/program/ProgramKidWorldDoor.tsx",
  "components/sections/AskSpecialist.tsx",
];

describe("B-SHELL-35 — the Kid Mode doors are a closed inventory", () => {
  it("KidModeButton mounts only in the strip, the top bar and the More sheet header", () => {
    expect(using(/<KidModeButton\b/)).toEqual(CHROME_KID_DOORS);
  });

  it("the entry seam has only the named content doors (plus KidModeButton itself)", () => {
    expect(using(/\buseKidModeEntry\(\)/).filter((f) => f !== "components/layout/KidModeButton.tsx")).toEqual(CONTENT_KID_DOORS);
  });

  it("NEGATIVE CONTROL: a door added to the Sidebar is caught", () => {
    const sidebar = files.find((f) => rel(f) === "components/layout/Sidebar.tsx")!;
    const withDoor = strip(readFileSync(sidebar, "utf8")).replace("</aside>", "<KidModeButton /></aside>");
    expect(/<KidModeButton\b/.test(withDoor)).toBe(true);
    expect(CHROME_KID_DOORS).not.toContain("components/layout/Sidebar.tsx");
  });
});
