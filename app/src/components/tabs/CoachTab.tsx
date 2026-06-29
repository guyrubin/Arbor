import React, { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
import { RefreshCw, X, Check, Trash2, Copy, ClipboardList, ListPlus, ArrowRight, ArrowLeft, Plus, MessageSquare, Camera, FileText, Mic, Square, Users, Stethoscope, ChevronRight, ChevronLeft, AlertTriangle } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { Avatar } from "../ui/Avatar";
import { ArborMascot } from "../ui/ArborMascot";
import { scholarsInfo } from "../../initialData";
import { MarkdownBlock } from "../ui/MarkdownBlock";
import { TypewriterMarkdown } from "../ui/TypewriterMarkdown";
import { TrustSafetyBar, cardCls } from "../ui/kit";
import { T } from "../../lib/tokens";
import CoachAnswerCards from "../coach/CoachAnswerCards";
import { ShareButton } from "../ui/ShareButton";
import ArborVision from "../coach/ArborVision";
import { api, streamVoice, getAiLanguage } from "../../lib/api";
import type { BehaviorContext } from "../../types";
import type { ChatMessage } from "../../context/ArborContext";
import { startDictation, speechSupported } from "../../lib/speech";
import { speak, stopSpeaking, ttsSupported } from "../../lib/tts";
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

// Follow-ups: the visible label is translated (labelKey); the `prompt` sent to
// the model stays English on purpose (the model replies in aiLang).
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
    chatBottomRef,
    memoryReviewItems,
    pendingMemoryItems,
    approvedMemoryItems,
    handleMemoryDecision,
    isMemoryUpdating,
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
  } = useArbor();
  const { toast } = useToast();
  const { aiLang, setAiLang, t, uiLang } = useLanguage();
  const { user } = useAuth();
  const childFirst = (childProfile.name || "").split(" ")[0];
  const reducedMotion = usePrefersReducedMotion();

  // Last thing the parent asked — used to power the error-state Retry button.
  const lastUserText = [...chatMessages].reverse().find((m) => m.sender === "user")?.text;

  // Animate (typewriter) only AI messages that arrive after mount, not restored history.
  const revealedRef = useRef<number | null>(null);
  if (revealedRef.current === null) revealedRef.current = chatMessages.length - 1;

  const lastMessage = chatMessages[chatMessages.length - 1];
  const showFollowUps = !isChatLoading && lastMessage?.sender === "ai" && chatMessages.length > 1;

  // Arbor Vision (photo / document capture)
  const [visionMode, setVisionMode] = useState<null | "observe" | "document">(null);

  // Realtime voice coach: prefers Gemini Live (true bidirectional audio) when the
  // server reports it's available, and falls back to a hands-free browser loop —
  // listen (STT) → ask → speak (TTS) → listen again.
  const [voicePhase, setVoicePhase] = useState<"off" | "listening" | "thinking" | "speaking">("off");
  const [liveAvail, setLiveAvail] = useState(false);
  const liveCtlRef = useRef<null | { stop: () => void }>(null);
  const voiceOnRef = useRef(false);
  const stopDictationRef = useRef<null | (() => void)>(null);
  // Streaming-voice TTS queue (speak each sentence as it streams in).
  const ttsQueueRef = useRef<string[]>([]);
  const ttsSpeakingRef = useRef(false);
  const voiceBufRef = useRef("");
  const streamDoneRef = useRef(false);
  const voiceAbortRef = useRef<AbortController | null>(null);

  // Probe Gemini Live availability once.
  useEffect(() => {
    let cancelled = false;
    api.liveToken().then((r) => { if (!cancelled && r.available) setLiveAvail(true); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Speak queued sentences one at a time; when drained after a turn, resume listening.
  const pumpTts = () => {
    if (ttsSpeakingRef.current) return;
    const next = ttsQueueRef.current.shift();
    if (!next) {
      if (streamDoneRef.current) {
        streamDoneRef.current = false;
        if (voiceOnRef.current) startListening(); else setVoicePhase("off");
      }
      return;
    }
    ttsSpeakingRef.current = true;
    setVoicePhase("speaking");
    if (ttsSupported()) {
      speak(next, () => { ttsSpeakingRef.current = false; pumpTts(); });
    } else {
      ttsSpeakingRef.current = false;
      pumpTts();
    }
  };
  const enqueueSpeak = (s: string) => { if (s.trim()) { ttsQueueRef.current.push(s.trim()); pumpTts(); } };

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
          voiceBufRef.current += delta;
          const parts = voiceBufRef.current.split(/(?<=[.!?])\s+/);
          while (parts.length > 1) enqueueSpeak(parts.shift() as string);
          voiceBufRef.current = parts[0] || "";
        },
        controller.signal,
      );
      if (voiceBufRef.current.trim()) enqueueSpeak(voiceBufRef.current);
      voiceBufRef.current = "";
      streamDoneRef.current = true;
      pumpTts();
    } catch {
      if (voiceOnRef.current) startListening(); else setVoicePhase("off");
    } finally {
      voiceAbortRef.current = null;
    }
  };

  const startListening = () => {
    if (!speechSupported()) { toast("Voice input isn't supported in this browser", "info"); voiceOnRef.current = false; setVoicePhase("off"); return; }
    setVoicePhase("listening");
    stopDictationRef.current = startDictation(
      {
        onResult: (text) => {
          if (!text.trim()) { if (voiceOnRef.current) startListening(); return; }
          void streamVoiceTurn(text);
        },
        onError: () => { if (voiceOnRef.current) setVoicePhase("listening"); },
      },
      aiLang === "he" ? "he-IL" : "en-US",
    );
  };

  const stopVoice = () => {
    voiceOnRef.current = false;
    streamDoneRef.current = false;
    ttsQueueRef.current = [];
    ttsSpeakingRef.current = false;
    voiceAbortRef.current?.abort();
    stopDictationRef.current?.();
    stopSpeaking();
    liveCtlRef.current?.stop();
    liveCtlRef.current = null;
    setVoicePhase("off");
  };

  const startBrowserVoice = () => { voiceOnRef.current = true; startListening(); };

  const toggleVoice = async () => {
    if (voiceOnRef.current || voicePhase !== "off" || liveCtlRef.current) { stopVoice(); return; }

    // Prefer true Gemini Live when the server says it's provisioned.
    if (liveAvail) {
      try {
        const fresh = await api.liveToken();
        if (fresh.available && fresh.token && fresh.model) {
          const { startGeminiLive } = await import("../../lib/geminiLiveClient");
          setVoicePhase("thinking");
          liveCtlRef.current = await startGeminiLive(
            fresh.token,
            fresh.model,
            "You are Arbor, a warm, calm, non-diagnostic parenting coach. Keep spoken replies short, kind, and practical. Never diagnose; suggest professional help for safety concerns.",
            {
              onPhase: (p) => setVoicePhase(p === "closed" ? "off" : p === "connecting" ? "thinking" : p),
              onError: () => { liveCtlRef.current = null; toast("Switched to standard voice", "info"); startBrowserVoice(); },
            },
          );
          return;
        }
      } catch {
        liveCtlRef.current = null; // fall through to the browser loop
      }
    }
    startBrowserVoice();
  };

  // Stop any audio/recognition on unmount.
  useEffect(() => () => { stopDictationRef.current?.(); stopSpeaking(); voiceAbortRef.current?.abort(); liveCtlRef.current?.stop(); }, []);

  const voiceLabel = voicePhase === "listening" ? t("coach.voice.listening") : voicePhase === "thinking" ? t("coach.voice.thinking") : voicePhase === "speaking" ? t("coach.voice.speaking") : liveAvail ? t("coach.voice.talkHd") : t("coach.voice.talk");

  return (
    <motion.div initial={reducedMotion ? false : { opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      {/* Header section with lens selector */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-[2rem] leading-[1.12]" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("nav.tab.coach")}</h2>
            <p className="text-sm mt-1.5 max-w-2xl" style={{ color: "var(--arbor-muted)" }}>{t("coach.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline" style={{ color: "var(--arbor-muted)" }}>{t("coach.aiLang.label")}</span>
            <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
              <button
                onClick={() => setAiLang("en")}
                aria-pressed={aiLang === "en"}
                aria-label={t("coach.aiLang.en")}
                className="min-w-[44px] min-h-[44px] px-2.5 rounded-lg text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                style={aiLang === "en" ? { background: "var(--arbor-clay)", color: T.onAccent } : { color: "var(--arbor-muted)" }}
              >
                EN
              </button>
              <button
                onClick={() => setAiLang("he")}
                aria-pressed={aiLang === "he"}
                aria-label={t("coach.aiLang.he")}
                className="min-w-[44px] min-h-[44px] px-2.5 rounded-lg text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                style={aiLang === "he" ? { background: "var(--arbor-clay)", color: T.onAccent } : { color: "var(--arbor-muted)" }}
              >
                עב
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[10px] font-extrabold uppercase tracking-widest block" style={{ color: "var(--arbor-green-ink)" }}>{t("coach.lens")}</span>
            {/* IA: the inline picker selects between lenses; the library browses/learns them. */}
            <button
              type="button"
              onClick={() => setActiveTab("scholar")}
              className="inline-flex items-center gap-1 min-h-[44px] text-[11px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded-lg"
              style={{ color: "var(--arbor-muted)" }}
            >
              <span>{t("coach.lens.browseAll")}</span>
              {uiLang === "he"
                ? <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
                : <ChevronRight className="w-3.5 h-3.5" aria-hidden />}
            </button>
          </div>
          {(() => {
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
            return (
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("coach.lens")} onKeyDown={onKeyDown}>
                {(() => {
                  const on = selectedLens === "Integrated Balanced";
                  return (
                    <button
                      role="radio"
                      aria-checked={on}
                      tabIndex={on ? 0 : -1}
                      onClick={() => setSelectedLens("Integrated Balanced")}
                      className="px-3 py-2 min-h-[44px] rounded-xl text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                      style={on
                        ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" }
                        : { background: T.paperElevated, color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                    >
                      {t("coach.lens.integrated")}
                    </button>
                  );
                })()}
                {scholarsInfo.map((s, idx) => {
                  const on = selectedLens === s.name;
                  return (
                    <button
                      key={idx}
                      role="radio"
                      aria-checked={on}
                      tabIndex={on ? 0 : -1}
                      onClick={() => setSelectedLens(s.name)}
                      className="px-3 py-2 min-h-[44px] rounded-xl text-xs font-bold transition flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                      style={on
                        ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" }
                        : { background: T.paperElevated, color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                    >
                      <span className="w-4 h-4 text-[9px] font-black rounded flex items-center justify-center" style={{ background: on ? T.paperElevated : "var(--arbor-paper-deep)", color: "var(--arbor-green-ink)" }} aria-hidden>
                        {s.initial}
                      </span>
                      {s.name} ({s.concept})
                    </button>
                  );
                })}
              </div>
            );
          })()}
          {/* "Use this lens when…" — makes the lens choice practical, not academic */}
          {(() => {
            const active = scholarsInfo.find((s) => s.name === selectedLens);
            const hint = active?.useWhen
              || (selectedLens === "Integrated Balanced" ? t("coach.lens.integratedHint") : null);
            return hint ? (
              <p className="text-[11px] leading-relaxed rounded-lg p-2.5 mt-1" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
                {hint}
              </p>
            ) : null;
          })()}
        </div>
      </div>

      {/* Fast-start scenarios (IA-2) — shown on a fresh conversation */}
      {chatMessages.length <= 1 && (
        <div className="rounded-2xl p-4" style={{ background: "var(--arbor-peach-soft)" }}>
          <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-peach)" }}>{t("coach.fastStart")}</span>
          <div className="flex flex-wrap gap-2 mt-2.5">
            {SCENARIOS.map((s) => (
              <button
                key={s.labelKey}
                onClick={() => handleChatSend(s.prompt)}
                disabled={isChatLoading}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 min-h-[44px] text-sm font-bold bg-white transition motion-safe:hover:-translate-y-0.5 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                style={{ color: T.ink, border: "1px solid rgba(207,111,55,0.28)" }}
              >
                <span aria-hidden>{s.emoji}</span> {t(s.labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversation threads */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={newConversation}
          className="flex-shrink-0 flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1.5 rounded-full transition"
          style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
        >
          <Plus className="w-3.5 h-3.5" /> {t("coach.new")}
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
                <MessageSquare className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{c.title}</span>
              </button>
              <button onClick={() => deleteConversation(c.id)} aria-label={t("aria.deleteConversation")} className="transition" style={{ color: "var(--arbor-muted)" }}>
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Chat Viewport Area */}
      <div className={`${cardCls} flex flex-col h-[520px] overflow-hidden justify-between`}>
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

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
         <div className="max-w-[760px] mx-auto space-y-3.5">
          {/* Empty state — orient a first-run parent on what Ask Arbor does. */}
          {chatMessages.length <= 1 && !isChatLoading && (
            <div className="flex flex-col items-center justify-center text-center gap-3 py-10 px-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden" style={{ background: "var(--arbor-green-soft)" }} aria-hidden>
                <ArborMascot size={52} />
              </div>
              <p className="text-base font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("coach.empty.title", { name: childFirst })}</p>
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
              <div dir="auto" className="p-4 rounded-[18px] text-sm font-medium leading-[1.55]"
                style={msg.sender === "user"
                  ? { background: "var(--arbor-sky-soft)", color: "var(--arbor-ink)", borderEndEndRadius: 6 }
                  : { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", borderEndStartRadius: 6, boxShadow: "var(--shadow-sm)" }}>
                {msg.sender === "ai" && !msg.contract && msg.lens && msg.lens !== "Integrated Balanced" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mb-3 inline-block" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
                    {t("coach.alignedWith", { lens: msg.lens })}
                  </span>
                )}
                {msg.sender === "ai" ? (
                  msg.contract ? (
                    <CoachAnswerCards
                      contract={msg.contract}
                      lens={msg.lens}
                      council={msg.council}
                      onSaveToPlan={(topic) => {
                        setPlanChallengeTopic((topic || msg.text).replace(/[#*]/g, "").slice(0, 140));
                        setActiveTab("plans");
                        toast("Seeded the plan generator — tap Generate", "info");
                      }}
                      onCreateLog={async () => {
                        const prior = chatMessages[idx - 1];
                        const source = prior?.sender === "user" ? prior.text : msg.text;
                        toast("Drafting a log from this moment…", "info");
                        try {
                          const d = await api.extractLog({ message: source, childProfile });
                          if (d.behaviorType) setNewLogType(d.behaviorType);
                          if (d.intensity) setNewLogIntensity(Math.min(5, Math.max(1, Math.round(d.intensity))));
                          if (d.durationMinutes) setNewLogDuration(Math.max(0, Math.round(d.durationMinutes)));
                          const ctx = (["Home", "School", "Transit", "Public"].includes(d.context) ? d.context : "Home") as BehaviorContext;
                          setNewLogContext(ctx);
                          if (d.trigger) setNewLogTrigger(d.trigger);
                          if (d.response) setNewLogResponse(d.response);
                          setNewLogNotes(d.notes || "");
                          setActiveTab("behaviors");
                          toast("Arbor drafted a log — review and save", "success");
                        } catch {
                          setNewLogNotes(msg.contract!.nonDiagnosticHypotheses?.[0]?.rationale?.slice(0, 300) || source.slice(0, 300));
                          setActiveTab("behaviors");
                          toast("Capture the moment — a note is pre-filled", "info");
                        }
                      }}
                      onAddToHandoff={() => {
                        setActiveTab("consult");
                        toast("Teacher note copied — paste it into your Consult summary", "info");
                      }}
                    />
                  ) : (
                    <TypewriterMarkdown
                      text={msg.text}
                      enabled={!reducedMotion && idx === chatMessages.length - 1 && idx > (revealedRef.current ?? -1)}
                      onDone={() => {
                        revealedRef.current = idx;
                      }}
                    />
                  )
                ) : (
                  <MarkdownBlock text={msg.text} />
                )}

                {msg.sender === "ai" && !msg.contract && (
                  // Touch: always visible. Desktop: calm hover reveal. Keyboard: focus reveals.
                  <div className="flex items-center gap-3 mt-3 pt-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
                    <button
                      onClick={async () => { await navigator.clipboard?.writeText(msg.text); toast(t("coach.copied"), "success"); }}
                      aria-label={t("coach.action.copy")}
                      className="text-[10px] font-bold flex items-center gap-1 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded" style={{ color: "var(--arbor-muted)" }}
                    >
                      <Copy className="w-3 h-3" aria-hidden /> {t("coach.action.copy")}
                    </button>
                    <button
                      onClick={() => {
                        setNewLogNotes(msg.text.replace(/[#*]/g, "").trim().slice(0, 400));
                        setActiveTab("behaviors");
                        toast("Pre-filled a log from this guidance — review and save", "info");
                      }}
                      aria-label={t("coach.action.log")}
                      className="text-[10px] font-bold flex items-center gap-1 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded" style={{ color: "var(--arbor-muted)" }}
                    >
                      <ClipboardList className="w-3 h-3" aria-hidden /> {t("coach.action.log")}
                    </button>
                    <button
                      onClick={() => {
                        setPlanChallengeTopic(msg.text.replace(/[#*]/g, "").slice(0, 140));
                        setActiveTab("plans");
                        toast("Seeded the plan generator — tap Generate", "info");
                      }}
                      aria-label={t("coach.action.plan")}
                      className="text-[10px] font-bold flex items-center gap-1 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded" style={{ color: "var(--arbor-muted)" }}
                    >
                      <ListPlus className="w-3 h-3" aria-hidden /> {t("coach.action.plan")}
                    </button>
                    {/* mk-p0-3: 1-tap branded share of a settled answer (not while streaming). */}
                    {idx > (revealedRef.current ?? -1) ? null : (
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
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {showFollowUps && (
            <div className="flex flex-wrap gap-[9px] me-auto max-w-[85%] ps-11">
              {FOLLOW_UPS.map((q) => (
                <button
                  key={q.labelKey}
                  onClick={() => handleChatSend(q.prompt)}
                  className="text-[13px] px-4 py-1.5 min-h-[44px] rounded-full transition flex items-center gap-1.5 font-extrabold bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-green-ink)" }}
                >
                  {t(q.labelKey)}
                  {uiLang === "he"
                    ? <ArrowLeft className="w-3 h-3" aria-hidden />
                    : <ArrowRight className="w-3 h-3" aria-hidden />}
                </button>
              ))}
            </div>
          )}

          {isChatLoading && (
            <div className="flex gap-3 max-w-[85%] me-auto">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold animate-spin" style={{ background: "var(--arbor-peach-soft)", color: "var(--arbor-peach)" }} aria-hidden>
                <RefreshCw className="w-4 h-4" />
              </div>
              <div className="p-4 rounded-2xl text-xs flex items-center gap-3" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
                <span className="animate-pulse" aria-live="polite">{chatStreamStatus || t("coach.loading")}</span>
                <button
                  type="button"
                  onClick={handleCancelChat}
                  className="px-2 py-1 rounded-lg font-bold flex items-center gap-1"
                  style={{ background: T.paperElevated, border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}
                >
                  <X className="w-3 h-3" /> {t("coach.stop")}
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
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
              <div className="space-y-2">
                <p className="text-xs leading-relaxed font-bold">{t("coach.error")}</p>
                {lastUserText && (
                  <button
                    type="button"
                    onClick={() => handleChatSend(lastUserText)}
                    className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl text-xs font-extrabold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                    style={{ background: T.paperElevated, border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden /> {t("coach.retry")}
                  </button>
                )}
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
         </div>
        </div>

        <div className="p-4 space-y-2" style={{ borderTop: "1px solid var(--arbor-rule)", background: "var(--arbor-paper-deep)" }}>
          {/* Multimodal capture: show Arbor a photo or document, or talk hands-free */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setVisionMode("observe")}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition"
              style={{ background: T.paperElevated, border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}
            >
              <Camera className="w-3.5 h-3.5" /> {t("coach.photo")}
            </button>
            <button
              type="button"
              onClick={() => setVisionMode("document")}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition"
              style={{ background: T.paperElevated, border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}
            >
              <FileText className="w-3.5 h-3.5" /> {t("coach.document")}
            </button>
            <button
              type="button"
              onClick={toggleVoice}
              aria-pressed={voicePhase !== "off"}
              aria-label={voiceLabel}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 min-h-[44px] rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
              style={voicePhase !== "off"
                ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" }
                : { background: T.paperElevated, color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
            >
              {voicePhase === "off" ? <Mic className="w-3.5 h-3.5" aria-hidden /> : <Square className="w-3.5 h-3.5" aria-hidden />} {voiceLabel}
              {voicePhase !== "off" && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--arbor-clay)" }} aria-hidden />}
            </button>
          </div>
          <div className="flex items-center gap-2">
            {/* Capsule input + circular send. The send arrow is logical (Arrow
                flips Left/Right by uiLang) so it never points backwards in RTL. */}
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
              disabled={isChatLoading}
              placeholder={t("coach.placeholder", { name: childFirst })}
              className="flex-1 rounded-full px-[18px] py-3.5 text-sm focus:outline-none transition"
              style={{ background: T.paperElevated, border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
            />
            <button
              onClick={() => handleChatSend()}
              disabled={isChatLoading}
              aria-label={t("coach.send.aria")}
              className="text-white rounded-full transition flex items-center justify-center flex-shrink-0 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
              style={{ width: 48, height: 48, background: T.gradientCta }}
            >
              {uiLang === "he"
                ? <ArrowLeft className="w-5 h-5" aria-hidden />
                : <ArrowRight className="w-5 h-5" aria-hidden />}
            </button>
            <button
              onClick={() => handleCouncilSend()}
              disabled={isChatLoading}
              title={t("coach.councilHint")}
              aria-label={t("coach.councilHint")}
              className="font-extrabold text-sm px-4 py-3 rounded-xl transition flex items-center gap-2 flex-shrink-0 disabled:opacity-50"
              style={{ background: T.paperElevated, border: "1px solid rgba(52,178,119,0.30)", color: "var(--arbor-green-ink)" }}
            >
              <Users className="w-4 h-4" aria-hidden /> <span className="hidden sm:inline">{t("coach.council")}</span>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px]" style={{ color: "var(--arbor-muted)" }}>
            <span className="font-bold">{t("coach.suggested")}</span>
            {/* Visible label is translated; the prompt sent to the model stays English. */}
            <button
              onClick={() => handleChatSend(`${childProfile.name.split(" ")[0]} screams and hides behind the couch during shoe departures.`)}
              disabled={isChatLoading}
              className="px-2 py-0.5 rounded transition"
              style={{ background: T.paperElevated, border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}
            >
              {t("coach.suggest.shoe")}
            </button>
            <button
              onClick={() => handleChatSend("Suggestions for switching Hebrew and English language routines.")}
              disabled={isChatLoading}
              className="px-2 py-0.5 rounded transition"
              style={{ background: T.paperElevated, border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}
            >
              {t("coach.suggest.bilingual")}
            </button>
          </div>
          {/* ia-b6: persistent Ask-pillar door into the Ask-a-Specialist warm handoff.
              Navigation only — stays enabled while a coach answer is streaming. */}
          <div className="pt-1" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
            <button
              type="button"
              onClick={() => { setActiveTab("consult"); toast(t("coach.specialist.toast"), "info"); }}
              aria-label={t("coach.specialist.aria")}
              className="inline-flex items-center gap-1.5 min-h-[44px] py-2 text-[11px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-lg"
              style={{ color: "var(--arbor-muted)" }}
            >
              <Stethoscope className="w-3.5 h-3.5" aria-hidden style={{ color: "var(--arbor-green-ink)" }} />
              <span>{t("coach.specialist.lead")}</span>
              <span style={{ color: "var(--arbor-green-ink)" }}>{t("coach.specialist.cta")}</span>
              {uiLang === "he"
                ? <ChevronLeft className="w-3.5 h-3.5" aria-hidden style={{ color: "var(--arbor-green-ink)" }} />
                : <ChevronRight className="w-3.5 h-3.5" aria-hidden style={{ color: "var(--arbor-green-ink)" }} />}
            </button>
          </div>
        </div>
      </div>

      {/* Trust & Safety — surfaces the model's real risk + escalation (TS-1/TS-3) */}
      {lastMessage?.sender === "ai" && chatMessages.length > 1 && (
        <TrustSafetyBar
          risk={lastMessage.contract ? riskFromLevel(lastMessage.contract.riskLevel) : parseRisk(lastMessage.text)}
          note="Arbor's read of this answer"
          onEscalate={() => setActiveTab("consult")}
        />
      )}

      {/* Parent-approved memory review */}
      <div className={`${cardCls} p-5 space-y-4`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest block" style={{ color: "var(--arbor-green-ink)" }}>{t("coach.memReview")}</span>
            <h3 className="text-lg font-extrabold mt-1" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("coach.memQueue")}</h3>
            <p className="text-xs mt-1" style={{ color: "var(--arbor-muted)" }}>
              {t("coach.memDesc")}
            </p>
          </div>
          <div className="text-xs" style={{ color: "var(--arbor-muted)" }}>
            <strong style={{ color: "var(--arbor-ink)" }}>{pendingMemoryItems.length}</strong> {t("coach.pending")} · <strong style={{ color: "var(--arbor-ink)" }}>{approvedMemoryItems.length}</strong> {t("coach.approved")}
          </div>
        </div>

        {memoryReviewItems.length === 0 ? (
          <div className="text-xs rounded-xl p-4" style={{ color: "var(--arbor-muted)", background: "var(--arbor-paper-deep)" }}>
            {t("coach.memEmpty")}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {memoryReviewItems.slice(0, 6).map((item) => {
              const statusStyle =
                item.status === "approved" ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }
                : item.status === "rejected" ? { background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }
                : { background: "var(--arbor-yellow-soft)", color: "var(--arbor-yellow-ink)" };
              return (
                <div key={item.memoryId} className="rounded-xl p-4 space-y-3" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-1 rounded" style={statusStyle}>
                      {item.status}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--arbor-muted)" }}>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{item.fact}</p>
                  <div className="text-[10px] space-y-1" style={{ color: "var(--arbor-muted)" }}>
                    <p><strong style={{ color: "var(--arbor-ink)" }}>{t("coach.mem.source")}:</strong> {item.source}</p>
                    <p><strong style={{ color: "var(--arbor-ink)" }}>{t("coach.mem.retention")}:</strong> {item.retention}</p>
                    {item.frameRouting?.aim && <p><strong style={{ color: "var(--arbor-ink)" }}>{t("coach.mem.frame")}:</strong> {item.frameRouting.aim}</p>}
                  </div>
                  {item.status === "pending" && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleMemoryDecision(item.memoryId, "approved")}
                        disabled={isMemoryUpdating === item.memoryId}
                        className="flex-1 text-white font-extrabold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50"
                        style={{ background: "var(--arbor-clay)" }}
                      >
                        <Check className="w-3.5 h-3.5" /> {t("coach.approve")}
                      </button>
                      <button
                        onClick={() => handleMemoryDecision(item.memoryId, "rejected")}
                        disabled={isMemoryUpdating === item.memoryId}
                        className="flex-1 font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50"
                        style={{ background: T.paperElevated, border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> {t("coach.reject")}
                      </button>
                    </div>
                  )}
                  {item.status === "approved" && (
                    <button
                      onClick={() => handleMemoryDecision(item.memoryId, "deleted")}
                      disabled={isMemoryUpdating === item.memoryId}
                      className="w-full font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50"
                      style={{ background: T.paperElevated, border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> {t("coach.deleteActive")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ArborVision
        open={!!visionMode}
        mode={visionMode || "observe"}
        onClose={() => setVisionMode(null)}
        childProfile={childProfile}
        onSeedCoach={(prompt) => { setChatInput(prompt); }}
        onGoHandoff={() => { setActiveTab("consult"); toast("Note copied — paste it into your Consult summary", "info"); }}
        onGoBehaviors={(noteText) => { setNewLogNotes(noteText.slice(0, 400)); setActiveTab("behaviors"); toast("Captured from the photo — review and save", "info"); }}
      />
    </motion.div>
  );
}
