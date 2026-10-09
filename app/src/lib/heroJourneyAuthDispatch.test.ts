/** B-BOOK-28: use the REAL API wrapper and defer its token refresh. Checking
 * only before api.generate* misses the await immediately before fetch. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({ active: false, listeners: new Set<() => void>() }));
vi.mock("./kidModeGate", () => ({
  isKidModeActive: () => gate.active,
  subscribeKidMode: (listener: () => void) => { gate.listeners.add(listener); return () => gate.listeners.delete(listener); },
}));
import { api, __resetImageAllowance, setAuthTokenProvider } from "./api";
import { ComicGenerationCancelledError, generateJourneyPage, hasJourneyPageFailed, journeyPageKey, _resetJourneyPageFailures, type JourneyPageArgs } from "./heroComics";
import { resolvePersonalisedRender, _setHeroRenderBackend, getSavedRender, renderSignature } from "./heroRenderStore";
import { _resetSceneCache, getScene } from "./sceneCache";
import { _resetComicPageStore, _setComicPageBackend } from "./comicPageStore";
import { HERO_STORIES } from "./heroJourneys";

const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const switchGate = (active: boolean) => { gate.active = active; gate.listeners.forEach(listener => listener()); };
const story = HERO_STORIES[0];
const textPayload = { storyId: story.id, childName: "Synthetic", age: 6, language: "en" as const };
const imageArgs: JourneyPageArgs = { storyId: story.id, lang: "en", heroName: "Synthetic", heroDataUrl: "data:image/png;base64,U1lOVEhFVElD", style: "comichero", childIdentity: "synthetic-child", pageIndex: 1, theme: "synthetic scene" };
const textResponse = { storyId: story.id, title: "Synthetic story", scenes: [], choices: [], reflection: { practiced: [], questions: [] } };
const imageResponse = { dataUrl: "data:image/png;base64,U1lOVEhFVElD" };
let fetchSpy: ReturnType<typeof vi.fn<typeof fetch>>;
let auth: ReturnType<typeof deferred<string | null>>;
let authStarted: ReturnType<typeof vi.fn<() => Promise<string | null>>>;
beforeEach(() => {
  gate.active = false; gate.listeners.clear();
  _setHeroRenderBackend(null); _resetSceneCache(); _resetComicPageStore(); _resetJourneyPageFailures(); __resetImageAllowance();
  auth = deferred<string | null>();
  authStarted = vi.fn(() => auth.promise);
  setAuthTokenProvider(authStarted);
  fetchSpy = vi.fn<typeof fetch>(async input => new Response(JSON.stringify(/generate-(comic|scene)$/.test(String(input)) ? imageResponse : textResponse), { status: 200 }));
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => { setAuthTokenProvider(async () => null); _setHeroRenderBackend(null); _setComicPageBackend(null); vi.unstubAllGlobals(); });

for (const returnsToParent of [false, true]) {
  it(`image: no POST after a gate transition while auth refresh waits (returns=${returnsToParent})`, async () => {
    const pending = generateJourneyPage(imageArgs);
    const rejected = expect(pending).rejects.toBeInstanceOf(ComicGenerationCancelledError);
    await settle(); expect(authStarted).toHaveBeenCalledOnce(); expect(fetchSpy).not.toHaveBeenCalled();
    switchGate(true); if (returnsToParent) switchGate(false);
    auth.resolve("synthetic-token"); await rejected;
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getScene(journeyPageKey(imageArgs))).toBeUndefined();
    expect(hasJourneyPageFailed(journeyPageKey(imageArgs))).toBe(false);
    expect(gate.listeners.size).toBe(0);
  });
  it(`text: no POST or persistence after retirement while auth refresh waits (returns=${returnsToParent})`, async () => {
    let current = true;
    const persistRemote = vi.fn();
    const pending = resolvePersonalisedRender({
      childId: "synthetic-child", story, lang: "en", firstName: "Synthetic", remote: [], fresh: true,
      isCurrent: () => current,
      generate: beforeDispatch => api.generateHeroJourney(textPayload, beforeDispatch),
      persistRemote,
    });
    const rejected = expect(pending).rejects.toThrow("Story request retired");
    await settle(); expect(authStarted).toHaveBeenCalledOnce(); expect(fetchSpy).not.toHaveBeenCalled();
    current = false; switchGate(true); if (returnsToParent) switchGate(false);
    auth.resolve("synthetic-token"); await rejected;
    expect(fetchSpy).not.toHaveBeenCalled(); expect(persistRemote).not.toHaveBeenCalled();
    expect(getSavedRender("synthetic-child", story.id, "en", renderSignature("Synthetic", story))).toBeUndefined();
  });
}

describe("parent positive controls and transport-only lifecycle callbacks", () => {
  it("current parent journey image passes auth, posts once, and serializes only its existing payload", async () => {
    const pending = generateJourneyPage(imageArgs);
    await settle(); expect(authStarted).toHaveBeenCalledOnce();
    auth.resolve("synthetic-token"); await expect(pending).resolves.toMatchObject({ url: imageResponse.dataUrl });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/generate-comic");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer synthetic-token" });
    expect(JSON.parse(String(init?.body))).toEqual({ avatar: { dataUrl: imageArgs.heroDataUrl }, heroName: "Synthetic", theme: "synthetic scene", style: "comichero", pageIndex: 1 });
    expect(gate.listeners.size).toBe(0);
  });
  it("current parent story passes auth, posts once, and retains the render", async () => {
    const persistRemote = vi.fn();
    const pending = resolvePersonalisedRender({
      childId: "synthetic-child", story, lang: "en", firstName: "Synthetic", remote: [], fresh: true,
      isCurrent: () => true, generate: beforeDispatch => api.generateHeroJourney(textPayload, beforeDispatch), persistRemote,
    });
    await settle(); auth.resolve("synthetic-token");
    await expect(pending).resolves.toMatchObject({ render: textResponse, source: "generated" });
    expect(persistRemote).toHaveBeenCalledOnce(); expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/generate-hero-journey");
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual(textPayload);
  });
  it("ordinary parent callers can still omit the lifecycle callback on both routes", async () => {
    const text = api.generateHeroJourney(textPayload);
    const image = api.generateComic({ theme: "synthetic scene" });
    await settle(); auth.resolve(null);
    await expect(text).resolves.toEqual(textResponse);
    await expect(image).resolves.toEqual(imageResponse);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
  it("scene callers can use the same transport guard, without changing unguarded parent behavior", async () => {
    let current = true;
    const payload = { imagePrompt: "synthetic scene" };
    const pending = api.generateScene(payload, () => { if (!current) throw new Error("scene retired"); });
    const rejected = expect(pending).rejects.toThrow("scene retired");
    await settle(); expect(authStarted).toHaveBeenCalledOnce();
    current = false; auth.resolve("synthetic-token");
    await rejected; expect(fetchSpy).not.toHaveBeenCalled();
    await expect(api.generateScene(payload)).resolves.toEqual(imageResponse);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/generate-scene");
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual(payload);
  });
  it("a rejected auth refresh cannot bypass retirement via the anonymous fallback", async () => {
    let current = true;
    const beforeDispatch = () => { if (!current) throw new Error("retired"); };
    const pending = api.generateHeroJourney(textPayload, beforeDispatch);
    const rejected = expect(pending).rejects.toThrow("retired");
    await settle(); current = false; auth.reject(new Error("synthetic token failure"));
    await rejected; expect(fetchSpy).not.toHaveBeenCalled();
  });
});
