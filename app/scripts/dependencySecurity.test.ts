import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Offline rollback guard for the reviewed 18 Oct 2026 fixes. This is NOT a
 * replacement for a fresh dependency audit or a claim that all advisories are
 * resolved. Check every installed lockfile occurrence, including nested ones.
 * Sources: GHSA-rvm3-566m-v7fv, GHSA-jqcg-44mw-7w3h,
 * GHSA-xv26-6w52-cph6 and node-tar advisories through GHSA-r292-9mhp-454m. */
const floors = [
  ["@capacitor/android", "8.4.3"],
  ["@capacitor/ios", "8.4.3"],
  ["proxy-addr", "2.0.8"],
  ["websocket-driver", "0.7.5"],
  ["tar", "7.5.22"],
] as const;

function atLeast(actual: unknown, floor: string): boolean {
  if (typeof actual !== "string" || !/^\d+\.\d+\.\d+$/.test(actual)) return false;
  const a = actual.split(".").map(Number), b = floor.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return true;
}

const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8")) as {
  packages: Record<string, { version?: string }>;
};

describe("reviewed dependency security floors", () => {
  it.each(floors)("keeps every %s occurrence at or above %s", (name, floor) => {
    const matches = Object.entries(lock.packages).filter(([path]) => path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`));
    expect(matches.length, `${name} must remain represented in the lockfile`).toBeGreaterThan(0);
    for (const [path, pkg] of matches) expect(atLeast(pkg.version, floor), `${path}: ${pkg.version}; reviewed floor ${floor}`).toBe(true);
  });

  it("keeps the core, CLI and native Capacitor packages aligned", () => {
    const versions = ["core", "cli", "android", "ios"].map(name => lock.packages[`node_modules/@capacitor/${name}`]?.version);
    expect(versions.every(version => atLeast(version, "8.4.3"))).toBe(true);
    expect(new Set(versions).size).toBe(1);
  });

  it.each([
    ["8.4.0", "8.4.3"], ["2.0.7", "2.0.8"], ["0.7.4", "0.7.5"],
    ["7.5.16", "7.5.22"], ["7.5.20", "7.5.22"],
    ["8.4.3-beta.1", "8.4.3"], [undefined, "8.4.3"],
  ])("refuses stale or unverified version %s against floor %s", (version, floor) => {
    expect(atLeast(version, floor)).toBe(false);
  });
});
