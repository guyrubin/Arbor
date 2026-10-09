/**
 * B-VOICE-06 — make the voice door findable (web).
 *
 *  1. Ask's Talk control says "Talk it through" / "לדבר על זה" (visible label
 *     and the chip's accessible name).
 *  2. The capture bar's Voice tile opens a choice: "Note something" (the
 *     capture sheet's dictation, onMode("voice") — unchanged) or "Talk it
 *     through" (the ONE conversation seam with voice: true, started by
 *     CoachTab through toggleVoice — no second voice path).
 *  3. The first use carries ONE line on what happens to the audio, with the
 *     existing Live residency line; 44 px targets; EN + HE.
 *  4. A spoken-conversation request is claimed once and only while fresh.
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VoiceChoice } from "./QuickCaptureBar";
import { translate, type UiLang } from "../../lib/i18n";
import {
  CONVERSATION_VOICE_REQUEST_TTL_MS,
  consumeConversationVoiceRequest,
  conversationVoiceRequestPending,
  requestCompanionConversation,
} from "../../lib/companionConversation";
import { VOICE_DOOR_NOTICE_KEY, markVoiceDoorNoticeSeen, voiceDoorNoticeSeen } from "../../lib/voiceDoor";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const strip = (code: string) =>
  code.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const BAR = strip(read("components/overview/QuickCaptureBar.tsx"));
const COACH = strip(read("components/tabs/CoachTab.tsx"));
const COMPOSER = strip(read("components/companion/CompanionComposer.tsx"));

const KEYS = [
  "elev.wave2Daily.capture.voice.choice",
  "elev.wave2Daily.capture.voice.note",
  "elev.wave2Daily.capture.voice.noteSub",
  "elev.wave2Daily.capture.voice.talk",
  "elev.wave2Daily.capture.voice.talkSub",
  "elev.wave2Daily.capture.voice.dataUse",
];

const choice = (lang: UiLang, firstUse: boolean) =>
  renderToStaticMarkup(
    <VoiceChoice id="vc" firstUse={firstUse} t={(k, v) => translate(lang, k, v)} onChoose={() => {}} onEscape={() => {}} />,
  );

describe("B-VOICE-06 · Ask's Talk control is named for what it does", () => {
  it("visible label and accessible name read 'Talk it through' / 'לדבר על זה'", () => {
    expect(translate("en", "companion.input.talk")).toBe("Talk it through");
    expect(translate("he", "companion.input.talk")).toBe("לדבר על זה");
    expect(translate("en", "coach.voice.talk")).toBe("Talk it through");
    expect(translate("he", "coach.voice.talk")).toBe("לדבר על זה");
    expect(translate("en", "coach.voice.talkHd")).toBe("Talk it through (HD)");
    expect(translate("he", "coach.voice.talkHd")).toBe("לדבר על זה (HD)");
    // The composer still renders the label from the key (no inline copy).
    expect(COMPOSER).toContain('inputText(language, "companion.input.talk")');
  });
});

describe("B-VOICE-06 · the Voice tile opens a choice between the two existing doors", () => {
  it("the Voice tile toggles the choice; photo still opens its mode directly", () => {
    expect(BAR).toContain('onClick={() => (key === "voice" ? setVoiceChoice((open) => !open) : onMode(key))}');
    expect(BAR).toContain('aria-expanded={key === "voice" ? voiceChoice : undefined}');
  });

  it("'Note something' is the capture sheet's dictation; 'Talk it through' is the conversation seam asked to talk", () => {
    const choose = BAR.slice(BAR.indexOf("const chooseVoice"), BAR.indexOf("const tiles ="));
    expect(choose).toContain('if (door === "note") onMode("voice");');
    expect(choose).toContain('else requestCompanionConversation({ source: "capture-voice", voice: true });');
    // No new voice path in the bar: it never touches the microphone itself.
    expect(BAR).not.toMatch(/startDictation|getUserMedia|SpeechRecognition|startGeminiLive|liveToken/);
  });

  it("CoachTab never opens the microphone from the request: it focuses Talk and invites the tap", () => {
    expect(COACH).toMatch(/if \(!visible \|\| !liveProbed \|\| !conversationVoiceRequestPending\(\)\) return;\s*if \(consumeConversationVoiceRequest\(\) && voicePhase === "off"\) \{\s*setVoiceInvite\(true\);/);
    const effect = COACH.slice(COACH.indexOf("if (!visible || !liveProbed"), COACH.indexOf("}, [visible, liveProbed, voiceAsk]);"));
    expect(effect).not.toContain("toggleVoice()");
    expect(effect).toContain('.companion-live-button"))?.focus()');
    expect(COACH).toContain('data-testid="voice-door-invite"');
    expect(COACH).toContain(".finally(() => { if (!cancelled) setLiveProbed(true); })");
    // negative control: the pre-fix auto-start fails the same rule
    expect('if (consumeConversationVoiceRequest() && voicePhase === "off") void toggleVoice();').toContain("toggleVoice()");
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: both doors render with their labels, ≥ 44 px each`, () => {
      const html = choice(lang, false);
      expect(html).toContain('role="group"');
      expect(html).toContain(`aria-label="${translate(lang, "elev.wave2Daily.capture.voice.choice")}"`);
      for (const door of ["note", "talk"]) {
        const btn = new RegExp(`<button[^>]*data-voice-choice="${door}"[^>]*class="[^"]*min-h-11`);
        expect(html, door).toMatch(btn);
      }
      expect(html).toContain(translate(lang, "elev.wave2Daily.capture.voice.note"));
      expect(html).toContain(translate(lang, "elev.wave2Daily.capture.voice.talk"));
      expect(html).not.toContain('data-testid="capture-voice-data-use"');
    });
  }
});

describe("B-VOICE-06 · first use: one line on what happens to the audio", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: the line names transcription, who processes it, and the Live residency`, () => {
      const html = choice(lang, true);
      expect((html.match(/data-testid="capture-voice-data-use"/g) ?? []).length).toBe(1);
      const line = translate(lang, "elev.wave2Daily.capture.voice.dataUse", {
        residency: translate(lang, "elev.coachcontract.uses.liveResidencyUndated"),
      });
      expect(line).toContain(translate(lang, "elev.coachcontract.uses.liveResidencyUndated"));
      expect(line).not.toContain("{residency}");
      expect(line).toContain("Google");
      if (lang === "en") {
        expect(line).toMatch(/No recording is kept/);
        expect(line).toMatch(/speech service/);
      }
    });
  }

  it("every new string exists in EN and HE, the Hebrew is not the English, and HE never writes the Latin brand", () => {
    for (const k of KEYS) {
      const en = translate("en", k);
      const he = translate("he", k);
      expect(en, k).not.toBe(k);
      expect(he, k).not.toBe(en);
      expect(he, k).not.toMatch(/\bArbor\b/);
    }
    expect(translate("he", "elev.wave2Daily.capture.voice.talkSub")).toContain("ארבור");
  });

  it("the notice persists per device; a storage failure shows it again (never hides it)", () => {
    const store = new Map<string, string>();
    const fake = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(voiceDoorNoticeSeen(fake)).toBe(false);
    markVoiceDoorNoticeSeen(fake);
    expect(store.get(VOICE_DOOR_NOTICE_KEY)).toBe("1");
    expect(voiceDoorNoticeSeen(fake)).toBe(true);
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(voiceDoorNoticeSeen(broken)).toBe(false);
    expect(() => markVoiceDoorNoticeSeen(broken)).not.toThrow();
    expect(voiceDoorNoticeSeen(null)).toBe(false);
  });
});

describe("B-VOICE-06 · a spoken-conversation request is claimed once, only while fresh", () => {
  it("fresh → claimed once; a plain open never asks for the microphone", () => {
    consumeConversationVoiceRequest();
    requestCompanionConversation({ source: "test" }, 1_000);
    expect(conversationVoiceRequestPending()).toBe(false);
    requestCompanionConversation({ source: "capture-voice", voice: true }, 1_000);
    expect(conversationVoiceRequestPending()).toBe(true);
    expect(consumeConversationVoiceRequest(1_000 + 500)).toBe(true);
    expect(consumeConversationVoiceRequest(1_000 + 600)).toBe(false);
  });

  it("negative control: a stale request is dropped, not started later", () => {
    requestCompanionConversation({ source: "capture-voice", voice: true }, 1_000);
    expect(consumeConversationVoiceRequest(1_000 + CONVERSATION_VOICE_REQUEST_TTL_MS + 1)).toBe(false);
    expect(conversationVoiceRequestPending()).toBe(false);
  });
});
