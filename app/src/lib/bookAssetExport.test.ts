import { createHash, webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { EXPORT_RETRY_ATTEMPTS, exportPrivateBookAssets, pauseWithin } from "./bookAssetExport";
import { createChildExportRun } from "./childExportRun";
import { BOOK_EXPORT_DIGEST_HEADER, BOOK_EXPORT_LIMITS, type BookExportFile, type BookExportInventory } from "./library/bookAssetExportContract";
import { bookAssetContentType } from "./library/bookAssetPaths";

const auth = vi.hoisted(() => ({ token: "synthetic-owner-token", wait: null as null | Promise<void> }));
const identity = vi.hoisted(() => ({ currentUser: { uid: "owner" } as { uid: string } | null, listeners: new Set<(user: { uid: string } | null) => void>() }));
vi.mock("./api", () => ({ authHeaders: async () => { if (auth.wait) await auth.wait; return auth.token ? { Authorization: `Bearer ${auth.token}` } : {}; } }));
vi.mock("./firebase", () => ({ auth: identity }));
vi.mock("firebase/auth", () => ({ onAuthStateChanged: (_auth: unknown, fn: (user: { uid: string } | null) => void) => { identity.listeners.add(fn); return () => identity.listeners.delete(fn); } }));
const changeOwner = (user: { uid: string } | null) => { identity.currentUser = user; for (const fn of identity.listeners) fn(user); };
const childId = "synthetic-child";
const sprite = "hero-sheets/synthetic/stand.png";
const print = "hero-sheets/synthetic/prints/cover.webp";
const audio = "narration/synthetic/he-f/p1.wav";
const file = (path = sprite, bytes: number | null = 4): BookExportFile => ({ bookId: "synthetic-book", path, bytes });
const docs = (files = [sprite]) => [{ bookId: "synthetic-book", files }];
/** B-CAREPRO-50: an export read as the server sends it — the bytes, their
 *  SHA-256 and the Content-Type of the requested path (overridable). */
const pathOf = (url: string) => new URL(url, "http://synthetic.invalid").searchParams.get("path") ?? "";
function served(body: Uint8Array | string, url = "", headers: Record<string, string> = {}): Response {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
  return new Response(bytes, { headers: {
    "content-type": bookAssetContentType(pathOf(url)),
    [BOOK_EXPORT_DIGEST_HEADER]: createHash("sha256").update(bytes).digest("hex"),
    ...headers,
  } });
}
function install(files: BookExportFile[] = [file()], read: (url: string, init: RequestInit) => Response | Promise<Response> = (url) => served("DATA", url), issues: BookExportInventory["issues"] = []) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return url.endsWith("export-manifest")
      ? new Response(JSON.stringify({ version: 1, childId, status: issues.length ? "incomplete" : "complete", files, issues }))
      : read(url, init);
  }));
  return calls;
}
beforeEach(() => { auth.token = "synthetic-owner-token"; auth.wait = null; identity.currentUser = { uid: "owner" }; vi.stubGlobal("crypto", webcrypto); });
afterEach(() => { expect(identity.listeners.size).toBe(0); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("B-BOOK-20 bounded portable bytes", () => {
  it("round-trips sprites, prints, narration and orphaned private files byte-for-byte with SHA-256", async () => {
    const data = Uint8Array.from({ length: 1024 }, (_, i) => i % 256);
    const calls = install([file(sprite, data.length), file(print, data.length), file(audio, data.length)], (url) => served(data, url));
    // Only the sprite is currently registered; the authoritative prefix also exports old prints/audio.
    const out = await exportPrivateBookAssets("owner", childId, docs());
    expect(out.status).toBe("complete");
    expect(out.includedFiles).toBe(3);
    expect(out.includedBytes).toBe(3 * data.length);
    for (const receipt of out.files) {
      expect(receipt.status).toBe("included");
      if (receipt.status !== "included") throw new Error("missing bytes");
      expect(Buffer.from(receipt.data, "base64")).toEqual(Buffer.from(data));
      expect(receipt.sha256).toBe(createHash("sha256").update(data).digest("hex"));
      expect(receipt.encoding).toBe("base64");
    }
    expect(out.files.map((f) => f.status === "included" && f.mediaType)).toEqual(["image/png", "image/webp", "audio/wav"]);
    expect(calls).toHaveLength(4);
    for (const { url, init } of calls) {
      expect(url).toMatch(/^\/api\/children\/synthetic-child\/book-assets\//);
      expect(init).toMatchObject({ cache: "no-store", redirect: "error", credentials: "same-origin", headers: { Authorization: "Bearer synthetic-owner-token" } });
      if (!url.endsWith("export-manifest")) expect(url).toContain("&export=1");
    }
    expect(JSON.stringify(out)).not.toMatch(/Bearer|synthetic-owner-token|https?:|blob:|data:/);
  });

  it("never reads bytes anonymously, from an old cache, or after an owner refusal", async () => {
    const calls = install();
    for (const uid of [undefined, "local-sandbox"]) {
      expect((await exportPrivateBookAssets(uid, childId, docs())).issues).toContain("unauthorized");
    }
    expect(calls).toHaveLength(0);
    auth.token = "";
    expect((await exportPrivateBookAssets("owner", childId, docs())).issues).toContain("unauthorized");
    expect(calls).toHaveLength(0);
    auth.token = "synthetic-owner-token";
    install([file(), file(audio)], () => new Response(null, { status: 403 }));
    identity.currentUser = { uid: "stranger" };
    const out = await exportPrivateBookAssets("stranger", childId, docs());
    expect(out.status).toBe("incomplete");
    expect(out.files.map((f) => f.status)).toEqual(["unauthorized", "unauthorized"]);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    expect(out.includedBytes).toBe(0);
  });

  it("reports missing files, failed metadata reads and unknown/unsafe paths without fetching them", async () => {
    const calls = install([file()]);
    const out = await exportPrivateBookAssets("owner", childId, [
      ...docs([sprite, audio, "../sibling/secret", "unknown/folder.bin"]),
      { bookId: "../sibling", files: [sprite] },
    ], { metadataComplete: false });
    expect(out.status).toBe("incomplete");
    expect(out.issues).toEqual(["metadata_unavailable", "invalid_metadata"]);
    expect(out.files.find((f) => f.path === audio)?.status).toBe("missing");
    expect(calls).toHaveLength(2);
    expect(calls.some((c) => /sibling|unknown/.test(c.url))).toBe(false);
  });

  it("does not declare empty storage complete if inventory is unavailable, truncated or unsupported", async () => {
    for (const issue of ["storage_unavailable", "inventory_limit", "unsupported_path"] as const) {
      install([], undefined, [issue]);
      const out = await exportPrivateBookAssets("owner", childId, []);
      expect(out.status).toBe("incomplete");
      expect(out.issues).toContain(issue);
    }
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    const out = await exportPrivateBookAssets("owner", childId, docs());
    expect(out.inventory).toBe("unavailable");
    expect(out.issues).toContain("unavailable");
  });

  it("rejects another child, duplicate entries and unknown folders in an untrusted inventory", async () => {
    for (const extra of [
      { childId: "sibling" },
      { files: [file(), file()] },
      { files: [file("../secret")] },
      { files: [file("new-folder/secret.png")] },
      { files: Array.from({ length: BOOK_EXPORT_LIMITS.files + 1 }, (_, i) => file(`hero-sheets/s/p${i}.png`)) },
    ]) {
      vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ version: 1, childId, status: "complete", files: [file()], issues: [], ...extra }))));
      const out = await exportPrivateBookAssets("owner", childId, docs());
      expect(out.status).toBe("incomplete");
      expect(out.issues).toContain("integrity");
      expect(out.files).toEqual([]);
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });

  it("caps every file and the total, with explicit receipts; unknown sizes do not allow reads", async () => {
    const size = BOOK_EXPORT_LIMITS.fileBytes;
    const files = Array.from({ length: 5 }, (_, i) => file(`hero-sheets/s/p${i}.png`, size));
    files.push(file(audio, size + 1), file(print, null));
    const calls = install(files, (url) => served(new Uint8Array(size), url));
    const out = await exportPrivateBookAssets("owner", childId, []);
    expect(out.includedFiles).toBe(4);
    expect(out.includedBytes).toBe(BOOK_EXPORT_LIMITS.totalBytes);
    expect(out.files.map((f) => f.status)).toEqual(["included", "included", "included", "included", "byte_limit", "byte_limit", "unknown_size"]);
    expect(calls).toHaveLength(5);
    expect(out.status).toBe("incomplete");
  }, 20_000);

  it("never includes truncated, overlong, erroring or mismatched-length bodies as bytes", async () => {
    const responses = [
      () => new Response("DA"),
      () => new Response("TOO LONG"),
      () => new Response("DATA", { headers: { "content-length": "3" } }),
      () => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("DA")); c.error(new Error("interrupted")); } })),
    ];
    for (const read of responses) {
      install([file()], read);
      const out = await exportPrivateBookAssets("owner", childId, docs());
      expect(out.status).toBe("incomplete");
      expect(out.includedBytes).toBe(0);
      expect(out.files[0].status).not.toBe("included");
      expect(out.files[0]).not.toHaveProperty("data");
    }
  });

  it("checks original bytes rather than a compressed transport Content-Length", async () => {
    install([file()], (url) => served("DATA", url, { "content-encoding": "gzip", "content-length": "24" }));
    const out = await exportPrivateBookAssets("owner", childId, docs());
    expect(out.status).toBe("complete");
    expect(out.includedBytes).toBe(4);
  });

  it("keeps successful bytes in a partial receipt and reports missing/offline files honestly", async () => {
    let n = 0;
    install([file(sprite), file(print), file(audio)], (url) => ++n === 1 ? served("DATA", url) : new Response(null, { status: n === 2 ? 404 : 503 }));
    const out = await exportPrivateBookAssets("owner", childId, docs([sprite, print, audio]));
    expect(out.status).toBe("incomplete");
    expect(out.files.map((f) => f.status)).toEqual(["included", "missing", "unavailable"]);
    expect(out.includedFiles).toBe(1);
  });

  it("bounds stalled refresh and body reads, and sends nothing after cancellation", async () => {
    vi.useFakeTimers();
    let release!: () => void;
    auth.wait = new Promise<void>((resolve) => { release = resolve; });
    const calls = install();
    const first = exportPrivateBookAssets("owner", childId, docs());
    await vi.advanceTimersByTimeAsync(BOOK_EXPORT_LIMITS.requestMs);
    expect((await first).issues).toContain("timeout");
    release();
    await Promise.resolve();
    expect(calls).toHaveLength(0);
    auth.wait = null;
    install([file()], () => new Response(new ReadableStream({ start() {} })));
    const stalled = exportPrivateBookAssets("owner", childId, docs());
    await vi.advanceTimersByTimeAsync(BOOK_EXPORT_LIMITS.requestMs);
    expect((await stalled).files[0].status).toBe("timeout");
    const controller = new AbortController();
    controller.abort();
    expect((await exportPrivateBookAssets("owner", childId, docs(), { signal: controller.signal })).issues).toContain("cancelled");
  });

  it("binds uid before auth refresh, and latches a switch/re-entry while a token is delayed", async () => {
    const calls = install();
    expect((await exportPrivateBookAssets("different-owner", childId, docs())).issues).toContain("unauthorized");
    expect(calls).toHaveLength(0);
    let release!: () => void;
    auth.wait = new Promise<void>((resolve) => { release = resolve; });
    const originalOwner = identity.currentUser;
    const pending = exportPrivateBookAssets("owner", childId, docs());
    changeOwner(null);
    changeOwner({ uid: "other-owner" });
    changeOwner(originalOwner); // even restoring the exact object cannot revive this run
    release();
    const out = await pending;
    expect(out.status).toBe("incomplete");
    expect(out.issues).toContain("unauthorized");
    expect(out.includedBytes).toBe(0);
    expect(calls).toHaveLength(0);
    auth.wait = null;
    expect((await exportPrivateBookAssets("owner", childId, docs())).status).toBe("complete");
  });

  it("re-checks the account after response and removes earlier bytes on a later account change", async () => {
    let n = 0;
    const calls = install([file(sprite), file(print), file(audio)], () => {
      if (++n === 2) changeOwner({ uid: "other-owner" });
      return new Response("DATA");
    });
    const out = await exportPrivateBookAssets("owner", childId, docs([sprite, print, audio]));
    expect(out.status).toBe("incomplete");
    expect(out.issues).toContain("unauthorized");
    expect(out.includedFiles).toBe(0);
    expect(out.includedBytes).toBe(0);
    expect(out.files.every((f) => f.status === "unauthorized" && !("data" in f))).toBe(true);
    expect(calls).toHaveLength(3); // inventory + two files; no third file after switch
  });

  it("cancels an in-flight stream and dispatches no later file after cancellation", async () => {
    const cancelled = vi.fn();
    let started!: () => void;
    const entered = new Promise<void>((resolve) => { started = resolve; });
    const calls = install([file(sprite), file(audio)], () => {
      const response = new Response(new ReadableStream({
        start(c) { c.enqueue(new TextEncoder().encode("DA")); },
        pull() { started(); },
        cancel: cancelled,
      }));
      return response;
    });
    const controller = new AbortController();
    const pending = exportPrivateBookAssets("owner", childId, docs(), { signal: controller.signal });
    await entered;
    controller.abort();
    const out = await pending;
    expect(out.status).toBe("incomplete");
    expect(out.issues).toContain("cancelled");
    expect(out.includedBytes).toBe(0);
    expect(out.files.every((f) => !("data" in f))).toBe(true);
    expect(calls).toHaveLength(2);
    expect(cancelled).toHaveBeenCalledOnce();
  });
});

