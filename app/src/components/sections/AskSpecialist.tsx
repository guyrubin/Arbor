import React, { useEffect, useMemo, useRef, useState } from "react";
import { useConsultEgress, type ConsultEgressGuard } from "../../consult/egressGuard";
import { FreeText } from "../ui/FreeText";
import { fmtDay } from "../../lib/formatDate";
import { motion, useReducedMotion } from "motion/react";
import Icon from "../ui/Icon";
import { useArbor, type ConsultPrefill } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  buildConsultPacket,
  buildPacketInput,
  countIncluded,
  isConsultPacketEmpty,
  presetPacket,
  sectionTitle,
  itemText,
  serializeForExport,
  exportPrintSections,
  normalizeExportAudience,
  EXPORT_AUDIENCES,
  DEFAULT_EXPORT_AUDIENCE,
  INTAKE_AUDIENCE,
  buildIntakePacket,
  parentGoalPreview,
  type ExportAudience,
  type IntakeProfession,
  type ConsultPacket,
} from "../../consult/packet";
import { intakeQuestionLines, readIntakeQuestionsText } from "../../consult/intakeDraft";
import { hearingCheckOf, hearingQuestionOn } from "../../lib/hearingCheck";
import { SPLIT_CLINICIAN_AUDIENCES, SPLIT_CLINICIAN_PRESETS, isSplitClinicianAudience, type SplitClinicianAudience } from "../../content/consultPresets";
import { comparisonMonthsOf } from "../../lib/age/forChild";
import { ClinicalLanguageError } from "../../lib/clinicalScan";
import { trackShareInitiated, trackShareCompleted } from "../../lib/loopEvents";
import { getLastExportedAt, recordExport } from "../../consult/exportHistory";
import { InsetRow } from "../ui/kit";
import { useConsultPdf } from "./Reports";
import { useHeroAvatar } from "../ui/HeroAvatar";
import { consultAnchor, parentWords, reportsLeadCounts } from "../../lib/recordCounts";
import type { Appointment, AppointmentFollowUp } from "../../lib/careTrack";
import { exportPlainLines } from "../../consult/plainText";
// B-CAREPRO-36: the teacher preset shows the School Brief editor inline.
import SchoolBrief from "./SchoolBrief";
import { homePracticeWorlds, openHomePracticeWorld } from "../../consult/homePractice";
import { useKidModeEntry } from "../kidmode/useKidModeEntry";
// LC-20 + LC-12: the reason for the visit, the questions prepared in
// Appointments, and the discipline-specific evidence each preset reads.
import { useChildCollection } from "../../hooks/useChildCollection";
import type { PlanBookDoc } from "../../lib/library/plans/planBookDoc";
import { quotesFromDocs } from "../../lib/loop/tonight";
import { programPageModel } from "../../lib/programPage";
import type { FamilyGoal } from "../../lib/goals";
import { toObservations } from "../../lib/observations";
import type { SleepLogEntry } from "../../types";
import type { LangObservation } from "../../growth/vocabAgg";
import type { GrowthEntry } from "../../growth/growthEntries";

/* Care › Consult — "Prepare for a visit" (b3 → B-CAREPRO-28).
   One spine (a parent-redacted packet from the child's record) in three steps:

   1 · Who is it for? — the audience IS the preset: pediatrician · speech
       therapist · behaviour/psychology · another clinician · teacher · my own
       records. A teacher gets the School Brief (one teacher document, LC-11)
       — its editor inline below step 1 (B-CAREPRO-36); every other audience
       builds its own preset packet.
   2 · What changed — the parent's reason for the visit, then the live packet
       (each item an include-toggle; rows render in full, LC-07) and a preview
       of exactly what leaves.
   3 · What leaves — the reviewed gate, then Copy · Save as PDF · Send to
       someone you trust. All three serialize the SAME preset through the one
       guarded seam (`serializeForExport` / `exportPrintSections`: audience
       ceiling + note scan, fail closed). Safety L3: nothing leaves the device
       until the parent acts. The .md Download and the 10-item PDF menu are
       gone (B-CAREPRO-28). The last audience is remembered on the device
       (metadata only, never child data). */

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const GREEN = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";
const RULE = "var(--arbor-rule)";
/** W2-CAREPRO c2 r1: lines of the verbatim preview shown below lg before
 *  "Show all" (the whole text is open at lg). */
const PREVIEW_PHONE_LINES = 6;
/** Type by line role in the verbatim preview (the PDF keeps its own heads). */
const PREVIEW_ROLE_CLS: Record<"title" | "head" | "note" | "item" | "body" | "blank", string> = {
  title: "t-sm font-extrabold",
  head: "t-sm font-bold mt-2",
  note: "t-xs",
  item: "t-sm",
  body: "t-sm",
  blank: "h-1",
};

/** Device-local memory of the parent's last audience choice (no child data). */
const AUDIENCE_STORAGE_KEY = "arbor.consultExportAudience";
const readStoredAudience = (): ExportAudience => {
  try {
    return normalizeExportAudience(localStorage.getItem(AUDIENCE_STORAGE_KEY)) ?? DEFAULT_EXPORT_AUDIENCE;
  } catch {
    return DEFAULT_EXPORT_AUDIENCE;
  }
};

/** The clinician presets a caller may name (`ConsultPrefill.preset`). */
const CLINICIAN_PRESETS = ["pediatrician", "slp", "behavioral_health", "therapist"] as const;

/** B-CAREPRO-13 / B-CAREPRO-28 — the pure reading of a prefill: which composer
 *  fields it sets. Blank strings set nothing; an unknown audience is dropped
 *  (the legacy "clinician" reads as "therapist"); a clinician preset IS the
 *  audience and outranks a generic one. Each field is independent, so an
 *  audience never clears a reason. */
export function resolveConsultPrefill(p: ConsultPrefill): {
  reason?: string; note?: string; audience?: ExportAudience;
} {
  const out: ReturnType<typeof resolveConsultPrefill> = {};
  if (typeof p.reason === "string" && p.reason.trim() !== "") out.reason = p.reason;
  if (typeof p.note === "string" && p.note.trim() !== "") out.note = p.note;
  const audience = normalizeExportAudience(p.audience);
  if (audience) out.audience = audience;
  if (p.preset && (CLINICIAN_PRESETS as readonly string[]).includes(p.preset)) out.audience = p.preset;
  return out;
}

type ExportBuild = { text: string; error: null } | { text: null; error: string };

/** v3 EXTRA-CARE — the Care landing's "what to bring" chips: each groups
 *  packet sections (standard and intake) under one parent-facing name. */
const BRING_GROUPS: readonly { id: string; icon: string; labelKey: string; sections: readonly string[] }[] = [
  { id: "moments", icon: "edit_note", labelKey: "elev.consult.bring.moments", sections: ["moments", "patterns", "triggers", "intake-moments"] },
  { id: "map", icon: "eco", labelKey: "elev.consult.bring.development", sections: ["development", "dev-noticed", "growth-measurements", "intake-seen", "intake-not-yet"] },
  { id: "words", icon: "translate", labelKey: "elev.consult.bring.words", sections: ["language-observations", "intake-hearing"] },
  { id: "steps", icon: "flag", labelKey: "elev.consult.bring.steps", sections: ["tried", "adults", "intake-practice", "intake-program", "intake-home-program", "intake-goals"] },
];

/** W2-CAREPRO r1: ConsultTab hands its route stamp here; it lands on the
 *  selected audience chip (one 44 px button in step 1), never on a wrapper. */
