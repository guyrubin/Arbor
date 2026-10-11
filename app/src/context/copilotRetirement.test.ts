import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { copilotRedirectHash, FALLBACK_ROUTE, resolveHash } from "../lib/routes";

// Execute the real routing effect, without mounting auth or touching real
// storage/network. This guards replaceState and the registered hash listener,
// not just the route resolver that previously left retired hashes unchanged.
const source = readFileSync(new URL("./ArborContext.tsx", import.meta.url), "utf8");
const start = source.indexOf("  // IA-1: keep the URL hash in sync");
const end = source.indexOf("  // Persist UI preferences.", start);
const effect = source.slice(start, end);
const code = ts.transpileModule(effect, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function harness(hash: string, stored: string | null = null) {
  const listeners = new Map<string, () => void>();
  const initial = resolveHash(hash, stored);
  let tab = initial.tab;
  let locked = false;
  const historyState = { existing: true };
  const location = { hash };
  const replaceState = vi.fn((_state: unknown, _title: string, next: string) => { location.hash = next; });
  const window = { location, history: { state: historyState, replaceState }, addEventListener: (name: string, fn: () => void) => listeners.set(name, fn), removeEventListener: (name: string) => listeners.delete(name) };
  let cleanup: (() => void) | undefined;
  const env = { window, useEffect: (fn: () => (() => void)) => { cleanup = fn(); }, isKidModeActive: () => locked, resolveHash, copilotRedirectHash, FALLBACK_ROUTE, activeTab: initial.tab, unknownHashRef: { current: initial.unknown }, setActiveTabState: (next: typeof tab) => { tab = next; }, toast: vi.fn(), t: (key: string) => key };
  new Function(...Object.keys(env), code)(...Object.values(env));
  return { location, replaceState, historyState, tab: () => tab, navigate: (next: string) => { location.hash = next; listeners.get("hashchange")!(); }, lock: () => { locked = true; }, cleanup: () => cleanup?.(), listeners };
}
afterEach(() => vi.restoreAllMocks());

describe("B-GROWTH-22 · canonical retired URL in the actual routing effect", () => {
  for (const raw of ["#/copilot", "#/COPILOT/", "#/full-picture", "#/The-Full-Picture", "#/development-dashboard"]) it(`${raw} replaces the current entry with the existing development route`, () => {
    const app = harness(raw);
    expect(app.tab()).toBe("development");
    expect(app.location.hash).toBe("#/development");
    expect(app.replaceState).toHaveBeenCalledExactlyOnceWith(app.historyState, "", "#/development");
    app.cleanup(); expect(app.listeners.size).toBe(0);
  });

  it("preserves query bytes, including encoded text, without inventing new query semantics", () => {
    const raw = "#/copilot/?view=domain&note=%D7%A9%20x";
    const destination = "#/development?view=domain&note=%D7%A9%20x";
    expect(copilotRedirectHash(raw)).toBe(destination);
    expect(harness(raw).location.hash).toBe(destination);
  });

  it("empty hash restores stored copilot directly to a canonical development URL", () => {
    const app = harness("", "copilot");
    expect(app.tab()).toBe("development");
    expect(app.location.hash).toBe("#/development");
  });

  it("legacy arrival through Back/Forward uses the same registered handler", () => {
    const app = harness("#/consult");
    app.navigate("#/copilot"); expect(app.tab()).toBe("development"); expect(app.location.hash).toBe("#/development");
    app.navigate("#/consult"); expect(app.tab()).toBe("consult");
    app.navigate("#/full-picture"); expect(app.tab()).toBe("development"); expect(app.location.hash).toBe("#/development");
    expect(app.replaceState).toHaveBeenCalledTimes(2);
  });

  it("does not alter other live/retired hashes or aliases, or navigate under Kid Mode", () => {
    for (const hash of ["#/development", "#/today", "#/strengths", "#/growth-journey"]) {
      expect(copilotRedirectHash(hash)).toBeNull();
      const app = harness(hash); expect(app.location.hash).toBe(hash); expect(app.replaceState).not.toHaveBeenCalled();
    }
    const app = harness("#/consult"); app.lock(); app.navigate("#/copilot");
    expect(app.tab()).toBe("consult"); expect(app.replaceState).not.toHaveBeenCalled();
  });
});
