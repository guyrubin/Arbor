import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  currentUser: { uid: "owner" } as { uid: string } | null,
  enabled: true,
  listeners: new Set<(user: { uid: string } | null) => void>(),
  paths: [] as string[],
  getDocsHook: null as null | ((path: string) => void | Promise<void>),
}));
vi.mock("./firebase", () => ({ auth: state, db: {}, get firebaseEnabled() { return state.enabled; } }));
vi.mock("firebase/auth", () => ({ onAuthStateChanged: (_auth: unknown, fn: (user: { uid: string } | null) => void) => { state.listeners.add(fn); return () => state.listeners.delete(fn); } }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, path: string) => path,
  getDocs: async (path: string) => {
    state.paths.push(path);
    await state.getDocsHook?.(path);
    return { docs: [{ id: "synthetic", data: () => path.endsWith("/bookAssets") ? { bookId: "book", files: ["manifest.json"] } : { synthetic: "prior-owner-record" } }] };
  },
  doc: vi.fn(), deleteDoc: vi.fn(),
}));
import { exportChildData, CHILD_SUBCOLLECTIONS } from "./childData";
import { withChildExportSession } from "./childExportSession";
import { setAuthTokenProvider } from "./api";
import { createChildExportRun } from "./childExportRun";
import type { ChildProfile } from "../types";
const child = { id: "child", name: "Synthetic prior child" } as ChildProfile;
const change = (user: { uid: string } | null) => { state.currentUser = user; for (const listener of state.listeners) listener(user); };
const fetchResult = (url: string) => url.includes("privacy/export")
  ? new Response(JSON.stringify({ serverData: { memoryEvents: [{ synthetic: "prior-owner-ledger" }], shares: [] } }))
  : url.endsWith("export-manifest")
    ? new Response(JSON.stringify({ version: 1, childId: "child", status: "complete", issues: [], files: [{ bookId: "book", path: "manifest.json", bytes: 4 }] }))
    : new Response("DATA");
beforeEach(() => {
  state.currentUser = { uid: "owner" }; state.enabled = true; state.getDocsHook = null; state.paths.length = 0;
  setAuthTokenProvider(async () => `${state.currentUser?.uid}-synthetic-token`);
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => fetchResult(url)));
});
afterEach(() => { expect(state.listeners.size).toBe(0); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("whole-child export lifetime ownership", () => {
  it("rejects the entire export on final getDocs transition, not a partial old-owner payload", async () => {
    state.getDocsHook = (path) => { if (path.endsWith(`/${CHILD_SUBCOLLECTIONS.at(-1)}`)) change({ uid: "other" }); };
    await expect(exportChildData("owner", child)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).toHaveBeenCalledTimes(1); // no inventory or file requests after the transition
  });

  it("latches sign-out and same-account re-entry before private-byte pinning", async () => {
    const prior = state.currentUser;
    state.getDocsHook = (path) => { if (path.endsWith(`/${CHILD_SUBCOLLECTIONS.at(-1)}`)) { change(null); change({ uid: "other" }); change(prior); } };
    await expect(exportChildData("owner", child)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects all metadata when account changes during digest", async () => {
    let started!: () => void; const entered = new Promise<void>((resolve) => { started = resolve; });
    let release!: (bytes: ArrayBuffer) => void;
    vi.stubGlobal("crypto", { subtle: { digest: () => { started(); return new Promise<ArrayBuffer>((resolve) => { release = resolve; }); } } });
    const pending = exportChildData("owner", child);
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await entered;
    change({ uid: "other" }); release(new ArrayBuffer(32));
    await rejected;
    // The byte service also disposes its own observer when the digest settles.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });

  it("rejects a transition during empty inventory too", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("privacy/export")) return fetchResult(url);
      change({ uid: "other" });
      return new Response(JSON.stringify({ version: 1, childId: "child", status: "complete", issues: [], files: [] }));
    }));
    await expect(exportChildData("owner", child)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("pins before privacyExport and prevents delayed token dispatch after a transition", async () => {
    let release!: (token: string) => void;
    setAuthTokenProvider(() => new Promise((resolve) => { release = resolve; }));
    const pending = exportChildData("owner", child);
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    change({ uid: "other" }); release("prior-owner-synthetic-token");
    await rejected;
    expect(fetch).not.toHaveBeenCalled();
    expect(state.paths).toEqual([]);
  });

  it("aborts a pending collection read and never starts the next read", async () => {
    let entered!: () => void; const started = new Promise<void>((resolve) => { entered = resolve; });
    let release!: () => void;
    state.getDocsHook = () => { entered(); return new Promise<void>((resolve) => { release = resolve; }); };
    const pending = exportChildData("owner", child);
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await started; change(null); await rejected; release();
    expect(state.paths).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps an outer guard through final download even when React's rendered scope is stale", async () => {
    const runs = createChildExportRun(); const scope = "true|owner|child"; const run = runs.begin(scope)!;
    const download = vi.fn();
    await expect(withChildExportSession("owner", run.controller.signal, async (session) => {
      const data = await exportChildData("owner", child, { signal: session.signal });
      change(null); change({ uid: "owner" }); // after inner return; before UI download
      expect(runs.current(run, scope)).toBe(true); // unchanged render is insufficient
      session.assertCurrent();
      download(data);
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(download).not.toHaveBeenCalled();
    const sheet = readFileSync(new URL("../components/layout/YourDataSheet.tsx", import.meta.url), "utf8");
    expect(sheet).toContain("await withChildExportSession(user?.uid, run.controller.signal");
    const downloadCall = sheet.indexOf("downloadJson(childExportFilename(");
    expect(downloadCall).toBeGreaterThan(-1);
    expect(sheet.indexOf("session.assertCurrent();")).toBeLessThan(downloadCall);
  });

  it("returns a normal owned export and explicitly permits unconfigured local sandbox data without a fake owner", async () => {
    const remote = await exportChildData("owner", child);
    expect(remote.exportReceipt.status).toBe("complete");
    expect(remote.profile).toBe(child);
    state.enabled = false; state.currentUser = null;
    vi.stubGlobal("localStorage", { getItem: () => null });
    const local = await exportChildData(undefined, child);
    expect(local.profile).toBe(child);
    expect(local.privateBookAssets?.issues).toContain("unauthorized");
    expect(local.exportReceipt.status).toBe("incomplete");
    const namedLocal = await exportChildData("local-sandbox", child);
    expect(namedLocal.profile).toBe(child);
  });

  it("never treats an unauthenticated configured Firebase app as local sandbox", async () => {
    state.currentUser = null;
    await expect(exportChildData(undefined, child)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
