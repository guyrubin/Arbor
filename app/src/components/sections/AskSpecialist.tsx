import React, { useEffect, useMemo, useState } from "react";
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
  sectionTitle,
  serializeForExport,
  exportPrintSections,
  normalizeExportAudience,
  EXPORT_AUDIENCES,
  DEFAULT_EXPORT_AUDIENCE,
  type ExportAudience,
} from "../../consult/packet";
import { ClinicalLanguageError } from "../../lib/clinicalScan";
import { trackShareInitiated, trackShareCompleted } from "../../lib/loopEvents";
import { recordExport } from "../../consult/exportHistory";
import { InsetRow } from "../ui/kit";
import { useConsultPdf } from "./Reports";
// LC-20 + LC-12: the reason for the visit, the questions prepared in
// Appointments, and the discipline-specific evidence each preset reads.
import { useChildCollection } from "../../hooks/useChildCollection";
import type { LangObservation } from "../../growth/vocabAgg";
import type { GrowthEntry } from "../../growth/growthEntries";

/* Care › Consult — "Prepare for a visit" (b3 → B-CAREPRO-28).
   One spine (a parent-redacted packet from the child's record) in three steps:

   1 · Who is it for? — the audience IS the preset: pediatrician · speech
       therapist · behaviour/psychology · another clinician · teacher · my own
       records. A teacher is handed to the School Brief (one teacher document,
       LC-11); every other audience builds its own preset packet.
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

export default function AskSpecialist() {
  const { childProfile, behaviorLogs, milestones, actionPlans, approvedMemoryItems, setActiveTab, pendingConsultPrefill, consumeConsultPrefill } = useArbor();
  const { toast } = useToast();
  const { t, uiLang } = useLanguage();
  const reduceMotion = useReducedMotion();
  const printPdf = useConsultPdf();
  const firstName = (childProfile.name || "your child").split(" ")[0];
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [reviewed, setReviewed] = useState(false);

  // Step 1: the audience (= the preset); remembered per device.
  const [audience, setAudienceState] = useState<ExportAudience>(readStoredAudience);
  const setAudience = (a: ExportAudience) => {
    // Consent applies to the exact outgoing audience. Clear it in this click
    // transaction, rather than waiting for the effect below, so an immediate
    // export cannot reuse approval for a different recipient.
    if (a !== audience) setReviewed(false);
    setAudienceState(a);
    try { localStorage.setItem(AUDIENCE_STORAGE_KEY, a); } catch { /* metadata only */ }
  };
  const isTeacher = audience === "teacher";

  // AIX-S3(a): the Vision handoff note lands HERE — as a parent-editable note in
  // the composer, never as an auto-share. Consume the one-shot seam into local
  // editable state; the note rides into copy/PDF/send ONLY through the parent's
  // explicit acts (all behind the reviewed-checkbox gate).
  const [visionNote, setVisionNote] = useState("");

  // LC-20 — REASON FOR VISIT. Always shown; rides into every clinician packet
  // in the parent's own words. Device-local until an export the parent takes.
  const [reason, setReason] = useState("");

  // The parent's prepared questions and the discipline-specific evidence — the
  // same registered per-child sinks Appointments, Language Lab and the growth
  // card write. Read-only here.
  const questionsCol = useChildCollection<{ id: string; text: string }>(childProfile.id, "apptQuestions");
  const langObsCol = useChildCollection<LangObservation>(childProfile.id, "langObs", { orderByField: "timestamp", orderDir: "desc", max: 200 });
  const growthCol = useChildCollection<GrowthEntry>(childProfile.id, "growthEntries", { orderByField: "date", orderDir: "desc", max: 200 });
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
    const patch = resolveConsultPrefill(pendingConsultPrefill);
    if (patch.reason !== undefined) setReason(patch.reason);
    if (patch.note !== undefined) setVisionNote(patch.note);
    if (patch.audience !== undefined) setAudienceState(patch.audience);
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
    trackShareInitiated("story", "ask_specialist");
    const subject = t("elev.learnCare.trusted.subject", { name: firstName });
    const href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(exportText)}`;
    try {
      window.location.href = href;
      trackShareCompleted("story", "email");
    }
    catch { toast(t("elev.packet.copyFailed"), "error"); }
  };

  const packet = useMemo(
    () => buildConsultPacket({
      // LC-17b: the SHARED input assembler (consult/packet.buildPacketInput) —
      // one mapping for this surface and both sides of a share.
      ...buildPacketInput(
        { profile: childProfile, logs: behaviorLogs, milestones, plans: actionPlans, memory: approvedMemoryItems },
        Date.now()
      ),
      // LC-20 / LC-12 — the parent's own voice and the evidence each preset reads.
      reason,
      questions: preparedQuestions,
      langObs: langObsCol.items
        .map((o) => ({ phrase: o.phrase ?? "", language: o.language, at: o.timestamp }))
        .filter((o) => o.phrase.trim().length > 0),
      growthEntries: growthCol.items.map((g) => ({ date: g.date, heightCm: g.heightCm, weightKg: g.weightKg })),
    }),
    [childProfile, behaviorLogs, milestones, actionPlans, approvedMemoryItems, reason, preparedQuestions, langObsCol.items, growthCol.items]
  );

  // LC-06: "about" is always emitted, so the honest emptiness test is
  // "nothing beyond about" — the authored empty state can finally mount.
  const isEmpty = isConsultPacketEmpty(packet);
  const includedCount = countIncluded(packet, excluded);
  const toggle = (id: string) =>
    setExcluded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // LC-08 / B-CAREPRO-28: the ONE export text for Copy and Send, for the
  // chosen preset — audience-capped and note-scanned. A blocked build yields
  // NO text (fail closed) and a parent-readable reason; every verb disables
  // until the parent fixes it. The teacher branch builds nothing here: the
  // School Brief is the one teacher document.
  const exportBuild = useMemo<ExportBuild>(() => {
    if (isTeacher) return { text: null, error: "" };
    try {
      // LC-13 / item 8: `uiLang` renders the packet SCAFFOLD in the parent's language.
      return { text: serializeForExport(audience, packet, excluded, visionNote, t("consult.visionNote.heading"), uiLang), error: null };
    } catch (err) {
      // Fail closed: a forbidden token or a % in the note blocks every verb.
      return { text: null, error: err instanceof ClinicalLanguageError ? t("elev.carehonesty.consult.blocked.generic") : t("consult.exportError") };
    }
  }, [isTeacher, audience, packet, excluded, visionNote, t, uiLang]);
  const exportText = exportBuild.text;
  const noneSelected = includedCount === 0 || !reviewed || exportText == null;

  useEffect(() => { setReviewed(false); }, [excluded, visionNote, reason, audience, childProfile.id]);

  const copy = async () => {
    if (exportText == null) return;
    // Growth loop (P0-4): the consult packet is a `story` artifact shared to a
    // professional — reuse the existing union value, don't mint a new one here.
    trackShareInitiated("story", "ask_specialist");
    try {
      await navigator.clipboard.writeText(exportText);
      trackShareCompleted("story", "clipboard");
      toast(t("elev.packet.copied"), "success");
    }
    catch { toast(t("elev.packet.copyFailed"), "error"); }
  };

  // B-CAREPRO-28: ONE PDF for the chosen audience — the same preset, the same
  // redaction and the same note as the Copy text (exportPrintSections is the
  // print twin of serializeForExport). Fail closed: a blocked build prints
  // nothing and records nothing.
  const savePdf = () => {
    if (exportText == null || isTeacher) return;
    try {
      const sections = exportPrintSections(audience, packet, excluded, visionNote, t("consult.visionNote.heading"), uiLang);
      printPdf(audience, sections);
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
            className="touch-target !justify-start w-full cursor-pointer list-none gap-2 px-4 text-[12px] font-extrabold"
            style={{ color: GREEN }}
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
                <span className="inline-flex items-center gap-2 text-[12px] font-extrabold" style={{ color: GREEN }}>
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
    <h2 id={id} className="flex items-center gap-2 text-[15px] font-extrabold" style={{ fontFamily: "var(--font-display)", color: INK }}>
      <span aria-hidden="true" className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[12px] font-extrabold" style={{ background: GREEN_SOFT, color: GREEN }}>{n}</span>
      {label}
    </h2>
  );

  return (
    /* W2: one DOM/visual sequence: who, purpose, editable packet, contract, review/export. */
    <motion.div {...motionProps} className="flex flex-col gap-5 max-w-[1180px]">
      {/* Step 1 · Who is it for? — the audience IS the preset (B-CAREPRO-28).
          LC-28 / OBJ-CARE-02: the hub CTA scrolls to and focuses this row. */}
      <section data-testid="consult-audience-step" className="flex flex-col gap-2">
        {stepHeading(1, t("elev.carehonesty.consult.audience.label"), "consult-audience-label")}
        <div
          id="consult-audience-row"
          data-testid="consult-audience-row"
          tabIndex={-1}
          role="radiogroup"
          aria-labelledby="consult-audience-label"
          className="flex flex-wrap items-center gap-1.5 focus:outline-none"
          style={{ scrollMarginBlockStart: "0.75rem" }}
        >
          {EXPORT_AUDIENCES.map((a) => {
            const on = a === audience;
            return (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setAudience(a)}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-bold rounded-xl px-3.5 py-2 min-h-[44px] transition"
                style={on
                  ? { background: GREEN, color: "var(--arbor-paper-elevated)" }
                  : { background: "var(--arbor-paper-sunk)", color: INK, border: `1px solid ${RULE}` }}
              >
                {on && <Icon name="check" size={14} weight={600} />}
                {t(`elev.carehonesty.consult.audience.${a}`)}
              </button>
            );
          })}
        </div>
        <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
          {t(`elev.carehonesty.consult.audience.hint.${audience}`)}
        </p>
      </section>

      {isTeacher ? (
        /* LC-11 / B-CAREPRO-28 — ONE teacher document. A teacher never gets
           this packet's text; the School Brief (classroom words, per-export
           approval, fail-closed scan) is the teacher branch. */
        <section data-testid="consult-teacher-branch" className="rounded-[22px] p-5" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-sm)" }}>
          <h2 className="text-[15px] font-extrabold" style={{ fontFamily: "var(--font-display)", color: INK }}>
            {t("elev.carehonesty.consult.teacher.title", { name: firstName })}
          </h2>
          <p className="text-[13px] leading-relaxed mt-1.5" style={{ color: MUTED }}>{t("elev.carehonesty.consult.teacher.body")}</p>
          <button
            type="button"
            data-testid="consult-teacher-open"
            onClick={() => setActiveTab("school-brief")}
            className="inline-flex items-center gap-2 font-bold text-sm rounded-xl px-4 py-3 mt-4 min-h-[44px]"
            style={{ background: "var(--arbor-gradient-primary)", color: "var(--arbor-paper-elevated)", boxShadow: "var(--arbor-clay-glow)" }}
          >
            <Icon name="school" size={17} /> {t("elev.carehonesty.consult.teacher.cta")}
          </button>
        </section>
      ) : (
        <>
      {/* Step 2 · What changed — purpose first; the same builder carries it into every clinician packet. */}
      <section data-testid="consult-reason-section" className="border-t pt-5" style={{ borderColor: RULE }}>
        {stepHeading(2, t("elev.carehonesty.consult.step.changed"))}
        <label htmlFor="consult-reason" className="inline-flex items-center gap-2 text-[14px] font-bold mt-3" style={{ color: GREEN }}>
          <Icon name="help" size={16} /> {t("elev.learnCare.reason.label")}
        </label>
        <p className="text-sm leading-relaxed mt-1 max-w-[65ch]" style={{ color: MUTED }}>{t("elev.learnCare.reason.hint")}</p>
        <textarea
          id="consult-reason"
          data-testid="consult-reason-input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          dir="auto"
          placeholder={t("elev.learnCare.reason.placeholder")}
          className="w-full text-[13.5px] leading-relaxed rounded-[13px] px-3 py-2.5 mt-2 resize-y min-h-[56px]"
          style={{ color: INK, background: "var(--arbor-paper-sunk)", border: `1px solid ${RULE}` }}
        />
        {reason.trim() === "" && (
          <p className="text-xs mt-1.5" style={{ color: MUTED }}>{t("elev.learnCare.reason.missing")}</p>
        )}
        {preparedQuestions.length > 0 && (
          <p className="text-xs mt-2 inline-flex items-center gap-1.5" style={{ color: GREEN }}>
            <Icon name="check_circle" size={14} fill={1} /> {t("elev.learnCare.appt.questions.toPacket")}
          </p>
        )}
      </section>

      {/* AIX-S3(a): the Vision handoff note — parent-editable BEFORE anything is
          shared. Rendered whenever a note arrived (independent of packet data)
          so the prefill is never silently dropped; the parent can edit or
          remove it, and it joins the packet only via the explicit export acts. */}
      {visionNote.trim() !== "" && (
        <section className="rounded-[18px] p-4" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}` }}>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-[12px] font-extrabold" style={{ color: GREEN }}>
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
            onChange={(e) => setVisionNote(e.target.value)}
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
        <div className="rounded-2xl p-8 text-center" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}` }}>
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mx-auto" style={{ background: GREEN_SOFT, color: GREEN }}>
            <Icon name="edit_note" size={26} />
          </span>
          <h2 className="text-[17px] font-extrabold mt-3" style={{ fontFamily: "var(--font-display)", color: INK }}>{t("consult.empty.title")}</h2>
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
            <h3 className="text-[15px] font-extrabold" style={{ fontFamily: "var(--font-display)", color: INK }}>{t("care.packet.title")}</h3>
            <p className="text-[12px] font-semibold mt-1.5 leading-relaxed" style={{ color: MUTED }}>{t("care.lead", { name: firstName })}</p>

            <div className="flex flex-col gap-2.5 mt-4">
              {packet.sections.map((section) => (
                <div key={section.id} className="flex flex-col gap-2">
                  {section.items.map((it) => {
                    const on = !excluded.has(it.id);
                    return (
                      <InsetRow
                        key={it.id}
                        label={sectionTitle(section, uiLang)}
                        value={it.text}
                        excluded={!on}
                        multiline
                        testId="consult-packet-item"
                        check={
                          <button
                            onClick={() => toggle(it.id)}
                            aria-pressed={on}
                            aria-label={`Include: ${it.text}`}
                            className="flex-shrink-0 w-11 h-11 -m-3 rounded-md flex items-center justify-center transition self-start"
                            style={{ color: on ? "var(--arbor-paper-elevated)" : MUTED }}
                          >
                            <span
                              className="w-5 h-5 rounded-md flex items-center justify-center"
                              style={on ? { background: GREEN, color: "var(--arbor-paper-elevated)" } : { background: "var(--arbor-paper-sunk)", border: `1px solid ${RULE}` }}
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

            {/* LC-07: the recipient's exact text, word for word, for the
                audience chosen in step 1. A blocked build shows the reason
                here instead of any text (fail closed). */}
            <details className="mt-3.5 rounded-[13px] px-3.5 py-1" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }}>
              <summary className="cursor-pointer list-none min-h-[44px] flex items-center gap-2 text-[12.5px] font-extrabold" style={{ color: GREEN }}>
                <Icon name="visibility" size={16} /> {t("elev.carehonesty.consult.preview.toggle")}
              </summary>
              <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{t("elev.carehonesty.consult.preview.hint")}</p>
              {exportText != null ? (
                <pre
                  dir="auto"
                  data-testid="consult-export-preview"
                  className="whitespace-pre-wrap break-words text-[12px] leading-relaxed mt-2 mb-2 font-sans"
                  style={{ color: INK, fontFamily: "inherit" }}
                >
                  {exportText}
                </pre>
              ) : (
                <p role="alert" className="text-[12px] font-bold leading-relaxed mt-2 mb-2" style={{ color: "var(--arbor-pink-ink)" }}>
                  {exportBuild.error}
                </p>
              )}
            </details>
          </section>

      {/* The complete data contract remains one labeled disclosure, after the packet and before export. */}
          {packetContract}

          {/* Step 3 · What leaves — the review gate, then one set of verbs for
              the chosen audience. Follows the packet in normal flow, without
              covering unread text. */}
          <div data-testid="consult-review-export" className="border-t pt-5 flex flex-col gap-4" style={{ borderColor: RULE }}>
            {stepHeading(3, t("elev.carehonesty.consult.step.leaves"))}
            {exportText == null && (
              <span role="alert" className="text-xs font-bold leading-relaxed" style={{ color: "var(--arbor-pink-ink)" }}>
                {exportBuild.error}
              </span>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[13px] font-bold me-auto" style={{ color: MUTED }} aria-live="polite">
                {t("consult.selected", { n: includedCount })}
              </span>
              <label className="flex items-start gap-2 min-w-[220px] min-h-[44px] text-xs font-bold leading-snug" style={{ color: MUTED }}>
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0"
                />
                <span>{t("consult.reviewed")}</span>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={copy} disabled={noneSelected}
                data-testid="consult-copy"
                className="inline-flex items-center gap-2 font-bold text-sm rounded-xl px-4 py-3 transition disabled:opacity-50 min-h-[44px]"
                style={{ background: "var(--arbor-gradient-primary)", color: "var(--arbor-paper-elevated)", boxShadow: "var(--arbor-clay-glow)" }}>
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
                style={{ background: "var(--arbor-paper-sunk)", color: GREEN, border: `1px solid ${RULE}` }}>
                <Icon name="mail" size={17} />
                {t("elev.learnCare.trusted.send")}
              </button>
            </div>
          </div>
        </>
      )}
        </>
      )}
    </motion.div>
  );
}
