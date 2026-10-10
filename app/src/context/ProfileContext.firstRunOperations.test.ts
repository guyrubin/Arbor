import { describe, expect, it, vi } from "vitest";
import { FirstRunController, firstRunCard } from "../lib/onboardingFirstRun";
import { readFileSync } from "node:fs";
import ts from "typescript";
import type { ChildProfile } from "../types";
import { CLEARABLE_PROFILE_FIELDS, RETIRED_PROFILE_FIELDS } from "../lib/childAge";

const child = (id: string, name = id): ChildProfile => ({ id, name, age: 4, birthMonth: "2022-04", languages: ["English"], schoolContext: "", strengths: [], challenges: [], onboardingComplete: false });
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
    published: (_rows: ChildProfile[]) => {},
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
        if (!Object.is(updated, slots[i].value)) { slots[i].value = updated; dirty = true; if (i === 0) transport.published(updated); }
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

// Independent probes combine the real controller with the real provider's
// owner/selection lifetime semantics. SDK, token, network and storage are fake.
// Service wiring matches OnboardingFlow, including its captured selection lease.
function mountController(h: ReturnType<typeof harness>, accept = async () => {}) {
  let mounted = true;
  const captured = h.value;
  const complete = vi.fn(() => {});
  const controller = new FirstRunController(captured.profiles.find(p => p.onboardingComplete === false), {
    sessionKey: {}, captureLifetime: captured.captureOnboardingLifetime, isCurrent: () => mounted && captured.isCurrentSession(),
    addChild: captured.addChild, updateChild: captured.updateChild, accept,
    lang: () => "en", now: () => new Date("2026-10-09T12:00:00Z"), onComplete: complete,
  });
  return { controller, complete, close: () => { mounted = false; } };
}
function fillAbout(c: FirstRunController) { c.edit({ name: "Noa", birthMonth: "2022-04", languages: ["English"], consent: true }); }
const provisionedIds = (h: ReturnType<typeof harness>) => h.calls.fetch.map(call => JSON.parse(String(call.opts.body)).childId);

