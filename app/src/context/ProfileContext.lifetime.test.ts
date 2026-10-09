import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import type { ChildProfile } from "../types";
import { CLEARABLE_PROFILE_FIELDS, RETIRED_PROFILE_FIELDS } from "../lib/childAge";

const child = (id: string, name = id): ChildProfile => ({ id, name, age: 4, languages: ["English"], schoolContext: "", strengths: [], challenges: [], onboardingComplete: false });
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
type Provider = ReturnType<typeof import("./ProfileContext").useProfile>;
type HookSlot = { value?: any; deps?: unknown[]; cleanup?: () => void };

/** Runs the actual provider, retaining hook state and cleaning up effects on
 * owner changes. Every SDK, storage, token and fetch boundary is synthetic. */
function harness({ owner = "A", rows = [child("A-child")], local = [child("local-private")] } = {}) {
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
const provisionedIds = (h: ReturnType<typeof harness>) => h.calls.fetch.map(call => JSON.parse(String(call.opts.body)).childId);

describe("profile lifetime boundaries", () => {
  it("signed-in read failure never imports unowned cache or starts fake onboarding", async () => {
    const h = harness(); h.transport.read = async () => { throw Error("offline"); }; h.effects(); await h.flush();
    expect(h.value.profiles).toEqual([]); expect(h.calls.localReads).not.toContain("arbor.children");
    expect(h.value.loadError).toBe(true); expect(h.value.needsOnboarding).toBe(false);
  });
  it("late A load neither displays nor provisions after B", async () => {
    const h = harness(), a = deferred<ChildProfile[]>();
    h.transport.read = path => path.includes("/A/") ? a.promise : Promise.resolve([child("B-child")]);
    h.effects(); h.setOwner("B"); await h.flush(); a.resolve([child("A-child")]); await h.flush();
    expect(h.value.profiles.map(p => p.id)).toEqual(["B-child"]); expect(provisionedIds(h)).not.toContain("A-child");
  });
  it("a late token cannot provision A data with B credentials", async () => {
    const h = harness(), a = deferred<{ Authorization: string }>(); h.transport.headers = () => a.promise;
    h.effects(); await h.flush(); h.transport.read = async () => []; h.setOwner("B"); await h.flush();
    a.resolve({ Authorization: "test-B" }); await h.flush(); expect(provisionedIds(h)).not.toContain("A-child");
  });
  it("late create never appends an A child to B state", async () => {
    const h = harness(); h.effects(); await h.flush(); const a = deferred(); h.transport.set = () => a.promise;
    const { id: _id, ...input } = child("ignored"); const creating = h.value.addChild(input).catch(() => undefined);
    h.transport.read = async () => [child("B-child")]; h.setOwner("B"); await h.flush(); a.resolve(); await creating; await h.flush();
    expect(h.value.profiles.map(p => p.id)).toEqual(["B-child"]); expect(provisionedIds(h).filter(id => id.startsWith("child-"))).toEqual([]);
  });
  it("late update cannot mutate B's same-ID child", async () => {
    const h = harness({ rows: [child("same-child", "Owner A")] }); h.effects(); await h.flush();
    const a = deferred(); h.transport.update = () => a.promise; const updating = h.value.updateChild("same-child", { name: "A edit" });
    h.transport.read = async () => [child("same-child", "Owner B")]; h.setOwner("B"); await h.flush(); a.resolve();
    expect(await updating).toBe(false); await h.flush(); expect(h.value.profiles[0].name).toBe("Owner B");
  });
  it("old callbacks cannot begin new writes after an owner change", async () => {
    const h = harness(); h.effects(); await h.flush(); const old = h.value;
    h.setOwner("B"); await h.flush(); const writes = h.calls.updates.length;
    expect(await old.updateChild("A-child", { name: "A edit" })).toBe(false); expect(h.calls.updates).toHaveLength(writes);
    const { id: _id, ...input } = child("ignored"); await expect(old.addChild(input)).rejects.toThrow("session changed"); expect(h.calls.sets).toHaveLength(0);
  });
  it("same-account explicit retry recovers without local data", async () => {
    const h = harness(); h.transport.read = async () => { throw Error("offline"); }; h.effects(); await h.flush();
    h.transport.read = async () => [child("A-child", "Recovered")]; h.value.retryProfiles(); await h.flush();
    expect(h.value.loadError).toBe(false); expect(h.value.loading).toBe(false); expect(h.value.profiles[0].name).toBe("Recovered");
    expect(h.calls.localReads).not.toContain("arbor.children");
  });
  it("returning to A retries cancelled ownership without a retained in-flight marker", async () => {
    const h = harness(), token = deferred<{ Authorization: string }>(); h.transport.headers = () => token.promise;
    h.effects(); await h.flush(); h.transport.read = async path => path.includes("/A/") ? [child("A-child")] : [];
    h.setOwner("B"); await h.flush(); token.resolve({ Authorization: "old-A" }); await h.flush();
    h.transport.headers = async () => ({ Authorization: "new-A" }); h.setOwner("A"); await h.flush();
    expect(provisionedIds(h)).toEqual(["A-child"]);
  });
  it("stale A cleanup cannot delete a newer pending A attempt", async () => {
    const h = harness(), oldToken = deferred<{ Authorization: string }>(), newToken = deferred<{ Authorization: string }>();
    h.transport.headers = () => oldToken.promise; h.effects(); await h.flush();
    h.transport.read = async path => path.includes("/A/") ? [child("A-child")] : []; h.setOwner("B"); await h.flush();
    h.transport.headers = () => newToken.promise; h.setOwner("A"); await h.flush();
    oldToken.resolve({ Authorization: "old-A" }); await h.flush(); h.value.retryProfiles(); await h.flush();
    expect(h.calls.headers).toHaveLength(2); newToken.resolve({ Authorization: "new-A" }); await h.flush();
    expect(provisionedIds(h)).toEqual(["A-child"]);
  });
  it("sandbox keeps its own local family and never overwrites it with remote profiles", async () => {
    const h = harness(); h.effects(); await h.flush(); h.setOwner("local-sandbox"); await h.flush();
    expect(h.value.profiles.map(p => p.id)).toEqual(["local-private"]); expect(h.value.loadError).toBe(false);
    expect(JSON.parse(h.localStore.get("arbor.children")!)[0].id).toBe("local-private");
  });
  it("a raw auth change before React's owner render blocks late load provisioning", async () => {
    const h = harness(), load = deferred<ChildProfile[]>(); h.transport.read = () => load.promise; h.effects();
    h.setActualUser({ uid: "B" }); load.resolve([child("A-child")]); await h.flush();
    expect(provisionedIds(h)).toEqual([]); expect(h.value.loading).toBe(true); expect(h.value.needsOnboarding).toBe(false);
  });
  it("raw auth changes invalidate already-pending token acquisition", async () => {
    const h = harness(), token = deferred<{ Authorization: string }>(); h.transport.headers = () => token.promise;
    h.effects(); await h.flush(); h.setActualUser({ uid: "B" }); token.resolve({ Authorization: "old-A" }); await h.flush();
    expect(provisionedIds(h)).toEqual([]);
  });
  it("raw A→B→original A is latched, while a fresh same-account load can recover", async () => {
    const h = harness(), original = h.actualUser, token = deferred<{ Authorization: string }>(); h.transport.headers = () => token.promise;
    h.effects(); await h.flush(); h.setActualUser({ uid: "B" }); h.setActualUser(original);
    // Prevent a new load from itself provisioning until we inspect cancellation.
    const reload = deferred<ChildProfile[]>(); h.transport.read = () => reload.promise;
    token.resolve({ Authorization: "old-A" }); await h.flush(); expect(provisionedIds(h)).toEqual([]);
    h.transport.headers = async () => ({ Authorization: "fresh-A" }); expect(h.value.loadError).toBe(true);
    h.value.retryProfiles(); await h.flush(); reload.resolve([child("A-child")]); await h.flush();
    expect(provisionedIds(h)).toEqual(["A-child"]); expect(h.value.loading).toBe(false);
  });
  it("raw auth invalidation fences late profile writes before React owner changes", async () => {
    const h = harness(); h.effects(); await h.flush(); const pending = deferred(); h.transport.update = () => pending.promise;
    const saving = h.value.updateChild("A-child", { onboardingComplete: true }); h.setActualUser({ uid: "B" }); pending.resolve();
    expect(await saving).toBe(false); await h.flush(); expect(h.value.profiles.some(p => p.onboardingComplete === true)).toBe(false);
  });
  it("a raw auth change blocks a pending create before React catches up", async () => {
    const h = harness(); h.effects(); await h.flush(); const pending = deferred(); h.transport.set = () => pending.promise;
    const { id: _id, ...input } = child("ignored"); const creating = h.value.addChild(input);
    const caught = creating.catch(error => error); h.setActualUser({ uid: "B" }); pending.resolve();
    expect(await caught).toBeInstanceOf(Error); await h.flush();
    expect(h.value.profiles.some(p => p.id.startsWith("child-"))).toBe(false);
    expect(provisionedIds(h).some(id => id.startsWith("child-"))).toBe(false);
  });
  it("successful ownership guards cannot suppress another owner's same-ID child", async () => {
    const h = harness({ rows: [child("same-child", "Owner A")] }); h.effects(); await h.flush();
    h.transport.read = async () => [child("same-child", "Owner B")]; h.setOwner("B"); await h.flush();
    expect(provisionedIds(h)).toEqual(["same-child", "same-child"]);
    expect(h.sessionStore.has("arbor.ownershipProvisioned.remote:A:same-child")).toBe(true);
    expect(h.sessionStore.has("arbor.ownershipProvisioned.remote:B:same-child")).toBe(true);
  });
  it("failed current-owner hero writes keep local edits while reporting failure", async () => {
    const h = harness(); h.effects(); await h.flush();
    h.transport.update = async () => { throw Error("offline"); };
    const patch = { photoUrl: "data:image/png;base64,synthetic", avatar: { style: "comichero", source: "descriptor" as const, createdAt: "2026-10-09T12:00:00.000Z" } };
    expect(await h.value.updateChild("A-child", patch)).toBe(false); await h.flush();
    expect(h.value.profiles[0].photoUrl).toBe(patch.photoUrl);
    expect(h.value.profiles[0].avatar).toEqual(patch.avatar);
    expect(h.calls.updates).toEqual(["users/A/children/A-child"]);
  });
  it("ProfileGate renders retryable load errors before loading or onboarding", () => {
    const source = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    const gate = source.slice(source.indexOf("function ProfileGate"), source.indexOf("function BillingReturnWatcher"));
    expect(gate).toContain("onClick={retryProfiles}"); expect(gate.indexOf("if (loadError)")).toBeLessThan(gate.indexOf("if (loading)"));
    expect(gate.indexOf("if (loadError)")).toBeGreaterThan(-1);
  });
});
