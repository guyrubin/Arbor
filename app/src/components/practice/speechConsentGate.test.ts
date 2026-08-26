import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { isGrantActive, platformAsrAllowed, voiceConsentState, VOICE_CONSENT_PURPOSE } from "./speechConsentGate";
import type { ConsentGrant } from "../../types";
import { en, he } from "../../lib/i18n";

/**
 * STORE-K2 (WS-4.0 SDK audit, finding 2) — the platform speech recognizer must
 * not start outside the app's own voice_processing consent gate.
 *
 * The cloud child-ASR path was already gated 451 fail-closed on the server
 * (`/api/score-utterance` under requireConsent), but SpeechCoachTab ALSO started
 * a browser SpeechRecognition session on `autoVerdictOk` alone. That API is not
 * on-device: on Android WebView it hands the child's utterance to Google's
 * platform speech service — child audio leaving the device with no parental
 * grant recorded anywhere.
 *
 * Component assertions are SOURCE-BASED structural guards in the house pattern
 * (speechRecognitionLang.test.ts / hardMomentSurfaces.test.ts).
 */

const TAB_PATH = path.resolve(__dirname, "SpeechCoachTab.tsx");
const code = fs.readFileSync(TAB_PATH, "utf8");
const stripped = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const grant = (over: Partial<ConsentGrant> = {}): ConsentGrant => ({
  id: "c1",
  childId: "kid-1",
  purpose: "voice_processing",
  granted: true,
  policyVersion: "2026-06-coppa-1",
  actorUid: "parent-1",
  grantedAt: "2026-08-01T10:00:00.000Z",
  expiresAt: null,
  revokedAt: null,
  ...over,
});

describe("STORE-K2 — voice consent reduction (unit)", () => {
  it("an active, unrevoked, unexpired voice grant reads as granted", () => {
    expect(voiceConsentState([grant()])).toBe("granted");
  });

  it("no grants at all → absent (never granted)", () => {
    expect(voiceConsentState([])).toBe("absent");
  });

  it("grants not read yet (null/undefined) → unknown, and unknown never allows a start", () => {
    expect(voiceConsentState(null)).toBe("unknown");
    expect(voiceConsentState(undefined)).toBe("unknown");
    expect(platformAsrAllowed(voiceConsentState(null))).toBe(false);
  });

  it("a revoked grant does not count", () => {
    expect(voiceConsentState([grant({ revokedAt: "2026-08-02T10:00:00.000Z" })])).toBe("absent");
  });

  it("an expired grant does not count", () => {
    const expired = grant({ expiresAt: "2026-08-02T10:00:00.000Z" });
    expect(voiceConsentState([expired], Date.parse("2026-08-26T10:00:00.000Z"))).toBe("absent");
    expect(voiceConsentState([expired], Date.parse("2026-08-01T10:00:00.000Z"))).toBe("granted");
  });

  it("granted:false does not count", () => {
    expect(voiceConsentState([grant({ granted: false })])).toBe("absent");
  });

  it("the LATEST grant for the purpose wins — a later revocation beats an older grant", () => {
    const older = grant({ id: "old", grantedAt: "2026-07-01T10:00:00.000Z" });
    const newer = grant({ id: "new", grantedAt: "2026-08-20T10:00:00.000Z", granted: false, revokedAt: "2026-08-20T10:00:00.000Z" });
    expect(voiceConsentState([older, newer])).toBe("absent");
    expect(voiceConsentState([newer, older])).toBe("absent");
  });

  it("a face_processing grant NEVER unlocks voice (purpose-scoped)", () => {
    expect(voiceConsentState([grant({ purpose: "face_processing" })])).toBe("absent");
    expect(voiceConsentState([grant({ purpose: "ai_training" })])).toBe("absent");
  });

  it("platformAsrAllowed is true for granted only", () => {
    expect(platformAsrAllowed("granted")).toBe(true);
    expect(platformAsrAllowed("absent")).toBe(false);
    expect(platformAsrAllowed("unknown")).toBe(false);
  });

  it("isGrantActive mirrors the server rule for a missing grant", () => {
    expect(isGrantActive(undefined)).toBe(false);
    expect(isGrantActive(null)).toBe(false);
  });

  it("the gated purpose is the same one the server enforces (451 fail-closed)", () => {
    expect(VOICE_CONSENT_PURPOSE).toBe("voice_processing");
  });
});