export default function AskSpecialist({ primaryMoveStamp, anchorAudience, intake: intakeProp, onAudienceChange, egressGuard, excludeTeacher = false, landing = false, head, noticePacket, noticeRevision, audienceRequest }: {
  primaryMoveStamp?: Record<string, string>;
  /** v3 EXTRA-CARE: #/consult, the Care landing. The three steps read
   *  "Choose what to bring" (who it is for, then what to bring as chips,
   *  "Our question" among them), "Preview the summary" and "Share"; the
   *  preview says how it is worded. The same packet, gate and egress. */
  landing?: boolean;
  /** v3 EXTRA-CARE: the next visit (who, when, in how many days) heading the
   *  Care landing's visit card. With it, the "since" counts sentence moves
   *  up from step 2 into that head, so the card reads visit, since, then
   *  steps 1-3 with nothing in between. */
  head?: React.ReactNode;
  /** B-GROWTH-44: exact, confirmed observation sources; same packet egress. */
  noticePacket?: ConsultPacket;
  noticeRevision?: object;
  /** v3 FEAT-09: the Care summary pill (#/handoff) builds the professional
   *  summary only. The teacher chip is left out (School brief is its own
   *  pill), and a stored, anchored or prefilled teacher audience starts at
   *  the default professional instead, never persisted. */
  excludeTeacher?: boolean;
  egressGuard?: ConsultEgressGuard;
  /** B-LOOP-12: the professional view's profession preset — the packet is
   *  the intake packet (buildIntakePacket) and leaves through THIS step-3
   *  egress, behind the same reviewed gate. A different audience chip ends it. */
  intake?: IntakeProfession;
  /** B-CAREPRO-NEW-2a: the audience of a visit due within 14 days
   *  (consultAudienceForProfession) — applied once, never persisted. */
  anchorAudience?: ExportAudience;
  /** NEXTLEVEL critic r1: the page H1 follows the chosen audience. */
  onAudienceChange?: (a: ExportAudience) => void;
  /** v4 (Care › Past exports): "Prepare an update" for an audience shared
   *  with before. Each new `seq` selects that audience exactly as its chip
   *  would (consent cleared, remembered) and brings step 1 into view. */
  audienceRequest?: { audience: ExportAudience; seq: number };
} = {}) {
  const { childProfile, behaviorLogs, milestones, actionPlans, approvedMemoryItems, actionLoop, setActiveTab, pendingConsultPrefill, consumeConsultPrefill, activeFamilyTopic } = useArbor();
  const { toast } = useToast();
  const { t, uiLang } = useLanguage();
  const reduceMotion = useReducedMotion();
  const printPdf = useConsultPdf();
  const firstName = (childProfile.name || "your child").split(" ")[0];
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set(noticePacket?.sections.flatMap(section => section.items.map(item => item.id)) ?? []));
  const [reviewed, setReviewed] = useState(false);
  const egress = useConsultEgress(egressGuard);
  const approval = useRef<object | null>(null);
  const noticeSelection = useRef(noticeRevision);
  if (noticeSelection.current !== noticeRevision) {
    noticeSelection.current = noticeRevision;
    approval.current = null;
    setReviewed(false);
    setExcluded(new Set(noticePacket?.sections.flatMap(section => section.items.map(item => item.id)) ?? []));
  }
  const [previewAll, setPreviewAll] = useState(false);

  // Step 1: the audience (= the preset); remembered per device.
  const allowed = (a: ExportAudience) => !((excludeTeacher || noticePacket) && a === "teacher");
  const [audience, setAudienceState] = useState<ExportAudience>(() => {
    const initial = intakeProp ? INTAKE_AUDIENCE[intakeProp] : anchorAudience ?? readStoredAudience();
    return allowed(initial) ? initial : DEFAULT_EXPORT_AUDIENCE;
  });
  const [intake, setIntake] = useState<IntakeProfession | undefined>(intakeProp);
  const setAudience = (a: ExportAudience) => {
    if (!allowed(a)) return;
    if (intake && a !== audience) setIntake(undefined);
    // Consent applies to the exact outgoing audience. Clear it in this click
    // transaction, rather than waiting for the effect below, so an immediate
    // export cannot reuse approval for a different recipient.
    if (a !== audience) setReviewed(false);
    if (a !== audience) approval.current = null;
    setAudienceState(a);
    try { localStorage.setItem(AUDIENCE_STORAGE_KEY, a); } catch { /* metadata only */ }
  };
  const isTeacher = audience === "teacher";
  /* v4 — the builder's TEMPLATE: Visit summary or Teacher brief. It is the
     existing audience model read as two documents, never a parallel concept:
     Teacher brief IS the teacher audience (the inline School Brief, B-CAREPRO-36)
     and Visit summary is every clinical audience, returning to the last one the
     parent picked here (else the stored or default professional). Shown wherever
     a teacher may be chosen (not on #/handoff, not on a notice packet); there
     the teacher chip leaves the audience row, which is then only "which
     professional", and in the teacher template the row steps aside. */
  const showTemplate = allowed("teacher");
  const lastClinical = useRef<ExportAudience>(audience !== "teacher" ? audience : (() => {
    const stored = readStoredAudience();
    return stored !== "teacher" ? stored : DEFAULT_EXPORT_AUDIENCE;
  })());
  if (audience !== "teacher") lastClinical.current = audience;
  const chooseTemplate = (template: "visit" | "teacher") => setAudience(template === "teacher" ? "teacher" : lastClinical.current);
  // v4: an external "prepare an update for {audience}" lands like a chip tap.
  const handledRequest = useRef(audienceRequest?.seq);
  useEffect(() => {
    if (!audienceRequest || handledRequest.current === audienceRequest.seq) return;
    handledRequest.current = audienceRequest.seq;
    if (!allowed(audienceRequest.audience)) return;
    setAudience(audienceRequest.audience);
    if (typeof document === "undefined") return;
    const step = document.getElementById("consult-audience-step");
    if (!step) return;
    const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    step.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
    step.focus({ preventScroll: true });
    // The request's seq alone drives this; setAudience is a chip tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceRequest?.seq]);
  // B-CAREPRO-42: "therapist" splits into OT, PT and psychology. A split
  // preset rides the profession's intake packet (B-LOOP-12 path: the
  // registry domains that profession owns, the parent's questions), under
  // the audience consult/packet maps it to today (INTAKE_AUDIENCE).
  const split: SplitClinicianAudience | null = intake && isSplitClinicianAudience(intake) ? intake : null;
  const selectSplit = (p: SplitClinicianAudience) => {
    setAudience(INTAKE_AUDIENCE[p]);
    setIntake(p);
    approval.current = null;
    setReviewed(false);
  };
  useEffect(() => { onAudienceChange?.(audience); }, [audience, onAudienceChange]);
  // B-CAREPRO-20: the worlds that work the chosen professional's domain —
  // parent-only, names only, never part of any packet.
  // B-KID-11: through the ONE entry seam (hero-first, then the named world).
  const { request: openKidMode, step: kidModeStep } = useKidModeEntry();
  const homeWorlds = useMemo(() => homePracticeWorlds(audience), [audience]);

  // AIX-S3(a): the Vision handoff note lands HERE — as a parent-editable note in
  // the composer, never as an auto-share. Consume the one-shot seam into local
  // editable state; the note rides into copy/PDF/send ONLY through the parent's
  // explicit acts (all behind the reviewed-checkbox gate).
  const [visionNote, setVisionNote] = useState("");

  // LC-20 — REASON FOR VISIT. Always shown; rides into every clinician packet
  // in the parent's own words. Device-local until an export the parent takes.
  const [reason, setReason] = useState("");

  // v3 FEAT-09 — "Our question": the family question the parent has selected
  // (ArborContext activeFamilyTopic) joins the summary as ONE line, only when
  // the parent turns it on. Off by default and never auto-included: inclusion
  // is held by the topic's id, so a different question selected meanwhile is
  // off again. It leaves only through the same reviewed gate and egress.
  const familyTopic = !noticePacket && activeFamilyTopic && activeFamilyTopic.status === "active" && activeFamilyTopic.childId === childProfile.id ? activeFamilyTopic : null;
  const [topicOnId, setTopicOnId] = useState<string | null>(null);
  const topicIncluded = !!familyTopic && topicOnId === familyTopic.id;
  const familyQuestionLine = familyTopic && topicIncluded ? t("elev.consult.topic.line", { title: familyTopic.title }) : "";
  const toggleTopic = () => {
    if (!familyTopic) return;
    // Consent covers the exact outgoing text: withdraw it in this click.
    setReviewed(false);
    approval.current = null;
    setTopicOnId(topicIncluded ? null : familyTopic.id);
  };

  // B-CAREPRO-52 — the child's picture on a professional document is the
  // parent's explicit choice for THIS export and audience. Off by default,
  // never persisted (device or cloud), reset when the audience or the child
  // changes, so a choice cannot carry to another document. Only the stylized
  // hero (isGenerated) is ever offered — a real photo never reaches a PDF.
  const { url: heroUrl, isGenerated: heroIsGenerated } = useHeroAvatar();
  const likenessAvailable = !isTeacher && heroIsGenerated && !!heroUrl;
  const [likenessOn, setLikenessOn] = useState(false);
  useEffect(() => { setLikenessOn(false); }, [audience, childProfile.id]);
  const likenessIncluded = likenessAvailable && likenessOn;
  const toggleLikeness = () => {
    if (!likenessAvailable) return;
    // Consent covers the exact outgoing document: withdraw it in this click.
    setReviewed(false);
    approval.current = null;
    setLikenessOn(!likenessOn);
  };

  // The parent's prepared questions and the discipline-specific evidence — the
  // same registered per-child sinks Appointments, Language Lab and the growth
  // card write. Read-only here.
  const questionsCol = useChildCollection<{ id: string; text: string }>(childProfile.id, "apptQuestions");
  const langObsCol = useChildCollection<LangObservation>(childProfile.id, "langObs", { orderByField: "timestamp", orderDir: "desc", max: 200 });
  const growthCol = useChildCollection<GrowthEntry>(childProfile.id, "growthEntries", { orderByField: "date", orderDir: "desc", max: 200 });
  // B-BOOK-79: the Everyday plans reach the clinician packet as counts.
  const booksCol = useChildCollection<PlanBookDoc>(childProfile.id, "books");
  // P5-LOOP c2 r2 (G1-3): the child's kept quotes — the intake packet's Moments lead with them (SLP).
  const keepsakesCol = useChildCollection<{ id: string; kind?: string; note?: string; noticedOn?: string }>(childProfile.id, "keepsakes");
  // W2-CAREPRO c2 r1: the visit this summary follows (careTrack's own sinks).
  const apptsCol = useChildCollection<Appointment>(childProfile.id, "appointments");
  const followUpsCol = useChildCollection<AppointmentFollowUp>(childProfile.id, "apptFollowUps");
  const preparedQuestions = useMemo(
    () => questionsCol.items.map((q) => q.text).filter((x) => x.trim().length > 0),
    [questionsCol.items]
  );
  // B-CAREPRO-13 — the ONE prefill seam: this composer consumes reason, note
  // and audience (a caller's preset IS an audience since B-CAREPRO-28) into
  // EDITABLE local state. The audience is applied without persisting it (a
  // caller's hint is not the parent's remembered choice) and without touching
  // the reason. The reviewed gate starts unticked, as ever.
  useEffect(() => {
    if (pendingConsultPrefill == null) return;
    // An unrelated static prefill cannot masquerade as this selected source.
    if (noticePacket) { consumeConsultPrefill(); return; }
    const patch = resolveConsultPrefill(pendingConsultPrefill);
    if (patch.reason !== undefined) setReason(patch.reason);
    if (patch.note !== undefined) setVisionNote(patch.note);
    if (patch.audience !== undefined && allowed(patch.audience)) setAudienceState(patch.audience);
    setReviewed(false);
    consumeConsultPrefill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingConsultPrefill]);

  /** LC-16 / B-CAREPRO-19 — there is no professional directory (G3: the
   *  route is retired until one real record exists), so the verb is the move a
   *  parent CAN make: hand the same audience-capped packet to someone they
   *  already trust, through the one export text (no second egress path). */
  const sendToTrusted = () => {
    if (exportText == null) return;
    if (!canExportCurrent()) return;
    trackShareInitiated("story", "ask_specialist");
    const subject = t("elev.learnCare.trusted.subject", { name: firstName });
    const href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(exportText)}`;
    try {
      window.location.href = href;
      trackShareCompleted("story", "email");
      recordExport(childProfile.id, audience);
    }
    catch { toast(t("elev.packet.copyFailed"), "error"); }
  };

  const fullPacket = useMemo(
    () => buildConsultPacket({
      // LC-17b: the SHARED input assembler (consult/packet.buildPacketInput) —
      // one mapping for this surface and both sides of a share.
      ...buildPacketInput(
        { profile: childProfile, logs: behaviorLogs, milestones, plans: actionPlans, memory: approvedMemoryItems, books: booksCol.items },
        Date.now()
      ),
      // LC-20 / LC-12 — the parent's own voice and the evidence each preset reads.
      reason,
      questions: preparedQuestions,
      langObs: langObsCol.items
        .map((o) => ({ phrase: o.phrase ?? "", language: o.language, at: o.timestamp }))
        .filter((o) => o.phrase.trim().length > 0),
      growthEntries: growthCol.items.map((g) => ({ date: g.date, heightCm: g.heightCm, weightKg: g.weightKg })),
      // B-CAREPRO-17 / CARE-7: "Since you last shared with {audience}" —
      // counts since this audience last received a summary from this device
      // (device-local until a server anchor, G5). Absent on a first export.
      lastExportedAt: getLastExportedAt(childProfile.id, audience) ?? undefined,
      lastExportedAudience: audience,
      // B-CAREPRO-45: the dated "held the plan" answers (B-ASKJB-33 ledger rows).
      heldOutcomes: (actionLoop ?? [])
        .filter((r) => r.source === "hard-moment" && (r.held === "yes" || r.held === "no") && r.outcomeAt)
        // B-CAREPRO-45: + the parent's read of the child afterwards, when given.
        .map((r) => ({ at: r.outcomeAt!, held: r.held!, ...(r.childResponse ? { child: r.childResponse } : {}) })),
    }),
    [childProfile, behaviorLogs, milestones, actionPlans, approvedMemoryItems, reason, preparedQuestions, langObsCol.items, growthCol.items, audience, actionLoop]
  );
  // W2-CAREPRO c2 r2: ONE egress set — the card the parent curates, the
  // step-3 count, the empty test and Copy/PDF/Send all read the audience-capped
  // packet, so switching the chip re-shapes step 2 and every row shown can leave.
  // B-LOOP-12: with a profession preset the curated packet IS the intake packet.
  // B-PROG-05: the enrolled program's line (only while an enrolment is active;
  // the packet scopes it to the profession). The child proxy "new words" reads
  // the word observations (langObs) this step already loads.
  const programRows = useChildCollection<{ id: string }>(childProfile.id, "programs");
  const sleepLogsCol = useChildCollection<SleepLogEntry & { id: string }>(childProfile.id, "sleepLogs");
  // B-PROG-07: the family's goals reach the professional's packet ONLY (the
  // number under the "family-set scale" title); no parent surface prints it.
  const familyGoalsCol = useChildCollection<FamilyGoal>(childProfile.id, "familyGoals");
  const intakeProgram = useMemo(
    () => (intake ? programPageModel(programRows.items, {
      childId: childProfile.id,
      actionLoops: actionLoop ?? [],
      sleepLogs: sleepLogsCol.items,
      observations: toObservations({ langObs: langObsCol.items }, childProfile),
    }, new Date(), uiLang === "he" ? "he" : "en", childProfile.gender ?? null) : null),
    [intake, programRows.items, childProfile, actionLoop, sleepLogsCol.items, langObsCol.items, uiLang],
  );
  const intakePacket = useMemo(
    () => (intake ? buildIntakePacket(intake, {
      child: childProfile,
      milestones,
      behaviorLogs,
      actionLoops: actionLoop ?? [],
      questions: intakeQuestionLines(readIntakeQuestionsText(childProfile.id, intake)),
      comparisonMonths: comparisonMonthsOf(childProfile),
      nowMs: Date.now(),
      lang: uiLang === "he" ? "he" : "en",
      quotes: quotesFromDocs(keepsakesCol.items),
      program: intakeProgram,
      familyGoals: familyGoalsCol.items,
      // B-PROG-09: the active home program from this profession (adherence: days + the family's words)
      homePrograms: programRows.items,
      // B-NEXT-01: the parent's hearing answer, only while the pilot flag is on
      hearing: hearingQuestionOn() ? hearingCheckOf(childProfile) : null,
      // B-CAREPRO-39: the logged words, counted per language by the SLP intake schema (dark until signed)
      langObs: langObsCol.items.map((o) => ({ phrase: o.phrase ?? "", language: o.language, at: o.timestamp })),
    }) : null),
    [intake, childProfile, milestones, behaviorLogs, actionLoop, uiLang, keepsakesCol.items, intakeProgram, familyGoalsCol.items, programRows.items, langObsCol.items]
  );
  const packet = useMemo(() => noticePacket ? presetPacket(audience, { ...noticePacket,
    sections: [...fullPacket.sections.filter(section => section.id === "reason"), ...noticePacket.sections],
  }) : intakePacket ?? presetPacket(audience, fullPacket), [noticePacket, intakePacket, audience, fullPacket]);
  // The intake packet is already scoped to its profession; it leaves through
  // the whole-packet serializer ("self": clinician ceiling, forbidden tokens,
  // no %), never a preset cap that would drop its sections.
  const egressAudience: ExportAudience = !noticePacket && intakePacket ? "self" : audience;

  // W2-CAREPRO c2 r1: "What changed" is measured from a NAMED anchor — the
  // last visit with this audience's profession (with what they said), else
  // the last share with this audience, else since the record started. Never a
  // bare synthetic date. Numerators only (never the x-of-y development lines).
  const nowMs = Date.now();
  const anchor = consultAnchor({
    audience,
    appointments: apptsCol.items,
    followUps: followUpsCol.items,
    lastSharedIso: getLastExportedAt(childProfile.id, audience),
    logs: behaviorLogs ?? [],
    milestones: milestones ?? [],
    nowMs,
  });
  const sinceIso = anchor.kind === "none" ? null : anchor.iso;
  // "Since you started" includes the first entry itself (counts are strictly after).
  const countFromIso = anchor.kind === "start" ? new Date(new Date(anchor.iso).getTime() - 1).toISOString() : sinceIso;
  // B-GROWTH-35: "since you started" is the WHOLE record (lib/record/counts,
  // wholeRecord) — a date filter on the first dated entry dropped every
  // undated noticed milestone ("0 milestones noticed" beside Milestones' 6)
  // and the words written down that the Journal counts as moments.
  const sinceCounts = reportsLeadCounts({ logs: behaviorLogs ?? [], milestones: milestones ?? [], langObs: langObsCol.items, sinceIso: countFromIso, nowMs, wholeRecord: anchor.kind === "start" });
  const lower = (x: string) => (uiLang === "en" ? x.toLowerCase() : x);
  // W2-CAREPRO c2 r1: a packet line takes the reader's direction (a Latin
  // child name first must not flip a Hebrew line); translate() isolates every
  // Latin interpolation inside it. NEXTLEVEL critic r1: the item BODY is
  // isolated text too (B-SHELL-28 FreeText) — an English fact in a Hebrew
  // packet kept its full stop at the wrong end (".page").
  // B-PROG-07 (curation, framer ruling 8 Oct): a family-goal line previews to
  // the parent as the family's WORD only (consult/packet parentGoalPreview →
  // lib/goals goalParentLine); the family-set scale number stays in the
  // professional's copy, and the first goal line carries ONE muted note saying so.
  const goalPreviewText = (it: Parameters<typeof itemText>[0]): string | null => {
    const goal = parentGoalPreview(it, familyGoalsCol.items);
    if (!goal) return null;
    return goal.word ? `${goal.text} · ${t("elev.program.goals.last")} ${goal.word}` : goal.text;
  };
  const firstGoalItemId = packet.sections.find((s) => s.id === "intake-goals")?.items[0]?.id;
  const packetLine = (it: Parameters<typeof itemText>[0]) => {
    const goalText = goalPreviewText(it);
    if (goalText !== null) {
      return (
        <span dir={uiLang === "he" ? "rtl" : "ltr"} className="block" data-testid="consult-goal-line">
          <FreeText text={goalText} />
          {it.id === firstGoalItemId && <span data-testid="consult-goal-note" className="block t-xs mt-1 leading-relaxed" style={{ color: MUTED }}>{t("elev.program.goals.packet.parentNote")}</span>}
        </span>
      );
    }
    return <span dir={uiLang === "he" ? "rtl" : "ltr"} className="block"><FreeText text={itemText(it, uiLang)} /></span>;
  };
  const countVars = {
    moments: t(sinceCounts.moments === 1 ? "elev.reports.line.momentsLogged.one" : "elev.reports.line.momentsLogged.other", { n: sinceCounts.moments }),
    milestones: t(sinceCounts.milestones === 1 ? "elev.reports.lead.milestones.one" : "elev.reports.lead.milestones.other", { n: sinceCounts.milestones }),
    date: sinceIso ? fmtDay(sinceIso, uiLang) : "",
  };
  const sinceSentence = noticePacket ? null : anchor.kind === "visit"
    ? t("elev.carehonesty.consult.since.visit", { ...countVars, name: firstName, profession: lower(t(`elev.careNet.appt.profession.${anchor.profession}`)) })
    : anchor.kind === "share"
      ? t("elev.carehonesty.consult.since.share", { ...countVars, audience: lower(t(`elev.carehonesty.consult.audience.${audience}`)) })
      : anchor.kind === "start"
        ? t("elev.carehonesty.consult.since.start", countVars)
        : null;
  // B-CAREPRO-NEW-2b: the parent's most recent words since that anchor — shown
  // to the parent only; it reaches the packet ONLY if they start their note
  // from it (the reason line, the existing redaction/preview/scan path).
  // W2-CAREPRO c2 r1: read where capture writes (parentWords: notes, else a
  // Moment's trigger) — a notes-only filter never rendered for real moments.
  const sinceMoment = useMemo(() => {
    if (noticePacket) return null;
    const since = countFromIso ? new Date(countFromIso).getTime() : -Infinity;
    const withWords = (behaviorLogs ?? [])
      .filter((l) => parentWords(l) && new Date(l.timestamp).getTime() > since)
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    return withWords[0] ? { quote: parentWords(withWords[0]), at: withWords[0].timestamp } : null;
  }, [noticePacket, behaviorLogs, countFromIso]);
  // W2-CAREPRO r2: the stamp's act — build the summary and land on step 3.
  const buildSummary = () => {
    const target = document.getElementById(isEmpty ? "consult-empty" : "consult-review-export");
    target?.scrollIntoView?.({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
    (target?.querySelector("h2") as HTMLElement | null)?.focus?.();
  };
  // B-LOOP-12: arriving from the professional view's PDF · Copy · Send, the
  // parent lands on step 3 — the verbatim preview and the reviewed gate.
  useEffect(() => {
    if (intakeProp) buildSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // LC-06: "about" is always emitted, so the honest emptiness test is
  // "nothing beyond about" — the authored empty state can finally mount.
  const isEmpty = isConsultPacketEmpty(packet);
  const includedCount = countIncluded(packet, excluded);
  const toggle = (id: string) => {
    approval.current = null;
    setReviewed(false);
    setExcluded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  // v3 EXTRA-CARE: step 1's "what to bring" chips on the Care landing. Each
  // chip is a group of the packet's own sections, shown only when the packet
  // holds it, and turns all of that group's lines in or out of the same
  // excluded set the packet card edits line by line. Consent covers the exact
  // outgoing text: a chip click withdraws a tick already given.
  const bringChips = landing && !isTeacher
    ? BRING_GROUPS.flatMap((group) => {
        const ids = packet.sections.filter((s) => group.sections.includes(s.id)).flatMap((s) => s.items.map((it) => it.id));
        if (ids.length === 0) return [];
        const counted = group.id === "moments" ? packet.sections.find((s) => s.id === "moments")?.items.find((it) => it.id === "moments-count")?.vars?.n : undefined;
        const n = typeof counted === "number" ? counted : null;
        const label = n === null ? t(group.labelKey) : t(n === 1 ? "elev.consult.bring.moments.one" : "elev.consult.bring.moments.other", { n });
        return [{ id: group.id, icon: group.icon, label, ids, on: ids.some((id) => !excluded.has(id)) }];
      })
    : [];
  const toggleBring = (ids: string[], on: boolean) => {
    setReviewed(false);
    approval.current = null;
    setExcluded((prev) => { const n = new Set(prev); for (const id of ids) on ? n.add(id) : n.delete(id); return n; });
  };

  // LC-08 / B-CAREPRO-28: the ONE export text for Copy and Send, for the
  // chosen preset — audience-capped and note-scanned. A blocked build yields
  // NO text (fail closed) and a parent-readable reason; every verb disables
  // until the parent fixes it. The teacher branch builds nothing here: the
  // School Brief is the one teacher document.
  const exportBuild = useMemo<ExportBuild>(() => {
    if (isTeacher) return { text: null, error: "" };
    try {
      // LC-13 / item 8: `uiLang` renders the packet SCAFFOLD in the parent's language.
      return { text: serializeForExport(egressAudience, packet, excluded, visionNote, t("consult.visionNote.heading"), uiLang, familyQuestionLine), error: null };
    } catch (err) {
      // Fail closed: a forbidden token or a % in the note blocks every verb.
      return { text: null, error: err instanceof ClinicalLanguageError ? t("elev.carehonesty.consult.blocked.generic") : t("consult.exportError") };
    }
  }, [isTeacher, egressAudience, packet, excluded, visionNote, t, uiLang, familyQuestionLine]);
  // W2-CAREPRO c2 r1: what leaves is clean plain text (title line, plain
  // heads, bullets — no #, ** or _ in a WhatsApp/SMS paste), and the preview
  // renders EXACTLY that string, one line per block.
  const exportLines = useMemo(() => (exportBuild.text == null ? null : exportPlainLines(exportBuild.text)), [exportBuild.text]);
  const exportText = exportLines == null ? null : exportLines.map((l) => l.text).join("\n");
  const exportReceipt = useMemo(() => ({}), [exportText, audience, intake, childProfile.id, egress.receipt]);
  useEffect(() => { setReviewed(false); }, [exportReceipt]);
  const latestExport = useRef(exportReceipt);
  latestExport.current = exportReceipt;
  if (!egress.isCurrent() || approval.current !== exportReceipt) approval.current = null;
  const canExportCurrent = () => includedCount > 0 && reviewed && approval.current === exportReceipt
    && latestExport.current === exportReceipt && egress.isCurrent();
  const noneSelected = includedCount === 0 || !reviewed || exportText == null || !canExportCurrent();

  useEffect(() => { setReviewed(false); setPreviewAll(false); }, [excluded, visionNote, reason, audience, childProfile.id]);

  const copy = async () => {
    if (exportText == null) return;
    if (!canExportCurrent()) return;
    // Growth loop (P0-4): the consult packet is a `story` artifact shared to a
    // professional — reuse the existing union value, don't mint a new one here.
    trackShareInitiated("story", "ask_specialist");
    try {
      await navigator.clipboard.writeText(exportText);
      if (!canExportCurrent()) return;
      trackShareCompleted("story", "clipboard");
      recordExport(childProfile.id, audience);
      toast(t("elev.packet.copied"), "success");
    }
    catch { if (canExportCurrent()) toast(t("elev.packet.copyFailed"), "error"); }
  };

  // B-CAREPRO-28: ONE PDF for the chosen audience — the same preset, the same
  // redaction and the same note as the Copy text (exportPrintSections is the
  // print twin of serializeForExport). Fail closed: a blocked build prints
  // nothing and records nothing.
  const savePdf = () => {
    if (exportText == null || isTeacher) return;
    if (!canExportCurrent()) return;
    try {
      const sections = exportPrintSections(egressAudience, packet, excluded, visionNote, t("consult.visionNote.heading"), uiLang, familyQuestionLine);
      // B-CAREPRO-52: the picture rides only on the parent's explicit per-export choice.
      printPdf(audience, sections, { likeness: likenessIncluded });
      recordExport(childProfile.id, audience);
    } catch (err) {
      void err;
      toast(t("consult.exportError"), "error");
    }
  };

  const motionProps = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.2 } };

  /** One data-contract disclosure retains every promise in empty and populated states. */
  const CONTRACT_TILES = [
    { icon: "visibility", title: t("consult.contract.review"), body: t("consult.contract.reviewBody") },
    { icon: "tune", title: t("consult.contract.control"), body: t("consult.contract.controlBody") },
    { icon: "verified_user", title: t("consult.contract.share"), body: t("consult.contract.shareBody") },
  ] as const;

  const packetContract = (
      <section data-testid="consult-contract">
        <details className="rounded-[18px]" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}` }}>
          <summary
            data-testid="consult-contract-summary"
            className="touch-target !justify-start w-full cursor-pointer list-none gap-2 px-4 t-xs font-extrabold"
            style={{ color: INK }}
          >
            <Icon name="verified_user" size={16} />
            <span className="min-w-0 flex-1">
              {CONTRACT_TILES.map((item) => item.title).join(" · ")}
            </span>
            <Icon name="expand_more" size={16} />
          </summary>
          <div className="grid grid-cols-1 gap-3 px-4 pb-4">
            {CONTRACT_TILES.map((item) => (
              <div key={item.icon}>
                <span className="inline-flex items-center gap-2 t-xs font-extrabold" style={{ color: INK }}>
                  <Icon name={item.icon} size={16} /> {item.title}
                </span>
                <p className="text-xs leading-relaxed mt-1.5" style={{ color: MUTED }}>{item.body}</p>
              </div>
            ))}
          </div>
        </details>
      </section>
  );

  /** Numbered step heading (the steps are the page's reading order). */
  const stepHeading = (n: number, label: string, id?: string) => (
    <h2 id={id} className="flex items-center gap-2 t-lg font-extrabold" style={{ fontFamily: "var(--font-display)", color: INK }}>
      <span aria-hidden="true" className="inline-flex items-center justify-center w-7 h-7 rounded-full t-sm font-extrabold" style={{ background: "var(--arbor-paper-deep)", color: INK }}>{n}</span>
      {label}
    </h2>
  );

  /* v3 FEAT-09 — "Our question": the selected family question, off until
     the parent turns it on; on, it is one line of the preview. Step 2 holds
     it; the Care landing (v3 EXTRA-CARE) holds it among step 1's chips. */
  const topicChip = familyTopic ? (
    <button
      type="button"
      data-testid="consult-include-topic"
      aria-pressed={topicIncluded}
      onClick={toggleTopic}
      className="inline-flex max-w-full items-center gap-1.5 t-sm font-bold rounded-xl px-3.5 py-2 min-h-[44px] text-start transition"
      style={topicIncluded
        ? { background: "var(--arbor-subtab-active)", color: "var(--arbor-subtab-on-ink)" }
        : { background: "var(--arbor-paper-sunk)", color: INK, border: `1px solid ${RULE}` }}
    >
      <Icon name="bookmark" size={14} fill={topicIncluded ? 1 : 0} />
      <span className="flex-shrink-0">{t("elev.consult.topic.include")}</span>
      <span className="min-w-0 truncate font-medium"><FreeText text={familyTopic.title} /></span>
    </button>
  ) : null;

  /* W2-CAREPRO r1: "what changed" is answered first — B-CAREPRO-17's
     "Since you last shared with {audience}" counts (counts only; the same
     section rides the packet below). r2: on a first visit it is a
     numerator-only sentence from the record. It heads step 2, or, on the Care
     landing with a visit (v3 EXTRA-CARE), sits in the visit card's head under
     the visit, aligned with its title. */
  const sinceInHead = !!head && !isTeacher;
  const sinceHead = sinceSentence ? (
    <div
      data-testid="consult-since-head"
      data-anchor={anchor.kind}
      className={sinceInHead ? "min-w-0 sm:ps-14" : "mt-3 rounded-[13px] p-3.5"}
      style={sinceInHead ? undefined : { background: "var(--arbor-paper-sunk)", border: `1px solid ${RULE}` }}
    >
      <p data-testid="consult-since-counts" className={sinceInHead ? "t-sm" : "t-sm font-bold"} style={{ color: sinceInHead ? "var(--arbor-ink-soft)" : INK }}>{sinceSentence}</p>
      {/* W2-CAREPRO c2 r1: what the professional said, in the parent's own
          after-visit note (Appointments' follow-up), under the anchor. */}
      {anchor.kind === "visit" && anchor.note && (
        <figure data-testid="consult-visit-note" className="mt-2">
          <figcaption className="t-xs" style={{ color: MUTED }}>{t("elev.carehonesty.consult.since.visitNote")}</figcaption>
          <blockquote dir="auto" className="t-sm mt-0.5" style={{ color: INK }}>“{anchor.note}”</blockquote>
        </figure>
      )}
    </div>
  ) : null;

  return (
    /* W2: one DOM/visual sequence: who, purpose, editable packet, contract, review/export. */
    <motion.div {...motionProps} className="flex flex-col gap-5 max-w-[1180px]">
      {/* v3 EXTRA-CARE: the visit card's head — the visit, then the since
          counts — directly above step 1, closed by one hairline. */}
      {head && (
        <div data-testid="consult-visit-card-head" className="flex flex-col gap-2 border-b pb-5" style={{ borderColor: RULE }}>
          {head}
          {sinceInHead && sinceHead}
        </div>
      )}
      {/* Step 1 · Who is it for? — the audience IS the preset (B-CAREPRO-28).
          LC-28 / OBJ-CARE-02: the hub CTA scrolls to and focuses this row. */}
      <section id="consult-audience-step" tabIndex={-1} data-testid="consult-audience-step" className="flex flex-col gap-2 focus:outline-none" style={{ scrollMarginBlockStart: "0.75rem" }}>
        {showTemplate && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mb-1">
            <span className="t-xs font-bold" style={{ color: MUTED }}>{t("elev.consult.template.label")}</span>
            <div role="radiogroup" aria-label={t("elev.consult.template.aria")} data-testid="consult-template-row" className="flex flex-wrap items-center gap-1.5">
              {(["visit", "teacher"] as const).map((template) => {
                const on = template === "teacher" ? isTeacher : !isTeacher;
                return (
                  <button
                    key={template}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    data-testid="consult-template"
                    data-template={template}
                    onClick={() => chooseTemplate(template)}
                    className="inline-flex items-center gap-1.5 t-sm font-bold rounded-full px-3.5 min-h-[44px] transition"
                    style={on
                      ? { background: "var(--arbor-subtab-active)", color: "var(--arbor-subtab-on-ink)" }
                      : { background: "var(--arbor-paper-elevated)", color: INK, border: `1px solid ${RULE}` }}
                  >
                    <Icon name={template === "teacher" ? "backpack" : "description"} size={16} />
                    {t(`elev.consult.template.${template}`)}
                  </button>
                );
              })}
            </div>
            <span data-testid="consult-template-note" className="t-xs sm:ms-auto" style={{ color: MUTED }}>
              {t(isTeacher ? "elev.consult.template.note.teacher" : "elev.consult.template.note.visit")}
            </span>
          </div>
        )}
        {showTemplate && isTeacher ? null : landing && !isTeacher ? (
          <>
            {stepHeading(1, t("elev.consult.step.bring"), "consult-bring-heading")}
            <p id="consult-audience-label" className="t-sm font-bold" style={{ color: INK }}>{t("elev.carehonesty.consult.audience.label")}</p>
          </>
        ) : stepHeading(1, t("elev.carehonesty.consult.audience.label"), "consult-audience-label")}
        {!(showTemplate && isTeacher) && <>
        <div
          id="consult-audience-row"
          data-testid="consult-audience-row"
          tabIndex={-1}
          role="radiogroup"
          aria-labelledby="consult-audience-label"
          className="flex flex-wrap items-center gap-1.5 focus:outline-none"
          style={{ scrollMarginBlockStart: "0.75rem" }}
        >
          {EXPORT_AUDIENCES.filter((a) => allowed(a) && !(showTemplate && a === "teacher")).map((a) => {
            const on = a === audience && !split;
            return (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setAudience(a)}
                className="inline-flex items-center gap-1.5 t-sm font-bold rounded-xl px-3.5 py-2 min-h-[44px] transition"
                // W2-CAREPRO r1: the selected chip is the navy sub-tab pill —
                // green-ink is a jewel text ink, never a solid fill.
                style={on
                  ? { background: "var(--arbor-subtab-active)", color: "var(--arbor-subtab-on-ink)" }
                  : { background: "var(--arbor-paper-sunk)", color: INK, border: `1px solid ${RULE}` }}
              >
                {on && <Icon name="check" size={14} weight={600} />}
                {a === "therapist" ? t("elev.words.consult.preset.therapistOther") : t(`elev.carehonesty.consult.audience.${a}`)}
              </button>
            );
          })}
          {SPLIT_CLINICIAN_AUDIENCES.map((p) => {
            const on = split === p;
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={on}
                data-split-preset={p}
                onClick={() => selectSplit(p)}
                className="inline-flex items-center gap-1.5 t-sm font-bold rounded-xl px-3.5 py-2 min-h-[44px] transition"
                style={on
                  ? { background: "var(--arbor-subtab-active)", color: "var(--arbor-subtab-on-ink)" }
                  : { background: "var(--arbor-paper-sunk)", color: INK, border: `1px solid ${RULE}` }}
              >
                {on && <Icon name="check" size={14} weight={600} />}
                {t(SPLIT_CLINICIAN_PRESETS[p].labelKey)}
              </button>
            );
          })}
        </div>
        {split && (
          <div data-testid="consult-split-intake" className="flex flex-col gap-1">
            <p className="text-[13px]" style={{ color: MUTED }}>{t("elev.words.consult.mayAsk")}</p>
            <ul className="list-disc ps-5 space-y-0.5 text-[14px] leading-relaxed" style={{ color: INK }}>
              {SPLIT_CLINICIAN_PRESETS[split].intakeQuestions.map((k) => <li key={k}>{t(k, { name: firstName })}</li>)}
            </ul>
          </div>
        )}
        <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
          {t(`elev.carehonesty.consult.audience.hint.${audience}`)}
        </p>
        </>}
        {landing && !isTeacher && (bringChips.length > 0 || topicChip) && (
          <div className="flex flex-col gap-1.5 mt-1">
            <p id="consult-bring-label" className="t-sm font-bold" style={{ color: INK }}>{t("elev.consult.bring.label")}</p>
            <div role="group" aria-labelledby="consult-bring-label" data-testid="consult-bring-row" className="flex flex-wrap items-center gap-1.5">
              {bringChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  data-testid="consult-bring-chip"
                  data-bring={chip.id}
                  aria-pressed={chip.on}
                  onClick={() => toggleBring(chip.ids, chip.on)}
                  className="inline-flex items-center gap-1.5 t-sm font-bold rounded-xl px-3.5 py-2 min-h-[44px] transition"
                  style={chip.on
                    ? { background: "var(--arbor-subtab-active)", color: "var(--arbor-subtab-on-ink)" }
                    : { background: "var(--arbor-paper-sunk)", color: INK, border: `1px solid ${RULE}` }}
                >
                  <Icon name={chip.icon} size={14} fill={chip.on ? 1 : 0} />
                  {chip.label}
                </button>
              ))}
              {topicChip}
            </div>
          </div>
        )}
        {/* W2-CAREPRO r2: the route's ONE stamp sits on a real act — build the
            summary for the chosen audience and land on step 3 (the verbatim
            preview, the reviewed gate, Copy · PDF · Send). It was on the
            already-selected chip, whose click was a no-op. */}
        {!isTeacher && (
          <button
            type="button"
            data-testid="consult-build"
            onClick={buildSummary}
            {...primaryMoveStamp}
            // W2-CAREPRO c2 r1: the stamp holder carries the page's ONE
            // gradient (Copy is a solid secondary); full width below 640 px.
            className="w-full sm:w-auto sm:self-start inline-flex items-center justify-center gap-2 t-sm font-extrabold rounded-xl px-5 min-h-[44px] mt-1 transition hover:brightness-105"
            style={{ background: "var(--gradient-cta)", color: "var(--arbor-on-accent)" }}
          >
            {t("elev.carehonesty.consult.build")}
          </button>
        )}
      </section>

      {isTeacher ? (
        /* LC-11 / B-CAREPRO-28 — ONE teacher document. A teacher never gets
           this packet's text; the School Brief (classroom words, per-export
           approval, fail-closed scan) is the teacher branch.
           B-CAREPRO-36 (closure): the School Brief editor renders HERE, inline
           — the parent never leaves "Prepare for a visit" — and #/school-brief
           is this page with the teacher preselected (ConsultTab). The route's
           ONE stamp lands on the brief's "Save as PDF" (the real act); the
           editor's own export path (per-export approval, CURATED_FIELDS,
           ClinicalLanguageError fail-closed scan) is unchanged. A hairline
           section, not a card: the brief's own card sits inside it. */
        <section data-testid="consult-teacher-branch" className="flex flex-col gap-4 border-t pt-5" style={{ borderColor: RULE }}>
          <div>
            <h2 className="t-lg font-extrabold" style={{ fontFamily: "var(--font-display)", color: INK }}>
              {t("elev.carehonesty.consult.teacher.title", { name: firstName })}
            </h2>
            <p className="t-sm leading-relaxed mt-1.5" style={{ color: MUTED }}>{t("elev.carehonesty.consult.teacher.body")}</p>
            {visionNote.trim() !== "" && (
              <p data-testid="consult-teacher-note-carried" className="text-xs mt-2 inline-flex items-center gap-1.5" style={{ color: GREEN }}>
                <Icon name="check_circle" size={14} fill={1} /> {t("elev.carehonesty.consult.teacher.noteCarried")}
              </p>
            )}
          </div>
          <SchoolBrief embedded teacherNote={visionNote} primaryMove={primaryMoveStamp?.["data-primary-move"]} egressGuard={egressGuard} />
        </section>
      ) : (
        /* W2-CAREPRO r2: at lg a two-pane fold — the builder column (steps 2,
           the packet, the contract) and a sticky step-3 column carrying the
           verbs, so the one gradient (Copy) is on screen at 1280x800. */
        <div data-testid="consult-panes" className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6 lg:items-start">
        <div className="flex flex-col gap-5 min-w-0">
      {/* Step 2 · What changed — purpose first; the same builder carries it into every clinician packet. */}
      <section data-testid="consult-reason-section" className="border-t pt-5" style={{ borderColor: RULE }}>
        {stepHeading(2, landing ? t("elev.consult.step.preview") : t("elev.carehonesty.consult.step.changed"))}
        {/* The since counts head step 2 unless the visit card's head holds them. */}
        {!sinceInHead && sinceHead}
        {/* B-CAREPRO-NEW-2b: the moment that says the most — the parent's own
            latest words since the anchor (the one warm accent). Nothing renders
            when there is none. */}
        {sinceMoment && (
          <figure data-testid="consult-since-moment" className="mt-3 p-5" style={{ background: "var(--arbor-peach-wash)", borderRadius: "var(--r-lg)", border: `1px solid ${RULE}` }}>
            <figcaption className="t-xs" style={{ color: "var(--arbor-peach-ink)" }}>{t("elev.carehonesty.consult.sinceMoment.label")}</figcaption>
            <blockquote dir="auto" className="t-lg mt-1.5" style={{ color: INK, fontFamily: uiLang === "he" ? "var(--font-display)" : "var(--font-editorial)" }}>“{sinceMoment.quote}”</blockquote>
            <p className="t-xs mt-1.5" style={{ color: "var(--arbor-peach-ink)" }}><bdi dir="ltr">{fmtDay(sinceMoment.at, uiLang)}</bdi> · {t("elev.carehonesty.consult.sinceMoment.logged")}</p>
            {reason.trim() === "" && (
              <button
                type="button"
                data-testid="consult-since-moment-seed"
                onClick={() => setReason(sinceMoment.quote)}
                className="inline-flex items-center gap-1.5 t-sm font-bold min-h-[44px] mt-1"
                style={{ color: INK }}
              >
                <Icon name="edit_note" size={16} /> {t("elev.carehonesty.consult.sinceMoment.seed")}
              </button>
            )}
          </figure>
        )}
        <label htmlFor="consult-reason" className="inline-flex items-center gap-2 t-sm font-bold mt-3" style={{ color: INK }}>
          <Icon name="help" size={16} /> {t("elev.learnCare.reason.label")}
        </label>
        <p className="text-sm leading-relaxed mt-1 max-w-[65ch]" style={{ color: MUTED }}>{t("elev.learnCare.reason.hint")}</p>
        <textarea
          id="consult-reason"
          data-testid="consult-reason-input"
          value={reason}
          onChange={(e) => { approval.current = null; setReviewed(false); setReason(e.target.value); }}
          rows={2}
          dir="auto"
          placeholder={t("elev.learnCare.reason.placeholder")}
          className="w-full t-base leading-relaxed rounded-[13px] px-3 py-2.5 mt-2 resize-y min-h-[56px]"
          style={{ color: INK, background: "var(--arbor-paper-sunk)", border: `1px solid ${RULE}` }}
        />
        {reason.trim() === "" && (
          <p className="text-xs mt-1.5" style={{ color: MUTED }}>{t("elev.learnCare.reason.missing")}</p>
        )}
        {!noticePacket && preparedQuestions.length > 0 && (
          <p className="text-xs mt-2 inline-flex items-center gap-1.5" style={{ color: GREEN }}>
            <Icon name="check_circle" size={14} fill={1} /> {t("elev.learnCare.appt.questions.toPacket")}
          </p>
        )}
        {/* v3 FEAT-09 — "Our question": the selected family question, off
            until the parent turns it on; on, it is one line of the preview. */}
        {/* v3 EXTRA-CARE: on the Care landing the chip is a "what to bring"
            item in step 1 instead. */}
        {!landing && topicChip && (
          <div className="mt-3">{topicChip}</div>
        )}
        {/* B-CAREPRO-20 · spine §5 — "At home while you wait": the two or three
            Practice worlds whose declared domains match this professional.
            Parent-only (outside the packet card and the preview), names only:
            no counts, no performance. */}
        {homeWorlds.length > 0 && (
          /* W2-CAREPRO r1: demoted to a closed disclosure — the games panel no
             longer interrupts "What changed" between the reason and the packet. */
          /* W2-CAREPRO r2: the contract-disclosure pattern — list-none + a
             trailing chevron that turns on [open]; a hairline row, not a slab. */
          <details data-testid="consult-home-practice" className="group mt-4 border-t border-b" style={{ borderColor: RULE }}>
            <summary className="list-none flex items-center gap-2 t-sm font-bold cursor-pointer min-h-[44px] [&::-webkit-details-marker]:hidden" style={{ color: INK }}>
              <Icon name="home" size={16} style={{ color: MUTED }} /> <span className="flex-1">{t("elev.carehonesty.consult.home.title")}</span>
              <Icon name="expand_more" size={18} className="transition-transform group-open:rotate-180" style={{ color: MUTED }} />
            </summary>
            <p className="text-xs leading-relaxed mt-1 max-w-[65ch]" style={{ color: MUTED }}>{t("elev.carehonesty.consult.home.hint")}</p>
            <div className="flex flex-wrap gap-2 mt-2.5">
              {homeWorlds.map((w) => {
                const name = t(w.kidNameKey);
                return (
                  <button
                    key={w.id}
                    type="button"
                    data-testid="consult-home-world"
                    data-world={w.id}
                    onClick={() => openHomePracticeWorld(w, { setActiveTab, openKidMode })}
                    aria-label={t("elev.carehonesty.consult.home.open", { world: name })}
                    className="inline-flex items-center gap-2 t-sm font-bold rounded-xl px-3.5 py-2 min-h-[44px] transition"
                    style={{ background: "var(--arbor-paper-elevated)", color: INK, border: `1px solid ${RULE}` }}
                  >
                    <Icon name={w.msIcon} size={16} style={{ color: MUTED }} /> {name}
                  </button>
                );
              })}
            </div>
            {kidModeStep}
          </details>
        )}
      </section>

      {/* AIX-S3(a): the Vision handoff note — parent-editable BEFORE anything is
          shared. Rendered whenever a note arrived (independent of packet data)
          so the prefill is never silently dropped; the parent can edit or
          remove it, and it joins the packet only via the explicit export acts. */}
      {visionNote.trim() !== "" && (
        <section className="rounded-[18px] p-4" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}` }}>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 t-xs font-extrabold" style={{ color: GREEN }}>
              <Icon name="description" size={16} /> {t("consult.visionNote.title")}
            </span>
            <button
              onClick={() => setVisionNote("")}
              className="text-xs font-bold min-h-[44px] px-2"
              style={{ color: MUTED }}
            >
              {t("consult.visionNote.remove")}
            </button>
          </div>
          <p className="text-xs leading-relaxed mt-1" style={{ color: MUTED }}>{t("consult.visionNote.hint")}</p>
          <textarea
            value={visionNote}
            onChange={(e) => { approval.current = null; setReviewed(false); setVisionNote(e.target.value); }}
            aria-label={t("consult.visionNote.title")}
            rows={4}
            dir="auto"
            className="w-full rounded-xl px-3 py-2 text-sm mt-2 focus:outline-none resize-y"
            style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: INK }}
          />
        </section>
      )}

      {isEmpty ? (
        /* Empty state — new profile with nothing to summarise yet. */
        <>
        <div id="consult-empty" className="rounded-2xl p-8 text-center" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}` }}>
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mx-auto" style={{ background: GREEN_SOFT, color: GREEN }}>
            <Icon name="edit_note" size={26} />
          </span>
          <h2 className="t-lg font-extrabold mt-3" style={{ fontFamily: "var(--font-display)", color: INK }}>{t("consult.empty.title")}</h2>
          <p className="text-sm mt-1.5 leading-relaxed max-w-[420px] mx-auto" style={{ color: MUTED }}>{t("consult.empty.body")}</p>
          <button
            onClick={() => setActiveTab("behaviors")}
            className="inline-flex items-center gap-2 font-bold text-sm rounded-xl px-5 py-3 mt-4 min-h-[44px]"
            style={{ background: "var(--arbor-gradient-primary)", color: "var(--arbor-paper-elevated)", boxShadow: "var(--arbor-clay-glow)" }}
          >
            {t("consult.empty.cta")}
          </button>
        </div>
        {packetContract}
        </>
      ) : (
        <>
          {/* The summary card (the moat read). Each item is a label/value inset
              row with an include-toggle. LC-07: rows render in FULL — the row
              is the line the parent approves, so it is never cut mid-sentence. */}
          <section className="rounded-[22px] p-5" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-sm)" }}>
            <h3 className="t-lg font-extrabold" style={{ fontFamily: "var(--font-display)", color: INK }}>{t("care.packet.title")}</h3>
            <p className="t-xs font-semibold mt-1.5 leading-relaxed" style={{ color: MUTED }}>{t("care.lead", { name: firstName })}</p>

            <div className="flex flex-col gap-2.5 mt-4">
              {packet.sections.map((section) => (
                <div key={section.id} className="flex flex-col gap-2">
                  {section.items.map((it) => {
                    const on = !excluded.has(it.id);
                    // B-PROG-07 (curation): the goal line's parent words (null for every other line)
                    const goalText = goalPreviewText(it);
                    return (
                      <InsetRow
                        key={it.id}
                        label={sectionTitle(section, uiLang)}
                        value={packetLine(it)}
                        excluded={!on}
                        multiline
                        testId="consult-packet-item"
                        check={
                          <button
                            onClick={() => toggle(it.id)}
                            aria-pressed={on}
                            aria-label={t("elev.packet.include", { item: goalText ?? itemText(it, uiLang) })}
                            className="flex-shrink-0 w-11 h-11 -m-3 rounded-md flex items-center justify-center transition self-start"
                            style={{ color: on ? "var(--arbor-paper-elevated)" : MUTED }}
                          >
                            <span
                              className="w-5 h-5 rounded-md flex items-center justify-center"
                              style={on ? { background: "var(--arbor-subtab-active)", color: "var(--arbor-subtab-on-ink)" } : { background: "var(--arbor-paper-sunk)", border: `1px solid ${RULE}` }}
                            >
                              {on && <Icon name="check" size={14} weight={600} />}
                            </span>
                          </button>
                        }
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Trust row (Safety L3) — the GDPR/COPPA promise, INSIDE the card. */}
            <div className="flex items-start gap-2.5 rounded-[13px] p-3 mt-3.5" style={{ background: GREEN_SOFT }}>
              <Icon name="verified_user" size={19} fill={1} style={{ color: GREEN }} />
              <span className="text-xs font-semibold leading-relaxed" style={{ color: GREEN }}>{t("care.trust")}</span>
            </div>

          </section>

      {/* The complete data contract remains one labeled disclosure, after the packet and before export. */}
          {packetContract}
          </>
      )}
        </div>
          {!isEmpty && (
          /* Step 3 · What leaves — the review gate, then one set of verbs for
             the chosen audience. Below lg it follows the packet in normal flow;
             at lg it is the sticky end column. */
          /* W2-CAREPRO c2 r2: a FIXED frame at lg — the column clears the
             sticky sub-nav rail (--sticky-offset, inside <main>, the
             scrollport) and is never taller than <main>'s visible height
             (100dvh minus the shell topbar, --shell-topbar-h). It has NO
             column-level scroll: only the preview scrolls inside itself, so
             the H2, the count, the 44 px reviewed toggle and Copy · PDF · Send
             always stay in view. */
          <div id="consult-review-export" data-testid="consult-review-export" className="border-t pt-5 flex flex-col gap-4 lg:sticky lg:top-[var(--sticky-offset)] lg:max-h-[calc(100dvh-var(--shell-topbar-h)-var(--sticky-offset)-1rem)] lg:border-t-0 lg:pt-0 lg:rounded-[22px] lg:p-5" style={{ borderColor: RULE }}>
            <h2 tabIndex={-1} className="flex items-center gap-2 t-lg font-extrabold focus:outline-none" style={{ fontFamily: "var(--font-display)", color: INK }}>
              <span aria-hidden="true" className="inline-flex items-center justify-center w-7 h-7 rounded-full t-sm font-extrabold" style={{ background: "var(--arbor-paper-deep)", color: INK }}>3</span>
              {landing ? t("elev.consult.step.share") : t("elev.carehonesty.consult.step.leaves")}
            </h2>
            {exportText == null && (
              <span role="alert" className="text-xs font-bold leading-relaxed" style={{ color: "var(--arbor-pink-ink)" }}>
                {exportBuild.error}
              </span>
            )}
            {/* LC-07 / W2-CAREPRO c2 r1: the recipient's exact text, word for
                word, IN step 3 above the reviewed toggle — the parent cannot
                tick "I reviewed" about text that was never on screen. Open at
                lg; the first lines + "Show all" below lg. A blocked build shows
                the reason instead (fail closed). */}
            <section data-testid="consult-preview" aria-label={t("elev.carehonesty.consult.preview.toggle")} tabIndex={0} className="rounded-[13px] px-3.5 py-3 lg:min-h-0 lg:max-h-[min(26rem,50dvh)] lg:overflow-y-auto" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }}>
              <p className="inline-flex items-center gap-2 t-sm font-extrabold" style={{ color: INK }}>
                <Icon name="visibility" size={16} /> {t("elev.carehonesty.consult.preview.toggle")}
              </p>
              <p className="t-xs leading-relaxed mt-0.5" style={{ color: MUTED }}>{t("elev.carehonesty.consult.preview.hint")}</p>
              {landing && <p data-testid="consult-preview-note" className="t-xs leading-relaxed mt-0.5" style={{ color: MUTED }}>{t("elev.consult.preview.note")}</p>}
              {/* B-CAREPRO-52: the preview shows the picture exactly when the
                  PDF will carry it — the same hero URL useConsultPdf embeds. */}
              {likenessIncluded && (
                <img data-testid="consult-preview-likeness" src={heroUrl!} alt={t("elev.carehonesty.consult.likeness.alt", { name: firstName })} referrerPolicy="no-referrer" className="mt-2 w-9 h-9 rounded-full object-cover" style={{ border: "2px solid var(--arbor-rule-strong)" }} />
              )}
              {exportLines != null ? (
                <>
                  <div data-testid="consult-export-preview" className="mt-2 flex flex-col gap-0.5">
                    {exportLines.map((line, i) => (
                      <p
                        key={i}
                        data-line-role={line.role}
                        dir={uiLang === "he" ? "rtl" : "ltr"}
                        className={`whitespace-pre-wrap break-words ${PREVIEW_ROLE_CLS[line.role]}${!previewAll && i >= PREVIEW_PHONE_LINES ? " hidden lg:block" : ""}`}
                        style={{ color: line.role === "note" ? MUTED : INK }}
                      >
                        <FreeText text={line.text} />
                      </p>
                    ))}
                  </div>
                  {!previewAll && exportLines.length > PREVIEW_PHONE_LINES && (
                    <button
                      type="button"
                      data-testid="consult-preview-all"
                      onClick={() => setPreviewAll(true)}
                      className="lg:hidden inline-flex items-center min-h-[44px] t-sm font-bold"
                      style={{ color: "var(--arbor-clay)" }}
                    >
                      {t("elev.carehonesty.consult.preview.showAll")}
                    </button>
                  )}
                </>
              ) : (
                <p role="alert" className="t-xs font-bold leading-relaxed mt-2" style={{ color: "var(--arbor-pink-ink)" }}>
                  {exportBuild.error}
                </p>
              )}
            </section>
            {/* B-CAREPRO-52: per-export likeness choice — off by default, a
                44 px include-toggle like the rest of the screen; shown only
                when a stylized hero exists. Toggling withdraws "I reviewed". */}
            {likenessAvailable && (
              <button
                type="button"
                data-testid="consult-include-likeness"
                aria-pressed={likenessIncluded}
                onClick={toggleLikeness}
                className="inline-flex max-w-full items-center gap-1.5 t-sm font-bold rounded-xl px-3.5 py-2 min-h-[44px] text-start transition self-start"
                style={likenessIncluded
                  ? { background: "var(--arbor-subtab-active)", color: "var(--arbor-subtab-on-ink)" }
                  : { background: "var(--arbor-paper-sunk)", color: INK, border: `1px solid ${RULE}` }}
              >
                <Icon name="face" size={14} fill={likenessIncluded ? 1 : 0} />
                <span>{t(likenessIncluded ? "elev.carehonesty.consult.likeness.on" : "elev.carehonesty.consult.likeness.off", { name: firstName })}</span>
              </button>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <span className="t-sm font-bold me-auto" style={{ color: MUTED }} aria-live="polite">
                {t("consult.selected", { n: includedCount })}
              </span>
              {/* W2-CAREPRO c2 r1: the gate is the screen's own include-toggle
                  pattern — a 44x44 button with aria-pressed, never a bare 16 px
                  browser checkbox. */}
              <button
                type="button"
                data-testid="consult-reviewed"
                aria-pressed={reviewed && approval.current === exportReceipt}
                onClick={() => {
                  if (!egress.isCurrent() || latestExport.current !== exportReceipt) return;
                  const next = approval.current !== exportReceipt;
                  approval.current = next ? exportReceipt : null;
                  setReviewed(next);
                }}
                className="flex items-center gap-2 min-w-[220px] min-h-[44px] text-start t-xs font-bold leading-snug"
                style={{ color: INK }}
              >
                <span className="flex-shrink-0 w-11 h-11 -ms-2.5 flex items-center justify-center">
                  <span
                    className="w-6 h-6 rounded-md flex items-center justify-center"
                    style={reviewed && approval.current === exportReceipt ? { background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" } : { background: "var(--arbor-paper-elevated)", border: "1.5px solid var(--arbor-rule-strong)" }}
                  >
                    {reviewed && approval.current === exportReceipt && <Icon name="check" size={16} weight={600} />}
                  </span>
                </span>
                <span>{t("consult.reviewed")}</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={copy} disabled={noneSelected}
                data-testid="consult-copy"
                className="inline-flex items-center gap-2 font-bold text-sm rounded-xl px-4 py-3 transition disabled:opacity-50 min-h-[44px]"
                // W2-CAREPRO c2 r1: a solid clay secondary — the one gradient is Build.
                style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}>
                <Icon name="content_copy" size={17} /> {t("consult.copy")}
              </button>
              <button onClick={savePdf} disabled={noneSelected}
                data-testid="consult-pdf"
                className="inline-flex items-center gap-2 font-bold text-sm rounded-xl px-4 py-3 transition disabled:opacity-50 min-h-[44px]"
                style={{ background: "var(--arbor-paper-sunk)", color: INK, border: `1px solid ${RULE}` }}>
                <Icon name="description" size={17} /> {t("elev.carehonesty.consult.pdf")}
              </button>
              {/* LC-16 / B-CAREPRO-19 — hand the same audience-capped packet
                  to someone the parent already trusts. */}
              <button
                onClick={sendToTrusted}
                disabled={noneSelected}
                data-testid="consult-send-trusted"
                className="inline-flex items-center gap-2 font-bold text-sm rounded-xl px-4 py-3 transition disabled:opacity-50 min-h-[44px]"
                style={{ background: "var(--arbor-paper-sunk)", color: INK, border: `1px solid ${RULE}` }}>
                <Icon name="mail" size={17} />
                {t("elev.learnCare.trusted.send")}
              </button>
            </div>
          </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
