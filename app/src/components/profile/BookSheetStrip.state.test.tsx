/**
 * B-BOOK-69 — the parent's book line says which hero the book shows while a
 * new hero is drawn: the previous hero's book stays readable until the new
 * sheet commits (PR151 fail-closed), and the line says so instead of
 * promising a new book or saying nothing. Rendered with react-dom/server.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookAssetsDoc } from "../../lib/library/bookAssetPaths";

const env = vi.hoisted(() => ({ items: [] as unknown[], running: false, confirmed: true, error: false, opts: undefined as unknown }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: (_c: string, _n: string, opts?: unknown) => { env.opts = opts; return { items: env.items, loaded: true, remote: true, confirmed: env.confirmed, error: env.error }; } }));
vi.mock("../../lib/bookAssetStore", () => ({ fetchBookAsset: vi.fn(async () => null) }));
vi.mock("../kidmode/hero/buildBookSheet", () => ({
  bookSheetRunning: () => env.running,
  browserBookBuilderDeps: vi.fn(),
  DEFAULT_SHEET_BOOK: "five-smooth-stones",
  redrawBookPose: vi.fn(),
}));
import BookSheetStrip from "./BookSheetStrip";
import { bookSheetId } from "../../lib/library/bookSheet";

const child = { id: "synthetic-child", name: "Synthetic", gender: "boy" as const };
const NEW_HASH = "a".repeat(64), OLD_HASH = "b".repeat(64);
const docFor = (hash: string, bookId = "five-smooth-stones") =>
  ({ bookId, sheetId: bookSheetId(hash), createdAt: "2026-10-20T00:00:00Z", files: [], sheetManifest: { poses: {} } }) as unknown as BookAssetsDoc;
const render = () => renderToStaticMarkup(<BookSheetStrip child={child} avatarHash={NEW_HASH} />);

beforeEach(() => { env.items = []; env.running = false; env.confirmed = true; env.error = false; env.opts = undefined; });

describe("B-BOOK-69: the parent's old/new book sheet line", () => {
  it("no book and nothing drawing: no line", () => {
    expect(render()).toBe("");
  });
  it("a first hero being drawn: the building line", () => {
    env.running = true;
    expect(render()).toContain('data-book-sheet="building"');
    expect(render()).toContain("elev.hero.sheet.book.building.boy");
  });
  it("a new hero being drawn over an earlier one: the book keeps the previous hero until then", () => {
    env.running = true; env.items = [docFor(OLD_HASH)];
    expect(render()).toContain('data-book-sheet="replacing"');
    expect(render()).toContain("elev.hero.sheet.book.replacing.boy");
  });
  it("an earlier hero's book and nothing drawing yet: the book still shows the previous hero", () => {
    env.items = [docFor(OLD_HASH)];
    expect(render()).toContain('data-book-sheet="previous"');
    expect(render()).toContain("elev.hero.sheet.book.previous.boy");
  });
  it("another book's sheet is not this book's previous hero", () => {
    env.items = [docFor(OLD_HASH, "another-book")];
    expect(render()).toBe("");
  });
  it("28 Oct: the earlier-hero claim needs a confirmed read of the book record (asked for, and honoured)", () => {
    env.items = [docFor(OLD_HASH)];
    render();
    expect(env.opts).toMatchObject({ trackConfirmation: true });
    env.confirmed = false;
    expect(render()).toBe("");
    env.confirmed = true; env.error = true;
    expect(render()).toBe("");
    // A build in flight is still said honestly, without the unconfirmed earlier-hero claim.
    env.running = true;
    expect(render()).toContain('data-book-sheet="building"');
    expect(render()).not.toContain("replacing");
  });
  it("the current hero's sheet committed: the review row, no state line", () => {
    env.running = true; env.items = [docFor(OLD_HASH), docFor(NEW_HASH)];
    const html = render();
    expect(html).toContain('data-book-sheet="review"');
    expect(html).not.toMatch(/data-book-sheet="(building|replacing|previous)"/);
  });
});
