import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import type { ChildProfile } from "../types";
import type { Focus, FocusSignals, useTodaysFocus } from "./useTodaysFocus";

const source = readFileSync(resolve(process.cwd(), "src/hooks/useTodaysFocus.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const DAY = "2026-10-09";
const validFocus = (text: string, lang: Focus["lang"] = "en"): Focus => ({ text, tryToday: text, lang, dateKey: DAY, generatedAt: `${DAY}T08:00:00Z` });
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
type Snapshot = { exists: () => boolean; data: () => Focus | null };
const snapshot = (focus: Focus | null): Snapshot => ({ exists: () => focus !== null, data: () => focus });
const tick = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };

/** Exercise the actual hook with controlled effects and asynchronous I/O.
 * This follows the repository's callback harness pattern; it is not a claim
 * of browser-mounted React evidence. No Firebase or network call can escape. */
function harness() {
  const slots: any[] = [];
  let cursor = 0, dirty = false, disposed = false;
  let effects: (() => void)[] = [];
  let child = { id: "child-a", name: "Noa", age: 4 } as ChildProfile;
  let signals: FocusSignals = { count: 2, topTrigger: "" };
  const auth = { user: { uid: "parent-a" } };
  const language = { uiLang: "en" };
  const same = (a?: unknown[], b?: unknown[]) => !!a && !!b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState: (initial: any) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (next: any) => {
        if (disposed) throw new Error("State update after unmount");
        const value = typeof next === "function" ? next(slots[index]) : next;
        if (!Object.is(value, slots[index])) { slots[index] = value; dirty = true; }
      }];
    },
    useRef: (initial: any) => { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback: (callback: any, deps: unknown[]) => {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { deps, callback };
      return slots[index].callback;
    },
    useEffect: (callback: () => void | (() => void), deps?: unknown[]) => {
      const index = cursor++, previous = slots[index];
      if (!previous || !same(previous.deps, deps)) {
        const slot = { deps, cleanup: undefined as void | (() => void) };
        slots[index] = slot;
        effects.push(() => { previous?.cleanup?.(); slot.cleanup = callback(); });
      }
    },
  };
  const reads: { path: string; pending: ReturnType<typeof deferred<Snapshot>> }[] = [];
  const fetches: { body: { childProfile: ChildProfile; language: string }; pending: ReturnType<typeof deferred<{ ok: boolean; json: () => Promise<unknown> }>> }[] = [];
  const getDoc = vi.fn((path: string) => { const pending = deferred<Snapshot>(); reads.push({ path, pending }); return pending.promise; });
  const setDoc = vi.fn(async () => {});
  const fetch = vi.fn((_url: string, request: { body: string }) => {
    const pending = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    fetches.push({ body: JSON.parse(request.body), pending });
    return pending.promise;
  });
  const imports: Record<string, unknown> = {
    react,
    "firebase/firestore": { doc: (_db: unknown, path: string) => path, getDoc, setDoc },
    "../lib/firebase": { db: {}, firebaseEnabled: true },
    "../context/AuthContext": { useAuth: () => auth },
    "../context/LanguageContext": { useLanguage: () => language },
    "../lib/api": { authHeaders: async () => ({}) },
    "../lib/kpiEvents": { trackLoopContinued: vi.fn() },
    "../practice/signals": { dayKey: () => DAY },
    "../ai/journalContext": { WHY_MAX: 240 },
  };
  const module = { exports: {} as { useTodaysFocus: typeof useTodaysFocus } };
  new Function("require", "module", "exports", "fetch", compiled)((name: string) => {
    if (!(name in imports)) throw new Error(`Unmocked boundary: ${name}`);
    return imports[name];
  }, module, module.exports, fetch);
  const render = () => {
    let output!: ReturnType<typeof useTodaysFocus>;
    for (let index = 0; index < 20; index++) {
      cursor = 0; dirty = false; effects = [];
      output = module.exports.useTodaysFocus(child, signals);
      effects.forEach(run => run());
      if (!dirty) return output;
    }
    throw new Error("Unbounded hook rerenders");
  };
  return {
    render, reads, fetches, fetch, setDoc, auth, language,
    setChild: (id: string) => { child = { ...child, id }; },
    setSignals: (next: FocusSignals) => { signals = next; },
    unmount: () => { slots.forEach(slot => slot?.cleanup?.()); disposed = true; },
  };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(`${DAY}T12:00:00Z`)); });
afterEach(() => { vi.useRealTimers(); });

