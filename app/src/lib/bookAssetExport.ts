import { authHeaders } from "./api";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { BOOK_ASSET_ID, bookAssetContentType, bookAssetUrl, isBookAssetRel } from "./library/bookAssetPaths";
import { BOOK_EXPORT_LIMITS, type BookExportFailure, type BookExportFile, type BookExportInventory, type PortableBookAssets } from "./library/bookAssetExportContract";

class ExportFailure extends Error {
  constructor(readonly code: BookExportFailure) { super(code); }
}

/** Bound token refresh, dispatch and body reads, including a stalled stream. */
async function boundedRequest<T>(signal: AbortSignal | undefined, deadline: number, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  if (signal?.aborted) throw new ExportFailure("cancelled");
  const ms = Math.min(BOOK_EXPORT_LIMITS.requestMs, deadline - Date.now());
  if (ms <= 0) throw new ExportFailure("timeout");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  let cancel: () => void;
  try {
    return await Promise.race([
      new Promise<never>((_, reject) => {
        cancel = () => { controller.abort(); reject(new ExportFailure("cancelled")); };
        signal?.addEventListener("abort", cancel, { once: true });
        timer = setTimeout(() => { controller.abort(); reject(new ExportFailure("timeout")); }, ms);
      }),
      work(controller.signal),
    ]);
  } finally {
    clearTimeout(timer!);
    signal?.removeEventListener("abort", cancel!);
  }
}

async function readBytes(res: Response, max: number, signal: AbortSignal, assertOwner: () => void, expected?: number): Promise<Uint8Array> {
  if (res.status === 401 || res.status === 403) throw new ExportFailure("unauthorized");
  if (res.status === 404) throw new ExportFailure("missing");
  if (!res.ok) throw new ExportFailure("unavailable");
  // Fetch decodes HTTP transfer compression; Content-Length then describes
  // compressed transport bytes, while the inventory describes original bytes.
  const encoding = res.headers.get("content-encoding");
  const length = !encoding || encoding === "identity" ? res.headers.get("content-length") : null;
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > max)) {
    await res.body?.cancel();
    throw new ExportFailure("byte_limit");
  }
  if (!res.body) throw new ExportFailure("integrity");
  const reader = res.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      assertOwner();
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      assertOwner();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > max) throw new ExportFailure("byte_limit");
      if (expected !== undefined && size > expected) throw new ExportFailure("integrity");
      chunks.push(value);
    }
    if (expected !== undefined && size !== expected) throw new ExportFailure("integrity");
    if (length !== null && Number(length) !== size) throw new ExportFailure("integrity");
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } finally {
    signal.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

async function requestBytes(url: string, max: number, signal: AbortSignal, assertOwner: () => void, expected?: number): Promise<Uint8Array> {
  assertOwner();
  signal.throwIfAborted();
  const headers = await authHeaders();
  assertOwner();
  if (!headers.Authorization) throw new ExportFailure("unauthorized");
  delete headers["Content-Type"];
  signal.throwIfAborted();
  // Export revalidates ownership every time; neither IDB nor HTTP caches can
  // authorize a download after sign-out, account change or access revocation.
  const res = await fetch(url, { headers, signal, credentials: "same-origin", cache: "no-store", redirect: "error" });
  try {
    assertOwner();
    signal.throwIfAborted();
    const bytes = await readBytes(res, max, signal, assertOwner, expected);
    assertOwner();
    signal.throwIfAborted();
    return bytes;
  } catch (e) {
    await res.body?.cancel().catch(() => undefined);
    throw e;
  }
}

const failureOf = (e: unknown): BookExportFailure => e instanceof ExportFailure ? e.code : "unavailable";
const keyOf = (f: Pick<BookExportFile, "bookId" | "path">) => `${f.bookId}/${f.path}`;
const validFile = (f: unknown): f is BookExportFile => {
  if (!f || typeof f !== "object") return false;
  const x = f as BookExportFile;
  return typeof x.bookId === "string" && BOOK_ASSET_ID.test(x.bookId) && isBookAssetRel(x.path)
    && (x.bytes === null || (Number.isSafeInteger(x.bytes) && x.bytes >= 0));
};

function parseInventory(bytes: Uint8Array, childId: string): BookExportInventory {
  const value = JSON.parse(new TextDecoder().decode(bytes)) as BookExportInventory;
  if (value.version !== 1 || value.childId !== childId || !["complete", "incomplete"].includes(value.status)
    || !Array.isArray(value.files) || value.files.length > BOOK_EXPORT_LIMITS.files || !value.files.every(validFile)
    || !Array.isArray(value.issues) || value.issues.some((x) => !["inventory_limit", "unsupported_path", "unknown_size", "storage_unavailable"].includes(x))
    || new Set(value.files.map(keyOf)).size !== value.files.length) throw new ExportFailure("integrity");
  if (value.issues.length || value.files.some((f) => f.bytes === null)) value.status = "incomplete";
  return value;
}

function base64(bytes: Uint8Array): string {
  // Small chunks avoid stack limits and quadratic byte-by-byte concatenation.
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 0x8000) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 0x8000)));
  return btoa(chunks.join(""));
}

