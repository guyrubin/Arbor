// B-SHELL-42 r3 — the open family list fits the phone at 390 in Hebrew (and every phone box).
//
// Source arithmetic, not a rendered verdict: the strip's geometry is read from the real
// ChildContextHeader / Shell source (gutter, gap, mark size) and the list's anchor and width
// from the exported SWITCHER_LIST_STYLE; the viewport widths come from the matrix of record
// (scripts/capture/release-config.mjs), restated nowhere. A rendered check of the open list
// at safari-he remains the owed evidence.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEVICE_VIEWPORTS } from "../../../scripts/capture/release-config.mjs";
import { SWITCHER_LIST_MIN_WIDTH_PX, SWITCHER_LIST_STYLE } from "./TopbarKidSwitcher";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f: string) => readFileSync(path.join(here, f), "utf8");
const header = read("ChildContextHeader.tsx");
const shell = read("Shell.tsx");

/** Tailwind spacing step → px (the 4 px scale). */
const tw = (cls: string, src: string) => Number(new RegExp(`\\b${cls}-(\\d+)\\b`).exec(src)![1]) * 4;
const GUTTER = tw("px", header); // the phone strip's side gutter (px-4)
const GAP = tw("gap", /flex flex-1 items-center gap-\d+/.exec(header)![0]); // between mark and switcher
const MARK = Number(/<ArborMark size=\{(\d+)\} \/>\s*[\s\S]*?<TopbarKidSwitcher shrink \/>/.exec(shell)![1]);
/** The strip is lg:hidden — every viewport narrower than lg (1024) shows it. */
const STRIP_VIEWPORTS = DEVICE_VIEWPORTS.filter((v) => v.w < 1024);

type Anchor = "start" | "end";
/**
 * The list's two inline edges, measured from the row's START edge (right in Hebrew, left in
 * English: logical properties make the arithmetic direction-free). The chip sits after the
 * gutter and the mark; the list is at least its min width, and a chip wider than that makes
 * the list the chip's width (its containing block).
 */
const listEdges = (chipWidth: number, anchor: Anchor) => {
  const chipStart = GUTTER + MARK + GAP;
  const width = Math.max(SWITCHER_LIST_MIN_WIDTH_PX, chipWidth);
  const near = anchor === "start" ? chipStart : chipStart + chipWidth - width;
  return { near, far: near + width };
};
const fits = (w: number, chipWidth: number, anchor: Anchor) => {
  const { near, far } = listEdges(chipWidth, anchor);
  return near >= GUTTER && far <= w - GUTTER;
};

describe("B-SHELL-42 r3 — the switcher list fits every phone box, EN and HE", () => {
  it("reads real geometry and the real list style", () => {
    expect([GUTTER, GAP, MARK]).toEqual([16, 8, 28]);
    expect(STRIP_VIEWPORTS.some((v) => v.w === 390 && v.lang === "he")).toBe(true);
    expect(SWITCHER_LIST_STYLE.insetInlineStart).toBe(0);
    expect(SWITCHER_LIST_STYLE.insetInlineEnd).toBeUndefined();
    expect(SWITCHER_LIST_STYLE.minWidth).toBe(`${SWITCHER_LIST_MIN_WIDTH_PX}px`);
    expect(SWITCHER_LIST_STYLE.maxWidth).toBe(`calc(100vw - ${2 * GUTTER}px)`);
    // the component renders this style object, not a second inline copy
    expect(read("TopbarKidSwitcher.tsx")).toMatch(/role="listbox"[\s\S]{0,120}style=\{SWITCHER_LIST_STYLE\}/);
  });

  it("hangs from the chip's start edge and stays inside both gutters, for any chip width the row allows", () => {
    for (const v of STRIP_VIEWPORTS) {
      // from the 44 px touch-target minimum to a chip that fills the row before the accessories
      for (let chip = 44; chip <= v.w - 2 * GUTTER - MARK - GAP - 3 * 44; chip += 4) {
        expect(fits(v.w, chip, "start"), `${v.id} chip ${chip}px`).toBe(true);
      }
    }
  });

  it("NEGATIVE CONTROL: the 29 Oct end-edge anchor overflows the 390 HE screen from a narrow chip", () => {
    const safariHe = STRIP_VIEWPORTS.find((v) => v.w === 390 && v.lang === "he")!;
    // A short name ("Dylan"): avatar · name · chevron is about 120 px; the list overflows the start side.
    expect(fits(safariHe.w, 120, "end")).toBe(false);
    expect(listEdges(120, "end").near).toBeLessThan(0);
    expect(fits(safariHe.w, 120, "start")).toBe(true);
  });
});
