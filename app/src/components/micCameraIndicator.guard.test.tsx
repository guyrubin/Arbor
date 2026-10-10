/**
 * B-STATUS-02 — mic and camera states follow one rule.
 *
 * Every PARENT surface that opens the microphone or the camera shows the
 * REC-01 indicator (components/ui/RecordingIndicator: the pulsing dot, the word
 * "Recording", m:ss) in the same component. Ask's voice overlay keeps its orb
 * and gains the same signal as one line (RecordingLine, "Recording · m:ss"),
 * mounted by CoachTab while the microphone is open.
 *
 * What counts as "opens the microphone or camera": a call to the dictation
 * seam (`startDictation(`), the fallback voice loop (`createDictationLoop(`),
 * the Live client (`startGeminiLive(`) or `getUserMedia(` itself. lib/ holds
 * the mechanisms (speech.ts, dictationLoop.ts, geminiLiveClient.ts); a SURFACE
 * is the component that calls them, so the walk covers components/ and hooks/.
 *
 * Kid register keeps its own treatment: the allow-list below names each file
 * and why. Files may only ever LEAVE it; nothing outside components/practice/
 * or components/kidmode/ may be on it.
 */
import React from "react";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import VoiceOverlay from "./coach/VoiceOverlay";
import { RecordingLine } from "./ui/RecordingIndicator";
import { translate } from "../lib/i18n";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const strip = (code: string) =>
  code.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}
const rel = (full: string) => path.relative(SRC, full).split(path.sep).join("/");

