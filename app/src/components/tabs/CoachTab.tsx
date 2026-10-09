import React, { useRef, useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
// Directional glyphs are RTL-aware: the caller already picks the start/end
// variant by uiLang (he ⇒ left, otherwise right), so the Material Symbols
// <Icon> stays correct in both directions. All icons use the shared <Icon>
// (Material Symbols) for the UC-2 visual-match.
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { Avatar } from "../ui/Avatar";
import { ArborMascot } from "../ui/ArborMascot";
import { MarkdownBlock } from "../ui/MarkdownBlock";
import { TrustSafetyBar, cardCls } from "../ui/kit";
// Masterplan 1.3 — the Ask data-contract panel: TrustPanel (the one reusable
// trust pattern, previously mounted only on AvatarCreator) states EXACTLY what
// each coach request sends, and hosts the weekly-context consent toggle.
import { TrustPanel } from "../ui/TrustPanel";
import { coachContractText } from "../../lib/i18nElevation/coachcontract";
import { liveResidencyUntil } from "../../lib/liveResidency";
import { fmtDayLong } from "../../lib/formatDate";
import { buildVoiceContext, dismissWeeklyContextNotice, readWeeklyContextConsent, shouldShowWeeklyContextNotice, writeWeeklyContextConsent } from "../../ai/chatContext";
import { T } from "../../lib/tokens";
import CoachAnswerCards from "../coach/CoachAnswerCards";
import ToneSheet, { toneLabel } from "../coach/ToneSheet";
// ENG-21: the in-context value preview — the quiet, dismissible free-vs-Plus
// card shown BEFORE the coach meter's 402, never after it. Placement, timing
// and frequency are owned entirely by components/billing/valuePreviewModel.ts; this
// surface only reports whether it is calm enough to host it.
import ValuePreview from "../billing/ValuePreview";
import { ShareButton } from "../ui/ShareButton";
import { EvidenceChip } from "../ui/EvidenceChip";
import CompanionComposer from "../companion/CompanionComposer";
import type { ComposerAttachment } from "../../lib/companionAttachments";
import { api, streamVoice, getAiLanguage, ApiError, EscalationRequiredError, PaywallError } from "../../lib/api";
import { behaviorTypeLabel } from "../../content/behaviorTaxonomy";
import { recurringScenario } from "../../lib/patternEcho";
import { localDayKey } from "../../lib/firstsKeepsake";
import { handleVoiceDone } from "../../lib/voiceSafetyEvents";
import type { ChatMessage } from "../../context/ArborContext";
import { startDictation, speechSupported } from "../../lib/speech";
// AI-V2(a): the chip/orb tap contract (start / interrupt / stop) is a pure
// tested decision function — while Arbor speaks on the fallback loop a tap
// INTERRUPTS (voice stays on); a second tap during listening turns voice off.
import { voiceChipAction } from "../../lib/voiceChipAction";
import { createVoiceLifetime, type VoiceAttempt } from "../../lib/voiceLifetime";
// AI-V7: the calm bottom-sheet voice surface (orb + live captions), owned by
// voicePhase !== "off". The chip below stays the ONLY entry point.
import VoiceOverlay from "../coach/VoiceOverlay";
import MicrophoneNotice from "../ui/MicrophoneNotice";
import { microphoneRecovery } from "../../lib/microphoneRecovery";
import ConversationProposalTray from "../coach/ConversationProposalTray";
import CaptureProposalsTray from "../capture/CaptureProposalsTray";
// ENG-10 / ENG-11: the JITAI cue, rendered where the parent already is and
// instrumented — and in the evening it is the Bedtime Stories door.
import CompanionOfferSlot from "../overview/CompanionOfferSlot";
import TodayContinuation from "../overview/TodayContinuation";
import { chooseContinuation } from "../overview/continuation";
import { liveUnavailableReason, trackLiveUnavailable } from "../../lib/kpiEvents";
import { useCompanionOffer } from "../overview/useCompanionOffer";
// AI-06 / AI-24: one classifier from a thrown transport error (or from being
// offline) to the honest, ACTIONABLE thing to say — never a generic retry.
import { browserOnline, classifyAiFailure, type AiFailureCopy } from "../../lib/aiErrorCopy";
// GP-14: the disclosure names WHICH approved facts and WHICH profile fields
// travel with a question, not just how many.
import { coachDisclosure } from "../../lib/coachDisclosure";
import { attachProposalConflicts, noteKeepCommitted, normalizeConversationProposals, type ConversationProposal } from "../../lib/conversationProposals";
import { markPlanSeededFromAnswer } from "../../lib/captureProposals";
// AI-V3: recognition restart with backoff + circuit breaker lives in the pure
// dictation loop, so the phase label is always truthful (see lib/dictationLoop).
import { createDictationLoop, type DictationLoop } from "../../lib/dictationLoop";
import { splitCompleteSentences } from "../../lib/sentenceStream";
// ASK-7: thread-shape predicates — orientation/follow-up/trust guards key off
// real user/AI turns, never message-count checks (the welcome bubble is gone).
import { hasUserTurn, hasAiTurn } from "../../lib/chatStream";
// LL-A1: "Go deeper" — after a settled answer, up to 2 Learn Library reads
// matched on the contract's framework domains + concerns keyword-derived from
// the answer text, deep-linked via the requestLearnRead seam.
import { matchLearnCards } from "../../learn/learnLibrary";
import { LEARN_CARDS } from "../../learn/learnCards";
import { availableHardMomentCards, concernsForBehaviors } from "../../content/selectCards";
import { ageMonthsFromProfile, ageYearsFromProfile } from "../../lib/childAge";
import { locText } from "../../content/hardMomentSurface";
import { speak, stopSpeaking, ttsSupported } from "../../lib/tts";
import { voiceState } from "../../lib/voice";
// AI-V5: screened-sentence tokens + next-sentence audio prefetch keep the
// neural pipeline gapless without weakening the /api/tts trust boundary.
import { prefetchNaturalAudio, registerTtsToken } from "../../lib/naturalVoice";
// VC-8: pure shared module — lets a client-side (lexical) crisis stop render
// the SAME escalation resources the server paths carry, so a crisis stop is
// never resource-less on screen.
import { escalationMatchForCategory, renderEscalationMarkdown } from "../../safety/escalation";
import { usePrefersReducedMotion } from "../ui/playkit";

// GP-05 / AI-08: the graded Risk type and its two mapping helpers (level →
// grade, prose-regex → grade) are GONE — TrustSafetyBar is constant-posture now. The only
// thing the contract's riskLevel may drive is the PRESENCE of the escalate
// action (escalationSignal below), never a colour or a grade.

// Follow-ups: the STATIC FALLBACK trio, used only when the answer's contract
// carries no model-anticipated followUps (ASK-4). The visible label is
// translated (labelKey); the `prompt` sent to the model stays English on
// purpose (the model replies in aiLang) — the bubble shows the tapped label
// via displayText (ASK-5).
const FOLLOW_UPS: { labelKey: string; prompt: string }[] = [
  { labelKey: "coach.followup.avoid", prompt: "What should I avoid saying in that moment?" },
  { labelKey: "coach.followup.repair", prompt: "How do I repair the connection afterwards?" },
  { labelKey: "coach.followup.calm", prompt: "Give me a 1-minute calming routine to try." },
];

// IA-2: fast-start scenarios — the most common hard moments, one tap away.
// `labelKey` is translated UI chrome; `prompt` is an AI-input string kept English
// (the model localizes its reply via getAiLanguage()) — do not translate prompts.
const SCENARIOS: { icon: string; labelKey: string; prompt: string }[] = [
  { icon: "light_mode", labelKey: "coach.scenario.morning", prompt: "My child refuses to get dressed and leave the house in the morning. What may be happening and what do I do today?" },
  { icon: "devices", labelKey: "coach.scenario.ipad", prompt: "Turning off the iPad ends in a meltdown. Give me what may be happening, an exact script, and what to avoid." },
  { icon: "diversity_3", labelKey: "coach.scenario.sibling", prompt: "My children keep fighting over toys. Help me understand it and give me a calm script to use in the moment." },
  { icon: "bedtime", labelKey: "coach.scenario.bedtime", prompt: "Bedtime takes over an hour with lots of resistance. What's a calm wind-down plan and script?" },
  { icon: "school", labelKey: "coach.scenario.dropoff", prompt: "My child cries and clings at school dropoff. What may be happening and exactly what do I say?" },
];

// B-ASKJB-10: the recurring-moment chip. When the child's own log shows one
// behaviour type ECHO_MIN_COUNT times inside ECHO_WINDOW_DAYS (lib/patternEcho —
// the one recurrence rule), Ask's fast-start leads with "{type} again — what
// now?". Prompts are AI input, kept English like SCENARIOS; the label is keyed
// (elev.coach.echo.chip) with the localized type label. Unknown types fall back
// to the generic prompt with the localized label.
const ECHO_PROMPTS: Readonly<Record<string, string>> = {
  "Transition Refusal": "Leaving the house or switching activities keeps ending in refusal. What may be happening, and what do I do next time it starts?",
  "Sensory Overload": "Loud or crowded places keep overwhelming my child. What may be happening, and what do I do next time it starts?",
  "Screentime Dispute": "Ending screen time keeps turning into a fight. What may be happening, and what do I do next time it starts?",
  "Sibling Conflict": "My children keep clashing. What may be happening, and what do I do next time it starts?",
  "Food Refusal": "Meals keep ending in refusal. What may be happening, and what do I do next time it starts?",
  "Sleep Meltdown": "Bedtime keeps falling apart. What may be happening, and what do I do next time it starts?",
};
const ECHO_FALLBACK_PROMPT = "This keeps happening: {type}. What may be happening, and what do I do next time it starts?";

export default function CoachTab({ embedded = false, visible = true }: { embedded?: boolean; visible?: boolean }) {
  const {
    selectedLens,
    setSelectedLens,
    chatMessages,
    isChatLoading,
    chatStreamStatus,
    handleCancelChat,
    chatInput,
    setChatInput,
    handleChatSend: sendToCoach,
    handleCouncilSend: convenceCouncil,
    appendVoiceUserTurn,
    appendVoiceAiDelta,
    finalizeVoiceAiTurn,
    chatBottomRef,
    setActiveTab,
    setPlanChallengeTopic,
    setNewLogNotes,
    childProfile,
    activeFamilyTopic,
    conversations,
    activeConversationId,
    newConversation,
    openConversation,
    deleteConversation,
    apiError,
    apiErrorStatus,
    seedCoach,
    requestCapture,
    requestConsultPrefill,
    requestLearnRead,
    proposeMemory,
    memoryReviewError,
    approvedMemoryItems,
    milestones,
    behaviorLogs,
    conversationChanges,
    commitConversationProposal,
    openPaywall,
    activeTodayAction,
    acceptTodayAction,
    removeTodayAction,
    openHardMomentNow,
    openCaptureSheet,
    askHardMomentRef,
    setAskHardMomentRef,
  } = useArbor();
  // B-AI-06: Ask renders the SAME single-offer decision as Today.
  const askOffer = useCompanionOffer("coach");
  // B-ASKJB-06: the coordinator's winner → Today's continuation placement.
  const askContinuation = chooseContinuation({ offerKind: askOffer.offer?.kind });
  const askOfferSlot = (
    <CompanionOfferSlot
      surface="coach"
      offer={askOffer.offer}
      controls={askOffer}
      placement={askContinuation !== "none" ? "continuation" : "under-step"}
    />
  );
  const { toast } = useToast();
  const { aiLang, t, uiLang } = useLanguage();
  const { user } = useAuth();
  const childFirst = (childProfile.name || "").split(" ")[0];
  const reducedMotion = usePrefersReducedMotion();

  // Last thing the parent asked — used to power the error-state Retry button.
  const lastUserText = [...chatMessages].reverse().find((m) => m.sender === "user")?.text;

  // ASK-7: fresh-thread orientation and follow-up gating derive from real
  // turns. A legacy saved conversation that still opens with the old welcome
  // bubble counts as an AI turn only — orientation never doubles up.
  const userTurnExists = hasUserTurn(chatMessages);
  const aiTurnExists = hasAiTurn(chatMessages);

  // ASK-1: the post-hoc typewriter is GONE — /chat streams real screened
  // sentence deltas into the live bubble (chatLive), and settled answers
  // render instantly. Follow-up chips wait until no bubble is still live.
  const lastMessage = chatMessages[chatMessages.length - 1];
  // GP-05 / AI-08: the escalate action's PRESENCE keys on the contract's
  // internal signal (any non-low riskLevel). The value never renders and never
  // picks a colour — TrustSafetyBar is constant-posture.
  const escalationSignal =
    typeof lastMessage?.contract?.riskLevel === "string" && !/^low$/i.test(lastMessage.contract.riskLevel.trim());
  const showFollowUps =
    !isChatLoading && lastMessage?.sender === "ai" && !lastMessage.voiceLive && !lastMessage.chatLive && userTurnExists;

  // LL-A1: up to 2 "Go deeper" Learn Library reads for the settled answer —
  // ranked on the contract's framework domains + concerns keyword-derived from
  // the answer text, age-tiebroken. Same gate as the follow-up lane, so the
  // chips never render beside a still-streaming bubble.
  const goDeeperReads = useMemo(() => {
    if (!showFollowUps || !lastMessage?.text) return [];
    return matchLearnCards(
      LEARN_CARDS,
      {
        domains: lastMessage.contract?.domains,
        concerns: concernsForBehaviors([lastMessage.text]),
        ageYears: ageYearsFromProfile(childProfile),
      },
      2
    );
  }, [showFollowUps, lastMessage, childProfile]);

  // Masterplan 1.3 — "What the coach sees": collapsible data-contract panel in
  // the thread header + the per-child weekly-context consent toggle (DEFAULT
  // OFF; persisted at arbor.coach.weeklyContext.{childId} and read fresh by the
  // send path, so the flag itself is the single source of truth).
  const [contractOpen, setContractOpen] = useState(false);
  const [weeklyOn, setWeeklyOn] = useState(() => readWeeklyContextConsent(childProfile.id));
  useEffect(() => { setWeeklyOn(readWeeklyContextConsent(childProfile.id)); }, [childProfile.id]);
  // B-ASKJB-07 (Guy G1 = ON): the weekly counts + last outcome are on by
  // default; a one-line notice above the composer says so ONCE per child,
  // with "Change" opening the panel that holds the per-child off.
  const [weeklyNotice, setWeeklyNotice] = useState(() => shouldShowWeeklyContextNotice(childProfile.id));
  useEffect(() => { setWeeklyNotice(shouldShowWeeklyContextNotice(childProfile.id)); }, [childProfile.id]);
  const closeWeeklyNotice = () => { dismissWeeklyContextNotice(childProfile.id); setWeeklyNotice(false); };
  const contractToggleRef = useRef<HTMLButtonElement | null>(null);
  // B-ASKJB-31: the pilot guides this child can open right now (the chip's
  // gate) and the reference card the sheet handed to Ask, if still available.
  const hardMomentGuides = (() => {
    const now = new Date();
    return availableHardMomentCards({ now, ageMonths: ageMonthsFromProfile(childProfile, now), locale: uiLang === "he" ? "he" : "en" });
  })();
  const askRefCard = askHardMomentRef ? hardMomentGuides.find((card) => card.id === askHardMomentRef) ?? null : null;
  // Parent-register copy; module not yet in the i18nElevation index (owned by
  // a parallel stream) so it resolves through its own lookup, same semantics.
  const tcc = (key: string, params?: Record<string, string | number>) =>
    coachContractText(uiLang === "he" ? "he" : "en", key, params);
  // ASK-6 count, per answer: the most recent settled answer's server-backfilled
  // approved-memory fact count (an integer only — never fact content).
  const lastFactsUsed = useMemo(
    () =>
      [...chatMessages].reverse().find((m) => m.sender === "ai" && typeof m.contract?.approvedMemoryFactsUsed === "number")
        ?.contract?.approvedMemoryFactsUsed,
    [chatMessages],
  );

  // AI-24: being offline is a STATE of this surface, not a failure of Arbor.
  // The composer used to stay fully live with no connection, so the parent
  // typed a question, pressed send, and got the same "something went wrong"
  // card a server outage produces. Now the surface says so BEFORE the send,
  // and drafting stays possible (the words are not thrown away).
  const [online, setOnline] = useState(() => browserOnline());
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // AI-06: a typed transport failure raised on THIS surface (the voice stream
  // now preserves its status — see lib/api streamVoice). Held separately from
  // the context's `apiError` string, which carries no status at all.
  const [aiFailure, setAiFailure] = useState<AiFailureCopy | null>(null);
  useEffect(() => { if (!apiError) setAiFailure(null); }, [apiError]);

  // AI-24: ONE offline seam, wrapping the context's send. Every entry point on
  // this surface — the composer button, Enter, a follow-up chip, a fast-start
  // scenario, the council — goes through it, so an offline parent gets the
  // honest "no connection" card instead of watching a request die into the
  // generic "something went wrong". Typing is never blocked: the draft is the
  // parent's words and they survive the outage.
  //
  // Why a wrapper and not `disabled` on the send button: that button's opening
  // element is a FROZEN white-label contrast-debt fingerprint
  // (lib/whiteLabelContrast.test.ts, CR-01 ratchet — it hashes the whole
  // element, not just its fill). Editing it registers as new unresolved debt,
  // and that ratchet may only be retired by proving the fill. Wrapping the
  // handler covers strictly more entry points anyway.
  const handleChatSend = async (customPrompt?: string, opts?: { displayText?: string; attachments?: ComposerAttachment[] }) => {
    if (!online) {
      setAiFailure(classifyAiFailure(null, { online: false, childName: childFirst }));
      return;
    }
    setAiFailure(null);
    return sendToCoach(customPrompt, opts);
  };
  const handleCouncilSend = (customPrompt?: string) => {
    if (!online) {
      setAiFailure(classifyAiFailure(null, { online: false, childName: childFirst }));
      return;
    }
    setAiFailure(null);
    return convenceCouncil(customPrompt);
  };

  // The ONE thing the failure card should say. A 429 (wait, nothing is lost),
  // a 451 (your permission is needed, waiting will never help) and being
  // offline are three different problems with three different next steps —
  // they must never share one sentence, and none of them may render the
  // server's own English `details` string.
  const failureCopy: AiFailureCopy | null =
    aiFailure ?? (apiError && !isChatLoading
      // AI-06: classify on the STATUS the context preserved. Passing null
      // here collapsed a quota refusal and a consent refusal into one
      // sentence with a Retry button — a retry the parent owns the answer
      // to. The raw server message is still never rendered.
      ? classifyAiFailure(apiErrorStatus == null ? null : { status: apiErrorStatus },
          { online, childName: childFirst })
      : null);

  // F-08: text for the ALWAYS-mounted polite chat-status live region (twin:
  // VoiceOverlay's caption block — "always mounted so aria-live announces
  // reliably"). A conditionally-mounted aria-live node is frequently never
  // announced by screen readers, so the node below the thread stays in the
  // tree and only its TEXT cycles: empty → thinking/streaming → ready → empty.
  const [chatLiveStatus, setChatLiveStatus] = useState("");
  const wasChatLoadingRef = useRef(false);
  useEffect(() => {
    const wasLoading = wasChatLoadingRef.current;
    wasChatLoadingRef.current = isChatLoading;
    if (isChatLoading) {
      setChatLiveStatus(chatStreamStatus || t("coach.loading"));
      return;
    }
    if (!wasLoading) return;
    // Settled. Failures already announce through the error card's alert role
    // — a "ready" line on top would be a false announcement.
    if (apiError) {
      setChatLiveStatus("");
      return;
    }
    setChatLiveStatus(t("coach.status.ready"));
    const timer = window.setTimeout(() => setChatLiveStatus(""), 4000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChatLoading, chatStreamStatus, apiError]);

  // Arbor Vision (photo / document capture)

  // Which answer's overflow ("…") menu is open. Only Copy stays inline; Log /
  // Plan / Share fold into this menu so a settled answer reads as calm text.
  const [openMenuIdx, setOpenMenuIdx] = useState<number | null>(null);
  // B-ASKJB-12: the lens is chosen in ONE sheet ("How should Arbor talk with
  // you?"), opened from the "Tone: {choice}" control in the identity strip.
  // Same store (selectedLens / arbor.lens → scholarLens); seedCoach lens
  // steering is untouched.
  const [toneOpen, setToneOpen] = useState(false);
  const [showAllScenarios, setShowAllScenarios] = useState(false);
  // B-ASKJB-10: deterministic, zero model calls — the recurrence rule is patternEcho's.
  const echoScenario = useMemo(
    () => recurringScenario(behaviorLogs, localDayKey(), {
      prompts: ECHO_PROMPTS,
      typeLabel: (type) => behaviorTypeLabel(type, t),
      t,
      fallbackPrompt: ECHO_FALLBACK_PROMPT,
    }),
    [behaviorLogs, t],
  );
  const staticShown = echoScenario ? 2 : 3;
  /* R22 (Builder L) — the lens VALUE is a stored English identifier
     ("Integrated Balanced"), not display copy. One place resolved it
     (`coach.lens.integrated`) and the identity strip and the attribution chip
     printed the identifier verbatim, so #/coach kept two Latin lines under
     lang=he. One helper, every render site. Scholar names are proper nouns and
     pass through — they are the same word in both languages. */
  const lensDisplay = (name: string) => (name === "Integrated Balanced" ? t("coach.lens.integrated") : name);

  // Realtime voice coach: prefers Gemini Live (true bidirectional audio) when the
  // server reports it's available, and falls back to a hands-free browser loop —
  // listen (STT) → ask → speak (TTS) → listen again.
  // S5: "connecting" is a first-class phase — it paints SYNCHRONOUSLY on the
  // chip tap (before any await), so the token mint / SDK chunk fetch / mic
  // prompt / socket connect window is never a silent 10s+ hole.
  const [voicePhase, setVoicePhase] = useState<"off" | "connecting" | "listening" | "thinking" | "speaking">("off");
  const [liveAvail, setLiveAvail] = useState(false);
  // B-ASKJB-02: the Live residency exception's last day (null → undated line).
  const [liveUntil, setLiveUntil] = useState<Date | null>(null);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  // AI-V7: live caption of the PARENT'S OWN words while they speak (interim
  // browser-STT partials / Live input transcription — never model output).
  const [voiceInterim, setVoiceInterim] = useState("");
  // Render-tracked mirror of liveCtlRef: true while a Gemini Live session is
  // active (the overlay orb only offers tap-to-interrupt on the fallback loop;
  // Live barge-in is voice-driven via the server VAD).
  const [liveSession, setLiveSession] = useState(false);
  const liveCtlRef = useRef<null | { stop: () => void }>(null);
  const voiceOnRef = useRef(false);
  const voiceLifetimeRef = useRef(createVoiceLifetime());
  // Long-lived recognition callbacks need the settled thread from this render.
  const voiceMessagesRef = useRef(chatMessages);
  voiceMessagesRef.current = chatMessages;
  const dictationLoopRef = useRef<DictationLoop | null>(null);
  // Streaming-voice TTS queue (speak each sentence as it streams in).
  const ttsQueueRef = useRef<string[]>([]);
  const ttsSpeakingRef = useRef(false);
  const voiceBufRef = useRef("");
  const streamDoneRef = useRef(false);
  const voiceAbortRef = useRef<AbortController | null>(null);
  // Proposal drafts live at the voice interaction level and remain ephemeral
  // until the parent confirms one in the quiet review tray.
  const voiceSessionIdRef = useRef("voice-session-" + Date.now());
  const voiceTurnRef = useRef(0);
  const [conversationProposals, setConversationProposals] = useState<ConversationProposal[]>([]);
  const [proposalBusyId, setProposalBusyId] = useState<string | null>(null);

  const deriveConversationProposals = async (transcript: string, attempt: VoiceAttempt | null = voiceLifetimeRef.current.current) => {
    if (!attempt?.isCurrent()) return;
    const sessionId = voiceSessionIdRef.current;
    const turnId = "turn-" + (++voiceTurnRef.current) + "-" + Date.now();
    try {
      const result = await api.extractConversationProposals({
        transcript, childProfile, language: getAiLanguage(),
        milestones: milestones.map(({ id, title, checked, observationStatus }) => ({ id, title, checked, observationStatus })),
      });
      if (!attempt.isCurrent()) return;
      const normalized = normalizeConversationProposals(result.proposals, {
        sessionId, turnId, childId: childProfile.id, language: getAiLanguage(),
      });
      const checked = attachProposalConflicts(normalized, { behaviorLogs, milestones, committedChanges: conversationChanges });
      if (checked.length) setConversationProposals((current) => attempt.isCurrent() ? [...current, ...checked].slice(-8) : current);
    } catch (error) {
      if (!attempt.isCurrent()) return;
      // Escalation remains owned by the existing voice safety path. Extraction
      // failure is non-blocking: conversation continues and nothing is saved.
      if (!(error instanceof EscalationRequiredError)) console.warn("Harbor proposal extraction unavailable", error);
    }
  };

  // AI-V8: probe Gemini Live availability once, from the config-only GET —
  // zero ephemeral tokens are minted on mount; a fresh single-use token is
  // minted only inside toggleVoice when the parent actually starts talking.
  useEffect(() => {
    let cancelled = false;
    api.liveAvailability().then((r) => {
      if (cancelled || !r.available) return;
      setLiveAvail(true);
      setLiveUntil(liveResidencyUntil(r));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // AI-V5: while sentence N plays, start fetching sentence N+1's audio so the
  // inter-sentence gap is playback-bound, not network-bound. Neural engine
  // only — the browser floor needs no network. Idempotent per sentence.
  const prefetchUpNext = () => {
    const upNext = ttsQueueRef.current[0];
    if (upNext && voiceState().engine === "natural") prefetchNaturalAudio(upNext);
  };

  // Speak queued sentences one at a time; when drained after a turn, resume listening.
  const pumpTts = () => {
    const attempt = voiceLifetimeRef.current.current;
    if (!attempt?.isCurrent() || ttsSpeakingRef.current) return;
    const next = ttsQueueRef.current.shift();
    if (!next) {
      if (streamDoneRef.current) {
        streamDoneRef.current = false;
        // COACH-2: the spoken answer is fully delivered — settle the live
        // caption bubble into a normal persisted turn.
        finalizeVoiceAiTurn();
        if (voiceOnRef.current) startListening(); else setVoicePhase("off");
      }
      return;
    }
    ttsSpeakingRef.current = true;
    setVoicePhase("speaking");
    if (ttsSupported()) {
      prefetchUpNext();
      speak(next, () => { if (!attempt.isCurrent()) return; ttsSpeakingRef.current = false; pumpTts(); });
    } else {
      ttsSpeakingRef.current = false;
      pumpTts();
    }
  };
  const enqueueSpeak = (s: string) => {
    if (!s.trim()) return;
    ttsQueueRef.current.push(s.trim());
    // Queued behind a playing sentence → it is the (new) up-next: prefetch.
    if (ttsSpeakingRef.current) prefetchUpNext();
    pumpTts();
  };

  // A streaming voice turn: stream the answer token-by-token and speak each
  // sentence the moment it completes (real-time, not wait-then-speak).
  const streamVoiceTurn = async (text: string) => {
    const attempt = voiceLifetimeRef.current.current;
    if (!attempt?.isCurrent()) return;
    setVoicePhase("thinking");
    voiceBufRef.current = "";
    streamDoneRef.current = false;
    const controller = new AbortController();
    voiceAbortRef.current = controller;
    const ownsTurn = () => attempt.isCurrent() && !controller.signal.aborted && voiceAbortRef.current === controller;
    try {
      await streamVoice(
        {
          message: text,
          childProfile,
          ...(activeFamilyTopic ? { topicId: activeFamilyTopic.id } : {}),          scholarLens: selectedLens,
          language: getAiLanguage(),
          // AI-02: a spoken turn is the SAME conversation as a typed one — it
          // now carries this thread's settled turns, so a spoken follow-up
          // resolves against what the parent just heard instead of arriving
          // at a coach with no memory of the previous turn. The server also
          // grounds it in approved memory + source cards (routes/api /voice),
          // which is what the data-contract panel above the mic promises.
          ...buildVoiceContext(voiceMessagesRef.current, childProfile.id),
        },
        (delta) => {
          if (!ownsTurn()) return;
          // COACH-2: caption + persist the SAME screened text that is spoken —
          // the delta accumulates into a live AI bubble in the thread.
          appendVoiceAiDelta(delta);
          voiceBufRef.current += delta;
          // EVAL-2: the splitter is the shared pure lib function so the
          // cadence contract is pinned by evals/voice-loop-v1 (see
          // routes/voiceLoopEval.test.ts) — same semantics as before.
          const { complete, rest } = splitCompleteSentences(voiceBufRef.current);
          for (const sentence of complete) enqueueSpeak(sentence);
          voiceBufRef.current = rest;
        },
        {
          signal: controller.signal,
          // VC-4: the done payload is safety-load-bearing. On escalation:
          // stop the loop (voiceOnRef=false means the TTS drain in pumpTts
          // settles to "off" and NEVER calls startListening again) and put
          // the full crisis resources block ON SCREEN as part of the
          // persisted AI turn. On outputBlocked: render the visible blocked
          // state (parity with /chat's renderBlockedOutputMarkdown). The
          // appended markdown goes through appendVoiceAiDelta directly —
          // persisted + visible but never enqueued for speech.
          onEvent: (event, data) => {
            if (!ownsTurn()) return;
            if (event === "delta") {
              // AI-V5: deltas carry a short-TTL screened-sentence token —
              // register it so /api/tts can skip the model re-screen for
              // exactly this text (its lexical floor still always runs).
              const tts = (data as { tts?: { text?: unknown; token?: unknown } }).tts;
              if (tts && typeof tts.text === "string" && typeof tts.token === "string") {
                registerTtsToken(tts.text, tts.token);
              }
              return;
            }
            if (event !== "done") return;
            handleVoiceDone(data, {
              stopLoop: () => { voiceOnRef.current = false; },
              appendMarkdown: (md) => appendVoiceAiDelta(`\n\n${md}`),
            });
          },
        },
      );
      if (!ownsTurn()) return;
      if (voiceBufRef.current.trim()) enqueueSpeak(voiceBufRef.current);
      voiceBufRef.current = "";
      streamDoneRef.current = true;
      pumpTts();
    } catch {
      // COACH-2: keep the partial caption on abort/error — the parent keeps
      // whatever was already said instead of the turn vanishing.
      // AI-V2(a): an ABORT is always driven by bargeInVoice/stopVoice, which
      // already settled the caption + phase (barge-in is synchronously back
      // in "listening") — only a genuine stream failure recovers here.
      if (ownsTurn()) {
        finalizeVoiceAiTurn();
        if (voiceOnRef.current) startListening(); else setVoicePhase("off");
      }
    } finally {
      if (voiceAbortRef.current === controller) voiceAbortRef.current = null;
    }
  };

  const startListening = () => {
    const attempt = voiceLifetimeRef.current.current;
    if (!attempt?.isCurrent() || !voiceOnRef.current) return;
    if (!speechSupported()) { setVoiceNotice(microphoneRecovery("unsupported", uiLang)); voiceOnRef.current = false; setVoicePhase("off"); return; }
    setVoicePhase("listening");
    // AI-V3: the dictation loop owns recognition restarts — recoverable errors
    // ('no-speech', transient network) restart with backoff behind a max-retry
    // circuit breaker, silent ends auto-cycle the mic, and fatal errors stop
    // voice with a truthful phase + toast. The "listening" label is only ever
    // shown while the loop is actually cycling.
    dictationLoopRef.current?.stop();
    const loop = createDictationLoop({
      start: (handlers, lang) => startDictation(handlers, lang, { maxEmptyRestarts: 0 }),
      lang: aiLang === "he" ? "he-IL" : "en-US",
      isActive: () => attempt.isCurrent() && voiceOnRef.current,
      // AI-V7: surface interim partials as the overlay's live caption of the
      // parent's own words (<500ms after speech starts — straight from the
      // recognizer, no model round-trip).
      onInterim: (text) => { if (attempt.isCurrent()) setVoiceInterim(text); },
      onTranscript: (text) => {
        if (!attempt.isCurrent()) return;
        setVoiceInterim("");
        if (!text.trim()) { if (voiceOnRef.current) startListening(); return; }
        // COACH-2: persist the dictated turn through the existing
        // chat-message write seam before asking.
        appendVoiceUserTurn(text);
        void deriveConversationProposals(text, attempt);
        void streamVoiceTurn(text);
      },
      onFatal: (reason) => {
        if (!attempt.isCurrent()) return;
        stopVoice();
        setVoiceNotice(microphoneRecovery(reason, uiLang));
      },
    });
    dictationLoopRef.current = loop;
    loop.start();
  };

  // F-01: the ONE place every Live-terminal path clears the controller + its
  // render mirror — a stale liveCtlRef otherwise wedges the chip into a dead
  // button (voiceChipAction keeps returning "stop" for an idle-looking chip).
  const clearLiveRefs = () => {
    liveCtlRef.current = null;
    setLiveSession(false);
  };

  const stopVoice = () => {
    voiceLifetimeRef.current.cancel();
    setVoiceNotice(null);
    voiceOnRef.current = false;
    streamDoneRef.current = false;
    ttsQueueRef.current = [];
    ttsSpeakingRef.current = false;
    voiceAbortRef.current?.abort();
    dictationLoopRef.current?.stop();
    dictationLoopRef.current = null;
    stopSpeaking();
    clearLiveRefs();
    setVoiceInterim("");
    // COACH-2: settle (and keep) any partial caption when the parent stops.
    finalizeVoiceAiTurn();
    setVoicePhase("off");
  };

  // AI-V2(a): barge-in on the browser fallback loop — interrupt, don't kill.
  // Flush every queued sentence, cut the current utterance, abort a still-open
  // /voice stream, settle the partial caption (the parent keeps what was
  // already said), and go straight back to listening. Voice STAYS on; a
  // second tap during "listening" stops (voiceChipAction pins the contract).
  const bargeInVoice = () => {
    voiceLifetimeRef.current.begin();
    ttsQueueRef.current = [];
    ttsSpeakingRef.current = false;
    streamDoneRef.current = false;
    voiceAbortRef.current?.abort();
    stopSpeaking();
    finalizeVoiceAiTurn();
    setVoiceInterim("");
    // VC-4 invariant: every automatic re-listen is guarded by the hands-free
    // flag — a crisis-stopped loop (stopLoop set voiceOnRef=false) can never
    // be re-armed by a barge-in tap; that tap falls through to stopVoice.
    if (voiceOnRef.current) startListening();
  };

  const startBrowserVoice = () => {
    voiceLifetimeRef.current.begin();
    clearLiveRefs();
    voiceOnRef.current = true;
    startListening();
  };

  const toggleVoice = async () => {
    const action = voiceChipAction(voicePhase, Boolean(liveCtlRef.current));
    if (action === "interrupt" && voiceOnRef.current) { bargeInVoice(); return; }
    if (action !== "start") { stopVoice(); return; }
    if (voiceOnRef.current || liveCtlRef.current) stopVoice();
    setVoiceNotice(null);
    // Paint before the token/import/mic/socket awaits; X owns cancellation
    // throughout startup, including before a LiveController exists.
    setVoicePhase("connecting");
    const attempt = voiceLifetimeRef.current.begin();
    let liveClosed = false;
    // B-PROV-06: where the attempt failed (token mint vs socket start), so a
    // fallback counts as ONE live_unavailable event with a closed-enum reason.
    let liveStage: "mint" | "socket" = "mint";

    if (liveAvail) {
      try {
        const fresh = await api.liveToken({ ...(activeFamilyTopic ? { topicId: activeFamilyTopic.id } : {}), language: getAiLanguage(), childId: childProfile.id, childProfile, ...buildVoiceContext(voiceMessagesRef.current, childProfile.id) }, { signal: attempt.signal });
        if (!attempt.isCurrent()) return;
        if (!(fresh.available && fresh.token && fresh.model)) trackLiveUnavailable("token_error");
        if (fresh.available && fresh.token && fresh.model) {
          liveStage = "socket";
          const { startGeminiLive } = await import("../../lib/geminiLiveClient");
          if (!attempt.isCurrent()) return;
          const ctl = await startGeminiLive(
            {
              signal: attempt.signal,
              token: fresh.token,
              model: fresh.model,
              systemInstruction: fresh.systemInstruction || "",
              speechConfig: fresh.speechConfig,
            },
            {
              onPhase: (p) => {
                if (!attempt.isCurrent()) return;
                if (p === "closed") {
                  liveClosed = true;
                  clearLiveRefs();
                  setVoicePhase("off");
                  // Guard halt precedes its safety notification; do not retire
                  // that notification's owner here. Catch/terminal handlers
                  // decide the outcome, and liveClosed forbids late adoption.
                  return;
                }
                if (liveClosed) return;
                setVoicePhase(p);
              },
              onRemoteClose: () => {
                if (!attempt.isCurrent()) return;
                attempt.end();
                clearLiveRefs();
                voiceOnRef.current = false;
                setVoiceInterim("");
                finalizeVoiceAiTurn();
                setVoicePhase("off");
                setVoiceNotice(microphoneRecovery("connection", uiLang));
              },
              onError: () => {
                if (!attempt.isCurrent()) return;
                attempt.end();
                clearLiveRefs();
                setVoiceNotice(t("coach.toast.voiceFallback"));
                startBrowserVoice();
              },
              screenTurn: async (role, text) => {
                if (!attempt.isCurrent() || liveClosed) throw new DOMException("Stale voice turn", "AbortError");
                const verdict = await api.liveTurn({ role, text, language: getAiLanguage(), childId: childProfile.id });
                if (!attempt.isCurrent() || liveClosed) throw new DOMException("Stale voice verdict", "AbortError");
                return verdict;
              },
              onUserTurn: (text) => {
                if (!attempt.isCurrent() || liveClosed) return;
                setVoiceInterim("");
                appendVoiceUserTurn(text);
                void deriveConversationProposals(text, attempt);
              },
              onUserInterim: (delta) => {
                if (!attempt.isCurrent() || liveClosed) return;
                setVoiceInterim((prev) => attempt.isCurrent() && !liveClosed ? (prev + delta).trimStart() : prev);
              },
              onModelTurn: (text) => {
                if (!attempt.isCurrent() || liveClosed) return;
                appendVoiceAiDelta(text);
                finalizeVoiceAiTurn();
              },
              onCrisis: (v) => {
                if (!attempt.isCurrent()) return;
                attempt.end();
                clearLiveRefs();
                voiceOnRef.current = false;
                // Preserve VC-8 resources for client-side lexical crisis hits.
                appendVoiceAiDelta(
                  v.resourcesMarkdown ?? renderEscalationMarkdown(escalationMatchForCategory(v.category)),
                );
                finalizeVoiceAiTurn();
                if (v.spokenText) speak(v.spokenText);
                setVoicePhase("off");
              },
              onBlocked: (v) => {
                if (!attempt.isCurrent()) return;
                attempt.end();
                clearLiveRefs();
                voiceOnRef.current = false;
                if (v.blockedMarkdown) appendVoiceAiDelta(v.blockedMarkdown);
                finalizeVoiceAiTurn();
                if (v.spokenText) speak(v.spokenText);
                setVoicePhase("off");
              },
              onFailClosed: () => {
                if (!attempt.isCurrent()) return;
                attempt.end();
                clearLiveRefs();
                setVoiceNotice(t("coach.toast.voiceStandardMode"));
                startBrowserVoice();
              },
            },
          );
          if (liveClosed) { ctl.stop(); attempt.end(); return; }
          // adopt closes only this returned controller if the attempt lost.
          if (!attempt.adopt(ctl)) return;
          liveCtlRef.current = ctl;
          setLiveSession(true);
          setVoiceInterim("");
          setVoicePhase("listening");
          return;
        }
      } catch (err) {
        if (!attempt.isCurrent()) return;
        clearLiveRefs();
        if (err instanceof PaywallError) {
          attempt.end();
          setVoicePhase("off");
          openPaywall(err.feature || "coach_unlimited", err.plan);
          return;
        }
        // AI-06: a quota (429) or consent (451) refusal is NOT a transport
        // hiccup — the browser-voice fallback calls the same server and gets
        // the same refusal, so "falling back" was a silent dead end. Now the
        // status survives (lib/api streamVoice) and the parent is told which
        // of the two happened, and what to do about it.
        if (err instanceof ApiError && (err.status === 429 || err.status === 451)) {
          attempt.end();
          setVoicePhase("off");
          setAiFailure(classifyAiFailure(err, { online, childName: childFirst, retryAfterSeconds: err.retryAfterSeconds }));
          return;
        }
        if (err instanceof Error && ["NotAllowedError", "SecurityError", "NotFoundError", "NotReadableError"].includes(err.name)) {
          attempt.end();
          setVoicePhase("off");
          setVoiceNotice(microphoneRecovery(err.name, uiLang));
          return;
        }
        console.warn("Live voice start failed — falling back to browser voice", err);
        // B-PROV-06: the balance alarm — a depleted prepay shows up as
        // "closed before open"; count it (closed enum, no text) before falling back.
        const unavailable = liveUnavailableReason(err, liveStage);
        if (unavailable) trackLiveUnavailable(unavailable);
        setVoiceNotice(t("coach.toast.voiceFallback"));
      }
    }
    if (!attempt.isCurrent()) return;
    startBrowserVoice();
  };

  // Invalidate before any teardown can synchronously report closed/error.
  // No state writes on unmount; late grants/verdicts cannot adopt or render.
  useEffect(() => () => {
    voiceLifetimeRef.current.cancel();
    voiceOnRef.current = false;
    dictationLoopRef.current?.stop();
    dictationLoopRef.current = null;
    stopSpeaking();
    voiceAbortRef.current?.abort();
    voiceAbortRef.current = null;
    liveCtlRef.current = null;
  }, []);

  const voiceConversationRef = useRef(activeConversationId);
  useEffect(() => {
    const switched = voiceConversationRef.current !== null && voiceConversationRef.current !== activeConversationId;
    voiceConversationRef.current = activeConversationId;
    if (!visible || switched) stopVoice();
  }, [visible, activeConversationId]);

  const voiceLabel = voicePhase === "connecting" ? t("coach.voice.connecting") : voicePhase === "listening" ? t("coach.voice.listening") : voicePhase === "thinking" ? t("coach.voice.thinking") : voicePhase === "speaking" ? t("coach.voice.speaking") : liveAvail ? t("coach.voice.talkHd") : t("coach.voice.talk");
  // COACH-2: live caption text on the voicePhase chip while the answer streams
  // in / is spoken (the same screened text that fills the thread bubble).
  const liveVoiceText =
    (voicePhase === "thinking" || voicePhase === "speaking") && lastMessage?.sender === "ai" && lastMessage.voiceLive
      ? lastMessage.text
      : "";

  // ASK-2: the docked state — the SAME single composer element renders in the
  // hero position on a fresh thread and docks sticky at the viewport bottom
  // once the thread has a user turn, so a follow-up never needs scroll-hunting.
  // COACH-4 single-input invariant holds: this JSX renders in exactly ONE of
  // the two positions, so there is always exactly one textarea in the DOM,
  // and the voice/photo capture chips travel with it.
  const composerDocked = embedded || userTurnExists;
  // Fresh state has no transcript messages, status, or failure card. Keep the
  // coach header and footer reachable without reserving a blank message canvas.
  const hasThreadContent = chatMessages.length > 0 || isChatLoading || !!failureCopy;
  // R24: the contract stamp lives on THIS element, not on the docked wrapper.
  // B-ASKJB-06: only `data-primary-move` now — the composer sits INSIDE
  // coach-orientation, so a `data-module` here was a fourth module stamp
  // (budget 3 = orientation · history · thread; validator ruling).
  // They were on the `composerDocked &&` branch only, so on a fresh thread —
  // the state a parent actually lands in — #/coach rendered no
  // primary-move stamp at all and the declared move was unmeasurable
  // exactly when it mattered. composerSection is the ONE composer (COACH-4
  // single-input invariant, ASK-2 two positions), so stamping it puts exactly
  // one stamp in the DOM in either state, with one occurrence in source.
  // AI-23: count-aware context stays reachable before the first question.
  const memoryLine = approvedMemoryItems.length === 0
    ? t("elev.aihonesty.memory.none", { name: childFirst })
    : approvedMemoryItems.length === 1
      ? t("elev.aihonesty.memory.one", { name: childFirst })
      : t("elev.aihonesty.memory.some", { name: childFirst, n: approvedMemoryItems.length });
  // Critic r1 (W2-ASKJB coach, P1 G1): the memory caption and the weekly
  // notice said contradictory things on adjacent lines. ONE data-use line now:
  // when the weekly notice shows, the memory clause rides inside it.
  const weeklyNoticeShown = weeklyNotice && weeklyOn;
  const composerSection = (
        <section
          data-primary-move="ask"
          className={composerDocked ? "py-2.5" : "pt-3 pb-4 sm:pt-4 sm:pb-5"}
          aria-label={t("elev.hero.ask.cta")}
        >
          {!composerDocked && !weeklyNoticeShown && (
            <p data-testid="coach-data-use" className="mb-2 text-[12px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
              {memoryLine}
            </p>
          )}
          {/* B-ASKJB-31: the guide the parent opened in the sheet, shown as a
              reference card above the composer. Display only — nothing from it
              is written into the prompt (clinical veto). */}
          {askRefCard && (
            <div
              data-testid="coach-hard-moment-ref"
              role="note"
              className="mb-2 flex items-start gap-2 rounded-xl ps-3 pe-1 py-1"
              style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
            >
              <div className="min-w-0 flex-1 py-1.5">
                <p className="text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>{t("hm.ref.eyebrow")}</p>
                <p className="text-[13px] font-extrabold break-words" style={{ color: "var(--arbor-ink)" }}>{locText(askRefCard.title, uiLang === "he" ? "he" : "en")}</p>
                <p className="mt-0.5 text-[11px] leading-snug" style={{ color: "var(--arbor-muted)" }}>{t("hm.ref.note")}</p>
              </div>
              <button
                type="button"
                onClick={() => openHardMomentNow(askRefCard.id)}
                className="inline-flex min-h-11 items-center px-2 text-[12px] font-bold underline underline-offset-2 rounded-lg focus:outline-none focus-visible:ring-2"
                style={{ color: "var(--arbor-green-ink)" }}
              >
                {t("hm.ref.open")}
              </button>
              <button
                type="button"
                onClick={() => setAskHardMomentRef(null)}
                aria-label={t("hm.ref.dismiss")}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2"
                style={{ color: "var(--arbor-muted)" }}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
          <CompanionComposer key={childProfile.id} childId={childProfile.id} conversationId={activeConversationId} language={uiLang === "he" ? "he" : "en"}
            value={chatInput} onChange={setChatInput} busy={isChatLoading} visible={visible}
            onSend={handleChatSend} onVoice={() => void toggleVoice()} voiceActive={voicePhase !== "off"} voiceLabel={voiceLabel}
            onKeep={(text, photo) => openCaptureSheet({ mode: "text", initialText: text, initialPhoto: photo })} />
          {!online && <p data-testid="coach-offline-note" role="status" className="text-xs py-2" style={{ color: "var(--arbor-muted)" }}>{t("elev.aierrors.offline.composer")}</p>}
          {/* Critic r2 (coach design P1): the one-time data-use notice reads
              AFTER the field and the capture chips, as a quiet --t-xs line with
              no fill — the composer is the only raised object here. */}
          {weeklyNoticeShown && (
            <div
              data-testid="coach-weekly-notice"
              role="note"
              className="mt-2 flex flex-wrap items-center gap-x-2"
            >
              <p data-testid="coach-data-use" className="flex-1 min-w-0 py-2 t-xs leading-snug" style={{ color: "var(--arbor-muted)" }}>
                {tcc("elev.coachcontract.notice.body")}{!composerDocked && <> {memoryLine}</>}
              </p>
              <button
                type="button"
                data-testid="coach-weekly-notice-change"
                onClick={() => {
                  closeWeeklyNotice();
                  setContractOpen(true);
                  requestAnimationFrame(() => contractToggleRef.current?.scrollIntoView({ block: "center", behavior: reducedMotion ? "auto" : "smooth" }));
                }}
                className="inline-flex min-h-11 items-center px-2 t-xs font-bold underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded-lg"
                style={{ color: "var(--arbor-green-ink)" }}
              >
                {tcc("elev.coachcontract.notice.change")}
              </button>
              <button
                type="button"
                data-testid="coach-weekly-notice-dismiss"
                onClick={closeWeeklyNotice}
                className="inline-flex min-h-11 items-center px-2 t-xs font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded-lg"
                style={{ color: "var(--arbor-muted)" }}
              >
                {tcc("elev.coachcontract.notice.dismiss")}
              </button>
            </div>
          )}
          {voiceNotice && voicePhase === "off" && <MicrophoneNotice message={voiceNotice} lang={uiLang} onRetry={() => void toggleVoice()} onDismiss={() => setVoiceNotice(null)} />}
        </section>
  );

  return (
    <motion.div initial={reducedMotion ? false : { opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`mx-auto w-full min-w-0 max-w-[1040px] space-y-6${embedded ? " companion-coach" : ""}`}>
      {/* Item 11 (IA-02): the surface contract reaches the DOM. `data-module`
          marks a top-level sibling module (what moduleBudget counts);
          `data-primary-move` marks the ONE control that performs the move
          surfaceContract.ts declares for this route. */}
      {/* One coaching workspace: orientation, conversation, composer. */}
      <div data-module="coach-orientation" className="space-y-4">
        {embedded && !userTurnExists && <div className="companion-welcome"><h3>{uiLang === "he" ? "בואו נבין את זה יחד." : "Let’s make sense of it, together."}</h3><p>{uiLang === "he" ? "רגע קטן, שאלה גדולה, תמונה מהיום. התחילו איפה שנוח לכם — ונמצא יחד את הצעד הבא." : "A little moment, a big question, a photo from today. Start wherever feels natural, and we’ll find a next step together."}</p></div>}
        <header className="border-b pb-5" style={{ borderColor: "var(--arbor-rule)" }}>
          <div className="max-w-2xl">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--arbor-green-ink)" }}>{t("elev.hero.ask.eyebrow")}</p>
            <h1 className="mt-1.5 text-[28px] font-extrabold leading-[1.08] sm:text-[34px]" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>{t("elev.hero.ask.title")}</h1>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("coach.subtitle")}</p>
          </div>
        </header>

        {/* Composer-first: the parent's question is the primary job on this page.
            COACH-4: this hero composer is the ONE input on the surface — the
            mirrored in-thread composer was removed; follow-up turns also send
            from here. ASK-2: once the thread has a user turn the SAME element
            docks sticky at the bottom of the page instead (see below). */}
        {!composerDocked && composerSection}

        {/* B-ASKJB-06 + critic r1 — the thread's first state is the
            continuation, UNDER the composer (header < composer < continuation).
            The coordinator (lib/companionOffer, surface "coach") only hands Ask
            the continuation kinds (COACH_OFFER_KINDS: a carry-over ask or
            tomorrow's reason); chooseContinuation maps them into Today's own
            TodayContinuation slot — never a second pinned card. Reminders,
            bedtime doors and capture nudges stay on Today. Nothing renders
            when the coordinator stays quiet. */}
        {!userTurnExists && askContinuation !== "none" && (
          <TodayContinuation choice={askContinuation} isReturning>{askOfferSlot}</TodayContinuation>
        )}

        {/* Fast-start scenarios (IA-2) + the "Hard moment now" chip — ONE row under
            the composer, inside orientation (B-ASKJB-06). */}
        {!userTurnExists && (
          <div className="space-y-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-muted)" }}>{t("coach.fastStart")}</span>
            <div id="coach-scenarios" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {/* B-ASKJB-31: ONE "Hard moment now" chip opens the shared sheet
                  (replaces the dead publishedHardMomentCards group). Hidden when
                  no pilot guide is available for this child (age, expiry). */}
              {hardMomentGuides.length > 0 && (
                <button
                  key="hard-moment-now"
                  type="button"
                  data-testid="coach-hard-moment-now"
                  onClick={() => openHardMomentNow()}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 min-h-11 text-start text-[13px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={{ color: T.ink, border: "1px solid var(--arbor-rule-strong)", background: "var(--arbor-paper-elevated)" }}
                >
                  <Icon name="support" size={16} style={{ color: "var(--arbor-ink-soft)" }} /> {t("hm.now.title")}
                </button>
              )}
              {/* B-ASKJB-10: the child's own recurring moment leads, then 2 static chips. */}
              {echoScenario && (
                <button
                  key="echo"
                  data-testid="coach-scenario-echo"
                  onClick={() => handleChatSend(echoScenario.prompt, { displayText: echoScenario.label })}
                  disabled={isChatLoading}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 min-h-11 text-start text-[13px] font-bold transition disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={{ color: T.ink, border: "1px solid var(--arbor-rule)", background: "var(--arbor-paper-elevated)" }}
                >
                  <Icon name="replay" size={16} style={{ color: "var(--arbor-green-ink)" }} /> <span dir="auto">{echoScenario.label}</span>
                </button>
              )}
              {(showAllScenarios ? SCENARIOS : SCENARIOS.slice(0, staticShown)).map((s) => (
                <button
                  key={s.labelKey}
                  // ASK-5: the parent's bubble shows the localized label they
                  // actually tapped; the canonical EN prompt goes to the model.
                  onClick={() => handleChatSend(s.prompt, { displayText: t(s.labelKey) })}
                  disabled={isChatLoading}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 min-h-11 text-start text-[13px] font-bold transition disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={{ color: T.ink, border: "1px solid var(--arbor-rule)", background: "var(--arbor-paper-elevated)" }}
                >
                  <Icon name={s.icon} size={16} style={{ color: "var(--arbor-green-ink)" }} /> {t(s.labelKey)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowAllScenarios((shown) => !shown)}
                aria-expanded={showAllScenarios}
                aria-controls="coach-scenarios"
                className="inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-[12px] font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                style={{ color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule)" }}
              >
                {showAllScenarios
                  ? t("elev.wave2Daily.ask.examples.less")
                  : t("elev.wave2Daily.ask.examples.more", { count: SCENARIOS.length - staticShown })}
              </button>
            </div>
          </div>
        )}
        {/* E8: the research-anchored trust chip, inside orientation. B-ASKJB-12
            moved the lens choice out of this row into the ToneSheet ("Tone:
            {choice}" in the identity strip), so no unstamped sibling remains. */}
        <div className="flex items-center gap-2 flex-wrap">
          <EvidenceChip />
        </div>
      </div>

      {/* Conversation history stays available without reserving an empty tray. */}
      <section data-module="coach-history" className="flex flex-wrap items-center gap-2 border-y py-2.5" style={{ borderColor: "var(--arbor-rule)" }} aria-label={t("elev.wave2Daily.ask.history")}>
        <span className="me-auto text-[12px] font-bold" style={{ color: "var(--arbor-muted)" }}>{t("elev.wave2Daily.ask.history")}</span>
        <button
          onClick={newConversation}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[12px] font-extrabold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          style={{ color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule)" }}
        >
          <Icon name="add" size={14} /> {t("coach.new")}
        </button>
        {conversations.length > 0 ? (
          <div className="flex w-full gap-2 overflow-x-auto pb-1 no-scrollbar">
            {conversations.map((c) => {
              const on = c.id === activeConversationId;
              return (
                <div key={c.id} className="flex flex-shrink-0 items-center gap-1.5 rounded-full ps-3 pe-1.5 py-1" style={on ? { background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.30)" } : { background: T.paperElevated, border: "1px solid var(--arbor-rule)" }}>
                  <button onClick={() => openConversation(c.id)} className="flex min-h-11 max-w-[160px] items-center gap-1.5 truncate text-[12px] font-bold" style={{ color: on ? "var(--arbor-green-ink)" : "var(--arbor-muted)" }}>
                    <Icon name="chat" size={12} className="flex-shrink-0" /> <span className="truncate">{c.title}</span>
                  </button>
                  <button onClick={() => deleteConversation(c.id)} aria-label={t("aria.deleteConversation")} className="touch-target transition" style={{ color: "var(--arbor-muted)" }}><Icon name="delete" size={12} /></button>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      {/* Chat thread — COACH-4: no fixed-height inner scroll; the thread flows
          with the page (ArborContext auto-scrolls the viewport to the streaming
          answer via chatBottomRef). The min-height keeps the conversation canvas
          from shrinking below the previous min(70dvh,560px) viewport. */}
      <div data-module="coach-thread" className={`${cardCls} flex min-w-0 flex-col overflow-hidden`}>
        {/* Persistent named-coach identity strip. The lens/context frame is kept but
            visually subordinate so the conversation is the hero. Green primary —
            never the design's sapphire — per the parent color lock. */}
        <div className="px-4 py-2.5 flex items-center gap-3" style={{ background: "var(--arbor-paper-deep)", borderBottom: "1px solid var(--arbor-rule)" }}>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold leading-tight" style={{ color: "var(--arbor-ink)" }}>{t("coach.coachName")}</p>
            {/* AI-13 (honest AI, Law 4): no presence dot, no "always here" —
                a software guide, not a person on shift. */}
            <p className="text-[12px] font-bold leading-tight" style={{ color: "var(--arbor-muted)" }}>
              {t("elev.aihonesty.coachStatus")}
            </p>
          </div>
          {isChatLoading && <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: "var(--arbor-clay)" }} aria-hidden />}
          {/* B-ASKJB-12: "Tone: {choice}" opens the ONE ToneSheet. */}
          <button
            type="button"
            data-testid="coach-tone"
            onClick={() => setToneOpen(true)}
            aria-haspopup="dialog"
            aria-label={t("coach.tone.change")}
            className="flex-shrink-0 inline-flex min-h-11 items-center gap-1 rounded-lg px-1.5 text-[12px] font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{ color: "var(--arbor-muted)" }}
          >
            <Icon name="tune" size={13} />
            <span className="truncate max-w-[160px]">{t("coach.tone.label")}: <span style={{ color: "var(--arbor-green-ink)" }}>{toneLabel(selectedLens, t)}</span></span>
          </button>
          <ToneSheet open={toneOpen} onClose={() => setToneOpen(false)} selectedLens={selectedLens} onSelect={setSelectedLens} t={t} />
          {/* Masterplan 1.3: "What the coach sees" disclosure — opens the data
              contract panel below this strip. Parent register only. */}
          <button
            type="button"
            ref={contractToggleRef}
            onClick={() => setContractOpen((v) => !v)}
            aria-expanded={contractOpen}
            aria-label={tcc("elev.coachcontract.title")}
            data-testid="coach-contract-toggle"
            className="flex-shrink-0 inline-flex min-h-11 min-w-11 items-center justify-center gap-1 text-[11px] font-bold px-2 rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{ color: contractOpen ? "var(--arbor-green-ink)" : "var(--arbor-muted)" }}
          >
            <Icon name="shield" size={13} />
            <span className="hidden sm:inline">{tcc("elev.coachcontract.title")}</span>
            <Icon name={contractOpen ? "expand_less" : "expand_more"} size={13} />
          </button>
        </div>

        {/* Masterplan 1.3 — the collapsible data-contract panel. Copy states
            exactly what each request sends: message · profile · approved
            memory (count) · this thread's recent turns · and, only while the
            toggle is on, this week's counts. The toggle LIVES here (TrustPanel
            footer slot); its state is the per-child localStorage consent flag
            the send path reads. */}
        {contractOpen && (
          <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--arbor-rule)" }} data-testid="coach-contract-panel">
            <TrustPanel
              uses={[
                tcc("elev.coachcontract.uses.message"),
                // GP-14: the profile line and the memory line now NAME what
                // travels — which allow-listed fields, and the parent's own
                // approved facts verbatim — instead of reporting a bare count
                // the parent cannot check, correct or withdraw.
                ...coachDisclosure(
                  {
                    profile: childProfile,
                    approvedFacts: approvedMemoryItems.map((m) => ({ memoryId: m.memoryId, fact: m.fact })),
                    factsUsedInLastAnswer: lastFactsUsed,
                    childFirstName: childFirst || childProfile.name,
                  },
                  t,
                ).uses,
                tcc("elev.coachcontract.uses.turns"),
                ...(weeklyOn ? [tcc("elev.coachcontract.uses.weekly")] : []),
                // AI-02 / B-ASKJB-01: the panel sits directly above the
                // microphone, so it describes a SPOKEN turn too. Both spoken
                // paths are grounded from server/spokenContext.ts: profile,
                // approved memory facts and this conversation's recent turns
                // (never the weekly counts). Live HD pins the same context into
                // its token with names stripped, so its line says "without
                // names" and renders only when Live is the path a tap takes.
                tcc("elev.coachcontract.uses.spoken"),
                // B-ASKJB-02: whenever Live is the path, its line names the
                // global endpoint and the exception's end date.
                ...(liveAvail ? [tcc("elev.coachcontract.uses.spokenLive", {
                  residency: liveUntil
                    ? tcc("elev.coachcontract.uses.liveResidency", { date: fmtDayLong(liveUntil, uiLang === "he" ? "he" : "en") })
                    : tcc("elev.coachcontract.uses.liveResidencyUndated"),
                })] : []),
              ]}
              stores={[
                // Reused dead key — still accurate: durable facts wait for
                // explicit parent approval before becoming memory.
                t("coach.contract.memoryBody"),
                tcc("elev.coachcontract.stores.thread"),
              ]}
              controls={[
                tcc("elev.coachcontract.controls.memory"),
                tcc("elev.coachcontract.controls.weekly"),
              ]}
              footer={
                <div className="pt-2 space-y-1.5" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={weeklyOn}
                    data-testid="coach-weekly-context-toggle"
                    onClick={() => {
                      const next = !weeklyOn;
                      setWeeklyOn(next);
                      writeWeeklyContextConsent(childProfile.id, next);
                    }}
                    className="flex items-center gap-2.5 min-h-[44px] w-full text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded-lg"
                  >
                    <span
                      aria-hidden
                      className="relative inline-flex flex-shrink-0 rounded-full transition-colors"
                      style={{ width: 34, height: 20, background: weeklyOn ? "var(--arbor-green-ink)" : "var(--arbor-rule-strong)" }}
                    >
                      <span
                        className="absolute top-[2px] rounded-full transition-all"
                        style={{ width: 16, height: 16, background: "var(--arbor-on-accent)", insetInlineStart: weeklyOn ? 16 : 2 }}
                      />
                    </span>
                    <span className="text-[12px] font-bold" style={{ color: "var(--arbor-ink)" }}>
                      {tcc("elev.coachcontract.toggle")}
                    </span>
                  </button>
                  <p className="text-[11px] leading-snug" style={{ color: "var(--arbor-muted)" }}>
                    {tcc("elev.coachcontract.toggleHint")}
                  </p>
                </div>
              }
            />
          </div>
        )}

        <div className={hasThreadContent ? "flex-1 p-4 md:p-6" : "p-0"}>
         <div className="max-w-[760px] mx-auto space-y-3.5">
          {/* Empty state — orient a first-run parent on what Ask Arbor does.
              COACH-4: the title line lives ONCE, on the hero composer above;
              the thread empty state keeps only the mascot + body copy.
              ASK-7: this is THE single orientation block (with the scenarios)
              — it hides the moment any real turn exists, including a legacy
              conversation that still opens with the old welcome bubble. */}
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 group ${msg.sender === "user" ? "ms-auto max-w-[85%] flex-row-reverse" : "me-auto w-full"}`}>
              {msg.sender === "user" ? (
                <Avatar name={user?.displayName} photoURL={user?.photoURL} size={32} />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: "var(--arbor-green-soft)" }} title="Arbor">
                  <ArborMascot size={30} />
                </div>
              )}
              {/* Asymmetric "tail" via logical radii so it flips correctly in RTL:
                  the speaker-side bottom corner is tightened to 6px. Coach bubbles
                  carry a soft shadow to lift the conversation off the canvas. */}
              <div dir="auto" className="p-4 rounded-[18px] text-sm font-medium leading-[1.55]"
                style={msg.sender === "user"
                  ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule)", borderEndEndRadius: 6 }
                  : { background: T.paperElevated, color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)", borderEndStartRadius: 6, boxShadow: "var(--shadow-sm)" }}>
                {msg.sender === "ai" && !msg.contract && msg.lens && msg.lens !== "Integrated Balanced" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mb-3 inline-block" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
                    {t("coach.alignedWith", { lens: lensDisplay(msg.lens) })}
                  </span>
                )}
                {msg.sender === "ai" ? (
                  msg.contract ? (
                    <>
                    {/* ASK-1: the streamed prose lead stays visible after the
                        cards settle — the words the parent watched arrive
                        never vanish at done. */}
                    <CoachAnswerCards
                      contract={msg.contract}
                      renderKeepAction={idx === chatMessages.length - 1 && !isChatLoading && !msg.chatLive && !msg.voiceLive ? (field, text) => <CaptureProposalsTray surface="coach" inline={{ field, text }} /> : undefined}
                      lens={msg.lens}
                      council={msg.council}
                      lang={uiLang}
                      // B-ASKJB-04: "I'll try it" under step 1 enters the action
                      // loop (source "coach"); one step per day (B-AI-05 supersede).
                      todayStep={activeTodayAction}
                      onTryIt={(step) => acceptTodayAction(step, "standard", "coach")}
                      onUndoTryIt={(id) => removeTodayAction(id)}
                      // ASK-6: memory footer deep link — Profile › Child Memory.
                      onManageMemory={() => setActiveTab("memory")}
                      // OWN-1: no review invite while the ledger is unreadable.
                      reviewUnavailable={memoryReviewError}
                      onSaveToPlan={(topic) => {
                        setPlanChallengeTopic((topic || msg.text).replace(/[#*]/g, "").slice(0, 140));
                        // N1-01-R3: step one of a two-step conversion. This ARMS
                        // the latch; ArborContext's actionPlans write consumes it.
                        // Emitting here would measure intent, not a plan.
                        markPlanSeededFromAnswer("coach");
                        setActiveTab("plans");
                        toast(t("coach.toast.planSeeded"), "info");
                      }}
                      // B-ASKJB-05: "Go deeper" (inside More, only while no
                      // council exists) convenes the council on this question.
                      onGoDeeper={() => handleCouncilSend()}
                      // AI-05: the teacher note is CONSUMED, not dropped. The
                      // card handed a real note string and this callback threw
                      // it away, so "Teacher note" was a bare tab switch into an
                      // empty Consult composer — the same defect AIX-S3(a) fixed
                      // for ArborVision's handoff. Same seam, same contract.
                      // B-CAREPRO-13: the note is FOR a teacher, so the
                      // audience lands on "teacher" (not the stored default).
                      onAddToHandoff={(note) => {
                        requestConsultPrefill({ note, audience: "teacher" });
                        setActiveTab("consult");
                        toast(t("coach.toast.teacherNoteCopied"), "info");
                      }}
                    />
                    </>
                  ) : (
                    // ASK-1: no fake typewriter — a live bubble (voice caption
                    // or ask stream) grows with its real deltas; settled text
                    // renders complete immediately.
                    <MarkdownBlock text={msg.text} />
                  )
                ) : (
                  // ASK-5: user bubbles show what the parent SAW (the tapped
                  // localized chip label) — msg.text stays the canonical
                  // prompt that went to the model.
                  <>
                    {msg.attachments?.map(file => <div key={file.id} className="companion-file-receipt"><Icon name={file.kind === "photo" ? "photo" : "description"} size={20}/><span>{file.name}<small className="block">{uiLang === "he" ? "נותח בשיחה זו · המקור לא נשמר" : "Attached to this turn · original not saved"}</small></span></div>)}
                    <MarkdownBlock text={msg.displayText || msg.text} />
                  </>
                )}

                {msg.sender === "ai" && !msg.contract && !msg.voiceLive && !msg.chatLive && (
                  // Calm: answers read as text. Copy stays inline; everything else
                  // folds into a single "…" overflow so it's not a toolbar.
                  // Touch: always visible. Desktop: calm hover reveal. Keyboard: focus reveals.
                  <div className="relative flex items-center gap-3 mt-3 pt-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
                    <button
                      onClick={async () => { await navigator.clipboard?.writeText(msg.text); toast(t("coach.copied"), "success"); }}
                      aria-label={t("coach.action.copy")}
                      className="text-[10px] font-bold flex items-center gap-1 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded" style={{ color: "var(--arbor-muted)" }}
                    >
                      <Icon name="content_copy" size={12} /> {t("coach.action.copy")}
                    </button>
                    <button
                      onClick={() => setOpenMenuIdx(openMenuIdx === idx ? null : idx)}
                      aria-label={t("coach.more")}
                      aria-haspopup="menu"
                      aria-expanded={openMenuIdx === idx}
                      className="text-[10px] font-bold flex items-center gap-1 min-h-[44px] px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded" style={{ color: "var(--arbor-muted)" }}
                    >
                      <Icon name="more_horiz" size={16} />
                    </button>
                    {openMenuIdx === idx && (
                      <>
                        {/* Backdrop closes the menu on any outside tap. */}
                        <button type="button" aria-hidden className="fixed inset-0 z-10 cursor-default" onClick={() => setOpenMenuIdx(null)} tabIndex={-1} />
                        <div role="menu" className="absolute z-20 top-full mt-1 start-8 rounded-xl p-1 min-w-[180px]" style={{ background: T.paperElevated, border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-sm)" }}>
                          <button
                            role="menuitem"
                            onClick={() => {
                              setNewLogNotes(msg.text.replace(/[#*]/g, "").trim().slice(0, 400));
                              // AI-05: the overflow "Log" wrote model-authored
                              // prose into the draft and then did a BARE tab
                              // switch — bypassing the ai-draft gate the
                              // answer-card path goes through (AI-CAP-4). The
                              // gate is fail-closed by design: it arms the
                              // review flag, stamps 'ai-draft' provenance and
                              // opens the form into view. An AI-authored draft
                              // must never reach the log store un-reviewed, so
                              // this entry point routes through the SAME seam.
                              openCaptureSheet({ review: "ai-draft" });
                              setOpenMenuIdx(null);
                              toast(t("coach.toast.logPrefilled"), "info");
                            }}
                            className="w-full text-start text-xs font-bold flex items-center gap-2 px-2.5 py-2 min-h-[40px] rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1" style={{ color: "var(--arbor-ink)" }}
                          >
                            <Icon name="assignment" size={14} style={{ color: "var(--arbor-muted)" }} /> {t("coach.action.log")}
                          </button>
                          <button
                            role="menuitem"
                            onClick={() => {
                              setPlanChallengeTopic(msg.text.replace(/[#*]/g, "").slice(0, 140));
                              setActiveTab("plans");
                              setOpenMenuIdx(null);
                              toast(t("coach.toast.planSeeded"), "info");
                            }}
                            className="w-full text-start text-xs font-bold flex items-center gap-2 px-2.5 py-2 min-h-[40px] rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1" style={{ color: "var(--arbor-ink)" }}
                          >
                            <Icon name="playlist_add" size={14} style={{ color: "var(--arbor-muted)" }} /> {t("coach.action.plan")}
                          </button>
                          {/* mk-p0-3: 1-tap branded share of a settled answer — this
                              menu only exists on settled bubbles (live ones hide the
                              whole actions row). */}
                          <div className="px-1 py-0.5" onClick={() => setOpenMenuIdx(null)}>
                              <ShareButton
                                artifact="answer_card"
                                surface="ask"
                                childName={childFirst}
                                getCardOpts={() => {
                                  const prior = chatMessages[idx - 1];
                                  const question = prior?.sender === "user" ? prior.text : "";
                                  return {
                                    question: question.replace(/[#*]/g, "").trim().slice(0, 160),
                                    takeaway: msg.text.replace(/[#*]/g, "").trim().slice(0, 220),
                                    imageUrl: childProfile.photoUrl,
                                    name: childFirst,
                                  };
                                }}
                                label={t("share.cta.answer")}
                                variant="ghost"
                              />
                            </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {showFollowUps && (() => {
            // ASK-4: the answer's own anticipated followUps lead (localized by
            // the model via the languageDirective, zod-capped to 3, and
            // screened — they are appended to renderCoachResponse so
            // screenModelOutput covered every string shown here). The static
            // trio is only the fallback when the contract carries none.
            const anticipated = lastMessage?.contract?.followUps?.filter((q) => q.trim()) ?? [];
            const chips = anticipated.length > 0
              ? anticipated.map((q) => ({ key: q, label: q, prompt: q }))
              : FOLLOW_UPS.map((q) => ({ key: q.labelKey, label: t(q.labelKey), prompt: q.prompt }));
            return (
            <div className="flex flex-wrap gap-[9px] me-auto max-w-[85%] ps-11">
              {chips.map((q) => (
                <button
                  key={q.key}
                  dir="auto"
                  onClick={() => handleChatSend(q.prompt, { displayText: q.label })}
                  className="text-[13px] px-4 py-1.5 min-h-[44px] rounded-full transition flex items-center gap-1.5 font-extrabold bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-green-ink)" }}
                >
                  {q.label}
                  {uiLang === "he"
                    ? <Icon name="arrow_back" size={12} />
                    : <Icon name="arrow_forward" size={12} />}
                </button>
              ))}
              {/* LL-A1: "Go deeper" reads — lavender (the Learn accent, per the
                  milestone chip) so a read is visually distinct from a follow-up
                  question; tap deep-links into the Learn Library reader. */}
              {goDeeperReads.length > 0 && (
                <>
                  <span className="text-[11px] font-bold self-center" style={{ color: "var(--arbor-muted)" }}>{t("learn.goDeeper")}</span>
                  {goDeeperReads.map((card) => {
                    const title = aiLang === "he" ? card.title.he : card.title.en;
                    return (
                      <button
                        key={card.id}
                        aria-label={title}
                        onClick={() => requestLearnRead({ cardId: card.id, source: "coach-answer" })}
                        className="text-[12px] px-4 py-1.5 min-h-[38px] rounded-full transition active:scale-[0.98] flex items-center gap-1.5 font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                        style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}
                      >
                        <Icon name="local_library" size={14} /> <span dir="auto">{title}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
            );
          })()}

          {/* B-ASKJB-03 (AI-04): "Keep this" lives under the answer it keeps
              from. The typed-turn tray builds from the coach's chatMessages
              with zero model calls; it used to mount only on Journal, so a
              parent who asked here saw no Keep. Hidden while a new turn
              streams (it would offer the previous answer's lines). Kept rows
              land in the Journal feed. */}


          {/* F-08: the chat-status live region — ALWAYS mounted (twin:
              VoiceOverlay's captions, "always mounted so aria-live announces
              reliably"); only its text changes. The visible spinner row below
              mirrors the same status aria-hidden, so it is spoken exactly
              once, from here. */}
          <span className="sr-only" role="status" aria-live="polite">
            {chatLiveStatus}
          </span>

          {isChatLoading && (
            <div className="flex gap-3 max-w-[85%] me-auto">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold animate-spin" style={{ background: "var(--arbor-peach-soft)", color: "var(--arbor-peach)" }} aria-hidden>
                <Icon name="sync" size={16} />
              </div>
              <div className="p-4 rounded-2xl text-xs flex items-center gap-3" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
                {/* aria-hidden, NOT aria-live: the always-mounted region above
                    owns the announcement (the Stop button beside it stays in
                    the accessibility tree — hiding a focusable control would
                    orphan keyboard/AT users). */}
                <span className="animate-pulse" aria-hidden>{chatStreamStatus || t("coach.loading")}</span>
                <button
                  type="button"
                  onClick={handleCancelChat}
                  className="px-2 py-1 rounded-lg font-bold flex items-center gap-1"
                  style={{ background: T.paperElevated, border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}
                >
                  <Icon name="close" size={12} /> {t("coach.stop")}
                </button>
              </div>
            </div>
          )}

          {/* AI-06 / AI-24 — the failure card. It used to say ONE sentence
              (t("coach.error") + Retry) for every failure, so "the account has
              used its hour of AI" and "you have not given permission for a
              photo of your child" were indistinguishable, and Retry was
              offered on the one of them retrying can never fix. The copy and
              the affordance now come from the classifier
              (lib/aiErrorCopy) — and Retry appears ONLY when re-sending the
              same request could actually succeed. */}
          {failureCopy && !isChatLoading && (
            <div
              role="alert"
              data-testid="coach-failure-card"
              data-failure-kind={failureCopy.kind}
              className="flex items-start gap-3 rounded-2xl p-4 me-auto max-w-[85%]"
              style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}
            >
              <Icon name={failureCopy.kind === "offline" ? "cloud_off" : failureCopy.kind === "consent" ? "lock" : "warning"} size={16} className="flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-xs leading-relaxed font-extrabold" dir="auto">{t(failureCopy.titleKey)}</p>
                <p className="text-xs leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink)" }}>
                  {t(failureCopy.bodyKey, failureCopy.bodyParams)}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {failureCopy.retryable && lastUserText && ![...chatMessages].reverse().find(m => m.sender === "user")?.attachments?.length && (
                    <button
                      type="button"
                      onClick={() => handleChatSend(lastUserText)}
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl text-xs font-extrabold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                      style={{ background: T.paperElevated, border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
                    >
                      <Icon name="sync" size={14} /> {t("elev.aierrors.retry")}
                    </button>
                  )}
                  {failureCopy.actionKey && failureCopy.actionRoute && (
                    <button
                      type="button"
                      onClick={() => setActiveTab(failureCopy.actionRoute!)}
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl text-xs font-extrabold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                      style={{ background: T.paperElevated, border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
                    >
                      <Icon name="shield" size={14} /> {t(failureCopy.actionKey)}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ASK-2: scroll-margin keeps the auto-scrolled thread end clear of
              the docked sticky composer below. */}
          <div ref={chatBottomRef} style={{ scrollMarginBottom: 132 }} />
         </div>
        </div>

        {/* COACH-4: the mirrored bottom composer (input+send+photo/mic row) was
            deleted — the hero composer above is the one input. What remains under
            the thread is a compact secondary row: Council (multi-lens send of the
            current question) + the Ask-a-Specialist warm handoff (ia-b6,
            navigation only — stays enabled while an answer is streaming). */}
        <div className="px-4 pb-2 empty:hidden">
          {/* ENG-21 — the value preview. B-ASKJB-06: it lives INSIDE the thread
              block (above its footer row), never as its own top-level module, so
              it can never sit above something a parent came here to use. It renders only on an EMPTY conversation (no turn at all, so
              this can never be a hard-moment or escalation thread), only while this
              surface is idle, and only for a server-VERIFIED free parent whose day's
              coach allowance is nearly spent — never at zero, where the paywall
              already owns the moment. Every other case returns null: see
              decideValuePreview's named reasons. */}
          <ValuePreview
            threadEmpty={chatMessages.length === 0}
            surfaceIdle={!isChatLoading && !failureCopy && voicePhase === "off" }
            online={online}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-2" style={{ borderTop: "1px solid var(--arbor-rule)", background: "var(--arbor-paper-deep)" }}>
          <button
            type="button"
            onClick={() => { setActiveTab("consult"); toast(t("coach.specialist.toast"), "info"); }}
            aria-label={t("coach.specialist.aria")}
            className="ms-auto inline-flex items-center gap-1.5 min-h-[44px] py-2 text-[11px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-lg"
            style={{ color: "var(--arbor-muted)" }}
          >
            <Icon name="stethoscope" size={14} style={{ color: "var(--arbor-green-ink)" }} />
            <span>{t("coach.specialist.lead")}</span>
            <span style={{ color: "var(--arbor-green-ink)" }}>{t("coach.specialist.cta")}</span>
            {uiLang === "he"
              ? <Icon name="chevron_left" size={14} style={{ color: "var(--arbor-green-ink)" }} />
              : <Icon name="chevron_right" size={14} style={{ color: "var(--arbor-green-ink)" }} />}
          </button>
        </div>
      </div>

      {/* Trust & Safety — constant posture (GP-05/AI-08): the bar never grades
          or colours the child; the escalate action is gated on the contract's
          internal signal only (TS-1/TS-3). */}
      {lastMessage?.sender === "ai" && userTurnExists && (
        <TrustSafetyBar
          note={t("coach.trust.note")}
          lang={uiLang}
          onEscalate={escalationSignal ? () => setActiveTab("consult") : undefined}
        />
      )}

      {/* ASK-2: the docked composer — the SAME single element from the hero
          position, now sticky at the viewport bottom so the follow-up loop
          never requires scrolling back up. MOB-14: the offset is the
          OverviewTab formula — --mobile-nav-h + the iOS safe-area inset + 8px —
          so the send button never sits under a Face-ID tab bar; from lg the
          sidebar layout has no bottom bar. */}
      {composerDocked && (
        <div
          data-testid="coach-docked-composer"
          className="sticky bottom-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom)+8px)] lg:bottom-0 z-30"
          style={{ background: "var(--arbor-paper)", borderTop: "1px solid var(--arbor-rule)", boxShadow: "0 -6px 16px rgba(41,51,63,0.05)" }}
        >
          {composerSection}
        </div>
      )}

      {/* The parent-approved memory moderation queue was removed from Ask Arbor to
          keep the chat calm. Its full capability (pending review + approve/reject/
          forget of approved facts) lives in its real home: Profile › Child Memory
          (route "memory" → src/components/sections/ChildMemory.tsx), which renders
          the same pending/approved lists via the same handleMemoryDecision. */}

      <ConversationProposalTray
        proposals={conversationProposals}
        language={uiLang}
        busyId={proposalBusyId}
        onEdit={(id, summary) => setConversationProposals((items) => items.map((item) => item.id === id ? { ...item, summary } : item))}
        onDiscard={(id) => setConversationProposals((items) => items.filter((item) => item.id !== id))}
        onConfirm={async (proposal) => {
          setProposalBusyId(proposal.id);
          try {
            // N1-01-R2: the voice tray's commit is a real keep_this seam. The
            // record's own status + commitRef decide whether it counts, so a
            // throw above this line emits nothing (critic C8).
            const record = await commitConversationProposal(proposal);
            noteKeepCommitted(record, "coach-voice");
            setConversationProposals((items) => items.filter((item) => item.id !== proposal.id));
            // B-ASKJB-03: ONE toast per Keep. The tray raises "Kept" + Undo
            // once the audit row lands; this success toast doubled it. Only a
            // milestone confirmation (which the tray deliberately gives no
            // Undo, and so no toast) still confirms here.
            if (proposal.target === "milestone") toast(t("coach.voice.proposalSaved"), "success");
          } catch {
            toast(t("coach.voice.proposalSaveError"), "error");
          } finally { setProposalBusyId(null); }
        }}
      />

      {/* AI-V7: the voice surface — orb + live captions in a calm bottom
          sheet, owned entirely by voicePhase (unmounts when voice is off).
          Captions carry only the parent's own words (voiceInterim) and the
          already-screened spoken answer (liveVoiceText). Tap-orb = barge-in
          on the fallback loop (AI-V2(a)); X = end voice. */}
      {voicePhase !== "off" && (
        <VoiceOverlay
          phase={voicePhase}
          notice={voiceNotice}
          lang={uiLang}
          interimText={voiceInterim}
          answerText={liveVoiceText}
          canInterrupt={voicePhase === "speaking" && !liveSession}
          reducedMotion={reducedMotion}
          onOrbTap={() => { if (voicePhase === "speaking" && !liveCtlRef.current && voiceOnRef.current) bargeInVoice(); }}
          onClose={stopVoice}
        />
      )}


    </motion.div>
  );
}
