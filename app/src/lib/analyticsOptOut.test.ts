/**
 * B-DATA-05 — the analytics opt-out is honoured at the one choke point.
 *
 * An opted-out account writes 0 events (lib/analytics track()) and 0 rollup
 * updates (lib/retentionRollup upsertRetentionRollup → "skipped"), including
 * events fired before the sign-in hydration on a fresh browser; the default
 * (ANALYTICS_OPT_OUT_DEFAULT = false) is today's behaviour; and the kid-mode
 * egress gate still strips attribution with the opt-out off.
 *
 * Node harness: Firestore is faked so every written event document is
 * counted; localStorage is stubbed with an in-memory Storage where a test
 * needs a browser (the "fresh browser" cases). Each test gets fresh module
 * state (vi.resetModules) — the preference and the buffer are singletons.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sink = vi.hoisted(() => ({ written: [] as { path: string; doc: Record<string, unknown> }[] }));
vi.mock("firebase/firestore", () => ({
  addDoc: (ref: { path: string }, d: Record<string, unknown>) => {
    sink.written.push({ path: ref.path, doc: d });
    return Promise.resolve();
  },
  collection: (_db: unknown, p: string) => ({ path: p }),
  serverTimestamp: () => "SERVER_TS",
  doc: () => ({}),
  getDoc: () => Promise.reject(new Error("the guard passes a fake store")),
  setDoc: () => Promise.reject(new Error("the guard passes a fake store")),
}));
vi.mock("./firebase", () => ({ firebaseEnabled: true, db: {} }));

type OptOutModule = typeof import("./analyticsOptOut");
type AnalyticsModule = typeof import("./analytics");
type RollupModule = typeof import("./retentionRollup");
type KidGateModule = typeof import("./kidModeGate");

let optOut: OptOutModule;
let analytics: AnalyticsModule;
let rollup: RollupModule;
let kidGate: KidGateModule;

const UID = "parent-uid";
const ATTRIBUTION = { source: "newsletter", market: "il", utm_source: "meta", referral_code: "REF123" };

/** In-memory Web Storage: a browser that can hold a record. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
  };
}

/** Fake per-account store (users/{uid}.analyticsOptOut). */
function accountStore(initial: Record<string, boolean | null> = {}) {
  const docs = new Map<string, boolean | null>(Object.entries(initial));
  const calls = { reads: 0, writes: [] as [string, boolean][] };
  return {
    calls,
    store: {
      async read(uid: string) { calls.reads += 1; return docs.has(uid) ? docs.get(uid)! : null; },
      async write(uid: string, value: boolean) { calls.writes.push([uid, value]); docs.set(uid, value); },
    },
  };
}

/** Fake rollup store: counts every read and write. */
function rollupStore() {
  const state = { reads: 0, writes: 0 };
  return {
    state,
    store: {
      async read() { state.reads += 1; return null; },
      async write() { state.writes += 1; },
    },
  };
}

const ctx = (uid = UID) => ({ uid, at: "2026-10-06T08:00:00.000Z", tzOffsetMinutes: 120, source: null, market: null });

beforeEach(async () => {
  sink.written.length = 0;
  vi.resetModules();
  optOut = await import("./analyticsOptOut");
  analytics = await import("./analytics");
  rollup = await import("./retentionRollup");
  kidGate = await import("./kidModeGate");
  analytics.setAnalyticsUser(() => UID);
  analytics.setGlobalProps(() => ({ ...ATTRIBUTION }));
});

afterEach(() => {
  kidGate.setKidModeActive(false);
  vi.unstubAllGlobals();
});

describe("the default is ONE constant, and it is today's behaviour (opted in)", () => {
  it("ANALYTICS_OPT_OUT_DEFAULT = false, with the decision owner named at the constant", () => {
    expect(optOut.ANALYTICS_OPT_OUT_DEFAULT).toBe(false);
    const src = readFileSync(path.join(__dirname, "analyticsOptOut.ts"), "utf8");
    const at = src.indexOf("export const ANALYTICS_OPT_OUT_DEFAULT");
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(Math.max(0, at - 300), at)).toContain("Guy G-30 (counsel) decides; today's behaviour");
    expect(src.match(/ANALYTICS_OPT_OUT_DEFAULT\s*=/g)).toHaveLength(1);
  });

  it("an account that never chose: events reach the sink and the rollup is written, exactly as before", async () => {
    expect(optOut.analyticsOptOutState(UID)).toBe("unknown");
    analytics.track("view_tab", { tab: "coach" });
    analytics.track("session_open");
    expect(sink.written).toHaveLength(2);
    expect(sink.written[0].path).toBe(`users/${UID}/events`);
    expect(sink.written[0].doc.props).toEqual({ ...ATTRIBUTION, tab: "coach" });
    const r = rollupStore();
    expect(await rollup.upsertRetentionRollup(r.store, ctx())).toBe("written");
    expect(r.state.writes).toBe(1);
  });

  it("an account hydrated with no stored choice settles to the default (opted in)", async () => {
    const a = accountStore();
    expect(await optOut.hydrateAnalyticsOptOut(UID, a.store)).toBe(false);
    expect(optOut.analyticsOptOutState(UID)).toBe("in");
    analytics.track("view_tab");
    expect(sink.written).toHaveLength(1);
  });
});

