/**
 * B-GA-09 round 7 — the ONE per-child server erase. The /privacy/erase route
 * (a parent erasing one child) and account deletion (every child of the
 * account, including one whose erase stopped half way) both run this, so the
 * two can never drift apart again: before round 7 account deletion skipped the
 * consult requests the route had erased since round 2.
 *
 * Order (round 5): the erase record first, the child doc (the owner check's
 * anchor) last, so any failure in between leaves the owner able to retry.
 *  1. memoryStore.recordErase — erasedChildren/{childId}: lets the same family
 *     retry once the anchor is gone, and lets account deletion find the child;
 *  2. the caller's share grants for the child;
 *  3. every consent record of the child;
 *  4. every consult request naming the child, a co-parent's included;
 *  5. Storage: the child's photos (users/{uid}/children/{childId}/) and private
 *     book files (children/{childId}/books/), each counted;
 *  6. memoryStore.eraseChild — the family's pointer, the ledger, the child doc;
 *  7. with `dropRecord` (account deletion), the erase record itself: the erase
 *     is finished and the account is going. The route keeps it (30-day TTL) so
 *     a retry after a lost response still passes.
 */
import type { MemoryStore } from "../memory/types.js";
import { eraseChildBookAssets, type BookAssetBucket } from "./bookAssets.js";

export interface ChildEraseStores {
  memoryStore: Pick<MemoryStore, "eraseChild" | "recordErase" | "dropEraseRecord">;
  shareStore: { eraseByChild(ownerUid: string, childId: string): Promise<number> };
  consentStore: { eraseByChild(childId: string): Promise<number> };
  consultStore: { eraseByChild(childId: string): Promise<number> };
  /** The Storage bucket; none configured = the Storage step is skipped (and says so). */
  storageBucket?: string;
}

export interface ChildEraseResult {
  memoryEvents: number;
  shares: number;
  consents: number;
  consultRequests: number;
  storageFiles: number;
  /** Per registered prefix, only when the bucket was actually checked (B-BOOK-20 round 4):
   *  with no bucket the client receipt must read "Not reached", never "erased · 0". */
  storage?: { photos: number; books: number };
  storageNote: string;
}

export async function eraseChildServerData(
  stores: ChildEraseStores,
  uid: string,
  childId: string,
  opts: { dropRecord?: boolean } = {},
): Promise<ChildEraseResult> {
  await stores.memoryStore.recordErase?.(childId);
  const shares = await stores.shareStore.eraseByChild(uid, childId);
  const consents = await stores.consentStore.eraseByChild(childId);
  const consultRequests = await stores.consultStore.eraseByChild(childId);
  // GDPR Art. 17 parity with account deletion: the child's own Storage
  // prefixes only, so a sibling's files are never touched.
  let storageFiles = 0;
  let storage: { photos: number; books: number } | undefined;
  let storageNote: string;
  if (!stores.storageBucket) {
    storageNote = "skipped: no storage bucket configured";
  } else {
    try {
      const { getStorage } = await import("firebase-admin/storage");
      const bucket = getStorage().bucket(stores.storageBucket);
      const [photoFiles] = await bucket.getFiles({ prefix: `users/${uid}/children/${childId}/` });
      await bucket.deleteFiles({ prefix: `users/${uid}/children/${childId}/` });
      const bookFiles = await eraseChildBookAssets(bucket as unknown as BookAssetBucket, childId);
      storageFiles = photoFiles.length + bookFiles;
      storage = { photos: photoFiles.length, books: bookFiles };
      storageNote = `storage prefixes users/{uid}/children/${childId}/ and children/${childId}/books/ removed`;
    } catch (err: unknown) {
      // A bucket that was never provisioned is a clean no-op, not a failure.
      const message = err instanceof Error ? err.message : String(err);
      if (!/not exist|notFound|404/i.test(message)) throw err;
      storageNote = "bucket not provisioned";
      storage = { photos: 0, books: 0 }; // checked: the bucket holds nothing
    }
  }
  const memoryEvents = await stores.memoryStore.eraseChild(childId);
  if (opts.dropRecord) await stores.memoryStore.dropEraseRecord?.(childId);
  return { memoryEvents, shares, consents, consultRequests, storageFiles, storage, storageNote };
}

/** Everything one erase removed, as one count (account deletion's receipt). */
export function childEraseTotal(r: ChildEraseResult): number {
  return r.memoryEvents + r.shares + r.consents + r.consultRequests + r.storageFiles;
}