describe("B-CAREPRO-50 · the export matches what the server sent", () => {
  it("keeps a file only when the device's SHA-256 equals the server's; a missing digest is a failure", async () => {
    for (const headers of [{ [BOOK_EXPORT_DIGEST_HEADER]: createHash("sha256").update("ATAD").digest("hex") }, { [BOOK_EXPORT_DIGEST_HEADER]: "" }, { [BOOK_EXPORT_DIGEST_HEADER]: "not-a-digest" }]) {
      install([file()], (url) => served("DATA", url, headers));
      const out = await exportPrivateBookAssets("owner", childId, docs());
      expect(out.status).toBe("incomplete");
      expect(out.files[0].status).toBe("integrity");
      expect(out.files[0]).not.toHaveProperty("data");
      expect(out.includedBytes).toBe(0);
    }
  });

  it("NEGATIVE CONTROL: the pre-change client kept any bytes with its own digest and typed them by path", () => {
    const pre = 'out.files.push({ ...file, status: "included", encoding: "base64", mediaType: bookAssetContentType(file.path), sha256: Array.from(hash';
    const now = readFileSync(new URL("./bookAssetExport.ts", import.meta.url), "utf8");
    expect(now).not.toContain(pre);
    expect(now).toContain("served.digest !== sha256");
  });

  it("types each file by the served Content-Type, never by its path; an unexpected type is a failure", async () => {
    install([file(print)], (url) => served("DATA", url, { "content-type": "image/png; charset=binary" }));
    const out = await exportPrivateBookAssets("owner", childId, docs([print]));
    expect(out.status).toBe("complete");
    expect(out.files[0].status === "included" && out.files[0].mediaType).toBe("image/png");
    install([file(print)], (url) => served("DATA", url, { "content-type": "text/html" }));
    expect((await exportPrivateBookAssets("owner", childId, docs([print]))).files[0].status).toBe("integrity");
  });

  it("a file the server refuses as too large is named byte_limit", async () => {
    install([file()], () => new Response(null, { status: 413 }));
    expect((await exportPrivateBookAssets("owner", childId, docs())).files[0].status).toBe("byte_limit");
  });

  it("critic r1: the server's per-account pace (429 + Retry-After) is waited out and the same file read again", async () => {
    let refused = 0;
    const calls = install([file(), file(print)], (url) => {
      if (pathOf(url) === print && refused < 2) { refused++; return new Response(null, { status: 429, headers: { "retry-after": "0" } }); }
      return served("DATA", url);
    });
    const out = await exportPrivateBookAssets("owner", childId, docs([sprite, print]));
    expect(out.status).toBe("complete");
    expect(out.files.map((f) => f.status)).toEqual(["included", "included"]);
    expect(calls.filter((c) => pathOf(c.url) === print)).toHaveLength(3);
  });

  it("critic r1: a pace that never lifts ends that file as unavailable after the retries", async () => {
    const calls = install([file()], () => new Response(null, { status: 429, headers: { "retry-after": "0" } }));
    expect((await exportPrivateBookAssets("owner", childId, docs())).files[0].status).toBe("unavailable");
    expect(calls.filter((c) => !c.url.endsWith("export-manifest"))).toHaveLength(EXPORT_RETRY_ATTEMPTS + 1);
  });

  it("critic r1: a wait that would pass the export's deadline is a timeout at once; cancel ends a wait", async () => {
    await expect(pauseWithin(60_000, undefined, Date.now() + 1_000)).rejects.toMatchObject({ code: "timeout" });
    const controller = new AbortController();
    const waiting = pauseWithin(30_000, controller.signal, Date.now() + 60_000);
    controller.abort();
    await expect(waiting).rejects.toMatchObject({ code: "cancelled" });
    await expect(pauseWithin(0, undefined, Date.now() + 1_000)).resolves.toBeUndefined();
  });

  /** A synthetic ten-book library: ~96 files a book (sheet, choices, prints, three narration voices). */
  const library = (bytes: number): BookExportFile[] => Array.from({ length: 10 }, (_, b) => [
    ...Array.from({ length: 6 }, (_, i) => `hero-sheets/s${b}/pose${i}.webp`),
    ...Array.from({ length: 4 }, (_, i) => `hero-sheets/s${b}/choices/c${i}.webp`),
    ...Array.from({ length: 12 }, (_, i) => `hero-sheets/s${b}/prints/p${i}.webp`),
    `hero-sheets/s${b}/manifest.json`,
    ...["en", "he-m", "he-f"].flatMap((v) => Array.from({ length: 12 }, (_, i) => [`narration/n${b}/${v}/p${i}.mp3`, `narration/n${b}/${v}/p${i}.cues.json`]).flat()),
    "manifest.json",
  ].map((path) => ({ bookId: `book-${b}`, path, bytes }))).flat();

  it("a ten-book library inside the byte budget exports complete", async () => {
    const files = library(2048);
    expect(files.length).toBeGreaterThan(900);
    expect(files.length).toBeLessThanOrEqual(BOOK_EXPORT_LIMITS.files);
    const body = new Uint8Array(2048).fill(7);
    install(files, (url) => served(body, url));
    const out = await exportPrivateBookAssets("owner", childId, []);
    expect(out.status).toBe("complete");
    expect(out.includedFiles).toBe(files.length);
  }, 60_000);

  it("a ten-book library over the byte budget names exactly what is missing", async () => {
    const files = library(40 * 1024);
    const body = new Uint8Array(40 * 1024).fill(3);
    install(files, (url) => served(body, url));
    const out = await exportPrivateBookAssets("owner", childId, []);
    expect(out.status).toBe("incomplete");
    // every inventoried file is named — included, or with its reason
    expect(out.files.map((f) => `${f.bookId}/${f.path}`).sort()).toEqual(files.map((f) => `${f.bookId}/${f.path}`).sort());
    const missing = out.files.filter((f) => f.status !== "included");
    expect(missing.length).toBe(files.length - out.includedFiles);
    expect(new Set(missing.map((f) => f.status))).toEqual(new Set(["byte_limit"]));
    expect(out.includedBytes).toBeLessThanOrEqual(BOOK_EXPORT_LIMITS.totalBytes);
  }, 60_000);
});

