import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CHILD_SUBCOLLECTIONS, exportChildData, eraseEverything } from "./childData";
import type { ChildProfile } from "../types";

// The export/erase calls below hit the server first; offline here, so the
// client half (what this file guards) is what runs.
vi.mock("./api", () => ({
  api: {
    privacyExport: async () => { throw new Error("offline"); },
    privacyErase: async () => { throw new Error("offline"); },
  },
}));

// Guard against the caps-reconcile COPPA/GDPR finding: a per-child
// useChildCollection("name") sink that is NOT registered in
// CHILD_SUBCOLLECTIONS silently escapes both the data export (Art. 15/20) and
// erasure + deletion-receipt (Art. 17). This test fails the build the moment a
// new child sub-collection is added without registering it, so child data can
// never again be written to a sink that deletion/export can't reach.
const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function collectChildCollectionSinks(dir: string, acc: Set<string>): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectChildCollectionSinks(p, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      const text = readFileSync(p, "utf8");
      const re = /useChildCollection\s*(?:<[\s\S]*?>)?\s*\(\s*[\s\S]*?,\s*"([^"]+)"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) acc.add(m[1]);
    }
  }
}

describe("child-data GDPR allow-list completeness", () => {
  it(
    "registers every useChildCollection sink in CHILD_SUBCOLLECTIONS (export + erasure)",
    () => {
      const sinks = new Set<string>();
      collectChildCollectionSinks(SRC_ROOT, sinks);

    // Sanity: the scan actually found sinks (guards against a broken regex
    // silently making this test pass).
    expect(sinks.size).toBeGreaterThan(10);

    const missing = [...sinks].filter((name) => !CHILD_SUBCOLLECTIONS.includes(name)).sort();
    expect(
      missing,
      `child sub-collections missing from CHILD_SUBCOLLECTIONS (they would escape GDPR export + erasure): ${missing.join(", ")}`,
    ).toEqual([]);
    },
    // This test does a synchronous recursive walk + readFileSync of every
    // source file under src/. Under full-suite parallel cold-start (many workers
    // doing heavy cold imports at once) the disk I/O contention can push the
    // walk past vitest's 5s default testTimeout on constrained runners, even
    // though the work itself is ~1s in isolation. Raise the per-test ceiling
    // so the guard doesn't flake under parallel load; the work is bounded and
    // the assertion is unchanged.
    30_000,
  );
});

/* B-GROWTH-10 (Guy G9) — the parent's keepsake notes moved from a device-local
   key into the `keepsakes` subcollection. Registered, they ride the Art. 15/20
   export and the Art. 17 erase like every other per-child sink. */
describe("B-GROWTH-10 — keepsakes export and erase with the child", () => {
  const installStorage = () => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      get length() { return map.size; },
      clear: () => map.clear(),
      key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, String(v)); },
      removeItem: (k: string) => { map.delete(k); },
    } as Storage);
    vi.stubGlobal("sessionStorage", { get length() { return 0; }, key: () => null, getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} } as Storage);
    return map;
  };
  const doc = { id: "ms-1", milestoneId: "ms-1", note: "three steps to me", noticedOn: "2026-09-20", createdAt: "t", updatedAt: "t" };

  it("is registered", () => {
    expect(CHILD_SUBCOLLECTIONS).toContain("keepsakes");
  });

  it("the export JSON carries collections.keepsakes", async () => {
    const map = installStorage();
    map.set("arbor.keepsakes.c1", JSON.stringify([doc]));
    const out = await exportChildData(undefined, { id: "c1", name: "Noa" } as ChildProfile);
    expect(out.collections.keepsakes).toEqual([doc]);
  });

  it("child erase removes it", async () => {
    const map = installStorage();
    map.set("arbor.keepsakes.c1", JSON.stringify([doc]));
    map.set("arbor.keepsakes.c2", JSON.stringify([doc]));
    const receipt = await eraseEverything(undefined, "c1");
    expect(map.has("arbor.keepsakes.c1")).toBe(false);
    expect(map.has("arbor.keepsakes.c2")).toBe(true); // a sibling's notes stay
    expect(receipt.childId).toBe("c1");
  });
});
