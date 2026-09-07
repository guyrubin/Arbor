import React, { useEffect, useRef, useState } from "react";
import { Modal } from "../ui/Modal";
import ConfirmCaptureReview from "./ConfirmCaptureReview";
import type { CaptureSource } from "./ConfirmCaptureReview";
import { MarkdownBlock } from "../ui/MarkdownBlock";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import type { CaptureMode } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { api, EscalationRequiredError, getAiLanguage } from "../../lib/api";
import { escalationCategories, renderEscalationMarkdown } from "../../safety/escalation";
import { BEHAVIOR_TYPES, DEFAULT_BEHAVIOR_TYPE, EXTRACT_CONTEXTS, behaviorTypeLabel, isIncidentType, normalizeExtractedLog, validateLogDraft } from "../../content/behaviorTaxonomy";
import type { BehaviorContext } from "../../types";
import { speechSupported, startDictation } from "../../lib/speech";

/** Lightweight behavior log capture that can be opened from anywhere (e.g. Overview).
 *
 *  TJB-08: `mode` lets a caller open the modal ALREADY dictating. Today's mic
 *  tile used to call `setActiveTab("behaviors")` — the capture executed on a
 *  different hub, so a parent who tapped "voice" on Today landed on Behaviors
 *  with the URL changed under them. The dictation seam (lib/speech) and the
 *  extraction seam (api.extractLog, already used by the typed path below) are
 *  both reusable here, so voice needs no new capture path and no new screen.
 *  The photo tile still hands off — see FOLLOW-UPS: `addMoment` in
 *  ArborContext does not carry `photoAttachment`, so a photo captured through
 *  the one-field moment form would be silently dropped. */
