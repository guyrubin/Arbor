/**
 * B-BOOK-26 / B-BOOK-31 / B-KID-143 — every library cover a child sees shows
 * THAT child's own hero: their printed cover, else the cover plate's window
 * with their own cover pose (from their approved sheet, their sheet folder)
 * composited where the book's layout puts it. Two synthetic families: each
 * cover names only its own sheet. A sheet without the cover picture still
 * gives a complete cover (the plate window). Synthetic data only.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/plans/planPlateSource", () => ({ usePlanPlateSrcs: (srcs: readonly string[]) => srcs }));
vi.mock("../../lib/bookAssetStore", () => ({ fetchBookAsset: vi.fn(async () => null) }));
vi.mock("../../lib/bookAssets", () => ({ libraryBookCoverUrl: vi.fn(async () => null) }));

import { CoverWindow, coverHeroPose, LibraryBookCover } from "./LibraryBookCover";
import { getLibraryBook } from "../../lib/library/books";
import { bookPlatesFor } from "../../lib/library/books";
import { pageWindowFractions } from "../../lib/library/bookPageLayout";
import type { BookAssetsDoc } from "../../lib/library/bookAssetPaths";

const book = getLibraryBook("five-smooth-stones")!;
const coverPose = book.cover.hero!.pose;
const docFor = (sheetId: string, poses: Record<string, { file: string; aspect?: number; footX?: number; footW?: number }>) =>
  ({ id: book.id, bookId: book.id, sheetId, setId: "none", sets: ["none"], sheetManifest: { poses }, files: [], bytes: 0, createdAt: "2026-10-28T00:00:00Z" }) as unknown as BookAssetsDoc;

describe("the cover hero is the child's own", () => {
  it("each family's cover reads its own sheet's cover pose, with its measured anchor", () => {
    const a = coverHeroPose({ book, doc: docFor("h-aaaaaaaaaaaaaaaa", { [coverPose]: { file: `${coverPose}.webp`, aspect: 0.48, footX: 0.5, footW: 0.3 } }) })!;
    const b = coverHeroPose({ book, doc: docFor("h-bbbbbbbbbbbbbbbb", { [coverPose]: { file: `${coverPose}.png` } }) })!;
    expect(a.rel).toBe(`hero-sheets/h-aaaaaaaaaaaaaaaa/${coverPose}.webp`);
    expect(a.anchor).toEqual({ aspect: 0.48, footX: 0.5, footW: 0.3 });
    expect(b.rel).toBe(`hero-sheets/h-bbbbbbbbbbbbbbbb/${coverPose}.png`);
    expect(b.anchor).toBeUndefined();
  });
  it("the reader's stopgap rule applies; a sheet with neither has no cover hero (never someone else's)", () => {
    const stopgapBook = { ...book, poseFallbacks: { ...(book.poseFallbacks ?? {}), [coverPose]: "idle" } };
    expect(coverHeroPose({ book: stopgapBook, doc: docFor("h-cccccccccccccccc", { idle: { file: "idle.webp" } }) })!.rel).toBe("hero-sheets/h-cccccccccccccccc/idle.webp");
    expect(coverHeroPose({ book, doc: docFor("h-cccccccccccccccc", {}) })).toBeNull();
  });
  it("the window composites the child's hero where the book's layout puts it; without it the plate window is complete", () => {
    const win = pageWindowFractions(book.cover, { plate: bookPlatesFor(book)[book.cover.plateId] });
    const withHero = renderToStaticMarkup(<CoverWindow bookId={book.id} plateSrc="/plate.webp" heroSrc="blob:own-hero" win={win} />);
    expect(withHero).toContain('data-cover-hero="own"');
    expect(withHero).toContain('src="blob:own-hero"');
    expect(withHero).toContain(`left:${Math.round(win.hero!.x * 100000) / 1000}%`);
    const plateOnly = renderToStaticMarkup(<CoverWindow bookId={book.id} plateSrc="/plate.webp" heroSrc={null} win={win} />);
    expect(plateOnly).toContain('data-cover-hero="none"');
    expect(plateOnly).toContain('src="/plate.webp"');
    expect(plateOnly).not.toContain("data-cover-own-hero");
  });
  it("first paint (before the child's files arrive) is the hero-free plate window, never a stale or shared picture", () => {
    const html = renderToStaticMarkup(<LibraryBookCover childId="synthetic-second-child" entry={{ book, doc: docFor("h-bbbbbbbbbbbbbbbb", { [coverPose]: { file: "x.webp" } }) } as never} />);
    expect(html).toContain('data-cover-hero="none"');
    expect(html).not.toContain("/visuals/cards/");
  });
});
