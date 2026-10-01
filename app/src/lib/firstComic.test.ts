/**
 * B-SHELL-10 — the first comic gets an 8-second client time-box.
 *
 * With /generate-comic answering 429 or hanging, the wow step awaited the
 * request with no deadline. firstComicWithin races the ONE request (through the
 * prewarm slot) against FIRST_COMIC_TIMEOUT_MS; on timeout the caller shows its
 * pre-composed page while `late` keeps the same request alive.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const gen = vi.hoisted(() => ({ impl: (() => new Promise(() => {})) as () => Promise<{ dataUrl: string }> }));
vi.mock("./api", () => ({ api: { generateComic: vi.fn(() => gen.impl()) } }));

import { api } from "./api";
import { FIRST_COMIC_TIMEOUT_MS, firstComicWithin, prewarmFirstComic } from "./firstComic";
import { clearPrewarmedComic } from "./comicPrewarm";

const ID = { name: "Maya", he: false };

beforeEach(() => {
  vi.useFakeTimers();
  clearPrewarmedComic();
  vi.mocked(api.generateComic).mockClear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("B-SHELL-10 · firstComicWithin", () => {
  it("the box is 8 seconds", () => {
    expect(FIRST_COMIC_TIMEOUT_MS).toBe(8000);
  });

  it("a never-resolving request times out at 8 s (fallback can render <= 8.5 s)", async () => {
    gen.impl = () => new Promise(() => {});
    let settled: Awaited<ReturnType<typeof firstComicWithin>> | null = null;
    void firstComicWithin(ID).then((r) => { settled = r; });
    await vi.advanceTimersByTimeAsync(7_999);
    expect(settled).toBeNull();
    await vi.advanceTimersByTimeAsync(2);
    expect(settled).not.toBeNull();
    expect(settled!.timedOut).toBe(true);
    expect(settled!.dataUrl).toBeNull();
    expect(settled!.late).toBeTruthy();
  });

  it("a late success lands through `late` without a second request", async () => {
    let resolve!: (v: { dataUrl: string }) => void;
    gen.impl = () => new Promise((r) => { resolve = r; });
    const p = firstComicWithin(ID);
    await vi.advanceTimersByTimeAsync(8_001);
    const r = await p;
    expect(r.timedOut).toBe(true);
    resolve({ dataUrl: "data:image/png;base64,REAL" });
    await expect(r.late!).resolves.toEqual({ dataUrl: "data:image/png;base64,REAL" });
    expect(api.generateComic).toHaveBeenCalledTimes(1);
  });

  it("a fast success is the real page, not timed out", async () => {
    gen.impl = () => Promise.resolve({ dataUrl: "data:image/png;base64,FAST" });
    const p = firstComicWithin(ID);
    await vi.advanceTimersByTimeAsync(10);
    const r = await p;
    expect(r).toMatchObject({ dataUrl: "data:image/png;base64,FAST", timedOut: false, late: null });
  });

  it("a failure inside the box is the old fallback (not a timeout)", async () => {
    gen.impl = () => Promise.reject(new Error("429"));
    const p = firstComicWithin(ID);
    await vi.advanceTimersByTimeAsync(10);
    expect(await p).toMatchObject({ dataUrl: null, timedOut: false });
  });

  it("a page the domain step already started is reused (prewarmed), never re-requested", async () => {
    gen.impl = () => Promise.resolve({ dataUrl: "data:image/png;base64,PRE" });
    prewarmFirstComic(ID);
    const p = firstComicWithin(ID);
    await vi.advanceTimersByTimeAsync(10);
    expect(await p).toMatchObject({ dataUrl: "data:image/png;base64,PRE", prewarmed: true });
    expect(api.generateComic).toHaveBeenCalledTimes(1);
  });
});

describe("B-SHELL-10 · the wow wires the box and reports it", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const wow = readFileSync(path.join(here, "..", "components", "onboarding", "WowOnboarding.tsx"), "utf8");

  it("analytics carry timedOut; a late page swaps in only while the overlay is mounted", () => {
    expect(wow).toContain('track("wow_comic_shown", { fallback: result.fallback, prewarmed: camePrewarmed, timedOut: first.timedOut });');
    expect(wow).toContain("if (first.timedOut && first.late)");
    expect(wow).toContain("wowMounted.current");
    expect(wow).not.toContain("await generateFirstComic(");
  });
});
