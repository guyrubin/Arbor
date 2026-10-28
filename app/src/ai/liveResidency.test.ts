/**
 * B-GA-06 — runtime evidence for the Israel-only global-endpoint Live
 * exception (G-V1, Guy 8 Oct 2026: production is the Israel pilot, Live stays
 * on Google's global endpoint through Gate A, 31 Mar 2027).
 *
 * What this pins, on the final source:
 *  1. ONE expiry day: the code default, the screen's copy and the prod env
 *     value are the same day, 2027-03-31 (the code default used to be
 *     2026-10-31 while prod carried 2027-03-31 in its env, so a deploy that
 *     dropped the env value would have ended Live five months early).
 *  2. The automatic EU-loop fallback after expiry: on the last day production
 *     admits the global path; from the next instant `decideLive` answers
 *     `policy_denied`, `/live/availability` says unavailable and the browser
 *     keeps the EU STT → text → TTS loop. The screen stops printing a date.
 *  3. The exception's scope: it widens ONLY the parent realtime-audio route in
 *     production. Every other route stays EU-only, a child-audience realtime
 *     request is never served by the global path, and an `off` or malformed
 *     env value means no exception at all (fail closed).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  LIVE_GLOBAL_EXCEPTION_UNTIL,
  LIVE_GLOBAL_PROVIDER,
  LIVE_REQUEST,
  decideLive,
  liveExceptionActive,
  liveExceptionFromEnv,
  liveGlobalCandidate,
  realtimePolicyFor,
} from "./liveResidency.js";
import { routePolicyFor, selectProvider } from "./capabilities/policy.js";
import { AiProviderError } from "./capabilities/contracts.js";
import { LIVE_RESIDENCY_EXCEPTION_UNTIL, liveResidencyUntil } from "../lib/liveResidency.js";

const GATE_A = "2027-03-31";
const LAST_INSTANT = Date.parse("2027-03-31T23:59:59.999Z");
const FIRST_AFTER = Date.parse("2027-04-01T00:00:00.000Z");

/** Production as cloudbuild.prod.yaml configures it, with the env value
 *  resolved through the same parser env.ts uses. */
const prod = (envValue: string | undefined = undefined, over: Record<string, unknown> = {}) => ({
  arborEnv: "prod" as const,
  liveEnabled: true,
  geminiApiKey: "k",
  liveModel: "live-model",
  vertexLocation: "europe-west4",
  gcpProjectId: undefined as string | undefined,
  liveGlobalExceptionUntil: liveExceptionFromEnv(envValue),
  liveVertexEu: false,
  liveVertexLocation: "europe-west4",
  ...over,
});

describe("B-GA-06 · one expiry day everywhere", () => {
  it("the code default is Gate A, 31 Mar 2027", () => {
    expect(LIVE_GLOBAL_EXCEPTION_UNTIL).toBe(GATE_A);
    expect(liveExceptionFromEnv(undefined)).toBe(GATE_A);
  });

  it("the screen's fallback copy names the same day", () => {
    expect(LIVE_RESIDENCY_EXCEPTION_UNTIL).toBe(LIVE_GLOBAL_EXCEPTION_UNTIL);
  });

  it("the production env value equals the code default (no silent drift)", () => {
    const prodYaml = readFileSync(new URL("../../../cloudbuild.prod.yaml", import.meta.url), "utf8");
    const set = [...prodYaml.matchAll(/LIVE_GLOBAL_EXCEPTION_UNTIL=([0-9-]+)/g)].map((m) => m[1]);
    expect(set.length).toBeGreaterThan(0);
    for (const value of set) expect(value).toBe(LIVE_GLOBAL_EXCEPTION_UNTIL);
  });

  it("env.ts reads the exception through the same parser (default when unset)", () => {
    const env = readFileSync(new URL("../config/env.ts", import.meta.url), "utf8");
    expect(env).toContain("liveGlobalExceptionUntil: liveExceptionFromEnv(process.env.LIVE_GLOBAL_EXCEPTION_UNTIL ?? process.env.LIVE_RESIDENCY_EXCEPTION_UNTIL)");
  });
});

