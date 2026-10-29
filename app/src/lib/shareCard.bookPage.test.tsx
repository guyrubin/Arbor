/**
 * B-BOOK-26 — the "bookPage" canvas twin draws a page's picture from the SAME
 * layout object the screen renders (<BookPage>), so an exported page matches
 * the screen: every layer lands on the rect the DOM gives it, at any export
 * scale. Export is parent-only (refused in Kid Mode). The cover thumbnail
 * (LibraryBookCover) reads the same layout through pageWindowFractions.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({ kid: false }));
vi.mock("./kidModeGate", async (orig) => ({ ...(await orig<typeof import("./kidModeGate")>()), isKidModeActive: () => gate.kid }));

import { drawBookPage, renderBookPageCard, type BookPageCtx } from "./shareCard";
import { computeBookPageLayout, overlayRect, pageWindowFractions, type BookPageLayout, type Rect } from "./library/bookPageLayout";
import { BookPage } from "../components/library/BookPage";
import { getLibraryBook } from "./library/books";
import { bookPlatesFor } from "./library/books";

const book = getLibraryBook("five-smooth-stones")!;
const plates = bookPlatesFor(book);
const anchor = { aspect: 0.5, footX: 0.5, footW: 0.3 };
const layoutAt = (pageId: string, box: { width: number; height: number }) => {
  const page = pageId === "cover" ? book.cover : book.pages.find((p) => p.id === pageId)!;
  return computeBookPageLayout(page, box, "en", { plate: plates[page.plateId], anchorOf: () => anchor, cover: pageId === "cover" });
};

type Call = { op: string; args: number[]; img?: unknown };
function recorder(): BookPageCtx & { calls: Call[] } {
  const calls: Call[] = [];
  const rec = (op: string) => (...args: unknown[]) => { calls.push({ op, args: args.filter((a) => typeof a === "number") as number[], img: args.find((a) => typeof a === "object") }); };
  return {
    calls, globalAlpha: 1, filter: "none", fillStyle: "black",
    save: rec("save"), restore: rec("restore"), beginPath: rec("beginPath"), rect: rec("rect"), clip: rec("clip"),
    drawImage: rec("drawImage") as never, translate: rec("translate"), scale: rec("scale"), rotate: rec("rotate"),
    ellipse: rec("ellipse") as never, fill: rec("fill") as never,
  };
}
const img = (w: number, h: number) => ({ width: w, height: h }) as unknown as HTMLImageElement;

/** The px box a DOM layer was given (left/top/width/height inline style). */
function domBox(html: string, attr: string): Rect {
  const m = html.match(new RegExp(`${attr}[^>]*style="([^"]*)"`)) ?? html.match(new RegExp(`style="([^"]*)"[^>]*${attr}`));
  if (!m) throw new Error(`no ${attr}`);
  const v = (k: string) => Number((m[1].match(new RegExp(`(?:^|;)${k}:([-\\d.]+)px`)) ?? [])[1]);
  return { x: v("left"), y: v("top"), w: v("width"), h: v("height") };
}
const near = (a: Rect, b: Rect) => {
  for (const k of ["x", "y", "w", "h"] as const) expect(Math.abs(a[k] - b[k]), `${k}: ${a[k]} vs ${b[k]}`).toBeLessThan(0.11);
};

