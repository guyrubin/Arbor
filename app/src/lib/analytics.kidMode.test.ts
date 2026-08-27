/**
 * STORE-K1 (WS-4.0 SDK audit, finding 1): Kid Mode analytics egress gate.
 *
 * The store audit's single weakest fact was that the parent's first-touch
 * marketing attribution (utm_*, source, market, referral_code) was merged onto
 * events fired by CHILD-operated surfaces. These are negative pins: a
 * kid-generated event must carry NONE of those keys, must carry kid_mode:true,
 * and must still fire (safety telemetry is never silently dropped). Parent-mode
 * behaviour must stay byte-identical to before the gate.
 *
 * Node harness (vitest environment: "node") — Firestore is faked so the exact
 * document written is assertable.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Firestore seam: capture the written event document instead of hitting network.
const written: { path: string; doc: Record<string, unknown> }[] = [];
vi.mock("firebase/firestore", () => ({
  addDoc: (ref: { path: string }, doc: Record<string, unknown>) => {
    written.push({ path: ref.path, doc });
    return Promise.resolve();
  },
  collection: (_db: unknown, p: string) => ({ path: p }),
  serverTimestamp: () => "SERVER_TS",
}));
vi.mock("./firebase", () => ({ firebaseEnabled: true, db: {} }));

import { track, setAnalyticsUser, setGlobalProps, stripAttributionProps, KID_MODE_PROP } from "./analytics";
import { ATTRIBUTION_PROP_KEYS, attributionProps, type Attribution } from "./attribution";
import { setKidModeActive } from "./kidModeGate";

/** A fully-populated first-touch attribution — every prop key present at once. */
const ATTRIBUTED: Attribution = {
  referralCode: "REF123",
  source: "newsletter",
  market: "il",
  utmSource: "meta",
  utmMedium: "cpc",
  utmCampaign: "launch_il",
  utmContent: "vid_a",
  utmTerm: "parenting",
  landingAt: "2026-08-26T00:00:00.000Z",
};

const globals = vi.fn(() => attributionProps(ATTRIBUTED));

beforeEach(() => {
  written.length = 0;
  globals.mockClear();
  setAnalyticsUser(() => "parent-uid");
  setGlobalProps(globals);
});

// The gate is a module singleton — always leave it closed for the next test.
afterEach(() => setKidModeActive(false));

function lastProps(): Record<string, unknown> {
  expect(written.length).toBeGreaterThan(0);
  return written[written.length - 1].doc.props as Record<string, unknown>;
}

// ── parent mode: unchanged ────────────────────────────────────────────────────
describe("track() in parent mode is unchanged by the kid gate", () => {
  it("merges the attribution globals onto the event", () => {
    track("view_tab", { tab: "coach" });
    const props = lastProps();
    expect(props).toMatchObject({
      tab: "coach",
      market: "il",
      source: "newsletter",
      referral_code: "REF123",
      utm_source: "meta",
      utm_medium: "cpc",
      utm_campaign: "launch_il",
      utm_content: "vid_a",
      utm_term: "parenting",
    });
  });

  it("does NOT tag parent events with kid_mode", () => {
    track("view_tab", { tab: "coach" });
    expect(KID_MODE_PROP in lastProps()).toBe(false);
  });

  it("explicit props still win over globals", () => {
    track("learn_deep_link", { source: "today_card" });
    expect(lastProps().source).toBe("today_card");
  });

  it("writes to the signed-in parent's own events collection", () => {
    track("view_tab", { tab: "coach" });
    expect(written[written.length - 1].path).toBe("users/parent-uid/events");
  });
});

// ── kid mode: negative pins ───────────────────────────────────────────────────
describe("track() in Kid Mode strips attribution and tags the event", () => {
  it("carries NO attribution/utm/referral key — every key, individually pinned", () => {
    setKidModeActive(true);
    track("practice_event", { kind: "match", domain: "emotional", correct: true });
    const props = lastProps();
    for (const key of ATTRIBUTION_PROP_KEYS) {
      expect(props[key], `${key} must not ride on a child-generated event`).toBeUndefined();
      expect(key in props).toBe(false);
    }
    expect(Object.keys(props).some((k) => k.startsWith("utm_"))).toBe(false);
  });

  it("tags the event kid_mode: true", () => {
    setKidModeActive(true);
    track("speech_attempt", { sound: "s", level: 1, result: "ok", method: "manual" });
    expect(lastProps()[KID_MODE_PROP]).toBe(true);
  });

  it("keeps the call site's own categorical props", () => {
    setKidModeActive(true);
    track("mimic_round", { pack: "faces", prompt: "p1", rating: 2 });
    expect(lastProps()).toMatchObject({ pack: "faces", prompt: "p1", rating: 2, kid_mode: true });
  });

  it("never asks the attribution provider for props at all in Kid Mode", () => {
    setKidModeActive(true);
    track("adventure_start", { scenario: "market" });
    expect(globals).not.toHaveBeenCalled();
  });

  it("safety telemetry still fires: kidlock_blocked_nav is written, not dropped", () => {
    setKidModeActive(true);
    track("kidlock_blocked_nav", { tab: "coach" });
    expect(written).toHaveLength(1);
    expect(written[0].doc.event).toBe("kidlock_blocked_nav");
    expect(lastProps()).toEqual({ tab: "coach", kid_mode: true });
  });

  it("an explicit call-site prop cannot smuggle attribution through the gate", () => {
    setKidModeActive(true);
    track("practice_event", { kind: "match", utm_source: "meta", referral_code: "REF123", source: "x" });
    expect(lastProps()).toEqual({ kind: "match", kid_mode: true });
  });

  it("re-merges the globals as soon as Kid Mode closes", () => {
    setKidModeActive(true);
    track("practice_event", { kind: "match" });
    setKidModeActive(false);
    track("view_tab", { tab: "coach" });
    const props = lastProps();
    expect(props.utm_source).toBe("meta");
    expect(KID_MODE_PROP in props).toBe(false);
  });
});

// ── drift guards ──────────────────────────────────────────────────────────────
describe("attribution key list cannot drift away from the strip", () => {
  it("attributionProps() emits nothing outside ATTRIBUTION_PROP_KEYS", () => {
    const emitted = Object.keys(attributionProps(ATTRIBUTED));
    expect(emitted.length).toBeGreaterThan(0);
    for (const key of emitted) expect(ATTRIBUTION_PROP_KEYS).toContain(key);
  });

  it("stripAttributionProps removes every listed key and nothing else", () => {
    const bag: Record<string, unknown> = { keep: 1 };
    for (const key of ATTRIBUTION_PROP_KEYS) bag[key] = "x";
    expect(stripAttributionProps(bag)).toEqual({ keep: 1 });
  });

  it("the gate sits at the ONE choke point, before the globals are read", () => {
    const src = readFileSync(path.join(__dirname, "analytics.ts"), "utf8");
    const fnStart = src.indexOf("export function track(");
    expect(fnStart).toBeGreaterThan(-1);
    const guardAt = src.indexOf("if (isKidModeActive())", fnStart);
    const globalsAt = src.indexOf("globalPropsProvider()", fnStart);
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(globalsAt);
  });
});
