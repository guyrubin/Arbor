/**
 * B-KID-54 (KB-04) — the parent ComicReader: RTL Back goes back, the chrome is
 * keyed (EN + HE), and Save is one download (the share card).
 * Before: Back called go(rtl ? 1 : -1) — in Hebrew it turned the page FORWARD;
 * ~15 English literals rendered in a Hebrew reader; Save downloaded the raw
 * cover AND the share card. Static (no jsdom in this repo).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { en, he } from "../../lib/i18nElevation/kidsStories";

const src = readFileSync(path.join(__dirname, "ComicReader.tsx"), "utf8");
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/[^\n]*/g, "");
const KEYS = ["comic.error", "comic.tryAgain", "comic.back", "comic.end", "comic.endBody", "comic.save", "comic.share",
  "comic.another", "comic.aria", "comic.bookshelf", "comic.brand", "comic.read", "comic.finish", "comic.shareText"];

describe("B-KID-54: Back goes back in both directions", () => {
  it("the on-screen Back always steps to the previous page", () => {
    expect(code).toContain("onClick={() => go(-1)} disabled={pageIndex === 0}");
    expect(code).not.toMatch(/<PlayButton[^>]*onClick=\{\(\) => go\(rtl \? 1 : -1\)\}/);
    // the ARROW keys stay direction-aware (ArrowLeft is forward in RTL) — that is correct
    expect(code).toContain('if (e.key === "ArrowLeft") { e.preventDefault(); go(rtl ? 1 : -1); }');
  });
});

describe("B-KID-54: the chrome is keyed", () => {
  it("no English text node or English template literal is rendered", () => {
    // JSX text between tags that carries Latin letters (icons are components, not text)
    const jsx = code.slice(code.indexOf("if (bookError) {"));
    const textNodes = [...jsx.matchAll(/(?<![=-])>([^<>{}]*[A-Za-z][^<>{}]*)</g)].map((m) => m[1].trim()).filter(Boolean);
    expect(textNodes).toEqual([]);
    expect(code).not.toMatch(/`[^`]*'s comic[^`]*`/);
    expect(code).not.toMatch(/`Page \$\{/);
    expect(code).not.toMatch(/title="The End!"/);
  });
  it.each(KEYS)("%s exists in EN and in Hebrew", (key) => {
    expect(en[key], key).toBeTruthy();
    expect(/[א-ת]/.test(he[key] ?? ""), key).toBe(true);
    expect(code).toContain(`kidsStoriesText("${key}", lang`);
  });
  it("the Hebrew end line names no gender (the child's name carries it)", () => {
    expect(he["comic.endBody"]).not.toMatch(/[א-ת]\/[א-ת]/);
    expect(he["comic.endBody"]).toContain("{name}");
  });
});

describe("B-KID-54: Save is one download", () => {
  it("handleSave downloads the share card only (no raw-cover anchor)", () => {
    const save = code.slice(code.indexOf("const handleSave = () => {"), code.indexOf("const handleShare = async"));
    expect(save).toContain("downloadHeroAvatarCanvas(");
    expect(save).not.toContain('document.createElement("a")');
  });
});
