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
  /** B-CAREPRO-50: was 32 MB, below one ordinary ten-book library (~22
   *  pictures ≈ 200 KB + 36 narration clips ≈ 64 KB a book ≈ 7 MB), so every
   *  big library ended byte_limit. 128 MB holds ten books even at the write
   *  path's own 300 KB WebP cap (≈ 9 MB a book). */
  totalBytes: 128 * 1024 * 1024,
  requestMs: 20_000,
  /** B-CAREPRO-50: was 120 s for the whole export — fewer than one sequential
   *  read of ~960 files at ordinary latency, plus one wait on the per-minute
   *  read pace, so the tail of every big library ended `timeout`. Each read
   *  still has its own `requestMs`. */
  totalMs: 600_000,
});

/** B-CAREPRO-50: a file that failed for a passing reason (5xx, network, a
 *  body that did not match the server's hash) is read again after these
 *  waits; one blip no longer ends the rest of the export. */
export const BOOK_EXPORT_TRANSIENT_RETRY_MS: readonly number[] = [500, 2000];
/** …and only this many files in a row failing that way mean the service is
 *  down: the rest are then named `unavailable` without being read. */
export const BOOK_EXPORT_STOP_AFTER_UNAVAILABLE = 3;

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

/** The limits one export runs under (the receipt records them). */
export type BookExportLimits = { readonly [K in keyof typeof BOOK_EXPORT_LIMITS]: number };

export interface PortableBookAssets {
  format: "arbor-private-book-assets-v1";
  /** Only this private prefix; shared public plates/audio are not child data. */
  scope: "private-book-storage-and-registered-metadata";
  status: "complete" | "incomplete";
  inventory: "complete" | "incomplete" | "unavailable";
  issues: string[];
  limits: BookExportLimits;
  includedFiles: number;
  includedBytes: number;
  files: BookExportReceipt[];
}
