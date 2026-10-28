/**
 * B-GAME-18 / B-BOOK-51 — the founder dashboard shows the weekly Kid Mode play
 * rollup: per game sittings, replays of sittings and families back within 7
 * days; per book opened / finished; hidden cells read "Hidden", never a number.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KidPlayPanel } from "./AdminDashboard";

describe("KidPlayPanel", () => {
  it("shows sittings, replays of sittings and 7-day returns; hidden cells stay hidden", () => {
    const html = renderToStaticMarkup(<KidPlayPanel data={{
      minFamilies: 5,
      games: [
        { week: "2026-W43", game: "puzzle", hidden: false, families: 6, sittings: 10, replays: 3, returned7d: 1 },
        { week: "2026-W43", game: "calm-builder", hidden: true, families: null, sittings: null, replays: null, returned7d: null },
      ],
      books: [{ week: "2026-W43", book: "five-smooth-stones", hidden: false, families: 5, opened: 5, finished: 3 }],
    }} />);
    expect(html).toContain("2026-W43 · puzzle");
    expect(html).toContain(">10<");
    expect(html).toContain("3 of 10");
    expect(html).toContain("1 of 6");
    expect(html).toMatch(/calm-builder<\/td><td[^>]*>Hidden</);
    expect(html).toContain("2026-W43 · five-smooth-stones");
    expect(html).toContain("fewer than 5 families are hidden");
    expect(html).not.toMatch(/%/);
  });
  it("loading and unavailable states", () => {
    expect(renderToStaticMarkup(<KidPlayPanel data={null} />)).toContain("Loading");
    expect(renderToStaticMarkup(<KidPlayPanel data="unavailable" />)).toContain("Not available");
  });
});
