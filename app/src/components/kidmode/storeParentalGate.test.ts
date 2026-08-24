/**
 * STORE-3 — age-hard parental gate regression tests.
 *
 * The bar (master plan 1.2): the 2-digit math question is kid-exit UX only —
 * NOT a boundary for commerce. Pinned here:
 *   1. a math-earned exit marks the session commerce-restricted; only a PIN
 *      verify (or credentialed sign-in / fresh session) lifts it
 *   2. no purchase or portal action is reachable on the math-fallback path
 *   3. once a PIN exists the exit gate has NO math fallback
 *   4. the PIN is set ONLY from the authenticated parent Settings surface —
 *      never from the kid-mode challenge card
 *   5. kid-register components contain no external URLs at all
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readdirSync } from "node:fs";
import {
  MATH_EXIT_KEY,
  PARENT_PIN_KEY,
  commerceAllowed,
  clearMathExit,
  isMathExitSession,
  markMathExit,
  verifyParentPin,
  type GateSessionStorage,
} from "./parentGate";
import { en as gateEn, he as gateHe } from "../../lib/i18nElevation/gate";

const fakeStorage = (): GateSessionStorage & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
};

const src = (...parts: string[]) => readFileSync(resolve(process.cwd(), "src", ...parts), "utf8");

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("math-exit session restriction (the age-hard mechanism)", () => {
  it("a math exit marks the session and blocks commerce until cleared", () => {
    const s = fakeStorage();
    expect(commerceAllowed(s)).toBe(true);
    markMathExit(s);
    expect(isMathExitSession(s)).toBe(true);
    expect(commerceAllowed(s)).toBe(false);
    clearMathExit(s);
    expect(commerceAllowed(s)).toBe(true);
  });

  it("verifyParentPin lifts the restriction ONLY on the correct PIN", () => {
    const session = fakeStorage();
    const local = fakeStorage();
    local.setItem(PARENT_PIN_KEY, "4321");
    (globalThis as { window?: unknown }).window = { localStorage: local };
    markMathExit(session);
    expect(verifyParentPin("1111", session)).toBe(false);
    expect(commerceAllowed(session)).toBe(false);
    expect(verifyParentPin("4321", session)).toBe(true);
    expect(commerceAllowed(session)).toBe(true);
  });

  it("with NO stored PIN, verifyParentPin never passes (nothing to verify against)", () => {
    const session = fakeStorage();
    markMathExit(session);
    expect(verifyParentPin("0000", session)).toBe(false);
    expect(commerceAllowed(session)).toBe(false);
  });

  it("uses sessionStorage scoping (key contract)", () => {
    expect(MATH_EXIT_KEY).toBe("arbor.gate.mathExit");
  });
});

describe("source contracts — no purchase reachable via the math-fallback path", () => {
  it("useCheckout blocks BOTH checkout and portal in a math-exit session", () => {
    const hook = src("hooks", "useCheckout.ts");
    // Both action entries check the gate before any billing action runs.
    const checkoutIdx = hook.indexOf("const startCheckout");
    const portalIdx = hook.indexOf("const openPortal");
    expect(checkoutIdx).toBeGreaterThan(-1);
    expect(portalIdx).toBeGreaterThan(-1);
    const checkoutBody = hook.slice(checkoutIdx, portalIdx);
    const portalBody = hook.slice(portalIdx, hook.indexOf("const restorePurchases"));
    expect(checkoutBody).toMatch(/commerceAllowed\(\)/);
    expect(portalBody).toMatch(/commerceAllowed\(\)/);
  });

  it("the challenge card marks a math exit and verifies PIN via the gate module", () => {
    const card = src("components", "kidmode", "ParentChallenge.tsx");
    expect(card).toMatch(/markMathExit\(\)/);
    expect(card).toMatch(/verifyParentPin\(/);
  });

  it("once a PIN exists the exit gate offers NO math fallback", () => {
    const card = src("components", "kidmode", "ParentChallenge.tsx");
    expect(card).not.toMatch(/useMath/);
    expect(card).not.toMatch(/setMode\(/); // mode is derived, never switchable
  });

  it("the kid-mode challenge card can no longer mint the PIN — Settings is the only writer", () => {
    const card = src("components", "kidmode", "ParentChallenge.tsx");
    expect(card).not.toMatch(/saveParentPin/);
    const panel = src("components", "layout", "ParentalGatePanel.tsx");
    expect(panel).toMatch(/saveParentPin\(/);
    // Changing an existing PIN requires the current one.
    expect(panel).toMatch(/pinSet && current !== readParentPin\(\)/);
    const settings = src("components", "layout", "SettingsModal.tsx");
    expect(settings).toMatch(/<ParentalGatePanel \/>/);
  });

  it("a credentialed sign-in (and only that — never onAuthStateChanged) lifts the restriction", () => {
    const auth = src("context", "AuthContext.tsx");
    const stateChanged = auth.slice(auth.indexOf("onAuthStateChanged(auth"), auth.indexOf("const signInWithGoogle"));
    expect(stateChanged).not.toMatch(/clearMathExit/); // reload must NOT unlock
    expect((auth.match(/clearMathExit\(\)/g) ?? []).length).toBeGreaterThanOrEqual(2); // both sign-in methods
  });
});

describe("kid register contains no external URLs (nothing to gate inside Kid Mode)", () => {
  it("components/kidmode/*.tsx has no http(s) target and no window.open", () => {
    const dir = resolve(process.cwd(), "src", "components", "kidmode");
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".tsx")) continue;
      const text = readFileSync(join(dir, name), "utf8");
      expect(text, `${name} must not carry an external URL`).not.toMatch(/https?:\/\//);
      expect(text, `${name} must not open windows`).not.toMatch(/window\.open/);
    }
  });
});

describe("gate copy parity", () => {
  it("EN and HE gate dictionaries carry identical key sets (incl. the STORE-3 keys)", () => {
    expect(Object.keys(gateEn).sort()).toEqual(Object.keys(gateHe).sort());
    for (const key of ["elev.gate.blocked", "elev.gate.set.title", "elev.gate.set.blockedSetup", "elev.gate.unlock"]) {
      expect(gateEn[key], `${key} EN`).toBeTruthy();
      expect(gateHe[key], `${key} HE`).toBeTruthy();
    }
    // Dead keys from the removed in-card setter / math fallback stay removed.
    expect(gateEn["elev.gate.useMath"]).toBeUndefined();
    expect(gateEn["elev.gate.setPinToggle"]).toBeUndefined();
  });
});
