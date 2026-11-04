/** B-BOOK-20: one bounded, portable, private-file export contract. No URLs or tokens.
 *  B-CAREPRO-50: the file cap holds a ten-book library (~100 files a book: sheet,
 *  choices, prints, three narration voices); the server pages its inventory
 *  (`inventoryPage` objects a request) so every file is NAMED — included, or
 *  with the exact reason it is not. `manifestBytes` bounds that inventory. */
export const BOOK_EXPORT_LIMITS = Object.freeze({
  files: 2000,
  inventoryPage: 1000,
  manifestBytes: 512 * 1024,
  fileBytes: 8 * 1024 * 1024,
  totalBytes: 32 * 1024 * 1024,
  requestMs: 20_000,
  totalMs: 120_000,
});

/** B-CAREPRO-50 (critic r1): export reads one account may have in flight at
 *  once (the client reads one file at a time; one more covers a retry). */
export const BOOK_EXPORT_CONCURRENT_READS = 2;

/** B-CAREPRO-50: the server's SHA-256 (hex) of the exact bytes it sends for an
 *  export read; the client recomputes it and keeps the file only on a match. */
export const BOOK_EXPORT_DIGEST_HEADER = "x-arbor-sha256";

/** B-CAREPRO-50: the media types a private book file is served as. The
 *  receipt's `mediaType` is the response's Content-Type, never a path guess;
 *  any other type is an integrity failure. */
export const BOOK_EXPORT_MEDIA_TYPES: readonly string[] = ["image/webp", "image/png", "audio/mpeg", "audio/wav", "application/json"];

export interface BookExportFile {
  bookId: string;
  path: string;
  /** Unknown size is a failure, never permission for an unbounded read. */
  bytes: number | null;
}

export interface BookExportInventory {
  version: 1;
  childId: string;
  status: "complete" | "incomplete";
  files: BookExportFile[];
  issues: ("inventory_limit" | "unsupported_path" | "unknown_size" | "storage_unavailable")[];
}

export type BookExportFailure = "missing" | "unauthorized" | "unavailable" | "invalid_metadata" | "unknown_size" | "file_limit" | "byte_limit" | "integrity" | "cancelled" | "timeout";
export type BookExportReceipt = BookExportFile & (
  | { status: "included"; encoding: "base64"; mediaType: string; sha256: string; data: string }
  | { status: BookExportFailure }
);

export interface PortableBookAssets {
  format: "arbor-private-book-assets-v1";
  /** Only this private prefix; shared public plates/audio are not child data. */
  scope: "private-book-storage-and-registered-metadata";
  status: "complete" | "incomplete";
  inventory: "complete" | "incomplete" | "unavailable";
  issues: string[];
  limits: typeof BOOK_EXPORT_LIMITS;
  includedFiles: number;
  includedBytes: number;
  files: BookExportReceipt[];
}