describe("an opted-out account writes 0 events and 0 rollup updates", () => {
  it("hydrated from users/{uid}.analyticsOptOut = true: nothing reaches the sink, in parent mode or Kid Mode", async () => {
    const a = accountStore({ [UID]: true });
    expect(await optOut.hydrateAnalyticsOptOut(UID, a.store)).toBe(true);
    analytics.track("view_tab", { tab: "coach" });
    analytics.track("session_open");
    kidGate.setKidModeActive(true);
    analytics.track("practice_event", { kind: "match" });
    analytics.track("kidlock_blocked_nav");
    expect(sink.written).toHaveLength(0);
  });

  it("upsertRetentionRollup is 'skipped' with no read and no write", async () => {
    await optOut.hydrateAnalyticsOptOut(UID, accountStore({ [UID]: true }).store);
    const r = rollupStore();
    expect(await rollup.upsertRetentionRollup(r.store, ctx())).toBe("skipped");
    expect(r.state).toEqual({ reads: 0, writes: 0 });
  });

  it("the Settings choice (setAnalyticsOptOut) applies at once and mirrors to the account doc", async () => {
    const a = accountStore();
    expect(await optOut.setAnalyticsOptOut(UID, true, a.store)).toBe(true);
    expect(a.calls.writes).toEqual([[UID, true]]);
    expect(optOut.isAnalyticsOptedOut(UID)).toBe(true);
    analytics.track("view_tab");
    const r = rollupStore();
    expect(await rollup.upsertRetentionRollup(r.store, ctx())).toBe("skipped");
    expect(sink.written).toHaveLength(0);
    expect(r.state.writes).toBe(0);
    // …and turning it back on restores today's behaviour.
    await optOut.setAnalyticsOptOut(UID, false, a.store);
    analytics.track("view_tab");
    expect(sink.written).toHaveLength(1);
  });

  it("a failed account mirror still holds the choice on this browser (and says so)", async () => {
    const failing = { read: async () => null, write: async () => { throw new Error("offline"); } };
    expect(await optOut.setAnalyticsOptOut(UID, true, failing)).toBe(false);
    analytics.track("view_tab");
    expect(sink.written).toHaveLength(0);
  });

  it("a choice made while the sign-in read is in flight wins over the stale read", async () => {
    let release: (v: boolean | null) => void = () => {};
    const slow = { read: () => new Promise<boolean | null>((r) => { release = r; }), write: async () => {} };
    const hydrating = optOut.hydrateAnalyticsOptOut(UID, slow);
    await optOut.setAnalyticsOptOut(UID, true, slow);
    release(false);
    expect(await hydrating).toBe(true);
    expect(optOut.isAnalyticsOptedOut(UID)).toBe(true);
  });
});

