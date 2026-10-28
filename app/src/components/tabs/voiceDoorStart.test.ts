/**
 * B-VOICE-08 — a voice door outside the panel starts the conversation's ONE
 * Talk path inside the parent's tap; B-VOICE-02 — a card's own words are the
 * first spoken line, by text-to-speech only.
 *
 *  1. CoachTab registers its start only once the Live probe has answered (the
 *     tap then takes the right route), and the start IS toggleVoice, called
 *     synchronously: no second voice path, no timer, no await before it.
 *  2. The start refuses while voice is on (a second tap must never stop a
 *     talk), while a review is open, and while a notice handoff waits.
 *  3. The browser loop speaks the card's words before it listens; the words
 *     are never sent to the model and never written into the thread.
 *  4. The voice sheet names itself as AI in EN and HE (a door can open it
 *     before the composer's honesty line was on screen).
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import VoiceOverlay from "../coach/VoiceOverlay";
import { translate } from "../../lib/i18n";

const here = path.dirname(fileURLToPath(import.meta.url));
const strip = (code: string) =>
  code.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const COACH = strip(readFileSync(path.join(here, "CoachTab.tsx"), "utf8"));
const slice = (from: string, to: string) => {
  const start = COACH.indexOf(from);
  expect(start, from).toBeGreaterThan(-1);
  return COACH.slice(start, COACH.indexOf(to, start));
};

describe("B-VOICE-08 · the door's start is the conversation's own toggle", () => {
  const start = slice("const startFromDoor = (opening?: string): boolean => {", "const startFromDoorRef");

  it("registers only after the Live probe answered, and always calls the latest start", () => {
    expect(COACH).toMatch(/useEffect\(\(\) => \{\s*if \(!liveProbed\) return;\s*return registerConversationVoiceStarter\(\(opening\) => startFromDoorRef\.current\(opening\)\);\s*\}, \[liveProbed\]\);/);
    expect(COACH).toContain("startFromDoorRef.current = startFromDoor;");
  });

  it("starts through toggleVoice in the same call: no await, no timer, no new voice path", () => {
    expect(start).toContain("void toggleVoice();");
    expect(start).not.toMatch(/\bawait\b|setTimeout|requestAnimationFrame|startDictation|getUserMedia|startGeminiLive|liveToken/);
    // It answers whether a session began in this call (a notice or review may hold it).
    expect(start).toContain("const began = voiceLifetimeRef.current.current !== null && voiceLifetimeRef.current.current !== before;");
  });

  it("refuses while voice is on, a review is open or a notice handoff waits", () => {
    expect(start).toMatch(/if \(voicePhase !== "off" \|\| voiceReviewOpen \|\| readNoticeTalk\(\)\) return false;/);
    // negative control: a door that toggled while voice was on would STOP the talk
    expect("void toggleVoice();").not.toContain('voicePhase !== "off"');
  });
});

describe("B-VOICE-02 · the card's words are spoken first, never sent", () => {
  const browser = slice("const startBrowserVoice = () => {", "const toggleVoice = async");

  it("the browser loop speaks the opening, then listens when the queue drains", () => {
    expect(browser).toMatch(/const opening = openingLineRef\.current;\s*openingLineRef\.current = null;\s*if \(opening\) \{\s*voiceOnRef\.current = true;\s*streamDoneRef\.current = true;\s*enqueueSpeak\(opening\);\s*return;\s*\}\s*voiceOnRef\.current = true;\s*startListening\(\);/);
    // pumpTts: a drained queue after streamDone re-listens while hands-free is on.
    expect(COACH).toMatch(/if \(streamDoneRef\.current\) \{\s*streamDoneRef\.current = false;[\s\S]{0,200}if \(voiceOnRef\.current\) startListening\(\); else setVoicePhase\("off"\);/);
  });

  it("a Live session hears the line inside the tap; the browser loop holds it for its own queue", () => {
    const start = slice("const startFromDoor = (opening?: string): boolean => {", "const startFromDoorRef");
    expect(start).toContain("openingLineRef.current = line && !liveAvail ? line : null;");
    expect(start).toContain("if (line && liveAvail && ttsSupported()) speak(line);");
    expect(start).toContain("if (!began) { openingLineRef.current = null; return false; }");
  });

  it("the opening never reaches the model or the thread", () => {
    for (const writer of ["appendVoiceUserTurn(opening", "appendVoiceAiDelta(opening", "appendVoiceAiDelta(line", "streamVoiceTurn(opening", "streamVoiceTurn(line", "setChatInput(opening", "setChatInput(line"]) {
      expect(COACH, writer).not.toContain(writer);
    }
    // The voice sheet's caption stays the parent's words and the screened answer (AI-V7).
    expect(COACH).toContain("answerText={liveVoiceText}");
  });
});

describe("B-VOICE-08 · the voice sheet names itself as AI", () => {
  it.each(["en", "he"] as const)("%s: the approved Talk identity rides beside the phase", lang => {
    const html = renderToStaticMarkup(React.createElement(VoiceOverlay, {
      phase: "connecting", lang, interimText: "", answerText: "", canInterrupt: false, reducedMotion: true, onOrbTap: () => {}, onClose: () => {},
    }));
    expect(html).toContain('data-testid="voice-ai-identity"');
    expect(html).toContain(translate(lang, "elev.aihonesty.coachStatus"));
    expect(translate(lang, "elev.aihonesty.coachStatus")).toMatch(lang === "en" ? /\bAI\b/ : /בינה מלאכותית/);
  });
});
