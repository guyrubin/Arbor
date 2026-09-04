/**
 * AI-02 (client half) — the Ask data-contract panel does not overclaim for a
 * SPOKEN turn.
 *
 * The panel sits directly above the microphone chip and states, unconditionally,
 * that each question carries "the memory facts you approved" and "the recent
 * turns of this conversation". For a typed question that was true. For a spoken
 * one it was not: /api/voice built its prompt from {persona, scholar, profile,
 * message} and nothing else, and CoachTab sent no thread with it.
 *
 * The fix has two halves and this file guards the client half:
 *   1. the browser voice loop now SENDS the thread (buildVoiceContext), so the
 *      grounded claim becomes true on that path — see routes/voiceGrounding
 *      for the server half; and
 *   2. Gemini Live is a direct browser↔model audio session that carries none of
 *      it, so when Live is the path a mic tap will take, the panel says so.
 *
 * Source-scan tests in the coachHonesty.test.ts pattern. `\r\n` is normalised
 * FIRST, every extraction is guarded with toBeTruthy(), and every regex is
 * proven against the PRE-fix snippet so none can rot into a vacuous pass.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { en as contractEn, he as contractHe } from "../../lib/i18nElevation/coachcontract";
import { elevationEn, elevationHe } from "../../lib/i18nElevation";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(here, "..", "..");
const read = (...parts: string[]) =>
  readFileSync(path.join(srcRoot, ...parts), "utf8").replace(/\r\n/g, "\n");

const coachSrc = read("components", "tabs", "CoachTab.tsx");

/* ── 1. the spoken turn sends the thread ─────────────────────────────────── */

/** The exact pre-fix call: a flat object literal with no context spread. */
const OLD_VOICE_CALL = `      await streamVoice(
        { message: text, childProfile, scholarLens: selectedLens, language: getAiLanguage() },`;
const VOICE_CALL_HAS_CONTEXT = /await streamVoice\(\s*\{[\s\S]{0,900}?buildVoiceContext\(chatMessages\)/;

describe("AI-02 — the spoken turn carries this conversation", () => {
  it("negative control: the regex does NOT match the pre-fix call", () => {
    expect(VOICE_CALL_HAS_CONTEXT.test(OLD_VOICE_CALL)).toBe(false);
  });

  it("CoachTab spreads the same-thread context into the /voice request", () => {
    expect(coachSrc).toMatch(VOICE_CALL_HAS_CONTEXT);
    expect(coachSrc).toContain('import { buildVoiceContext, readWeeklyContextConsent');
  });

  it("the spoken context is the SETTLED thread, never the weekly digest", () => {
    // buildVoiceContext deliberately omits weeklyContext: that toggle is
    // consent-gated per child for the typed path and a spoken turn must not
    // widen it silently.
    const ctx = read("ai", "chatContext.ts");
    const body = /export const buildVoiceContext = \([\s\S]*?\n\};/.exec(ctx)?.[0] ?? "";
    expect(body).toBeTruthy();
    expect(body).not.toMatch(/weeklyContext/);
    expect(body).toMatch(/settledTurns\(thread\)/);
  });
});

/* ── 2. the panel is honest about Live ───────────────────────────────────── */

/** The pre-fix `uses` list: message · profile+memory · turns · weekly. Nothing
 *  named the spoken path at all, so the typed claim stood over the mic. */
const OLD_USES_BLOCK = `              uses={[
                tcc("elev.coachcontract.uses.message"),
                ...coachDisclosure(...).uses,
                tcc("elev.coachcontract.uses.turns"),
                ...(weeklyOn ? [tcc("elev.coachcontract.uses.weekly")] : []),
              ]}`;
const NAMES_SPOKEN = /tcc\("elev\.coachcontract\.uses\.spoken"\)/;
const NAMES_LIVE_WHEN_AVAILABLE =
  /liveAvail \? \[tcc\("elev\.coachcontract\.uses\.spokenLive"\)\] : \[\]/;

describe("AI-02 — the data-contract panel names the spoken path", () => {
  it("negative control: neither regex matches the pre-fix uses list", () => {
    expect(NAMES_SPOKEN.test(OLD_USES_BLOCK)).toBe(false);
    expect(NAMES_LIVE_WHEN_AVAILABLE.test(OLD_USES_BLOCK)).toBe(false);
  });

  it("the panel states the spoken contract, and the Live one when Live is the path", () => {
    const uses = /uses=\{\[([\s\S]*?)\n {14}\]\}/.exec(coachSrc)?.[1] ?? "";
    expect(uses).toBeTruthy();
    expect(uses).toMatch(NAMES_SPOKEN);
    expect(uses).toMatch(NAMES_LIVE_WHEN_AVAILABLE);
  });
});

/* ── 3. the copy itself ──────────────────────────────────────────────────── */

describe("AI-02 — spoken-contract copy is present, honest and bilingual", () => {
  const KEYS = ["elev.coachcontract.uses.spoken", "elev.coachcontract.uses.spokenLive"] as const;

  it("both keys exist in EN and HE", () => {
    for (const key of KEYS) {
      expect(contractEn[key], `${key} missing in EN`).toBeTruthy();
      expect(contractHe[key], `${key} missing in HE`).toBeTruthy();
      expect(contractHe[key]).not.toBe(contractEn[key]); // really transcreated
    }
  });

  it("the module is REGISTERED, so its keys are in the firewall dictionary scan", () => {
    for (const key of KEYS) {
      expect(elevationEn[key]).toBe(contractEn[key]);
      expect(elevationHe[key]).toBe(contractHe[key]);
    }
  });

  it("the Live line states the LIMIT, never a memory or continuity claim", () => {
    const en = contractEn["elev.coachcontract.uses.spokenLive"];
    expect(en).toMatch(/does not carry/i);
    expect(en).toMatch(/memory facts/i);
    expect(en).toMatch(/earlier turns/i);
    // HE must carry the same negation, not a softened version.
    expect(contractHe["elev.coachcontract.uses.spokenLive"]).toMatch(/ולא/);
  });
});
