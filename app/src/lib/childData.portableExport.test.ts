import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChildProfile } from "../types";
const fixture = vi.hoisted(() => ({ failCollection: "", serverAvailable: true, assetStatus: "complete" as "complete" | "incomplete", paths: [] as string[] }));
const identity = vi.hoisted(() => ({ currentUser: { uid: "synthetic-owner" } }));
vi.mock("./firebase", () => ({ db: {}, firebaseEnabled: true, auth: identity }));
vi.mock("firebase/auth", () => ({ onAuthStateChanged: () => () => undefined }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, path: string) => path,
  getDocs: async (path: string) => {
    fixture.paths.push(path);
    const name = path.split("/").at(-1)!;
    if (name === fixture.failCollection) throw new Error("synthetic source unavailable");
    return { docs: ["heroSheet", "bookAssets"].includes(name)
      ? [{ id: "synthetic", data: () => ({ source: name, ...(name === "bookAssets" ? { bookId: "synthetic", files: ["narration/s/en/p1.mp3"] } : {}) }) }]
      : [] };
  },
  doc: vi.fn(), deleteDoc: vi.fn(),
}));
vi.mock("./api", () => ({ api: { privacyExport: async () => {
  if (!fixture.serverAvailable) throw new Error("synthetic offline");
  return { serverData: { memoryEvents: [], shares: [] } };
} } }));
vi.mock("./bookAssetExport", () => ({ exportPrivateBookAssets: vi.fn(async () => ({ status: fixture.assetStatus })) }));
import { exportChildData, CHILD_SUBCOLLECTIONS } from "./childData";
import { exportPrivateBookAssets } from "./bookAssetExport";
const child = { id: "synthetic-child", name: "Synthetic" } as ChildProfile;
afterEach(() => { fixture.failCollection = ""; fixture.serverAvailable = true; fixture.assetStatus = "complete"; fixture.paths.length = 0; vi.clearAllMocks(); });

describe("B-BOOK-20 record and file completeness are one receipt", () => {
  it("keeps all registered data including heroSheet/bookAssets and passes only the active child's metadata to portability", async () => {
    const result = await exportChildData("synthetic-owner", child);
    expect(result.exportReceipt.status).toBe("complete");
    expect(Object.keys(result.collections)).toEqual(CHILD_SUBCOLLECTIONS);
    for (const name of ["heroSheet", "bookAssets"]) expect(result.collections[name]).toHaveLength(1);
    expect(vi.mocked(exportPrivateBookAssets)).toHaveBeenCalledWith("synthetic-owner", child.id, result.collections.bookAssets, { signal: expect.any(AbortSignal), metadataComplete: true });
    expect(fixture.paths.every((p) => p.startsWith("users/synthetic-owner/children/synthetic-child/"))).toBe(true);
  });

  it("a failed source is explicitly unavailable, never an empty successful export", async () => {
    fixture.failCollection = "bookAssets";
    const result = await exportChildData("synthetic-owner", child);
    expect(result.collections.bookAssets).toEqual([]);
    expect(result.exportReceipt.collections.bookAssets).toBe("unavailable");
    expect(result.exportReceipt.status).toBe("incomplete");
    expect(vi.mocked(exportPrivateBookAssets).mock.calls[0][3]).toMatchObject({ metadataComplete: false });
  });

  it("server-only or private-byte failure keeps the overall receipt incomplete", async () => {
    fixture.serverAvailable = false;
    expect((await exportChildData("synthetic-owner", child)).exportReceipt).toMatchObject({ status: "incomplete", serverData: "unavailable" });
    fixture.serverAvailable = true;
    fixture.assetStatus = "incomplete";
    expect((await exportChildData("synthetic-owner", child)).exportReceipt.status).toBe("incomplete");
  });

  it("cancellation dispatches no child data reads or portable-byte requests", async () => {
    const c = new AbortController(); c.abort();
    await expect(exportChildData("synthetic-owner", child, { signal: c.signal })).rejects.toThrow();
    expect(fixture.paths).toEqual([]);
    expect(exportPrivateBookAssets).not.toHaveBeenCalled();
  });
});
