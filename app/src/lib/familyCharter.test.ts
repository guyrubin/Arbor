/**
 * LC-22 — the Family Charter store.
 *
 * Three properties are held here, each with a negative control:
 *
 *  1. A read NEVER throws and NEVER returns a non-array. The shipped surface
 *     did `setValues(JSON.parse(raw))` with no shape check, so a non-array in
 *     the store made `values.map` throw and killed the only screen that could
 *     have repaired the charter.
 *  2. The charter is PER FAMILY, so it must NOT be child-scoped — a sibling
 *     deletion cannot erase the whole family's values — while still being
 *     covered by the full-account wipe. Both are asserted against the real
 *     `isChildScopedKey` and the real DeleteAccountModal source.
 *  3. The key has ONE definition. `lib/becoming.ts` holds the same literal and
 *     is outside this change's file ownership, so instead of letting the two
 *     drift silently, the source is scanned and pinned.
 *
 * Scan discipline (this repo has been bitten by vacuous scans): every scanned
 * file is asserted non-empty and asserted to contain a landmark that proves the
 * right file was read, \r\n is normalised before any regex runs, and each
 * extractor is proved to REJECT a fixture that violates the rule.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isChildScopedKey, clearChildLocalState } from "./childLocalState";
import {
  DEFAULT_CHARTER_VALUES,
  FAMILY_CHARTER_KEY,
  MAX_CHARTER_VALUES,
  MAX_CHARTER_VALUE_LENGTH,
  hasSavedFamilyCharter,
  initialCharterValues,
  loadFamilyCharter,
  normalizeCharterValues,
  saveFamilyCharter,
  type CharterStore,
} from "./familyCharter";
import { loadCharter } from "./becoming";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(here, "..");

/** Read a source file with \r\n normalised — this tree is CRLF on disk. */
function readSource(rel: string): string {
  return readFileSync(path.join(SRC_ROOT, rel), "utf8").replace(/\r\n/g, "\n");
}

function fakeStore(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => { map.clear(); },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  } as Storage;
}

const hostileStore: CharterStore = {
  getItem() { throw new Error("storage is blocked"); },
  setItem() { throw new Error("storage is blocked"); },
};

/* ── 1. A read never throws, never returns a non-array ─────────────────────── */

describe("loading a charter is total — no shape in the store can break the surface", () => {
  it.each([
    ["corrupt JSON", "{not json"],
    ["an object", JSON.stringify({ Courage: true })],
    ["a bare string", JSON.stringify("Courage")],
    ["null", JSON.stringify(null)],
    ["a number", JSON.stringify(4)],
    ["nested arrays", JSON.stringify([["Courage"], ["Honesty"]])],
  ])("%s → an empty charter, not a crash", (_label, raw) => {
    const store = fakeStore({ [FAMILY_CHARTER_KEY]: raw });
    expect(() => loadFamilyCharter(store)).not.toThrow();
    const values = loadFamilyCharter(store);
    expect(Array.isArray(values)).toBe(true);
    expect(values).toEqual([]);
  });

  it("NEGATIVE CONTROL — the raw parse the surface used to do DOES produce a non-array", () => {
    // Verbatim shape of the shipped line: `setValues(JSON.parse(raw))`.
    // If this ever starts returning an array, the fixture stopped reproducing
    // the defect and the tests above prove nothing.
    const raw = JSON.stringify({ Courage: true });
    expect(Array.isArray(JSON.parse(raw))).toBe(false);
    // …and that value is exactly what `values.map(...)` throws on.
    expect(() => (JSON.parse(raw) as string[]).map((v) => v)).toThrow();
  });

  it("a blocked or absent store reads as an empty charter and never throws", () => {
    expect(loadFamilyCharter(null)).toEqual([]);
    expect(loadFamilyCharter(hostileStore)).toEqual([]);
    expect(() => saveFamilyCharter(["Courage"], hostileStore)).not.toThrow();
    // The edit still holds for this session; it is simply not remembered.
    expect(saveFamilyCharter(["Courage"], hostileStore)).toEqual(["Courage"]);
  });

  it("NEGATIVE CONTROL — the same fake-store harness DOES round-trip when it works", () => {
    const working = fakeStore();
    saveFamilyCharter(["Courage"], working);
    expect(loadFamilyCharter(working)).toEqual(["Courage"]);
  });
});

describe("normalisation", () => {
  it("keeps trimmed non-empty strings, in the family's own order", () => {
    expect(normalizeCharterValues([" Courage ", "Honesty"])).toEqual(["Courage", "Honesty"]);
  });

  it("drops non-strings and blanks rather than rendering them", () => {
    expect(normalizeCharterValues(["Courage", 3, null, { v: "x" }, "   ", undefined])).toEqual(["Courage"]);
  });

  it("deduplicates case-insensitively — typed twice, meant once", () => {
    expect(normalizeCharterValues(["Kindness", "kindness", "KINDNESS"])).toEqual(["Kindness"]);
  });

  it("caps the count and the length of each value", () => {
    const many = Array.from({ length: MAX_CHARTER_VALUES + 6 }, (_, i) => `value-${i}`);
    expect(normalizeCharterValues(many)).toHaveLength(MAX_CHARTER_VALUES);
    const long = "x".repeat(MAX_CHARTER_VALUE_LENGTH + 40);
    expect(normalizeCharterValues([long])[0]).toHaveLength(MAX_CHARTER_VALUE_LENGTH);
  });

  it("accepts Hebrew values unchanged", () => {
    expect(normalizeCharterValues(["אומץ", "כנות"])).toEqual(["אומץ", "כנות"]);
  });
});