describe("fresh browser: events fired BEFORE hydration are held, then flushed or dropped", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });

  it("opted-out account: the held events are dropped — 0 reach the sink", async () => {
    analytics.track("session_open");
    analytics.track("view_tab", { tab: "today" });
    kidGate.setKidModeActive(true);
    analytics.track("practice_event", { kind: "match" });
    kidGate.setKidModeActive(false);
    expect(sink.written).toHaveLength(0);
    // 3 fired here + kid_session_end, which closing Kid Mode tracks itself.
    expect(analytics.pendingAnalyticsEventCount()).toBe(4);
    await optOut.hydrateAnalyticsOptOut(UID, accountStore({ [UID]: true }).store);
    expect(analytics.pendingAnalyticsEventCount()).toBe(0);
    analytics.track("view_tab");
    expect(sink.written).toHaveLength(0);
    // The synchronous read now answers on this browser.
    expect(localStorage.getItem(optOut.ANALYTICS_OPT_OUT_STORAGE_KEY)).toBe(JSON.stringify({ uid: UID, optOut: true }));
  });

  it("opted-in account: the held events are written once hydrated, with the props they had when fired", async () => {
    analytics.track("session_open");
    kidGate.setKidModeActive(true);
    analytics.track("practice_event", { kind: "match", utm_source: "smuggled" });
    kidGate.setKidModeActive(false);
    expect(sink.written).toHaveLength(0);
    const held = analytics.pendingAnalyticsEventCount();
    await optOut.hydrateAnalyticsOptOut(UID, accountStore({ [UID]: false }).store);
    expect(analytics.pendingAnalyticsEventCount()).toBe(0);
    expect(sink.written).toHaveLength(held);
    // closing Kid Mode tracks kid_session_end itself; it is held and flushed too.
    expect(sink.written.map((w) => w.doc.event)).toEqual(["session_open", "practice_event", "kid_session_end"]);
    expect(sink.written[0].doc.props).toEqual(ATTRIBUTION);
    // The kid event was gated at FIRE time: no attribution picked up at flush.
    expect(sink.written[1].doc.props).toEqual({ kind: "match", [analytics.KID_MODE_PROP]: true });
  });

  it("the buffer holds at most PRE_HYDRATION_EVENT_CAP (20) events — the first ones", async () => {
    expect(analytics.PRE_HYDRATION_EVENT_CAP).toBe(20);
    for (let i = 0; i < 25; i += 1) analytics.track("view_tab", { i });
    expect(analytics.pendingAnalyticsEventCount()).toBe(20);
    await optOut.hydrateAnalyticsOptOut(UID, accountStore().store);
    expect(sink.written).toHaveLength(20);
    expect(sink.written[19].doc.props).toMatchObject({ i: 19 });
  });

  it("one account's stored choice never answers for another account on the same browser", async () => {
    await optOut.setAnalyticsOptOut("other-uid", false, accountStore().store);
    expect(optOut.analyticsOptOutState(UID)).toBe("unknown");
    analytics.track("view_tab");
    expect(sink.written).toHaveLength(0); // held: this account is not known yet
    await optOut.hydrateAnalyticsOptOut(UID, accountStore({ [UID]: true }).store);
    expect(sink.written).toHaveLength(0);
  });

  it("a returning browser that already holds the account's choice reads it synchronously (no hold)", async () => {
    localStorage.setItem(optOut.ANALYTICS_OPT_OUT_STORAGE_KEY, JSON.stringify({ uid: UID, optOut: false }));
    analytics.track("view_tab");
    expect(sink.written).toHaveLength(1);
    localStorage.setItem(optOut.ANALYTICS_OPT_OUT_STORAGE_KEY, JSON.stringify({ uid: UID, optOut: true }));
    analytics.track("view_tab");
    expect(sink.written).toHaveLength(1);
  });
});

describe("the kid-mode egress gate is unchanged with the opt-out off", () => {
  it("a kid event carries no attribution and is tagged kid_mode, and still fires", async () => {
    await optOut.hydrateAnalyticsOptOut(UID, accountStore({ [UID]: false }).store);
    kidGate.setKidModeActive(true);
    analytics.track("kidlock_blocked_nav", { referral_code: "REF123", kind: "nav" });
    expect(sink.written).toHaveLength(1);
    expect(sink.written[0].doc.props).toEqual({ kind: "nav", [analytics.KID_MODE_PROP]: true });
  });
});

describe("source pins: the check is FIRST at each choke point", () => {
  const read = (f: string) => readFileSync(path.join(__dirname, f), "utf8");

  it("track(): the opt-out check precedes the kid-mode gate and the globals", () => {
    const src = read("analytics.ts");
    const fnStart = src.indexOf("export function track(");
    const optOutAt = src.indexOf("if (isAnalyticsOptedOut(uid)) return;", fnStart);
    expect(fnStart).toBeGreaterThan(-1);
    expect(optOutAt).toBeGreaterThan(fnStart);
    expect(optOutAt).toBeLessThan(src.indexOf("if (isKidModeActive())", fnStart));
    expect(optOutAt).toBeLessThan(src.indexOf("globalPropsProvider()", fnStart));
  });

  it("upsertRetentionRollup: the opt-out check precedes the store read", () => {
    const src = read("retentionRollup.ts");
    const fnStart = src.indexOf("export async function upsertRetentionRollup(");
    const optOutAt = src.indexOf("if (isAnalyticsOptedOut(ctx.uid)) return \"skipped\";", fnStart);
    expect(optOutAt).toBeGreaterThan(fnStart);
    expect(optOutAt).toBeLessThan(src.indexOf("store.read(", fnStart));
  });

  it("recordRetentionSession hydrates the account's choice before the once-per-session gate and the write", () => {
    const src = read("retentionRollup.ts");
    const fnStart = src.indexOf("export function recordRetentionSession(");
    const hydrateAt = src.indexOf("hydrateAnalyticsOptOut(uid)", fnStart);
    expect(hydrateAt).toBeGreaterThan(fnStart);
    expect(hydrateAt).toBeLessThan(src.indexOf("sessionStorage.getItem", fnStart));
    expect(hydrateAt).toBeLessThan(src.indexOf("upsertRetentionRollup(firestoreRollupStore()", fnStart));
    expect(src.slice(fnStart)).toContain("if (out !== false) return;");
  });
});
