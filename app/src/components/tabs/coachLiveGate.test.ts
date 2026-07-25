import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig } from "../../config/env";
import { LIVE_SYSTEM_INSTRUCTION } from "../../lib/livePersona";

/**
 * live-enablement-gate (VC-7 + AI-V8) — client + config halves.
 *
 * The vitest env is node-only, so the CoachTab acceptance ("mounting CoachTab
 * makes zero authTokens.create calls") is pinned in the house source-guard
 * pattern (voiceCaptureEscalation.test.ts beside the tabs): the mount probe
 * may only hit the config-only GET /api/live/availability (which the route
 * spy in routes/liveGate.test.ts proves never touches the SDK), and the
 * token mint may appear ONLY inside toggleVoice. The server halves (gate,
 * pinned constraints, metering) live in routes/liveGate.test.ts.
 */

const SRC_ROOT = path.resolve(__dirname, "..", "..");
function read(rel: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
}
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const coach = stripComments(read("components/tabs/CoachTab.tsx"));
const createApp = stripComments(read("server/createApp.ts"));
const routes = stripComments(read("routes/api.ts"));

describe("AI-V8 — CoachTab mount probe mints nothing", () => {
  it("the mount effect probes api.liveAvailability, never api.liveToken", () => {
    const probe = /useEffect\(\(\) => \{\s*let cancelled = false;[\s\S]*?\}, \[\]\);/.exec(coach)?.[0] ?? "";
    expect(probe).toContain("api.liveAvailability()");
    expect(probe).not.toContain("api.liveToken");
  });

  it("api.liveToken appears exactly once — inside toggleVoice (fresh token per session)", () => {
    expect(coach.match(/api\.liveToken\(/g)?.length).toBe(1);
    const toggle = /const toggleVoice = async[\s\S]*?\n  };/.exec(coach)?.[0] ?? "";
    expect(toggle).toContain("api.liveToken()");
  });

  it("the Live persona is the shared server-pinned constant, not an inline string", () => {
    expect(coach).toContain("LIVE_SYSTEM_INSTRUCTION");
    expect(coach).not.toContain("You are Arbor, a warm, calm, non-diagnostic parenting coach");
  });
});

describe("VC-7 — gate wiring stays fail-closed", () => {
  it("LIVE_ENABLED defaults to FALSE and a bare key never enables Live (loadConfig)", () => {
    const prior = { flag: process.env.LIVE_ENABLED, model: process.env.LIVE_MODEL, key: process.env.GEMINI_API_KEY };
    try {
      delete process.env.LIVE_ENABLED;
      delete process.env.LIVE_MODEL;
      process.env.GEMINI_API_KEY = "some-key-set-for-another-reason";
      const config = loadConfig();
      expect(config.liveEnabled).toBe(false);
      expect(config.liveModel).toBe("gemini-2.0-flash-live-001");
      process.env.LIVE_ENABLED = "true";
      expect(loadConfig().liveEnabled).toBe(true);
    } finally {
      if (prior.flag === undefined) delete process.env.LIVE_ENABLED; else process.env.LIVE_ENABLED = prior.flag;
      if (prior.model === undefined) delete process.env.LIVE_MODEL; else process.env.LIVE_MODEL = prior.model;
      if (prior.key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = prior.key;
    }
  });

  it("routes own the Live model via config (no process.env.LIVE_MODEL in the route layer)", () => {
    expect(routes).not.toContain("process.env.LIVE_MODEL");
    expect(routes).toContain("config.liveModel");
  });

  it("/api/live/token AND the upcoming /api/live/turn sit on the createAiQuota allow-list", () => {
    const quotaBlock = /app\.use\(\s*\[[\s\S]*?\],\s*createAiQuota\(counters\)\s*\);/.exec(createApp)?.[0] ?? "";
    expect(quotaBlock).toContain('"/api/live/token"');
    expect(quotaBlock).toContain('"/api/live/turn"');
  });

  it("the shared persona constant is non-diagnostic and calm-register", () => {
    expect(LIVE_SYSTEM_INSTRUCTION).toMatch(/non-diagnostic/);
    expect(LIVE_SYSTEM_INSTRUCTION).toMatch(/Never diagnose/);
  });
});
