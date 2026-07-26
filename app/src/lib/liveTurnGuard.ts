/**
 * liveTurnGuard (VC-1 + VC-2 + VC-3 + VC-5, 2026-07-25 AI-excellence Wave 1) —
 * the fail-closed safety spine between Gemini Live and the parent's speakers.
 *
 * CONTRACT (firewall CONDITIONS, verbatim intent):
 *  - Every model audio chunk is BUFFERED per model turn and released ONLY after
 *    (a) the synchronous lexical pass (`screenLexical` — the shared
 *    outputScreenLexical floor) on the turn's full output transcription, AND
 *    (b) the authoritative SERVER verdict from POST /api/live/turn
 *    (`screenTurn`) returns action "continue". The async verdict is never
 *    optimistic (VC-5): a network error, non-200, or ~3s timeout is treated as
 *    FLAGGED — buffered audio dropped, session halted, visible degrade.
 *  - Transcription absence = unscreened = never release (VC-1 condition 1): if
 *    output transcription stops arriving while audio is buffered (watchdog) or
 *    a turn completes with audio but no transcript, the session closes.
 *  - User turns are screened server-side by screenForImmediateEscalation via
 *    the SAME endpoint (VC-2); on stop_crisis the session is halted BEFORE any
 *    rendering callback runs.
 *  - `deps.halt()` (closing the Live session) always runs BEFORE onCrisis /
 *    onBlocked / onFailClosed, so no in-flight model audio can outlive a stop.
 *  - There is NO catch-and-continue branch: every rejection path funnels into
 *    `failClosed`, and the single `deps.sink` call site sits behind the
 *    lexical-pass + server-"continue" release gate (structural test pins this).
 *
 * Pure module: no DOM, no audio, no fetch — everything is injected, so the
 * whole state machine is unit-testable in node.
 */

export type LiveTurnRole = "user" | "model";

/** Server verdict shape from POST /api/live/turn (routes/api.ts). */
export type LiveTurnVerdict = {
  action: "continue" | "stop_crisis" | "stop_blocked";
  category?: string;
  /** renderEscalationMarkdown(match) VERBATIM (crisis resources, real numbers). */
  resourcesMarkdown?: string;
  /** renderBlockedOutputMarkdown() (visible blocked state, /chat parity). */
  blockedMarkdown?: string;
  /** Short localized line to speak via the existing speak() seam. */
  spokenText?: string;
};

export type LexicalVerdict = {
  flagged: boolean;
  category: string | null;
  /** VC-8: set when category === "crisis" — which escalation resource set applies. */
  escalationCategory?: string;
};

export type LiveTurnGuardDeps = {
  /** POST /api/live/turn — MUST reject on network error / non-200. */
  screenTurn: (role: LiveTurnRole, text: string) => Promise<LiveTurnVerdict>;
  /** The shared synchronous lexical floor (safety/outputScreenLexical). */
  screenLexical: (text: string) => LexicalVerdict;
  /** The ONLY path to audio playback (playChunk stays module-private). */
  sink: (b64Audio: string) => void;
  /** Close the Live session NOW. Always invoked before any render callback. */
  halt: () => void;
  /** A screened user transcript (persist via the COACH-2 appendVoiceUser seam). */
  onUserTurn?: (text: string) => void;
  /** A released (screened) model transcript (persist via applyVoiceDelta/settle). */
  onModelTurn?: (text: string) => void;
  /** Crisis stop: session already halted; render resources + spoken redirect. */
  onCrisis?: (verdict: LiveTurnVerdict) => void;
  /** Blocked output: session already halted; render the blocked state. */
  onBlocked?: (verdict: LiveTurnVerdict) => void;
  /** VC-5 fail-closed degrade: session already halted; caller shows the visible
   *  notice and starts the screened browser voice loop. */
  onFailClosed?: (reason: string) => void;
  /** AI-V2(b): stop already-released playback NOW (retained sources + playHead
   *  reset live sink-side; the guard drives them so barge-in handling stays
   *  behind the guard — playChunk remains module-private). */
  onInterrupt?: () => void;
  /** Server-verdict deadline (default 3000ms). */
  timeoutMs?: number;
  /** Output-transcription watchdog while audio is buffered (default 5000ms). */
  transcriptionSilenceMs?: number;
};

export type LiveTurnGuard = {
  /** Buffer a model audio chunk (never played until the turn's screens pass). */
  pushAudio(b64Audio: string): void;
  /** Accumulate the model turn's output transcription. */
  pushOutputTranscription(text: string): void;
  /** Accumulate the parent's input transcription. */
  pushInputTranscription(text: string): void;
  /** Model turn completed — screen and (only on a full pass) release. */
  endModelTurn(): Promise<void>;
  /** AI-V2(b): server VAD barge-in (serverContent.interrupted) — drop the
   *  in-flight turn's unreleased buffer and stop released playback via
   *  deps.onInterrupt. The session stays OPEN (the parent is talking). */
  interrupt(): void;
  /** Tear down (session closed externally). */
  dispose(): void;
  readonly halted: boolean;
};

const TIMEOUT = Symbol("live-turn-timeout");

