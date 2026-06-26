import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CHILD_SUBCOLLECTIONS } from "./childData";

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
