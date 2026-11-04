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
  it("wave-3 carry-over: the number columns keep a gap at 390 px (Opened / Finished never run together)", () => {
    const html = renderToStaticMarkup(<KidPlayPanel data={{
      minFamilies: 5,
      games: [{ week: "2026-W43", game: "puzzle", hidden: false, families: 6, sittings: 10, replays: 3, returned7d: 1 }],
      books: [{ week: "2026-W43", book: "five-smooth-stones", hidden: false, families: 5, opened: 5, finished: 3 }],
    }} />);
    const heads = [...html.matchAll(/<th class="([^"]*)">([^<]*)<\/th>/g)].map((m) => [m[2], m[1]] as const);
    expect(heads.map(([label]) => label)).toEqual(["Week · game", "Sittings", "Replays", "Back within 7 days", "Week · book", "Opened", "Finished"]);
    for (const [label, cls] of heads.filter(([label]) => !label.startsWith("Week"))) expect(cls.split(" "), label).toContain("ps-3");
    const cells = [...html.matchAll(/<td class="([^"]*)">/g)].map((m) => m[1].split(" "));
    expect(cells.length).toBe(5);
    for (const cls of cells) expect(cls).toEqual(expect.arrayContaining(["ps-3", "whitespace-nowrap"]));
  });
  it("loading and unavailable states", () => {
    expect(renderToStaticMarkup(<KidPlayPanel data={null} />)).toContain("Loading");
    expect(renderToStaticMarkup(<KidPlayPanel data="unavailable" />)).toContain("Not available");
  });
});