describe("B-BOOK-26: the canvas twin and the screen place every layer on the same rect", () => {
  for (const [pageId, box] of [["p3", { width: 390, height: 844 }], ["p3", { width: 1920, height: 1080 }], ["cover", { width: 1920, height: 1080 }]] as const) {
    it(`${pageId} at ${box.width}x${box.height}`, () => {
      const layout = layoutAt(pageId, box);
      const html = renderToStaticMarkup(<BookPage layout={layout} plateSrcs={["/plate.webp"]} heroSrc="/hero.webp" heroKey="k" pictureLabel="picture" />);
      const ctx = recorder();
      const plate = img(1536, 1024);
      const hero = layout.hero ? img(layout.hero.w * 10, layout.hero.h * 10) : null;
      drawBookPage(ctx, layout, { plate, hero });
      const draws = ctx.calls.filter((c) => c.op === "drawImage");
      const [px, py, pw, ph] = draws.find((c) => c.img === plate)!.args;
      near({ x: px, y: py, w: pw, h: ph }, domBox(html, 'data-book-plate=""'));
      if (layout.hero) {
        const [hx, hy, hw, hh] = draws.find((c) => c.img === hero)!.args;
        near({ x: hx, y: hy, w: hw, h: hh }, domBox(html, 'data-book-hero=""'));
      }
      // the canvas is the art window, clipped to it
      expect(ctx.calls.find((c) => c.op === "rect")!.args).toEqual([0, 0, layout.art.w, layout.art.h]);
    });
  }
  it("scales as one: an export at 2x draws every rect at 2x", () => {
    const layout = layoutAt("p3", { width: 390, height: 844 });
    const a = recorder(), b = recorder();
    const plate = img(1536, 1024), hero = img(100, 200);
    drawBookPage(a, layout, { plate, hero });
    drawBookPage(b, layout, { plate, hero }, { scale: 2 });
    const da = a.calls.filter((c) => c.op === "drawImage"), db = b.calls.filter((c) => c.op === "drawImage");
    expect(db.map((c) => c.args.map((n) => Math.round(n * 1000)))).toEqual(da.map((c) => c.args.map((n) => Math.round(n * 2000))));
  });
  it("a print replaces plate and sprite (no hero, no shadow), cover-fitted into the plate rect", () => {
    const layout = layoutAt("cover", { width: 390, height: 844 });
    const ctx = recorder();
    drawBookPage(ctx, layout, { plate: img(1500, 1000), printed: true, hero: img(10, 20) });
    expect(ctx.calls.filter((c) => c.op === "drawImage")).toHaveLength(1);
    expect(ctx.calls.some((c) => c.op === "ellipse")).toBe(false);
  });
  it("overlays use the one shared rule (overlayRect) the screen uses", () => {
    const layout = layoutAt("p3", { width: 390, height: 844 });
    const o = { x: 0.4, y: 0.8, scale: 0.2, aspect: 1, anchor: "feet" as const, footX: 0.5, z: "over" as const };
    const ctx = recorder();
    const oi = img(100, 100);
    drawBookPage(ctx, layout, { plate: img(1536, 1024), overlays: [{ o, img: oi }] });
    const r = overlayRect(o, layout.plate);
    const [x, y, w, h] = ctx.calls.find((c) => c.img === oi)!.args;
    near({ x, y, w, h }, { x: r.x - layout.art.x, y: r.y - layout.art.y, w: r.w, h: r.h });
  });
});

describe("B-BOOK-26: export is parent-only", () => {
  it("refused while Kid Mode is open", async () => {
    gate.kid = true;
    await expect(renderBookPageCard({ layout: layoutAt("p3", { width: 390, height: 844 }) as BookPageLayout, plateSrc: "/plate.webp" })).rejects.toThrow(/parent-only/);
    gate.kid = false;
  });
  it("no kid surface imports the exporter", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const path = await import("node:path");
    const kid = path.resolve(__dirname, "..", "components", "kidmode");
    const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const f = path.join(d, n); return statSync(f).isDirectory() ? walk(f) : /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [f] : []; });
    for (const f of walk(kid)) expect(readFileSync(f, "utf8"), f).not.toMatch(/renderBookPageCard|drawBookPage/);
  });
});

describe("B-BOOK-26: the shelf cover reads the same layout (pageWindowFractions)", () => {
  it("the cover thumbnail's plate and hero are the reader's stacked cover window, as fractions", () => {
    const l = computeBookPageLayout(book.cover, { width: 390, height: 844 }, "en", { plate: plates[book.cover.plateId], anchorOf: () => anchor });
    const f = pageWindowFractions(book.cover, { plate: plates[book.cover.plateId], anchorOf: () => anchor });
    expect(f.hero).not.toBeNull();
    expect(f.hero!.x).toBeCloseTo((l.hero!.x - l.art.x) / l.art.w, 6);
    expect(f.hero!.h).toBeCloseTo(l.hero!.h / l.art.h, 6);
    expect(f.plate.w).toBeCloseTo(l.plate.w / l.art.w, 6);
  });
});
