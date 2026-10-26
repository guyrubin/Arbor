/** B-BOOK-20 / B-KID-165: child-owned Studio creations must export and erase. */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChildProfile } from "../types";

vi.mock("./api", () => ({ api: {
  privacyExport: async () => { throw new Error("synthetic offline"); },
  privacyErase: async () => { throw new Error("synthetic offline"); },
} }));
import { CHILD_SUBCOLLECTIONS, exportChildData, eraseEverything } from "./childData";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
  has(key: string) { return this.values.has(key); }
}

afterEach(() => vi.unstubAllGlobals());

describe("saved Studio creations child-data lifecycle", () => {
  it("registers exactly one Studio creation subcollection", () => {
    expect(CHILD_SUBCOLLECTIONS.filter((name) => name === "studioCreations")).toHaveLength(1);
  });

  it("exports one synthetic child and erases only that child's saved creations", async () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    vi.stubGlobal("localStorage", local as unknown as Storage);
    vi.stubGlobal("sessionStorage", session as unknown as Storage);

    const first = { id: "corner", ownerId: "local", childId: "synthetic-a",
      creation: { kind: "corner", layout: ["plant", null, "books", null, null, null], light: "night", scene: "garden" } };
    const second = { ...first, childId: "synthetic-b" };
    local.setItem("arbor.studioCreations.synthetic-a", JSON.stringify([first]));
    local.setItem("arbor.studioCreations.synthetic-b", JSON.stringify([second]));

    const exported = await exportChildData(undefined,
      { id: "synthetic-a", name: "Synthetic A" } as ChildProfile);
    expect(exported.collections.studioCreations).toEqual([first]);
    expect(exported.exportReceipt.collections.studioCreations).toBe("included");
    // Simulated server outage must not be mislabeled as a complete export.
    expect(exported.exportReceipt.status).toBe("incomplete");

    const receipt = await eraseEverything(undefined, "synthetic-a");
    expect(receipt.childId).toBe("synthetic-a");
    expect(local.has("arbor.studioCreations.synthetic-a")).toBe(false);
    expect(JSON.parse(local.getItem("arbor.studioCreations.synthetic-b") ?? "null")).toEqual([second]);
  });

  it("reports malformed offline creation data as unavailable and erases only the selected child", async () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    vi.stubGlobal("localStorage", local as unknown as Storage);
    vi.stubGlobal("sessionStorage", session as unknown as Storage);
    const sibling = [{ id: "melody", ownerId: "local", childId: "synthetic-b",
      creation: { kind: "melody", notes: [0, 2, 1], tempo: 760 } }];
    local.setItem("arbor.studioCreations.synthetic-a", JSON.stringify({ unexpected: "not a list" }));
    local.setItem("arbor.studioCreations.synthetic-b", JSON.stringify(sibling));

    const exported = await exportChildData(undefined,
      { id: "synthetic-a", name: "Synthetic A" } as ChildProfile);
    expect(exported.collections.studioCreations).toEqual([]);
    expect(exported.exportReceipt.collections.studioCreations).toBe("unavailable");
    expect(exported.exportReceipt.status).toBe("incomplete");

    await eraseEverything(undefined, "synthetic-a");
    expect(local.getItem("arbor.studioCreations.synthetic-a")).toBeNull();
    expect(JSON.parse(local.getItem("arbor.studioCreations.synthetic-b") ?? "null")).toEqual(sibling);
  });

});