describe("Today's Focus asynchronous scope and cache ownership", () => {
  it("waits for a valid cache before deciding to generate, including a fresh home mount", async () => {
    const first = harness();
    expect(first.render()).toMatchObject({ focus: null, loading: true, error: false });
    await tick();
    expect(first.fetch).not.toHaveBeenCalled();
    first.reads[0].pending.resolve(snapshot(validFocus("Keep the idea already chosen for today.")));
    await tick();
    expect(first.render().focus?.text).toBe("Keep the idea already chosen for today.");
    await tick();
    expect(first.fetch).not.toHaveBeenCalled();
    first.unmount();
    const second = harness();
    second.render(); second.reads[0].pending.resolve(snapshot(validFocus("Keep the idea already chosen for today.")));
    await tick(); second.render(); await tick();
    expect(second.fetch).not.toHaveBeenCalled();
  });
  it("generates once after an empty cache, and concurrent manual retries cannot double-submit", async () => {
    const view = harness(); view.render();
    view.reads[0].pending.resolve(snapshot(null)); await tick();
    const output = view.render(); await tick();
    expect(view.fetch).toHaveBeenCalledTimes(1);
    void output.regenerate(); void output.regenerate(); await tick();
    expect(view.fetch).toHaveBeenCalledTimes(1);
    view.fetches[0].pending.resolve({ ok: true, json: async () => ({ text: "Try one quiet page.", tryToday: "Try one quiet page." }) });
    await tick();
    expect(view.render()).toMatchObject({ focus: { text: "Try one quiet page." }, loading: false, error: false });
  });
  it("drops old-child results without overwriting the new child's cache or in-flight state", async () => {
    const view = harness(); view.render(); view.reads[0].pending.resolve(snapshot(null)); await tick(); view.render(); await tick();
    view.setChild("child-b"); expect(view.render()).toMatchObject({ focus: null, loading: true, error: false });
    view.reads[1].pending.resolve(snapshot(null)); await tick(); view.render(); await tick();
    expect(view.fetches.map(item => item.body.childProfile.id)).toEqual(["child-a", "child-b"]);
    view.fetches[0].pending.resolve({ ok: true, json: async () => ({ text: "Old child response" }) }); await tick();
    expect(view.render()).toMatchObject({ focus: null, loading: true, error: false });
    expect(view.setDoc).not.toHaveBeenCalled();
    view.fetches[1].pending.resolve({ ok: true, json: async () => ({ text: "New child response" }) }); await tick();
    expect(view.render()).toMatchObject({ focus: { text: "New child response" }, loading: false });
  });
  it("ignores an old failure after a language/account change and keeps the new cache visible", async () => {
    const view = harness(); view.render(); view.reads[0].pending.resolve(snapshot(null)); await tick(); view.render(); await tick();
    view.language.uiLang = "he"; view.auth.user.uid = "parent-b";
    expect(view.render()).toMatchObject({ focus: null, loading: true, error: false });
    expect(view.reads[1].path).toContain("users/parent-b/");
    view.reads[1].pending.resolve(snapshot(validFocus("רגע קטן ביחד", "he"))); await tick();
    expect(view.render().focus?.text).toBe("רגע קטן ביחד");
    view.fetches[0].pending.reject(new Error("Old network failure")); await tick();
    expect(view.render()).toMatchObject({ focus: { text: "רגע קטן ביחד" }, loading: false, error: false });
  });
  it("A→B→A waits for the new A cache and never revives the first A request", async () => {
    const view = harness(); view.render(); view.reads[0].pending.resolve(snapshot(null)); await tick(); view.render(); await tick();
    view.setChild("child-b"); view.render();
    view.setChild("child-a"); expect(view.render().loading).toBe(true);
    view.fetches[0].pending.resolve({ ok: true, json: async () => ({ text: "Stale first A" }) }); await tick();
    expect(view.render().focus).toBeNull();
    view.reads[2].pending.resolve(snapshot(validFocus("Current A cache"))); await tick();
    expect(view.render().focus?.text).toBe("Current A cache");
    expect(view.fetch).toHaveBeenCalledTimes(1);
  });
  it("a failed cache read can generate; unmounting prevents late state updates and cache writes", async () => {
    const view = harness(); view.render(); view.reads[0].pending.reject(new Error("Cache unavailable")); await tick(); view.render(); await tick();
    expect(view.fetch).toHaveBeenCalledTimes(1);
    view.unmount();
    view.fetches[0].pending.resolve({ ok: true, json: async () => ({ text: "Too late" }) }); await tick();
    expect(view.setDoc).not.toHaveBeenCalled();
  });
});