describe("B-GA-06 · the automatic EU-loop fallback after expiry", () => {
  it("through the last instant of 31 Mar 2027 production admits the global path and says until when", () => {
    expect(liveExceptionActive(GATE_A, LAST_INSTANT)).toBe(true);
    const d = decideLive(prod(), LAST_INSTANT);
    expect(d).toMatchObject({ available: true, exceptionUntil: GATE_A });
    expect(d.decision?.selected.ref).toMatchObject({ provider: LIVE_GLOBAL_PROVIDER, region: "global" });
  });

  it("from 1 Apr 2027 production denies Live, which is the browser's signal to keep the EU loop", () => {
    expect(liveExceptionActive(GATE_A, FIRST_AFTER)).toBe(false);
    expect(realtimePolicyFor(prod(), FIRST_AFTER).allowedRegions).toEqual(["eu"]);
    expect(decideLive(prod(), FIRST_AFTER)).toEqual({ available: false, reason: "policy_denied" });
    // The same with the env value prod sets.
    expect(decideLive(prod(GATE_A), FIRST_AFTER)).toEqual({ available: false, reason: "policy_denied" });
  });

  it("after expiry the screen prints no date (\"until <yesterday>\" would be false)", () => {
    expect(liveResidencyUntil({}, new Date(2027, 2, 31, 12).getTime())?.getDate()).toBe(31);
    expect(liveResidencyUntil({}, new Date(2027, 3, 1, 0, 0, 1).getTime())).toBeNull();
  });

  it("the EU Vertex path, when switched on, survives the expiry and never hops to global", () => {
    const d = decideLive(prod(undefined, { liveVertexEu: true, gcpProjectId: "p" }), FIRST_AFTER);
    expect(d.available).toBe(true);
    expect(d.decision?.selected.ref.region).toBe("eu");
    expect(d.exceptionUntil).toBeUndefined();
  });
});

describe("B-GA-06 · outside the exception's scope nothing reaches the global endpoint", () => {
  it("only the realtime route is widened: every other production route stays EU-only, before and after", () => {
    for (const now of [Date.parse("2026-10-28T12:00:00Z"), FIRST_AFTER]) {
      expect(routePolicyFor({ arborEnv: "prod" }).allowedRegions).toEqual(["eu"]);
      expect(routePolicyFor({ arborEnv: "prod" }, { entitlement: "paid" }).allowedRegions).toEqual(["eu"]);
      expect(realtimePolicyFor(prod(), now).allowedRegions).toEqual(now < FIRST_AFTER ? ["eu", "global"] : ["eu"]);
    }
  });

  it("a child-audience realtime request is never served by the global Live path, even inside the window", () => {
    const policy = realtimePolicyFor(prod(), LAST_INSTANT);
    expect(policy.allowedRegions).toContain("global");
    const childRequest = { ...LIVE_REQUEST, audience: "child" as const };
    expect(() => selectProvider(childRequest, policy, [liveGlobalCandidate({ liveModel: "live-model" })])).toThrow(AiProviderError);
  });

  it("an `off` or malformed env value means no exception at all (fail closed), so Live falls back now", () => {
    const now = Date.parse("2026-10-28T12:00:00Z");
    for (const value of ["off", "none", "", "2027-3-31", "next spring"]) {
      expect(liveExceptionFromEnv(value)).toBeUndefined();
      expect(decideLive(prod(value), now)).toEqual({ available: false, reason: "policy_denied" });
    }
  });

  it("a later date in the env cannot be read as anything but that exact day", () => {
    expect(liveExceptionFromEnv("2027-03-31")).toBe(GATE_A);
    expect(liveExceptionFromEnv(" 2027-03-31 ")).toBe(GATE_A);
  });
});
