/**
 * B-BOOK-10 — <BookPage> places overlays exactly as the art agent's compose.py
 * does: (x, y) is the BOTTOM edge; anchor "center" centres x only (the worn
 * helmet sat half a helmet too low before — render pass A-p7b-0 / p6b).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BookPage, type BookPageOverlay } from "./BookPage";
import type { BookPageLayout } from "../../lib/library/bookPageLayout";

const art = { x: 0, y: 0, w: 1500, h: 1000 };
const layout = { art, plate: art, hero: null, shadow: null } as unknown as BookPageLayout;
const overlay = (o: Partial<BookPageOverlay>): BookPageOverlay => ({ id: "o", file: "/o.webp", srcs: ["/o.webp"], x: 0.5, y: 0.6, scale: 0.2, aspect: 0.8, ...o });
const box = (html: string) => {
  const m = /class="bk-overlay" style="left:([\d.]+)px;top:([\d.]+)px;width:([\d.]+)px;height:([\d.]+)px/.exec(html)!;
  return m.slice(1).map(Number);
};

describe("overlay anchors (compose.py)", () => {
  it("center: x centred, the BOTTOM edge on y", () => {
    const [left, top, w, h] = box(renderToStaticMarkup(<BookPage layout={layout} plateSrcs={[]} heroSrc={null} heroKey="k" pictureLabel="p" overlays={[overlay({ anchor: "center" })]} />));
    expect(h).toBeCloseTo(200, 1);
    expect(w).toBeCloseTo(160, 1);
    expect(left).toBeCloseTo(750 - 80, 1);
    expect(top + h).toBeCloseTo(600, 1);
  });

  it("feet: the feet-band centre (footX) on x, the bottom edge on y", () => {
    const [left, top, w, h] = box(renderToStaticMarkup(<BookPage layout={layout} plateSrcs={[]} heroSrc={null} heroKey="k" pictureLabel="p" overlays={[overlay({ anchor: "feet", footX: 0.25 })]} />));
    expect(left + 0.25 * w).toBeCloseTo(750, 1);
    expect(top + h).toBeCloseTo(600, 1);
  });
});