describe("STORE-K2 — SpeechCoachTab wiring (source-pinned)", () => {
  it("the recognizer constructor is obtained ONLY through the consent gate", () => {
    expect(stripped).toMatch(/const\s+Ctor\s*=\s*platformAsrAllowed\(voiceConsent\)\s*\?\s*getRecognitionCtor\(\)\s*:\s*null/);
  });

  it("no start path bypasses the gate: every recognizer construction/start is downstream of that Ctor", () => {
    // Exactly one construction, exactly one start, and both use the gated Ctor.
    expect([...stripped.matchAll(/new\s+Ctor\(\)/g)]).toHaveLength(1);
    expect([...stripped.matchAll(/\.start\(\)/g)].filter((m) => stripped.slice(Math.max(0, m.index! - 40), m.index!).includes("recog"))).toHaveLength(1);
    // No second, ungated handle on the constructor: the only other call site is
    // the display-only availability probe, which never constructs.
    const ctorCalls = [...stripped.matchAll(/(?<!function\s)getRecognitionCtor\(\)/g)];
    expect(ctorCalls).toHaveLength(2);
    expect(stripped).toContain("const recognitionAvailable = useMemo(() => getRecognitionCtor() !== null, []);");
  });

  it("consent state starts unknown and a failed read stays closed (never granted)", () => {
    expect(stripped).toMatch(/useState<VoiceConsentState>\("unknown"\)/);
    expect(stripped).toMatch(/\.catch\(\(\)\s*=>\s*\{\s*if\s*\(alive\)\s*setVoiceConsent\("absent"\);\s*\}\)/);
    expect(stripped).not.toMatch(/catch[\s\S]{0,80}setVoiceConsent\("granted"\)/);
  });

  it("the grant is recorded for THIS child under the voice purpose", () => {
    expect(stripped).toMatch(/api\.grantConsent\(\{\s*childId:\s*childProfile\.id,\s*purpose:\s*VOICE_CONSENT_PURPOSE\s*\}\)/);
    expect(stripped).toContain("api.listConsent(childProfile.id)");
  });

  it("the consent invite is a PARENT surface — never offered inside Kid Mode", () => {
    expect(stripped).toMatch(/!kidMode\s*&&\s*voiceConsent\s*===\s*"absent"/);
    expect(stripped).toContain("useSyncExternalStore(subscribeKidMode, isKidModeActive)");
  });

  it("consent is an explicit two-step act (checkbox arms the button), never a silent grant", () => {
    expect(stripped).toMatch(/disabled=\{!consentChecked\s*\|\|\s*consentBusy\}/);
    expect(stripped).toMatch(/onClick=\{\(\)\s*=>\s*void allowVoiceConsent\(\)\}/);
  });

  it("parent scoring (the no-recognizer floor) is untouched", () => {
    expect(stripped).toContain('saveAttempt(b.result, "parent")');
  });
});

describe("STORE-K2 — consent copy exists in both languages", () => {
  const KEYS = [
    "prac.speech.voiceConsent.title",
    "prac.speech.voiceConsent.body",
    "prac.speech.voiceConsent.uses",
    "prac.speech.voiceConsent.stores",
    "prac.speech.voiceConsent.controls",
    "prac.speech.voiceConsent.checkbox",
    "prac.speech.voiceConsent.cta",
    "prac.speech.voiceConsent.error",
  ];

  it("every consent key is present and non-empty in EN and HE", () => {
    for (const dict of [en, he]) {
      for (const k of KEYS) {
        expect(dict[k], `${k} missing`).toBeTruthy();
        expect(dict[k].trim()).not.toBe("");
      }
    }
  });

  it("the invite states the egress honestly (the recording leaves the device)", () => {
    expect(en["prac.speech.voiceConsent.body"]).toMatch(/leaves the phone/i);
    expect(en["prac.speech.voiceConsent.checkbox"]).toMatch(/parent or guardian/i);
  });
});
