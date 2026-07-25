/**
 * CARE-7 — per-audience export history: the delta section's "prior export
 * exists" gate. Metadata only (audience → ISO timestamp), fail quiet.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getLastExportedAt, recordExport } from "./exportHistory";

// Node environment (no DOM) — minimal in-memory localStorage shim, matching
// the useFamilyGlance.test.ts pattern.
function installLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  } as Storage;
}

describe("consult export history (CARE-7)", () => {
  beforeEach(() => installLocalStorage());
  afterEach(() => { delete (globalThis as unknown as { localStorage?: Storage }).localStorage; });

  it("no prior export → null (the delta section never renders on a first export)", () => {
    expect(getLastExportedAt("child-1", "pediatrician")).toBeNull();
  });

  it("records and reads back per audience — audiences never bleed into each other", () => {
    recordExport("child-1", "pediatrician", "2026-06-01T10:00:00.000Z");
    recordExport("child-1", "slp", "2026-06-10T10:00:00.000Z");
    expect(getLastExportedAt("child-1", "pediatrician")).toBe("2026-06-01T10:00:00.000Z");
    expect(getLastExportedAt("child-1", "slp")).toBe("2026-06-10T10:00:00.000Z");
    expect(getLastExportedAt("child-1", "therapist")).toBeNull();
  });

  it("keys per child — siblings have independent histories", () => {
    recordExport("child-1", "pediatrician", "2026-06-01T10:00:00.000Z");
    expect(getLastExportedAt("child-2", "pediatrician")).toBeNull();
  });

  it("a later export overwrites the audience timestamp", () => {
    recordExport("child-1", "pediatrician", "2026-06-01T10:00:00.000Z");
    recordExport("child-1", "pediatrician", "2026-07-01T10:00:00.000Z");
    expect(getLastExportedAt("child-1", "pediatrician")).toBe("2026-07-01T10:00:00.000Z");
  });

  it("fails quiet on corrupt storage or an invalid stored timestamp", () => {
    localStorage.setItem("arbor.consultExports.child-bad", "{not json");
    expect(getLastExportedAt("child-bad", "pediatrician")).toBeNull();
    localStorage.setItem("arbor.consultExports.child-odd", JSON.stringify({ pediatrician: "not-a-date" }));
    expect(getLastExportedAt("child-odd", "pediatrician")).toBeNull();
  });

  it("fails quiet with no localStorage at all (node/SSR) — never throws, never blocks an export", () => {
    delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
    expect(() => recordExport("child-1", "teacher")).not.toThrow();
    expect(getLastExportedAt("child-1", "teacher")).toBeNull();
  });
});
