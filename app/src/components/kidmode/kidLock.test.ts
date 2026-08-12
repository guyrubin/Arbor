/**
 * KID-LOCK (W0.9): kid-mode escape-path seals — unit + source-level tests.
 *
 * Covers the six audited leaks:
 *  LEAK 1 — reload persistence (gate round-trip through arbor.kidmode.active)
 *  LEAK 2 — Android hardware back guard (source-level, native.ts)
 *  LEAK 3 — setActiveTab frozen at the root (source-level, ArborContext.tsx)
 *  LEAK 4 — toast suppression + queue/flush (source-level, ToastContext.tsx)
 *  LEAK 5 — Ctrl/Cmd+K + body-portal modals gated (source-level, Shell.tsx)
 *  LEAK 6 — focus trap (pure unit) + live shield via MutationObserver
 *
 * Node harness (vitest environment: "node") — no DOM, no React rendering.
 * Pure logic is tested directly; React/DOM wiring is asserted at source level
 * (same convention as kidMode.test.ts).
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  KIDMODE_LS_KEY,
  isKidModeActive,
  setKidModeActive,
  subscribeKidMode,
  serializeKidModeState,
  parseKidModeState,
  readKidModeState,
  writeKidModeState,
  type KidModeStorage,
} from "../../lib/kidModeGate";
import { trapTabKey, FOCUSABLE_SELECTOR, type TrapRoot, type TrapKeyEvent, type TrapFocusable } from "./kidModeFocusTrap";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "..");

function readSrc(...rel: string[]): string {
  return readFileSync(path.join(SRC_ROOT, ...rel), "utf8");
}

// The gate is a module singleton — always leave it closed for the next test.
afterEach(() => setKidModeActive(false));

// ── the gate singleton ────────────────────────────────────────────────────────
describe("kidModeGate: subscribable module singleton", () => {
  it("starts closed in a fresh (storage-less) environment", () => {
    expect(isKidModeActive()).toBe(false);
  });

  it("set → read round-trips", () => {
    setKidModeActive(true);
    expect(isKidModeActive()).toBe(true);
    setKidModeActive(false);
    expect(isKidModeActive()).toBe(false);
  });

  it("notifies subscribers with the new value", () => {
    const seen: boolean[] = [];
    const unsub = subscribeKidMode((a) => seen.push(a));
    setKidModeActive(true);
    setKidModeActive(false);
    unsub();
    expect(seen).toEqual([true, false]);
  });

  it("is idempotent — setting the current value notifies no one", () => {
    const seen: boolean[] = [];
    const unsub = subscribeKidMode((a) => seen.push(a));
    setKidModeActive(false); // already false
    setKidModeActive(true);
    setKidModeActive(true); // already true
    unsub();
    expect(seen).toEqual([true]);
  });

  it("unsubscribe stops notifications", () => {
    const seen: boolean[] = [];
    const unsub = subscribeKidMode((a) => seen.push(a));
    unsub();
    setKidModeActive(true);
    expect(seen).toEqual([]);
  });

  it("one throwing listener never blocks the others", () => {
    const seen: boolean[] = [];
    const unsubBad = subscribeKidMode(() => {
      throw new Error("bad listener");
    });
    const unsubGood = subscribeKidMode((a) => seen.push(a));
    expect(() => setKidModeActive(true)).not.toThrow();
    unsubBad();
    unsubGood();
    expect(seen).toEqual([true]);
  });
});

// ── LEAK 1: persistence round-trip ───────────────────────────────────────────
function fakeStorage(initial: Record<string, string> = {}): KidModeStorage & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe("LEAK 1: kid-mode state persists under arbor.kidmode.active", () => {
  it("uses the arbor.* key convention", () => {
    expect(KIDMODE_LS_KEY).toBe("arbor.kidmode.active");
  });

  it("write → read round-trips open state incl. the selected surface", () => {
    const storage = fakeStorage();
    writeKidModeState({ open: true, view: "arcade", worldId: "memory-match" }, storage);
    expect(storage.map.has(KIDMODE_LS_KEY)).toBe(true);
    const back = readKidModeState(storage);
    expect(back).toEqual({ open: true, view: "arcade", worldId: "memory-match" });
  });

  it("closing removes the key entirely (no stale residue)", () => {
    const storage = fakeStorage();
    writeKidModeState({ open: true, view: "home" }, storage);
    writeKidModeState({ open: false }, storage);
    expect(storage.map.has(KIDMODE_LS_KEY)).toBe(false);
    expect(readKidModeState(storage).open).toBe(false);
  });

  it("parse degrades ANY garbage to closed — a corrupt key can never fake an exit or a lock", () => {
    for (const raw of [null, "", "true", "garbage", "{}", '{"open":"yes"}', '{"open":false,"view":"comics"}', "[1,2]", '"open"']) {
      expect(parseKidModeState(raw as string | null).open).toBe(false);
    }
  });

  it("parse accepts the serialized shape and drops non-string view/worldId", () => {
    const s = serializeKidModeState({ open: true, view: "journeys", worldId: null });
    expect(parseKidModeState(s)).toEqual({ open: true, view: "journeys", worldId: null });
    expect(parseKidModeState('{"open":true,"view":7,"worldId":{}}')).toEqual({ open: true, view: undefined, worldId: null });
  });

  it("reads closed when storage is unavailable (node/private-mode)", () => {
    expect(readKidModeState(null).open).toBe(false);
    expect(() => writeKidModeState({ open: true }, null)).not.toThrow();
  });

  it("KidModeContext rehydrates from the gate and is its only writer (source-level)", () => {
    const src = readSrc("components", "kidmode", "KidModeContext.tsx");
    expect(src).toContain("useState<boolean>(isKidModeActive)"); // synchronous rehydrate
    expect(src).toContain("setKidModeActive(true)");
    expect(src).toContain("setKidModeActive(false)");
    expect(src).toContain("writeKidModeState({ open: true");
    expect(src).toContain("writeKidModeState({ open: false })");
    // No other production module writes the gate — KidModeContext is the
    // single writer (the gate module itself only defines the setter).
    const offenders: string[] = [];
    const ALLOWED_WRITERS = [
      path.join(SRC_ROOT, "components", "kidmode", "KidModeContext.tsx"),
      path.join(SRC_ROOT, "lib", "kidModeGate.ts"),
    ];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
          if (ALLOWED_WRITERS.includes(full)) continue;
          const text = readFileSync(full, "utf8");
          if (text.includes("setKidModeActive(")) offenders.push(path.relative(SRC_ROOT, full));
        }
      }
    };
    walk(SRC_ROOT);
    expect(offenders, `unexpected gate writers: ${offenders.join(", ")}`).toEqual([]);
  });

  it("KidModeOverlay restores the persisted surface and skips the enter-flash (source-level)", () => {
    const src = readSrc("components", "kidmode", "KidModeOverlay.tsx");
    expect(src).toContain("readKidModeState()");
    expect(src).toContain("writeKidModeState({ open: true, view, worldId: arcadeWorldId })");
    // No parent-app flash: rehydrated mounts render without an enter animation.
    expect(src).toContain("<AnimatePresence initial={false}>");
  });
});

// ── LEAK 2: Android hardware back (source-level) ─────────────────────────────
describe("LEAK 2: native back button is a no-op while Kid Mode is open", () => {
  const src = readSrc("lib", "native.ts");

  it("native.ts imports the gate", () => {
    expect(src).toContain('import { isKidModeActive } from "./kidModeGate"');
  });

  it("the backButton listener early-returns on the gate BEFORE history.back/exitApp", () => {
    const listenerStart = src.indexOf('addListener("backButton"');
    expect(listenerStart).toBeGreaterThan(-1);
    const guardAt = src.indexOf("if (isKidModeActive()) return;", listenerStart);
    const backAt = src.indexOf("window.history.back()", listenerStart);
    const exitAt = src.indexOf("App.exitApp()", listenerStart);
    expect(guardAt).toBeGreaterThan(-1);
    expect(backAt).toBeGreaterThan(guardAt);
    expect(exitAt).toBeGreaterThan(guardAt);
  });
});

// ── LEAK 3: parent navigation frozen at the root (source-level) ──────────────
describe("LEAK 3: ArborContext.setActiveTab ignores navigation while the gate is active", () => {
  const src = readSrc("context", "ArborContext.tsx");

  it("guards setActiveTab with the gate before any state/hash/track mutation", () => {
    const fnStart = src.indexOf("const setActiveTab = (t: ActiveTab) => {");
    expect(fnStart).toBeGreaterThan(-1);
    const guardAt = src.indexOf("if (isKidModeActive())", fnStart);
    const stateAt = src.indexOf("setActiveTabState(t)", fnStart);
    const hashAt = src.indexOf("window.location.hash = `/${t}`", fnStart);
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(stateAt);
    expect(guardAt).toBeLessThan(hashAt);
  });

  it("logs the blocked navigation via track(kidlock_blocked_nav, {tab})", () => {
    expect(src).toContain('track("kidlock_blocked_nav", { tab: t })');
  });
});

// ── LEAK 4: toast suppression + queue/flush (source-level) ───────────────────
describe("LEAK 4: parent-register toasts never paint over the kid surface", () => {
  const src = readSrc("context", "ToastContext.tsx");

  it("toast() queues instead of rendering while the gate is active", () => {
    const toastFn = src.slice(src.indexOf("const toast = useCallback"));
    const guardAt = toastFn.indexOf("if (isKidModeActive())");
    const pushAt = toastFn.indexOf("queueRef.current.push");
    const renderAt = toastFn.indexOf("setToasts((t) => [...t, { id, type, message }])");
    expect(guardAt).toBeGreaterThan(-1);
    expect(pushAt).toBeGreaterThan(guardAt);
    expect(renderAt).toBeGreaterThan(pushAt); // queue path returns before render path
  });

  it("subscribes to the gate and flushes the queue on exit", () => {
    expect(src).toContain("subscribeKidMode(setKidLocked)");
    expect(src).toContain("queueRef.current = []");
    expect(src).toMatch(/if \(kidLocked \|\| queueRef\.current\.length === 0\) return;/);
  });

  it("the z-[80] container is not mounted at all while locked", () => {
    const containerAt = src.indexOf('className="fixed top-4 end-4 z-[80]');
    expect(containerAt).toBeGreaterThan(-1);
    const gateAt = src.lastIndexOf("{!kidLocked && (", containerAt);
    expect(gateAt, "toast container must be wrapped in {!kidLocked && (").toBeGreaterThan(-1);
  });
});

// ── LEAK 5: hotkey + body-portal modals (source-level) ───────────────────────
describe("LEAK 5: Ctrl/Cmd+K and body-portal modals are sealed in Kid Mode", () => {
  const src = readSrc("components", "layout", "Shell.tsx");

  it("the Ctrl/Cmd+K handler early-returns on the gate before toggling search", () => {
    const comboAt = src.indexOf('e.key.toLowerCase() === "k"');
    expect(comboAt).toBeGreaterThan(-1);
    const guardAt = src.indexOf("if (isKidModeActive()) return;", comboAt);
    const toggleAt = src.indexOf("setSearchOpen((s) => !s)", comboAt);
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(toggleAt);
  });

  it("SearchModal, SettingsModal and PaywallModal are unmounted while locked", () => {
    expect(src).toContain("{!kidLocked && <SearchModal");
    expect(src).toContain("{!kidLocked && <SettingsModal");
    expect(src).toContain("{!kidLocked && <PaywallModal");
  });

  it("Shell reads the gate via useSyncExternalStore (it renders the provider, so context can't reach its own hooks)", () => {
    expect(src).toContain("useSyncExternalStore(subscribeKidMode, isKidModeActive)");
  });

  it("open modal flags are dropped when the lock engages", () => {
    expect(src).toMatch(/if \(!kidLocked\) return;\s*\n\s*setSearchOpen\(false\);\s*\n\s*setSettingsOpen\(false\);/);
  });
});

// ── LEAK 6a: focus trap (pure unit) ──────────────────────────────────────────
function fakeFocusable(): TrapFocusable & { focused: number } {
  const el = {
    focused: 0,
    focus() {
      el.focused += 1;
    },
  };
  return el;
}

function fakeRoot(focusables: TrapFocusable[], inside: Set<unknown>): TrapRoot {
  return {
    contains: (node) => inside.has(node),
    querySelectorAll: () => focusables,
  };
}

function fakeEvent(key: string, shiftKey = false): TrapKeyEvent & { defaultPrevented: boolean } {
  const e = {
    key,
    shiftKey,
    defaultPrevented: false,
    preventDefault() {
      e.defaultPrevented = true;
    },
  };
  return e;
}

describe("LEAK 6a: trapTabKey — Tab wraps within the overlay, portals are recaptured", () => {
  it("ignores non-Tab keys entirely (zero regression)", () => {
    const e = fakeEvent("Enter");
    const handled = trapTabKey(e, fakeRoot([fakeFocusable()], new Set()), null);
    expect(handled).toBe(false);
    expect(e.defaultPrevented).toBe(false);
  });

  it("swallows Tab when the overlay has no focusables", () => {
    const e = fakeEvent("Tab");
    expect(trapTabKey(e, fakeRoot([], new Set()), null)).toBe(true);
    expect(e.defaultPrevented).toBe(true);
  });

  it("recaptures focus that escaped into a body portal (toast dismiss, Modal)", () => {
    const first = fakeFocusable();
    const last = fakeFocusable();
    const portalButton = {}; // outside the overlay subtree
    const e = fakeEvent("Tab");
    const handled = trapTabKey(e, fakeRoot([first, last], new Set([first, last])), portalButton);
    expect(handled).toBe(true);
    expect(e.defaultPrevented).toBe(true);
    expect(first.focused).toBe(1);
  });

  it("wraps forward: Tab on the last focusable moves to the first", () => {
    const first = fakeFocusable();
    const last = fakeFocusable();
    const e = fakeEvent("Tab");
    expect(trapTabKey(e, fakeRoot([first, last], new Set([first, last])), last)).toBe(true);
    expect(first.focused).toBe(1);
  });

  it("wraps backward: Shift+Tab on the first focusable moves to the last", () => {
    const first = fakeFocusable();
    const last = fakeFocusable();
    const e = fakeEvent("Tab", true);
    expect(trapTabKey(e, fakeRoot([first, last], new Set([first, last])), first)).toBe(true);
    expect(last.focused).toBe(1);
  });

  it("leaves mid-list tabbing to the browser (returns false, no preventDefault)", () => {
    const first = fakeFocusable();
    const mid = fakeFocusable();
    const last = fakeFocusable();
    const e = fakeEvent("Tab");
    expect(trapTabKey(e, fakeRoot([first, mid, last], new Set([first, mid, last])), mid)).toBe(false);
    expect(e.defaultPrevented).toBe(false);
  });

  it("the selector targets standard tabbables and excludes tabindex=-1", () => {
    expect(FOCUSABLE_SELECTOR).toContain("button:not([disabled])");
    expect(FOCUSABLE_SELECTOR).toContain('[tabindex]:not([tabindex="-1"])');
  });
});

// ── LEAK 6b: overlay wiring — trap + live shield (source-level) ──────────────
describe("LEAK 6b: KidModeOverlay wires the trap and keeps the shield live", () => {
  const src = readSrc("components", "kidmode", "KidModeOverlay.tsx");

  it("owns Tab at document capture while open", () => {
    expect(src).toContain("trapTabKey(e, root as unknown as TrapRoot, document.activeElement)");
    const trapEffect = src.slice(src.indexOf("trapTabKey"));
    expect(src).toMatch(/document\.addEventListener\("keydown", onTab, true\)/);
    void trapEffect;
  });

  it("re-runs the inert shield on a MutationObserver over the mount node's children", () => {
    expect(src).toContain("new MutationObserver(");
    expect(src).toContain("observer.observe(parent, { childList: true })");
    // Re-snapshot pattern: restore, then shield the current set.
    const moBody = src.slice(src.indexOf("new MutationObserver("), src.indexOf("observer.observe"));
    expect(moBody).toContain("undo()");
    expect(moBody).toContain("undo = shieldShellSiblings(Array.from(parent.children))");
    // Cleanup disconnects AND restores.
    expect(src).toContain("observer.disconnect()");
  });

  it("keeps the existing Escape capture (the trap adds to it, never replaces it)", () => {
    expect(src).toContain('if (e.key === "Escape")');
  });
});

// ── safety contract for the new modules ──────────────────────────────────────
describe("KID-LOCK modules honor the kid-mode safety contract", () => {
  it.each([
    ["lib/kidModeGate.ts", ["lib", "kidModeGate.ts"]],
    ["components/kidmode/kidModeFocusTrap.ts", ["components", "kidmode", "kidModeFocusTrap.ts"]],
  ] as const)("%s: no Firestore writes, no network, no hex literals", (_label, rel) => {
    const src = readSrc(...rel);
    for (const wp of ["upsert(", "addDoc(", "setDoc(", "updateDoc(", "deleteDoc(", "writeBatch", "fetch(", "XMLHttpRequest"]) {
      expect(src, `must not call ${wp}`).not.toContain(wp);
    }
    expect(src.match(/#[0-9a-fA-F]{3,6}\b/g) ?? []).toHaveLength(0);
  });

  it("every guard is an if(kidModeActive) early-return — no parent-mode branch changes", () => {
    // Spot-check the four production guards: each reads the gate positively
    // and returns/skips, never inverts parent behavior.
    for (const [file, rel] of [
      ["native.ts", ["lib", "native.ts"]],
      ["ArborContext.tsx", ["context", "ArborContext.tsx"]],
      ["ToastContext.tsx", ["context", "ToastContext.tsx"]],
      ["Shell.tsx", ["components", "layout", "Shell.tsx"]],
    ] as const) {
      const src = readSrc(...rel);
      expect(src, `${file} must guard with isKidModeActive()`).toContain("isKidModeActive()");
      expect(src, `${file} must never negate the gate for parent flow`).not.toContain("!isKidModeActive()");
    }
  });
});
