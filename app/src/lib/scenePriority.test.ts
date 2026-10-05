/**
 * B-KID-56 (KB-08 interim) — story cards stop generating scenes; book pages
 * get a priority lane.
 * Before: every catalogue card mounted a WorldScene with the child's hero, so
 * opening the catalogue fired /generate-scene per card (2 at a time, FIFO),
 * and the first page of the book the child had just opened waited behind them.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { _resetSceneCache, resolveScene } from "./sceneCache";

const SRC = path.resolve(__dirname, "..");

describe("B-KID-56: a book page jumps the queued decorative scenes", () => {
  beforeEach(() => _resetSceneCache());

  it("with both slots busy, a page queued AFTER two scenes runs BEFORE them", async () => {
    const order: string[] = [];
    const releases: Array<() => void> = [];
    const blocker = (id: string) => () => new Promise<string>((res) => { order.push(id); releases.push(() => res(id)); });
    const quick = (id: string) => async () => { order.push(id); return id; };
    const b1 = resolveScene("busy-1", blocker("busy-1"));
    const b2 = resolveScene("busy-2", blocker("busy-2"));
    const s1 = resolveScene("scene-1", quick("scene-1"));
    const s2 = resolveScene("scene-2", quick("scene-2"));
    const page = resolveScene("page-1", quick("page-1"), { priority: "page" });
    await Promise.resolve();
    releases.shift()!(); // one slot frees up
    await page;
    expect(order.indexOf("page-1")).toBeLessThan(order.indexOf("scene-1") === -1 ? Infinity : order.indexOf("scene-1"));
    releases.splice(0).forEach((r) => r());
    await Promise.all([b1, b2, s1, s2]);
    expect(order.slice(0, 3)).toEqual(["busy-1", "busy-2", "page-1"]);
  });

  it("NEGATIVE CONTROL: without the page priority the same request waits its FIFO turn", async () => {
    const order: string[] = [];
    const releases: Array<() => void> = [];
    const blocker = (id: string) => () => new Promise<string>((res) => { order.push(id); releases.push(() => res(id)); });
    const quick = (id: string) => async () => { order.push(id); return id; };
    const b1 = resolveScene("busy-1", blocker("busy-1"));
    const b2 = resolveScene("busy-2", blocker("busy-2"));
    const s1 = resolveScene("scene-1", quick("scene-1"));
    const page = resolveScene("page-1", quick("page-1"));
    await Promise.resolve();
    releases.splice(0).forEach((r) => r());
    await Promise.all([b1, b2, s1, page]);
    expect(order.indexOf("scene-1")).toBeLessThan(order.indexOf("page-1"));
  });
});

describe("B-KID-56: the wiring", () => {
  it("story cards (kid + parent catalogue) render the theme plate, never a generated scene", () => {
    const tab = readFileSync(path.join(SRC, "components/tabs/HeroJourneyTab.tsx"), "utf8");
    const cards = tab.match(/<WorldScene worldId=\{`story-\$\{story\.id\}`\}[^>]*>/g) ?? [];
    // B-KID-85: the kid catalogue is KidLibrary (KidBookCover: static cover or
    // token title card, no WorldScene at all); the parent card is the one left.
    expect(cards).toHaveLength(1);
    for (const c of cards) expect(c).not.toContain("heroUrl=");
    const cover = readFileSync(path.join(SRC, "components/kidmode/KidBookCover.tsx"), "utf8");
    expect(cover).not.toContain("WorldScene");
    expect(cover).not.toContain("generate");
  });
  it("book and journey pages ask for the page lane", () => {
    const comics = readFileSync(path.join(SRC, "lib/heroComics.ts"), "utf8");
    expect(comics).toContain('}, { priority: "page" }); // B-KID-56');
  });
});
