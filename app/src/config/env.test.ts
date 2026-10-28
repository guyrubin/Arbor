/**
 * B-INF-04 — env invariants for MODEL_PROVIDER=mock.
 *  - prod refuses mock at startup (the existing "Production Arbor requires
 *    MODEL_PROVIDER=vertex" invariant, now pinned for mock);
 *  - outside prod, mock parses, and every OTHER outbound AI path (Live token
 *    mint, cloud TTS, child ASR) is off, so the sandbox makes zero model calls;
 *  - an unknown provider still throws.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "./env.js";

const KEYS = [
  "ARBOR_ENV",
  "MODEL_PROVIDER",
  "MEMORY_ADAPTER",
  "ENABLE_LOCAL_MEMORY_ADAPTER",
  "GCP_PROJECT_ID",
  "FIREBASE_PROJECT_ID",
  "LIVE_ENABLED",
  "GEMINI_API_KEY",
  "TTS_PROVIDER",
  "TTS_DISABLED",
  "CHILD_ASR_PROVIDER",
  "ARBOR_FAMILY_EMAILS",
  "ARBOR_PLANS_OWNER_EMAILS",
  "ARBOR_PLANS_OWNER_UIDS",
] as const;
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const prodEnv = () => {
  process.env.ARBOR_ENV = "prod";
  process.env.MEMORY_ADAPTER = "firestore";
  process.env.ENABLE_LOCAL_MEMORY_ADAPTER = "false";
  process.env.GCP_PROJECT_ID = "arbor-test";
  process.env.FIREBASE_PROJECT_ID = "arbor-test";
};

describe("B-INF-04 · MODEL_PROVIDER=mock env invariants", () => {
  it("prod config with mock fails startup", () => {
    prodEnv();
    process.env.MODEL_PROVIDER = "mock";
    expect(() => loadConfig()).toThrow(/Production Arbor requires MODEL_PROVIDER=vertex/);
  });

  it("the same prod config with vertex starts (the refusal is about mock, not the fixture env)", () => {
    prodEnv();
    process.env.MODEL_PROVIDER = "vertex";
    expect(loadConfig().modelProvider).toBe("vertex");
  });

  it("prod defaults to vertex when MODEL_PROVIDER is unset", () => {
    prodEnv();
    expect(loadConfig().modelProvider).toBe("vertex");
  });

  for (const arborEnv of ["local", "dev"] as const) {
    it(`${arborEnv}: mock parses and turns every other outbound AI path off`, () => {
      process.env.ARBOR_ENV = arborEnv;
      process.env.MODEL_PROVIDER = "MOCK";
      process.env.LIVE_ENABLED = "true";
      process.env.GEMINI_API_KEY = "test-key";
      process.env.TTS_PROVIDER = "google";
      process.env.CHILD_ASR_PROVIDER = "gemini";
      const config = loadConfig();
      expect(config.modelProvider).toBe("mock");
      expect(config.liveEnabled).toBe(false);
      expect(config.ttsDisabled).toBe(true);
      expect(config.childAsrProvider).toBe("none");
    });
  }

  it("without mock, the same flags stay as configured (no capability regression)", () => {
    process.env.ARBOR_ENV = "local";
    process.env.MODEL_PROVIDER = "gemini_dev";
    process.env.LIVE_ENABLED = "true";
    process.env.CHILD_ASR_PROVIDER = "gemini";
    const config = loadConfig();
    expect(config.liveEnabled).toBe(true);
    expect(config.ttsDisabled).toBe(false);
    expect(config.childAsrProvider).toBe("gemini");
  });

  it("an unknown provider still throws", () => {
    process.env.ARBOR_ENV = "local";
    process.env.MODEL_PROVIDER = "openai";
    expect(() => loadConfig()).toThrow(/Invalid MODEL_PROVIDER/);
  });
});

describe("B-BOOK-79 follow-up · the plans-owner allow-list defaults to the founder family", () => {
  const dev = () => { process.env.ARBOR_ENV = "dev"; process.env.MODEL_PROVIDER = "mock"; };

  it("no ARBOR_PLANS_OWNER_* set: the owner emails are ARBOR_FAMILY_EMAILS, lower-cased", () => {
    dev();
    process.env.ARBOR_FAMILY_EMAILS = "Founder@Example.test, second@example.test";
    const c = loadConfig();
    expect(c.plansOwnerEmails).toEqual(["founder@example.test", "second@example.test"]);
    expect(c.plansOwnerUids).toEqual([]);
  });

  it("an explicit ARBOR_PLANS_OWNER_EMAILS or _UIDS overrides the default entirely", () => {
    dev();
    process.env.ARBOR_FAMILY_EMAILS = "founder@example.test";
    process.env.ARBOR_PLANS_OWNER_EMAILS = "Reviewer@Example.test";
    expect(loadConfig().plansOwnerEmails).toEqual(["reviewer@example.test"]);
    delete process.env.ARBOR_PLANS_OWNER_EMAILS;
    process.env.ARBOR_PLANS_OWNER_UIDS = "uid-1";
    const c = loadConfig();
    expect(c.plansOwnerUids).toEqual(["uid-1"]);
    expect(c.plansOwnerEmails).toEqual([]); // uids named: the family default does not creep back in
  });

  it("nothing set anywhere: no owner (every unsigned pattern stays dark outside the sandbox)", () => {
    dev();
    const c = loadConfig();
    expect(c.plansOwnerEmails).toEqual([]);
    expect(c.plansOwnerUids).toEqual([]);
  });
});
