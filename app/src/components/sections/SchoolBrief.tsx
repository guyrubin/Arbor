import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { api, PaywallError, EscalationRequiredError } from "../../lib/api";
import type { BehaviorLog, Milestone, SchoolBrief as SchoolBriefData } from "../../types";
import type { HandoffLogInput, HandoffMilestoneInput } from "../../lib/api";
import { buildPacketInput, milestoneInAgeWindow, teacherBriefDraft } from "../../consult/packet";
import { takeTeacherNote } from "../../schoolBrief/teacherHandoff";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { screenForImmediateEscalation } from "../../safety/escalation";
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
  // LC-11
  schoolBriefToPrintSections,
  parentEscalationNote,
  assertEscalationNoteNotExported,
  type ExportState,
} from "../../schoolBrief/schoolBrief";
// LC-11: the teacher receives a real document through the shared, native-aware
// print egress — not a Markdown blob a gan teacher cannot open.
import { openPrintableReport } from "../../lib/reportExport";

/* AP-056 — School Handoff Brief (parent-controlled, teacher-facing).
 *
 * B-CAREPRO-27: THE teacher document — Consult's teacher audience opens here.
 * This surface:
 *  - OPENS on a free, deterministic draft from the teacher preset
 *    (consult/packet.teacherBriefDraft: about → overview, the profile's
 *    strengths → strengths, what the family already tries → strategies), in
 *    the parent's language, built on the device;
 *  - "Draft with Arbor" (Plus) replaces it via the EXISTING /generate-handoff
 *    endpoint (audience="teacher"), which already escalation-screens (409) +
 *    redacts name/email/phone server-side;
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

/** B-CAREPRO-12: the teacher-preset window. */
export const BRIEF_WINDOW_DAYS = 30;

/** B-CAREPRO-12 — what the School Brief sends to /generate-handoff: logs from
 *  the last 30 days as {behaviorType, trigger, response, day} (no notes,
 *  intensity, duration, photo, excerpt) and the OBSERVED milestones inside the
 *  child's age window as {domain, title}. Never the whole record. */
export function teacherBriefInput(
  logs: BehaviorLog[],
  milestones: Milestone[],
  childAgeMonths: number,
  nowMs: number = Date.now(),
): { logs: HandoffLogInput[]; milestones: HandoffMilestoneInput[] } {
  const cutoff = nowMs - BRIEF_WINDOW_DAYS * 86_400_000;
  return {
    logs: logs
      .filter((l) => Number.isFinite(Date.parse(l.timestamp)) && Date.parse(l.timestamp) >= cutoff)
      .map((l) => ({ behaviorType: l.behaviorType ?? "", trigger: l.trigger ?? "", response: l.response ?? "", day: l.timestamp.slice(0, 10) })),
    milestones: milestones
      .filter((m) => m.checked && milestoneInAgeWindow(m.ageMonths, childAgeMonths))
      .map((m) => ({ domain: m.domain, title: m.title })),
  };
}

/** B-CAREPRO-12: the escalation screen keeps its coverage. The server used to
 *  screen every log's behaviorType/trigger/response/notes; notes no longer
 *  leave the device, so the same screen runs here over the FULL record first. */
export function recordNeedsEscalation(logs: BehaviorLog[]): boolean {
  const text = logs.map((l) => [l.behaviorType, l.trigger, l.response, l.notes].filter(Boolean).join(" ")).join("\n");
  return screenForImmediateEscalation({ handoffLogs: text }) !== null;
}

type ListField = "keyStrengths" | "classroomChallenges" | "languageSupportPlan" | "suggestedTeacherStrategies";

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const GREEN = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";
const RULE = "var(--arbor-rule)";

