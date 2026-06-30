import React, { useCallback, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { api, PaywallError } from "../../lib/api";
import type { SchoolBrief as SchoolBriefData } from "../../types";
import { Modal } from "../ui/Modal";
import {
  initialExportState,
  markRendered,
  approveExport,
  canExport,
  buildSchoolBriefExport,
  serializeSchoolBrief,
  ClinicalLanguageError,
  OUTSIDE_ERASE_REACH_NOTICE_KEY,
  APPROVE_EXPORT_CTA_KEY,
  type ExportState,
} from "../../schoolBrief/schoolBrief";

/* AP-056 — School Handoff Brief (parent-controlled, teacher-facing).
 *
 * DISTINCT from Care › Consult (the clinician packet). This surface:
 *  - generates via the EXISTING /generate-handoff endpoint (audience="teacher"),
 *    which already escalation-screens (409) + redacts name/email/phone server-side;
 *  - shows the parent the EXACT rendered brief;
 *  - lets the parent PER-SECTION EDIT the curated fields before export (the
 *    editable payload is a transient `draft` in React state — never persisted;
 *    the export is built FROM the draft so the clinical-term scan inside
 *    buildSchoolBriefExport covers any parent edit, and fail-closes if a
 *    diagnosis term is typed into any field). Editing is MORE parent control
 *    over what leaves the app, not less;
 *  - blocks ANY export until an explicit per-export approval (state machine in
 *    ../../schoolBrief/schoolBrief.ts) — every edit RESETS that approval, so the
 *    parent re-approves the edited copy; the approval screen carries the
 *    outside-erase-reach notice;
 *  - builds the PDF/download body from the CURATED field set ONLY (the builder
 *    never reads raw memory-ledger / behavior-log fields);
 *  - is generate-and-present: it does NOT persist a new child-data record.
 */

type ListField = "keyStrengths" | "classroomChallenges" | "languageSupportPlan" | "suggestedTeacherStrategies";

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const GREEN = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";
const RULE = "var(--arbor-rule)";

export default function SchoolBrief() {
  const { childProfile, behaviorLogs, milestones } = useArbor();
  const { t } = useLanguage();
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const firstName = (childProfile.name || "your child").split(" ")[0];

  // generate-and-present: the brief lives in component state only — no new
  // persistent child-data store is created (Condition 6). `draft` is the
  // EDITABLE payload; the export is built from it, so the clinical-term scan
  // inside buildSchoolBriefExport covers any parent edit (Condition 3).
  const [draft, setDraft] = useState<SchoolBriefData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exportState, setExportState] = useState<ExportState>(initialExportState());
  const [reviewOpen, setReviewOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const sectionLabels = useMemo(
    () => ({
      overview: t("schoolBrief.section.overview", { name: firstName }),
      strengths: t("schoolBrief.section.calm", { name: firstName }),
      challenges: t("schoolBrief.section.transitions"),
      language: t("schoolBrief.section.language"),
      strategies: t("schoolBrief.section.strategies"),
    }),
    [t, firstName]
  );

  // Condition 2 + 3: the export payload is built from the curated allowlist only,
  // and — because it receives the EDITED draft — the clinical-term scan runs over
  // the post-edit content. Throws (ClinicalLanguageError) if any diagnosis term
  // slipped through (including one a parent typed into an edit field).
  const buildExport = useCallback(() => {
    if (!draft) return null;
    return buildSchoolBriefExport(draft, {
      title: t("schoolBrief.title") + ` — ${firstName}`,
      date: new Date().toISOString().slice(0, 10),
    });
  }, [draft, t, firstName]);

  // Condition 1: every edit RESETS the per-export approval — the parent must
  // re-approve the edited brief before it can leave the app. The state machine
  // stays idle → rendered → approved (no edit-bypass phase).
  const resetApproval = useCallback(() => {
    setExportState((s) => markRendered(s));
  }, []);

  const updateOverview = (val: string) => {
    setDraft((d) => (d ? { ...d, overview: val } : d));
    resetApproval();
  };
  const updateListItem = (field: ListField, idx: number, val: string) => {
    setDraft((d) => {
      if (!d) return d;
      const arr = [...(d[field] || [])];
      arr[idx] = val;
      return { ...d, [field]: arr };
    });
    resetApproval();
  };
  const addListItem = (field: ListField) => {
    setDraft((d) => (d ? { ...d, [field]: [...(d[field] || []), ""] } : d));
    resetApproval();
  };
  const removeListItem = (field: ListField, idx: number) => {
    setDraft((d) => {
      if (!d) return d;
      const arr = [...(d[field] || [])];
      arr.splice(idx, 1);
      return { ...d, [field]: arr };
    });
    resetApproval();
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const data = await api.generateBrief({
        childProfile,
        logs: behaviorLogs,
        milestones,
        audience: "teacher", // reuse the redacted + escalation-screened path
      });
      setDraft(data);
      setEditing(false);
      // A fresh brief is rendered but NOT approved — approval is per-export.
      setExportState(markRendered(initialExportState()));
    } catch (err: any) {
      if (err instanceof PaywallError) toast(err.message, "info");
      else if (err?.message?.includes("Professional support")) toast(err.message, "error");
      else toast("Couldn't build the note — please try again.", "error");
    } finally {
      setGenerating(false);
    }
  };

  // Condition 1: the explicit per-export approval. Only valid from `rendered`.
  const onApprove = () => {
    const approved = approveExport(exportState, new Date().toISOString());
    setExportState(approved);
    if (!canExport(approved)) {
      toast(t("schoolBrief.notApproved"), "error");
      return;
    }
    try {
      const ex = buildExport();
      if (!ex) return;
      const md = serializeSchoolBrief(ex, sectionLabels);
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${firstName}-school-handoff-${ex.date}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setReviewOpen(false);
      toast(t("schoolBrief.downloaded"), "success");
    } catch (err) {
      // Condition 3 fail-closed: a diagnosis term (incl. one edited in) means we DO NOT export.
      if (err instanceof ClinicalLanguageError) toast(t("schoolBrief.nonDiagnostic", { name: firstName }), "error");
      else toast("Couldn't build the note — please try again.", "error");
    }
  };

  const motionProps = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.2 } };

  return (
    <motion.div {...motionProps} className="space-y-5 max-w-[760px]">
      <header>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: GREEN }}>
          <Icon name="school" size={14} /> {t("schoolBrief.eyebrow")}
        </span>
        <h1 className="text-[1.6rem] font-extrabold leading-tight mt-0.5" style={{ fontFamily: "var(--font-display)", color: INK, textWrap: "balance" } as React.CSSProperties}>
          {t("schoolBrief.title")}
        </h1>
        <p className="text-sm mt-1.5 leading-relaxed" style={{ color: MUTED, textWrap: "pretty" } as React.CSSProperties}>
          {t("schoolBrief.subtitle", { name: firstName })}
        </p>
      </header>

      {/* Distinct-from-consult line — the two surfaces coexist. */}
      <p className="text-[12px] leading-relaxed rounded-xl p-3" style={{ background: "var(--arbor-paper-sunk)", color: MUTED, border: `1px solid ${RULE}` }}>
        {t("schoolBrief.distinct")}
      </p>

      {/* Non-diagnostic framing line. */}
      <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: GREEN_SOFT }}>
        <Icon name="favorite" size={20} fill={1} style={{ color: GREEN }} />
        <p className="text-[13px] leading-relaxed" style={{ color: GREEN }}>
          {t("schoolBrief.nonDiagnostic", { name: firstName })}
        </p>
      </div>

      {!draft ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}` }}>
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mx-auto" style={{ background: GREEN_SOFT, color: GREEN }}>
            <Icon name="school" size={26} />
          </span>
          <h2 className="text-[17px] font-extrabold mt-3" style={{ color: INK }}>{t("schoolBrief.empty.title")}</h2>
          <p className="text-sm mt-1.5 leading-relaxed max-w-[440px] mx-auto" style={{ color: MUTED }}>{t("schoolBrief.empty.body", { name: firstName })}</p>
          <button
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-xl px-5 py-3 mt-4 min-h-[44px] disabled:opacity-60"
            style={{ background: "var(--arbor-gradient-primary)", boxShadow: "var(--arbor-clay-glow)" }}
          >
            {generating
              ? (<><Icon name="progress_activity" size={16} className="animate-spin" /> {t("schoolBrief.generating")}</>)
              : (<><Icon name="auto_awesome" size={16} /> {t("schoolBrief.generate", { name: firstName })}</>)}
          </button>
        </div>
      ) : (
        <>
          {editing && (
            <p className="text-[12px] leading-relaxed" style={{ color: MUTED }}>{t("schoolBrief.editHint")}</p>
          )}

          {/* The rendered brief — curated sections only (editable when `editing`). */}
          <div className="rounded-2xl p-5 md:p-6 space-y-5" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}` }}>
            <Section icon={<Icon name="assignment" size={16} />} title={sectionLabels.overview}>
              {editing ? (
                <textarea
                  value={draft.overview}
                  onChange={(e) => updateOverview(e.target.value)}
                  rows={3}
                  className="w-full text-[14px] leading-relaxed rounded-lg px-2.5 py-2 resize-y min-h-[72px] focus:outline-none focus:ring-2"
                  style={{ color: INK, background: "var(--arbor-paper-sunk)", border: `1px solid ${RULE}` }}
                />
              ) : (
                <p className="text-[14px] leading-relaxed" style={{ color: MUTED }}>{draft.overview}</p>
              )}
            </Section>

            {editing ? (
              <>
                <EditableListSection icon={<Icon name="favorite" size={16} />} title={sectionLabels.strengths} items={draft.keyStrengths} field="keyStrengths" onUpdate={updateListItem} onAdd={addListItem} onRemove={removeListItem} addItemLabel={t("schoolBrief.addItem")} removeAria={t("schoolBrief.removeItem")} />
                <EditableListSection icon={<Icon name="sync_alt" size={16} />} title={sectionLabels.challenges} items={draft.classroomChallenges} field="classroomChallenges" onUpdate={updateListItem} onAdd={addListItem} onRemove={removeListItem} addItemLabel={t("schoolBrief.addItem")} removeAria={t("schoolBrief.removeItem")} />
                <EditableListSection icon={<Icon name="translate" size={16} />} title={sectionLabels.language} items={draft.languageSupportPlan} field="languageSupportPlan" onUpdate={updateListItem} onAdd={addListItem} onRemove={removeListItem} addItemLabel={t("schoolBrief.addItem")} removeAria={t("schoolBrief.removeItem")} />
                <EditableListSection icon={<Icon name="school" size={16} />} title={sectionLabels.strategies} items={draft.suggestedTeacherStrategies} field="suggestedTeacherStrategies" onUpdate={updateListItem} onAdd={addListItem} onRemove={removeListItem} addItemLabel={t("schoolBrief.addItem")} removeAria={t("schoolBrief.removeItem")} />
              </>
            ) : (
              <>
                <ListSection icon={<Icon name="favorite" size={16} />} title={sectionLabels.strengths} items={draft.keyStrengths} />
                <ListSection icon={<Icon name="sync_alt" size={16} />} title={sectionLabels.challenges} items={draft.classroomChallenges} />
                <ListSection icon={<Icon name="translate" size={16} />} title={sectionLabels.language} items={draft.languageSupportPlan} />
                <ListSection icon={<Icon name="school" size={16} />} title={sectionLabels.strategies} items={draft.suggestedTeacherStrategies} />
              </>
            )}
            <p className="text-[12px] leading-relaxed pt-1" style={{ color: "var(--arbor-faint)" }}>{t("schoolBrief.bilingualNote")}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={generate}
              disabled={generating}
              className="inline-flex items-center gap-2 font-bold text-sm rounded-xl px-4 py-3 min-h-[44px] disabled:opacity-50"
              style={{ background: "var(--arbor-paper-sunk)", color: INK, border: `1px solid ${RULE}` }}
            >
              <Icon name="refresh" size={16} className={generating ? "animate-spin" : undefined} /> {t("schoolBrief.regenerate")}
            </button>
            {/* Per-section edit toggle — keeps the default view calm; full edit power on demand. */}
            <button
              onClick={() => setEditing((e) => !e)}
              aria-pressed={editing}
              className="inline-flex items-center gap-2 font-bold text-sm rounded-xl px-4 py-3 min-h-[44px]"
              style={{ background: "var(--arbor-paper-sunk)", color: INK, border: `1px solid ${RULE}` }}
            >
              {editing ? (<><Icon name="check" size={16} style={{ color: GREEN }} /> {t("schoolBrief.editDone")}</>) : (<><Icon name="edit" size={16} /> {t("schoolBrief.edit")}</>)}
            </button>
            {/* Opening the review is NOT an export — export only fires after approve. */}
            <button
              onClick={() => setReviewOpen(true)}
              className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-xl px-4 py-3 min-h-[44px]"
              style={{ background: "var(--arbor-gradient-primary)", boxShadow: "var(--arbor-clay-glow)" }}
            >
              <Icon name="download" size={16} /> {t("schoolBrief.download")}
            </button>
          </div>
        </>
      )}

      {/* Approval screen (Condition 1 + 5) — the parent sees the exact brief,
          reads the outside-erase-reach notice, and must click approve to export. */}
      <Modal open={reviewOpen} onClose={() => setReviewOpen(false)} title={t("schoolBrief.reviewTitle")} maxWidth="max-w-xl">
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed" style={{ color: MUTED }}>{t("schoolBrief.reviewBody", { name: firstName })}</p>

          {/* Condition 5: outside-erase-reach notice — plainly stated. */}
          <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: "var(--arbor-pink-soft)" }}>
            <Icon name="gpp_maybe" size={20} style={{ color: "var(--arbor-pink-ink)" }} />
            <p className="text-[13px] leading-relaxed font-semibold" style={{ color: "var(--arbor-pink-ink)" }}>
              {t(OUTSIDE_ERASE_REACH_NOTICE_KEY)}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            <button
              onClick={() => setReviewOpen(false)}
              className="inline-flex items-center font-bold text-sm rounded-xl px-4 py-3 min-h-[44px]"
              style={{ background: "var(--arbor-paper-sunk)", color: MUTED, border: `1px solid ${RULE}` }}
            >
              {t("schoolBrief.cancel")}
            </button>
            <button
              onClick={onApprove}
              className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-xl px-5 py-3 min-h-[44px]"
              style={{ background: "var(--arbor-gradient-primary)", boxShadow: "var(--arbor-clay-glow)" }}
            >
              <Icon name="download" size={16} /> {t(APPROVE_EXPORT_CTA_KEY)}
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="text-[15px] font-extrabold inline-flex items-center gap-2" style={{ color: INK }}>
        <span style={{ color: GREEN }}>{icon}</span> {title}
      </h2>
      {children}
    </section>
  );
}