describe("a saved charter survives, including one the family emptied", () => {
  it("never saved → the starter set is offered, and nothing is stored yet", () => {
    const store = fakeStore();
    expect(hasSavedFamilyCharter(store)).toBe(false);
    expect(initialCharterValues(store)).toEqual([...DEFAULT_CHARTER_VALUES]);
    // NEGATIVE CONTROL: offering the starter set must not PERSIST it — that is
    // what made the hero strip claim an aim the family never declared.
    expect(store.getItem(FAMILY_CHARTER_KEY)).toBeNull();
    expect(loadFamilyCharter(store)).toEqual([]);
  });

  it("saved values come back on the next open", () => {
    const store = fakeStore();
    saveFamilyCharter(["Patience", "Courage"], store);
    expect(hasSavedFamilyCharter(store)).toBe(true);
    expect(initialCharterValues(store)).toEqual(["Patience", "Courage"]);
  });

  it("a deliberately emptied charter stays empty — a choice, not an absence", () => {
    const store = fakeStore();
    saveFamilyCharter([], store);
    expect(hasSavedFamilyCharter(store)).toBe(true);
    expect(initialCharterValues(store)).toEqual([]);
    // NEGATIVE CONTROL: without the "has saved" distinction this returns the
    // four starter words and silently re-declares values the family removed.
    expect(initialCharterValues(store)).not.toEqual([...DEFAULT_CHARTER_VALUES]);
  });

  it("a corrupt store falls back to the starter set rather than a dead screen", () => {
    const store = fakeStore({ [FAMILY_CHARTER_KEY]: "{not json" });
    expect(hasSavedFamilyCharter(store)).toBe(false);
    expect(initialCharterValues(store)).toEqual([...DEFAULT_CHARTER_VALUES]);
  });
});

/* ── 2. Per family, not per child ──────────────────────────────────────────── */

describe("the charter is per FAMILY — deletion behaves accordingly", () => {
  it("is NOT child-scoped, so one child's deletion cannot erase the family's values", () => {
    expect(isChildScopedKey(FAMILY_CHARTER_KEY, "kid-a")).toBe(false);
    const local = fakeStore({
      [FAMILY_CHARTER_KEY]: JSON.stringify(["Courage"]),
      "arbor.learn.read.kid-a": JSON.stringify(["boundary-testing"]),
    });
    const removed = clearChildLocalState("kid-a", { local, session: null });
    // The child's own row goes; the household's values stay.
    expect(removed).toBe(1);
    expect(local.getItem("arbor.learn.read.kid-a")).toBeNull();
    expect(loadFamilyCharter(local)).toEqual(["Courage"]);
  });

  it("NEGATIVE CONTROL — a child-shaped charter key WOULD be swept away", () => {
    // The exact mistake this decision avoids: had the charter been minted as
    // `arbor.familyCharter.<childId>`, deleting one of two children would take
    // the whole family's values with it.
    const childShaped = `${FAMILY_CHARTER_KEY}.kid-a`;
    expect(isChildScopedKey(childShaped, "kid-a")).toBe(true);
    const local = fakeStore({ [childShaped]: JSON.stringify(["Courage"]) });
    expect(clearChildLocalState("kid-a", { local, session: null })).toBe(1);
    expect(local.getItem(childShaped)).toBeNull();
  });

  it("full ACCOUNT deletion still covers it — the real wipe is prefix-based", () => {
    const source = readSource("components/layout/DeleteAccountModal.tsx");
    // The scan is real: right file, non-trivial, and carrying its landmark.
    expect(source.length).toBeGreaterThan(2_000);
    expect(source).toContain("wipeDeviceData");
    // The device wipe removes every arbor-prefixed localStorage key.
    expect(source).toMatch(/key\.startsWith\("arbor"\)/);
    expect(source).toMatch(/localStorage\.removeItem\(key\)/);
    // …and this key is covered by that prefix.
    expect(FAMILY_CHARTER_KEY.startsWith("arbor")).toBe(true);
  });

  it("NEGATIVE CONTROL — a key outside the arbor prefix would survive that wipe", () => {
    const wipes = (key: string) => key.startsWith("arbor");
    expect(wipes("familyCharter")).toBe(false);
    expect(wipes("vendor.arbor.familyCharter")).toBe(false);
    expect(wipes(FAMILY_CHARTER_KEY)).toBe(true);
  });
});

