import React, { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
import { RefreshCw, X, Check, Trash2, Copy, ClipboardList, ListPlus, ArrowRight, Plus, MessageSquare, Camera, FileText, Mic, Square, Users } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { scholarsInfo } from "../../initialData";
import { MarkdownBlock } from "../ui/MarkdownBlock";
import { TypewriterMarkdown } from "../ui/TypewriterMarkdown";
import { TrustSafetyBar } from "../ui/kit";
import CoachAnswerCards from "../coach/CoachAnswerCards";
import ArborVision from "../coach/ArborVision";
import { api, streamVoice, getAiLanguage } from "../../lib/api";
import type { BehaviorContext } from "../../types";
import type { ChatMessage } from "../../context/ArborContext";
import { startDictation, speechSupported } from "../../lib/speech";
import { speak, stopSpeaking, ttsSupported } from "../../lib/tts";

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

const FOLLOW_UPS = [
  "What should I avoid saying in that moment?",
  "How do I repair the connection afterwards?",
  "Give me a 1-minute calming routine to try.",
];

// IA-2: fast-start scenarios — the most common hard moments, one tap away.
const SCENARIOS: { emoji: string; label: string; prompt: string }[] = [
  { emoji: "🌅", label: "Morning refusal", prompt: "My child refuses to get dressed and leave the house in the morning. What may be happening and what do I do today?" },
  { emoji: "📱", label: "iPad dispute", prompt: "Turning off the iPad ends in a meltdown. Give me what may be happening, an exact script, and what to avoid." },
  { emoji: "🧒", label: "Sibling clash", prompt: "My children keep fighting over toys. Help me understand it and give me a calm script to use in the moment." },
  { emoji: "🌙", label: "Bedtime battle", prompt: "Bedtime takes over an hour with lots of resistance. What's a calm wind-down plan and script?" },
  { emoji: "🏫", label: "School dropoff", prompt: "My child cries and clings at school dropoff. What may be happening and exactly what do I say?" },
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
  } = useArbor();
  const { toast } = useToast();
  const { aiLang, setAiLang } = useLanguage();

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

  const voiceLabel = voicePhase === "listening" ? "Listening…" : voicePhase === "thinking" ? "Thinking…" : voicePhase === "speaking" ? "Speaking…" : liveAvail ? "Talk (HD)" : "Talk";

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      {/* Header section with lens selector */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Ask Arbor</h2>
            <p className="text-sm text-[#a8a093] mt-1">Calm guidance and exact words for hard parenting moments — age-aware, non-diagnostic, with escalation guidance built in.</p>
          </div>
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/10 rounded-xl p-1 flex-shrink-0" title="Language for AI responses">
            <button
              onClick={() => setAiLang("en")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${aiLang === "en" ? "bg-[#d7aa55] text-black" : "text-[#a8a093] hover:text-white"}`}
            >
              EN
            </button>
            <button
              onClick={() => setAiLang("he")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${aiLang === "he" ? "bg-[#d7aa55] text-black" : "text-[#a8a093] hover:text-white"}`}
            >
              עב
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-black uppercase text-[#f4d991] tracking-widest block">Active Scholar Lens</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedLens("Integrated Balanced")}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                selectedLens === "Integrated Balanced"
                  ? "bg-amber-500/10 text-[#f4d991] border-amber-500/30"
                  : "bg-white/[0.02] text-[#a8a093] border-white/5 hover:bg-white/5"
              }`}
            >
              🌟 Integrated Balanced
            </button>
            {scholarsInfo.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedLens(s.name)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-2 ${
                  selectedLens === s.name
                    ? "bg-[#d7aa55]/15 text-[#f4d991] border-[#d7aa55]/40 shadow-lg shadow-[#d7aa55]/5"
                    : "bg-white/[0.02] text-[#a8a093] border-white/5 hover:bg-white/5"
                }`}
              >
                <span className="w-4 h-4 bg-white/5 text-[9px] font-black rounded flex items-center justify-center text-[#f4d991]">
                  {s.initial}
                </span>
                {s.name} ({s.concept})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Fast-start scenarios (IA-2) — shown on a fresh conversation */}
      {chatMessages.length <= 1 && (
        <div className="rounded-2xl p-4" style={{ background: "#fdeada" }}>
          <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "#cf6f37" }}>Fast start — pick a moment</span>
          <div className="flex flex-wrap gap-2 mt-2.5">
            {SCENARIOS.map((s) => (
              <button
                key={s.label}
                onClick={() => handleChatSend(s.prompt)}
                disabled={isChatLoading}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold bg-white transition hover:-translate-y-0.5 disabled:opacity-60"
                style={{ color: "#29333f", border: "1px solid rgba(207,111,55,0.28)" }}
              >
                <span aria-hidden>{s.emoji}</span> {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversation threads */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={newConversation}
          className="flex-shrink-0 flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1.5 rounded-full border border-[#d7aa55]/25 bg-[#d7aa55]/10 text-[#f4d991] hover:bg-[#d7aa55]/20 transition"
        >
          <Plus className="w-3.5 h-3.5" /> New
        </button>
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`flex-shrink-0 flex items-center gap-1.5 rounded-full border pl-3 pr-1.5 py-1 transition ${
              c.id === activeConversationId ? "bg-white/5 border-white/15" : "bg-white/[0.02] border-white/5 hover:bg-white/5"
            }`}
          >
            <button onClick={() => openConversation(c.id)} className="flex items-center gap-1.5 text-[11px] font-bold text-[#a8a093] hover:text-white max-w-[160px] truncate">
              <MessageSquare className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{c.title}</span>
            </button>
            <button onClick={() => deleteConversation(c.id)} aria-label="Delete conversation" className="text-[#a8a093] hover:text-red-400 transition">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Chat Viewport Area */}
      <div className="border border-white/10 rounded-2xl bg-[#141821] flex flex-col h-[520px] overflow-hidden justify-between">
        <div className="bg-white/[0.03] px-4 py-2 text-xs text-[#a8a093] border-b border-white/5 flex items-center justify-between">
          <span>Conversation Frame: <strong>Active child context</strong></span>
          <span className="text-[#f4d991] font-bold flex items-center gap-1.5">
            {isChatLoading && <span className="w-1.5 h-1.5 rounded-full bg-[#d7aa55] animate-pulse" />}
            Lens: {selectedLens}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 max-w-[85%] group ${msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                msg.sender === "user" ? "bg-blue-500/20 text-blue-400" : "bg-[#d7aa55]/20 text-[#f4d991]"
              }`}>
                {msg.sender === "user" ? "U" : "Ar"}
              </div>
              <div className={`p-4 rounded-2xl text-sm ${
                msg.sender === "user"
                  ? "bg-blue-950/30 border border-blue-500/15 text-white"
                  : "bg-white/[0.02] border border-white/5 text-gray-100"
              }`}>
                {msg.sender === "ai" && !msg.contract && msg.lens && msg.lens !== "Integrated Balanced" && (
                  <span className="text-[10px] font-bold bg-[#d7aa55]/10 text-[#f4d991] px-2 py-0.5 rounded-full mb-3 inline-block">
                    Aligned with {msg.lens}
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
                        setActiveTab("handoff");
                        toast("Teacher note copied — paste it into the handoff", "info");
                      }}
                    />
                  ) : (
                    <TypewriterMarkdown
                      text={msg.text}
                      enabled={idx === chatMessages.length - 1 && idx > (revealedRef.current ?? -1)}
                      onDone={() => {
                        revealedRef.current = idx;
                      }}
                    />
                  )
                ) : (
                  <MarkdownBlock text={msg.text} />
                )}

                {msg.sender === "ai" && !msg.contract && (
                  <div className="flex items-center gap-3 mt-3 pt-2 border-t border-white/5 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => navigator.clipboard?.writeText(msg.text)} className="text-[10px] font-bold text-[#a8a093] hover:text-white flex items-center gap-1">
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                    <button
                      onClick={() => {
                        setNewLogNotes(msg.text.replace(/[#*]/g, "").trim().slice(0, 400));
                        setActiveTab("behaviors");
                        toast("Pre-filled a log from this guidance — review and save", "info");
                      }}
                      className="text-[10px] font-bold text-[#a8a093] hover:text-white flex items-center gap-1"
                    >
                      <ClipboardList className="w-3 h-3" /> Log this
                    </button>
                    <button
                      onClick={() => {
                        setPlanChallengeTopic(msg.text.replace(/[#*]/g, "").slice(0, 140));
                        setActiveTab("plans");
                        toast("Seeded the plan generator — tap Generate", "info");
                      }}
                      className="text-[10px] font-bold text-[#a8a093] hover:text-white flex items-center gap-1"
                    >
                      <ListPlus className="w-3 h-3" /> Save to Action Plan
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {showFollowUps && (
            <div className="flex flex-wrap gap-2 mr-auto max-w-[85%] pl-11">
              {FOLLOW_UPS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleChatSend(q)}
                  className="text-[11px] text-[#f4d991] bg-[#d7aa55]/10 hover:bg-[#d7aa55]/20 border border-[#d7aa55]/25 px-3 py-1.5 rounded-full transition flex items-center gap-1.5"
                >
                  {q} <ArrowRight className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}

          {isChatLoading && (
            <div className="flex gap-3 max-w-[85%] mr-auto">
              <div className="w-8 h-8 rounded-xl bg-[#d7aa55]/20 text-[#f4d991] flex items-center justify-center text-xs font-bold animate-spin">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 text-xs text-gray-400 flex items-center gap-3">
                <span className="animate-pulse">{chatStreamStatus || "Arbor developmental model synthesizing guidance..."}</span>
                <button
                  type="button"
                  onClick={handleCancelChat}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-[#a8a093] hover:text-white px-2 py-1 rounded-lg font-bold flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Stop
                </button>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        <div className="p-4 border-t border-white/5 bg-white/[0.01] space-y-2">
          {/* Multimodal capture: show Arbor a photo or document, or talk hands-free */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setVisionMode("observe")}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white/5 hover:bg-white/10 text-[#a8a093] hover:text-white border border-white/10 px-2.5 py-1.5 rounded-lg transition"
            >
              <Camera className="w-3.5 h-3.5" /> Photo
            </button>
            <button
              type="button"
              onClick={() => setVisionMode("document")}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white/5 hover:bg-white/10 text-[#a8a093] hover:text-white border border-white/10 px-2.5 py-1.5 rounded-lg transition"
            >
              <FileText className="w-3.5 h-3.5" /> Document
            </button>
            <button
              type="button"
              onClick={toggleVoice}
              aria-pressed={voicePhase !== "off"}
              className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition ${
                voicePhase !== "off"
                  ? "bg-[#d7aa55]/15 text-[#f4d991] border-[#d7aa55]/40"
                  : "bg-white/5 hover:bg-white/10 text-[#a8a093] hover:text-white border-white/10"
              }`}
            >
              {voicePhase === "off" ? <Mic className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />} {voiceLabel}
              {voicePhase !== "off" && <span className="w-1.5 h-1.5 rounded-full bg-[#f4d991] animate-pulse" />}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
              disabled={isChatLoading}
              placeholder="Discuss behavior logs, dropoff problems or trigger resets (e.g. tablet disputes)..."
              className="flex-1 bg-[#08090c] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d7aa55]/50 transition"
            />
            <button
              onClick={() => handleChatSend()}
              disabled={isChatLoading}
              className="bg-[#d7aa55] hover:bg-[#c39947] disabled:bg-white/5 disabled:text-[#a8a093] text-black font-extrabold text-sm px-5 py-3 rounded-xl transition flex items-center gap-2"
            >
              Send
            </button>
            <button
              onClick={() => handleCouncilSend()}
              disabled={isChatLoading}
              title="Convene 3 scholars — each weighs in, then Arbor synthesizes"
              className="bg-white/5 hover:bg-white/10 disabled:opacity-50 text-[#f4d991] border border-[#d7aa55]/30 font-extrabold text-sm px-4 py-3 rounded-xl transition flex items-center gap-2"
            >
              <Users className="w-4 h-4" /> Council
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
            <span className="font-bold">Suggested Sandbox prompts:</span>
            <button
              onClick={() => handleChatSend("Dylan screams and hides behind the couch during shoe departures.")}
              disabled={isChatLoading}
              className="hover:text-white bg-white/5 px-2 py-0.5 rounded border border-white/5"
            >
              Shoe departure tantrum
            </button>
            <button
              onClick={() => handleChatSend("Suggestions for switching Hebrew and English language routines.")}
              disabled={isChatLoading}
              className="hover:text-white bg-white/5 px-2 py-0.5 rounded border border-white/5"
            >
              Bilingual balance routine
            </button>
          </div>
        </div>
      </div>

      {/* Trust & Safety — surfaces the model's real risk + escalation (TS-1/TS-3) */}
      {lastMessage?.sender === "ai" && chatMessages.length > 1 && (
        <TrustSafetyBar
          risk={lastMessage.contract ? riskFromLevel(lastMessage.contract.riskLevel) : parseRisk(lastMessage.text)}
          note="Arbor's read of this answer"
          onEscalate={() => setActiveTab("find-pro")}
        />
      )}

      {/* Parent-approved memory review */}
      <div className="border border-white/10 rounded-2xl bg-[#141821] p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <span className="text-[10px] font-black uppercase text-[#f4d991] tracking-widest block">Memory Review</span>
            <h3 className="text-lg font-extrabold text-white mt-1">Parent approval queue</h3>
            <p className="text-xs text-[#a8a093] mt-1">
              Arbor saves proposed observations as pending review. They become active child memory only after approval.
            </p>
          </div>
          <div className="text-xs text-[#a8a093]">
            <strong className="text-white">{pendingMemoryItems.length}</strong> pending · <strong className="text-white">{approvedMemoryItems.length}</strong> approved
          </div>
        </div>

        {memoryReviewItems.length === 0 ? (
          <div className="text-xs text-[#a8a093] border border-white/5 rounded-xl p-4 bg-white/[0.01]">
            Ask the coach a question to generate reviewable observations. Nothing is active memory yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {memoryReviewItems.slice(0, 6).map((item) => (
              <div key={item.memoryId} className="border border-white/5 rounded-xl p-4 bg-white/[0.015] space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                    item.status === "approved"
                      ? "bg-green-500/10 text-green-500"
                      : item.status === "rejected"
                        ? "bg-red-500/10 text-red-500"
                        : "bg-[#d7aa55]/10 text-[#f4d991]"
                  }`}>
                    {item.status}
                  </span>
                  <span className="text-[10px] text-[#a8a093]">{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-gray-200 leading-relaxed">{item.fact}</p>
                <div className="text-[10px] text-[#a8a093] space-y-1">
                  <p><strong className="text-white">Source:</strong> {item.source}</p>
                  <p><strong className="text-white">Retention:</strong> {item.retention}</p>
                  {item.frameRouting?.aim && <p><strong className="text-white">Frame:</strong> {item.frameRouting.aim}</p>}
                </div>
                {item.status === "pending" && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleMemoryDecision(item.memoryId, "approved")}
                      disabled={isMemoryUpdating === item.memoryId}
                      className="flex-1 bg-[#d7aa55] text-black font-extrabold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => handleMemoryDecision(item.memoryId, "rejected")}
                      disabled={isMemoryUpdating === item.memoryId}
                      className="flex-1 bg-white/5 border border-white/10 text-[#a8a093] font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                )}
                {item.status === "approved" && (
                  <button
                    onClick={() => handleMemoryDecision(item.memoryId, "deleted")}
                    disabled={isMemoryUpdating === item.memoryId}
                    className="w-full bg-white/5 border border-white/10 text-[#a8a093] font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete from active memory
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ArborVision
        open={!!visionMode}
        mode={visionMode || "observe"}
        onClose={() => setVisionMode(null)}
        childProfile={childProfile}
        onSeedCoach={(prompt) => { setChatInput(prompt); }}
        onGoHandoff={() => { setActiveTab("handoff"); toast("Note copied — paste it into the handoff", "info"); }}
        onGoBehaviors={(noteText) => { setNewLogNotes(noteText.slice(0, 400)); setActiveTab("behaviors"); toast("Captured from the photo — review and save", "info"); }}
      />
    </motion.div>
  );
}
