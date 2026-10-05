/**
 * B-ASKJB-33 — "Send these words to…" shares plain text only: the sentence,
 * when, what to do alongside it, and one closing line. No link, no referral
 * code, no image (shareCard.ts is not on this path).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildWordsText, shareWordsText } from "./share";
import { translate } from "./i18n";
import { hardMomentCards } from "../content/hardMomentCards";
import { hardMomentWordsText } from "../components/behaviors/HardMomentWords";

const tantrum = hardMomentCards.find((c) => c.id === "tantrum")!;
const tEn = (k: string, v?: Record<string, string | number>) => translate("en", k, v);
const tHe = (k: string, v?: Record<string, string | number>) => translate("he", k, v);

const EN = [
  "I'm here. We can pause. We'll talk when things feel calmer.",
  "When: Tantrum",
  "With it: Lower your voice, reduce words, and stay close without crowding.",
  "From Arbor, Guy's parenting notes",
].join("\n");
const HE = [
  "אני כאן. אפשר לעצור רגע. נדבר כשיהיה רגוע יותר.",
  "מתי: התקף זעם",
  "ובמקביל: הנמיכו את הקול, צמצמו מילים והישארו קרובים בלי להצטופף.",
  "מתוך ארבור, הרשימות של גיא על הורות",
].join("\n");

const NO_LINK = /https?:|www\.|\.com\b|ref=|utm_|\.png|\.jpe?g|data:image/i;

describe("B-ASKJB-33 — the words payload (text only)", () => {
  it("EN + HE equal the fixture strings", () => {
    expect(hardMomentWordsText(tantrum, { locale: "en", parentName: "Guy", t: tEn })).toBe(EN);
    expect(hardMomentWordsText(tantrum, { locale: "he", parentName: "גיא", t: tHe })).toBe(HE);
  });

  it("contains no URL, no ref=, no image — in both languages, with or without the name", () => {
    for (const [locale, t] of [["en", tEn], ["he", tHe]] as const) {
      for (const childName of [undefined, "Dylan"]) {
        expect(hardMomentWordsText(tantrum, { locale, parentName: "Guy", childName, t })).not.toMatch(NO_LINK);
      }
    }
  });

  it("the child's first name rides only when turned on (default off)", () => {
    const named = hardMomentCards.find((c) => c.sayThis.en.includes("{{childName}}"));
    if (!named) return; // no card names the child: nothing to leak
    expect(hardMomentWordsText(named, { locale: "en", parentName: "Guy", t: tEn })).not.toContain("Dylan");
    expect(hardMomentWordsText(named, { locale: "en", parentName: "Guy", childName: "Dylan", t: tEn })).toContain("Dylan");
  });

  it("buildWordsText trims and drops empty lines", () => {
    expect(buildWordsText({ sentence: " a ", whenLine: "", withLine: "b", closing: "c" })).toBe("a\nb\nc");
  });
});

describe("B-ASKJB-33 — the transport", () => {
  it("navigator.share gets { text } only — never url, never files", async () => {
    const share = vi.fn(async () => {});
    await expect(shareWordsText(EN, { share, clipboard: undefined as unknown as Clipboard })).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ text: EN });
    const arg = (share.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(Object.keys(arg)).toEqual(["text"]);
  });

  it("falls back to the clipboard; a cancel is honoured silently", async () => {
    const writeText = vi.fn(async () => {});
    await expect(shareWordsText(EN, { share: undefined as unknown as Navigator["share"], clipboard: { writeText } as unknown as Clipboard })).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(EN);
    const abort = Object.assign(new Error("cancelled"), { name: "AbortError" });
    await expect(shareWordsText(EN, { share: vi.fn(async () => { throw abort; }), clipboard: { writeText } as unknown as Clipboard })).resolves.toBe("cancelled");
  });

  it("the words path never touches the branded card renderer (source pin)", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../components/behaviors/HardMomentWords.tsx"), "utf8");
    expect(src).not.toMatch(/shareCard|renderShareCard|buildShareUrl|SHARE_URL/);
    const share = fs.readFileSync(path.resolve(__dirname, "share.ts"), "utf8");
    const words = share.slice(share.indexOf("export async function shareWordsText"));
    expect(words).not.toMatch(/files|url:|renderShareCard|buildShareUrl/);
  });
});
