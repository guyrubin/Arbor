import { describe, expect, it } from "vitest";
import { resolvePlural } from "../context/LanguageContext";
import { translate, type UiLang } from "./i18n";
import { describeExportGaps, missingBookFiles, type ExportGapInput } from "./exportGaps";
import { BOOK_EXPORT_LIMITS, type BookExportReceipt, type PortableBookAssets } from "./library/bookAssetExportContract";
import { en, he } from "./i18nElevation/yourData";

const tOf = (lang: UiLang) => (key: string, vars?: Record<string, string | number>) => resolvePlural(lang, translate(lang, key, vars), vars);
const included = (bookId: string, path: string): BookExportReceipt => ({ bookId, path, bytes: 4, status: "included", encoding: "base64", mediaType: "image/webp", sha256: "0".repeat(64), data: "REFUQQ==" });
const failed = (bookId: string, path: string, status: Exclude<BookExportReceipt["status"], "included">): BookExportReceipt => ({ bookId, path, bytes: 4, status });
const assets = (files: BookExportReceipt[], inventory: PortableBookAssets["inventory"] = "complete"): PortableBookAssets => ({
  format: "arbor-private-book-assets-v1", scope: "private-book-storage-and-registered-metadata",
  status: files.every((f) => f.status === "included") && inventory === "complete" ? "complete" : "incomplete",
  inventory, issues: [], limits: BOOK_EXPORT_LIMITS,
  includedFiles: files.filter((f) => f.status === "included").length, includedBytes: 0, files,
});
const data = (privateBookAssets: PortableBookAssets | undefined, records: "included" | "unavailable" = "included"): ExportGapInput => ({
  exportReceipt: { status: privateBookAssets?.status === "complete" && records === "included" ? "complete" : "incomplete", serverData: "included", collections: { bookAssets: "included", journal: records } },
  privateBookAssets,
});
const titles = (bookId: string, lang: "en" | "he") => bookId === "synthetic-stones" ? (lang === "he" ? "אבנים" : "Synthetic Stones") : undefined;

describe("B-CAREPRO-50 · a partial export names what it left out", () => {
  it("groups every not-included file by book and by what a parent sees", () => {
    const groups = missingBookFiles(assets([
      included("synthetic-stones", "hero-sheets/s/pose.webp"),
      failed("synthetic-stones", "hero-sheets/s/prints/p1.webp", "integrity"),
      failed("synthetic-stones", "narration/n/en/p1.mp3", "unavailable"),
      failed("synthetic-stones", "narration/n/he-f/p1.wav", "timeout"),
      failed("synthetic-stones", "narration/n/en/p1.cues.json", "missing"),
      failed("plan-poses", "hero-sheets/p/pose.png", "byte_limit"),
    ]));
    expect(groups).toEqual([
      { bookId: "synthetic-stones", pictures: 1, voices: 2, details: 1, tooLarge: false },
      { bookId: "plan-poses", pictures: 1, voices: 0, details: 0, tooLarge: true },
    ]);
  });

  it("a complete export has nothing to name", async () => {
    expect(await describeExportGaps(data(assets([included("synthetic-stones", "manifest.json")])), tOf("en"), "en", "Noa", titles)).toEqual([]);
  });

  it("names each book with its counts in English and Hebrew, with no technical words", async () => {
    const input = data(assets([
      failed("synthetic-stones", "hero-sheets/s/prints/p1.webp", "integrity"),
      failed("synthetic-stones", "narration/n/en/p1.mp3", "unavailable"),
      failed("synthetic-stones", "narration/n/en/p2.mp3", "unavailable"),
      failed("synthetic-own", "hero-sheets/p/pose.png", "byte_limit"),
    ]));
    const enLines = await describeExportGaps(input, tOf("en"), "en", "Noa", titles);
    expect(enLines).toEqual([
      "Synthetic Stones: 1 picture, 2 voice recordings. Try again later to add them.",
      "A book made for Noa: 1 picture. The library is too large to include them all in one download.",
    ]);
    const heLines = await describeExportGaps(input, tOf("he"), "he", "נועה", titles);
    expect(heLines[0]).toBe("אבנים: תמונות: 1, הקלטות קול: 2. אפשר לנסות שוב מאוחר יותר כדי להוסיף אותם.");
    expect(heLines[1]).toContain("ספר שנוצר בשביל נועה");
    for (const line of [...enLines, ...heLines]) {
      expect(line).not.toMatch(/integrity|byte_limit|unavailable|sha|hash|json|mp3|webp|\{|\}/i);
    }
  });

  it("says when book files could not be listed and when other records are missing", async () => {
    const lines = await describeExportGaps(data(assets([], "unavailable"), "unavailable"), tOf("en"), "en", "Noa", titles);
    expect(lines).toEqual([
      "Some of Noa's book files could not be checked this time.",
      "Some of Noa's saved notes and history could not be included.",
    ]);
  });

  it("resolves a catalogue title when no lookup is given", async () => {
    const { allBooks } = await import("./library/books");
    const book = allBooks()[0];
    const lines = await describeExportGaps(data(assets([failed(book.id, "narration/n/en/p1.mp3", "timeout")])), tOf("en"), "en", "Noa");
    expect(lines[0].startsWith(`${book.title.en}: 1 voice recording.`)).toBe(true);
  });

  it("every new line has both locales", () => {
    const keys = Object.keys(en).filter((k) => k.startsWith("elev.yourData.gap."));
    expect(keys.length).toBeGreaterThan(8);
    for (const k of keys) expect(he[k], k).toBeTruthy();
  });
});
