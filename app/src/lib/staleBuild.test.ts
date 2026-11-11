import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  STALE_BUILD_RELOAD_KEY, STALE_BUILD_RELOAD_WINDOW_MS, installStaleBuildRecovery, isStaleBuildError, reloadIntoCurrentBuild,
  type StaleBuildEnv,
} from "./staleBuild";

const source = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

function memoryEnv(now = 1_000_000, overrides: Partial<StaleBuildEnv> = {}) {
  const store = new Map<string, string>();
  const env = {
    clock: now,
    reload: vi.fn(),
    storage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } },
    store,
  };
  return { ...env, env: { now: () => env.clock, storage: env.storage, reload: env.reload, ...overrides } as StaleBuildEnv, tick(ms: number) { env.clock += ms; } };
}

describe("isStaleBuildError — the browser wordings of a chunk a release removed", () => {
  it.each([
    "Failed to fetch dynamically imported module: https://arborparentingapp.com/assets/CoachTab-WcNfv40N.js",
    "error loading dynamically imported module: https://arborparentingapp.com/assets/FamilyTopicSheet-_h70ZUHZ.js",
    "Importing a module script failed.",
    "Unable to preload CSS for /assets/FamilyTopicSheet-D_ndI1AS.css",
    "Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of \"text/html\".",
    "'text/html' is not a valid JavaScript MIME type.",
  ])("recognises %s", (message) => {
    expect(isStaleBuildError(new TypeError(message))).toBe(true);
    expect(isStaleBuildError(message)).toBe(true);
  });

  it.each([null, undefined, 42, {}, new Error("Cannot read properties of undefined (reading 'title')"), new Error("Network request failed"), "Failed to fetch"])(
    "leaves an ordinary error (%s) to the usual Try again",
    (error) => { expect(isStaleBuildError(error)).toBe(false); },
  );
});

describe("reloadIntoCurrentBuild — once per window, never a loop", () => {
  it("reloads the first time and records when", () => {
    const m = memoryEnv();
    expect(reloadIntoCurrentBuild(m.env)).toBe(true);
    expect(m.reload).toHaveBeenCalledTimes(1);
    expect(m.store.get(STALE_BUILD_RELOAD_KEY)).toBe(String(m.clock));
  });

  it("a second failure inside the window is an outage: no reload", () => {
    const m = memoryEnv();
    reloadIntoCurrentBuild(m.env);
    m.tick(STALE_BUILD_RELOAD_WINDOW_MS - 1);
    expect(reloadIntoCurrentBuild(m.env)).toBe(false);
    expect(m.reload).toHaveBeenCalledTimes(1);
  });

  it("a later release is a new skew and reloads again", () => {
    const m = memoryEnv();
    reloadIntoCurrentBuild(m.env);
    m.tick(STALE_BUILD_RELOAD_WINDOW_MS);
    expect(reloadIntoCurrentBuild(m.env)).toBe(true);
    expect(m.reload).toHaveBeenCalledTimes(2);
  });

  it("a stamp from the future (clock change) does not block recovery", () => {
    const m = memoryEnv();
    m.store.set(STALE_BUILD_RELOAD_KEY, String(m.clock + 10_000));
    expect(reloadIntoCurrentBuild(m.env)).toBe(true);
  });

  it("without storage there is no loop guard, so it never reloads by itself", () => {
    const m = memoryEnv(1_000_000, { storage: null });
    expect(reloadIntoCurrentBuild(m.env)).toBe(false);
    expect(m.reload).not.toHaveBeenCalled();
  });

  it("storage that throws or drops the write also never reloads", () => {
    const throwing = memoryEnv(1_000_000, { storage: { getItem: () => null, setItem: () => { throw new Error("QuotaExceeded"); } } });
    expect(reloadIntoCurrentBuild(throwing.env)).toBe(false);
    const dropping = memoryEnv(1_000_000, { storage: { getItem: () => null, setItem: () => {} } });
    expect(reloadIntoCurrentBuild(dropping.env)).toBe(false);
    expect(throwing.reload).not.toHaveBeenCalled();
    expect(dropping.reload).not.toHaveBeenCalled();
  });
});

describe("installStaleBuildRecovery — Vite's preload error starts the reload", () => {
  it("listens for vite:preloadError and never cancels it", () => {
    const handlers = new Map<string, (event: Event) => void>();
    const target = { addEventListener: (type: string, handler: (event: Event) => void) => { handlers.set(type, handler); } };
    const m = memoryEnv();
    installStaleBuildRecovery(target as never, m.env);
    const event = new Event("vite:preloadError", { cancelable: true });
    handlers.get("vite:preloadError")!(event);
    expect(m.reload).toHaveBeenCalledTimes(1);
    // Not cancelled: if no reload starts, the error still reaches the boundary.
    expect(event.defaultPrevented).toBe(false);
  });

  it("is installed by the entry module before the app renders", () => {
    const main = source("../main.tsx");
    const install = main.indexOf("installStaleBuildRecovery();");
    expect(install).toBeGreaterThan(-1);
    expect(install).toBeLessThan(main.indexOf("const renderApp"));
  });
});

describe("Shell — the question sheet cannot blank the app", () => {
  it("mounts FamilyTopicSheet inside its own floating ErrorBoundary", () => {
    const shell = source("../components/layout/Shell.tsx");
    expect(shell).toMatch(/<ErrorBoundary floating onReset=\{\(\) => setTopicSheet\(null\)\}><Suspense fallback=\{null\}><FamilyTopicSheet /);
  });
});
