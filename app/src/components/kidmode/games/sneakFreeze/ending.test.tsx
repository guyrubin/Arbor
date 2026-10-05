/**
 * B-GAME-09 — the statue picture ending: what it shows, that it differs
 * between sittings, that it stays on the device, and that it carries no star,
 * count or network call.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { startSitting, step, type SneakState } from "./rules";
import { PICTURE, pictureLayout, statueShot, toPicture } from "./statuePicture";
import { STATUE_KEEP, keepStatuePicture, readStatuePictures, statuesKey, type StatuePicture } from "./statueStore";
import { Ending, captionKey } from "./Ending";
import { devPlaceholderArt } from "./devPlaceholderArt";
import { devPlaceholderSheet } from "../../hero/devPlaceholderSheet";
import { translate } from "../../../../lib/i18n";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f: string) => readFileSync(path.join(here, f), "utf8");

/** Play a whole sitting: hold while the cat counts, let go at the tell. */
function playSitting(seed: string): SneakState {
  let s = startSitting({ seed, track: "A", level: 1, intro: true });
  for (let t = 0; t < 600000 && s.phase !== "done"; t += 10) {
    s = step(s, 10, { holding: s.phase === "intro" || s.phase === "ready" || s.phase === "counting" });
  }
  return s;
}

function memoryStore(limitChars = Infinity) {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (v.length > limitChars) throw new Error("QuotaExceededError");
      m.set(k, v);
    },
  };
}

