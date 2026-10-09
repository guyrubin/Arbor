import { translate as inputText } from "../../lib/i18n";
import React, { useEffect, useRef, useState } from "react";
import { Modal } from "../ui/Modal";
import ConfirmCaptureReview from "./ConfirmCaptureReview";
import type { CaptureSource } from "./ConfirmCaptureReview";
import { MarkdownBlock } from "../ui/MarkdownBlock";
import { Icon } from "../ui/Icon";
import RecordingIndicator from "../ui/RecordingIndicator";
import { useArbor } from "../../context/ArborContext";
import { abandonCaptureRequest, captureRequestPending, trackCaptureStarted } from "../../lib/kpiEvents";
import type { CaptureMode } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { api, EscalationRequiredError, getAiLanguage } from "../../lib/api";
import { escalationCategories, renderEscalationMarkdown } from "../../safety/escalation";
import { BEHAVIOR_TYPES, DEFAULT_BEHAVIOR_TYPE, EXTRACT_CONTEXTS, behaviorTypeLabel, extractionOpensIncidentReview, isIncidentType, normalizeExtractedLog, validateLogDraft } from "../../content/behaviorTaxonomy";
import type { BehaviorContext } from "../../types";
import { speechSupported, startDictation } from "../../lib/speech";
import { microphoneRecovery } from "../../lib/microphoneRecovery";
import MicrophoneNotice from "../ui/MicrophoneNotice";
import { fileToThumbnail } from "../../lib/image";
import { HardMomentGuideContent } from "../behaviors/HardMomentsSection";
import { recentBehaviorTypes } from "../../content/hardMomentSurface";
import { availableHardMomentCards, matchToRecentBehaviors } from "../../content/selectCards";
import type { HardMomentContext } from "../../content/pilotRelease";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { patternEchoFor } from "../../lib/patternEcho";
import { undoSavedCapture } from "../../lib/savedCaptureUndo";
import { dayKey } from "../../practice/signals";
import { SayThis } from "../ui/AiBlock";
import { hardMomentPilotText } from "../../content/hardMomentPilotText";
import { hardMomentPublication } from "../../content/pilotRelease";
import { renderSayThis, type HardMomentCard } from "../../content/hardMomentCards";
import { locText } from "../../content/hardMomentSurface";
import { isolate } from "../../lib/bidi";
import type { BehaviorLog } from "../../types";
import MilestoneProposalRow from "../loop/MilestoneProposalRow";
import { milestoneCandidateIds, milestoneMatchAllowed, requestMilestoneProposal } from "../../lib/milestones/captureMatch";
import { declineMilestoneProposal } from "../../lib/milestones/proposalLedger";
import type { MilestoneCaptureProposal } from "../../lib/captureProposals";
import { milestoneText } from "../../lib/milestoneData";
import { comparisonMonthsOf } from "../../lib/age/forChild";
import { createCaptureSession } from "../../lib/captureSession";
import { contextLabel } from "../behaviors/contextLabel";
import type { ShelfId } from "../../lib/shelves/registry";

/** Lightweight behavior log capture that can be opened from anywhere (e.g. Overview).
 *
 *  TJB-08 + B-TODAY-19: `mode` opens the ONE capture sheet in the modality
 *  the parent tapped — text, voice (already dictating) or photo (the file
 *  picker opens, with a preview and a remove control) — so Today and the
 *  Journal never hand a capture to another hub. The photo is the same
 *  in-doc thumbnail the Behaviors form stores (lib/image fileToThumbnail;
 *  Firebase Storage stays Guy's INF-6 gate). `promptKey` is the promptBank
 *  question the parent is answering: shown as a visible cue, never draft
 *  text, and stored on the log so "prompt answered" is a fact. */
