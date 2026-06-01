import React from "react";
import { motion } from "motion/react";
import { RefreshCw, X, Check, Trash2, Copy, ClipboardList, ListPlus, ArrowRight } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { scholarsInfo } from "../../initialData";
import { MarkdownBlock } from "../ui/MarkdownBlock";

const FOLLOW_UPS = [
  "What should I avoid saying in that moment?",
  "How do I repair the connection afterwards?",
  "Give me a 1-minute calming routine to try.",
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
    chatBottomRef,
    memoryReviewItems,
    pendingMemoryItems,
    approvedMemoryItems,
    handleMemoryDecision,
    isMemoryUpdating,
    setActiveTab,
    setPlanChallengeTopic,
    setNewLogNotes,
  } = useArbor();
  const { toast } = useToast();

  const lastMessage = chatMessages[chatMessages.length - 1];
  const showFollowUps = !isChatLoading && lastMessage?.sender === "ai" && chatMessages.length > 1;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      {/* Header section with lens selector */}
      <div className="space-y-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Parent Development Coach</h2>
          <p className="text-sm text-[#a8a093] mt-1">Customize AI reasoning using developmental frameworks, age bands, and non-diagnostic parent support boundaries.</p>
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
                {msg.sender === "ai" && msg.lens && msg.lens !== "Integrated Balanced" && (
                  <span className="text-[10px] font-bold bg-[#d7aa55]/10 text-[#f4d991] px-2 py-0.5 rounded-full mb-3 inline-block">
                    Aligned with {msg.lens}
                  </span>
                )}
                <MarkdownBlock text={msg.text} />

                {msg.sender === "ai" && (
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
              Send Inquiry
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
    </motion.div>
  );
}