/** A call that opens the microphone or the camera. */
const OPENS_MEDIA = /\bstartDictation\s*\(|\bcreateDictationLoop\s*\(|\bstartGeminiLive\s*\(|\bgetUserMedia\s*\(/;
/** The REC-01 indicator (full) or its one-line form. */
const INDICATOR = /<RecordingIndicator\b|<RecordingLine\b/;

/**
 * Kid register — these keep their own treatment (do not add the parent
 * indicator; the child is the one in front of them).
 */
const KID_REGISTER: ReadonlyMap<string, string> = new Map([
  // Mimic Studio's mirror: front camera, local-only, a kid game that plays in
  // `.arbor-play` under Kid Mode (its parent door says "nothing is recorded").
  ["components/practice/MimicStudioTab.tsx", "Mimic Studio mirror (kid game)"],
  ["components/practice/MimicMatch.tsx", "Mimic Match mirror (kid game inside Mimic Studio)"],
  // Sound Lab / Speech Coach: the child's practice microphone, kid register
  // with its own listening states and parent consent gate.
  ["components/practice/SpeechCoachTab.tsx", "Sound Lab / Speech Coach (kid game)"],
]);
const kidRegister = (file: string) => KID_REGISTER.has(file) || file.startsWith("components/kidmode/");

/**
 * A parent surface whose indicator lives in the overlay it mounts for that
 * state: CoachTab opens the microphone for Ask's spoken conversation and
 * VoiceOverlay (its child) carries "Recording · m:ss" — passed `recording`
 * while the microphone is open.
 */
const DELEGATES: Readonly<Record<string, { child: string; mount: RegExp }>> = {
  "components/tabs/CoachTab.tsx": {
    child: "components/coach/VoiceOverlay.tsx",
    mount: /<VoiceOverlay[\s\S]*?recording=\{voicePhase === "listening" \|\| liveSession\}[\s\S]*?\/>/,
  },
};

/** The rule, as a function so the negative control exercises the same code. */
function missingIndicator(file: string, code: string, readChild: (rel: string) => string = (r) => strip(read(r))): boolean {
  if (!OPENS_MEDIA.test(code) || kidRegister(file)) return false;
  if (INDICATOR.test(code)) return false;
  const delegate = DELEGATES[file];
  return !(delegate && delegate.mount.test(code) && INDICATOR.test(readChild(delegate.child)));
}

const FILES = [...walk(path.join(SRC, "components")), ...walk(path.join(SRC, "hooks"))].map((full) => ({
  file: rel(full),
  code: strip(readFileSync(full, "utf8")),
}));
const CALLERS = FILES.filter((f) => OPENS_MEDIA.test(f.code)).map((f) => f.file).sort();

describe("B-STATUS-02 · one rule for the microphone and camera", () => {
  it("the walk finds the known callers (the matcher is not blind)", () => {
    for (const known of [
      "components/companion/CompanionComposer.tsx",
      "components/overview/QuickLogModal.tsx",
      "components/tabs/CoachTab.tsx",
      "components/practice/SpeechCoachTab.tsx",
    ]) expect(CALLERS, known).toContain(known);
  });

  it("every parent caller shows the REC-01 indicator in the same component (or its declared overlay)", () => {
    const offenders = FILES.filter((f) => missingIndicator(f.file, f.code)).map((f) => f.file);
    expect(offenders, `mic/camera opened with no indicator: ${offenders.join(", ")}`).toEqual([]);
  });

  it("the kid-register allow-list is exact: every entry still opens media, and only practice/ or kidmode/ files sit on it", () => {
    for (const file of KID_REGISTER.keys()) {
      expect(file.startsWith("components/practice/") || file.startsWith("components/kidmode/"), file).toBe(true);
      expect(CALLERS, `${file} no longer opens media — remove it from the allow-list`).toContain(file);
    }
  });

  it("each parent caller's indicator is gated on the live state (real presence, never decoration)", () => {
    expect(strip(read("components/companion/CompanionComposer.tsx"))).toMatch(/\{listening && <RecordingIndicator /);
    expect(strip(read("components/overview/QuickLogModal.tsx"))).toMatch(/\{listening && \(\s*<div className="mb-4">\s*<RecordingIndicator/);
    expect(strip(read("components/tabs/BehaviorsTab.tsx"))).not.toMatch(OPENS_MEDIA);
    expect(strip(read("components/coach/VoiceOverlay.tsx"))).toMatch(/\{recording && \(\s*<div className="mt-2">\s*<RecordingLine/);
  });
});

describe("B-STATUS-02 · Ask's overlay keeps its orb and gains 'Recording · m:ss'", () => {
  const overlay = (recording: boolean, lang: "en" | "he" = "en") =>
    renderToStaticMarkup(
      <VoiceOverlay phase="listening" lang={lang} interimText="" answerText="" canInterrupt={false} reducedMotion={false} recording={recording} onOrbTap={() => {}} onClose={() => {}} />,
    );

  it("while the microphone is open: the orb is still there, plus the Recording line with m:ss", () => {
    const html = overlay(true);
    expect(html).toContain('data-orb-mode="pulse"');
    expect(html).toContain('data-testid="voice-recording-line"');
    expect(html).toMatch(/data-testid="voice-recording-line"[\s\S]*?>Recording<[\s\S]*?data-testid="voice-recording-line-time"[^>]*>0:00</);
    expect(html).toContain("var(--arbor-danger)");
    expect(overlay(true, "he")).toContain(`>${translate("he", "elev.rec.on")}<`);
  });

  it("with the microphone closed the line is absent", () => {
    expect(overlay(false)).not.toContain("voice-recording-line");
  });

  it("the line's clock is hidden from screen readers (no number read every second)", () => {
    const html = renderToStaticMarkup(<RecordingLine label="Recording" testId="t" />);
    expect(html).toMatch(/aria-hidden="true"[^>]*data-testid="t-time"/);
  });
});

describe("negative control", () => {
  it("a parent file that opens the microphone without the indicator is caught", () => {
    const bare = `const stop = startDictation({ onResult }, "en-US");\nreturn <button onClick={stop}>Stop</button>;`;
    expect(missingIndicator("components/tabs/NewTab.tsx", bare)).toBe(true);
    const camera = `const s = await navigator.mediaDevices.getUserMedia({ video: true });`;
    expect(missingIndicator("components/profile/NewCamera.tsx", camera)).toBe(true);
    // The same code WITH the indicator passes; a kid-register file is exempt.
    expect(missingIndicator("components/tabs/NewTab.tsx", `${bare}\n{listening && <RecordingIndicator interim="" />}`)).toBe(false);
    expect(missingIndicator("components/kidmode/NewGame.tsx", bare)).toBe(false);
    // A delegate that stops passing `recording` to its overlay is caught.
    expect(missingIndicator("components/tabs/CoachTab.tsx", `createDictationLoop({});\n<VoiceOverlay phase={voicePhase} />`)).toBe(true);
  });
});
