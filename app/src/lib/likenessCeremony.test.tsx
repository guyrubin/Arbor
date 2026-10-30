/**
 * Likeness ceremony — a Kids Studio picture of the child waits for a parent
 * choice before it leaves. EN + HE. The choice is not stored.
 */
import React from "react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { translate } from "./i18n";
import { companionEn, companionHe } from "./i18nCompanion";
import {
  answerLikenessCeremony,
  currentLikenessPreview,
  imageCarriesChildLook,
  releaseChildLikeness,
  subscribeLikenessCeremony,
} from "./likenessCeremony";
import { LikenessCeremonyView, likenessCeremonyCopy } from "../components/trust/LikenessCeremony";

const h = vi.hoisted(() => ({ kid: false }));
vi.mock("./kidModeGate", () => ({
  isKidModeActive: () => h.kid,
  subscribeKidMode: () => () => {},
}));

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..");
const PICTURE = "data:image/png;base64,QQ";
const KEYS = [
  "companion.likeness.title",
  "companion.likeness.titleNoName",
  "companion.likeness.body",
  "companion.likeness.use",
  "companion.likeness.keep",
  "companion.likeness.alt",
  "companion.likeness.altNoName",
  "companion.likeness.label",
] as const;
const VERDICT = /\b(on track|behind|delayed|at risk|percentile|ahead|advanced|below average|above average|normal range|score|diagnos\w*|assess\w*)\b|%/i;

