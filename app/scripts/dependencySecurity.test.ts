import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Offline rollback guard for the reviewed 18 Oct 2026 fixes (PR151 and
 * B-GA-33). This is NOT a replacement for a fresh dependency audit or a claim
 * that all advisories are resolved. Check every installed lockfile occurrence,
 * including nested ones.
 * Sources: GHSA-rvm3-566m-v7fv, GHSA-jqcg-44mw-7w3h, GHSA-xv26-6w52-cph6,
 * node-tar advisories through GHSA-r292-9mhp-454m, GHSA-82fw-gwwq-j7x9
 * (vitest mocker), GHSA-g7r4-m6w7-qqqr (esbuild 0.28). */
const floors = [
  ["@capacitor/android", "8.4.3"],
  ["@capacitor/ios", "8.4.3"],
  ["proxy-addr", "2.0.8"],
  ["websocket-driver", "0.7.5"],
  ["tar", "7.5.22"],
  ["vitest", "4.1.11"],
  ["@vitest/mocker", "4.1.11"],
  ["@vitest/coverage-v8", "4.1.11"],
] as const;

/** B-GA-33 retained findings (see docs/releases/dependency-security-2026-10-18.md).
 * Each retained advisory must stay confined to the exact lockfile paths that were
 * reviewed, and the hoisted @grpc/grpc-js used by firebase-admin must stay on the
 * patched 1.14.x line. A new path, or a hoisted copy that rolls back, fails here. */
const retained = {
  "@grpc/grpc-js": {
    pinnedFloor: "1.14.5",
    allowedLegacyPaths: ["node_modules/@firebase/firestore/node_modules/@grpc/grpc-js"],
  },
  uuid: {
    pinnedFloor: "11.1.1",
    allowedLegacyPaths: [
      "node_modules/@google-cloud/storage/node_modules/gaxios/node_modules/uuid",
      "node_modules/@google-cloud/vertexai/node_modules/uuid",
      "node_modules/google-gax/node_modules/uuid",
      "node_modules/gtoken/node_modules/uuid",
      "node_modules/teeny-request/node_modules/uuid",
    ],
  },
} as const;

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

  it.each(Object.entries(retained))("confines retained %s findings to the reviewed paths", (name, rule) => {
    const matches = Object.entries(lock.packages).filter(([path]) => path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`));
    expect(matches.length, `${name} must remain represented in the lockfile`).toBeGreaterThan(0);
    const legacy = new Set<string>(rule.allowedLegacyPaths);
    for (const [path, pkg] of matches) {
      if (legacy.has(path)) continue;
      expect(atLeast(pkg.version, rule.pinnedFloor), `${path}: ${pkg.version} is an unreviewed vulnerable copy; floor ${rule.pinnedFloor}`).toBe(true);
    }
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