/* ── 3. One key, one definition ────────────────────────────────────────────── */

/** The `arbor.*` string literal assigned to a `*CHARTER*`/`KEY` const. */
function charterKeyLiteral(source: string): string | null {
  return source.match(/(?:CHARTER_KEY|FAMILY_CHARTER_KEY)\s*(?::[^=]*)?=\s*"(arbor\.[^"]+)"/)?.[1] ?? null;
}

describe("the charter key has one definition across the tree", () => {
  it("becoming.ts reads the same key this module owns", () => {
    const source = readSource("lib/becoming.ts");
    // Scan discipline: prove the right, non-empty file was read.
    expect(source.length).toBeGreaterThan(500);
    expect(source).toContain("export const loadCharter");

    // Two acceptable states, and the second is STRONGER. Originally becoming.ts
    // spelled its own "arbor.familyCharter" literal, and this test's job was to
    // notice when the two copies drifted apart. It now imports the constant, so
    // there is no second copy left to drift — detection is replaced by
    // impossibility. Both are accepted, because the property under test is "one
    // key", not "one particular way of spelling it".
    const importsTheConstant =
      /import\s*\{[^}]*\bFAMILY_CHARTER_KEY\b[^}]*\}\s*from\s*["']\.\/familyCharter["']/.test(source);
    if (importsTheConstant) {
      // ...and having imported it, it must not also carry a rival literal.
      expect(charterKeyLiteral(source)).toBeNull();
      expect(source).toContain("FAMILY_CHARTER_KEY");
    } else {
      expect(charterKeyLiteral(source)).toBe(FAMILY_CHARTER_KEY);
    }
  });

  it("NEGATIVE CONTROL — neither acceptable state is vacuous", () => {
    const importing = `import { FAMILY_CHARTER_KEY } from "./familyCharter";\nconst CHARTER_KEY = FAMILY_CHARTER_KEY;`;
    const drifted = `import { FAMILY_CHARTER_KEY } from "./familyCharter";\nconst CHARTER_KEY = "arbor.familyValues";`;
    const detect = (src: string) =>
      /import\s*\{[^}]*\bFAMILY_CHARTER_KEY\b[^}]*\}\s*from\s*["']\.\/familyCharter["']/.test(src);
    // The importing form carries no rival literal...
    expect(detect(importing)).toBe(true);
    expect(charterKeyLiteral(importing)).toBeNull();
    // ...while a file that imports the constant and THEN redefines its own key
    // is exactly the drift this describe block exists to catch.
    expect(detect(drifted)).toBe(true);
    expect(charterKeyLiteral(drifted)).toBe("arbor.familyValues");
    expect(charterKeyLiteral(drifted)).not.toBeNull();
  });

  it("NEGATIVE CONTROL — the extractor rejects a drifted key", () => {
    // If it could not tell these apart, the test above would be decorative.
    expect(charterKeyLiteral(`const CHARTER_KEY = "arbor.familyValues";`)).toBe("arbor.familyValues");
    expect(charterKeyLiteral(`const CHARTER_KEY = "arbor.familyValues";`)).not.toBe(FAMILY_CHARTER_KEY);
    expect(charterKeyLiteral("no key here at all")).toBeNull();
  });

  it("becoming.loadCharter and loadFamilyCharter agree on the same bytes", () => {
    // Both read the real global localStorage, so install one for this test.
    const store = fakeStore();
    const g = globalThis as unknown as { localStorage?: Storage };
    const previous = g.localStorage;
    g.localStorage = store;
    try {
      saveFamilyCharter(["Courage", "Honesty"]);
      expect(loadCharter()).toEqual(["Courage", "Honesty"]);
      expect(loadFamilyCharter()).toEqual(loadCharter());
    } finally {
      if (previous === undefined) delete g.localStorage;
      else g.localStorage = previous;
    }
  });

  it("the Family Formation surface no longer touches storage itself", () => {
    const source = readSource("components/sections/FamilyFormation.tsx");
    expect(source.length).toBeGreaterThan(2_000);
    expect(source).toContain("Family Charter"); // landmark: the right surface
    expect(source).toContain('from "../../lib/familyCharter"');
    // The two defects, as source shapes: a raw parse of the stored value, and
    // any direct localStorage access on this surface.
    expect(source).not.toMatch(/JSON\.parse/);
    expect(source).not.toMatch(/localStorage/);
  });

  it("NEGATIVE CONTROL — those matchers DO fire on the code that shipped", () => {
    const shipped =
      'useEffect(() => {\n' +
      '  try { const raw = localStorage.getItem(KEY); if (raw) setValues(JSON.parse(raw)); } catch { }\n' +
      '}, []);\n' +
      'useEffect(() => {\n' +
      '  try { localStorage.setItem(KEY, JSON.stringify(values)); } catch { }\n' +
      '}, [values]);';
    expect(shipped).toMatch(/JSON\.parse/);
    expect(shipped).toMatch(/localStorage/);
  });
});
