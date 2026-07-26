import React, { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
// Directional glyphs are RTL-aware: the caller already picks the start/end
// variant by uiLang (he ⇒ left, otherwise right), so the Material Symbols
// <Icon> stays correct in both directions. All icons use the shared <Icon>
// (Material Symbols) for the UC-2 visual-match.
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { Avatar } from "../ui/Avatar";
import { ArborMascot } from "../ui/ArborMascot";
import { scholarsInfo } from "../../initialData";
import { MarkdownBlock } from "../ui/MarkdownBlock";
import { TrustSafetyBar, cardCls } from "../ui/kit";
import { T } from "../../lib/tokens";
import CoachAnswerCards from "../coach/CoachAnswerCards";
import { ShareButton } from "../ui/ShareButton";
import { EvidenceChip } from "../ui/EvidenceChip";
import ArborVision from "../coach/ArborVision";
import { api, streamVoice, getAiLanguage, EscalationRequiredError } from "../../lib/api";
import { normalizeExtractedLog } from "../../content/behaviorTaxonomy";
import { handleVoiceDone } from "../../lib/voiceSafetyEvents";
import type { BehaviorContext } from "../../types";
import type { ChatMessage } from "../../context/ArborContext";
import { startDictation, speechSupported } from "../../lib/speech";
// AI-V2(a): the chip/orb tap contract (start / interrupt / stop) is a pure
// tested decision function — while Arbor speaks on the fallback loop a tap
// INTERRUPTS (voice stays on); a second tap during listening turns voice off.
import { voiceChipAction } from "../../lib/voiceChipAction";
// AI-V7: the calm bottom-sheet voice surface (orb + live captions), owned by
// voicePhase !== "off". The chip below stays the ONLY entry point.
import VoiceOverlay from "../coach/VoiceOverlay";
// AI-V3: recognition restart with backoff + circuit breaker lives in the pure
// dictation loop, so the phase label is always truthful (see lib/dictationLoop).
import { createDictationLoop, type DictationLoop } from "../../lib/dictationLoop";
import { splitCompleteSentences } from "../../lib/sentenceStream";
// ASK-7: thread-shape predicates — orientation/follow-up/trust guards key off
// real user/AI turns, never message-count checks (the welcome bubble is gone).
import { hasUserTurn, hasAiTurn } from "../../lib/chatStream";
import { publishedHardMomentCards } from "../../content/hardMomentCards";
import { buildHardMomentSeedPrompt, locText } from "../../content/hardMomentSurface";
import { speak, stopSpeaking, ttsSupported } from "../../lib/tts";
import { voiceState } from "../../lib/voice";
// AI-V5: screened-sentence tokens + next-sentence audio prefetch keep the
// neural pipeline gapless without weakening the /api/tts trust boundary.
import { prefetchNaturalAudio, registerTtsToken } from "../../lib/naturalVoice";
// VC-8: pure shared module — lets a client-side (lexical) crisis stop render
// the SAME escalation resources the server paths carry, so a crisis stop is
// never resource-less on screen.
import { escalationMatchForCategory, renderEscalationMarkdown } from "../../safety/escalation";
import { usePrefersReducedMotion } from "../ui/playkit";

type Risk = "Low" | "Moderate" | "High";

/** Map a structured riskLevel string straight to the trust bar (TS-1). */
function riskFromLevel(level?: string): Risk {
  const v = (level || "").toLowerCase();
  if (v === "high" || v === "severe" || v === "urgent") return "High";
  if (v === "moderate" || v === "elevated") return "Moderate";
  return "Low";
}

/** Fallback for text-only messages: extract the risk level from the prose. */
function parseRisk(text: string): Risk {
  const m = text.match(/risk level:\s*\*{0,2}\s*(low|moderate|high|elevated|severe)/i);
  return riskFromLevel(m?.[1]);
}

// Follow-ups: the STATIC FALLBACK trio, used only when the answer's contract
// carries no model-anticipated followUps (ASK-4). The visible label is
// translated (labelKey); the `prompt` sent to the model stays English on
// purpose (the model replies in aiLang) — the bubble shows the tapped label
// via displayText (ASK-5).
const FOLLOW_UPS: { labelKey: string; prompt: string }[] = [
  { labelKey: "coach.followup.avoid", prompt: "What should I avoid saying in that moment?" },
  { labelKey: "coach.followup.repair", prompt: "How do I repair the connection afterwards?" },
  { labelKey: "coach.followup.calm", prompt: "Give me a 1-minute calming routine to try." },
];

// IA-2: fast-start scenarios — the most common hard moments, one tap away.
// `labelKey` is translated UI chrome; `prompt` is an AI-input string kept English
// (the model localizes its reply via getAiLanguage()) — do not translate prompts.
const SCENARIOS: { emoji: string; labelKey: string; prompt: string }[] = [
  { emoji: "🌅", labelKey: "coach.scenario.morning", prompt: "My child refuses to get dressed and leave the house in the morning. What may be happening and what do I do today?" },
  { emoji: "📱", labelKey: "coach.scenario.ipad", prompt: "Turning off the iPad ends in a meltdown. Give me what may be happening, an exact script, and what to avoid." },
  { emoji: "🧒", labelKey: "coach.scenario.sibling", prompt: "My children keep fighting over toys. Help me understand it and give me a calm script to use in the moment." },
  { emoji: "🌙", labelKey: "coach.scenario.bedtime", prompt: "Bedtime takes over an hour with lots of resistance. What's a calm wind-down plan and script?" },
  { emoji: "🏫", labelKey: "coach.scenario.dropoff", prompt: "My child cries and clings at school dropoff. What may be happening and exactly what do I say?" },
];

export default function CoachTab() {
  const {
    selectedLens,
    setSelectedLens,
    chatMessages,
    isChatLoading,
    chatStreamStatus,
    handleCancelChat,
    chatInput,
    setChatInput,
    handleChatSend,
    handleCouncilSend,
    appendVoiceUserTurn,
    appendVoiceAiDelta,
    finalizeVoiceAiTurn,
    chatBottomRef,
    setActiveTab,
    setPlanChallengeTopic,
    setNewLogNotes,
    setNewLogType,
    setNewLogIntensity,
    setNewLogDuration,
    setNewLogContext,
    setNewLogTrigger,
    setNewLogResponse,
    childProfile,
    conversations,
    activeConversationId,
    newConversation,
    openConversation,
    deleteConversation,
    apiError,
    seedCoach,
    requestCapture,
    requestConsultPrefill,
    proposeMemory,
  } = useArbor();
  const { toast } = useToast();
  const { aiLang, t, uiLang } = useLanguage();
  const { user } = useAuth();
  const childFirst = (childProfile.name || "").split(" ")[0];
  const reducedMotion = usePrefersReducedMotion();

  // Last thing the parent asked — used to power the error-state Retry button.
  const lastUserText = [...chatMessages].reverse().find((m) => m.sender === "user")?.text;

  // ASK-7: fresh-thread orientation and follow-up gating derive from real
  // turns. A legacy saved conversation that still opens with the old welcome
  // bubble counts as an AI turn only — orientation never doubles up.
  const userTurnExists = hasUserTurn(chatMessages);
  const aiTurnExists = hasAiTurn(chatMessages);

  // ASK-1: the post-hoc typewriter is GONE — /chat streams real screened
  // sentence deltas into the live bubble (chatLive), and settled answers
  // render instantly. Follow-up chips wait until no bubble is still live.
  const lastMessage = chatMessages[chatMessages.length - 1];
  const showFollowUps =
    !isChatLoading && lastMessage?.sender === "ai" && !lastMessage.voiceLive && !lastMessage.chatLive && userTurnExists;

  // Arbor Vision (photo / document capture)
  const [visionMode, setVisionMode] = useState<null | "observe" | "document">(null);

  // Which answer's overflow ("…") menu is open. Only Copy stays inline; Log /
  // Plan / Share fold into this menu so a settled answer reads as calm text.
  const [openMenuIdx, setOpenMenuIdx] = useState<number | null>(null);
  // ASK-9: the lens machinery is DEMOTED — collapsed to a single "Perspective:
  // {lens} · change" affordance below the fast-start scenarios; one tap opens
  // the full radiogroup (all lenses, arrow-key nav). Selection persistence and
  // seedCoach lens steering are untouched.
  const [lensOpen, setLensOpen] = useState(false);

  // Realtime voice coach: prefers Gemini Live (true bidirectional audio) when the
  // server reports it's available, and falls back to a hands-free browser loop —
  // listen (STT) → ask → speak (TTS) → listen again.
  const [voicePhase, setVoicePhase] = useState<"off" | "listening" | "thinking" | "speaking">("off");
  const [liveAvail, setLiveAvail] = useState(false);
  // AI-V7: live caption of the PARENT'S OWN words while they speak (interim
  // browser-STT partials / Live input transcription — never model output).
  const [voiceInterim, setVoiceInterim] = useState("");
  // Render-tracked mirror of liveCtlRef: true while a Gemini Live session is
  // active (the overlay orb only offers tap-to-interrupt on the fallback loop;
  // Live barge-in is voice-driven via the server VAD).
  const [liveSession, setLiveSession] = useState(false);
  const liveCtlRef = useRef<null | { stop: () => void }>(null);
  const voiceOnRef = useRef(false);
  const dictationLoopRef = useRef<DictationLoop | null>(null);
  // Streaming-voice TTS queue (speak each sentence as it streams in).
  const ttsQueueRef = useRef<string[]>([]);
  const ttsSpeakingRef = useRef(false);
  const voiceBufRef = useRef("");
  const streamDoneRef = useRef(false);
  const voiceAbortRef = useRef<AbortController | null>(null);

  // AI-V8: probe Gemini Live availability once, from the config-only GET —
  // zero ephemeral tokens are minted on mount; a fresh single-use token is
  // minted only inside toggleVoice when the parent actually starts talking.
  useEffect(() => {
    let cancelled = false;
    api.liveAvailability().then((r) => { if (!cancelled && r.available) setLiveAvail(true); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // AI-V5: while sentence N plays, start fetching sentence N+1's audio so the
  // inter-sentence gap is playback-bound, not network-bound. Neural engine
  // only — the browser floor needs no network. Idempotent per sentence.
  const prefetchUpNext = () => {
    const upNext = ttsQueueRef.current[0];
    if (upNext && voiceState().engine === "natural") prefetchNaturalAudio(upNext);
  };

  // Speak queued sentences one at a time; when drained after a turn, resume listening.
  const pumpTts = () => {
    if (ttsSpeakingRef.current) return;
    const next = ttsQueueRef.current.shift();
    if (!next) {
      if (streamDoneRef.current) {
        streamDoneRef.current = false;
        // COACH-2: the spoken answer is fully delivered — settle the live
        // caption bubble into a normal persisted turn.
        finalizeVoiceAiTurn();
        if (voiceOnRef.current) startListening(); else setVoicePhase("off");
      }
      return;
    }
    ttsSpeakingRef.current = true;
    setVoicePhase("speaking");
    if (ttsSupported()) {
      prefetchUpNext();
      speak(next, () => { ttsSpeakingRef.current = false; pumpTts(); });
    } else {
      ttsSpeakingRef.current = false;
      pumpTts();
    }
  };
  const enqueueSpeak = (s: string) => {
    if (!s.trim()) return;
    ttsQueueRef.current.push(s.trim());
    // Queued behind a playing sentence → it is the (new) up-next: prefetch.
    if (ttsSpeakingRef.current) prefetchUpNext();
    pumpTts();
  };

  // A streaming voice turn: stream the answer token-by-token and speak each
  // sentence the moment it completes (real-time, not wait-then-speak).
  const streamVoiceTurn = async (text: string) => {
    setVoicePhase("thinking");
    voiceBufRef.current = "";
    streamDoneRef.current = false;
    const controller = new AbortController();
    voiceAbortRef.current = controller;
    try {
      await streamVoice(
        { message: text, childProfile, scholarLens: selectedLens, language: getAiLanguage() },
        (delta) => {
          // COACH-2: caption + persist the SAME screened text that is spoken —
          // the delta accumulates into a live AI bubble in the thread.
          appendVoiceAiDelta(delta);
          voiceBufRef.current += delta;
          // EVAL-2: the splitter is the shared pure lib function so the
          // cadence contract is pinned by evals/voice-loop-v1 (see
          // routes/voiceLoopEval.test.ts) — same semantics as before.
          const { complete, rest } = splitCompleteSentences(voiceBufRef.current);
          for (const sentence of complete) enqueueSpeak(sentence);
          voiceBufRef.current = rest;
        },
        {
          signal: controller.signal,
          // VC-4: the done payload is safety-load-bearing. On escalation:
          // stop the loop (voiceOnRef=false means the TTS drain in pumpTts
          // settles to "off" and NEVER calls startListening again) and put
          // the full crisis resources block ON SCREEN as part of the
          // persisted AI turn. On outputBlocked: render the visible blocked
          // state (parity with /chat's renderBlockedOutputMarkdown). The
          // appended markdown goes through appendVoiceAiDelta directly —
          // persisted + visible but never enqueued for speech.
          onEvent: (event, data) => {
            if (event === "delta") {
              // AI-V5: deltas carry a short-TTL screened-sentence token —
              // register it so /api/tts can skip the model re-screen for
              // exactly this text (its lexical floor still always runs).
              const tts = (data as { tts?: { text?: unknown; token?: unknown } }).tts;
              if (tts && typeof tts.text === "string" && typeof tts.token === "string") {
                registerTtsToken(tts.text, tts.token);
              }
              return;
            }
            if (event !== "done") return;
            handleVoiceDone(data, {
              stopLoop: () => { voiceOnRef.current = false; },
              appendMarkdown: (md) => appendVoiceAiDelta(`\n\n${md}`),
            });
          },
        },
      );
      if (voiceBufRef.current.trim()) enqueueSpeak(voiceBufRef.current);
      voiceBufRef.current = "";
      streamDoneRef.current = true;
      pumpTts();
    } catch {
      // COACH-2: keep the partial caption on abort/error — the parent keeps
      // whatever was already said instead of the turn vanishing.
      // AI-V2(a): an ABORT is always driven by bargeInVoice/stopVoice, which
      // already settled the caption + phase (barge-in is synchronously back
      // in "listening") — only a genuine stream failure recovers here.
      if (!controller.signal.aborted) {
        finalizeVoiceAiTurn();
        if (voiceOnRef.current) startListening(); else setVoicePhase("off");
      }
    } finally {
      voiceAbortRef.current = null;
    }
  };

  const startListening = () => {
    if (!speechSupported()) { toast(t("coach.toast.voiceUnsupported"), "info"); voiceOnRef.current = false; setVoicePhase("off"); return; }
    setVoicePhase("listening");
    // AI-V3: the dictation loop owns recognition restarts — recoverable errors
    // ('no-speech', transient network) restart with backoff behind a max-retry
    // circuit breaker, silent ends auto-cycle the mic, and fatal errors stop
    // voice with a truthful phase + toast. The "listening" label is only ever
    // shown while the loop is actually cycling.
    dictationLoopRef.current?.stop();
    const loop = createDictationLoop({
      start: startDictation,
      lang: aiLang === "he" ? "he-IL" : "en-US",
      isActive: () => voiceOnRef.current,
      // AI-V7: surface interim partials as the overlay's live caption of the
      // parent's own words (<500ms after speech starts — straight from the
      // recognizer, no model round-trip).
      onInterim: (text) => setVoiceInterim(text),
      onTranscript: (text) => {
        setVoiceInterim("");
        if (!text.trim()) { if (voiceOnRef.current) startListening(); return; }
        // COACH-2: persist the dictated turn through the existing
        // chat-message write seam before asking.
        appendVoiceUserTurn(text);
        void streamVoiceTurn(text);
      },
      onFatal: (reason) => {
        stopVoice();
        toast(
          reason === "permission"
            ? t("coach.toast.micPermission")
            : reason === "retry-exhausted"
              ? t("coach.toast.micRetryStopped")
              : t("coach.toast.voiceUnsupported"),
          "info",
        );
      },
    });
    dictationLoopRef.current = loop;
    loop.start();
  };

  const stopVoice = () => {
    voiceOnRef.current = false;
    streamDoneRef.current = false;
    ttsQueueRef.current = [];
    ttsSpeakingRef.current = false;
    voiceAbortRef.current?.abort();
    dictationLoopRef.current?.stop();
    dictationLoopRef.current = null;
    stopSpeaking();
    liveCtlRef.current?.stop();
    liveCtlRef.current = null;
    setLiveSession(false);
    setVoiceInterim("");
    // COACH-2: settle (and keep) any partial caption when the parent stops.
    finalizeVoiceAiTurn();
    setVoicePhase("off");
  };

  // AI-V2(a): barge-in on the browser fallback loop — interrupt, don't kill.
  // Flush every queued sentence, cut the current utterance, abort a still-open
  // /voice stream, settle the partial caption (the parent keeps what was
  // already said), and go straight back to listening. Voice STAYS on; a
  // second tap during "listening" stops (voiceChipAction pins the contract).
  const bargeInVoice = () => {
    ttsQueueRef.current = [];
    ttsSpeakingRef.current = false;
    streamDoneRef.current = false;
    voiceAbortRef.current?.abort();
    stopSpeaking();
    finalizeVoiceAiTurn();
    setVoiceInterim("");
    // VC-4 invariant: every automatic re-listen is guarded by the hands-free
    // flag — a crisis-stopped loop (stopLoop set voiceOnRef=false) can never
    // be re-armed by a barge-in tap; that tap falls through to stopVoice.
    if (voiceOnRef.current) startListening();
  };

  const startBrowserVoice = () => { voiceOnRef.current = true; startListening(); };

  const toggleVoice = async () => {
    const action = voiceChipAction(voicePhase, Boolean(liveCtlRef.current));
    if (action === "interrupt" && voiceOnRef.current) { bargeInVoice(); return; }
    if (action !== "start" || voiceOnRef.current || liveCtlRef.current) { stopVoice(); return; }

    // Prefer true Gemini Live when the server says it's provisioned.
    if (liveAvail) {
      try {
        // AI-V9: the session language picks the server-pinned persona + voice;
        // childId scopes the per-turn screen (requireChildOwnership).
        const fresh = await api.liveToken({ language: getAiLanguage(), childId: childProfile.id });
        if (fresh.available && fresh.token && fresh.model) {
          const { startGeminiLive } = await import("../../lib/geminiLiveClient");
          setVoicePhase("thinking");
          // VC-1/2/3/5: every Live turn routes through the liveTurnGuard —
          // audio buffers per turn and releases only after the shared lexical
          // floor AND the server verdict from /api/live/turn both pass. The
          // guard closes the session BEFORE any crisis/blocked/degrade render.
          liveCtlRef.current = await startGeminiLive(
            {
              token: fresh.token,
              model: fresh.model,
              // FW-NEW-P0: the persona/voice are server-pinned into the token's
              // liveConnectConstraints at mint time — echoing them back keeps
              // the client connect config byte-identical to the pin.
              systemInstruction: fresh.systemInstruction || "",
              speechConfig: fresh.speechConfig,
            },
            {
              onPhase: (p) => setVoicePhase(p === "closed" ? "off" : p === "connecting" ? "thinking" : p),
              onError: () => { liveCtlRef.current = null; setLiveSession(false); toast(t("coach.toast.voiceFallback"), "info"); startBrowserVoice(); },
              screenTurn: (role, text) =>
                api.liveTurn({ role, text, language: getAiLanguage(), childId: childProfile.id }),
              // COACH-2 / VC-3: Live turns persist through the SAME reducers the
              // browser loop uses (appendVoiceUser / applyVoiceDelta /
              // settleVoiceTurn → the existing conversationsCol upsert) — no
              // new capture path, conversations stays in CHILD_SUBCOLLECTIONS.
              onUserTurn: (text) => { setVoiceInterim(""); appendVoiceUserTurn(text); },
              // AI-V7: Live input transcription = the parent's own words —
              // accumulate into the overlay caption while they speak.
              onUserInterim: (delta) => setVoiceInterim((prev) => (prev + delta).trimStart()),
              onModelTurn: (text) => { appendVoiceAiDelta(text); finalizeVoiceAiTurn(); },
              onCrisis: (v) => {
                // Session is ALREADY stopped (guard halts before rendering).
                liveCtlRef.current = null;
                setLiveSession(false);
                voiceOnRef.current = false;
                // VC-8: the guard's client-side lexical crisis stop carries no
                // server resourcesMarkdown — render the matching escalation
                // resources locally so crisis help ALWAYS lands on screen.
                appendVoiceAiDelta(
                  v.resourcesMarkdown ?? renderEscalationMarkdown(escalationMatchForCategory(v.category)),
                );
                finalizeVoiceAiTurn();
                if (v.spokenText) speak(v.spokenText);
                setVoicePhase("off");
              },
              onBlocked: (v) => {
                liveCtlRef.current = null;
                setLiveSession(false);
                voiceOnRef.current = false;
                if (v.blockedMarkdown) appendVoiceAiDelta(v.blockedMarkdown);
                finalizeVoiceAiTurn();
                if (v.spokenText) speak(v.spokenText);
                setVoicePhase("off");
              },
              // VC-5: screening unavailability degrades VISIBLY to the screened
              // browser voice loop (/voice screens every turn server-side).
              onFailClosed: () => {
                liveCtlRef.current = null;
                setLiveSession(false);
                toast(t("coach.toast.voiceStandardMode"), "info");
                startBrowserVoice();
              },
            },
          );
          setLiveSession(true);
          return;
        }
      } catch {
        liveCtlRef.current = null; // fall through to the browser loop
        setLiveSession(false);
      }
    }
    startBrowserVoice();
  };

  // Stop any audio/recognition on unmount.
  useEffect(() => () => { dictationLoopRef.current?.stop(); stopSpeaking(); voiceAbortRef.current?.abort(); liveCtlRef.current?.stop(); }, []);

  const voiceLabel = voicePhase === "listening" ? t("coach.voice.listening") : voicePhase === "thinking" ? t("coach.voice.thinking") : voicePhase === "speaking" ? t("coach.voice.speaking") : liveAvail ? t("coach.voice.talkHd") : t("coach.voice.talk");
  // COACH-2: live caption text on the voicePhase chip while the answer streams
  // in / is spoken (the same screened text that fills the thread bubble).
  const liveVoiceText =
    (voicePhase === "thinking" || voicePhase === "speaking") && lastMessage?.sender === "ai" && lastMessage.voiceLive
      ? lastMessage.text
      : "";

  // ASK-2: the docked state — the SAME single composer element renders in the
  // hero position on a fresh thread and docks sticky at the viewport bottom
  // once the thread has a user turn, so a follow-up never needs scroll-hunting.
  // COACH-4 single-input invariant holds: this JSX renders in exactly ONE of
  // the two positions, so there is always exactly one textarea in the DOM,
  // and the voice/photo capture chips travel with it.
  const composerDocked = userTurnExists;
  const composerSection = (
        <section
          className={composerDocked ? "py-2.5" : "border-y py-5 sm:py-6"}
          aria-label={t("elev.hero.ask.cta")}
          style={composerDocked ? undefined : { borderColor: "var(--arbor-rule)" }}
        >
          {!composerDocked && (
          <div className="flex items-center gap-3 mb-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}><Icon name="auto_awesome" size={21} fill={1} /></span>
            <div className="min-w-0">
              <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("coach.empty.title", { name: childFirst })}</p>
              <p className="text-[11px] leading-relaxed truncate" style={{ color: "var(--arbor-muted)" }}>
                {t("coach.memoryLine", { name: childFirst })}
              </p>
            </div>
          </div>
          )}
          <div className="flex items-end gap-2 rounded-[20px] p-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }}>
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
              disabled={isChatLoading}
              rows={2}
              placeholder={t("coach.placeholder", { name: childFirst })}
              className="flex-1 bg-transparent resize-none px-2.5 py-2 text-sm leading-relaxed focus:outline-none min-h-[58px]"
              style={{ color: "var(--arbor-ink)" }}
            />
            <button
              type="button"
              onClick={() => handleChatSend()}
              disabled={isChatLoading || !chatInput.trim()}
              aria-label={t("coach.send.aria")}
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40 transition motion-safe:hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ background: T.gradientCta }}
            >
              <Icon name={uiLang === "he" ? "arrow_back" : "arrow_forward"} size={20} />
            </button>
          </div>
          {/* Multimodal capture entry points (photo / document / voice) — the ONLY
              instances on the surface (COACH-4 firewall condition: they survive
              the composer consolidation). */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => setVisionMode("observe")} className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full text-[11px] font-bold" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}><Icon name="photo_camera" size={14} /> {t("coach.photo")}</button>
            <button type="button" onClick={() => setVisionMode("document")} className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full text-[11px] font-bold" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}><Icon name="description" size={14} /> {t("coach.document")}</button>
            <button
              type="button"
              onClick={toggleVoice}
              aria-pressed={voicePhase !== "off"}
              aria-label={voiceLabel}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full text-[11px] font-bold"
              style={voicePhase !== "off"
                ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }
                : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}
            >
              {/* AI-V7: the truncated 180px chip caption moved into the
                  VoiceOverlay bottom sheet (full-width, dir="auto", aria-live)
                  — the chip stays the sole ENTRY point. */}
              {voicePhase === "off" ? <Icon name="mic" size={14} /> : <Icon name="stop" size={14} />} {voiceLabel}
              {voicePhase !== "off" && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--arbor-clay)" }} aria-hidden />}
            </button>
            {/* EU AI Act Art. 50 — persistent AI-interaction transparency line.
                Always visible on the Ask surface, never behind a toggle. */}
            <span className="ms-auto inline-flex items-center gap-1 text-[10px]" style={{ color: "var(--arbor-muted)" }}><Icon name="shield" size={13} /> {t("coach.aiDisclosure")}</span>
          </div>
        </section>
  );

  return (
    <motion.div initial={reducedMotion ? false : { opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto w-full min-w-0 max-w-[1040px] space-y-6">
      {/* One coaching workspace: orientation, conversation, composer. */}
      <div className="space-y-4">
        <header className="border-b pb-5" style={{ borderColor: "var(--arbor-rule)" }}>
          <div className="max-w-2xl">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--arbor-green-ink)" }}>{t("elev.hero.ask.eyebrow")}</p>
            <h1 className="mt-1.5 text-[28px] font-extrabold leading-[1.08] sm:text-[34px]" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>{t("elev.hero.ask.title")}</h1>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("coach.subtitle")}</p>
          </div>
        </header>

        {/* Composer-first: the parent's question is the primary job on this page.
            COACH-4: this hero composer is the ONE input on the surface — the
            mirrored in-thread composer was removed; follow-up turns also send
            from here. ASK-2: once the thread has a user turn the SAME element
            docks sticky at the bottom of the page instead (see below). */}
        {!composerDocked && composerSection}
      </div>

      {/* Fast-start scenarios (IA-2) — calm bordered chips on a fresh conversation */}
      {!userTurnExists && (
        <div className="space-y-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-muted)" }}>{t("coach.fastStart")}</span>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.labelKey}
                // ASK-5: the parent's bubble shows the localized label they
                // actually tapped; the canonical EN prompt goes to the model.
                onClick={() => handleChatSend(s.prompt, { displayText: t(s.labelKey) })}
                disabled={isChatLoading}
                className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 min-h-[48px] text-start text-sm font-bold bg-white transition motion-safe:hover:-translate-y-0.5 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                style={{ color: T.ink, border: "1px solid var(--arbor-rule)" }}
              >
                <span aria-hidden>{s.emoji}</span> {t(s.labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CONT-2 — hard-moment "Talk this through" (AR-CONT-01). Reads ONLY
          publishedHardMomentCards (fail-closed governance), so this group is
          invisible until named clinical review stamps the pack (GD-10). Each
          chip calls the EXISTING seedCoach seam with the card context; the
          seed embeds the governed escalation VERBATIM (never paraphrased) and
          is covered by evals/coach-hardmoment-seed-v1. */}
      {!userTurnExists && publishedHardMomentCards.length > 0 && (
        <div className="space-y-2" data-testid="coach-hard-moments">
          <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-muted)" }}>{t("hm.coach.heading")}</span>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {publishedHardMomentCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => seedCoach({ prompt: buildHardMomentSeedPrompt(card, aiLang === "he" ? "he" : "en", childFirst), source: "hard-moment-card" })}
                disabled={isChatLoading}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl px-4 py-3 text-start text-sm font-bold transition motion-safe:hover:-translate-y-0.5 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                style={{ color: T.ink, border: "1px solid var(--arbor-rule)", background: "var(--arbor-paper-elevated)" }}
              >
                <Icon name="forum" size={15} style={{ color: "var(--arbor-green-ink)" }} />
                <span className="min-w-0 truncate">{t("hm.talkThrough")} · {locText(card.title, uiLang === "he" ? "he" : "en")}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ASK-9: the lens machinery, DEMOTED below the fast-start scenarios —
          prime mobile real estate belongs to the composer + scenarios. Default
          is one calm affordance ("Perspective: Integrated · change"); one tap
          opens the FULL radiogroup (arrow-key nav, RTL-safe logical props).
          Selection persistence (arbor.lens) + seedCoach lens steering intact. */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* E8: the research-anchored trust chip lives beside the lens affordance. */}
          <EvidenceChip />
          <button
            type="button"
            onClick={() => setLensOpen((v) => !v)}
            aria-expanded={lensOpen}
            className="inline-flex items-center gap-1 min-h-[44px] text-[11px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded-lg"
            style={{ color: "var(--arbor-muted)" }}
          >
            <span>
              {t("coach.perspective")}: <span style={{ color: "var(--arbor-green-ink)" }}>{selectedLens === "Integrated Balanced" ? t("coach.lens.integrated") : selectedLens}</span> · {t("coach.perspective.change")}
            </span>
            <Icon name={lensOpen ? "expand_less" : "expand_more"} size={14} />
          </button>
        </div>
        {lensOpen && (() => {
          // Single-select lens control with proper radiogroup a11y + arrow-key nav.
          const lensNames = ["Integrated Balanced", ...scholarsInfo.map((s) => s.name)];
          const moveLens = (dir: 1 | -1) => {
            const cur = lensNames.indexOf(selectedLens);
            const next = ((cur < 0 ? 0 : cur) + dir + lensNames.length) % lensNames.length;
            setSelectedLens(lensNames[next]);
          };
          const onKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); moveLens(1); }
            else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); moveLens(-1); }
          };
          const active = scholarsInfo.find((s) => s.name === selectedLens);
          const hint = active?.useWhen
            || (selectedLens === "Integrated Balanced" ? t("coach.lens.integratedHint") : null);
          return (
            <>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("coach.lens")} onKeyDown={onKeyDown}>
                {lensNames.map((name) => {
                  const on = selectedLens === name;
                  const scholar = scholarsInfo.find((s) => s.name === name);
                  return (
                    <button
                      key={name}
                      role="radio"
                      aria-checked={on}
                      tabIndex={on ? 0 : -1}
                      onClick={() => setSelectedLens(name)}
                      className="px-3 py-2 min-h-[44px] rounded-xl text-xs font-bold transition flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                      style={on
                        ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" }
                        : { background: T.paperElevated, color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                    >
                      {scholar && (
                        <span className="w-4 h-4 text-[9px] font-black rounded flex items-center justify-center" style={{ background: on ? T.paperElevated : "var(--arbor-paper-deep)", color: "var(--arbor-green-ink)" }} aria-hidden>
                          {scholar.initial}
                        </span>
                      )}
                      {scholar ? `${scholar.name} (${scholar.concept})` : t("coach.lens.integrated")}
                    </button>
                  );
                })}
              </div>
              {/* "Use this lens when…" — makes the lens choice practical, not academic */}
              {hint && (
                <p className="text-[11px] leading-relaxed rounded-lg p-2.5 mt-1" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
                  {hint}
                </p>
              )}
            </>
          );
        })()}
      </div>

      {/* Conversation threads */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={newConversation}
          className="flex-shrink-0 flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1.5 rounded-full transition"
          style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
        >
          <Icon name="add" size={14} /> {t("coach.new")}
        </button>
        {conversations.map((c) => {
          const on = c.id === activeConversationId;
          return (
            <div
              key={c.id}
              className="flex-shrink-0 flex items-center gap-1.5 rounded-full ps-3 pe-1.5 py-1 transition"
              style={on ? { background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.30)" } : { background: T.paperElevated, border: "1px solid var(--arbor-rule)" }}
            >
              <button onClick={() => openConversation(c.id)} className="flex items-center gap-1.5 text-[11px] font-bold max-w-[160px] truncate" style={{ color: on ? "var(--arbor-green-ink)" : "var(--arbor-muted)" }}>
                <Icon name="chat" size={12} className="flex-shrink-0" /> <span className="truncate">{c.title}</span>
              </button>
              <button onClick={() => deleteConversation(c.id)} aria-label={t("aria.deleteConversation")} className="transition" style={{ color: "var(--arbor-muted)" }}>
                <Icon name="delete" size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Chat thread — COACH-4: no fixed-height inner scroll; the thread flows
          with the page (ArborContext auto-scrolls the viewport to the streaming
          answer via chatBottomRef). The min-height keeps the conversation canvas
          from shrinking below the previous min(70dvh,560px) viewport. */}
      <div className={`${cardCls} flex min-h-[min(70dvh,560px)] min-w-0 flex-col overflow-hidden`}>
        {/* Persistent named-coach identity strip. The lens/context frame is kept but
            visually subordinate so the conversation is the hero. Green primary —
            never the design's sapphire — per the parent color lock. */}
        <div className="px-4 py-2.5 flex items-center gap-3" style={{ background: "var(--arbor-paper-deep)", borderBottom: "1px solid var(--arbor-rule)" }}>
          <span className="inline-flex items-center justify-center flex-shrink-0 rounded-full text-xs font-extrabold" style={{ width: 36, height: 36, background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }} aria-hidden>
            ML
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold leading-tight" style={{ color: "var(--arbor-ink)" }}>{t("coach.coachName")}</p>
            <p className="text-[11px] font-bold flex items-center gap-1.5 leading-tight" style={{ color: "var(--arbor-green-ink)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--arbor-green-ink)" }} aria-hidden />
              {t("coach.coachStatus")}
            </p>
          </div>
          <span className="text-[11px] font-bold flex items-center gap-1.5 flex-shrink-0" style={{ color: "var(--arbor-muted)" }}>
            {isChatLoading && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--arbor-clay)" }} aria-hidden />}
            <span className="truncate max-w-[160px]">{t("coach.lensLabel")}: {selectedLens}</span>
          </span>
        </div>

        <div className="flex-1 p-4 md:p-6">
         <div className="max-w-[760px] mx-auto space-y-3.5">
          {/* Empty state — orient a first-run parent on what Ask Arbor does.
              COACH-4: the title line lives ONCE, on the hero composer above;
              the thread empty state keeps only the mascot + body copy.
              ASK-7: this is THE single orientation block (with the scenarios)
              — it hides the moment any real turn exists, including a legacy
              conversation that still opens with the old welcome bubble. */}
          {!userTurnExists && !aiTurnExists && !isChatLoading && (
            <div className="flex flex-col items-center justify-center text-center gap-3 py-10 px-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden" style={{ background: "var(--arbor-green-soft)" }} aria-hidden>
                <ArborMascot size={52} />
              </div>
              <p className="text-sm max-w-md leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("coach.empty.body")}</p>
            </div>
          )}
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 max-w-[85%] group ${msg.sender === "user" ? "ms-auto flex-row-reverse" : "me-auto"}`}>
              {msg.sender === "user" ? (
                <Avatar name={user?.displayName} photoURL={user?.photoURL} size={32} />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: "var(--arbor-green-soft)" }} title="Arbor">
                  <ArborMascot size={30} />
                </div>
              )}
              {/* Asymmetric "tail" via logical radii so it flips correctly in RTL:
                  the speaker-side bottom corner is tightened to 6px. Coach bubbles
                  carry a soft shadow to lift the conversation off the canvas. */}
              <div dir="auto" className={`p-4 rounded-[18px] text-sm font-medium leading-[1.55] ${msg.sender === "user" ? "text-white" : ""}`}
                style={msg.sender === "user"
                  ? { background: T.gradientCta, borderEndEndRadius: 6 }
                  : { background: T.paperElevated, color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)", borderEndStartRadius: 6, boxShadow: "var(--shadow-sm)" }}>
                {msg.sender === "ai" && !msg.contract && msg.lens && msg.lens !== "Integrated Balanced" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mb-3 inline-block" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
                    {t("coach.alignedWith", { lens: msg.lens })}
                  </span>
                )}
                {msg.sender === "ai" ? (
                  msg.contract ? (
                    <>
                    {/* ASK-1: the streamed prose lead stays visible after the
                        cards settle — the words the parent watched arrive
                        never vanish at done. */}
                    {msg.contract.text?.trim() && <MarkdownBlock text={msg.contract.text} className="mb-3" />}
                    <CoachAnswerCards
                      contract={msg.contract}
                      lens={msg.lens}
                      council={msg.council}
                      lang={uiLang}
                      // ASK-6: memory footer deep link — Profile › Child Memory.
                      onManageMemory={() => setActiveTab("memory")}
                      onSaveToPlan={(topic) => {
                        setPlanChallengeTopic((topic || msg.text).replace(/[#*]/g, "").slice(0, 140));
                        setActiveTab("plans");
                        toast(t("coach.toast.planSeeded"), "info");
                      }}
                      onCreateLog={async () => {
                        const prior = chatMessages[idx - 1];
                        const source = prior?.sender === "user" ? prior.text : msg.text;
                        toast(t("coach.toast.draftingLog"), "info");
                        try {
                          const d = await api.extractLog({ message: source, childProfile, language: getAiLanguage() });
                          // AI-CAP-8: clamp/validate through the ONE shared
                          // taxonomy module — the Behaviors select always gets
                          // a canonical type, free labels survive in notes.
                          const n = normalizeExtractedLog(d, source.slice(0, 140));
                          setNewLogType(n.behaviorType);
                          setNewLogIntensity(n.intensity);
                          setNewLogDuration(n.durationMinutes);
                          setNewLogContext(n.context as BehaviorContext);
                          setNewLogTrigger(n.trigger);
                          setNewLogResponse(n.response || t("beh.extract.noResponse"));
                          setNewLogNotes(n.notes);
                          // AI-CAP-4: route the handoff through the existing
                          // requestCapture seam — Behaviors opens the form
                          // VISIBLE, review gate armed, factual 'ai-draft'
                          // provenance; the only write path is confirmReview.
                          requestCapture("ai-draft");
                          setActiveTab("behaviors");
                          toast(t("coach.toast.logDrafted"), "success");
                        } catch (err) {
                          // FAIL-CLOSED (same contract as AI-CAP-1): a 409 from
                          // the extraction screen renders the full crisis
                          // resources in the thread and writes ZERO draft fields.
                          if (err instanceof EscalationRequiredError) {
                            appendVoiceAiDelta(renderEscalationMarkdown(escalationMatchForCategory(err.category)));
                            finalizeVoiceAiTurn();
                            return;
                          }
                          setNewLogNotes(msg.contract!.nonDiagnosticHypotheses?.[0]?.rationale?.slice(0, 300) || source.slice(0, 300));
                          requestCapture("ai-draft");
                          setActiveTab("behaviors");
                          toast(t("coach.toast.notePrefilled"), "info");
                        }
                      }}
                      onAddToHandoff={() => {
                        setActiveTab("consult");
                        toast(t("coach.toast.teacherNoteCopied"), "info");
                      }}
                    />
                    </>
                  ) : (
                    // ASK-1: no fake typewriter — a live bubble (voice caption
                    // or ask stream) grows with its real deltas; settled text
                    // renders complete immediately.
                    <MarkdownBlock text={msg.text} />
                  )
                ) : (
                  // ASK-5: user bubbles show what the parent SAW (the tapped
                  // localized chip label) — msg.text stays the canonical
                  // prompt that went to the model.
                  <MarkdownBlock text={msg.displayText || msg.text} />
                )}

                {msg.sender === "ai" && !msg.contract && !msg.voiceLive && !msg.chatLive && (
                  // Calm: answers read as text. Copy stays inline; everything else
                  // folds into a single "…" overflow so it's not a toolbar.
                  // Touch: always visible. Desktop: calm hover reveal. Keyboard: focus reveals.
                  <div className="relative flex items-center gap-3 mt-3 pt-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
                    <button
                      onClick={async () => { await navigator.clipboard?.writeText(msg.text); toast(t("coach.copied"), "success"); }}
                      aria-label={t("coach.action.copy")}
                      className="text-[10px] font-bold flex items-center gap-1 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded" style={{ color: "var(--arbor-muted)" }}
                    >
                      <Icon name="content_copy" size={12} /> {t("coach.action.copy")}
                    </button>
                    <button
                      onClick={() => setOpenMenuIdx(openMenuIdx === idx ? null : idx)}
                      aria-label={t("coach.more")}
                      aria-haspopup="menu"
                      aria-expanded={openMenuIdx === idx}
                      className="text-[10px] font-bold flex items-center gap-1 min-h-[44px] px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded" style={{ color: "var(--arbor-muted)" }}
                    >
                      <Icon name="more_horiz" size={16} />
                    </button>
                    {openMenuIdx === idx && (
                      <>
                        {/* Backdrop closes the menu on any outside tap. */}
                        <button type="button" aria-hidden className="fixed inset-0 z-10 cursor-default" onClick={() => setOpenMenuIdx(null)} tabIndex={-1} />
                        <div role="menu" className="absolute z-20 top-full mt-1 start-8 rounded-xl p-1 min-w-[180px]" style={{ background: T.paperElevated, border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-sm)" }}>
                          <button
                            role="menuitem"
                            onClick={() => {
                              setNewLogNotes(msg.text.replace(/[#*]/g, "").trim().slice(0, 400));
                              setActiveTab("behaviors");
                              setOpenMenuIdx(null);
                              toast(t("coach.toast.logPrefilled"), "info");
                            }}
                            className="w-full text-start text-xs font-bold flex items-center gap-2 px-2.5 py-2 min-h-[40px] rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1" style={{ color: "var(--arbor-ink)" }}
                          >
                            <Icon name="assignment" size={14} style={{ color: "var(--arbor-muted)" }} /> {t("coach.action.log")}
                          </button>
                          <button
                            role="menuitem"
                            onClick={() => {
                              setPlanChallengeTopic(msg.text.replace(/[#*]/g, "").slice(0, 140));
                              setActiveTab("plans");
                              setOpenMenuIdx(null);
                              toast(t("coach.toast.planSeeded"), "info");
                            }}
                            className="w-full text-start text-xs font-bold flex items-center gap-2 px-2.5 py-2 min-h-[40px] rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1" style={{ color: "var(--arbor-ink)" }}
                          >
                            <Icon name="playlist_add" size={14} style={{ color: "var(--arbor-muted)" }} /> {t("coach.action.plan")}
                          </button>
                          {/* mk-p0-3: 1-tap branded share of a settled answer — this
                              menu only exists on settled bubbles (live ones hide the
                              whole actions row). */}
                          <div className="px-1 py-0.5" onClick={() => setOpenMenuIdx(null)}>
                              <ShareButton
                                artifact="answer_card"
                                surface="ask"
                                childName={childFirst}
                                getCardOpts={() => {
                                  const prior = chatMessages[idx - 1];
                                  const question = prior?.sender === "user" ? prior.text : "";
                                  return {
                                    question: question.replace(/[#*]/g, "").trim().slice(0, 160),
                                    takeaway: msg.text.replace(/[#*]/g, "").trim().slice(0, 220),
                                    imageUrl: childProfile.photoUrl,
                                    name: childFirst,
                                  };
                                }}
                                label={t("share.cta.answer")}
                                variant="ghost"
                              />
                            </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {showFollowUps && (() => {
            // ASK-4: the answer's own anticipated followUps lead (localized by
            // the model via the languageDirective, zod-capped to 3, and
            // screened — they are appended to renderCoachResponse so
            // screenModelOutput covered every string shown here). The static
            // trio is only the fallback when the contract carries none.
            const anticipated = lastMessage?.contract?.followUps?.filter((q) => q.trim()) ?? [];
            const chips = anticipated.length > 0
              ? anticipated.map((q) => ({ key: q, label: q, prompt: q }))
              : FOLLOW_UPS.map((q) => ({ key: q.labelKey, label: t(q.labelKey), prompt: q.prompt }));
            return (
            <div className="flex flex-wrap gap-[9px] me-auto max-w-[85%] ps-11">
              {chips.map((q) => (
                <button
                  key={q.key}
                  dir="auto"
                  onClick={() => handleChatSend(q.prompt, { displayText: q.label })}
                  className="text-[13px] px-4 py-1.5 min-h-[44px] rounded-full transition flex items-center gap-1.5 font-extrabold bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-green-ink)" }}
                >
                  {q.label}
                  {uiLang === "he"
                    ? <Icon name="arrow_back" size={12} />
                    : <Icon name="arrow_forward" size={12} />}
                </button>
              ))}
            </div>
            );
          })()}

          {isChatLoading && (
            <div className="flex gap-3 max-w-[85%] me-auto">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold animate-spin" style={{ background: "var(--arbor-peach-soft)", color: "var(--arbor-peach)" }} aria-hidden>
                <Icon name="sync" size={16} />
              </div>
              <div className="p-4 rounded-2xl text-xs flex items-center gap-3" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
                <span className="animate-pulse" aria-live="polite">{chatStreamStatus || t("coach.loading")}</span>
                <button
                  type="button"
                  onClick={handleCancelChat}
                  className="px-2 py-1 rounded-lg font-bold flex items-center gap-1"
                  style={{ background: T.paperElevated, border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}
                >
                  <Icon name="close" size={12} /> {t("coach.stop")}
                </button>
              </div>
            </div>
          )}

          {/* Error state — the previously-missing recovery affordance on the pillar. */}
          {apiError && !isChatLoading && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl p-4 me-auto max-w-[85%]"
              style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}
            >
              <Icon name="warning" size={16} className="flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-xs leading-relaxed font-bold">{t("coach.error")}</p>
                {lastUserText && (
                  <button
                    type="button"
                    onClick={() => handleChatSend(lastUserText)}
                    className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl text-xs font-extrabold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                    style={{ background: T.paperElevated, border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
                  >
                    <Icon name="sync" size={14} /> {t("coach.retry")}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ASK-2: scroll-margin keeps the auto-scrolled thread end clear of
              the docked sticky composer below. */}
          <div ref={chatBottomRef} style={{ scrollMarginBottom: 132 }} />
         </div>
        </div>

        {/* COACH-4: the mirrored bottom composer (input+send+photo/mic row) was
            deleted — the hero composer above is the one input. What remains under
            the thread is a compact secondary row: Council (multi-lens send of the
            current question) + the Ask-a-Specialist warm handoff (ia-b6,
            navigation only — stays enabled while an answer is streaming). */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2" style={{ borderTop: "1px solid var(--arbor-rule)", background: "var(--arbor-paper-deep)" }}>
          <button
            type="button"
            // ASK-4: with an empty composer the council re-asks the parent's
            // last question (handleCouncilSend falls back to it) — disabled,
            // with an honest hint, ONLY when no prior turn exists to convene on.
            onClick={() => handleCouncilSend()}
            disabled={isChatLoading || (!chatInput.trim() && !lastUserText)}
            title={chatInput.trim() || lastUserText ? t("coach.councilHint") : t("coach.councilHint.empty")}
            aria-label={chatInput.trim() || lastUserText ? t("coach.councilHint") : t("coach.councilHint.empty")}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 min-h-[44px] rounded-lg transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{ color: "var(--arbor-muted)" }}
          >
            <Icon name="group" size={14} /> {t("coach.council")}
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("consult"); toast(t("coach.specialist.toast"), "info"); }}
            aria-label={t("coach.specialist.aria")}
            className="ms-auto inline-flex items-center gap-1.5 min-h-[44px] py-2 text-[11px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-lg"
            style={{ color: "var(--arbor-muted)" }}
          >
            <Icon name="stethoscope" size={14} style={{ color: "var(--arbor-green-ink)" }} />
            <span>{t("coach.specialist.lead")}</span>
            <span style={{ color: "var(--arbor-green-ink)" }}>{t("coach.specialist.cta")}</span>
            {uiLang === "he"
              ? <Icon name="chevron_left" size={14} style={{ color: "var(--arbor-green-ink)" }} />
              : <Icon name="chevron_right" size={14} style={{ color: "var(--arbor-green-ink)" }} />}
          </button>
        </div>
      </div>

      {/* Trust & Safety — surfaces the model's real risk + escalation (TS-1/TS-3) */}
      {lastMessage?.sender === "ai" && userTurnExists && (
        <TrustSafetyBar
          risk={lastMessage.contract ? riskFromLevel(lastMessage.contract.riskLevel) : parseRisk(lastMessage.text)}
          note={t("coach.trust.note")}
          lang={uiLang}
          onEscalate={() => setActiveTab("consult")}
        />
      )}

      {/* ASK-2: the docked composer — the SAME single element from the hero
          position, now sticky at the viewport bottom so the follow-up loop
          never requires scrolling back up. bottom-16 clears the fixed
          MobileNav bar; from lg the sidebar layout has no bottom bar. */}
      {composerDocked && (
        <div
          data-testid="coach-docked-composer"
          className="sticky bottom-16 lg:bottom-0 z-30"
          style={{ background: "var(--arbor-paper)", borderTop: "1px solid var(--arbor-rule)", boxShadow: "0 -6px 16px rgba(41,51,63,0.05)" }}
        >
          {composerSection}
        </div>
      )}

      {/* The parent-approved memory moderation queue was removed from Ask Arbor to
          keep the chat calm. Its full capability (pending review + approve/reject/
          forget of approved facts) lives in its real home: Profile › Child Memory
          (route "memory" → src/components/sections/ChildMemory.tsx), which renders
          the same pending/approved lists via the same handleMemoryDecision. */}

      {/* AI-V7: the voice surface — orb + live captions in a calm bottom
          sheet, owned entirely by voicePhase (unmounts when voice is off).
          Captions carry only the parent's own words (voiceInterim) and the
          already-screened spoken answer (liveVoiceText). Tap-orb = barge-in
          on the fallback loop (AI-V2(a)); X = end voice. */}
      {voicePhase !== "off" && (
        <VoiceOverlay
          phase={voicePhase}
          lang={uiLang}
          interimText={voiceInterim}
          answerText={liveVoiceText}
          canInterrupt={voicePhase === "speaking" && !liveSession}
          reducedMotion={reducedMotion}
          onOrbTap={() => { if (voicePhase === "speaking" && !liveCtlRef.current && voiceOnRef.current) bargeInVoice(); }}
          onClose={stopVoice}
        />
      )}

      <ArborVision
        open={!!visionMode}
        mode={visionMode || "observe"}
        onClose={() => setVisionMode(null)}
        childProfile={childProfile}
        onSeedCoach={(prompt) => { setChatInput(prompt); }}
        // AIX-S3(a): the handoff note is CONSUMED, not dropped — it prefills
        // the Consult composer (parent-editable) via the context seam. Prefill
        // is not consent: sharing still requires the explicit consult act.
        onGoHandoff={(note) => { requestConsultPrefill(note); setActiveTab("consult"); toast(t("coach.toast.handoffPrefilled"), "info"); }}
        // AIX-S3(b): suggestedMemory items route through the EXISTING parent-
        // approved propose seam — they land ONLY in the pending-approval queue
        // (Profile › Child Memory); nothing auto-approves.
        onProposeMemory={(fact) => proposeMemory(fact, { source: "vision", prompt: "vision:document" })}
        onGoBehaviors={(noteText) => { setNewLogNotes(noteText.slice(0, 400)); setActiveTab("behaviors"); toast(t("coach.toast.photoCaptured"), "info"); }}
      />
    </motion.div>
  );
}
