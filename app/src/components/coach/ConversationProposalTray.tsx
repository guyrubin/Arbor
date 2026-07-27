import React from "react";
import type { ConversationProposal } from "../../lib/conversationProposals";
import { proposalConfidenceLabel } from "../../lib/conversationProposals";

const COPY = {
  en: {
    title: "Review before saving", none: "Nothing has been saved yet.", save: "Save", discard: "Discard",
    source: "From what you said", conflict: "This may change or repeat an existing record.",
    observation: "Observation", milestone: "Milestone", journal: "Journal", report_fact: "Report fact",
    clear: "Clear", check: "Check", uncertain: "Needs clarification",
  },
  he: {
    title: "בדיקה לפני השמירה", none: "עדיין לא נשמר דבר.", save: "שמירה", discard: "ויתור",
    source: "מתוך מה שאמרתם", conflict: "ייתכן שהעדכון משנה או חוזר על מידע קיים.",
    observation: "תצפית", milestone: "אבן דרך", journal: "יומן", report_fact: "פרט לדוח",
    clear: "ברור", check: "כדאי לבדוק", uncertain: "דרושה הבהרה",
  },
} as const;

export default function ConversationProposalTray({
  proposals,
  language,
  busyId,
  onEdit,
  onConfirm,
  onDiscard,
}: {
  proposals: ConversationProposal[];
  language: "en" | "he";
  busyId?: string | null;
  onEdit: (id: string, summary: string) => void;
  onConfirm: (proposal: ConversationProposal) => void;
  onDiscard: (id: string) => void;
}) {
  if (!proposals.length) return null;
  const c = COPY[language];
  return (
    <aside
      aria-label={c.title}
      dir={language === "he" ? "rtl" : "ltr"}
      className="fixed inset-x-3 bottom-[250px] z-50 mx-auto max-h-[48vh] w-auto max-w-[620px] overflow-y-auto rounded-[22px] p-4"
      style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule-strong)", boxShadow: "var(--shadow-lg)" }}
    >
      <div className="mb-3">
        <h2 className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{c.title}</h2>
        <p className="mt-0.5 text-[11px]" style={{ color: "var(--arbor-muted)" }}>{c.none}</p>
      </div>
      <div className="space-y-3">
        {proposals.map((proposal) => {
          const confidence = proposalConfidenceLabel(proposal.confidence);
          const busy = busyId === proposal.id;
          return (
            <article key={proposal.id} className="rounded-2xl p-3" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-extrabold uppercase tracking-wide" style={{ color: "var(--arbor-green-ink)" }}>
                <span>{c[proposal.target]}</span><span aria-hidden>·</span><span>{c[confidence]}</span>
              </div>
              <label className="mt-2 block">
                <span className="sr-only">{c[proposal.target]}</span>
                <textarea
                  value={proposal.summary}
                  onChange={(event) => onEdit(proposal.id, event.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-xl px-3 py-2 text-sm leading-relaxed focus:outline-none focus-visible:ring-2"
                  style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
                />
              </label>
              <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                <strong>{c.source}:</strong> “{proposal.sourceExcerpt}”
              </p>
              {proposal.conflict && <p role="alert" className="mt-2 text-[11px] font-bold" style={{ color: "var(--arbor-clay-ink)" }}>{c.conflict}</p>}
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" disabled={busy} onClick={() => onDiscard(proposal.id)} className="min-h-10 rounded-xl px-3 text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{c.discard}</button>
                <button type="button" disabled={busy || !proposal.summary.trim() || proposal.conflict?.code === "missing_milestone"} onClick={() => onConfirm(proposal)} className="min-h-10 rounded-xl px-4 text-xs font-extrabold disabled:opacity-50" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>{c.save}</button>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