describe("Settings export interruptions and repeat clicks", () => {
  it("synchronously suppresses duplicates; close, child/account change and restart invalidate old results", () => {
    const runs = createChildExportRun();
    const run = runs.begin("owner/child")!;
    expect(runs.begin("owner/child")).toBeNull();
    expect(runs.current(run, "owner/child")).toBe(true);
    expect(runs.current(run, "owner/sibling")).toBe(false);
    expect(runs.current(run, "other/child")).toBe(false);
    runs.cancel();
    expect(run.controller.signal.aborted).toBe(true);
    const second = runs.begin("owner/child")!;
    runs.finish(run);
    expect(runs.current(second, "owner/child")).toBe(true);
    expect(runs.current(run, "owner/child")).toBe(false);
    runs.finish(second);
    expect(runs.begin("owner/child")).not.toBeNull();
  });

  it("the mounted Settings flow checks lifecycle before download, marks partial receipts, and never exports through the cache", () => {
    const sheet = readFileSync(new URL("../components/layout/YourDataSheet.tsx", import.meta.url), "utf8");
    expect(sheet).toContain("!exportRun.current.current(run, scopeRef.current)");
    const downloadCall = sheet.indexOf("downloadJson(childExportFilename(");
    expect(downloadCall).toBeGreaterThan(-1);
    expect(sheet.indexOf("!exportRun.current.current(run, scopeRef.current)")).toBeLessThan(downloadCall);
    expect(sheet).toContain("run.controller.signal");
    expect(readFileSync(new URL("./childExportFilename.ts", import.meta.url), "utf8")).toContain('status === "incomplete" ? ".partial"');
    expect(sheet).toContain('data-testid="your-data-export-receipt"');
    const implementation = readFileSync(new URL("./bookAssetExport.ts", import.meta.url), "utf8");
    expect(implementation).not.toMatch(/fetchBookAsset|bookAssetStore|\.put\(|console\.|logger\.|\/tts|generate|signedUrl/);
  });
});