/** Portable JSON contains the original bytes, MIME type, byte count and digest.
 * It is a read-only, parent-requested download. No model/provider calls, public
 * URLs, uploads, new caches or credentials are created by this path.
 */
export async function exportPrivateBookAssets(uid: string | undefined, childId: string, metadata: unknown[], options: { signal?: AbortSignal; metadataComplete?: boolean } = {}): Promise<PortableBookAssets> {
  const out: PortableBookAssets = {
    format: "arbor-private-book-assets-v1", scope: "private-book-storage-and-registered-metadata",
    status: "incomplete", inventory: "unavailable", issues: [], limits: BOOK_EXPORT_LIMITS,
    includedFiles: 0, includedBytes: 0, files: [],
  };
  if (options.metadataComplete === false) out.issues.push("metadata_unavailable");
  if (!uid || uid === "local-sandbox") { out.issues.push("unauthorized"); return out; }
  if (!BOOK_ASSET_ID.test(childId)) { out.issues.push("invalid_metadata"); return out; }
  // A UID string is not proof of the currently authenticated session. Pin the
  // Firebase User object and latch any auth transition, even sign-out followed
  // by re-entry into the same account before a delayed request settles.
  let owner: NonNullable<NonNullable<typeof auth>["currentUser"]>;
  try {
    if (!auth?.currentUser || auth.currentUser.uid !== uid) throw new ExportFailure("unauthorized");
    owner = auth.currentUser;
  } catch { out.issues.push("unauthorized"); return out; }
  const controller = new AbortController();
  let ownerLost = false;
  const assertOwner = () => {
    if (ownerLost || auth?.currentUser !== owner || owner.uid !== uid) throw new ExportFailure("unauthorized");
  };
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const unsubscribe = onAuthStateChanged(auth!, (current) => {
    if (current !== owner) { ownerLost = true; controller.abort(); }
  });
  try {
    await collectPrivateBookAssets(out, childId, metadata, controller.signal, assertOwner);
    assertOwner();
  } catch (e) {
    out.status = "incomplete";
    out.issues.push(failureOf(e));
  } finally {
    unsubscribe();
    options.signal?.removeEventListener("abort", cancel);
  }
  if (ownerLost || auth?.currentUser !== owner || options.signal?.aborted) {
    const status = ownerLost || auth?.currentUser !== owner ? "unauthorized" : "cancelled";
    out.status = "incomplete";
    out.issues.push(status);
    // Do not return an earlier owner's retained bytes to a newly active session.
    out.files = out.files.map(({ bookId, path, bytes }) => ({ bookId, path, bytes, status }));
    out.includedFiles = 0;
    out.includedBytes = 0;
  }
  out.issues = [...new Set(out.issues)];
  return out;
}

