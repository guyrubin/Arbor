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
 *  3. A card's words play BEFORE the microphone opens, on Live and on the
 *     browser loop; the session starts only after them (or a skip), and they
 *     are never sent to the model nor written into the thread.
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
  const start = slice("const startFromDoor = (opening?: string): boolean => startDoor(opening, {", "});");

  it("registers only after the Live probe answered, and always calls the latest start", () => {
    expect(COACH).toMatch(/useEffect\(\(\) => \{\s*if \(!liveProbed\) return;\s*return registerConversationVoiceStarter\(\(opening\) => startFromDoorRef\.current\(opening\)\);\s*\}, \[liveProbed\]\);/);
    expect(COACH).toContain("startFromDoorRef.current = startFromDoor;");
  });

  it("the decision is lib/voiceOpening startDoor (tested as it runs); its toggle is toggleVoice, its attempt the voice lifetime", () => {
    expect(start).toContain("toggle: () => { void toggleVoice(); },");
    expect(start).toContain("attempt: () => voiceLifetimeRef.current.current,");
    expect(start).toContain("playWords: playOpening,");
    expect(start).toContain("canSpeak: ttsSupported,");
    expect(start).not.toMatch(/\bawait\b|setTimeout|requestAnimationFrame|startDictation|getUserMedia|startGeminiLive|liveToken/);
  });

  it("refuses while voice is on, a review is open or a notice handoff waits", () => {
    expect(start).toContain('busy: () => voicePhase !== "off" || voiceReviewOpen || !!readNoticeTalk() || !conversationShown(),');
    // negative control: a door that toggled while voice was on would STOP the talk
    expect("void toggleVoice();").not.toContain('voicePhase !== "off"');
  });
});

describe("B-VOICE-02 · the card's words are spoken BEFORE the microphone opens, on every route", () => {
  const words = slice("const playOpening = (line: string) => {", "const startFromDoor = ");
  const browser = slice("const startBrowserVoice = () => {", "const toggleVoice = async");

  it("with words: paint \"speaking\" in the tap and run the opening; no toggle, no microphone, no route choice inside it", () => {
    expect(words).toContain('setVoicePhase("speaking");');
    expect(words).toContain("openingRunRef.current = runOpening(line, {");
    expect(words).not.toMatch(/toggleVoice|startListening|startBrowserVoice|liveAvail|liveToken|getUserMedia/);
  });

  it("the session starts only from the opening's end (or skip): the next render calls the ONE toggle", () => {
    expect(words).toMatch(/onDone: \(\) => \{\s*if \(openingTokenRef\.current !== token\) return;[\s\S]*setVoicePhase\("off"\);\s*setStartAfterOpening\(\(n\) => n \+ 1\);/);
    expect(COACH).toMatch(/useEffect\(\(\) => \{\s*if \(!startAfterOpening\) return;\s*if \(!visibleRef\.current \|\| !conversationShown\(\)\) return;\s*void toggleVoice\(\);/);
  });

  it("the browser loop no longer speaks anything before it listens (the Live-refused fallback cannot hear the card)", () => {
    expect(browser).toMatch(/voiceLifetimeRef\.current\.begin\(\);\s*clearLiveRefs\(\);\s*voiceOnRef\.current = true;\s*startListening\(\);/);
    expect(COACH).not.toContain("openingLineRef");
  });

  it("round 3: every stop cancels the words synchronously, before the engine is told to stop, and a hidden conversation starts nothing", () => {
    // stopVoice is what X, the panel hiding and a new thread all call.
    expect(COACH).toMatch(/const stopVoice = \(review = true\) => \{\s*const reviewAttempt = voiceLifetimeRef\.current\.current;\s*voiceLifetimeRef\.current\.cancel\(\);\s*cancelOpening\(\);/);
    const stop = slice("const stopVoice = (review = true) => {", "const bargeInVoice = ");
    expect(stop.indexOf("cancelOpening();")).toBeLessThan(stop.indexOf("stopSpeaking();"));
    const cancel = slice("const cancelOpening = () => {", "const stopVoice = ");
    expect(cancel).toMatch(/openingTokenRef\.current = null;\s*const run = openingRunRef\.current;\s*openingRunRef\.current = null;\s*run\?\.cancel\(\);/);
    expect(COACH).toMatch(/useEffect\(\(\) => \{ if \(!visible\) stopVoice\(false\); \}, \[visible\]\);/);
    expect(COACH).toMatch(/useEffect\(\(\) => \{ stopVoice\(false\); \}, \[conversationRevision\]\);/);
    // The start after the words, and the door itself, refuse a hidden conversation.
    expect(COACH).toMatch(/if \(!startAfterOpening\) return;\s*if \(!visibleRef\.current \|\| !conversationShown\(\)\) return;\s*void toggleVoice\(\);/);
    expect(COACH).toContain('busy: () => voicePhase !== "off" || voiceReviewOpen || !!readNoticeTalk() || !conversationShown(),');
    expect(COACH).toContain("useEffect(() => () => { openingTokenRef.current = null; openingRunRef.current?.cancel(); }, []);");
  });

  it("the words show as the caption while they play, and a tap on the orb skips them", () => {
    expect(COACH).toContain("answerText={liveVoiceText || openingCaption}");
    expect(COACH).toContain("onOrbTap={() => { if (openingRunRef.current?.skip()) return;");
  });

  it("the opening never reaches the model or the thread", () => {
    for (const writer of ["appendVoiceUserTurn(line", "appendVoiceAiDelta(line", "streamVoiceTurn(line", "setChatInput(line", "enqueueSpeak(line"]) {
      expect(COACH, writer).not.toContain(writer);
    }
  });

  it("B-PROV-12 merge note: the words play whether or not the toggle then starts (a notice or a review may hold it), and nothing retries", () => {
    // The opening owns its own lifetime (no voiceLifetime attempt), so a held toggle can't drop the words and X never opens a review for them.
    expect(words).not.toContain("voiceLifetimeRef");
    const effect = COACH.slice(COACH.indexOf("if (!startAfterOpening) return;"), COACH.indexOf("}, [startAfterOpening]);"));
    expect(effect).not.toMatch(/setStartAfterOpening|setTimeout|while|for \(/);
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
