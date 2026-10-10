/** B-BOOK-20: one bounded, portable, private-file export contract. No URLs or tokens. */
export const BOOK_EXPORT_LIMITS = Object.freeze({
  files: 256,
  fileBytes: 8 * 1024 * 1024,
  totalBytes: 32 * 1024 * 1024,
  requestMs: 20_000,
  totalMs: 120_000,
});

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
