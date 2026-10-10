import { BOOK_ASSET_ID, childBookAssetPrefix, isBookAssetRel } from "../lib/library/bookAssetPaths.js";
import { BOOK_EXPORT_LIMITS, type BookExportInventory } from "../lib/library/bookAssetExportContract.js";
import type { BookAssetBucket } from "./bookAssets.js";

/** Server-owned inventory includes valid orphaned files, not only current metadata.
 * Pagination is bounded at the bucket; no bytes are read and no files are changed.
 * Unsupported names are counted as an incomplete inventory, never echoed or fetched.
 */
export async function inventoryChildBookAssets(bucket: BookAssetBucket | null, childId: string): Promise<BookExportInventory> {
  const prefix = childBookAssetPrefix(childId);
  const out: BookExportInventory = { version: 1, childId, status: "complete", files: [], issues: [] };
  if (!bucket) return { ...out, status: "incomplete", issues: ["storage_unavailable"] };
  const [files, nextPage] = await bucket.getFiles({ prefix, autoPaginate: false, maxResults: BOOK_EXPORT_LIMITS.files });
  if (nextPage || files.length > BOOK_EXPORT_LIMITS.files) out.issues.push("inventory_limit");
  const seen = new Set<string>();
  for (const file of files.slice(0, BOOK_EXPORT_LIMITS.files)) {
    const relative = file.name.startsWith(prefix) ? file.name.slice(prefix.length) : "";
    const slash = relative.indexOf("/");
    const bookId = relative.slice(0, slash);
    const path = relative.slice(slash + 1);
    if (slash < 1 || !BOOK_ASSET_ID.test(bookId) || !isBookAssetRel(path) || seen.has(relative)) {
      out.issues.push("unsupported_path");
      continue;
    }
    seen.add(relative);
    const rawSize = file.metadata?.size;
    const size = rawSize === undefined || rawSize === "" ? NaN : Number(rawSize);
    const bytes = Number.isSafeInteger(size) && size >= 0 ? size : null;
    if (bytes === null) out.issues.push("unknown_size");
    out.files.push({ bookId, path, bytes });
  }
  out.files.sort((a, b) => `${a.bookId}/${a.path}`.localeCompare(`${b.bookId}/${b.path}`, "en"));
  out.issues = [...new Set(out.issues)];
  out.status = out.issues.length ? "incomplete" : "complete";
  return out;
}
