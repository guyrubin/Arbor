/**
 * B-GAME-07b — Sneak & Freeze on a rendered stage (react-dom/server; no jsdom
 * in this repo), behind its flag, with its sound table and art slots.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../lib/kidModeGate", () => ({ isKidModeActive: () => true, subscribeKidMode: () => () => {}, noteKidActivity: () => {} }));
vi.mock("../../../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: "en", aiLang: "en", t: (k: string) => k }) }));
vi.mock("../../../../context/ArborContext", () => ({
  useArborOptional: () => ({ childProfile: { id: "c1", name: "Dylan", gender: "boy", age: 5 } }),
  useArbor: () => ({ childProfile: { id: "c1", name: "Dylan", gender: "boy", age: 5 } }),
}));
vi.mock("../../../../lib/voice", () => ({ speakText: vi.fn(), stopVoice: vi.fn(), voiceSupported: () => true, voiceState: () => ({ speaking: false, engine: "basic" }) }));
vi.mock("../../../../practice/usePracticeData", () => ({ usePracticeData: () => ({ events: { items: [], upsert: async () => {} } }) }));

import SneakFreeze, { formKey } from "./SneakFreeze";
import { SNEAK_SOUNDS, SNEAK_VOICE_IDS, createSneakSounds } from "./sounds";
import type { KidSoundBank, PlayOptions } from "../../audio/kidSoundBank";
import { mergeArt, readSneakArt, watcherSprite } from "./sneakArt";
import { devPlaceholderArt } from "./devPlaceholderArt";
import { KID_WORLDS, SNEAK_FREEZE_WORLD, flaggedWorldNameKey, resetSneakFreezeFlagForTests, sneakFreezeFlagOn } from "../../kidWorlds";
import { translate } from "../../../../lib/i18n";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(path.join(here, ...p), "utf8");
const textOf = (html: string) => html.replace(/<[^>]*>/g, " ");
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

describe("Sneak & Freeze — the stage", () => {
  const html = renderToStaticMarkup(<SneakFreeze />);

  it("is a full-bleed play field: plate, three cover objects, the cat, the hero", () => {
    expect(html).toContain('data-full-bleed=""');
    expect(html).toMatch(/data-play-field="(portrait|landscape)"/);
    expect(html).toContain("data-sneak-plate");
    expect((html.match(/data-cover="/g) ?? []).length).toBe(3);
    expect(html).toContain("data-watcher=");
    expect(html).toContain('data-hero-figure="idle"');
    expect(html).toContain('data-sneak-stage=""');
    expect(html).toContain('role="button"');
    expect(html).toMatch(/aria-label="[^"]*kid\.game\.sneak-freeze\.stageAria\.boy[^"]*"/);
  });

  it("shows no instruction paragraph, no progress dots, no digit, no emoji; the intro shows the hand, not words", () => {
    expect(html).not.toContain("data-game-instruction");
    expect(html).not.toContain("data-game-progress");
    expect(textOf(html)).not.toMatch(/[0-9]/);
    expect(textOf(html)).not.toMatch(EMOJI);
    expect(html).toContain('data-sneak-hand=""');
    expect(html).not.toContain("data-sneak-hint");
  });

  it("the source carries no score, star, streak, timer or level text and no emoji", () => {
    for (const f of ["SneakFreeze.tsx", "Watcher.tsx"]) {
      const src = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
      expect(src, f).not.toMatch(EMOJI);
      expect(src, f).not.toMatch(/\b(score|stars?|streak|timer|countdown)\b/i);
    }
  });

  it("one rAF loop that pauses while hidden; a touch is stepped at once", () => {
    const src = read("SneakFreeze.tsx");
    expect((src.match(/requestAnimationFrame\(tick\)/g) ?? []).length).toBe(2);
    expect(src).toContain("document.hidden ? stopLoop() : startLoop()");
    expect(src).toMatch(/const press = [\s\S]*?pump\(0\);/);
    expect(src).not.toMatch(/setInterval\(/);
  });
});

describe("Sneak & Freeze — behind its flag", () => {
  it("is on by default (Guy, 6 Oct: production), never part of the registry, and a device can opt out with \"0\"", () => {
    resetSneakFreezeFlagForTests();
    expect(sneakFreezeFlagOn()).toBe(true); // no localStorage here = no opt-out = on
    const g = globalThis as { localStorage?: unknown };
    g.localStorage = { getItem: (k: string) => (k === "arbor.flags.sneakFreeze" ? "0" : null) };
    resetSneakFreezeFlagForTests();
    expect(sneakFreezeFlagOn()).toBe(false);
    delete g.localStorage;
    resetSneakFreezeFlagForTests();
    expect(KID_WORLDS.some((w) => (w.worldId as string) === SNEAK_FREEZE_WORLD.worldId)).toBe(false);
    expect(flaggedWorldNameKey("sneak")).toBe(SNEAK_FREEZE_WORLD.nameKey);
    expect(flaggedWorldNameKey("pattern")).toBeUndefined();
  });

  it("has its name and lines in EN and HE, Hebrew addressed by form", () => {
    expect(translate("en", "kid.game.sneak-freeze.title")).toBe("Sneak & Freeze");
    expect(translate("he", "kid.game.sneak-freeze.title")).toBe("דג מלוח");
    // B-GAME-07c: no on-screen hint line any more (the hint is the whispered voice line)
    expect(translate("en", "kid.game.sneak-freeze.hint")).toBe("kid.game.sneak-freeze.hint");
    for (const base of ["kid.game.sneak-freeze.stageAria"]) {
      const forms = ["", ".boy", ".girl"].map((f) => translate("he", base + f));
      expect(new Set(forms).size).toBe(3);
      for (const f of forms) expect(f).toMatch(/[א-ת]/);
      for (const f of ["", ".boy", ".girl"]) expect(translate("en", base + f)).not.toBe(base + f);
    }
    expect(formKey("x", "girl")).toBe("x.girl");
    expect(formKey("x", "other")).toBe("x");
    expect(formKey("x", undefined)).toBe("x");
  });
});

describe("Sneak & Freeze — sounds and art slots", () => {
  it("every rules event has one row in the sound table; no device speech in the scene", () => {
    const rules = read("rules.ts");
    const union = rules.slice(rules.indexOf("export type SneakEventId"), rules.indexOf(";", rules.indexOf("export type SneakEventId")));
    const ids = [...union.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(10);
    expect(Object.keys(SNEAK_SOUNDS).sort()).toEqual([...ids].sort());
    expect(read("sounds.ts")).not.toMatch(/kidSay|speakText|speechSynthesis/);
    // ruling G13: no synthesised cue inside the scene
    for (const f of ["sounds.ts", "SneakFreeze.tsx", "Watcher.tsx", "Ending.tsx"]) expect(read(f), f).not.toMatch(/kidSfx|createOscillator/);
  });

  function fakeBank() {
    const played: [string, PlayOptions | undefined][] = [];
    const bank: KidSoundBank = {
      load: async () => true,
      play: (id, o) => { played.push([id, o]); return true; },
      has: () => true,
      durationMs: () => 1800,
      unlock: vi.fn(),
      stopVoice: vi.fn(),
      dispose: vi.fn(),
    };
    return { bank, played };
  }

  it("files only: beat k says n k (cutting), the chant's end calls 'freeze' with the ear flick, steps round-robin", () => {
    const { bank, played } = fakeBank();
    const snd = createSneakSounds("he", bank);
    snd.events(["beat"], { beatIndex: 0 });
    snd.events(["beat"], { beatIndex: 2 });
    snd.events(["beat"], { beatIndex: 9 });
    snd.events(["tell"], { beatIndex: 3 });
    snd.events(["step", "step", "step", "step"], { beatIndex: 0 });
    snd.events(["look"], { beatIndex: 0 });
    expect(played.map(([id, o]) => `${o?.kind}:${id}${o?.mode === "cut" ? "!" : ""}`)).toEqual([
      "voice:n1!", "voice:n3!", "voice:n5!", "foley:tell", "voice:freeze!", "foley:step1", "foley:step2", "foley:step3", "foley:step1", "foley:turn",
    ]);
  });

  it("lines rotate and queue; the sunglasses line plays once per sitting and its chant words wait", () => {
    const { bank, played } = fakeBank();
    const snd = createSneakSounds("en", bank);
    for (let i = 0; i < 4; i++) snd.events(["statue"], { beatIndex: 0 });
    snd.events(["caught"], { beatIndex: 0 });
    snd.events(["caught"], { beatIndex: 0 });
    snd.events(["sunglasses", "beat"], { beatIndex: 0 });
    snd.events(["sunglasses"], { beatIndex: 0 });
    const ids = played.map(([id]) => id);
    expect(ids).toEqual(["statue1", "statue2", "statue3", "statue1", "plop", "caught1", "plop", "caught2", "sunglasses"]);
    expect(played.find(([id]) => id === "statue1")?.[1]?.mode).toBe("queue");
    snd.newSitting();
    snd.events(["sunglasses"], { beatIndex: 0 });
    expect(played.filter(([id]) => id === "sunglasses")).toHaveLength(2);
    snd.intro();
    snd.again();
    expect(played.slice(-2).map(([id]) => id)).toEqual(["intro", "again"]);
  });

  it("every voice line the game plays is a declared voice id", () => {
    const used = new Set<string>();
    for (const row of Object.values(SNEAK_SOUNDS)) if (row.voice !== "count") row.voice.forEach((v) => used.add(v));
    for (const v of used) expect(SNEAK_VOICE_IDS as readonly string[]).toContain(v);
    for (const v of ["n1", "n2", "n3", "n4", "n5", "intro", "again", "laugh1", "laugh2", "fake", "hint", "waiting"]) expect(SNEAK_VOICE_IDS as readonly string[]).toContain(v);
  });

  it("the placeholder fills every slot; injected art merges slot by slot and rejects unsafe urls", () => {
    const base = devPlaceholderArt();
    expect(base.source).toBe("dev-placeholder");
    for (const s of ["counting", "tell", "looking", "laughing", "sunglasses"] as const) expect(base.watcher[s]?.url).toMatch(/^data:image\/svg\+xml/);
    const merged = mergeArt(base, {
      plate: { landscape: "data:image/webp;base64,AAA", portrait: "javascript:x" },
      watcher: { looking: { url: "data:image/webp;base64,BBB", w: 600, h: 800, anchor: { x: 300, y: 790 } } },
      prizes: { bell: { url: "/x.webp", w: 10, h: 10, anchor: { x: 5, y: 5 } }, spoon: { url: "/y.webp", w: 1, h: 1, anchor: { x: 0, y: 0 } } },
    });
    expect(merged.source).toBe("injected");
    expect(merged.plate.landscape).toBe("data:image/webp;base64,AAA");
    expect(merged.plate.portrait).toBe(base.plate.portrait);
    expect(merged.watcher.looking?.w).toBe(600);
    expect(merged.prizes.bell.url).toBe("/x.webp");
    expect(merged.prizes).not.toHaveProperty("spoon");
    expect(readSneakArt({ getItem: () => "{bad" }).source).toBe("dev-placeholder");
    expect(watcherSprite(base, "looking", true).slot).toBe("sunglasses");
    expect(watcherSprite(base, "laughing", true).slot).toBe("laughing");
    // B-GAME-07d: the sunglasses sprite is the cat FROM BEHIND — only while it looks.
    expect(watcherSprite(base, "counting", true).slot).toBe("counting");
    expect(watcherSprite(base, "tell", true).slot).toBe("tell");
    const noShades = { ...base, watcher: { counting: base.watcher.counting, looking: base.watcher.looking } };
    expect(watcherSprite(noShades, "looking", true).slot).toBe("looking");
    expect(watcherSprite(noShades, "waiting", false).slot).toBe("counting");
  });
});

describe("B-GAME-07f — the courtyard is alive, the tag is a moment", () => {
  const html = renderToStaticMarkup(<SneakFreeze />);

  it("idle life is pooled and small: at most 8 petals, the lantern glint, a 24-piece tag burst mounted once", () => {
    const petals = html.match(/data-sneak-petals=""[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
    expect((petals.match(/<span /g) ?? []).length).toBeLessThanOrEqual(8);
    expect((petals.match(/<span /g) ?? []).length).toBeGreaterThan(0);
    expect(html).toContain("data-sneak-glint");
    expect(html).toContain('data-sneak-burst="24"');
    expect((html.match(/data-sneak-burst=/g) ?? []).length).toBe(1);
    expect(html).toContain("data-play-punch");
  });

  it("every animation is transform / opacity only; reduced motion shows and moves none of it", () => {
    for (const f of ["courtyardLife.tsx", "Watcher.tsx", "SneakFreeze.tsx", "Ending.tsx"]) {
      const src = read(f);
      for (const m of src.matchAll(/\.animate\(\s*\[([\s\S]*?)\]\s*,/g)) {
        const keys = [...m[1].matchAll(/([a-zA-Z]+)\s*:/g)].map((k) => k[1]);
        for (const k of keys) expect(["transform", "opacity", "offset"], `${f}: ${k}`).toContain(k);
      }
    }
    const life = read("courtyardLife.tsx");
    expect((life.match(/prefersReducedMotion\(\)/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect(life).not.toMatch(/setInterval|setTimeout|requestAnimationFrame/);
  });
});

describe("B-GAME-06b — the covers sit in the plate", () => {
  it("the covers sit in the plate (a softer, less saturated cut-out); never the hero", () => {
    const html = renderToStaticMarkup(<SneakFreeze />);
    const covers = html.match(/<img[^>]*data-cover="[^"]*"[^>]*>/g) ?? [];
    expect(covers).toHaveLength(3);
    for (const c of covers) expect(c).toContain("filter:saturate(0.88) brightness(0.98)");
    for (const h of html.match(/<img[^>]*data-hero-pose="[^"]*"[^>]*>/g) ?? []) expect(h).not.toContain("filter:");
  });
});
