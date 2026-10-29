/**
 * B-BOOK-71 (production guard) — the sandbox book mode never runs in
 * production. The mode is ONE predicate (localBookModeFor); routes/api.ts
 * derives every sandbox seam of the book routes from it (the local bucket, the
 * anonymous "local-sandbox" reader on the book proxy, the sheet, narration and
 * plate routes' local flags). Booting the real config invariants proves the
 * branch is dead under ARBOR_ENV=prod, and a forged prod config with a local
 * adapter still gets no local book mode. The sandbox keeps its mode.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig, type ArborConfig } from "../config/env.js";
import { localBookModeFor } from "./localBookAssetBucket.js";

const KEYS = ["ARBOR_ENV", "MODEL_PROVIDER", "MEMORY_ADAPTER", "ENABLE_LOCAL_MEMORY_ADAPTER", "GCP_PROJECT_ID", "FIREBASE_PROJECT_ID"] as const;
let saved: Record<string, string | undefined> = {};
beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const prodEnv = (over: Partial<Record<(typeof KEYS)[number], string>> = {}) => {
  Object.assign(process.env, { ARBOR_ENV: "prod", MODEL_PROVIDER: "vertex", MEMORY_ADAPTER: "firestore", ENABLE_LOCAL_MEMORY_ADAPTER: "false", GCP_PROJECT_ID: "arbor-test", FIREBASE_PROJECT_ID: "arbor-test" }, over);
};

describe("B-BOOK-71 · the local book mode is dead under ARBOR_ENV=prod", () => {
  it("a production boot that asks for the local adapter is refused", () => {
    prodEnv({ MEMORY_ADAPTER: "local" });
    expect(() => loadConfig()).toThrow(/Production Arbor requires MEMORY_ADAPTER=firestore/);
    prodEnv({ MEMORY_ADAPTER: "firestore", ENABLE_LOCAL_MEMORY_ADAPTER: "true" });
    expect(() => loadConfig()).toThrow(/cannot enable ENABLE_LOCAL_MEMORY_ADAPTER/);
  });

  it("every production config the invariants accept has no local book mode", () => {
    prodEnv();
    expect(localBookModeFor(loadConfig())).toBe(false);
    delete process.env.MEMORY_ADAPTER; // prod's default adapter
    expect(localBookModeFor(loadConfig())).toBe(false);
  });

  it("a forged prod config with a local adapter still gets no local book mode (belt and braces)", () => {
    const forged = { arborEnv: "prod", memoryAdapter: "local" } as Pick<ArborConfig, "arborEnv" | "memoryAdapter">;
    expect(localBookModeFor(forged)).toBe(false);
  });

  it("the sandbox keeps its local book mode (local and dev on the local adapter); firestore never has it", () => {
    for (const env of ["local", "dev", "stage"] as const) {
      expect(localBookModeFor({ arborEnv: env, memoryAdapter: "local" })).toBe(true);
      expect(localBookModeFor({ arborEnv: env, memoryAdapter: "firestore" })).toBe(false);
    }
    process.env.ARBOR_ENV = "local";
    expect(localBookModeFor(loadConfig())).toBe(true);
  });

  it("routes/api.ts derives every book-route sandbox seam from the one predicate", () => {
    const api = readFileSync(path.resolve(__dirname, "../routes/api.ts"), "utf8");
    expect(api).toMatch(/const localBooks = localBookModeFor\(config\);/);
    // No second, unguarded spelling of the mode.
    expect(api).not.toMatch(/localBooks\s*=\s*config\.memoryAdapter/);
    const flags = [...api.matchAll(/\b(allowLocal|local):\s*([^,}\n]+)/g)].map((m) => m[2].trim());
    expect(flags.length).toBeGreaterThanOrEqual(5);
    expect(flags.filter((v) => v !== "localBooks")).toEqual([]);
    expect(api).toMatch(/const localBookBucket = localBooks \? localBookAssetBucket\(\) : null;/);
  });
});
