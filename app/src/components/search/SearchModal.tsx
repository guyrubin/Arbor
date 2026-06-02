import React, { useMemo, useState } from "react";
import { Modal } from "../ui/Modal";
import { Clock, Brain, CheckCircle2, Sliders, Search } from "lucide-react";
import { useArbor } from "../../context/ArborContext";

type Result = { kind: string; icon: React.ReactNode; label: string; sub: string; go: () => void };

/** Global search across the active child's logs, conversations, milestones, and plans. */
export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { behaviorLogs, milestones, actionPlans, conversations, setActiveTab, openConversation } = useArbor();
  const [q, setQ] = useState("");

  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const out: Result[] = [];

    behaviorLogs.forEach((l) => {
      if (`${l.behaviorType} ${l.trigger} ${l.response} ${l.notes || ""}`.toLowerCase().includes(term)) {
        out.push({
          kind: "Log",
          icon: <Clock className="w-3.5 h-3.5 text-blue-400" />,
          label: l.behaviorType,
          sub: l.trigger,
          go: () => setActiveTab("behaviors"),
        });
      }
    });
    conversations.forEach((c) => {
      const inMsgs = c.messages.some((m) => m.text.toLowerCase().includes(term));
      if (c.title.toLowerCase().includes(term) || inMsgs) {
        out.push({
          kind: "Conversation",
          icon: <Brain className="w-3.5 h-3.5 text-[#d7aa55]" />,
          label: c.title,
          sub: "Parent Coach thread",
          go: () => {
            openConversation(c.id);
            setActiveTab("coach");
          },
        });
      }
    });
    milestones.forEach((m) => {
      if (m.title.toLowerCase().includes(term)) {
        out.push({
          kind: "Milestone",
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
          label: m.title,
          sub: m.description,
          go: () => setActiveTab("milestones"),
        });
      }
    });
    actionPlans.forEach((p) => {
      if (`${p.title} ${p.issue}`.toLowerCase().includes(term)) {
        out.push({
          kind: "Plan",
          icon: <Sliders className="w-3.5 h-3.5 text-purple-400" />,
          label: p.title,
          sub: p.issue,
          go: () => setActiveTab("plans"),
        });
      }
    });
    return out.slice(0, 24);
  }, [q, behaviorLogs, milestones, actionPlans, conversations, setActiveTab, openConversation]);

  return (
    <Modal open={open} onClose={onClose} title="Search">
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#a8a093] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search logs, conversations, milestones, plans…"
            className="w-full bg-[#08090c] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d7aa55]/50"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto space-y-1">
          {q.trim() && results.length === 0 && <p className="text-xs text-[#a8a093] py-6 text-center">No matches.</p>}
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => {
                r.go();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-white/5 transition"
            >
              <span className="flex-shrink-0">{r.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="text-sm text-white font-bold truncate block">{r.label}</span>
                <span className="text-[11px] text-[#a8a093] truncate block">{r.sub}</span>
              </span>
              <span className="text-[9px] uppercase font-black tracking-wider text-[#a8a093] flex-shrink-0">{r.kind}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
