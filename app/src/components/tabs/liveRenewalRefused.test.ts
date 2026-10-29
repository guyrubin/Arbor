/**
 * Wave 4 — /live/token's 409 `live_renewal_invalid` is the voice session's own
 * state, never the crisis screen. lib/api.ts turned it into
 * EscalationRequiredError (latent: nothing rendered it, and the renewal was
 * retried twice more against a server that would refuse each one). Now it is
 * ApiError(live_renewal_invalid, 409); CoachTab's renew answers
 * LIVE_RENEWAL_REFUSED, the live client makes no further attempt, and the talk
 * ends at the slice's end with the voice session's closing line
 * (onTalkEnd → elev.aierrors.voiceTalkEnded, EN and HE; the client half is in
 * lib/geminiLiveClient.renewal.test.ts).
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/firebase", () => ({ auth: null, firebaseEnabled: false }));

import { api, ApiError, EscalationRequiredError, isLiveRenewalInvalid } from "../../lib/api";
import { translate } from "../../lib/i18n";

const coach = readFileSync(new URL("./CoachTab.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
afterEach(() => { vi.unstubAllGlobals(); });

describe("the voice session owns an invalid Live renewal", () => {
  it("a 409 live_renewal_invalid from /live/token is its own error, not EscalationRequiredError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ available: false, code: "live_renewal_invalid", reason: "Live voice is not available right now." }), { status: 409 })));
    const error = await api.liveToken({ language: "en", childId: "child-a", renewOf: "u1" }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(EscalationRequiredError);
    expect(isLiveRenewalInvalid(error)).toBe(true);
    // Negative controls: a crisis 409 and another 409 code are not this state.
    expect(isLiveRenewalInvalid(new EscalationRequiredError("x"))).toBe(false);
    expect(isLiveRenewalInvalid(new ApiError("hero_missing", 409))).toBe(false);
  });

  it("CoachTab's renew answers LIVE_RENEWAL_REFUSED for it, loaded with the live client (no new static import)", () => {
    expect(coach).toContain('const { requestLiveMicrophone, startGeminiLive, LIVE_RENEWAL_REFUSED } = await import("../../lib/geminiLiveClient");');
    expect(coach).toMatch(/renew: async \(renewOf\) => \{[\s\S]*?if \(isLiveResting\(renewError\)\) return null;[\s\S]{0,400}?if \(isLiveRenewalInvalid\(renewError\)\) return LIVE_RENEWAL_REFUSED;\s*throw renewError;/);
    expect(coach).not.toMatch(/^import[^\n]*LIVE_RENEWAL_REFUSED/m);
  });

  it("the line the parent reads is the session's closing line, EN and HE", () => {
    expect(coach).toMatch(/onTalkEnd: \(\) => \{[\s\S]{0,400}?setVoiceTalkEnded\(true\);/);
    expect(coach).toContain('{t("elev.aierrors.voiceTalkEnded")}');
    for (const lang of ["en", "he"] as const) expect(translate(lang, "elev.aierrors.voiceTalkEnded")).not.toBe("elev.aierrors.voiceTalkEnded");
  });
});
