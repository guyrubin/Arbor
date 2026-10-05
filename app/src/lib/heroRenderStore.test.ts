/**
 * B-KID-127 — a story written for a child is kept: never generated twice.
 * The personalised render is kept per child + story + language (no day), on
 * the device (IndexedDB behind a memory front; an in-memory backend here) and
 * in the child's account (`heroRenders`, registered for export + erase).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetHeroRenderFront, _setHeroRenderBackend, getSavedRender, hydrateHeroRenders, isTextOnlyRender, MAX_RENDERS,
  purgeHeroRenders, renderSignature, resolvePersonalisedRender, saveRender, heroRenderDocId,
  type HeroRenderBackend, type SavedHeroRender,
} from "./heroRenderStore";
import { CHILD_SUBCOLLECTIONS } from "./childData";
import type { HeroJourneyRender } from "../types";

function memoryBackend(): HeroRenderBackend & { map: Map<string, SavedHeroRender> } {
  const map = new Map<string, SavedHeroRender>();
  return {
    map,
    async get(id) { return map.get(id); },
    async put(r) { map.set(r.id, r); },
    async delete(id) { map.delete(id); },
    async getAll() { return [...map.values()]; },
    async clear() { map.clear(); },
  };
}

const story = { id: "noahs-ark", beats: [{ id: "call" }, { id: "decision" }, { id: "reflection" }] };
const render = (words: string): HeroJourneyRender => ({ storyId: story.id, title: "T", scenes: [{ beatId: "call", title: "t", narration: words, imagePrompt: "ark" }], choices: [], reflection: { practiced: [], questions: [] } });
const flush = () => new Promise((r) => setTimeout(r, 0));

let backend: ReturnType<typeof memoryBackend>;
beforeEach(() => { backend = memoryBackend(); _setHeroRenderBackend(backend); });

const ask = (over: Partial<Parameters<typeof resolvePersonalisedRender>[0]> = {}) => {
  const generate = vi.fn(async () => render("FRESH WORDS"));
  const persistRemote = vi.fn();
  const p = resolvePersonalisedRender({ childId: "c1", story, lang: "en", firstName: "Dana", remote: [], generate, persistRemote, ...over });
  return { p, generate: (over.generate as typeof generate | undefined) ?? generate, persistRemote };
};

describe("B-KID-127: kept, never generated twice", () => {
  it("first open generates ONCE and keeps it (device + account copy, doc id story|lang)", async () => {
    const { p, generate, persistRemote } = ask();
    expect((await p).source).toBe("generated");
    expect(generate).toHaveBeenCalledTimes(1);
    expect(persistRemote).toHaveBeenCalledWith(expect.objectContaining({ id: heroRenderDocId(story.id, "en"), storyId: story.id, lang: "en" }));
    await flush();
    expect(backend.map.size).toBe(1);
  });
  it("after a simulated reload (memory front gone, device store seeded): zero generation, the kept words", async () => {
    await ask().p;
    await flush();
    _resetHeroRenderFront();
    expect(getSavedRender("c1", story.id, "en", renderSignature("Dana", story))).toBeUndefined();
    await hydrateHeroRenders("c1");
    expect(getSavedRender("c1", story.id, "en", renderSignature("Dana", story))?.scenes[0].narration).toBe("FRESH WORDS");
    const again = ask();
    const out = await again.p;
    expect(out.source).toBe("device");
    expect(out.render.scenes[0].narration).toBe("FRESH WORDS");
    expect(again.generate).not.toHaveBeenCalled();
  });
  it("another device: the account copy is used, zero generation", async () => {
    const doc: SavedHeroRender = { id: heroRenderDocId(story.id, "he"), childId: "", storyId: story.id, lang: "he", sig: renderSignature("Dana", story), savedAt: "2026-10-01T00:00:00Z", render: render("מילים שמורות") };
    const r = ask({ lang: "he", remote: [doc] });
    expect((await r.p).source).toBe("account");
    expect(r.generate).not.toHaveBeenCalled();
  });
  it("language is part of the key: an English render is never the Hebrew one", async () => {
    await ask().p;
    const he = ask({ lang: "he" });
    expect((await he.p).source).toBe("generated");
    expect(he.generate).toHaveBeenCalledTimes(1);
  });
  it("a name change invalidates the kept render", async () => {
    await ask().p;
    const renamed = ask({ firstName: "Noa" });
    expect((await renamed.p).source).toBe("generated");
  });
  it("a blocked or failed answer is never kept", async () => {
    const failing = vi.fn(async (): Promise<HeroJourneyRender> => { throw new Error("blocked"); });
    const persistRemote = vi.fn();
    await expect(resolvePersonalisedRender({ childId: "c1", story, lang: "en", firstName: "Dana", remote: [], generate: failing, persistRemote })).rejects.toThrow("blocked");
    await flush();
    expect(backend.map.size).toBe(0);
    expect(persistRemote).not.toHaveBeenCalled();
    expect(getSavedRender("c1", story.id, "en", renderSignature("Dana", story))).toBeUndefined();
  });
  it("only a parent's explicit new version writes again (fresh)", async () => {
    await ask().p;
    const fresh = ask({ fresh: true, generate: vi.fn(async () => render("NEW VERSION")) });
    expect((await fresh.p).render.scenes[0].narration).toBe("NEW VERSION");
    expect(getSavedRender("c1", story.id, "en", renderSignature("Dana", story))?.scenes[0].narration).toBe("NEW VERSION");
  });
  it("text only: a render carrying image data is never stored", () => {
    const withImage = render("x");
    withImage.scenes[0].imagePrompt = "data:image/png;base64,AAAA";
    expect(isTextOnlyRender(withImage)).toBe(false);
    expect(saveRender("c1", story.id, "en", "s", withImage)).toBeNull();
  });
  it("bounded by count of stories; erase removes the child's renders from the device", async () => {
    expect(MAX_RENDERS).toBeGreaterThan(20);
    await ask().p;
    await flush();
    await purgeHeroRenders("c1");
    expect(backend.map.size).toBe(0);
    expect(getSavedRender("c1", story.id, "en", renderSignature("Dana", story))).toBeUndefined();
  });
  it("the account collection is registered for export + erase", () => {
    expect(CHILD_SUBCOLLECTIONS).toContain("heroRenders");
  });
});