async function collectPrivateBookAssets(out: PortableBookAssets, childId: string, metadata: unknown[], signal: AbortSignal, assertOwner: () => void): Promise<void> {
  const deadline = Date.now() + BOOK_EXPORT_LIMITS.totalMs;
  let inventory: BookExportInventory;
  try {
    inventory = await boundedRequest(signal, deadline, async (signal) => parseInventory(await requestBytes(`/api/children/${encodeURIComponent(childId)}/book-assets/export-manifest`, 128 * 1024, signal, assertOwner), childId));
  } catch (e) { out.issues.push(failureOf(e)); return; }
  out.inventory = inventory.status;
  out.issues.push(...inventory.issues);
  const listed = new Map(inventory.files.map((f) => [keyOf(f), f]));
  // Reconcile metadata against storage. Missing or malformed metadata is never
  // treated as an empty, successfully exported set. Unknown unsafe names are
  // not copied into portable paths or used as requests.
  let checked = 0;
  if (metadata.length > BOOK_EXPORT_LIMITS.files) out.issues.push("metadata_limit");
  for (const raw of metadata.slice(0, BOOK_EXPORT_LIMITS.files)) {
    const doc = raw as { bookId?: unknown; files?: unknown } | null;
    if (!doc || typeof doc.bookId !== "string" || !BOOK_ASSET_ID.test(doc.bookId) || !Array.isArray(doc.files)) { out.issues.push("invalid_metadata"); continue; }
    for (const path of doc.files) {
      if (++checked > BOOK_EXPORT_LIMITS.files) { out.issues.push("metadata_limit"); break; }
      if (typeof path !== "string" || !isBookAssetRel(path)) { out.issues.push("invalid_metadata"); continue; }
      const file = { bookId: doc.bookId, path, bytes: null };
      if (!listed.has(keyOf(file))) {
        // A truncated inventory cannot establish whether an unlisted file exists.
        out.files.push({ ...file, status: inventory.status === "complete" ? "missing" : "unavailable" });
        listed.set(keyOf(file), file);
      }
    }
    if (checked > BOOK_EXPORT_LIMITS.files) break;
  }
  let stop: BookExportFailure | undefined;
  let reservedBytes = 0;
  for (const file of inventory.files) {
    let status = stop;
    if (signal.aborted) status = "cancelled";
    if (Date.now() >= deadline) status = "timeout";
    if (!status && file.bytes === null) status = "unknown_size";
    if (!status && (file.bytes! > BOOK_EXPORT_LIMITS.fileBytes || reservedBytes + file.bytes! > BOOK_EXPORT_LIMITS.totalBytes)) status = "byte_limit";
    if (status) { out.files.push({ ...file, status }); continue; }
    // Failed/partial reads still consume this attempt's budget. They cannot
    // turn a bounded export into an unbounded sequence of discarded bodies.
    reservedBytes += file.bytes!;
    try {
      const bytes = await boundedRequest(signal, deadline, (signal) => requestBytes(`${bookAssetUrl(childId, file.bookId, file.path)}&export=1`, file.bytes!, signal, assertOwner, file.bytes!));
      assertOwner();
      const hash = await boundedRequest(signal, deadline, async (signal) => {
        const result = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>));
        assertOwner();
        signal.throwIfAborted();
        return result;
      });
      assertOwner();
      if (signal.aborted) throw new ExportFailure("cancelled");
      out.files.push({ ...file, status: "included", encoding: "base64", mediaType: bookAssetContentType(file.path), sha256: Array.from(hash, (n) => n.toString(16).padStart(2, "0")).join(""), data: base64(bytes) });
      out.includedFiles++;
      out.includedBytes += bytes.length;
    } catch (e) {
      const status = failureOf(e);
      out.files.push({ ...file, status });
      if (["unauthorized", "cancelled", "timeout", "unavailable"].includes(status)) stop = status;
    }
  }
  out.issues = [...new Set(out.issues)];
  out.status = out.inventory === "complete" && !out.issues.length && out.files.every((f) => f.status === "included") ? "complete" : "incomplete";
  return;
}