export default function QuickLogModal({ open, onClose, mode = "text" }: { open: boolean; onClose: () => void; mode?: CaptureMode }) {
  const {
    newLogType,
    setNewLogType,
    newLogIntensity,
    setNewLogIntensity,
    newLogTrigger,
    setNewLogTrigger,
    newLogResponse,
    setNewLogResponse,
    newLogDuration,
    setNewLogDuration,
    newLogContext,
    setNewLogContext,
    newLogNotes,
    setNewLogNotes,
    childProfile,
    handleAddLog,
    addMoment,
    offerPostCaptureCoach,
  } = useArbor();
  const { toast } = useToast();
  const { t, uiLang } = useLanguage();
  const [reviewing, setReviewing] = useState(false);
  // AI-CAP-3: factual provenance of the current draft — 'ai-draft' whenever
  // the extraction seam filled the fields (the review line must never claim
  // the parent wrote what the model drafted), 'text' for a hand-filled form.
  const [source, setSource] = useState<CaptureSource>("text");
  const [drafting, setDrafting] = useState(false);
  // TJB-01: the modal opens as a ONE-field moment ("What happened?") — the
  // Journal's "catch the moment" promise. The incident form (type, intensity,
  // what you tried) is opt-in behind "This was a hard moment", so a joyful
  // moment never has to invent a challenge type or a parent response.
  const [hardMoment, setHardMoment] = useState(false);
  const toggleHardMoment = (on: boolean) => {
    setHardMoment(on);
    if (on && !isIncidentType(newLogType)) setNewLogType(DEFAULT_BEHAVIOR_TYPE);
  };
  // AI-CAP-3 firewall condition: a 409 on the TYPED path renders the FULL
  // crisis-resources surface (never a toast) and writes ZERO draft fields —
  // the ApiError must not fall through to sentence-into-trigger.
  const [escalationMarkdown, setEscalationMarkdown] = useState<string | null>(null);
  // TJB-08: dictation state, mirroring BehaviorsTab's contract exactly —
  // continuous with generous endpointing (AI-CAP-6), live interim caption
  // (AI-V7), and the parent's UI language (AI-CAP-2), so a Hebrew parent's
  // speech is never transcribed as English garbage.
  const [listening, setListening] = useState(false);
  const [voiceInterim, setVoiceInterim] = useState("");
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!open) {
      setReviewing(false);
      setSource("text");
      setEscalationMarkdown(null);
      setHardMoment(false);
      stopRef.current?.();
    }
  }, [open]);
  // TODAY-3: the review step is the SHARED ConfirmCaptureReview contract
  // (also rendered by BehaviorsTab for voice/photo/handoff captures — one
  // contract, never a forked path). CODEX-7: its provenance line states only
  // the factual source ("written by you" / "drafted by Arbor"); NO static
  // confidence/certainty wording may return (firewall generative-honesty
  // rule; guarded by todayConsolidation.test.ts + confirmCaptureReview.test.ts).

  // AI-CAP-3: typed capture through the ONE hardened extraction seam — a messy
  // sentence + Enter yields a fully-prefilled review card in one model
  // round-trip. Every field is clamped via the shared taxonomy module
  // (AI-CAP-8); an empty extracted response prefills a neutral, editable
  // placeholder. Extraction failure (non-escalation) leaves today's manual
  // form untouched — the typed sentence stays in the trigger field.
  const TYPED_EXTRACT_MIN_CHARS = 25;
  const extractFromTyped = async (text: string) => {
    setDrafting(true);
    setEscalationMarkdown(null);
    try {
      const d = await api.extractLog({ message: text, childProfile, language: getAiLanguage() });
      const n = normalizeExtractedLog(d, text);
      setNewLogType(n.behaviorType);
      setNewLogIntensity(n.intensity);
      setNewLogDuration(n.durationMinutes);
      setNewLogContext(n.context as BehaviorContext);
      setNewLogTrigger(n.trigger);
      setNewLogResponse(n.response || t("beh.extract.noResponse"));
      if (n.notes) setNewLogNotes(n.notes);
      setSource("ai-draft");
      setHardMoment(true);
      setReviewing(true);
    } catch (err) {
      // FAIL-CLOSED: the escalation branch runs FIRST and writes no draft field.
      if (err instanceof EscalationRequiredError) {
        const match =
          escalationCategories.find((c) => c.category === err.category) ??
          escalationCategories[0];
        setEscalationMarkdown(renderEscalationMarkdown({ category: match.category, label: match.label, resources: match.resources }));
      } else {
        // Only AFTER the escalation branch: degrade to today's manual form —
        // the sentence is already in the trigger field, nothing is lost.
        toast(t("beh.toast.voiceFallback"), "info");
      }
    } finally {
      setDrafting(false);
    }
  };

  /* TJB-08 — voice capture, in place.
     The finalized transcript lands in the ONE moment field, exactly where a
     typed sentence lands, and then takes the SAME hardened path: long enough
     and it goes through api.extractLog into the shared ConfirmCaptureReview;
     too short and it simply sits in the field for the parent to finish. So the
     escalation screen, the taxonomy clamp and the explicit-confirm gate all
     apply unchanged — there is no second capture path, only a second way of
     filling the same field. Provenance is honest on both branches: "voice"
     for a transcript the parent finishes themselves, and "ai-draft" the moment
     extraction fills the fields — the review line must never claim the parent
     wrote what the model drafted (CODEX-7). */
  const startVoice = () => {
    if (listening) {
      stopRef.current?.();
      return;
    }
    if (!speechSupported()) {
      // Not an error to recover from — the modal stays open on the typed form,
      // which is a strictly better outcome than the old hub switch.
      toast(t("beh.toast.voiceUnsupported"), "error");
      return;
    }
    setListening(true);
    setVoiceInterim("");
    stopRef.current = startDictation(
      {
        onResult: (text) => {
          const said = text.trim();
          if (!said) return;
          setNewLogTrigger(said);
          setSource("voice");
          if (said.length >= TYPED_EXTRACT_MIN_CHARS) void extractFromTyped(said);
        },
        onInterim: (text) => setVoiceInterim(text),
        onError: () => toast(t("beh.toast.voiceError"), "error"),
        onEnd: () => {
          setListening(false);
          setVoiceInterim("");
          stopRef.current = null;
        },
      },
      uiLang === "he" ? "he-IL" : "en-US",
      { continuous: true },
    );
  };

  // Opening the modal in voice mode starts dictating immediately — the tap on
  // Today's mic tile IS the consent, and asking for a second tap inside the
  // modal would make the in-place path slower than the hub switch it replaces.
  const armedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      armedRef.current = false;
      return;
    }
    if (mode !== "voice" || armedRef.current) return;
    armedRef.current = true;
    startVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  // TJB-01: the plain-moment save — one field, one tap, no review step (there
  // is nothing drafted to review; the parent wrote every word).
  const saveMoment = (e: React.FormEvent) => {
    e.preventDefault();
    const written = addMoment(newLogTrigger);
    if (!written) {
      toast(t("beh.toast.fillTrigger"), "error");
      return;
    }
    setNewLogTrigger("");
    onClose();
    toast(t("ql.moment.okToast"), "success");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateLogDraft({ behaviorType: newLogType, trigger: newLogTrigger, response: newLogResponse })) {
      toast(t("ql.errToast"), "error");
      return;
    }
    setReviewing(true);
  };

  const confirm = (e: React.FormEvent) => {
    // AI-CAP-5: inline review editing can empty a required field — keep the
    // review open with a calm error instead of a silent failed write.
    if (validateLogDraft({ behaviorType: newLogType, trigger: newLogTrigger, response: newLogResponse })) {
      e.preventDefault();
      toast(t("ql.errToast"), "error");
      return;
    }
    // AI-CAP-7: snapshot the confirmed fields BEFORE handleAddLog resets the
    // form, then offer the ONE dismissible post-capture coach CTA (rendered
    // globally by PostCaptureCoachStrip; prefill-only via seedCoach
    // source 'post-capture', never auto-sent, no write-path change).
    const confirmedPrompt = t("beh.postCapture.prompt", {
      name: (childProfile.name || "").split(" ")[0],
      type: behaviorTypeLabel(newLogType, t),
      trigger: newLogTrigger,
      response: newLogResponse,
    });
    handleAddLog(e);
    setReviewing(false);
    setSource("text");
    onClose();
    toast(t("ql.okToast"), "success");
    offerPostCaptureCoach(confirmedPrompt);
  };

  const discard = () => {
    setNewLogTrigger("");
    setNewLogResponse("");
    setNewLogNotes("");
    setReviewing(false);
    setSource("text");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t("ql.title")}>
      {escalationMarkdown ? (
        <div role="alert" dir="auto" data-testid="quicklog-escalation" className="space-y-3 text-sm">
          <MarkdownBlock text={escalationMarkdown} className="space-y-2 text-xs leading-relaxed" />
          <button
            type="button"
            onClick={() => setEscalationMarkdown(null)}
            className="min-h-11 w-full rounded-xl px-3 text-xs font-bold"
            style={{ border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-muted)" }}
          >
            {t("beh.escalation.dismiss")}
          </button>
        </div>
      ) : reviewing ? <ConfirmCaptureReview
        // AI-CAP-5: same 7-field honest review as BehaviorsTab — intensity,
        // context, and duration (the fields extraction guesses hardest) are
        // shown and inline-correctable in place; setters write straight into
        // the one draft state the confirmed write reads.
        source={source}
        rows={[
          { label: t("ql.type"), value: behaviorTypeLabel(newLogType, t) },
          { label: t("ql.review.trigger"), value: newLogTrigger, onChange: setNewLogTrigger },
          { label: t("ql.review.response"), value: newLogResponse, onChange: setNewLogResponse },
          { label: t("beh.notes"), value: newLogNotes, onChange: setNewLogNotes },
        ]}
        intensity={newLogIntensity}
        onIntensityChange={setNewLogIntensity}
        context={newLogContext}
        contextOptions={[...EXTRACT_CONTEXTS]}
        onContextChange={(c) => setNewLogContext(c as BehaviorContext)}
        durationMinutes={newLogDuration}
        onDurationChange={setNewLogDuration}
        onEdit={() => setReviewing(false)}
        onDiscard={discard}
        onConfirm={confirm}
      /> : !hardMoment ? <form onSubmit={saveMoment} className="space-y-4 text-sm" data-testid="quicklog-moment-form">
        {/* TJB-08: the live dictation strip. Present only while listening, so
            the typed path is byte-identical to what it was. */}
        {listening && (
          <div className="flex items-start gap-3 rounded-xl p-3" role="status" data-testid="quicklog-listening"
            style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
            <Icon name="mic" size={18} style={{ color: "var(--arbor-green-ink)" }} />
            <p dir="auto" className="min-w-0 flex-1 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
              {voiceInterim || t("beh.mode.voice")}
            </p>
            <button type="button" onClick={() => stopRef.current?.()} className="touch-target px-2 text-xs font-bold" style={{ color: "var(--arbor-green-ink)" }}>
              {t("elev.ql.voice.stop")}
            </button>
          </div>
        )}
        <div className="space-y-1.5">
          <label htmlFor="quick-log-moment" className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ql.moment.label")}</label>
          <input
            id="quick-log-moment"
            value={newLogTrigger}
            onChange={(e) => setNewLogTrigger(e.target.value)}
            placeholder={t("ql.moment.ph")}
            autoFocus
            className="min-h-11 w-full rounded-xl p-2.5 text-sm focus:outline-none"
            style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
          />
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
          <input type="checkbox" checked={hardMoment} onChange={(e) => toggleHardMoment(e.target.checked)} className="h-5 w-5" style={{ accentColor: "var(--arbor-clay)" }} />
          <span className="min-w-0">
            <span className="block text-xs font-bold" style={{ color: "var(--arbor-ink)" }}>{t("ql.moment.hard")}</span>
            <span className="block text-[11px]" style={{ color: "var(--arbor-muted)" }}>{t("ql.moment.hardHint")}</span>
          </span>
        </label>
        <button type="submit" className="min-h-11 w-full py-3 text-white font-extrabold text-xs rounded-xl transition active:scale-[0.98]" style={{ background: "var(--arbor-gradient-primary)" }}>
          {t("ql.moment.save")}
        </button>
      </form> : <form onSubmit={submit} className="space-y-4 text-sm">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
          <input type="checkbox" checked={hardMoment} onChange={(e) => toggleHardMoment(e.target.checked)} className="h-5 w-5" style={{ accentColor: "var(--arbor-clay)" }} />
          <span className="block text-xs font-bold" style={{ color: "var(--arbor-ink)" }}>{t("ql.moment.hard")}</span>
        </label>
        <div className="space-y-1.5">
          <label htmlFor="quick-log-type" className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ql.type")}</label>
          {/* AI-CAP-8: options render from the ONE shared taxonomy module — no
              duplicated option literals across capture forms. TJB-01: the
              incident form lists incident types only; the neutral Moment is
              the other branch of this modal. */}
          <select id="quick-log-type" value={newLogType} onChange={(e) => setNewLogType(e.target.value)} className="w-full rounded-xl p-2.5 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
            {BEHAVIOR_TYPES.map((b) => (
              isIncidentType(b.value) ? <option key={b.value} value={b.value}>{t(b.shortLabelKey)}</option> : null
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="quick-log-intensity" className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ql.intensity")} <span style={{ color: "var(--arbor-green-ink)" }}>{newLogIntensity} / 5</span></label>
          <input id="quick-log-intensity" type="range" min={1} max={5} value={newLogIntensity} onChange={(e) => setNewLogIntensity(parseInt(e.target.value))} className="w-full" style={{ accentColor: "var(--arbor-clay)" }} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="quick-log-trigger" className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ql.trigger")}</label>
          <input
            id="quick-log-trigger"
            value={newLogTrigger}
            onChange={(e) => setNewLogTrigger(e.target.value)}
            // AI-CAP-3: Enter on a long fresh description drafts the FULL log
            // through the extraction seam (review opens directly); short
            // inputs keep today's plain-form behavior.
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const typed = newLogTrigger.trim();
              if (!newLogResponse.trim() && typed.length > TYPED_EXTRACT_MIN_CHARS) {
                e.preventDefault();
                void extractFromTyped(typed);
              }
            }}
            placeholder={t("ql.triggerPh")}
            className="w-full rounded-xl p-2.5 text-xs focus:outline-none"
            style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="quick-log-response" className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ql.response")}</label>
          <input id="quick-log-response" value={newLogResponse} onChange={(e) => setNewLogResponse(e.target.value)} placeholder={t("ql.responsePh")} className="w-full rounded-xl p-2.5 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
        </div>

        <button type="submit" disabled={drafting} className="w-full py-3 text-white font-extrabold text-xs rounded-xl transition active:scale-[0.98] disabled:opacity-60" style={{ background: "var(--arbor-gradient-primary)" }}>
          {drafting ? (
            <span className="inline-flex items-center gap-1.5"><Icon name="progress_activity" size={14} className="animate-spin" /> {t("beh.parsing")}</span>
          ) : (
            t("ql.save")
          )}
        </button>
      </form>}
    </Modal>
  );
}
