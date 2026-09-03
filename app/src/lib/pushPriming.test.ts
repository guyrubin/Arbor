/**
 * MOB-19 / ENG-23 — priming before the OS prompt; the toggle lives in
 * Gentle Reminders → Delivery, nowhere else.
 *
 * Behaviour: an unprimed device never reaches registerPush (the OS prompt);
 * a primed one does; native / no-VAPID builds report unavailable honestly.
 * Source: `registerPush` is referenced from SmartRemindersPanel only under
 * src/components (DevelopmentTab lost its toggle); the panel reaches it
 * through enablePushIfPrimed, never directly. Negative control: the verbatim
 * pre-fix DevelopmentTab handler trips both scans.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearPushPrimed, enablePushIfPrimed, markPushPrimed, pushAvailability, readPushPrimed } from "./pushPriming";

const here = path.dirname(fileURLToPath(import.meta.url));
const COMPONENTS = path.join(here, "..", "components");
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const OLD_DEVELOPMENT_TAB_HANDLER = `
  const handlePushToggle = useCallback(async () => {
    const { pushCapable, registerPush, unregisterPush } = await import("../../lib/push.js");
    if (!pushCapable()) return;
    const apiBase = (window as unknown as { __ARBOR_API_BASE__?: string }).__ARBOR_API_BASE__ || "/api";
    setPushPending(true);
    try {
      if (pushEnabled) {
        await unregisterPush(apiBase);
        setPushEnabled(false);
      } else {
        const result = await registerPush(apiBase);
        setPushEnabled(result === "granted");
      }
    } finally {
      setPushPending(false);
    }
  }, [pushEnabled]);`;

/** A direct call — the OS prompt reachable without the priming seam. */
const DIRECT_REGISTER_CALL = /\bawait registerPush\(|[^.\w]registerPush\(apiBase\)/;

function fakeStorage() {
  const store = new Map<string, string>();
  const g = globalThis as Record<string, unknown>;
  const prev = g.localStorage;
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  return () => { g.localStorage = prev; };
}

describe("enablePushIfPrimed — the priming flag gates the OS prompt", () => {
  let restore: () => void;
  beforeEach(() => { restore = fakeStorage(); clearPushPrimed(); });
  afterEach(() => restore());

  it("negative control: NOT primed → registerPush (the OS prompt) is never called", async () => {
    const registerPush = vi.fn(async () => "granted" as const);
    expect(readPushPrimed()).toBe(false);
    expect(await enablePushIfPrimed({ availability: "available", registerPush })).toBe("not-primed");
    expect(registerPush).not.toHaveBeenCalled();
  });

  it("primed (Enable tapped on the card) → registerPush runs, result relayed", async () => {
    markPushPrimed();
    expect(readPushPrimed()).toBe(true);
    const registerPush = vi.fn(async () => "granted" as const);
    expect(await enablePushIfPrimed({ availability: "available", registerPush })).toBe("granted");
    expect(registerPush).toHaveBeenCalledTimes(1);
    expect(await enablePushIfPrimed({ availability: "available", registerPush: async () => "denied" })).toBe("denied");
  });

  it("unavailable builds never call registerPush even when primed", async () => {
    markPushPrimed();
    const registerPush = vi.fn(async () => "granted" as const);
    expect(await enablePushIfPrimed({ availability: "unavailable", registerPush })).toBe("unavailable");
    expect(registerPush).not.toHaveBeenCalled();
  });

  it("availability is honest: native = not built; web needs the VAPID key", () => {
    expect(pushAvailability({ isNative: true, pushCapable: () => true })).toBe("unavailable");
    expect(pushAvailability({ isNative: false, pushCapable: () => false })).toBe("unavailable");
    expect(pushAvailability({ isNative: false, pushCapable: () => true })).toBe("available");
  });
});

describe("the toggle lives in SmartRemindersPanel only (structural)", () => {
  it("negative control: the pre-fix DevelopmentTab handler trips the direct-call scan", () => {
    expect(DIRECT_REGISTER_CALL.test(OLD_DEVELOPMENT_TAB_HANDLER)).toBe(true);
    expect(OLD_DEVELOPMENT_TAB_HANDLER).toContain("registerPush");
  });

  it("under src/components, `registerPush` is referenced from SmartRemindersPanel and nowhere else", () => {
    const files = walk(COMPONENTS)
      .filter((f) => /\bregisterPush\b/.test(stripComments(readFileSync(f, "utf8"))))
      .map((f) => path.relative(COMPONENTS, f).split(path.sep).join("/"));
    expect(files).toEqual(["sections/SmartRemindersPanel.tsx"]);
  });

  it("SmartRemindersPanel reaches registerPush only through enablePushIfPrimed and shows the priming card", () => {
    const src = stripComments(readFileSync(path.join(COMPONENTS, "sections", "SmartRemindersPanel.tsx"), "utf8"));
    expect(src).toMatch(/import \{[^}]*enablePushIfPrimed[^}]*\} from "\.\.\/\.\.\/lib\/pushPriming"/);
    expect(src).not.toMatch(DIRECT_REGISTER_CALL);
    expect(src).toContain("elev.settingsWave.push.prime.body");
    expect(src).toContain("elev.settingsWave.push.unavailable");
    expect(src).toContain("markPushPrimed()");
  });

  it("DevelopmentTab no longer mounts a push toggle", () => {
    const src = stripComments(readFileSync(path.join(COMPONENTS, "tabs", "DevelopmentTab.tsx"), "utf8"));
    expect(src).not.toContain("PushOptInToggle");
    expect(src).not.toContain("lib/push");
  });
});
