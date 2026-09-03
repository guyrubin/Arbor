/**
 * MOB-22 — the cached first comic short-circuits the fetch.
 *
 * Behaviour: two prefetch calls + the wow's read share ONE generate call; a
 * different child starts its own; failure caches nothing and never throws.
 * Source: OnboardingFlow starts the prefetch when step 3 mounts, and
 * WowOnboarding consults the cache BEFORE api.generateComic (the negative
 * control feeds the pre-fix effect body to the same scan). The seed logic is
 * untouched — wowStorySeed.test.ts keeps pinning "once per child".
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({ api: { generateComic: vi.fn() } }));

import { __resetFirstComicPrefetch, awaitPrefetchedComic, peekPrefetchedComic, prefetchFirstComic, FIRST_STORY_ID } from "./firstComicPrefetch";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, "..", rel), "utf8");
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const OLD_WOW_EFFECT = `
    void (async () => {
      let result: { url: string | null; fallback: boolean };
      try {
        const res = await api.generateComic({
          ...(heroDataUrl ? { avatar: { dataUrl: heroDataUrl } } : {}),
          heroName: name,
`;

/** The cache read must precede the generate call inside the comic effect. */
const CACHE_BEFORE_GENERATE = /awaitPrefetchedComic\([\s\S]*?api\.generateComic\(/;

describe("prefetchFirstComic — idempotent per child + adventure", () => {
  beforeEach(() => __resetFirstComicPrefetch());

  it("two prefetches and the wow's read share ONE generate call", async () => {
    const generate = vi.fn(async () => ({ dataUrl: "data:image/png;base64,PAGE" }));
    const a = prefetchFirstComic("child-1", { heroName: "Noa", lang: "en" }, { generate });
    const b = prefetchFirstComic("child-1", { heroName: "Noa", lang: "en" }, { generate });
    expect(await a).toBe("data:image/png;base64,PAGE");
    expect(await b).toBe("data:image/png;base64,PAGE");
    expect(await awaitPrefetchedComic("child-1")).toBe("data:image/png;base64,PAGE");
    expect(peekPrefetchedComic("child-1")).toBe("data:image/png;base64,PAGE");
    expect(generate).toHaveBeenCalledTimes(1);
    // Sprout hero: no avatar in the payload; the first canon story's copy.
    expect(generate.mock.calls[0][0]).not.toHaveProperty("avatar");
    expect(generate.mock.calls[0][0]).toMatchObject({ heroName: "Noa", style: "comichero" });
    expect(FIRST_STORY_ID).toBe("david-and-goliath");
  });

  it("negative control: without a prefetch the wow's read is null and starts NO fetch", async () => {
    const generate = vi.fn(async () => ({ dataUrl: "x" }));
    expect(await awaitPrefetchedComic("child-9")).toBeNull();
    expect(peekPrefetchedComic("child-9")).toBeNull();
    expect(generate).not.toHaveBeenCalled();
  });

  it("a different child starts its own generation; Hebrew uses the Hebrew copy", async () => {
    const generate = vi.fn(async () => ({ dataUrl: "p" }));
    await prefetchFirstComic("child-1", { heroName: "Noa", lang: "en" }, { generate });
    await prefetchFirstComic("child-2", { heroName: "Ari", lang: "he" }, { generate });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[0][0].theme).not.toBe(generate.mock.calls[1][0].theme);
  });

  it("failure (paywall / network) caches nothing and never throws; an empty child id is a no-op", async () => {
    const generate = vi.fn(async () => { throw new Error("402"); });
    expect(await prefetchFirstComic("child-3", { heroName: "Noa", lang: "en" }, { generate })).toBeNull();
    expect(peekPrefetchedComic("child-3")).toBeNull();
    expect(await prefetchFirstComic("", { heroName: "Noa", lang: "en" }, { generate })).toBeNull();
    expect(generate).toHaveBeenCalledTimes(1);
  });
});

describe("the two mounts (structural)", () => {
  it("negative control: the pre-fix wow effect (generate with no cache read) fails the scan", () => {
    expect(CACHE_BEFORE_GENERATE.test(OLD_WOW_EFFECT)).toBe(false);
  });

  it("WowOnboarding reads the cache before api.generateComic, and only for a Sprout (no fresh hero) page", () => {
    const wow = stripComments(read("components/onboarding/WowOnboarding.tsx"));
    expect(wow).toMatch(/import \{[^}]*awaitPrefetchedComic[^}]*\} from "\.\.\/\.\.\/lib\/firstComicPrefetch"/);
    expect(wow).toMatch(CACHE_BEFORE_GENERATE);
    expect(wow).toMatch(/heroDataUrl\s*\?\s*null\s*:\s*await awaitPrefetchedComic\(activeChild\.id\)/);
  });

  it("OnboardingFlow kicks the prefetch off when step 3 mounts (real path only, never the replay)", () => {
    const flow = stripComments(read("components/auth/OnboardingFlow.tsx"));
    expect(flow).toMatch(/import \{[^}]*prefetchFirstComic[^}]*\} from "\.\.\/\.\.\/lib\/firstComicPrefetch"/);
    expect(flow).toMatch(/useEffect\(\(\) => \{[\s\S]{0,400}prefetchFirstComic\(/);
    expect(flow).toMatch(/if \(replaying \|\| !createdChildId\) return;[\s\S]{0,300}prefetchFirstComic\(/);
  });
});