afterEach(() => {
  h.kid = false;
  answerLikenessCeremony(false);
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

describe("what counts as the child's look", () => {
  it("holds a generated picture and a private book file, and lets shared art through", () => {
    expect(imageCarriesChildLook(PICTURE)).toBe(true);
    expect(imageCarriesChildLook("data:image/jpeg;base64,/9j/")).toBe(true);
    expect(imageCarriesChildLook("data:image/webp;base64,UklG")).toBe(true);
    expect(imageCarriesChildLook("/children/child-1/books/hero-sheets/h-1/prints/cover.webp")).toBe(true);
    expect(imageCarriesChildLook("hero-sheets/h-1/idle.webp")).toBe(true);
    expect(imageCarriesChildLook("/visuals/stories/v1/lantern.webp")).toBe(false);
    expect(imageCarriesChildLook("data:image/svg+xml;utf8,x")).toBe(false);
    expect(imageCarriesChildLook("https://photos.invalid/raw.jpg")).toBe(false);
    expect(imageCarriesChildLook("")).toBe(false);
    expect(imageCarriesChildLook(null)).toBe(false);
  });
});

describe("the picture leaves only after the parent says so", () => {
  it("keeps the picture when no parent host is listening", async () => {
    await expect(releaseChildLikeness({ src: PICTURE, name: "Noa" })).resolves.toBe(false);
    expect(currentLikenessPreview()).toBeNull();
  });

  it("keeps the picture in Kid Mode and does not open the ceremony", async () => {
    h.kid = true;
    let opened = 0;
    const stop = subscribeLikenessCeremony(() => { opened += 1; });
    await expect(releaseChildLikeness({ src: PICTURE, name: "Noa" })).resolves.toBe(false);
    expect(opened).toBe(0);
    expect(currentLikenessPreview()).toBeNull();
    stop();
  });

  it("lets a picture without the child's look leave without asking", async () => {
    let opened = 0;
    const stop = subscribeLikenessCeremony(() => { opened += 1; });
    await expect(releaseChildLikeness({ src: "/visuals/stories/v1/lantern.webp", name: "Noa" })).resolves.toBe(true);
    expect(opened).toBe(0);
    stop();
  });

  it("use this likeness lets it leave; keep private holds it; the next picture waits its turn", async () => {
    const stop = subscribeLikenessCeremony(() => {});
    const first = releaseChildLikeness({ src: PICTURE, name: "Noa Levi" });
    const second = releaseChildLikeness({ src: "data:image/jpeg;base64,QUE=", name: "Noa" });
    expect(currentLikenessPreview()).toEqual({ src: PICTURE, name: "Noa Levi" });
    answerLikenessCeremony(true);
    await expect(first).resolves.toBe(true);
    expect(currentLikenessPreview()?.src).toBe("data:image/jpeg;base64,QUE=");
    answerLikenessCeremony(false);
    await expect(second).resolves.toBe(false);
    expect(currentLikenessPreview()).toBeNull();
    stop();
  });

  it("closing the host keeps a picture that was still waiting", async () => {
    const stop = subscribeLikenessCeremony(() => {});
    const pending = releaseChildLikeness({ src: PICTURE, name: "Noa" });
    stop();
    await expect(pending).resolves.toBe(false);
  });

  it("is not written anywhere", () => {
    const src = readFileSync(path.join(here, "likenessCeremony.ts"), "utf8");
    expect(src).not.toMatch(/localStorage|sessionStorage|firestore|indexedDB|setItem/i);
  });
});

describe("the parent gate, both languages", () => {
  function html(lang: "en" | "he", name?: string) {
    const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
    const copy = likenessCeremonyCopy(t, name);
    return renderToStaticMarkup(
      <LikenessCeremonyView
        dir={lang === "he" ? "rtl" : "ltr"}
        src={PICTURE}
        {...copy}
        onUse={() => {}}
        onKeep={() => {}}
      />,
    );
  }

  it("English says the locked actions, and Hebrew is Hebrew", () => {
    expect(companionEn["companion.likeness.use"]).toBe("Use this likeness");
    expect(companionEn["companion.likeness.keep"]).toBe("Keep private");
    const en = html("en", "Noa Levi");
    const he = html("he", "נועה");
    expect(en).toContain("Use this likeness");
    expect(en).toContain("Keep private");
    expect(en).toContain("Noa&#x27;s picture");
    expect(en).toContain('dir="ltr"');
    expect(he).toContain('dir="rtl"');
    expect(he).toContain("להשתמש בדמות הזו");
    expect(he).toContain("להשאיר פרטי");
    expect(he).toContain("התמונה של");
    for (const markup of [en, he]) {
      expect(markup).toContain(`src="${PICTURE}"`);
      expect(markup).toContain('data-testid="likeness-use"');
      expect(markup).toContain('data-testid="likeness-keep"');
      expect(markup).toContain("min-h-11 w-full");
      expect(markup).toContain("max-w-[420px]");
      const words = markup.replace(/<span class="msr"[^>]*>[^<]*<\/span>/g, "").replace(/<[^>]*>/g, " ");
      expect(words).not.toMatch(VERDICT);
    }
    const text = he.replace(/<span class="msr"[^>]*>[^<]*<\/span>/g, "").replace(/<[^>]*>/g, " ").replace(PICTURE, "");
    expect(text).not.toMatch(/[A-Za-z]/);
  });

  it("a picture with no name still has both actions", () => {
    const markup = html("en");
    expect(markup).toContain("This picture");
    expect(markup).toContain("The picture about to leave");
    expect(markup).not.toContain("{name}");
  });

  it("every key exists in both languages, with the same placeholders, and no verdict", () => {
    const en = companionEn as Record<string, string>;
    const he = companionHe as Record<string, string>;
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of KEYS) {
      expect(en[key], key).toBeTruthy();
      expect(he[key], key).toBeTruthy();
      expect(translate("en", key, { name: "Noa" })).toBe(en[key].replaceAll("{name}", "Noa"));
      expect(he[key].replace(/\{\w+\}/g, "")).not.toMatch(/[A-Za-z]/);
      expect(vars(he[key]), key).toEqual(vars(en[key]));
      expect(en[key], key).not.toMatch(VERDICT);
      expect(he[key], key).not.toMatch(VERDICT);
    }
  });
});

describe("every share or export of a child picture goes through the ceremony", () => {
  const SHIP = /\b(?:downloadHeroAvatarCanvas|downloadPracticeStampCanvas|shareImageFile)\s*\(/;
  const DEFINITIONS = new Set(["lib/heroAvatarCanvas.ts", "lib/share.ts"]);

  it("the live callers ask before they ship, and the shell mounts the host", () => {
    const callers = walk(SRC)
      .map((file) => path.relative(SRC, file).split(path.sep).join("/"))
      .filter((rel) => !DEFINITIONS.has(rel) && SHIP.test(readFileSync(path.join(SRC, rel), "utf8")));
    expect(callers.sort()).toEqual([
      "components/kidmode/SneakHandBackCard.tsx",
      "components/practice/MimicStudioTab.tsx",
      "components/stories/ComicReader.tsx",
      "components/stories/HeroScenePlayer.tsx",
    ]);
    for (const rel of callers) {
      const src = readFileSync(path.join(SRC, rel), "utf8");
      const ask = src.indexOf("releaseChildLikeness");
      const ship = src.search(SHIP);
      expect(ask, rel).toBeGreaterThanOrEqual(0);
      expect(ask, rel).toBeLessThan(ship);
      expect(src, rel).toContain("if (!allowed) return");
    }
    const comic = readFileSync(path.join(SRC, "components/stories/ComicReader.tsx"), "utf8");
    const share = comic.slice(comic.indexOf("const handleShare = async"));
    expect(share.indexOf("releaseChildLikeness")).toBeLessThan(share.indexOf("trackShareInitiated"));
    expect(share.indexOf("releaseChildLikeness")).toBeLessThan(share.indexOf("nav.share"));
    expect(readFileSync(path.join(SRC, "components/layout/Shell.tsx"), "utf8")).toContain("<LikenessCeremonyHost />");
  });
});