function ListSection({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <Section icon={icon} title={title}>
      <ul className="list-disc ps-5 space-y-1" style={{ color: MUTED }}>
        {items.map((it, i) => <li key={i} className="text-[14px] leading-relaxed">{it}</li>)}
      </ul>
    </Section>
  );
}

function EditableListSection({ icon, title, items, field, onUpdate, onAdd, onRemove, addItemLabel, removeAria }: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  field: ListField;
  onUpdate: (field: ListField, idx: number, val: string) => void;
  onAdd: (field: ListField) => void;
  onRemove: (field: ListField, idx: number) => void;
  addItemLabel: string;
  removeAria: string;
}) {
  return (
    <Section icon={icon} title={title}>
      <div className="space-y-1.5">
        {(items || []).map((it, i) => (
          <div key={i} className="flex items-start gap-2">
            <input
              value={it}
              onChange={(e) => onUpdate(field, i, e.target.value)}
              className="flex-1 text-[14px] leading-relaxed rounded-lg px-2.5 py-1.5 min-h-[40px] focus:outline-none focus:ring-2"
              style={{ color: INK, background: "var(--arbor-paper-sunk)", border: `1px solid ${RULE}` }}
            />
            <button
              type="button"
              onClick={() => onRemove(field, i)}
              aria-label={removeAria}
              className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg mt-0.5"
              style={{ color: MUTED, border: `1px solid ${RULE}` }}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onAdd(field)}
          className="inline-flex items-center gap-1.5 text-[13px] font-bold mt-1"
          style={{ color: GREEN }}
        >
          <Icon name="add" size={14} /> {addItemLabel}
        </button>
      </div>
    </Section>
  );
}