export function createLiveTurnGuard(deps: LiveTurnGuardDeps): LiveTurnGuard {
  const timeoutMs = deps.timeoutMs ?? 3000;
  const silenceMs = deps.transcriptionSilenceMs ?? 5000;

  let halted = false;
  let pendingAudio: string[] = [];
  let turnTranscript = "";
  let userTranscript = "";
  let userScreens: Promise<void>[] = [];
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;

  const clearSilenceTimer = () => {
    if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
  };

  const dropBuffers = () => {
    pendingAudio = [];
    turnTranscript = "";
    userTranscript = "";
    clearSilenceTimer();
  };

  /** The ONE stop path: drop everything, close the session, THEN notify. */
  const stopWith = (notify?: () => void) => {
    if (halted) return;
    halted = true;
    dropBuffers();
    deps.halt();
    notify?.();
  };

  const failClosed = (reason: string) => stopWith(() => deps.onFailClosed?.(reason));

  /** VC-5: the verdict may never be optimistic — timeout counts as FLAGGED. */
  const screenWithDeadline = (role: LiveTurnRole, text: string): Promise<LiveTurnVerdict> =>
    new Promise<LiveTurnVerdict>((resolve, reject) => {
      const timer = setTimeout(() => reject(TIMEOUT), timeoutMs);
      deps.screenTurn(role, text).then(
        (v) => { clearTimeout(timer); resolve(v); },
        (e) => { clearTimeout(timer); reject(e); },
      );
    });

  /** VC-1 condition 1: buffered audio with no transcription must never wait
   *  forever for a screen that can't run — close the session instead. */
  const armSilenceWatchdog = () => {
    clearSilenceTimer();
    silenceTimer = setTimeout(() => failClosed("transcription-missing"), silenceMs);
  };

  /** VC-2: the parent's finalized words go to the server escalation screen.
   *  The turn is persisted immediately (same ordering as the browser loop);
   *  a stop_crisis verdict halts the session before any rendering. */
  const flushUserTurn = () => {
    const text = userTranscript.trim();
    userTranscript = "";
    if (!text || halted) return;
    deps.onUserTurn?.(text);
    userScreens.push(
      screenWithDeadline("user", text).then(
        (verdict) => {
          if (halted) return;
          if (verdict.action === "stop_crisis") {
            stopWith(() => deps.onCrisis?.(verdict));
          } else if (verdict.action !== "continue") {
            stopWith(() => deps.onBlocked?.(verdict));
          }
        },
        () => failClosed("screen-unavailable"),
      ),
    );
  };

  return {
    get halted() { return halted; },

    pushAudio(b64Audio: string) {
      if (halted) return;
      flushUserTurn();
      pendingAudio.push(b64Audio);
      // Audio without any transcription yet → the watchdog is the only screen.
      if (!turnTranscript && !silenceTimer) armSilenceWatchdog();
    },

    pushOutputTranscription(text: string) {
      if (halted || !text) return;
      flushUserTurn();
      turnTranscript += text;
      // Transcription is flowing — re-arm so a MID-turn stall still trips.
      if (pendingAudio.length) armSilenceWatchdog();
      else clearSilenceTimer();
    },

    pushInputTranscription(text: string) {
      if (halted || !text) return;
      userTranscript += text;
    },

    async endModelTurn() {
      if (halted) return;
      clearSilenceTimer();
      flushUserTurn();
      const audio = pendingAudio;
      const transcript = turnTranscript.trim();
      pendingAudio = [];
      turnTranscript = "";

      // Wait for any in-flight user verdict first — a crisis in the parent's
      // words must win over releasing the model's answer to them.
      const inFlight = userScreens;
      userScreens = [];
      await Promise.all(inFlight).catch(() => { /* already failClosed'd */ });
      if (halted) return;

      if (!audio.length && !transcript) return; // empty turn — nothing to screen
      if (audio.length && !transcript) {
        // VC-1 condition 1: audio arrived but transcription never did.
        failClosed("transcription-missing");
        return;
      }

      // (a) the synchronous lexical floor — shared with the server, byte-equal.
      const lexical = deps.screenLexical(transcript);
      if (lexical.flagged) {
        // Fire the server screen too so the turn is still AUDITED server-side
        // (VC-3: every turn logged) — but the block does not depend on it.
        deps.screenTurn("model", transcript).catch(() => { /* audit-only */ });
        // VC-8: a crisis-category lexical hit takes the CRISIS stop path
        // (onCrisis renders crisis resources), never the generic blocked
        // state. The verdict carries the escalation category so the caller
        // can render the matching resources locally (safety/escalation is a
        // pure shared module) without waiting on the server round-trip.
        if (lexical.category === "crisis") {
          stopWith(() =>
            deps.onCrisis?.({ action: "stop_crisis", category: lexical.escalationCategory ?? "caregiver_distress" }),
          );
          return;
        }
        stopWith(() => deps.onBlocked?.({ action: "stop_blocked", category: lexical.category ?? undefined }));
        return;
      }

      // (b) the authoritative server verdict — never optimistic (VC-5).
      let verdict: LiveTurnVerdict;
      try {
        verdict = await screenWithDeadline("model", transcript);
      } catch {
        failClosed("screen-unavailable");
        return;
      }
      if (halted) return;
      if (verdict.action === "stop_crisis") {
        stopWith(() => deps.onCrisis?.(verdict));
        return;
      }
      if (verdict.action !== "continue") {
        stopWith(() => deps.onBlocked?.(verdict));
        return;
      }

      // Full pass: release the buffered audio IN ORDER — the single sink site.
      for (const chunk of audio) deps.sink(chunk);
      deps.onModelTurn?.(transcript);
    },

    interrupt() {
      if (halted) return;
      // The interrupted model turn will never complete — its buffered audio
      // was never screened and must never play. The parent's input
      // transcription keeps accumulating (they are the one talking).
      pendingAudio = [];
      turnTranscript = "";
      clearSilenceTimer();
      // Sink-side: stop retained (already-released, i.e. already-screened)
      // sources and reset the schedule head. Routed through the guard so
      // playback control has exactly one owner.
      deps.onInterrupt?.();
    },

    dispose() {
      halted = true;
      dropBuffers();
    },
  };
}
