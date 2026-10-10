// Synthetic SDK/auth/storage boundaries around the actual ProfileProvider source.
import { readFileSync } from "node:fs";
import ts from "typescript";
import type { ChildProfile } from "../types";
import * as goalsModule from "../practice/goalBuilder";
import { CLEARABLE_PROFILE_FIELDS, RETIRED_PROFILE_FIELDS } from "../lib/childAge";

const child = (id: string, name = id): ChildProfile => ({ id, name, age: 4, languages: ["English"], schoolContext: "", strengths: [], challenges: [], onboardingComplete: false });
type Provider = ReturnType<typeof import("./ProfileContext").useProfile>;
type HookSlot = { value?: any; deps?: unknown[]; cleanup?: () => void };

/** Runs the actual provider, retaining hook state and cleaning up effects on
 * owner changes. Every SDK, storage, token and fetch boundary is synthetic. */
export function harness({ owner = "A", rows = [child("A-child")], local = [child("local-private")] } = {}) {
  let uid = owner, cursor = 0, dirty = true, value: Provider;
  let actualUser: { uid: string } | null = { uid: owner };
  const authListeners = new Set<(user: typeof actualUser) => void>();
  const auth = { get currentUser() { return actualUser; } };
  const setActualUser = (user: typeof actualUser) => { actualUser = user; for (const listener of authListeners) listener(user); };
  const slots: HookSlot[] = [], queue: (() => void)[] = [];
  const localStore = new Map([["arbor.children", JSON.stringify(local)]]), sessionStore = new Map<string, string>();
  const storage = (store: Map<string, string>) => ({ getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, data: string) => store.set(key, String(data)), removeItem: (key: string) => store.delete(key) });
  const calls = { reads: [] as string[], sets: [] as string[], updates: [] as string[], headers: [] as string[], fetch: [] as { url: string; opts: RequestInit }[], localReads: [] as string[] };
  const transport = {
    read: async (_path: string) => rows,
    set: async (_path: string, _data: unknown) => {},
    update: async (_path: string, _data: unknown) => {},
    headers: async () => ({ Authorization: `test-${actualUser?.uid}` }),
  };
  const changed = (a?: unknown[], b?: unknown[]) => !a || !b || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]));
  const react = {
    createContext: () => ({ Provider: "Provider" }), useContext: () => null,
    useState: (initial: any) => {
      const i = cursor++;
      if (!slots[i]) slots[i] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[i].value, (next: any) => {
        const updated = typeof next === "function" ? next(slots[i].value) : next;
        if (!Object.is(updated, slots[i].value)) { slots[i].value = updated; dirty = true; }
      }];
    },
    useRef: (initial: unknown) => { const i = cursor++; if (!slots[i]) slots[i] = { value: { current: initial } }; return slots[i].value; },
    useCallback: (fn: unknown, deps: unknown[]) => { const i = cursor++; if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { value: fn, deps }; return slots[i].value; },
    useEffect: (fn: () => void | (() => void), deps: unknown[]) => {
      const i = cursor++;
      if (!slots[i] || changed(slots[i].deps, deps)) {
        const cleanup = slots[i]?.cleanup;
        slots[i] = { deps, cleanup };
        queue.push(() => { cleanup?.(); slots[i].cleanup = fn() || undefined; });
      }
    },
    createElement: (_type: unknown, props: { value: Provider }) => props.value,
  };
  const imports: Record<string, unknown> = {
    react: { __esModule: true, default: react, ...react },
    "firebase/firestore": {
      collection: (_db: unknown, path: string) => path, doc: (_db: unknown, ...parts: string[]) => parts.join("/"), deleteField: () => Symbol.for("delete"),
      getDocs: async (path: string) => { calls.reads.push(path); return { docs: (await transport.read(path)).map(c => ({ id: c.id, data: () => c })) }; },
      setDoc: async (path: string, data: unknown) => { calls.sets.push(path); await transport.set(path, data); },
      updateDoc: async (path: string, data: unknown) => { calls.updates.push(path); await transport.update(path, data); },
    },
    "firebase/auth": { onAuthStateChanged: (_auth: unknown, fn: (user: typeof actualUser) => void) => { authListeners.add(fn); fn(actualUser); return () => authListeners.delete(fn); } },
    "../lib/firebase": { db: {}, auth, firebaseEnabled: true }, "./AuthContext": { useAuth: () => ({ user: uid ? { uid } : null, firebaseEnabled: true }) },
    "../initialData": { defaultChildProfile: child("demo") }, "../lib/childData": { eraseEverything: async () => null }, "../lib/childLocalState": { clearChildLocalState: () => {} },
    "../lib/api": { authHeaders: async () => { calls.headers.push(uid); return transport.headers(); } },
    "../lib/loopEvents": { trackProfileCreated: () => {} }, "../lib/screening": { bandForAge: () => ({ id: "preschool" }) },
    "../lib/onboardingGate": { computeNeedsOnboarding: (remote: boolean, loading: boolean, profiles: ChildProfile[]) => remote && !loading && (!profiles.length || profiles.some(p => p.onboardingComplete === false)) },
    "../lib/childAge": { CLEARABLE_PROFILE_FIELDS, RETIRED_PROFILE_FIELDS },
    "../practice/goalBuilder": goalsModule,
  };
  const code = ts.transpileModule(readFileSync(new URL("./ProfileContext.tsx", import.meta.url), "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} as { ProfileProvider: (props: { children: null }) => Provider } };
  new Function("require", "module", "exports", "localStorage", "sessionStorage", "fetch", code)(
    (name: string) => { if (!(name in imports)) throw Error("Unmocked boundary: " + name); return imports[name]; }, module, module.exports,
    { ...storage(localStore), getItem: (key: string) => { calls.localReads.push(key); return localStore.get(key) ?? null; } }, storage(sessionStore),
    async (url: string, opts: RequestInit) => { calls.fetch.push({ url, opts }); return { ok: true }; },
  );
  const render = () => { cursor = 0; dirty = false; value = module.exports.ProfileProvider({ children: null }); return value; };
  const effects = () => { while (queue.length) queue.shift()!(); };
  const flush = async () => { for (let n = 0; n < 25; n++) { await Promise.resolve(); if (dirty) render(); effects(); } return value; };
  render();
  return { get value() { return value; }, get actualUser() { return actualUser; }, transport, calls, localStore, sessionStore, effects, flush, setActualUser,
    setOwner(next: string) { uid = next; setActualUser(next ? { uid: next } : null); render(); effects(); } };
}