describe("independent exact-source first-run lifetime proof", () => {
  it("closing first-run before its first create acknowledges retires unissued provisioning and local append", async () => {
    const h = harness({ rows: [] }); h.effects(); await h.flush();
    const pending = deferred(); h.transport.set = () => pending.promise;
    const first = mountController(h); fillAbout(first.controller);
    const creating = first.controller.next(); expect(h.calls.sets).toHaveLength(1);
    first.close(); pending.resolve(); await creating; await h.flush();
    // The issued setDoc may finish. The later ownership POST and append are new work.
    expect({ provisioned: provisionedIds(h), localProfiles: h.value.profiles.map(p => p.id) })
      .toEqual({ provisioned: [], localProfiles: [] });
  });
  it("rapid close/reopen during the first create must not issue another child document", async () => {
    const h = harness({ rows: [] }); h.effects(); await h.flush();
    const firstAck = deferred(), secondAck = deferred(); let writes = 0;
    h.transport.set = () => ++writes === 1 ? firstAck.promise : secondAck.promise;
    const clock = vi.spyOn(Date, "now").mockReturnValue(1791547200000);
    try {
      const first = mountController(h); fillAbout(first.controller); const a = first.controller.next();
      first.close(); expect(h.value.profiles).toEqual([]);
      clock.mockReturnValue(1791547200001);
      const second = mountController(h); fillAbout(second.controller); const b = second.controller.next();
      const newlyIssuedPaths = [...h.calls.sets];
      firstAck.resolve(); secondAck.resolve(); await Promise.all([a, b]); await h.flush();
      expect(newlyIssuedPaths).toHaveLength(1);
    } finally { clock.mockRestore(); }
  });
  it("child A→B→A while action acceptance is pending retires unissued profile completion", async () => {
    const a = { ...child("child-a"), onboardingDraft: { step: 3 as const, choice: "nothing" as const, words: "", quote: "", hardMomentId: "" } };
    const h = harness({ rows: [a, { ...child("child-b"), onboardingComplete: true }] }); h.effects(); await h.flush();
    const accepted = deferred(); let acceptanceStarted = false;
    const flow = mountController(h, async () => { acceptanceStarted = true; await accepted.promise; });
    const saving = flow.controller.finish(firstRunCard(flow.controller.snapshot(), "en", new Date("2026-10-09T12:00:00Z")));
    await h.flush(); expect(acceptanceStarted).toBe(true);
    const checkpointWrites = h.calls.updates.length;
    h.value.setActiveChild("child-b"); h.value.setActiveChild("child-a"); await h.flush();
    accepted.resolve(); await saving; await h.flush();
    expect({ updates: h.calls.updates.length, complete: h.value.profiles.find(p => p.id === "child-a")?.onboardingComplete,
      navigation: flow.complete.mock.calls.length }).toEqual({ updates: checkpointWrites, complete: false, navigation: 0 });
  });
  it("a confirmed retired create is adopted on reopen with one identity and one provision", async () => {
    const h = harness({ rows: [] }); h.effects(); await h.flush();
    const pending = deferred(); h.transport.set = () => pending.promise;
    const first = mountController(h); fillAbout(first.controller); const creating = first.controller.next();
    first.close(); pending.resolve(); await creating; await h.flush();
    expect(h.value.profiles).toEqual([]); expect(provisionedIds(h)).toEqual([]);
    const second = mountController(h); fillAbout(second.controller); await second.controller.next(); await h.flush();
    expect(h.calls.sets).toHaveLength(1); expect(h.value.profiles).toHaveLength(1);
    expect(second.controller.snapshot()).toMatchObject({ step: 2, childId: h.value.profiles[0].id });
    expect(provisionedIds(h)).toEqual([h.value.profiles[0].id]);
  });
  it("a rejected initial write retries the same reserved child identity", async () => {
    const h = harness({ rows: [] }); h.effects(); await h.flush();
    h.transport.set = async () => { throw Error("rules"); };
    const first = mountController(h); fillAbout(first.controller); await first.controller.next(); first.close();
    h.transport.set = async () => {};
    const second = mountController(h); fillAbout(second.controller); await second.controller.next(); await h.flush();
    expect(h.calls.sets).toHaveLength(2); expect(new Set(h.calls.sets).size).toBe(1);
    expect(second.controller.snapshot().step).toBe(2); expect(h.value.profiles).toHaveLength(1);
  });
  it("own successful first-child selection does not retire the live create", async () => {
    const h = harness({ rows: [] }); h.effects(); await h.flush();
    const flow = mountController(h); fillAbout(flow.controller); await flow.controller.next(); await h.flush();
    expect(flow.controller.snapshot()).toMatchObject({ step: 2, complete: false, error: false });
    expect(h.value.activeChild.id).toBe(flow.controller.snapshot().childId); expect(h.value.profiles).toHaveLength(1);
  });
  it("acknowledged completion navigates exactly once before the completed profile makes ProfileGate close", async () => {
    const a = { ...child("child-a"), onboardingDraft: { step: 3 as const, choice: "nothing" as const, words: "", quote: "", hardMomentId: "" } };
    const h = harness({ rows: [a] }); h.effects(); await h.flush();
    const flow = mountController(h), order: string[] = [];
    flow.complete.mockImplementation(() => { order.push("Now"); });
    h.transport.published = profiles => { if (profiles.some(p => p.onboardingComplete)) { order.push("ProfileGate closes"); flow.close(); } };
    await flow.controller.finish(firstRunCard(flow.controller.snapshot(), "en", new Date("2026-10-09T12:00:00Z"))); await h.flush();
    expect(order).toEqual(["Now", "ProfileGate closes"]); expect(flow.complete).toHaveBeenCalledOnce();
    expect(h.value.profiles[0].onboardingComplete).toBe(true);
  });
  it.each(["owner", "selection", "close"] as const)("%s retirement during the final acknowledgement cannot navigate or publish completion", async boundary => {
    const a = { ...child("child-a"), onboardingDraft: { step: 3 as const, choice: "nothing" as const, words: "", quote: "", hardMomentId: "" } };
    const h = harness({ rows: [a, { ...child("child-b"), onboardingComplete: true }] }); h.effects(); await h.flush();
    const pending = deferred(), flow = mountController(h);
    h.transport.update = async (_path, patch: any) => { if (patch.onboardingComplete) await pending.promise; };
    const saving = flow.controller.finish(firstRunCard(flow.controller.snapshot(), "en", new Date("2026-10-09T12:00:00Z"))); await h.flush();
    expect(h.calls.updates).toHaveLength(2);
    if (boundary === "owner") { const original = h.actualUser; h.setActualUser({ uid: "B" }); h.setActualUser(original); }
    else if (boundary === "selection") { h.value.setActiveChild("child-b"); h.value.setActiveChild("child-a"); }
    else flow.close();
    pending.resolve(); await saving; await h.flush();
    expect(flow.complete).not.toHaveBeenCalled(); expect(h.value.profiles.find(p => p.id === "child-a")?.onboardingComplete).toBe(false);
  });

  it("a new A session adopts the retained create without reviving the old A caller", async () => {
    const h = harness({ rows: [] }); h.effects(); await h.flush();
    const pending = deferred(); h.transport.set = () => pending.promise;
    const first = mountController(h); fillAbout(first.controller); const a = first.controller.next(); first.close();
    h.setOwner("B"); await h.flush(); h.setOwner("A"); await h.flush();
    const second = mountController(h); fillAbout(second.controller); const b = second.controller.next();
    pending.resolve(); await Promise.all([a, b]); await h.flush();
    expect(h.calls.sets).toHaveLength(1); expect(h.value.profiles).toHaveLength(1);
    expect(first.controller.snapshot().childId).toBeNull(); expect(second.controller.snapshot().step).toBe(2);
    expect(provisionedIds(h)).toEqual([h.value.profiles[0].id]);
  });
  it("a reopened form corrects the reserved document instead of creating a second child", async () => {
    const h = harness({ rows: [] }); h.effects(); await h.flush();
    const pending = deferred(); let calls = 0; h.transport.set = () => ++calls === 1 ? pending.promise : Promise.resolve();
    const first = mountController(h); fillAbout(first.controller); const a = first.controller.next(); first.close();
    const second = mountController(h); fillAbout(second.controller); second.controller.edit({ name: "Noam" }); const b = second.controller.next();
    expect(h.calls.sets).toHaveLength(1); pending.resolve(); await Promise.all([a, b]); await h.flush();
    expect(new Set(h.calls.sets).size).toBe(1); expect(h.value.profiles).toHaveLength(1); expect(h.value.profiles[0].name).toBe("Noam");
  });

  it("already-admitted provider ownership can settle after close without stranding the installed child", async () => {
    const h = harness({ rows: [] }); h.effects(); await h.flush();
    const token = deferred<{ Authorization: string }>(); h.transport.headers = () => token.promise;
    const first = mountController(h); fillAbout(first.controller); await first.controller.next(); await h.flush();
    expect(h.value.profiles).toHaveLength(1); expect(h.calls.headers).toHaveLength(1); first.close();
    const second = mountController(h); expect(second.controller.snapshot().childId).toBe(h.value.profiles[0].id);
    token.resolve({ Authorization: "synthetic-A" }); await h.flush();
    expect(provisionedIds(h)).toEqual([h.value.profiles[0].id]); expect(h.calls.sets).toHaveLength(1);
  });

});
