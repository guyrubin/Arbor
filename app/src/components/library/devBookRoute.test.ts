/**
 * B-BOOK-05 — the DEV review route: URL parsing (pure) and the main.tsx seam
 * (DEV-only, before the app's own render; the B-DIST-01 pin still holds).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/voice", () => ({ speakText: vi.fn(() => 0), stopVoice: vi.fn(), voiceSupported: () => false, voiceState: () => ({ speaking: false, engine: "basic" }) }));

import { parseDevBookParams } from "./devBookRoute";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("parseDevBookParams", () => {
  it("defaults: the proof book, EN, boy, the dylan-v2 DEV sheet, probe narration", () => {
    const p = parseDevBookParams("?book=");
    expect(p.bookId).toBe("five-smooth-stones");
    expect(p.lang).toBe("en");
    expect(p.child).toMatchObject({ gender: "boy", heroSheetId: "dylan-v2" });
    expect(p.narration).toBe("probe");
    expect(p.prints).toBe(true);
    expect(p.costume).toBeNull();
  });

  it("voice=<set> picks the narration folder (default: the hero sheet's); unsafe values fall back", () => {
    expect(parseDevBookParams("?book=").voiceSet).toBeNull();
    expect(parseDevBookParams("?book=&voice=dylan-v2-expressive").voiceSet).toBe("dylan-v2-expressive");
    expect(parseDevBookParams("?book=&voice=../x").voiceSet).toBeNull();
  });

  it("prints=0 turns the printed pages off; costume=tunic is the p5 A/B", () => {
    const p = parseDevBookParams("?book=five-smooth-stones&prints=0&costume=tunic");
    expect(p.prints).toBe(false);
    expect(p.costume).toBe("tunic");
    expect(parseDevBookParams("?book=x&costume=cape").costume).toBeNull();
  });

  it("reads book, hero, lang, gender, name; unknown or unsafe values fall back", () => {
    const p = parseDevBookParams("?book=abrams-long-road&hero=placeholder&lang=he&gender=f&name=%D7%A0%D7%95%D7%A2%D7%94&narration=off");
    expect(p).toMatchObject({ bookId: "abrams-long-road", lang: "he", narration: "off" });
    expect(p.child).toMatchObject({ name: "נועה", gender: "girl", heroSheetId: "placeholder" });
    expect(parseDevBookParams("?book=../../etc").bookId).toBe("five-smooth-stones");
    expect(parseDevBookParams("?book=nope").bookId).toBe("five-smooth-stones");
    expect(parseDevBookParams("?book=x&hero=none").child.heroSheetId).toBeNull();
    expect(parseDevBookParams("?book=x&hero=../x").child.heroSheetId).toBeNull();
  });
});

describe("the main.tsx seam", () => {
  const main = readFileSync(path.join(here, "..", "..", "main.tsx"), "utf8");
  it("is DEV-only and keyed on ?book, and loads the route lazily", () => {
    expect(main).toMatch(/const devBookReview = import\.meta\.env\.DEV && new URLSearchParams\(window\.location\.search\)\.has\('book'\);/);
    expect(main).toMatch(/if \(devBookReview\) void import\('\.\/components\/library\/devBookRoute'\)/);
    // the app's own render path is unchanged (B-DIST-01 pin)
    expect(main).toMatch(/if \(firebaseEnabled\) renderApp\(\);\s*else void hydrateDemoFamily\(\)/);
  });
});
