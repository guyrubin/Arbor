/**
 * AI-V2(a) + AI-V7 — CoachTab voice wiring pins (house source-guard pattern;
 * the vitest env is node-only, so the React handlers are pinned structurally —
 * the decision table itself is behavior-tested in lib/voiceChipAction.test.ts,
 * the overlay in components/coach/VoiceOverlay.test.ts, interim partials in
 * lib/speech.interim.test.ts + lib/dictationLoop.test.ts, and Live barge-in in
 * lib/geminiLiveClient.interrupt.test.ts + lib/liveTurnGuard.test.ts).
 *
 * Pinned closed here:
 *  - the chip tap routes through voiceChipAction — speaking on the fallback
 *    loop INTERRUPTS instead of turning voice off;
 *  - bargeInVoice = flush TTS queue + stopSpeaking + abort the open stream +
 *    finalizeVoiceAiTurn + immediately startListening — and NEVER voice-off;
 *  - an aborted /voice stream does not double-restart listening (barge-in
 *    already did) — only genuine failures recover in the catch;
 *  - the overlay is OWNED by voicePhase !== "off", its captions carry only
 *    voiceInterim (parent's words) + liveVoiceText (screened output), and it
 *    opens no new entry point (orb tap can only barge in, X only stops).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const coach = stripComments(read("components/tabs/CoachTab.tsx"));

const bargeIn = /const bargeInVoice = \(\) => \{[\s\S]*?\n  \};/.exec(coach)?.[0] ?? "";
const toggle = /const toggleVoice = async \(\) => \{[\s\S]*?\n  \};/.exec(coach)?.[0] ?? "";
const overlay = /<VoiceOverlay[\s\S]*?\/>/.exec(coach)?.[0] ?? "";

describe("AI-V2(a) — chip tap = interrupt while speaking (fallback loop)", () => {
  it("toggleVoice decides via voiceChipAction and routes interrupt → bargeInVoice", () => {
    expect(toggle).toContain("voiceChipAction(voicePhase, Boolean(liveCtlRef.current))");
    expect(toggle).toMatch(/action === "interrupt"[\s\S]{0,80}bargeInVoice\(\)/);
  });

  it("bargeInVoice flushes the queue, cuts speech, aborts the stream, keeps the caption, resumes listening", () => {
    expect(bargeIn).toContain("ttsQueueRef.current = []");
    expect(bargeIn).toContain("ttsSpeakingRef.current = false");
    expect(bargeIn).toContain("streamDoneRef.current = false");
    expect(bargeIn).toContain("voiceAbortRef.current?.abort()");
    expect(bargeIn).toContain("stopSpeaking()");
    expect(bargeIn).toContain("finalizeVoiceAiTurn()");
    expect(bargeIn).toContain("startListening()");
  });

  it("barge-in keeps voice ON (double-tap parity: only stopVoice flips voiceOnRef off)", () => {
    expect(bargeIn).not.toContain("voiceOnRef.current = false");
    expect(bargeIn).not.toContain("stopVoice");
    expect(bargeIn).not.toContain('setVoicePhase("off")');
  });

  it("an ABORTED stream never double-restarts — only genuine failures recover in the catch", () => {
    expect(coach).toMatch(/catch \{[\s\S]{0,700}if \(ownsTurn\(\)\) \{[\s\S]{0,200}startListening\(\)/);
  });
});

describe("F-01 — the voice chip can never wedge into a dead button", () => {
  it("clearLiveRefs is the single Live-terminal cleanup (controller + render mirror)", () => {
    const clear = /const clearLiveRefs = \(\) => \{[\s\S]*?\n  \};/.exec(coach)?.[0] ?? "";
    expect(clear).toContain("liveCtlRef.current = null");
    expect(clear).toContain("setLiveSession(false)");
  });

  it("the onPhase 'closed' path clears the Live refs (the previously-missing terminal cleanup)", () => {
    const onPhase = /onPhase: \(p\) => \{[\s\S]*?\n              \},/.exec(coach)?.[0] ?? "";
    expect(onPhase).toMatch(/p === "closed"/);
    expect(onPhase).toContain("clearLiveRefs()");
    expect(onPhase).toContain('setVoicePhase("off")');
    // Late 'closed' reports — controller already cleared, or the browser
    // fallback loop running — must never stomp the fallback's phase.
    expect(onPhase).toMatch(/onPhase: \(p\) => \{\s*if \(!attempt\.isCurrent\(\)\) return;/);
    expect(onPhase).toContain("liveClosed = true");
    // Phase closure also precedes crisis/blocked render; only the explicit
    // ordinary remote-close callback may retire its owner at this point.
    expect(onPhase).not.toContain("attempt.end()");
  });

  it("toggleVoice from visual-idle clears stale refs and FALLS THROUGH to starting", () => {
    expect(toggle).toMatch(/if \(action !== "start"\) \{ stopVoice\(\); return; \}/);
    // The stale-ref branch clears but does NOT return — the tap keeps going,
    // paints the connecting state (S5), claims its attempt, and flows STRAIGHT
    // into the Live-availability branch.
    expect(toggle).toMatch(/if \(voiceOnRef\.current \|\| liveCtlRef\.current\) stopVoice\(\);\s*setVoicePhase\("connecting"\);\s*const attempt = voiceLifetimeRef\.current\.begin\(\);\s*let liveClosed = false;\s*if \(liveAvail\)/);
    // …so every idle-looking tap reaches the token mint or the browser loop.
    expect(toggle).toContain("api.liveToken(");
    expect(toggle).toMatch(/startBrowserVoice\(\);\s*\};\s*$/);
  });

  it("no bare catch on the Live start path — Paywall opens the paywall, everything else toasts", () => {
    expect(toggle).not.toMatch(/catch\s*\{/);
    expect(toggle).toContain("catch (err)");
    expect(toggle).toMatch(/err instanceof PaywallError[\s\S]{0,200}openPaywall\(/);
    expect(toggle).toContain('toast(t("coach.toast.voiceFallback"), "info")');
    expect(toggle).toContain("console.warn");
  });
});

describe("AI-V7 — the overlay is a surface, never an entry point", () => {
  it("VoiceOverlay renders ONLY while voicePhase !== 'off' (owned by the phase)", () => {
    expect(coach).toMatch(/\{voicePhase !== "off" && \(\s*<VoiceOverlay/);
  });

  it("captions carry the parent's interim words + the screened live answer only", () => {
    expect(overlay).toContain("interimText={voiceInterim}");
    expect(overlay).toContain("answerText={liveVoiceText}");
  });

  it("orb tap can only barge in on the fallback loop; X is stopVoice; nothing starts voice", () => {
    expect(overlay).toContain("canInterrupt={voicePhase === \"speaking\" && !liveSession}");
    expect(overlay).toMatch(/onOrbTap=\{\(\) => \{ if \(voicePhase === "speaking" && !liveCtlRef\.current && voiceOnRef\.current\) bargeInVoice\(\); \}\}/);
    expect(overlay).toContain("onClose={stopVoice}");
    expect(overlay).not.toContain("toggleVoice");
    expect(overlay).not.toContain("startBrowserVoice");
    expect(overlay).not.toContain("liveToken");
  });

  it("the dictation loop feeds interim partials into the overlay caption", () => {
    expect(coach).toContain("onInterim: (text) => { if (attempt.isCurrent()) setVoiceInterim(text); }");
    // Live path: input transcription (the parent's own words) accumulates too.
    expect(coach).toContain("setVoiceInterim((prev) => attempt.isCurrent() && !liveClosed ? (prev + delta).trimStart() : prev)");
    // The settled transcript clears the interim caption before the turn sends.
    expect(coach).toMatch(/onTranscript: \(text\) => \{\s*if \(!attempt\.isCurrent\(\)\) return;\s*setVoiceInterim\(""\);/);
  });
});

/**
 * S5 (2026-08-28 store-polish audit) — "Talk (HD) silently dead": the tap
 * minted a token and attempted the connect, then painted NOTHING for 13s+.
 * Root causes pinned closed here, extending the E4/F-01 visible-outcome pins:
 *  (1) no paint existed before the token-mint + dynamic-import awaits — the
 *      whole start window looked like a dead chip;
 *  (2) getUserMedia ran with NO deadline (before the connect deadline ever
 *      started) — a hung permission prompt/webview froze the start forever;
 *  (3) cancelling during the start window raced the in-flight promise chain —
 *      a lost-race session could re-open the overlay or zombie-start the loop.
 * Contract: EVERY tap paints synchronously (connecting), and every terminal
 * path — connect deadline, mic deadline, denied mic, unsupported speech,
 * quota/paywall, Live failure — ends on a visible surface (phase or toast).
 */