export default function QuickLogModal({
  open,
  onClose,
  mode = "text",
  promptKey,
  hardMomentNow = false,
  review,
  editLogId,
  shelf,
  initialText,
  initialPhoto,
}: {
  open: boolean;
  initialText?: string;
  initialPhoto?: string;
  onClose: () => void;
  mode?: CaptureMode;
  /** B-TODAY-19: the elev.prompt.* key of the question being answered. */
  promptKey?: string | null;
  /** B-TODAY-10: opened from the "Hard moment" tile — the sheet leads with
   *  the pilot guide matched to the parent's recent moments (say this ·
   *  do now · escalation, zero model calls), then the hard-moment form. */
  hardMomentNow?: boolean;
  /** B-ASKJB-30: the draft is already filled (an AI extraction) — open
   *  straight into ConfirmCaptureReview with this provenance. The only write
   *  is Confirm (fail-closed: an AI draft never saves unreviewed). */
  review?: CaptureSource;
  /** B-ASKJB-30: edit this log in place — the incident form opens prefilled
   *  (openCaptureSheet ran startEditLog); Save updates the row through
   *  handleAddLog's editingLogId branch. */
  editLogId?: string;
  /** B-LOOP-11: opened from a journal shelf page — the plain moment is filed
   *  on that shelf (addMoment's shelf seam); a milestone proposal still asks
   *  the parent to confirm. */
  shelf?: ShelfId;
}) {
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
    newLogPhoto,
    setNewLogPhoto,
    childProfile,
    behaviorLogs,
    handleAddLog,
    addMoment,
    deleteLog,
    seedCoach,
    cancelEditLog,
    milestones,
    setMilestoneObservation,
    fileMomentOnShelf,
  } = useArbor();
  const { toast } = useToast();
  const { t, uiLang } = useLanguage();
  const sessionRef = useRef(createCaptureSession());
  sessionRef.current.sync(`${childProfile.id}:${editLogId ?? "new"}`, open);
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [photoPreparing, setPhotoPreparing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => () => { sessionRef.current.invalidate(); stopRef.current?.(); }, []);
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
  // B-TODAY-01: the dictation callback outlives the render that armed it, so
  // the branch it was spoken into is read through a ref, not a stale closure.
  const hardMomentRef = useRef(false);
  hardMomentRef.current = hardMoment;
  const toggleHardMoment = (on: boolean) => {
    setHardMoment(on);
    if (on && !isIncidentType(newLogType)) { setNewLogType(DEFAULT_BEHAVIOR_TYPE); setNewLogDuration(15); }
    if (!on) { setNewLogType("Moment"); setNewLogDuration(0); }
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
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [voiceInterim, setVoiceInterim] = useState("");
  const stopRef = useRef<(() => void) | null>(null);
  // B-TODAY-15: Today's text tile and voice tile open this sheet directly, so
  // neither emitted capture_started and a voice save was counted as "text".
  // The sheet now starts the funnel on open — unless a request is already in
  // flight (the ENG-01 nudge reaches it through requestCapture) — and a close
  // without a save abandons the request so a later save is not misattributed.
  // (A save consumes the request in trackCaptureSaved, so abandoning after a
  // save is a no-op.)
  const startedHere = useRef(false);
  useEffect(() => {
    if (open) {
      if (!captureRequestPending()) {
        trackCaptureStarted(mode === "voice" ? "voice" : mode === "photo" ? "photo" : "text");
        startedHere.current = true;
      }
      return;
    }
    if (startedHere.current) abandonCaptureRequest();
    startedHere.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  // B-TODAY-19: the photo rides the moment in place (in-doc thumbnail). It is
  // mirrored into the shared draft too, so the hard-moment form's
  // handleAddLog keeps it if the parent flips the toggle.
  const [photo, setPhoto] = useState("");
  const captureChildRef = useRef(childProfile.id);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const attachPhoto = (value: string) => {
    setPhoto(value);
    setNewLogPhoto(value);
  };
  const onPhotoPicked = async (file: File | undefined) => {
    if (!file || busyRef.current) return;
    const isCurrent = sessionRef.current.lease("photo");
    setPhotoPreparing(true);
    try {
      const thumbnail = await fileToThumbnail(file);
      if (isCurrent()) attachPhoto(thumbnail);
    } catch {
      if (isCurrent()) toast(t("beh.toast.imageError"), "error");
    } finally {
      if (isCurrent()) setPhotoPreparing(false);
    }
  };
  useEffect(() => {
    if (!open) return;
    if (initialText !== undefined) setNewLogTrigger(initialText);
    if (initialPhoto) attachPhoto(initialPhoto);
    else if (editLogId) setPhoto(newLogPhoto);
  }, [open, initialText, initialPhoto]);
  useEffect(() => {
    const childChanged = captureChildRef.current !== childProfile.id;
    captureChildRef.current = childProfile.id;
    if (childChanged) onClose();
    if (!open || childChanged) {
      setReply(null);
      setMsProposal(null);
      setMsDone(false);
      setReviewing(false);
      setDrafting(false);
      setSaving(false);
      busyRef.current = false;
      setSaveError(null);
      setPhotoPreparing(false);
      setDetailsOpen(false);
      setListening(false);
      setVoiceInterim("");
      setSource("text");
      setEscalationMarkdown(null);
      setHardMoment(false);
      setVoiceNotice(null);
      stopRef.current?.();
      setPhoto((had) => {
        if (had) setNewLogPhoto("");
        return "";
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, childProfile.id]);
  // B-TODAY-10: the tile's sheet opens on the hard-moment branch, with the
  // guide matched to the parent's own recent moment types preselected
  // (matchToRecentBehaviors(recentBehaviorTypes(logs))[0]); with no match,
  // the first guide available for this child's age. Zero model calls.
  // B-ASKJB-30: arrive in the right state. A review opens on the review
  // step over the shared draft; an edit opens the incident form as-is (the
  // type stays the log's own — never forced to the default incident type).
  useEffect(() => {
    if (!open) return;
    if (review) {
      setSource(review);
      setHardMoment(true);
      setReviewing(true);
    } else if (editLogId) {
      setHardMoment(isIncidentType(newLogType));
      setDetailsOpen(Boolean(newLogNotes || newLogContext));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, review, editLogId]);
  const closeSheet = () => {
    sessionRef.current.invalidate();
    stopRef.current?.();
    // An edit that is closed without saving must not leave editingLogId armed.
    if (editLogId) cancelEditLog();
    onClose();
  };
  useEffect(() => {
    if (open && hardMomentNow) toggleHardMoment(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hardMomentNow]);
  const hardGuide = (() => {
    if (!open || !hardMomentNow) return null;
    const now = new Date();
    const context: HardMomentContext = { now, ageMonths: ageMonthsFromProfile(childProfile, now), locale: uiLang === "he" ? "he" : "en" };
    const card =
      matchToRecentBehaviors(recentBehaviorTypes(behaviorLogs, now), undefined, now, context.ageMonths, context.locale)[0] ??
      availableHardMomentCards(context)[0];
    return card ? { card, context } : null;
  })();

  /* B-TODAY-20 — the sheet replies after Save. It swaps to one beat and stays
     open until "Done": line 1 is the count-only pattern echo (patternEchoFor,
     ≥3 of the same type in 21 days) or "Kept in {name}'s journal"; line 2 is
     ONE next move — the matched pilot guide's Say-this for a hard moment, or
     "Ask Arbor about this" (seedCoach, source post-capture, prefill only) for
     a plain one; Undo removes the row (lib/savedCaptureUndo).
     Zero model calls. The global post-capture strip is no longer raised from
     here (it stays for Behaviors until that lane retires it). */
  const [reply, setReply] = useState<null | { log: BehaviorLog; hard: boolean; seed: string }>(null);
  const [sayCopied, setSayCopied] = useState(false);
  const logIdsRef = useRef<string[]>([]);
  logIdsRef.current = behaviorLogs.map((l) => l.id);
  // B-LOOP-06 — a saved plain moment may come back with ONE milestone
  // proposal (the extract seam with the child's open in-window candidates;
  // server-validated). Nothing writes until the parent taps Add / File it.
  const [msProposal, setMsProposal] = useState<MilestoneCaptureProposal | null>(null);
  const [msDone, setMsDone] = useState(false);
  useEffect(() => {
    if (!open) {
      setReply(null);
      setSayCopied(false);
      setMsProposal(null);
      setMsDone(false);
    }
  }, [open]);
  const msTitle = (() => {
    const id = msProposal?.milestoneId;
    const m = id ? milestones.find((x) => x.id === id) : undefined;
    return m ? milestoneText(m, "title", t, { gender: childProfile.gender }) : undefined;
  })();
  const acceptMilestoneProposal = async () => {
    if (!msProposal || busyRef.current) return;
    const isCurrent = sessionRef.current.lease("write");
    busyRef.current = true; setSaving(true); setSaveError(null);
    try {
      if (msProposal.kind === "milestone" && msProposal.milestoneId) {
        await setMilestoneObservation(msProposal.milestoneId, "yes", { source: "ai_proposed_parent_confirmed", provenance: msProposal.logId });
      }
      await fileMomentOnShelf(msProposal.logId, msProposal.shelf, msProposal.kind === "milestone" ? msProposal.milestoneId : undefined, reply?.log);
      if (isCurrent()) setMsDone(true);
    } catch {
      if (isCurrent()) setSaveError(t("companion.capture.saveError"));
    } finally {
      if (isCurrent()) { busyRef.current = false; setSaving(false); }
    }
  };
  const declineMilestoneProposalRow = () => {
    if (!msProposal) return;
    declineMilestoneProposal(childProfile.id, msProposal.logId);
    setMsProposal(null);
  };
  const firstName = (childProfile.name || "").split(" ")[0];
  const replyLocale = uiLang === "he" ? "he" : "en";
  const replyEcho = reply
    ? patternEchoFor([...behaviorLogs.filter((l) => l.id !== reply.log.id), reply.log], reply.log.behaviorType, dayKey(new Date()))
    : null;
  const replyCard: HardMomentCard | null = (() => {
    if (!reply?.hard) return null;
    const now = new Date();
    const ctx: HardMomentContext = { now, ageMonths: ageMonthsFromProfile(childProfile, now), locale: replyLocale };
    return (
      matchToRecentBehaviors([reply.log.behaviorType], undefined, now, ctx.ageMonths, ctx.locale)[0] ??
      (hardGuide?.card && hardMomentPublication(hardGuide.card, ctx) ? hardGuide.card : null)
    );
  })();
  const undoReply = async () => {
    if (!reply || busyRef.current) return;
    const isCurrent = sessionRef.current.lease("write");
    busyRef.current = true; setSaving(true); setSaveError(null);
    try {
      const result = await undoSavedCapture(reply.log.id, { readLogIds: () => logIdsRef.current, removeLog: deleteLog });
      if (!isCurrent()) return;
      if (!result.undone) { setSaveError(t("companion.capture.undoError")); return; }
      setReply(null);
      closeSheet();
      toast(t("elev.capture.reply.undone"), "info");
    } catch {
      if (isCurrent()) setSaveError(t("companion.capture.undoError"));
    } finally {
      if (isCurrent()) { busyRef.current = false; setSaving(false); }
    }
  };

  // Photo mode opens the picker on arrival — the tap on the tile is the
  // gesture (same 120 ms hand-off the Behaviors form uses); the visible
  // "Add a photo" control stays for browsers that block the programmatic tap.
  useEffect(() => {
    if (!open || mode !== "photo") return;
    const timer = window.setTimeout(() => photoInputRef.current?.click(), 120);
    return () => window.clearTimeout(timer);
  }, [open, mode]);
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
  // B-TODAY-01: `from` names the form the words were captured in. From the
  // ONE-field moment form, the incident review opens ONLY when the model's
  // label really is an incident type (extractionOpensIncidentReview);
  // otherwise the parent's words stay verbatim in the moment field
  // (source "voice") and Save writes a Moment at intensity 1 via addMoment.
  // The hard-moment form's path is unchanged. Zero added model calls.
  const extractFromTyped = async (text: string, from: "moment" | "incident" = "incident") => {
    if (busyRef.current) return;
    const isCurrent = sessionRef.current.lease("extract");
    setDrafting(true);
    setEscalationMarkdown(null);
    try {
      const d = await api.extractLog({ message: text, childProfile, language: getAiLanguage() });
      if (!isCurrent()) return;
      const n = normalizeExtractedLog(d, text);
      if (from === "moment" && !extractionOpensIncidentReview(n)) return;
      setNewLogType(n.behaviorType);
      if (typeof n.intensity === "number") setNewLogIntensity(n.intensity);
      setNewLogDuration(n.durationMinutes);
      setNewLogContext(n.context as BehaviorContext);
      setNewLogTrigger(n.trigger);
      setNewLogResponse(n.response || t("beh.extract.noResponse"));
      if (n.notes) setNewLogNotes(n.notes);
      setSource("ai-draft");
      setHardMoment(true);
      setReviewing(true);
    } catch (err) {
      if (!isCurrent()) return;
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
      if (isCurrent()) setDrafting(false);
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
    if (busyRef.current) return;
    if (listening) {
      stopRef.current?.();
      return;
    }
    if (!speechSupported()) {
      // Not an error to recover from — the modal stays open on the typed form,
      // which is a strictly better outcome than the old hub switch.
      setVoiceNotice(microphoneRecovery("unsupported", uiLang));
      return;
    }
    const isCurrent = sessionRef.current.lease("voice");
    setVoiceNotice(null);
    setListening(true);
    setVoiceInterim("");
    stopRef.current = startDictation(
      {
        onResult: (text) => {
          if (!isCurrent() || busyRef.current) return;
          const said = text.trim();
          if (!said) return;
          setNewLogTrigger(said);
          setSource("voice");
          if (said.length >= TYPED_EXTRACT_MIN_CHARS) void extractFromTyped(said, hardMomentRef.current ? "incident" : "moment");
        },
        onInterim: (text) => { if (isCurrent()) setVoiceInterim(text); },
        onError: (reason) => { if (isCurrent()) setVoiceNotice(microphoneRecovery(reason, uiLang)); },
        onEnd: () => {
          if (!isCurrent()) return;
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
  const stopCaptureWork = () => {
    sessionRef.current.retire("voice");
    sessionRef.current.retire("extract");
    stopRef.current?.(); stopRef.current = null;
    setListening(false); setVoiceInterim(""); setDrafting(false);
  };
  const changeTrigger = (text: string) => {
    stopCaptureWork();
    setNewLogTrigger(text);
  };
  const saveMoment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busyRef.current || drafting || photoPreparing) return;
    if (editLogId) { await confirm(e); return; }
    const words = newLogTrigger.trim() || (photo ? t("elev.capture.photo.caption") : "");
    if (!words) { toast(t("beh.toast.fillTrigger"), "error"); return; }
    const typedWords = newLogTrigger.trim();
    stopCaptureWork();
    const isCurrent = sessionRef.current.lease("write");
    busyRef.current = true; setSaving(true); setSaveError(null);
    try {
      const written = await addMoment(words, {
        ...(photo ? { photoAttachment: photo } : {}),
        ...(promptKey ? { promptKey } : {}),
        ...(shelf ? { shelf } : {}),
        ...(newLogContext ? { context: newLogContext } : {}),
        ...(newLogNotes.trim() ? { notes: newLogNotes.trim() } : {}),
      });
      if (!isCurrent()) return;
      if (!written) { setSaveError(t("companion.capture.saveError")); return; }
      setNewLogTrigger(""); setNewLogNotes(""); setNewLogContext(""); attachPhoto("");
      setReply({ log: written, hard: false, seed: t("elev.capture.reply.seed", { name: firstName, text: written.trigger }) });
      setMsProposal(null); setMsDone(false);
      if (milestoneMatchAllowed(written, { childId: childProfile.id, hard: false, photoOnly: !typedWords })) {
        const proposalCurrent = sessionRef.current.lease("proposal");
        const candidateIds = milestoneCandidateIds(milestones, comparisonMonthsOf(childProfile));
        void requestMilestoneProposal({ extract: api.extractLog, log: written, childProfile, language: getAiLanguage(), candidateIds })
          .then((p) => { if (proposalCurrent() && p) setMsProposal(p); })
          .catch(() => { /* The moment is saved; an optional proposal may be unavailable. */ });
      }
    } catch {
      if (isCurrent()) setSaveError(t("companion.capture.saveError"));
    } finally {
      if (isCurrent()) { busyRef.current = false; setSaving(false); }
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busyRef.current || drafting || photoPreparing) return;
    stopCaptureWork();
    if (validateLogDraft({ behaviorType: newLogType, trigger: newLogTrigger, response: newLogResponse })) {
      toast(t("ql.errToast"), "error");
      return;
    }
    setReviewing(true);
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busyRef.current || drafting || photoPreparing) return;
    stopCaptureWork();
    // AI-CAP-5: inline review editing can empty a required field — keep the
    // review open with a calm error instead of a silent failed write.
    if (validateLogDraft({ behaviorType: newLogType, trigger: newLogTrigger, response: newLogResponse })) {
      e.preventDefault();
      toast(t("ql.errToast"), "error");
      return;
    }
    // AI-CAP-7 → B-TODAY-20: snapshot the confirmed fields BEFORE
    // handleAddLog resets the form; the seed is the reply panel's fallback
    // move when no pilot guide matches (prefill only, source post-capture).
    const confirmedPrompt = t("beh.postCapture.prompt", {
      name: firstName,
      type: behaviorTypeLabel(newLogType, t),
      trigger: newLogTrigger,
      response: newLogResponse,
    });
    const isCurrent = sessionRef.current.lease("write");
    busyRef.current = true; setSaving(true); setSaveError(null);
    try {
      const written = await handleAddLog(e);
      if (!isCurrent()) return;
      if (!written) { setSaveError(t("companion.capture.saveError")); return; }
      setReviewing(false); setSource("text");
      if (editLogId) {
        toast(t("capture.edit.saved"), "success");
        closeSheet();
        return;
      }
      setReply({ log: written, hard: isIncidentType(written.behaviorType), seed: confirmedPrompt });
    } catch {
      if (isCurrent()) setSaveError(t("companion.capture.saveError"));
    } finally {
      if (isCurrent()) { busyRef.current = false; setSaving(false); }
    }
  };

  const discard = () => {
    setNewLogTrigger("");
    setNewLogResponse("");
    setNewLogNotes("");
    setReviewing(false);
    setSource("text");
    closeSheet();
  };

  const optionalDetails = (
    <details open={detailsOpen} onToggle={(e) => setDetailsOpen(e.currentTarget.open)} className="rounded-xl px-3" style={{ border: "1px solid var(--arbor-rule)" }}>
      <summary className="min-h-11 cursor-pointer py-3 text-xs font-bold" style={{ color: "var(--arbor-ink-soft)" }}>{t("companion.capture.details")}</summary>
      <div className="space-y-3 pb-3">
        <div className="space-y-1">
          <label htmlFor="quick-log-context" className="block text-xs font-bold">{t("ql.review.context")}</label>
          <select id="quick-log-context" value={newLogContext} onChange={(e) => setNewLogContext(e.target.value as BehaviorContext | "")} className="min-h-11 w-full rounded-xl p-2 text-sm" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}>
            <option value="">{t("companion.capture.noPlace")}</option>
            {EXTRACT_CONTEXTS.map((context) => <option key={context} value={context}>{contextLabel(context, t)}</option>)}
          </select>
        </div>
        {hardMoment && <div className="space-y-1">
          <label htmlFor="quick-log-duration" className="block text-xs font-bold">{t("ql.review.duration")}</label>
          <input id="quick-log-duration" type="number" min={0} value={newLogDuration} onChange={(e) => setNewLogDuration(Math.max(0, Number(e.target.value) || 0))} className="min-h-11 w-full rounded-xl p-2 text-sm" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}/>
        </div>}
        <div className="space-y-1">
          <label htmlFor="quick-log-notes" className="block text-xs font-bold">{t("beh.notes")}</label>
          <textarea id="quick-log-notes" dir="auto" value={newLogNotes} onChange={(e) => setNewLogNotes(e.target.value)} rows={3} className="min-h-11 w-full rounded-xl p-2 text-sm" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}/>
        </div>
      </div>
    </details>
  );

  return (
    <Modal open={open} onClose={closeSheet} title={editLogId ? t("beh.editMoment") : hardMomentNow ? t("elev.capture.hard.title") : t("today.capture.cta")}>
      {saveError && <p role="alert" className="mb-4 rounded-xl p-3 text-sm" style={{ color: "var(--arbor-peach-ink)", background: "var(--arbor-peach-soft)" }}>{saveError}</p>}
      <fieldset disabled={saving} className="min-w-0 border-0 p-0">
      {reply ? (
        <section data-testid="quicklog-reply" aria-live="polite" className="space-y-4 text-sm">
          <p dir={replyLocale === "he" ? "rtl" : "ltr"} lang={replyLocale} data-testid="quicklog-reply-line1" className="flex items-start gap-2 text-[15px] font-bold leading-snug" style={{ color: "var(--arbor-ink)" }}>
            <Icon name="check_circle" size={20} style={{ color: "var(--arbor-green-ink)" }} className="mt-0.5 flex-none" />
            <span>
              {replyEcho
                ? t("elev.closeloop.echo.title", {
                    type: isolate(behaviorTypeLabel(replyEcho.type, t), replyLocale),
                    n: replyEcho.count,
                    days: replyEcho.windowDays,
                  })
                : t("elev.capture.reply.kept", { name: firstName })}
            </span>
          </p>
          {msProposal && msProposal.logId === reply.log.id && (
            <MilestoneProposalRow
              proposal={msProposal}
              milestoneTitle={msTitle}
              done={msDone}
              busy={saving}
              onAccept={() => void acceptMilestoneProposal()}
              onDecline={declineMilestoneProposalRow}
            />
          )}
          {replyCard ? (
            <div data-testid="quicklog-reply-saythis" className="space-y-1.5" lang={replyLocale} dir={replyLocale === "he" ? "rtl" : "ltr"}>
              <SayThis
                text={locText(renderSayThis(replyCard, firstName), replyLocale)}
                title={t("hm.section.sayThis")}
                lang={replyLocale}
                copyLabel={t("coach.action.copy")}
                copiedLabel={t("coach.cards.copied")}
                copied={sayCopied}
                onCopy={() => {
                  try { void navigator.clipboard?.writeText(locText(renderSayThis(replyCard, firstName), replyLocale)); } catch { /* best-effort */ }
                  setSayCopied(true);
                }}
              />
              <p className="px-1 text-xs" style={{ color: "var(--arbor-muted)" }}>{hardMomentPilotText(replyLocale).status}</p>
            </div>
          ) : (
            <button
              type="button"
              data-testid="quicklog-reply-ask"
              onClick={() => { seedCoach({ prompt: reply.seed, source: "post-capture" }); onClose(); }}
              className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl px-4 text-[13px] font-extrabold"
              style={{ border: "1px solid var(--arbor-green-ink)", color: "var(--arbor-green-ink)", background: "transparent" }}
            >
              {t("elev.capture.reply.ask")}
              <Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" />
            </button>
          )}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              data-testid="quicklog-reply-undo"
              onClick={() => void undoReply()}
              disabled={saving}
              className="inline-flex min-h-11 items-center px-3 text-xs font-bold"
              style={{ color: "var(--arbor-muted)" }}
            >
              {t("elev.capture.reply.undo")}
            </button>
            <button
              type="button"
              data-testid="quicklog-reply-done"
              onClick={closeSheet}
              className="inline-flex min-h-11 items-center rounded-xl px-5 text-xs font-extrabold"
              style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
            >
              {t("elev.capture.reply.done")}
            </button>
          </div>
        </section>
      ) : (<>
      {/* REC-01 (Guy, 8 Oct: "no indication of recording"): the ONE recording
          indicator, ABOVE every branch — moment form, hard moment, review and
          escalation — so a live microphone is never silent. It used to render
          only inside the moment form, so a hard-moment recording showed nothing. */}
      {listening && (
        <div className="mb-4">
          <RecordingIndicator
            interim={voiceInterim}
            hint={t("beh.capture.listening")}
            label={t("elev.rec.on")}
            stopLabel={t("elev.ql.voice.stop")}
            stopAria={t("elev.rec.stopAria")}
            onStop={() => stopRef.current?.()}
            testId="quicklog-listening"
            captionTestId="quicklog-listening-caption"
          />
        </div>
      )}
      {hardGuide && !reviewing && !escalationMarkdown && (
        <section data-testid="quicklog-hard-guide" className="mb-4 space-y-3">
          <p className="text-[13px] leading-snug" style={{ color: "var(--arbor-muted)" }}>{t("elev.capture.hard.lead")}</p>
          <HardMomentGuideContent
            card={hardGuide.card}
            context={hardGuide.context}
            childName={(childProfile.name || "").split(" ")[0]}
            t={t}
          />
          <p className="pt-1 text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("elev.capture.hard.logLead")}</p>
        </section>
      )}
      {!reply && !reviewing && !escalationMarkdown && <button type="button" onClick={startVoice} disabled={saving || drafting} aria-pressed={listening} className="inline-flex min-h-11 items-center gap-2 mb-3 px-3 rounded-xl text-sm" style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-paper-deep)" }}><Icon name={listening ? "stop" : "mic"} size={20}/>{listening ? (inputText(uiLang, "companion.input.finish-dictating")) : (inputText(uiLang, "companion.input.dictate-your-moment"))}</button>}
      {voiceNotice && <MicrophoneNotice message={voiceNotice} lang={uiLang} onRetry={startVoice} onDismiss={() => setVoiceNotice(null)} />}
      {!reviewing && !escalationMarkdown && (
          <div className="mb-4 space-y-1.5" data-testid="quicklog-photo">
            {photoPreparing && <p role="status" className="text-xs" style={{ color: "var(--arbor-muted)" }}>{t("companion.capture.photoPreparing")}</p>}
            {photo ? (
              <div className="flex items-center gap-3">
                <img src={photo} alt={t("elev.capture.photo.alt")} className="h-24 w-24 flex-none rounded-xl object-cover" style={{ border: "1px solid var(--arbor-rule)" }} />
                <button
                  type="button"
                  onClick={() => { sessionRef.current.retire("photo"); setPhotoPreparing(false); attachPhoto(""); }}
                  data-testid="quicklog-photo-remove"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-bold"
                  style={{ border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-muted)" }}
                >
                  <Icon name="close" size={16} /> {t("elev.capture.photo.remove")}
                </button>
              </div>
            ) : (
              <div>
                <button type="button" onClick={() => photoInputRef.current?.click()} disabled={photoPreparing} className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-xs font-bold" style={{ color: "var(--arbor-ink)", background: "var(--arbor-paper-deep)", border: "1px dashed var(--arbor-rule-strong)" }}>
                  <Icon name="add_a_photo" size={18} style={{ color: "var(--arbor-green-ink)" }} /> {t("beh.addPhoto")}
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept={["image", "*"].join("/")}
                  className="hidden"
                  data-testid="quicklog-photo-input"
                  aria-label={t("beh.addPhoto")}
                  onChange={(e) => { void onPhotoPicked(e.target.files?.[0]); e.target.value = ""; }}
                />
              </div>
            )}
          </div>
        )}
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
        intensity={isIncidentType(newLogType) ? newLogIntensity : undefined}
        onIntensityChange={setNewLogIntensity}
        context={newLogContext}
        contextOptions={["", ...EXTRACT_CONTEXTS]}
        onContextChange={(c) => setNewLogContext(c as BehaviorContext | "")}
        durationMinutes={isIncidentType(newLogType) ? newLogDuration : undefined}
        onDurationChange={setNewLogDuration}
        photoSrc={photo}
        busy={saving}
        onEdit={() => setReviewing(false)}
        onDiscard={discard}
        onConfirm={confirm}
      /> : !hardMoment ? <form onSubmit={saveMoment} aria-busy={saving} className="space-y-4 text-sm" data-testid="quicklog-moment-form">
        {promptKey && (
          <p dir="auto" data-testid="quicklog-prompt-cue" className="rounded-xl px-3 py-2 text-[13px] font-semibold leading-snug" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}>
            {t(promptKey)}
          </p>
        )}

        <div className="space-y-1.5">
          <label htmlFor="quick-log-moment" className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{mode === "photo" || photo ? t("elev.capture.photo.label") : t("ql.moment.label")}</label>
          <input
            id="quick-log-moment"
            value={newLogTrigger}
            onChange={(e) => changeTrigger(e.target.value)}
            placeholder={t("ql.moment.ph")}
            autoFocus={mode !== "photo"}
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
        {optionalDetails}
        <button type="submit" disabled={saving || drafting || photoPreparing} className="min-h-11 w-full py-3 text-white font-extrabold text-xs rounded-xl transition active:scale-[0.98]" style={{ background: "var(--arbor-gradient-primary)" }}>
          {saving ? t("companion.family-topic-sheet.saving") : editLogId ? t("companion.capture.saveChanges") : t("ql.moment.save")}
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
          <select id="quick-log-type" value={newLogType} onChange={(e) => setNewLogType(e.target.value)} className="min-h-11 w-full rounded-xl p-2.5 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
            {BEHAVIOR_TYPES.map((b) => (
              isIncidentType(b.value) ? <option key={b.value} value={b.value}>{t(b.shortLabelKey)}</option> : null
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="quick-log-intensity" className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ql.intensity")} <span style={{ color: "var(--arbor-green-ink)" }}>{newLogIntensity} / 5</span></label>
          <input id="quick-log-intensity" type="range" min={1} max={5} value={newLogIntensity} onChange={(e) => setNewLogIntensity(parseInt(e.target.value))} className="min-h-11 w-full" style={{ accentColor: "var(--arbor-clay)" }} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="quick-log-trigger" className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ql.trigger")}</label>
          <input
            id="quick-log-trigger"
            value={newLogTrigger}
            onChange={(e) => changeTrigger(e.target.value)}
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
            className="min-h-11 w-full rounded-xl p-2.5 text-xs focus:outline-none"
            style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="quick-log-response" className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ql.response")}</label>
          <input id="quick-log-response" value={newLogResponse} onChange={(e) => setNewLogResponse(e.target.value)} placeholder={t("ql.responsePh")} className="min-h-11 w-full rounded-xl p-2.5 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
        </div>

        {optionalDetails}
        <button type="submit" disabled={drafting || saving || photoPreparing} className="min-h-11 w-full py-3 text-white font-extrabold text-xs rounded-xl transition active:scale-[0.98] disabled:opacity-60" style={{ background: "var(--arbor-gradient-primary)" }}>
          {drafting ? (
            <span className="inline-flex items-center gap-1.5"><Icon name="progress_activity" size={14} className="animate-spin" /> {t("beh.parsing")}</span>
          ) : (
            t("ql.save")
          )}
        </button>
      </form>}
      </>)}
      </fieldset>
    </Modal>
  );
}
