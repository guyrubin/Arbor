/**
 * MOB-22 — the first comic is drawn while the parent picks domains.
 *
 * WHAT SHIPPED: WowOnboarding only STARTED the generation once the overlay
 * reached its comic step, so the first thing a new account experienced was a
 * spinner sitting on top of an image-generation round trip — while the ~30
 * seconds the parent had just spent on the onboarding domain step went by with
 * an idle network.
 *
 * WHAT THESE PIN:
 *   1. the prewarm slot: one page, taken once, never persisted;
 *   2. the KEY — a prewarm started without an avatar is NOT handed to a parent
 *      who went on to create one (that is what keeps the gating honest);
 *   3. a failed prewarm is a miss, never a thrown error and never a rejection
 *      nobody handles;
 *   4. both call sites are wired: onboarding starts it, the wow overlay takes it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearPrewarmedComic,
  hasPrewarm,
  heroFingerprint,
  prewarmComic,
  prewarmKey,
  takePrewarmedComic,
} from "./comicPrewarm";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, rel), "utf8").replace(/\r\n/g, "\n");

const PLAIN = prewarmKey({ story: "david-and-goliath", lang: "en", hero: heroFingerprint(undefined) });
const WITH_AVATAR = prewarmKey({
  story: "david-and-goliath",
  lang: "en",
  hero: heroFingerprint("data:image/png;base64,AAAABBBBCCCCDDDDEEEEFFFFGGGG"),
});

beforeEach(() => clearPrewarmedComic());

describe("MOB-22 — the prewarm slot", () => {
  it("NEGATIVE CONTROL: with nothing prewarmed there is nothing to take", () => {
    expect(hasPrewarm(PLAIN)).toBe(false);
    expect(takePrewarmedComic(PLAIN)).toBeNull();
  });

  it("holds ONE page and hands it over exactly once", async () => {
    prewarmComic(PLAIN, async () => "data:image/png;base64,PAGE");
    expect(hasPrewarm(PLAIN)).toBe(true);

    const first = await takePrewarmedComic(PLAIN)!;
    expect(first.dataUrl).toBe("data:image/png;base64,PAGE");
    // Taken means gone — nothing is left holding image bytes.
    expect(hasPrewarm(PLAIN)).toBe(false);
    expect(takePrewarmedComic(PLAIN)).toBeNull();
  });

  it("starts the generation ONCE for the same page", () => {
    const gen = vi.fn(async () => "data:image/png;base64,PAGE");
    prewarmComic(PLAIN, gen);
    prewarmComic(PLAIN, gen);
    prewarmComic(PLAIN, gen);
    expect(gen).toHaveBeenCalledTimes(1);
  });

  it("a take can be awaited before the generation settles", async () => {
    let release: (v: string) => void = () => {};
    prewarmComic(PLAIN, () => new Promise<string>((r) => { release = r; }));
    const pending = takePrewarmedComic(PLAIN)!;
    release("data:image/png;base64,LATE");
    expect((await pending).dataUrl).toBe("data:image/png;base64,LATE");
  });
});

describe("MOB-22 — the key keeps the gating honest", () => {
  it("a plain prewarm is NOT handed to a parent who then made an avatar", async () => {
    prewarmComic(PLAIN, async () => "data:image/png;base64,PLAIN");
    expect(takePrewarmedComic(WITH_AVATAR)).toBeNull();
    // …and the plain page is still there for the parent who skipped the avatar.
    expect((await takePrewarmedComic(PLAIN)!).dataUrl).toBe("data:image/png;base64,PLAIN");
  });

  it("language is part of the page's identity", () => {
    const heKey = prewarmKey({ story: "david-and-goliath", lang: "he", hero: heroFingerprint(undefined) });
    expect(heKey).not.toBe(PLAIN);
  });

  it("the hero fingerprint is a fingerprint, never the photo itself", () => {
    const dataUrl = "data:image/png;base64," + "Z".repeat(400);
    const fp = heroFingerprint(dataUrl);
    expect(fp.length).toBeLessThan(64);
    expect(dataUrl).not.toContain(fp);
    expect(heroFingerprint(undefined)).toBe("plain");
  });
});

describe("MOB-22 — a failed prewarm is a miss, never a crash", () => {
  it("a rejected generation settles to null", async () => {
    prewarmComic(PLAIN, async () => { throw new Error("paywall"); });
    expect((await takePrewarmedComic(PLAIN)!).dataUrl).toBeNull();
  });

  it("an empty page settles to null so the normal path runs", async () => {
    prewarmComic(PLAIN, async () => "");
    expect((await takePrewarmedComic(PLAIN)!).dataUrl).toBeNull();
  });

  it("a prewarm nobody takes cannot surface as an unhandled rejection", async () => {
    const seen: unknown[] = [];
    const onUnhandled = (r: unknown) => seen.push(r);
    process.on("unhandledRejection", onUnhandled);
    prewarmComic(PLAIN, async () => { throw new Error("offline"); });
    clearPrewarmedComic();
    await new Promise((r) => setTimeout(r, 20));
    process.off("unhandledRejection", onUnhandled);
    expect(seen).toEqual([]);
  });
});

describe("MOB-22 — the module persists nothing", () => {
  it("no storage of any kind is referenced", () => {
    // Comments NAME the stores this module stays out of, so strip them first.
    const src = read("./comicPrewarm.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
    expect(src.length).toBeGreaterThan(500);
    expect(src).toContain("takePrewarmedComic");
    // Built by concatenation: the page-store import guard (comicShelfDurability)
    // greps for that module name and would count this file as a consumer.
    const STORES = new RegExp(["localStorage", "sessionStorage", "indexedDB", "comicPage" + "Store", "upsert\\("].join("|"));
    expect(src).not.toMatch(STORES);
  });
});

describe("MOB-22 — both call sites are wired", () => {
  const flow = read("../components/auth/OnboardingFlow.tsx");
  const wow = read("../components/onboarding/WowOnboarding.tsx");
  const shared = read("./firstComic.ts");

  it("reads all three files (a scan over an empty string proves nothing)", () => {
    expect(flow.length).toBeGreaterThan(5000);
    expect(wow.length).toBeGreaterThan(5000);
    expect(shared.length).toBeGreaterThan(1000);
  });

  it("NEGATIVE CONTROL: the shipped wow step built its own payload and started cold", () => {
    const shipped = [
      "      try {",
      "        const res = await api.generateComic({",
      "          ...(heroDataUrl ? { avatar: { dataUrl: heroDataUrl } } : {}),",
      "          heroName: name,",
      "        });",
    ].join("\n");
    expect(/api\.generateComic\(/.test(shipped)).toBe(true);
    expect(/takeFirstComic|prewarmFirstComic/.test(shipped)).toBe(false);
  });

  it("onboarding starts the prewarm at the DOMAIN step, and never in replay mode", () => {
    expect(flow).toContain("prewarmFirstComic(");
    const effect = flow.match(/if \(step !== 3[\s\S]{0,400}?prewarmFirstComic\([\s\S]{0,120}?\);/)?.[0];
    expect(effect).toBeTruthy();
    expect(effect, "a demo replay must not cost a generation").toContain("replaying");
    expect(effect, "never before a real child exists").toContain("createdChildId");
    // The PLAIN variant only: no avatar reaches this call, so no photo and no
    // face_processing consent is involved at the domain step.
    expect(effect).not.toMatch(/heroDataUrl|avatarResult|photoUrl/);
  });

  it("the wow overlay takes the prewarmed page before generating anything", () => {
    expect(wow).toContain("takeFirstComic(");
    expect(wow).toContain("generateFirstComic(");
    // The take happens FIRST; the generation is the else branch.
    expect(wow.indexOf("takeFirstComic(")).toBeLessThan(wow.indexOf("generateFirstComic("));
    // The overlay no longer assembles its own payload — one definition only.
    expect(wow).not.toContain("api.generateComic(");
    expect(wow).not.toContain("FIRST_STORY_COMIC");
  });

  it("both sides derive the key from ONE shared identity", () => {
    expect(shared).toContain("export function firstComicKey");
    expect(shared).toContain("export function prewarmFirstComic");
    expect(shared).toContain("export function takeFirstComic");
    expect(shared).toContain("api.generateComic(");
    // The shared request is the ONLY place the payload is built.
    expect((shared.match(/api\.generateComic\(/g) ?? []).length).toBe(1);
  });
});
