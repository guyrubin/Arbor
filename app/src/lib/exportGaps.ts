/**
 * lib/exportGaps — B-CAREPRO-50: a partial child export says, in a parent's
 * words, exactly what it left out — which book, and how many of its pictures,
 * voice recordings and book details — instead of only "check the receipt".
 * The downloaded receipt (`privateBookAssets.files`) still names every file
 * with its reason; this is the on-screen summary of the same list.
 *
 * Pure over the export result; the book titles come from the catalogue,
 * loaded only when a partial export needs one (the Settings sheet does not
 * carry the library).
 */
import type { BookExportReceipt, PortableBookAssets } from "./library/bookAssetExportContract";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export interface ExportGapInput {
  exportReceipt: { status: "complete" | "incomplete"; serverData: "included" | "unavailable"; collections: Record<string, "included" | "unavailable"> };
  privateBookAssets?: PortableBookAssets;
}

/** One book's files that are not in the download, by what a parent sees. */
export interface MissingBookFiles {
  bookId: string;
  pictures: number;
  voices: number;
  details: number;
  /** Some of them were left out for size (a retry will not add them). */
  tooLarge: boolean;
}

const kindOf = (path: string): "pictures" | "voices" | "details" =>
  /\.(?:webp|png)$/.test(path) ? "pictures" : /\.(?:mp3|wav)$/.test(path) ? "voices" : "details";

/** Every not-included file, grouped by book, in the receipt's order. */
export function missingBookFiles(assets: PortableBookAssets | undefined): MissingBookFiles[] {
  const byBook = new Map<string, MissingBookFiles>();
  for (const f of (assets?.files ?? []) as BookExportReceipt[]) {
    if (f.status === "included") continue;
    const group = byBook.get(f.bookId) ?? { bookId: f.bookId, pictures: 0, voices: 0, details: 0, tooLarge: false };
    group[kindOf(f.path)]++;
    if (f.status === "byte_limit" || f.status === "file_limit") group.tooLarge = true;
    byBook.set(f.bookId, group);
  }
  return [...byBook.values()];
}

/** The catalogue title of a book id, or undefined (a plan book, an old id). */
async function catalogueTitles(): Promise<(bookId: string, lang: "en" | "he") => string | undefined> {
  try {
    const { getLibraryBook } = await import("./library/books");
    return (bookId, lang) => getLibraryBook(bookId)?.title?.[lang];
  } catch {
    return () => undefined;
  }
}

/**
 * The lines a partial export shows: one per book with what it is missing,
 * then any book files that could not even be listed, then other records.
 * Empty for a complete export.
 */
export async function describeExportGaps(data: ExportGapInput, t: Translate, lang: "en" | "he", name: string, titleOf?: (bookId: string, lang: "en" | "he") => string | undefined): Promise<string[]> {
  if (data.exportReceipt?.status !== "incomplete") return [];
  const lines: string[] = [];
  const groups = missingBookFiles(data.privateBookAssets);
  const title = titleOf ?? (groups.length ? await catalogueTitles() : () => undefined);
  for (const g of groups) {
    const parts = [
      g.pictures ? t("elev.yourData.gap.pictures", { n: g.pictures }) : "",
      g.voices ? t("elev.yourData.gap.voices", { n: g.voices }) : "",
      g.details ? t("elev.yourData.gap.details", { n: g.details }) : "",
    ].filter(Boolean).join(t("elev.yourData.gap.join"));
    const book = title(g.bookId, lang) ?? t("elev.yourData.gap.ownBook", { name });
    lines.push(t(g.tooLarge ? "elev.yourData.gap.bookTooLarge" : "elev.yourData.gap.book", { book, parts }));
  }
  const assets = data.privateBookAssets;
  if (!assets || assets.inventory !== "complete") lines.push(t("elev.yourData.gap.unlisted", { name }));
  if (data.exportReceipt.serverData !== "included" || Object.values(data.exportReceipt.collections ?? {}).some((s) => s !== "included")) {
    lines.push(t("elev.yourData.gap.records", { name }));
  }
  return lines;
}
