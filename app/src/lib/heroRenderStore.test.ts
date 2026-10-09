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
  type HeroRenderBackend, type SavedHeroRender, type SignedBeat,
} from "./heroRenderStore";
import { CHILD_SUBCOLLECTIONS } from "./childData";
import { getStorySpec } from "./heroJourneys";
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
  it("B-KID-132: re-authored WORDS (same beat ids) invalidate the kept render, so the child gets the new book", async () => {
    const real = getStorySpec("david-and-goliath")!;
    const sig = renderSignature("Dana", real);
    expect(renderSignature("Dana", { ...real, beats: real.beats.map((b) => ({ ...b })) })).toBe(sig); // same words, same sig
    const respun = real.beats.map((b, i) => (i === 0 ? { ...b, spine: `${b.spine} More.` } : b));
    expect(renderSignature("Dana", { ...real, beats: respun })).not.toBe(sig);
    const b1 = real.beats[1];
    const edits: SignedBeat[] = [{ ...b1, title: "x" }, { ...b1, titleHe: "x" }, { ...b1, spineHe: "x" }, { ...b1, spineHeF: "x" }];
    for (const e of edits) {
      expect(renderSignature("Dana", { ...real, beats: real.beats.map((b, i) => (i === 1 ? e : b)) })).not.toBe(sig);
    }
    const choiceEdit = real.beats.map((b) => (b.choices ? { ...b, choices: b.choices.map((c, i) => (i === 2 ? { ...c, outcomeHintHeF: "y" } : c)) } : b));
    expect(renderSignature("Dana", { ...real, beats: choiceEdit })).not.toBe(sig);
    // the store: a render kept for the old words is not served for the new ones
    const before = { ...real, beats: respun };
    await ask({ story: before }).p;
    const again = ask({ story: before });
    expect((await again.p).source).toBe("device");
    const rewritten = ask({ story: real });
    expect((await rewritten.p).source).toBe("generated");
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

describe("B-BOOK-28: only a current parent request can generate and persist", () => {
  it("an already retired request does not even read the device", async () => {
    const get = vi.spyOn(backend, "get");
    const request = ask({ isCurrent: () => false });
    await expect(request.p).rejects.toThrow("Story request retired");
    expect(get).not.toHaveBeenCalled();
    expect(request.generate).not.toHaveBeenCalled();
    expect(request.persistRemote).not.toHaveBeenCalled();
  });
  it("retiring during device lookup prevents account adoption and new generation", async () => {
    let release!: (value: undefined) => void;
    vi.spyOn(backend, "get").mockReturnValue(new Promise(resolve => { release = resolve; }));
    let current = true;
    const account: SavedHeroRender = { id: "noahs-ark|en", childId: "c1", storyId: story.id, lang: "en", sig: renderSignature("Dana", story), savedAt: "2026-10-01T00:00:00Z", render: render("ACCOUNT") };
    const request = ask({ remote: [account], isCurrent: () => current });
    current = false; release(undefined);
    await expect(request.p).rejects.toThrow("Story request retired");
    expect(request.generate).not.toHaveBeenCalled();
    expect(backend.map.size).toBe(0);
    expect(getSavedRender("c1", story.id, "en", account.sig)).toBeUndefined();
  });
  it("retiring while the model is pending discards the result before device and account persistence", async () => {
    let release!: (value: HeroJourneyRender) => void;
    const generate = vi.fn(() => new Promise<HeroJourneyRender>(resolve => { release = resolve; }));
    let current = true;
    const request = ask({ fresh: true, generate, isCurrent: () => current });
    expect(generate).toHaveBeenCalledOnce();
    current = false; release(render("LATE PARENT WORDS"));
    await expect(request.p).rejects.toThrow("Story request retired");
    await flush();
    expect(request.persistRemote).not.toHaveBeenCalled();
    expect(backend.map.size).toBe(0);
    expect(getSavedRender("c1", story.id, "en", renderSignature("Dana", story))).toBeUndefined();
  });
  it("positive control: a current parent request still keeps device and account copies", async () => {
    const request = ask({ isCurrent: () => true });
    expect((await request.p).source).toBe("generated");
    await flush();
    expect(request.generate).toHaveBeenCalledOnce();
    expect(request.persistRemote).toHaveBeenCalledOnce();
    expect(backend.map.size).toBe(1);
  });
});
