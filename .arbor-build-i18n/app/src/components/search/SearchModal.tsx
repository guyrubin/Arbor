import React, { useMemo, useState } from "react";
import { Modal } from "../ui/Modal";
import { Clock, Brain, CheckCircle2, Sliders, Search, CornerDownLeft, BarChart2, FileText, Compass } from "lucide-react";
import { useArbor, type ActiveTab } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { SECTIONS } from "../../lib/navigation";

// Views consolidated out of the primary nav in Wave 1 but still reachable —
// kept searchable so nothing becomes undiscoverable. Labels are translated at
// render via the i18n key suffixed by `key`.
const EXTRA_COMMANDS: { tab: ActiveTab; key: string; icon: React.ReactNode }[] = [
  { tab: "weekly", key: "weekly", icon: <BarChart2 className="w-3.5 h-3.5" style={{ color: "var(--arbor-green-ink)" }} /> },
  { tab: "handoff", key: "handoff", icon: <FileText className="w-3.5 h-3.5" style={{ color: "var(--arbor-green-ink)" }} /> },
  { tab: "scholar", key: "scholar", icon: <Compass className="w-3.5 h-3.5" style={{ color: "var(--arbor-green-ink)" }} /> },
];

type Result = { kind: string; icon: React.ReactNode; label: string; sub: string; go: () => void };

/** Command palette: jump to any section/capability + search the active child's
 *  logs, conversations, milestones and plans. */
export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { behaviorLogs, milestones, actionPlans, conversations, setActiveTab, openConversation } = useArbor();
  const { t } = useLanguage();
  const [q, setQ] = useState("");

  // Navigation commands across the six-section IA (always available).
  const commands = useMemo<Result[]>(() => {
    const out: Result[] = [];
    SECTIONS.forEach((sec) => {
      sec.items.forEach((it) => {
        const Icon = it.icon;
        out.push({
          kind: t("sm.kind.go"),
          icon: <Icon className="w-3.5 h-3.5" style={{ color: "var(--arbor-green-ink)" }} />,
          label: t("nav.tab." + it.tab),
          sub: t("nav." + sec.id),
          go: () => setActiveTab(it.tab),
        });
      });
    });
    return out;
  }, [setActiveTab, t]);

  // Consolidated views — only surfaced when the user actively searches for them.
  const extraCommands = useMemo<Result[]>(
    () => EXTRA_COMMANDS.map((c) => ({ kind: t("sm.kind.go"), icon: c.icon, label: t("sm.extra." + c.key), sub: t("sm.extra." + c.key + "Sub"), go: () => setActiveTab(c.tab) })),
    [setActiveTab, t]
  );

  const dataResults = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const out: Result[] = [];
    behaviorLogs.forEach((l) => {
      if (`${l.behaviorType} ${l.trigger} ${l.response} ${l.notes || ""}`.toLowerCase().includes(term))
        out.push({ kind: t("sm.kind.log"), icon: <Clock className="w-3.5 h-3.5" style={{ color: "var(--arbor-sky-ink)" }} />, label: l.behaviorType, sub: l.trigger, go: () => setActiveTab("behaviors") });
    });
    conversations.forEach((c) => {
      if (c.title.toLowerCase().includes(term) || c.messages.some((m) => m.text.toLowerCase().includes(term)))
        out.push({ kind: t("sm.kind.thread"), icon: <Brain className="w-3.5 h-3.5" style={{ color: "var(--arbor-peach-ink)" }} />, label: c.title, sub: t("sm.threadSub"), go: () => { openConversation(c.id); setActiveTab("coach"); } });
    });
    milestones.forEach((m) => {
      if (m.title.toLowerCase().includes(term))
        out.push({ kind: t("sm.kind.milestone"), icon: <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--arbor-green-ink)" }} />, label: m.title, sub: m.description, go: () => setActiveTab("milestones") });
    });
    actionPlans.forEach((p) => {
      if (`${p.title} ${p.issue}`.toLowerCase().includes(term))
        out.push({ kind: t("sm.kind.plan"), icon: <Sliders className="w-3.5 h-3.5" style={{ color: "var(--arbor-lav-ink)" }} />, label: p.title, sub: p.issue, go: () => setActiveTab("plans") });
    });
    return out.slice(0, 20);
  }, [q, behaviorLogs, milestones, actionPlans, conversations, setActiveTab, openConversation, t]);

  const term = q.trim().toLowerCase();
  const filteredCommands = term
    ? [...commands, ...extraCommands].filter((c) => `${c.label} ${c.sub}`.toLowerCase().includes(term))
    : commands;
  const shown: Result[] = term ? [...filteredCommands.slice(0, 6), ...dataResults] : filteredCommands;

  const run = (r: Result) => { r.go(); onClose(); setQ(""); };

  return (
    <Modal open={open} onClose={onClose} title={t("sm.title")}>
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--arbor-muted)" }} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && shown[0]) run(shown[0]); }}
            placeholder={t("sm.placeholder")}
            className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none"
            style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto space-y-1">
          {!term && <p className="text-[10px] font-bold uppercase tracking-wider px-1 pb-1" style={{ color: "var(--arbor-muted)" }}>{t("sm.goTo")}</p>}
          {term && shown.length === 0 && <p className="text-xs py-6 text-center" style={{ color: "var(--arbor-muted)" }}>{t("sm.noMatches")}</p>}
          {shown.map((r, i) => (
            <button
              key={i}
              onClick={() => run(r)}
              className="group w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition"
              style={{ background: "transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--arbor-paper-deep)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span className="flex-shrink-0">{r.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="text-sm font-bold truncate block" style={{ color: "var(--arbor-ink)" }}>{r.label}</span>
                <span className="text-[11px] truncate block" style={{ color: "var(--arbor-muted)" }}>{r.sub}</span>
              </span>
              {i === 0 && <CornerDownLeft className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100" style={{ color: "var(--arbor-muted)" }} />}
              <span className="text-[9px] uppercase font-black tracking-wider flex-shrink-0" style={{ color: "var(--arbor-muted)" }}>{r.kind}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