describe("the statue picture — composition", () => {
  const a = playSitting("sitting-a");
  const b = playSitting("sitting-b");

  it("pictures the freeze held longest, where the hero stood", () => {
    expect(a.phase).toBe("done");
    const shot = statueShot(a)!;
    const longest = [...a.statues].sort((x, y) => y.heldMs - x.heldMs)[0];
    expect(shot.pose).toBe(longest.pose);
    expect(shot.at).toBeGreaterThan(0);
    expect(shot.at).toBeLessThan(1);
    expect(statueShot({ statues: [] })).toBeNull();
  });

  it("the picture differs between two sittings", () => {
    const sa = statueShot(a)!;
    const sb = statueShot(b)!;
    expect(sa.pose !== sb.pose || Math.abs(sa.at - sb.at) > 1e-6).toBe(true);
    expect(JSON.stringify(pictureLayout(sa))).not.toBe(JSON.stringify(pictureLayout(sb)));
  });

  it("frames the hero (head to feet) and the cat inside a 4:3 picture, mirrored in Hebrew", () => {
    for (const at of [0.08, 0.3, 0.5, 0.7, 0.92]) {
      for (const pose of ["freeze-a", "freeze-b"] as const) {
        const l = pictureLayout({ pose, at });
        expect(l.crop.w / l.crop.h).toBeCloseTo(PICTURE.w / PICTURE.h, 6);
        for (const p of [{ x: l.hero.x, y: l.hero.y }, { x: l.hero.x, y: l.hero.y - l.hero.h }, { x: l.watcher.x, y: l.watcher.y }, { x: l.watcher.x, y: l.watcher.y - l.watcher.h }]) {
          const q = toPicture(l, p, false);
          expect(q.x).toBeGreaterThanOrEqual(0);
          expect(q.x).toBeLessThanOrEqual(PICTURE.w);
          expect(q.y).toBeGreaterThanOrEqual(0);
          expect(q.y).toBeLessThanOrEqual(PICTURE.h);
          expect(toPicture(l, p, true).x).toBeCloseTo(PICTURE.w - q.x, 6);
        }
        // The hero is big enough to read: at least a fifth of the picture's height.
        expect(l.hero.h * l.scale).toBeGreaterThan(PICTURE.h / 5);
      }
    }
  });

  it("is composed on the device: no fetch, no model, no network in the ending's code", () => {
    for (const f of ["statuePicture.ts", "Ending.tsx", "statueStore.ts"]) {
      const src = read(f);
      expect(src, f).not.toMatch(/\bfetch\(|XMLHttpRequest|api\.|generate[A-Z]|firebase|firestore/);
    }
    expect(read("statuePicture.ts")).toContain("drawImage(");
  });
});

describe("the statue pictures kept on the device", () => {
  const pic = (i: number): StatuePicture => ({ id: `s${i}`, at: new Date(2026, 9, 6, 10, i).toISOString(), url: `data:image/jpeg;base64,${"A".repeat(10)}${i}`, pose: i % 2 ? "freeze-a" : "freeze-b" });

  it("keeps the newest twelve, newest first, under a child-scoped key", () => {
    const store = memoryStore();
    for (let i = 0; i < 15; i++) keepStatuePicture("kid1", pic(i), store);
    const kept = readStatuePictures("kid1", store);
    expect(kept).toHaveLength(STATUE_KEEP);
    expect(kept[0].id).toBe("s14");
    expect(kept[kept.length - 1].id).toBe("s3");
    expect(statuesKey("kid1")).toBe("arbor.sneakFreeze.statues.kid1");
  });

  it("when storage is full the oldest pictures make room; garbage reads as empty", () => {
    const store = memoryStore(400);
    for (let i = 0; i < 12; i++) keepStatuePicture("kid1", pic(i), store);
    const kept = readStatuePictures("kid1", store);
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(12);
    expect(kept[0].id).toBe("s11");
    expect(readStatuePictures("kid1", { getItem: () => "{bad", setItem: () => {} })).toEqual([]);
    expect(readStatuePictures("kid1", { getItem: () => JSON.stringify([{ id: "x", at: "t", url: "javascript:1" }]), setItem: () => {} })).toEqual([]);
  });
});

describe("the ending screen", () => {
  const s = playSitting("screen");
  const html = renderToStaticMarkup(
    <Ending
      state={s}
      art={devPlaceholderArt()}
      sheet={devPlaceholderSheet()}
      childId="kid1"
      rtl={false}
      caption={translate("en", captionKey("Dylan", "boy"), { name: "Dylan" })}
      pictureAlt="Dylan as a statue"
      playAgainLabel="Play again"
      homeLabel="Home"
      onPlayAgain={() => {}}
      onHome={() => {}}
    />,
  );

  it("shows the caption, the three prizes and Play again + Home — no stars, no digits, no auto-advance", () => {
    expect(html).toContain("The cat looked… and");
    expect(html).toContain("Dylan");
    expect((html.match(/data-kid-finish-again/g) ?? []).length).toBe(1);
    expect((html.match(/data-kid-finish-home/g) ?? []).length).toBe(1);
    expect(html).toContain("data-sneak-prizes");
    expect(html.match(/data-sneak-prizes[\s\S]*?<\/div>/)?.[0].match(/<img /g)?.length).toBe(3);
    expect(html.replace(/<[^>]*>/g, " ").replace(/&#x?[0-9a-f]+;/gi, "").match(/.{0,30}[0-9].{0,30}/g)).toBeNull();
    expect(html).not.toMatch(/\bstars?\b|data-star|celebrate/i);
    expect(read("Ending.tsx")).not.toMatch(/setTimeout|setInterval/);
  });

  it("names the child in both languages and every form, isolated; a nameless child gets the nameless line", () => {
    expect(captionKey("", "boy")).toBe("kid.game.sneak-freeze.caption.noName");
    expect(captionKey("Noa", "girl")).toBe("kid.game.sneak-freeze.caption.girl");
    expect(captionKey("Noa", "other")).toBe("kid.game.sneak-freeze.caption");
    const he = ["caption", "caption.boy", "caption.girl"].map((k) => translate("he", `kid.game.sneak-freeze.${k}`, { name: "Dylan" }));
    expect(new Set(he).size).toBe(3);
    for (const line of he) {
      expect(line).toMatch(/[א-ת]/);
      // The Latin name inside the Hebrew line is wrapped in a bidi isolate.
      expect(line).toMatch(/[⁦-⁨]Dylan⁩/);
    }
    expect(translate("he", "kid.game.sneak-freeze.caption.noName")).toMatch(/[א-ת]/);
  });
});

describe("B-GAME-09b — ending polish", () => {
  it("the toys wait for the picture; the cat's 'again?' line plays when it is up (no timer, no auto-advance)", () => {
    const s = startSitting({ seed: "polish", track: "A", level: 1 });
    const html = renderToStaticMarkup(
      <Ending state={s} art={devPlaceholderArt()} sheet={devPlaceholderSheet()} childId="kid1" rtl={false} caption="x" pictureAlt="x" playAgainLabel="Play again" homeLabel="Home" onPlayAgain={() => {}} onHome={() => {}} />,
    );
    expect(html).toContain('data-sneak-ending-toys="waiting"');
    expect(html).toContain("data-kid-finish-again");
    const src = read("Ending.tsx");
    expect(src).toMatch(/setReady\(true\);\s*onShown\?\.\(\);/);
    expect(src).not.toMatch(/setTimeout|setInterval/);
    expect(read("SneakFreeze.tsx")).toContain("onShown={() => soundsRef.current?.again()}");
  });

  it("Play again: a new seed, and the next sitting opens on a different prize", () => {
    for (let n = 0; n < 40; n++) {
      const a = startSitting({ seed: `prize-${n}`, track: "A", level: 1 });
      const b = startSitting({ seed: `prize-${n}-next`, track: "A", level: 1, after: a.prizeOrder[0] });
      expect(b.prizeOrder[0]).not.toBe(a.prizeOrder[0]);
      expect([...b.prizeOrder].sort()).toEqual(["bell", "lemon", "wool"]);
    }
    expect(read("SneakFreeze.tsx")).toContain("after: s?.prizeOrder[0]");
  });

  it("the canvas is never tainted: every drawn url is checked same-origin or data BEFORE loading; otherwise no picture, no throw", () => {
    const src = read("statuePicture.ts");
    const check = src.indexOf("if (!urls.every(sameOriginOrData)) return null;");
    expect(check).toBeGreaterThan(0);
    expect(check).toBeLessThan(src.indexOf("await Promise.all("));
    for (const drawn of ["o.art.plate.landscape", "looking.url", "heroPose.sprite.url", "o.art.covers[c.id as keyof SneakArt[\"covers\"]].url"]) {
      expect(src.slice(src.indexOf("const urls = ["), check)).toContain(drawn);
    }
    expect(src).toMatch(/try \{\s*return canvas\.toDataURL/);
  });

  it("the caption isolates the name for bidi both ways", () => {
    const en = translate("en", "kid.game.sneak-freeze.caption.boy", { name: "דילן" });
    expect(en).toMatch(/[⁦-⁨]דילן⁩/);
    const he = translate("he", "kid.game.sneak-freeze.caption.girl", { name: "Noa" });
    expect(he).toMatch(/[⁦-⁨]Noa⁩/);
  });
});