export default function SchoolBrief() {
  const { childProfile, behaviorLogs, milestones, actionPlans, setActiveTab, openPaywall } = useArbor();
  const { t, uiLang } = useLanguage();
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const firstName = (childProfile.name || "your child").split(" ")[0];

  // B-CAREPRO-27: a note Consult's teacher branch handed over (one-shot).
  const [handedNote] = useState<string | null>(() => takeTeacherNote());

  // B-CAREPRO-27 — the FREE draft: the teacher preset's ceiling (about + what
  // the family already tries; never logs, milestones or memory), in the
  // parent's language. No network, no paywall.
  const freeDraft = useMemo<SchoolBriefData>(() => {
    const draft = teacherBriefDraft(
      buildPacketInput({ profile: childProfile, logs: behaviorLogs, milestones, plans: actionPlans, memory: [] }, Date.now()),
      uiLang,
    );
    return {
      title: "",
      date: "",
      overview: [draft.overview, handedNote ?? ""].filter((s) => s.trim()).join("\n\n"),
      keyStrengths: draft.keyStrengths,
      classroomChallenges: draft.harderMoments,
      languageSupportPlan: [],
      suggestedTeacherStrategies: draft.suggestedTeacherStrategies,
      crisisEscalationTrigger: "",
    };
  }, [childProfile, behaviorLogs, milestones, actionPlans, uiLang, handedNote]);

  // generate-and-present: the brief lives in component state only — no new
  // persistent child-data store is created (Condition 6). `draft` is the
  // EDITABLE payload; the export is built from it, so the clinical-term scan
  // inside buildSchoolBriefExport covers any parent edit (Condition 3).
  const [draft, setDraft] = useState<SchoolBriefData>(freeDraft);
  // Once the parent edits (or Arbor drafts), the free draft no longer follows the record.
  const [owned, setOwned] = useState(false);
  const [generating, setGenerating] = useState(false);
  // The draft is rendered on open, so the approval state machine starts there.
  const [exportState, setExportState] = useState<ExportState>(() => markRendered(initialExportState()));
  useEffect(() => {
    if (owned) return;
    setDraft(freeDraft);
    setExportState(markRendered(initialExportState()));
  }, [freeDraft, owned]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  // B-CAREPRO-01: the server's escalation screen (409) blocked the generate.
  // A blocked generate has no draft, so the parent-only escalation card renders
  // from this flag — never a "please try again" toast.
  const [escalationBlocked, setEscalationBlocked] = useState(false);

  const sectionLabels = useMemo(
    () => ({
      overview: t("schoolBrief.section.overview", { name: firstName }),
      // W2-CAREPRO r1: the lists hold strengths and harder moments — the labels say so.
      strengths: t("schoolBrief.section.strengths", { name: firstName }),
      challenges: t("schoolBrief.section.harder", { name: firstName }),
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
    setOwned(true);
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
    setEscalationBlocked(false);
    // B-CAREPRO-12: screen the full record on the device before anything is sent.
    if (recordNeedsEscalation(behaviorLogs)) {
      setEscalationBlocked(true);
      setGenerating(false);
      return;
    }
    const childAgeMonths = ageMonthsFromProfile(childProfile) ?? Math.max(0, childProfile.age || 0) * 12;
    const preset = teacherBriefInput(behaviorLogs, milestones, childAgeMonths);
    try {
      const data = await api.generateBrief({
        childProfile,
        logs: preset.logs,
        milestones: preset.milestones,
        audience: "teacher", // reuse the redacted + escalation-screened path
        // LC-11: a Hebrew-speaking gan teacher was handed an English brief —
        // the generation prompt carried no language directive at all. The
        // client now states the parent's language at the seam.
        // The matching "Write in {language}" line in the /generate-handoff
        // prompt has LANDED (handoffLanguageDirective, src/routes/api.ts), so
        // this argument is live: a Hebrew-UI parent gets a Hebrew brief.
        // Because of that, the Condition-3 clinical scan had to learn Hebrew —
        // it was an English-only term list, which meant the guarantee was not
        // weakened for a Hebrew brief but absent. See lib/clinicalScan.ts.
        language: uiLang === "he" ? "he" : "en",
      });
      setDraft(data);
      setOwned(true);
      setEditing(false);
      // A fresh brief is rendered but NOT approved — approval is per-export.
      setExportState(markRendered(initialExportState()));
    } catch (err: any) {
      // B-CAREPRO-01: branch on the TYPED 409 before the generic toast. The old
      // "Professional support" substring match never fired — request() puts
      // the server's `details` string in the message, which outranks `error`.
      if (err instanceof EscalationRequiredError) setEscalationBlocked(true);
      // B-CAREPRO-16: a Free parent gets the paywall sheet (its professional-
      // reports body, in their language) — never the server's English message.
      else if (err instanceof PaywallError) openPaywall(err.feature, err.plan);
      else toast(t("elev.learnCare.brief.buildFailed"), "error");
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
      const sections = schoolBriefToPrintSections(ex, sectionLabels);
      // Fail closed at the egress seam: the parent-only escalation note may
      // never ride out in the teacher's copy (it is not in CURATED_FIELDS, so
      // this is belt-and-braces — and it stays that way by test).
      assertEscalationNoteNotExported(
        serializeSchoolBrief(ex, sectionLabels),
        parentEscalationNote(draft)
      );
      void openPrintableReport(
        { title: ex.title, subtitle: `${firstName} · ${ex.date}`, sections },
        childProfile.name,
        uiLang
      );
      setReviewOpen(false);
      toast(t("elev.learnCare.brief.printed"), "success");
    } catch (err) {
      // Condition 3 fail-closed: a diagnosis term (incl. one edited in) means we DO NOT export.
      if (err instanceof ClinicalLanguageError) toast(t("schoolBrief.nonDiagnostic", { name: firstName }), "error");
      else toast(t("elev.learnCare.brief.buildFailed"), "error");
    }
  };

  // LC-11: the generator's escalation note — parent-only, never exported.
  const escalationNote = parentEscalationNote(draft);

  // LC-11 + B-CAREPRO-01: ONE parent-only escalation card, fed by the built
  // draft's note OR by a blocked generate (409 on the input or output screen).
  const escalationCard = escalationNote || escalationBlocked ? (
    <section
      data-testid="school-brief-escalation"
      className="rounded-2xl p-4 space-y-2"
      style={{ background: "var(--arbor-yellow-soft)", border: `1px solid ${RULE}` }}
    >
      <h2 className="text-[14px] font-extrabold inline-flex items-center gap-2" style={{ color: "var(--arbor-yellow-ink)" }}>
        <Icon name="flag" size={16} /> {t("elev.learnCare.brief.escalation.title")}
      </h2>
      <p className="text-[13px] leading-relaxed" dir="auto" style={{ color: INK }}>
        {escalationBlocked ? t("elev.learnCare.brief.escalation.blocked") : escalationNote}
      </p>
      <p className="text-[11.5px] leading-relaxed" style={{ color: MUTED }}>{t("elev.learnCare.brief.escalation.body")}</p>
      <button
        onClick={() => setActiveTab("safety")}
        className="inline-flex items-center gap-2 text-[12.5px] font-bold rounded-xl px-4 min-h-[44px]"
        style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", border: `1px solid ${RULE}` }}
      >
        <Icon name="health_and_safety" size={16} /> {t("elev.learnCare.brief.escalation.cta")}
      </button>
    </section>
  ) : null;

  const motionProps = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.2 } };

  // Item 11 (IA-02): ONE declared move. B-CAREPRO-27: the brief exists on open
  // (the free draft), so the move that builds the teacher's document is
  // "Save as PDF" — review, approve, print. Spread once, so this file carries
  // exactly one `data-primary-move` and the page renders exactly one.
  const primaryMove = { "data-primary-move": "build-school-brief" };

  return (
    <motion.div {...motionProps} className="space-y-5 max-w-[760px]">
      <header>
        {/* W2-CAREPRO r1: no page kicker — the hub (Care) already names it. */}
        <h1 className="text-[1.6rem] font-extrabold leading-tight" style={{ fontFamily: "var(--font-display)", color: INK, textWrap: "balance" } as React.CSSProperties}>
          {t("schoolBrief.title")}
        </h1>
        <p className="text-sm mt-1.5 leading-relaxed" style={{ color: MUTED, textWrap: "pretty" } as React.CSSProperties}>
          {t("schoolBrief.subtitle", { name: firstName })}
        </p>
      </header>

      {/* Non-diagnostic framing line. */}
      <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: GREEN_SOFT }}>
        <Icon name="favorite" size={20} fill={1} style={{ color: GREEN }} />
        <p className="text-[13px] leading-relaxed" style={{ color: GREEN }}>
          {t("schoolBrief.nonDiagnostic", { name: firstName })}
        </p>
      </div>

      {/* Item 11 (IA-02): the surface contract reaches the DOM. `data-module`
          marks a top-level sibling module (what moduleBudget counts);
          `data-primary-move` marks the ONE control that performs the move
          surfaceContract.ts declares for this route. */}
      <>
          {/* W2-CAREPRO r1 (school-brief P0): the one move sits ABOVE the
              document, so Save as PDF is above the fold at 375 and 1280
              (it was y=1185 / 846 under the draft card). */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Opening the review is NOT an export — export only fires after approve. */}
            <button
              {...primaryMove}
              onClick={() => setReviewOpen(true)}
              className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-xl px-4 py-3 min-h-[44px]"
              style={{ background: "var(--arbor-gradient-primary)", boxShadow: "var(--arbor-clay-glow)" }}
            >
              <Icon name="description" size={16} /> {t("elev.learnCare.brief.print")}
            </button>
            {/* B-CAREPRO-27 / G2: Plus = AI drafting only. A Free parent who taps
                it gets the paywall (B-CAREPRO-16); the free draft above already
                prints. */}
            <button
              data-testid="school-brief-ai-draft"
              onClick={generate}
              disabled={generating}
              className="inline-flex items-center gap-2 font-bold text-sm rounded-xl px-4 py-3 min-h-[44px] disabled:opacity-50"
              style={{ background: "var(--arbor-paper-sunk)", color: INK, border: `1px solid ${RULE}` }}
            >
              {generating
                ? (<><Icon name="progress_activity" size={16} className="animate-spin" /> {t("schoolBrief.generating")}</>)
                : (<><Icon name="auto_awesome" size={16} /> {t("elev.learnCare.brief.aiDraft")}
                    <span className="text-[11px] font-extrabold rounded-full px-2 py-0.5" style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}>{t("elev.learnCare.brief.plus")}</span></>)}
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
          </div>

          {/* The rendered brief — curated sections only (editable when `editing`). */}
          <div data-module="brief-draft" className="rounded-2xl p-5 md:p-6 space-y-5" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}` }}>
            {/* B-CAREPRO-27: where the draft came from, and what Plus adds — a
                caption in the card header (W2-CAREPRO r1), not a preamble layer. */}
            <p data-testid="school-brief-draft-hint" className="t-xs leading-relaxed" style={{ color: MUTED }}>
              {editing ? t("schoolBrief.editHint") : t("elev.learnCare.brief.draftHint")}
            </p>
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
                <p dir="auto" className="t-base leading-relaxed" style={{ color: MUTED }}>{draft.overview}</p>
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

          {/* LC-11 — THE SAFETY FIELD THAT WAS BEING DROPPED. The generator is
              required by its own schema to return `crisisEscalationTrigger`; it
              is correctly kept out of the teacher's copy, but it was never
              rendered anywhere either, so the model's escalation note vanished
              silently. It belongs to the PARENT. Shown here, outside the brief
              card, clearly labelled as not part of the teacher's document, and
              routed to Safety and support. */}
          {escalationCard}

      </>

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
        {/* W2-CAREPRO r1: each item is its own bidi paragraph — a Latin
            strength in the RTL list kept its period on the wrong edge. */}
        {items.map((it, i) => <li key={i} dir="auto" className="t-base leading-relaxed">{it}</li>)}
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
              className="flex-1 text-[14px] leading-relaxed rounded-lg px-2.5 py-1.5 min-h-11 focus:outline-none focus:ring-2"
              style={{ color: INK, background: "var(--arbor-paper-sunk)", border: `1px solid ${RULE}` }}
            />
            <button
              type="button"
              onClick={() => onRemove(field, i)}
              aria-label={removeAria}
              className="flex-shrink-0 inline-flex items-center justify-center min-h-11 min-w-11 rounded-lg"
              style={{ color: MUTED, border: `1px solid ${RULE}` }}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onAdd(field)}
          className="inline-flex items-center gap-1.5 text-[13px] font-bold mt-1 min-h-11"
          style={{ color: GREEN }}
        >
          <Icon name="add" size={14} /> {addItemLabel}
        </button>
      </div>
    </Section>
  );
}
