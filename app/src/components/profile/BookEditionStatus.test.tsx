import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bookSheetId } from "../../lib/library/bookSheet";

const state = vi.hoisted(() => ({
  rows: [] as { id: string; bookId: string; sheetId: string }[],
  remote: true, confirmed: true, error: false, preparing: false,
  scope: "" as string, confirmationRequired: false,
}));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: (childId: string, collection: string, opts: { trackConfirmation?: boolean }) => {
    state.scope = childId + "/" + collection;
    state.confirmationRequired = opts.trackConfirmation === true;
    return { items: state.rows, remote: state.remote, confirmed: state.confirmed, error: state.error };
  },
}));
vi.mock("../kidmode/hero/buildBookSheet", () => ({
  DEFAULT_SHEET_BOOK: "five-smooth-stones",
  bookSheetRunning: () => state.preparing,
}));
import BookEditionStatus from "./BookEditionStatus";

const avatarHash = "0123456789abcdef";
const renderStatus = () => renderToStaticMarkup(
  <BookEditionStatus childId="fixture-child" avatarHash={avatarHash} />,
);
const prior = { id: "five-smooth-stones", bookId: "five-smooth-stones", sheetId: "h-previous" };

describe("B-BOOK-69 parent book edition status", () => {
  beforeEach(() => {
    state.rows = []; state.remote = true; state.confirmed = true;
    state.error = false; state.preparing = false; state.scope = "";
    state.confirmationRequired = false;
  });

  it("explains a saved earlier book while a new edition is being prepared", () => {
    state.rows = [prior]; state.preparing = true;
    const html = renderStatus();
    expect(html).toContain('data-book-edition="preparing"');
    expect(html).toContain("elev.hero.sheet.book.oldPreparing");
    expect(state.scope).toBe("fixture-child/bookAssets");
    expect(state.confirmationRequired).toBe(true);
  });

  it("acknowledges the earlier book when a replacement has not committed", () => {
    state.rows = [prior];
    expect(renderStatus()).toContain("elev.hero.sheet.book.oldWaiting");
  });

  it("never falsely shows an old-edition warning for the committed current book", () => {
    state.rows = [prior, { ...prior, sheetId: bookSheetId(avatarHash) }];
    expect(renderStatus()).not.toContain("data-book-edition");
  });

  it("shows nothing for absent or unrelated book records", () => {
    expect(renderStatus()).not.toContain("data-book-edition");
    state.rows = [{ ...prior, bookId: "unrelated" }];
    expect(renderStatus()).not.toContain("data-book-edition");
  });

  it("does not expose a previous version from unconfirmed, stale, or sandbox reads", () => {
    state.rows = [prior]; state.confirmed = false;
    expect(renderStatus()).not.toContain("data-book-edition");
    state.confirmed = true; state.error = true;
    expect(renderStatus()).not.toContain("data-book-edition");
    state.error = false; state.remote = false;
    expect(renderStatus()).not.toContain("data-book-edition");
  });
});