describe("S5 — every Talk tap paints a visible outcome", () => {
  const client = stripComments(read("lib/geminiLiveClient.ts"));
  const startListeningFn = /const startListening = \(\) => \{[\s\S]*?\n  \};/.exec(coach)?.[0] ?? "";

  it("the overlay (connecting state) paints SYNCHRONOUSLY on tap, before any await", () => {
    // Pinned order inside toggleVoice: paint → attempt claim → first await.
    const paintAt = toggle.indexOf('setVoicePhase("connecting")');
    const firstAwait = toggle.indexOf("await api.liveToken(");
    expect(paintAt).toBeGreaterThan(-1);
    expect(firstAwait).toBeGreaterThan(-1);
    expect(paintAt).toBeLessThan(firstAwait);
    // The overlay is owned by voicePhase !== "off", so "connecting" mounts it
    // (pinned above in AI-V7); the chip label paints the same state.
    expect(coach).toMatch(/voicePhase === "connecting" \? t\("coach\.voice\.connecting"\)/);
  });

  it("getUserMedia is deadline-bounded, and a late grant can't leave a hot mic", () => {
    expect(client).toMatch(/MIC_TIMEOUT_MS = 15_000/);
    expect(client).toContain('withDeadline(micRequest, MIC_TIMEOUT_MS, "live-mic-timeout", opts.signal)');
    // The lost-race grant stops its own tracks the moment it lands.
    expect(client).toContain("if (stopped) stopTracks(granted)");
    expect(client).toContain("track.stop()");
    // The connect deadline still guards the socket half (F-01, unchanged).
    expect(client).toContain("withConnectDeadline(Promise.race([connecting, failedBeforeOpen]), opts.signal)");
  });

  it("stop and unmount invalidate ownership before abort/cleanup; awaits cannot adopt stale starts", () => {
    expect(coach).toMatch(/const stopVoice = \(\) => \{\s*voiceLifetimeRef\.current\.cancel\(\);/);
    expect(coach).toMatch(/useEffect\(\(\) => \(\) => \{\s*voiceLifetimeRef\.current\.cancel\(\);/);
    expect(toggle).toMatch(/await api\.liveToken\([\s\S]{0,120}\);\s*if \(!attempt\.isCurrent\(\)\) return;/);
    expect(toggle).toContain("signal: attempt.signal");
    expect(toggle).toMatch(/if \(!attempt\.adopt\(ctl\)\) return;\s*liveCtlRef\.current = ctl;/);
    expect(toggle).toMatch(/if \(liveClosed\) \{ ctl\.stop\(\); attempt\.end\(\); return; \}/);
    expect(toggle).toMatch(/catch \(err\) \{\s*if \(!attempt\.isCurrent\(\)\) return;\s*clearLiveRefs\(\);/);
  });
  it("terminal path: quota/paywall ends visible (paywall opens, phase off)", () => {
    expect(toggle).toMatch(/err instanceof PaywallError[\s\S]{0,200}setVoicePhase\("off"\);\s*openPaywall\(/);
  });

  it("terminal path: Live start failure toasts AND falls back to the browser loop", () => {
    expect(toggle).toContain('toast(t("coach.toast.voiceFallback"), "info")');
    expect(toggle).toMatch(/startBrowserVoice\(\);\s*\};\s*$/);
  });

  it("terminal path: a post-open socket error STOPS the session before degrading", () => {
    // Previously onError only cleared the refs — mic + audio contexts stayed
    // hot with no controller left to stop them.
    expect(toggle).toMatch(/onError: \(\) => \{\s*if \(!attempt\.isCurrent\(\)\) return;\s*attempt\.end\(\);\s*clearLiveRefs\(\);\s*toast\(t\("coach\.toast\.voiceFallback"\), "info"\);\s*startBrowserVoice\(\);/);
  });

  it("fallback loop paints on its own surfaces: listening phase or an honest toast", () => {
    // (d) startListening paints the listening state synchronously, and the
    // unsupported-browser branch ends visible (toast + off), never silent.
    expect(startListeningFn).toMatch(/if \(!speechSupported\(\)\) \{ toast\(t\("coach\.toast\.voiceUnsupported"\), "info"\); voiceOnRef\.current = false; setVoicePhase\("off"\); return; \}\s*setVoicePhase\("listening"\);/);
    // Fatal dictation outcomes stop voice AND toast (mic denied / retries out).
    expect(startListeningFn).toMatch(/onFatal: \(reason\) => \{\s*if \(!attempt\.isCurrent\(\)\) return;\s*stopVoice\(\);\s*toast\(/);
    expect(startListeningFn).toContain('t("coach.toast.micPermission")');
    expect(startListeningFn).toContain('t("coach.toast.micRetryStopped")');
  });

  it("the connecting copy exists in BOTH languages (parity with the phase set)", () => {
    const i18n = read("lib/i18n.ts");
    expect(i18n.match(/"coach\.voice\.connecting":/g)?.length).toBe(2);
  });
});


describe("voice attempt wiring rejects stale callbacks BEFORE mutations", () => {
  const ownsFirst = (body: string) =>
    /^\s*if \(!attempt\.isCurrent\(\)(?: \|\| liveClosed)?\) (?:return;|throw )/.test(body);
  for (const name of ["onPhase", "onRemoteClose", "onError", "screenTurn", "onUserTurn", "onUserInterim", "onModelTurn", "onCrisis", "onBlocked", "onFailClosed"]) {
    it(name + " checks its captured owner before cleanup, captions, persistence or fallback", () => {
      const body = new RegExp(name + ": (?:async )?\\([^)]*\\) => \\{([\\s\\S]*?)\\n              \\}").exec(toggle)?.[1];
      expect(body, name + " callback must remain covered").toBeDefined();
      expect(ownsFirst(body!)).toBe(true);
    });
  }

  it("rejects the pre-fix error/catch ordering instead of pinning its regression", () => {
    expect(ownsFirst("liveCtlRef.current?.stop(); clearLiveRefs(); if (!attempt.isCurrent()) return;")).toBe(false);
    expect(ownsFirst("clearLiveRefs(); if (!attempt.isCurrent()) return;")).toBe(false);
  });

  it("rechecks safety results after await, and protects fallback events and stream ownership", () => {
    expect(toggle).toMatch(/const verdict = await api\.liveTurn\([\s\S]*?\);\s*if \(!attempt\.isCurrent\(\) \|\| liveClosed\) throw/);
    expect(coach).toContain("const ownsTurn = () => attempt.isCurrent() && !controller.signal.aborted && voiceAbortRef.current === controller");
    expect(coach).toMatch(/\(delta\) => \{\s*if \(!ownsTurn\(\)\) return;/);
    expect(coach).toMatch(/onEvent: \(event, data\) => \{\s*if \(!ownsTurn\(\)\) return;/);
    expect(coach).toContain("if (voiceAbortRef.current === controller) voiceAbortRef.current = null");
    expect(coach).toContain("attempt.isCurrent() ? [...current, ...checked].slice(-8) : current");
    expect(coach).toMatch(/speak\(next, \(\) => \{ if \(!attempt\.isCurrent\(\)\) return;/);
    expect(coach).toMatch(/const startBrowserVoice = \(\) => \{\s*voiceLifetimeRef\.current\.begin\(\);/);
  });

  it("crisis/blocked still render resources after current-attempt teardown, fail-closed still uses screened fallback", () => {
    expect(toggle).toContain("v.resourcesMarkdown ?? renderEscalationMarkdown(escalationMatchForCategory(v.category))");
    expect(toggle).toContain("if (v.blockedMarkdown) appendVoiceAiDelta(v.blockedMarkdown)");
    expect(toggle).toContain('toast(t("coach.toast.voiceStandardMode"), "info")');
    expect(toggle).toContain("screenTurn: async");
  });
});
