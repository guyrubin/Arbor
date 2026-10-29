import { translate as inputText } from "../../lib/i18n";
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
import { ArborMark } from "../ui/ArborMark";
import { MarkdownBlock } from "../ui/MarkdownBlock";
import { TrustSafetyBar, cardCls } from "../ui/kit";
// F-TALK-1: the data-use panel ("What the coach sees", TrustPanel + the
// weekly-context consent switch) lives in the "What Arbor remembers"
// destination now (components/coach/CoachDataContract, mounted on #/memory).
// The one-time weekly notice below still names what is sent, and its
// "Change" lands on that switch.
import { coachContractText } from "../../lib/i18nElevation/coachcontract";
import { fmtDay } from "../../lib/formatDate";
import { threadDayLabel, threadDayMarks } from "../../lib/threadDates";
import { goToRoute } from "../../hooks/useHashQuery";
import { WEEKLY_CONTEXT_CONSENT_EVENT, buildVoiceContext, dismissWeeklyContextNotice, readWeeklyContextConsent, shouldShowWeeklyContextNotice } from "../../ai/chatContext";
import { T } from "../../lib/tokens";
import CoachAnswerCards from "../coach/CoachAnswerCards";
import ToneSheet, { toneLabel } from "../coach/ToneSheet";
// ENG-21: the in-context value preview — the quiet, dismissible free-vs-Plus
// card shown BEFORE the coach meter's 402, never after it. Placement, timing
// and frequency are owned entirely by components/billing/valuePreviewModel.ts; this
// surface only reports whether it is calm enough to host it.
import ValuePreview from "../billing/ValuePreview";
import { ShareButton } from "../ui/ShareButton";
import CompanionComposer from "../companion/CompanionComposer";
import NoticeTalkReview, { type NoticeTalkController } from "../companion/NoticeTalkReview";
import { clearNoticeTalk, readNoticeTalk, useNoticeTalkRequest } from "../../lib/noticeHandoff";
import { NOTICE_HANDOFF_COPY } from "../companion/noticeHandoffCopy";
import { UrgentSupport } from "../safety/UrgentSupport";
import { screenForImmediateEscalation } from "../../safety/escalation";
import type { ComposerAttachment } from "../../lib/companionAttachments";
import { requestCompanionConsentReview } from "../../lib/companionConsent";
import { COMPANION_CONVERSATION_EVENT, consumeConversationPanelRequest, consumeConversationVoiceRequest, conversationVoiceRequestPending, type CompanionConversationRequest } from "../../lib/companionConversation";
import { api, streamVoice, getAiLanguage, ApiError, EscalationRequiredError, PaywallError, isLiveResting, VoiceNoticeRequiredError } from "../../lib/api";
import { acknowledgeVoiceNotice, liveNoticeIdFrom, runtimeVoiceNoticeId, voiceNoticeAcknowledged, voiceNoticeShortLine, voiceNoticeTap } from "../../lib/voiceProviderNotice";
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
import VoiceCloseCard from "../coach/VoiceCloseCard";
import { voiceNextStep } from "../../lib/voiceTranscript";
import CaptureProposalsTray from "../capture/CaptureProposalsTray";
import { liveUnavailableReason, trackLiveUnavailable } from "../../lib/kpiEvents";
// AI-06 / AI-24: one classifier from a thrown transport error (or from being
// offline) to the honest, ACTIONABLE thing to say — never a generic retry.
import { browserOnline, classifyAiFailure, type AiFailureCopy } from "../../lib/aiErrorCopy";
import { attachProposalConflicts, noteKeepCommitted, normalizeConversationProposals, type ConversationProposal } from "../../lib/conversationProposals";
import { markPlanSeededFromAnswer } from "../../lib/captureProposals";
// AI-V3: recognition restart with backoff + circuit breaker lives in the pure
// dictation loop, so the phase label is always truthful (see lib/dictationLoop).
import { createDictationLoop, type DictationLoop } from "../../lib/dictationLoop";
import { splitCompleteSentences } from "../../lib/sentenceStream";
// ASK-7: thread-shape predicates — orientation/follow-up/trust guards key off
// real user/AI turns, never message-count checks (the welcome bubble is gone).
import { hasUserTurn, hasAiTurn, askedWithTopic } from "../../lib/chatStream";
// LL-A1: "Go deeper" — after a settled answer, up to 2 Learn Library reads
// matched on the contract's framework domains + concerns keyword-derived from
// the answer text, deep-linked via the requestLearnRead seam. F-TALK-2: they
// sit inside the answer's actions, never in the Talk thread.
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
// via displayText (ASK-5). F-TALK-2 (mock L415): the mock's three intents,
// gender-neutral; the label names the child through {name}.
const FOLLOW_UPS: { labelKey: string; prompt: string }[] = [
  { labelKey: "companion.followup.example", prompt: "Give me a concrete example of that." },
  { labelKey: "companion.followup.refuses", prompt: "And if my child refuses?" },
  { labelKey: "companion.followup.adapt", prompt: "Adapt this to our day." },
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

/** B-AIOPS-02: release a microphone the Live session never took over. */
const releaseTracks = (stream: MediaStream | null) => {
  for (const track of stream?.getTracks() ?? []) {
    try { track.stop(); } catch { /* release the rest */ }
  }
};

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
    conversationRevision,
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
  // F-TALK-1: the coordinator's continuation offer (carry-over ask, tomorrow's
  // reason) and the JITAI cue belong to Now (NowView's one slot), never to the
  // Talk panel: nothing sits between the panel header and the thread.
  const { toast } = useToast();
  const { aiLang, t, uiLang } = useLanguage();
  const noticeTalk = useNoticeTalkRequest();
  const noticeTalkController = useRef<NoticeTalkController | null>(null);
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
  // F-TALK-2 (mock L399): one date line per day of turns, from their stamps.
  const dayMarks = useMemo(() => threadDayMarks(chatMessages), [chatMessages]);
  const threadNow = new Date();

  // LL-A1: up to 2 "Go deeper" Learn Library reads for the settled answer —
  // ranked on the contract's framework domains + concerns keyword-derived from
  // the answer text, age-tiebroken. Same gate as the follow-up lane, so the
  // reads never sit beside a still-streaming bubble. F-TALK-2: they live in
  // the settled answer's own actions, so only a structured answer offers them.
  const goDeeperReads = useMemo(() => {
    if (!showFollowUps || !lastMessage?.text || !lastMessage.contract) return [];
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

  // Masterplan 1.3 — the per-child weekly-context consent flag (persisted at
  // arbor.coach.weeklyContext.{childId} and read fresh by the send path, so
  // the flag itself is the single source of truth). F-TALK-1: its switch and
  // the "What the coach sees" panel live on #/memory (CoachDataContract); here
  // the flag only decides whether the one-time notice shows.
  const [weeklyOn, setWeeklyOn] = useState(() => readWeeklyContextConsent(childProfile.id));
  // B-ASKJB-07 (Guy G1 = ON): the weekly counts + last outcome are on by
  // default; a one-line notice under the composer says so ONCE per child,
  // with "Change" landing on the switch that holds the per-child off.
  const [weeklyNotice, setWeeklyNotice] = useState(() => shouldShowWeeklyContextNotice(childProfile.id));
  // F-TALK-1 (review r1): the switch now lives on #/memory while this panel
  // stays mounted, so both flags are re-read whenever the panel shows again
  // and whenever the switch writes (WEEKLY_CONTEXT_CONSENT_EVENT). Keyed on
  // the child, so a switch flipped for one child never moves another child's
  // notice. The send path reads the flag fresh either way.
  useEffect(() => {
    const reread = () => {
      setWeeklyOn(readWeeklyContextConsent(childProfile.id));
      setWeeklyNotice(shouldShowWeeklyContextNotice(childProfile.id));
    };
    reread();
    if (typeof window === "undefined") return;
    const onConsent = (e: Event) => {
      const id = (e as CustomEvent<{ childId?: string }>).detail?.childId;
      if (!id || id === childProfile.id) reread();
    };
    window.addEventListener(WEEKLY_CONTEXT_CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(WEEKLY_CONTEXT_CONSENT_EVENT, onConsent);
  }, [childProfile.id, visible]);
  const closeWeeklyNotice = () => { dismissWeeklyContextNotice(childProfile.id); setWeeklyNotice(false); };
  // B-ASKJB-31: the pilot guides this child can open right now (the door's
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

  // AI-24: being offline is a STATE of this surface, not a failure of Arbor.
  // The composer used to stay fully live with no connection, so the parent
  // typed a question, pressed send, and got the same "something went wrong"
  // card a server outage produces. Now the surface says so BEFORE the send,
  // and drafting stays possible (the words are not thrown away).
  const [online, setOnline] = useState(() => browserOnline());
  // Files the persistent input is holding (CompanionComposer reports a count).
  const [composerFiles, setComposerFiles] = useState(0);
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
  // B-AIOPS-02: the family's daily voice time is spent (Live mint, renewal,
  // or a fallback-loop turn). A resting state with its own calm status line —
  // never the failure card, never the connection-ended notice.
  const [voiceResting, setVoiceResting] = useState(false);
  // B-AIOPS-02: a Live talk ended calmly because its next slice did not
  // arrive (the family still has time) — the review says so, never an error.
  const [voiceTalkEnded, setVoiceTalkEnded] = useState(false);

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
    // B-PROV-12: typing instead of tapping again declines the pending voice
    // notice (nothing was acknowledged); B-AIOPS-02: the resting line has
    // done its job once the parent carries on in text.
    setNoticePending(null);
    setVoiceResting(false);
    const pendingNotice = readNoticeTalk();
    const question = customPrompt ?? chatInput;
    // Immediate-help messages keep the governed existing route, without any
    // unreviewed source attached. A normal handoff requires the current review.
    if (pendingNotice && !screenForImmediateEscalation({ message: question })) {
      const prepared = noticeTalkController.current?.request === pendingNotice ? noticeTalkController.current.prepare(question) : null;
      if (!prepared) { toast(NOTICE_HANDOFF_COPY[uiLang === "he" ? "he" : "en"].reviewNeeded, "error"); return false; }
      const sent = await sendToCoach(prepared.message, { ...opts, isCurrent: prepared.isCurrent });
      if (sent) {
        setChatInput(current => current === chatInput ? "" : current);
        clearNoticeTalk(pendingNotice);
      }
      return sent;
    }
    return sendToCoach(customPrompt, opts);
  };
  const handleCouncilSend = (customPrompt?: string, opts?: { answerIndex?: number }) => {
    if (!online) {
      setAiFailure(classifyAiFailure(null, { online: false, childName: childFirst }));
      return;
    }
    setAiFailure(null);
    if (readNoticeTalk()) { toast(NOTICE_HANDOFF_COPY[uiLang === "he" ? "he" : "en"].reviewNeeded, "error"); return; }
    return convenceCouncil(customPrompt, opts);
  };

  // The ONE thing the failure card should say. A 429 (wait, nothing is lost),
  // a 451 (your permission is needed, waiting will never help) and being
  // offline are three different problems with three different next steps —
  // they must never share one sentence, and none of them may render the
  // server's own English `details` string.
  const fileConsentFailure = apiErrorStatus === 451 && !![...chatMessages].reverse().find(message => message.sender === "user")?.attachments?.length;
  const failureCopy: AiFailureCopy | null =
    aiFailure ?? (apiError && !isChatLoading
      // AI-06: classify on the STATUS the context preserved. Passing null
      // here collapsed a quota refusal and a consent refusal into one
      // sentence with a Retry button — a retry the parent owns the answer
      // to. The raw server message is still never rendered.
      ? classifyAiFailure(apiErrorStatus == null ? null : { status: apiErrorStatus },
          { online, childName: childFirst, ...(fileConsentFailure ? { consentPurpose: "companion_attachments" as const } : {}) })
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
  // you?"). F-TALK-1: it opens from the tone chip in the composer foot (label
  // = the current tone) and from the panel menu. Same store (selectedLens /
  // arbor.lens → scholarLens); seedCoach lens steering is untouched.
  const [toneOpen, setToneOpen] = useState(false);
  // F-TALK-1: the history list is hidden until the panel menu's "History"
  // asks for it; choosing a conversation (or closing) hides it again.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyAsk, setHistoryAsk] = useState(0);
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
  // EXTRA-TALK: the active family question leads the chip row as "Continue
  // with: <question>". It FILLS the composer and never sends: the parent reads,
  // edits and sends it themselves. The row seats 4 chips in the Talk panel and
  // 3 on the page; the question chip and the echo chip each take a seat and
  // the static scenarios fill the rest (F-TALK-1: no "more examples" toggle).
  const topicChip = activeFamilyTopic?.title.trim() ? activeFamilyTopic : null;
  const [topicChipBefore, topicChipAfter = ""] = inputText(uiLang, "companion.talk.topic-chip").split("{title}");
  const scenarioSeats = embedded ? 4 : 3;
  const staticShown = Math.max(0, scenarioSeats - (topicChip ? 1 : 0) - (echoScenario ? 1 : 0));
  const continueWithTopic = (from: HTMLElement, title: string) => {
    setChatInput((current) => current.trim() && current.trim() !== title ? `${current}\n\n${title}` : title);
    const scope: ParentNode = from.closest(".companion-coach") ?? document;
    requestAnimationFrame(() => {
      const field = scope.querySelector<HTMLTextAreaElement>('[data-testid="coach-composer-well"] textarea');
      if (!field || field.disabled) return;
      field.focus({ preventScroll: true });
      field.setSelectionRange(field.value.length, field.value.length);
    });
  };
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
  // B-VOICE-06: the Live probe has answered (either way), so a spoken
  // conversation asked for from elsewhere starts on the right path (HD or not).
  const [liveProbed, setLiveProbed] = useState(false);
  // B-VOICE-06: bumps when "Talk it through" is tapped while this panel is mounted.
  const [voiceAsk, setVoiceAsk] = useState(0);
  // FEAT-01: bumps when the conversation header's menu asks for history or tone.
  const [panelAsk, setPanelAsk] = useState(0);
  // B-VOICE-06: the one-line "tap Talk it through to start" after the door, until voice starts.
  const [voiceInvite, setVoiceInvite] = useState(false);
  useEffect(() => { if (voicePhase !== "off") setVoiceInvite(false); }, [voicePhase]);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  // B-PROV-12: the approved notice of the Live route the server selected
  // (null: no Live route, the device speech notice applies) and the notice
  // waiting for its one-tap acknowledgement in the B-VOICE-06 line slot.
  const [liveNoticeId, setLiveNoticeId] = useState<string | null>(null);
  const [noticePending, setNoticePending] = useState<string | null>(null);
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
  // B-VOICE-04: where this session's turns begin in the thread (the next-step
  // synthesis reads only what Arbor said in THIS session).
  const voiceStartIndexRef = useRef(0);
  const [nextStepKeptFor, setNextStepKeptFor] = useState<string | null>(null);
  const [nextStepBusy, setNextStepBusy] = useState(false);
  const [nextStepFailed, setNextStepFailed] = useState(false);
  const voiceTurnRef = useRef(0);
  const [conversationProposals, setConversationProposals] = useState<ConversationProposal[]>([]);
  const [proposalBusyId, setProposalBusyId] = useState<string | null>(null);
  const proposalCommitRef = useRef(false);
  const reviewAttemptRef = useRef<VoiceAttempt | null>(null);
  const [voiceReviewOpen, setVoiceReviewOpen] = useState(false);
  const [proposalPending, setProposalPending] = useState(0);
  const [proposalFailed, setProposalFailed] = useState(false);
  const clearVoiceReview = () => {
    reviewAttemptRef.current = null;
    voiceSessionIdRef.current = "discarded-" + Date.now();
    setConversationProposals([]);
    setProposalPending(0);
    setProposalFailed(false);
    setVoiceReviewOpen(false);
  };
  const discardVoiceReview = () => { if (!proposalCommitRef.current && !nextStepBusy) clearVoiceReview(); };
  // B-VOICE-04: next-action synthesis — deterministic, from what Arbor said in
  // this session (lib/voiceTranscript voiceNextStep); null → no step shown.
  const voiceNextText = voiceReviewOpen ? voiceNextStep(chatMessages, voiceStartIndexRef.current) : null;
  const keepVoiceNextStep = async () => {
    const step = voiceNextText;
    const sessionId = voiceSessionIdRef.current;
    if (!step || nextStepBusy) return;
    setNextStepBusy(true); setNextStepFailed(false);
    try {
      await acceptTodayAction(step, "standard", "coach");
      if (sessionId === voiceSessionIdRef.current) setNextStepKeptFor(sessionId);
    } catch {
      if (sessionId === voiceSessionIdRef.current) setNextStepFailed(true);
    } finally { setNextStepBusy(false); }
  };

  const deriveConversationProposals = async (transcript: string, attempt: VoiceAttempt | null = voiceLifetimeRef.current.current) => {
    if (!attempt?.isCurrent()) return;
    const sessionId = voiceSessionIdRef.current;
    const turnId = "turn-" + (++voiceTurnRef.current) + "-" + Date.now();
    // Only an explicit Stop carries an in-flight draft into review. A safety
    // halt, child/thread change, new session or discard never adopts it.
    const mayReview = () => sessionId === voiceSessionIdRef.current
      && (attempt.isCurrent() || reviewAttemptRef.current === attempt);
    setProposalPending(count => count + 1);
    try {
      const result = await api.extractConversationProposals({
        transcript, childProfile, language: getAiLanguage(),
        milestones: milestones.map(({ id, title, checked, observationStatus }) => ({ id, title, checked, observationStatus })),
      });
      if (!mayReview()) return;
      const normalized = normalizeConversationProposals(result.proposals, {
        sessionId, turnId, childId: childProfile.id, language: getAiLanguage(),
      });
      const checked = attachProposalConflicts(normalized, { behaviorLogs, milestones, committedChanges: conversationChanges });
      if (checked.length) setConversationProposals((current) => mayReview() ? [...current, ...checked].slice(-8) : current);
    } catch (error) {
      if (!mayReview()) return;
      setProposalFailed(true);
      // Escalation remains owned by the existing voice safety path. Extraction
      // failure is non-blocking: conversation continues and nothing is saved.
      if (!(error instanceof EscalationRequiredError)) console.warn("Harbor proposal extraction unavailable", error);
    } finally {
      if (sessionId === voiceSessionIdRef.current) setProposalPending(count => Math.max(0, count - 1));
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
      setLiveNoticeId(liveNoticeIdFrom(r));
    }).catch(() => {}).finally(() => { if (!cancelled) setLiveProbed(true); });
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
    } catch (err) {
      // B-AIOPS-02: the family's voice time for today is spent on the fallback
      // loop too. Same resting card as the Live mint: voice off, no re-listen
      // loop; the typed composer and the crisis door stay where they are.
      if (ownsTurn() && isLiveResting(err)) {
        stopVoice(false);
        setVoiceResting(true);
        return;
      }
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
        stopVoice(false);
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

  const stopVoice = (review = true) => {
    const reviewAttempt = voiceLifetimeRef.current.current;
    voiceLifetimeRef.current.cancel();
    // B-PROV-12: leaving (stop, a new thread, the panel hidden) cancels a
    // notice that was showing; nothing was acknowledged.
    setNoticePending(null);
    if (review && reviewAttempt && voicePhase !== "off") {
      reviewAttemptRef.current = reviewAttempt;
      setVoiceReviewOpen(true);
    }
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
    if (readNoticeTalk()) { toast(NOTICE_HANDOFF_COPY[uiLang === "he" ? "he" : "en"].voice, "error"); return; }
    if (voiceReviewOpen) return;
    // B-PROV-12: before any audio is processed, the approved notice of the
    // route this tap takes (Live when the server selected one, else device
    // speech) shows in the B-VOICE-06 line under the composer. The next tap on
    // this same button while it shows is the acknowledgement, remembered per
    // device and per notice id — a new provider, region or purpose asks again.
    const noticeId = runtimeVoiceNoticeId(liveAvail ? liveNoticeId : null);
    const tap = voiceNoticeTap(noticeId, noticePending, voiceNoticeAcknowledged(noticeId));
    if (tap === "show") { setVoiceNotice(null); setNoticePending(noticeId); return; }
    if (tap === "acknowledge_and_start") acknowledgeVoiceNotice(noticeId);
    setNoticePending(null);
    setVoiceResting(false);
    setVoiceTalkEnded(false);
    reviewAttemptRef.current = null;
    voiceSessionIdRef.current = "voice-session-" + Date.now() + "-" + (++voiceTurnRef.current);
    voiceStartIndexRef.current = voiceMessagesRef.current.length;
    setNextStepFailed(false);
    setConversationProposals([]);
    setProposalPending(0);
    setProposalFailed(false);
    if (voiceOnRef.current || liveCtlRef.current) stopVoice(false);
    setVoiceNotice(null);
    // Paint before the token/import/mic/socket awaits; X owns cancellation
    // throughout startup, including before a LiveController exists.
    setVoicePhase("connecting");
    const attempt = voiceLifetimeRef.current.begin();
    let liveClosed = false;
    // B-PROV-06: where the attempt failed (token mint vs socket start), so a
    // fallback counts as ONE live_unavailable event with a closed-enum reason.
    // B-AIOPS-02: "mic" = the microphone is requested BEFORE any mint, so a
    // refusal there never spends the family's voice time (and is no
    // availability signal either).
    let liveStage: "mint" | "socket" | "mic" = "mic";
    // B-AIOPS-03: the minted session's telemetry id, so a start that never
    // reaches audio is reported to the server's incident sink (event only).
    let liveUsageId: string | undefined;
    // B-AIOPS-02: the microphone opened for this attempt, until the Live
    // session takes it over (released on every path that does not).
    let micStream: MediaStream | null = null;
    const releaseMic = () => { releaseTracks(micStream); micStream = null; };
    // The ONE mint: the first slice and every renewal carry the same pinned
    // context — the conversation as it stood when this talk began (the Live
    // client seeds each new socket with the talk itself) — and the same
    // acknowledged notice. A renewal names the slice it renews (`renewOf`).
    const talkContext = buildVoiceContext(voiceMessagesRef.current, childProfile.id);
    const mintLive = (renewOf?: string) => api.liveToken({ ...(activeFamilyTopic ? { topicId: activeFamilyTopic.id } : {}), language: getAiLanguage(), childId: childProfile.id, childProfile, ...talkContext, noticeAck: noticeId, ...(renewOf ? { renewOf } : {}) }, { signal: attempt.signal });
    type MintedLive = Awaited<ReturnType<typeof mintLive>>;
    const usageFor = (minted: MintedLive) => minted.usageSessionId
      ? (event: "opened" | "heartbeat" | "closed" | "failed") => api.liveUsage(minted.usageSessionId!, event)
      : undefined;

    if (liveAvail) {
      try {
        const { requestLiveMicrophone, startGeminiLive } = await import("../../lib/geminiLiveClient");
        if (!attempt.isCurrent()) return;
        micStream = await requestLiveMicrophone(attempt.signal);
        if (!attempt.isCurrent()) { releaseMic(); return; }
        liveStage = "mint";
        const fresh = await mintLive();
        if (!attempt.isCurrent()) { releaseMic(); return; }
        if (!(fresh.available && fresh.token && fresh.model)) trackLiveUnavailable("token_error");
        if (fresh.available && fresh.token && fresh.model) {
          liveStage = "socket";
          liveUsageId = fresh.usageSessionId;
          const stream = micStream;
          micStream = null; // the session owns (and releases) the microphone now
          const ctl = await startGeminiLive(
            {
              signal: attempt.signal,
              token: fresh.token,
              reportUsage: usageFor(fresh),
              usageId: fresh.usageSessionId,
              model: fresh.model,
              systemInstruction: fresh.systemInstruction || "",
              speechConfig: fresh.speechConfig,
              stream: stream ?? undefined,
              // B-AIOPS-02: the slice this token covers; the next one is
              // minted before it ends while the family has time left, and a
              // spent allowance ends the conversation calmly (onAllowanceEnd).
              expiresAt: fresh.expiresAt,
              remainingMs: fresh.budget?.remainingMs,
              renew: async (renewOf) => {
                try {
                  const next = await mintLive(renewOf);
                  if (!(next.available && next.token && next.model)) throw new Error("live-renew-unavailable");
                  return { token: next.token, model: next.model, systemInstruction: next.systemInstruction || "", speechConfig: next.speechConfig,
                    expiresAt: next.expiresAt, remainingMs: next.budget?.remainingMs, reportUsage: usageFor(next), usageId: next.usageSessionId };
                } catch (renewError) {
                  if (isLiveResting(renewError)) return null;
                  throw renewError;
                }
              },
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
                setVoiceReviewOpen(true);
              },
              // B-AIOPS-02: the family's voice time ended the conversation —
              // a resting state, never the connection-ended notice.
              onAllowanceEnd: () => {
                if (!attempt.isCurrent()) return;
                attempt.end();
                clearLiveRefs();
                voiceOnRef.current = false;
                setVoiceInterim("");
                finalizeVoiceAiTurn();
                setVoicePhase("off");
                setVoiceResting(true);
                setVoiceReviewOpen(true);
              },
              // B-AIOPS-02: the next slice never arrived (renewal and retries
              // failed) — a calm closing line, never the connection-ended notice.
              onTalkEnd: () => {
                if (!attempt.isCurrent()) return;
                attempt.end();
                clearLiveRefs();
                voiceOnRef.current = false;
                setVoiceInterim("");
                finalizeVoiceAiTurn();
                setVoicePhase("off");
                setVoiceTalkEnded(true);
                setVoiceReviewOpen(true);
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
        releaseMic();
        if (!attempt.isCurrent()) return;
        clearLiveRefs();
        if (err instanceof PaywallError) {
          attempt.end();
          setVoicePhase("off");
          openPaywall(err.feature || "coach_unlimited", err.plan);
          return;
        }
        // B-PROV-12: the server's route changed since the probe (a new
        // provider, region or purpose). Never a silent fallback: voice stays
        // off and the new route's notice waits for its own tap.
        if (err instanceof VoiceNoticeRequiredError) {
          attempt.end();
          setVoicePhase("off");
          const next = liveNoticeIdFrom({ available: true, notice: { id: err.noticeId } });
          setLiveNoticeId(next);
          if (!next) setLiveAvail(false);
          setNoticePending(runtimeVoiceNoticeId(next));
          return;
        }
        // AI-06: a quota (429) or consent (451) refusal is NOT a transport
        // hiccup — the browser-voice fallback calls the same server and gets
        // the same refusal, so "falling back" was a silent dead end. Now the
        // status survives (lib/api streamVoice) and the parent is told which
        // of the two happened, and what to do about it.
        // B-AIOPS-02: the family's daily voice time (`live_resting`) is not a
        // failure: voice off, the calm resting line, the typed composer and
        // the crisis door untouched; no reload, no fallback loop, no retry.
        if (isLiveResting(err)) {
          attempt.end();
          setVoicePhase("off");
          setVoiceResting(true);
          return;
        }
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
        if (liveUsageId && (unavailable === "closed_before_open" || unavailable === "closed_during_start")) {
          void api.liveUsage(liveUsageId, "failed").catch(() => {});
        }
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
    reviewAttemptRef.current = null;
    voiceSessionIdRef.current = "unmounted";
    voiceOnRef.current = false;
    dictationLoopRef.current?.stop();
    dictationLoopRef.current = null;
    stopSpeaking();
    voiceAbortRef.current?.abort();
    voiceAbortRef.current = null;
    liveCtlRef.current = null;
  }, []);

  useEffect(() => { stopVoice(false); }, [conversationRevision]);
  useEffect(() => { if (!visible) stopVoice(false); }, [visible]);
  // Review drafts belong to one child and one thread, including late network
  // responses. A new thread cannot offer the prior child's unconfirmed facts.
  useEffect(() => { clearVoiceReview(); }, [childProfile.id, conversationRevision]);

  // B-VOICE-06: "Talk it through" on the capture bar opens the conversation
  // READY to talk — it never opens the microphone by itself. The microphone
  // starts only from the parent's own tap on the composer's Talk button (the
  // one voice path): a mic or audio started after a navigation is outside the
  // tap's user activation (iOS Safari can start it muted), and the 9 Oct input
  // contract keeps "available" distinct from "listening". So the claimed
  // request focuses that button and shows one line saying so. The request is
  // claimed once and only while fresh (lib/companionConversation).
  // FEAT-01: the conversation header's menu asks through the same door, and
  // its request is claimed like a voice request: here on a tap while mounted,
  // or on mount when the tap landed while this conversation was still loading.
  // "tone" opens the ONE ToneSheet; "history" opens the in-panel history list
  // (F-TALK-1: hidden by default), brings it into view and focuses its
  // current conversation (else its first row, else its close button).
  const historyRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const onAsk = (event: Event) => {
      const detail = (event as CustomEvent<CompanionConversationRequest>).detail;
      if (detail?.voice) setVoiceAsk((n) => n + 1);
      if (detail?.panel) setPanelAsk((n) => n + 1);
    };
    window.addEventListener(COMPANION_CONVERSATION_EVENT, onAsk);
    return () => window.removeEventListener(COMPANION_CONVERSATION_EVENT, onAsk);
  }, []);
  useEffect(() => {
    if (!visible) return;
    const panel = consumeConversationPanelRequest();
    if (panel === "tone") setToneOpen(true);
    if (panel === "history") { setHistoryOpen(true); setHistoryAsk((n) => n + 1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, panelAsk]);
  // The list mounts on the render after the claim, so its focus runs here.
  useEffect(() => {
    if (!historyAsk || !historyRef.current) return;
    const region = historyRef.current;
    region.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
    const row = region.querySelector<HTMLElement>("[data-history-chip][aria-current]") ?? region.querySelector<HTMLElement>("[data-history-chip]") ?? region.querySelector<HTMLElement>("button");
    row?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyAsk]);
  // Closing the list (a row chosen, Close, Escape) hands focus to the composer
  // field so it never falls to the page body.
  const closeHistory = (from: HTMLElement) => {
    const scope: ParentNode = from.closest(".companion-coach") ?? document;
    setHistoryOpen(false);
    requestAnimationFrame(() => {
      const field = scope.querySelector<HTMLTextAreaElement>('[data-testid="coach-composer-well"] textarea');
      if (field && !field.disabled) field.focus({ preventScroll: true });
    });
  };
  useEffect(() => {
    if (!visible || !liveProbed || !conversationVoiceRequestPending()) return;
    if (consumeConversationVoiceRequest() && voicePhase === "off") {
      setVoiceInvite(true);
      window.setTimeout(() => (document.querySelector<HTMLButtonElement>(".companion-conversation .companion-live-button"))?.focus(), 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, liveProbed, voiceAsk]);

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
  const hasThreadContent = chatMessages.length > 0 || isChatLoading || !!failureCopy || voiceResting;
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
  // FEAT-06: crisis wording in the composer (the same screen the server runs
  // on send) shows the helplines in place, with the door to Safety & escalation.
  const composerCrisis = screenForImmediateEscalation({ message: chatInput }) !== null;
  // F-TALK-1: the "hard moment" door rides in the composer's add tray. It is
  // passed only while a pilot guide is available for this child
  // (availableHardMomentCards: age, expiry); otherwise the tray has no door.
  const composerHardMoment = hardMomentGuides.length > 0 ? () => openHardMomentNow() : undefined;
  // F-TALK-1: the tone control is one quiet chip in the composer foot,
  // labelled with the current tone, opening the ONE ToneSheet. This reverses
  // B-ASKJB-12's placement (a "Tone: <choice>" button in the identity strip,
  // which is gone). Basis: the build brief's ORCHESTRATOR DECISION, "the mock
  // wins over table A and over older v3 briefs", and the v3 mock's composer
  // foot ends with this chip (Now mock L433). B-ASKJB-12's one sheet, its
  // store and its menu entry are unchanged; Guy can still send it back.
  // F-TALK-2: the composer has ONE foot line. The data-use clause (what Arbor
  // uses, and the one-time weekly notice) rides in it beside the honesty line,
  // with its one Change, and the tone chip closes it (mock L433). Critic r2
  // still holds: it reads AFTER the field, as a quiet --t-xs line with no fill.
  // Fresh thread: the memory clause and Change; while the weekly notice is due,
  // its sentence leads and Dismiss joins. Docked under a thread with no notice
  // due, the honesty line and the chip remain.
  const composerFoot = (
    <>
      {(!composerDocked || weeklyNoticeShown) && (
        <div
          data-testid="coach-weekly-notice"
          role="note"
          className="companion-foot-use"
        >
          <p data-testid="coach-data-use" className="min-w-0 t-xs leading-snug" style={{ color: "var(--arbor-muted)" }}>
            {weeklyNoticeShown ? <>{tcc("elev.coachcontract.notice.body")}{!composerDocked && <> {memoryLine}</>}</> : memoryLine}
          </p>
          <button
            type="button"
            data-testid="coach-weekly-notice-change"
            onClick={() => {
              if (weeklyNoticeShown) closeWeeklyNotice();
              // F-TALK-1: the switch lives in "What Arbor remembers"; the
              // section param brings it into view there.
              goToRoute("memory", { section: "coach" });
            }}
            className="inline-flex min-h-11 items-center px-2 t-xs font-bold underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded-lg"
            style={{ color: "var(--arbor-green-ink)" }}
          >
            {tcc("elev.coachcontract.notice.change")}
          </button>
          {weeklyNoticeShown && (
            <button
              type="button"
              data-testid="coach-weekly-notice-dismiss"
              onClick={closeWeeklyNotice}
              className="inline-flex min-h-11 items-center px-2 t-xs font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded-lg"
              style={{ color: "var(--arbor-muted)" }}
            >
              {tcc("elev.coachcontract.notice.dismiss")}
            </button>
          )}
        </div>
      )}
      <button
        type="button"
        data-testid="coach-tone"
        onClick={() => setToneOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${t("coach.tone.label")}: ${toneLabel(selectedLens, t)}`}
        className="companion-tone-chip min-h-11 min-w-11 focus:outline-none focus-visible:ring-2"
      >
        <Icon name="record_voice_over" size={14} />
        <span className="truncate max-w-[160px]">{toneLabel(selectedLens, t)}</span>
      </button>
    </>
  );
  const composerSection = (
        <section
          data-primary-move="ask"
          className={composerDocked ? "py-2.5" : "pt-3 pb-4 sm:pt-4 sm:pb-5"}
          aria-label={t("elev.hero.ask.cta")}
        >
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
          {noticeTalk && <NoticeTalkReview key={noticeTalk.requestId} request={noticeTalk} question={chatInput} he={uiLang === "he"} controller={noticeTalkController} />}
          <CompanionComposer key={childProfile.id} childId={childProfile.id} conversationRevision={conversationRevision} language={uiLang === "he" ? "he" : "en"}
            value={chatInput} onChange={value => { noticeTalkController.current?.revoke(); setChatInput(value); }} busy={isChatLoading} visible={visible}
            onSend={handleChatSend} onVoice={() => void toggleVoice()} voiceActive={voicePhase !== "off"} voiceLabel={voiceLabel}
            onKeep={(text, photo, parentWritten) => openCaptureSheet({ mode: "text", initialText: text, initialPhoto: photo, ...(parentWritten ? { initialTextParentWritten: true } : {}) })}
            onAttachmentsChange={setComposerFiles}
            onHardMoment={composerHardMoment} footAction={composerFoot} voiceResting={voiceResting} />
          {composerCrisis && (
            <UrgentSupport
              testId="coach-composer-urgent-support"
              className="mt-2 min-w-0 rounded-xl border border-[var(--arbor-rule-strong)] bg-[var(--arbor-paper-deep)] px-3 py-2 text-sm leading-relaxed text-[var(--arbor-ink)]"
              onSafety={() => setActiveTab("safety")}
            />
          )}
          {!online && <p data-testid="coach-offline-note" role="status" className="text-xs py-2" style={{ color: "var(--arbor-muted)" }}>{t("elev.aierrors.offline.composer")}</p>}
          {noticePending && voicePhase === "off" && !voiceNotice && <div role="status" data-testid="voice-provider-notice" data-voice-notice={noticePending}>
            <p className="companion-voice-invite" dir="auto">{voiceNoticeShortLine(t, noticePending)}</p>
            <p className="companion-voice-invite" dir="auto">{t("elev.wave2Daily.capture.voice.tapAgain")}</p>
          </div>}
          {voiceInvite && !noticePending && voicePhase === "off" && !voiceNotice && <p role="status" data-testid="voice-door-invite" className="companion-voice-invite" dir="auto">{inputText(uiLang, "companion.input.tap-talk-to-start")}</p>}
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
      <div className={embedded ? "companion-transcript" : undefined} data-companion-scroll={embedded ? "true" : undefined}>
      <div data-module="coach-orientation" className="space-y-4">
        {embedded && !userTurnExists && <div className="companion-welcome"><h3>{inputText(uiLang, "companion.talk.welcome")}</h3><p>{inputText(uiLang, "companion.input.a-little-moment-a-big-question-a-photo-from-today-start-wherever-")}</p></div>}
        {/* Composer-first: the parent's question is the primary job on this page.
            COACH-4: this hero composer is the ONE input on the surface — the
            mirrored in-thread composer was removed; follow-up turns also send
            from here. ASK-2: once the thread has a user turn the SAME element
            docks sticky at the bottom of the page instead (see below). */}
        {!composerDocked && composerSection}

        {/* Fast-start scenarios (IA-2) — F-TALK-1: ONE wrapping chip row, no
            label and no "more examples" toggle; the hard-moment door rides in
            the composer's add tray. Hidden after the first message. */}
        {!userTurnExists && (
          <div>
            <div id="coach-scenarios" className="flex flex-wrap gap-2">
              {/* EXTRA-TALK: the family question is the FIRST chip; it fills the
                  composer and never sends (no handleChatSend here). The question
                  sits in its own bdi so a Latin title keeps its order in Hebrew. */}
              {topicChip && (
                <button
                  key="family-topic"
                  type="button"
                  data-testid="coach-scenario-topic"
                  onClick={(event) => continueWithTopic(event.currentTarget, topicChip.title.trim())}
                  disabled={isChatLoading}
                  className="inline-flex max-w-full items-center gap-2 rounded-full px-3.5 py-2 min-h-11 text-start text-[13px] font-bold transition disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={{ color: T.ink, border: "1px solid var(--arbor-rule)", background: "var(--arbor-paper-elevated)" }}
                >
                  <Icon name="bookmark" size={16} style={{ color: "var(--arbor-green-ink)" }} />
                  <span className="min-w-0 line-clamp-2">{topicChipBefore}<bdi dir="auto">{topicChip.title.trim()}</bdi>{topicChipAfter || null}</span>
                </button>
              )}
              {/* B-ASKJB-10: the child's own recurring moment (after the family
                  question, when one is set), then the static chips. */}
              {echoScenario && (
                <button
                  key="echo"
                  data-testid="coach-scenario-echo"
                  onClick={() => handleChatSend(echoScenario.prompt, { displayText: echoScenario.label })}
                  disabled={isChatLoading}
                  className="inline-flex max-w-full items-center gap-2 rounded-full px-3.5 py-2 min-h-11 text-start text-[13px] font-bold transition disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={{ color: T.ink, border: "1px solid var(--arbor-rule)", background: "var(--arbor-paper-elevated)" }}
                >
                  <Icon name="replay" size={16} style={{ color: "var(--arbor-green-ink)" }} /> <span dir="auto">{echoScenario.label}</span>
                </button>
              )}
              {SCENARIOS.slice(0, staticShown).map((s) => (
                <button
                  key={s.labelKey}
                  // ASK-5: the parent's bubble shows the localized label they
                  // actually tapped; the canonical EN prompt goes to the model.
                  onClick={() => handleChatSend(s.prompt, { displayText: t(s.labelKey) })}
                  disabled={isChatLoading}
                  className="inline-flex max-w-full items-center gap-2 rounded-full px-3.5 py-2 min-h-11 text-start text-[13px] font-bold transition disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={{ color: T.ink, border: "1px solid var(--arbor-rule)", background: "var(--arbor-paper-elevated)" }}
                >
                  <Icon name={s.icon} size={16} style={{ color: "var(--arbor-green-ink)" }} /> {t(s.labelKey)}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* F-TALK-1: the research trust chip left the panel — every answer
            carries the trust chain (TrustLink in the card footer). */}
      </div>

      {/* F-TALK-1: history is not a strip. The panel menu's "History" opens
          this in-panel list (rows of 44 px or more: title, date, delete);
          choosing a row opens that conversation and closes the list. New
          conversation lives in the menu, so the list has no "+ New". */}
      {historyOpen && (
        <section data-module="coach-history"
          ref={historyRef}
          className="companion-history rounded-2xl border p-2"
          style={{ borderColor: "var(--arbor-rule)", background: "var(--arbor-paper-elevated)" }}
          aria-labelledby="coach-history-title"
          onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); closeHistory(event.currentTarget); } }}
        >
          <div className="flex items-center gap-2 ps-2">
            <h3 id="coach-history-title" className="me-auto text-[13px] font-bold" style={{ color: "var(--arbor-ink)" }}>{t("elev.wave2Daily.ask.history")}</h3>
            <button
              type="button"
              onClick={(event) => closeHistory(event.currentTarget)}
              aria-label={inputText(uiLang, "companion.history.close")}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl focus:outline-none focus-visible:ring-2"
              style={{ color: "var(--arbor-muted)" }}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          {conversations.length > 0 ? (
            <ul className="space-y-0.5">
              {conversations.map((c) => {
                const on = c.id === activeConversationId;
                return (
                  <li key={c.id} className="flex items-center gap-1 rounded-xl" style={on ? { background: "var(--arbor-green-soft)" } : undefined}>
                    <button
                      type="button"
                      onClick={(event) => { openConversation(c.id); closeHistory(event.currentTarget); }}
                      data-history-chip=""
                      aria-current={on ? "true" : undefined}
                      className="flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-xl px-2 py-1.5 text-start focus:outline-none focus-visible:ring-2"
                    >
                      <span className="w-full truncate text-[13px] font-bold" dir="auto" style={{ color: on ? "var(--arbor-green-ink)" : "var(--arbor-ink)" }}>{c.title}</span>
                      <span className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>{fmtDay(c.updatedAt, uiLang === "he" ? "he" : "en")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteConversation(c.id)}
                      aria-label={inputText(uiLang, "companion.history.delete", { title: c.title })}
                      className="touch-target inline-flex items-center justify-center rounded-xl transition focus:outline-none focus-visible:ring-2"
                      style={{ color: "var(--arbor-muted)" }}
                    >
                      <Icon name="delete" size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-2 pb-2 text-[12px]" style={{ color: "var(--arbor-muted)" }}>{inputText(uiLang, "companion.history.empty")}</p>
          )}
        </section>
      )}

      {/* Chat thread — COACH-4: no fixed-height inner scroll; the thread flows
          with the page (ArborContext auto-scrolls the viewport to the streaming
          answer via chatBottomRef). The min-height keeps the conversation canvas
          from shrinking below the previous min(70dvh,560px) viewport. */}
      <div data-module="coach-thread" className={`${cardCls} flex min-w-0 flex-col overflow-hidden`}>
        {/* F-TALK-1: no thread sub-header. The panel header already says
            "Arbor"; the composer foot carries the AI disclosure and the tone
            chip; "What the coach sees" and its weekly switch live on
            #/memory; the loading state is the streaming row below. */}
        <div data-companion-messages className={hasThreadContent ? "flex-1 p-4 md:p-6" : "p-0"}>
         <div className="max-w-[760px] mx-auto space-y-3.5">
          {/* Empty state — orient a first-run parent on what Ask Arbor does.
              COACH-4: the title line lives ONCE, on the hero composer above;
              the thread empty state keeps only the mascot + body copy.
              ASK-7: this is THE single orientation block (with the scenarios)
              — it hides the moment any real turn exists, including a legacy
              conversation that still opens with the old welcome bubble. */}
          {chatMessages.map((msg, idx) => (
            <React.Fragment key={idx}>
            {/* F-TALK-2 (mock L399): one muted date line per day, from the
                turns' own timestamps ("Today · 07:58"). Turns saved before
                timestamps existed carry none and draw no line. */}
            {dayMarks.has(idx) && (
              <p data-testid="coach-thread-date" className="text-center t-xs font-semibold" style={{ color: "var(--arbor-muted)" }}>
                {threadDayLabel(msg.at!, threadNow, uiLang === "he" ? "he" : "en")}
              </p>
            )}
            <div data-companion-message={msg.sender} data-structured-report={msg.sender === "ai" && !!msg.contract || undefined} className={`flex gap-3 group ${msg.sender === "user" ? "ms-auto max-w-[82%] flex-row-reverse" : "me-auto w-full"}`}>
              {/* F-TALK-2 (mock L400-403): the parent's turn carries no avatar;
                  Arbor's turn is led by the Arbor mark. */}
              {msg.sender === "ai" && (
                <div className="flex h-8 w-6 flex-shrink-0 items-start pt-1" title="Arbor">
                  <ArborMark size={24} />
                </div>
              )}
              {/* Asymmetric "tail" via logical radii so it flips correctly in RTL:
                  the speaker-side bottom corner is tightened to 6px. The parent's
                  bubble is navy with light text (mock L400); Arbor's carries a
                  soft shadow to lift the conversation off the canvas. */}
              <div dir="auto" className={`min-w-0 p-4 rounded-[18px] text-sm font-medium leading-[1.55]${msg.sender === "ai" ? " flex-1" : ""}`}
                style={msg.sender === "user"
                  ? { background: "var(--arbor-ink)", color: "var(--arbor-on-accent)", borderEndEndRadius: 6 }
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
                      onGoDeeper={() => handleCouncilSend(undefined, { answerIndex: idx })}
                      // AI-05: the teacher note is CONSUMED, not dropped. The
                      // card handed a real note string and this callback threw
                      // it away, so "Teacher note" was a bare tab switch into an
                      // empty Consult composer — the same defect AIX-S3(a) fixed
                      // for ArborVision's handoff. Same seam, same contract.
                      // B-CAREPRO-13: the note is FOR a teacher, so the
                      // audience lands on "teacher" (not the stored default).
                      onAddToHandoff={(note, audience = "teacher") => {
                        requestConsultPrefill({ note, audience });
                        setActiveTab("consult");
                        // Nothing is copied: the note is prefilled, editable, in Consult.
                        toast(t("coach.toast.handoffPrefilled"), "info");
                      }}
                      onProposeMemory={(fact) => proposeMemory(fact, { source: "document", prompt: "companion:document" })}
                      // F-TALK-2: the visit handoff (ia-b6) left the row under the
                      // thread for the answer's actions, next to Teacher note.
                      onPrepareVisit={() => { setActiveTab("consult"); toast(t("coach.specialist.toast"), "info"); }}
                      // LL-A1: the settled last answer carries its Go deeper reads.
                      goDeeperReads={idx === chatMessages.length - 1 && goDeeperReads.length > 0
                        ? goDeeperReads.map((card) => ({ id: card.id, title: aiLang === "he" ? card.title.he : card.title.en }))
                        : undefined}
                      onRead={(cardId) => requestLearnRead({ cardId, source: "coach-answer" })}
                      // EXTRA-TALK: one count-free provenance line per SETTLED
                      // answer; "the question you chose" only when that turn
                      // went out with a family question (its stamped topicId).
                      provenance={!msg.chatLive && !msg.voiceLive ? { topic: askedWithTopic(chatMessages, idx) } : undefined}
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
                  // prompt that went to the model. F-TALK-2: plain text on the
                  // navy bubble (MarkdownBlock paints its paragraphs in ink).
                  <>
                    {msg.attachments?.map(file => <div key={file.id} className="companion-file-receipt"><Icon name={file.kind === "photo" ? "photo" : "description"} size={20}/><span>{file.name}<small className="block">{inputText(uiLang, "companion.input.attached-to-this-turn-original-not-saved")}</small></span></div>)}
                    <p className="whitespace-pre-wrap break-words">{msg.displayText || msg.text}</p>
                  </>
                )}

                {msg.sender === "ai" && !msg.contract && !msg.voiceLive && !msg.chatLive && (
                  // F-TALK-2 (mock L400-404): a prose turn carries no toolbar.
                  // One quiet "More" at its end holds Copy, Keep, Plan and Share.
                  // Touch: always visible. Desktop: calm hover reveal. Keyboard: focus reveals.
                  <div className="relative flex justify-end mt-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition">
                    <button
                      type="button"
                      onClick={() => setOpenMenuIdx(openMenuIdx === idx ? null : idx)}
                      aria-label={t("coach.more")}
                      aria-haspopup="menu"
                      aria-expanded={openMenuIdx === idx}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1" style={{ color: "var(--arbor-muted)" }}
                    >
                      <Icon name="more_horiz" size={20} />
                    </button>
                    {openMenuIdx === idx && (
                      <>
                        {/* Backdrop closes the menu on any outside tap. */}
                        <button type="button" aria-hidden className="fixed inset-0 z-10 cursor-default" onClick={() => setOpenMenuIdx(null)} tabIndex={-1} />
                        <div role="menu" className="absolute z-20 top-full mt-1 end-0 rounded-xl p-1 min-w-[200px]" style={{ background: T.paperElevated, border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-sm)" }}>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={async () => {
                              setOpenMenuIdx(null);
                              await navigator.clipboard?.writeText(msg.text);
                              toast(t("coach.copied"), "success");
                            }}
                            className="w-full text-start text-xs font-bold flex items-center gap-2 px-2.5 py-2 min-h-11 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1" style={{ color: "var(--arbor-ink)" }}
                          >
                            <Icon name="content_copy" size={16} style={{ color: "var(--arbor-muted)" }} /> {t("coach.action.copy")}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setNewLogNotes(msg.text.replace(/[#*]/g, "").trim().slice(0, 400));
                              // AI-05: an AI-authored draft never reaches the log
                              // store un-reviewed. The gate is fail-closed by
                              // design: it arms the review flag, stamps 'ai-draft'
                              // provenance and opens the one capture sheet in place.
                              openCaptureSheet({ review: "ai-draft" });
                              setOpenMenuIdx(null);
                              toast(t("coach.toast.logPrefilled"), "info");
                            }}
                            className="w-full text-start text-xs font-bold flex items-center gap-2 px-2.5 py-2 min-h-11 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1" style={{ color: "var(--arbor-ink)" }}
                          >
                            <Icon name="edit_note" size={16} style={{ color: "var(--arbor-muted)" }} /> {inputText(uiLang, "companion.tray.keep")}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setPlanChallengeTopic(msg.text.replace(/[#*]/g, "").slice(0, 140));
                              // N1-01-R3: the same armed latch the answer card's
                              // plan door uses; the actionPlans write consumes it.
                              markPlanSeededFromAnswer("coach");
                              setActiveTab("plans");
                              setOpenMenuIdx(null);
                              toast(t("coach.toast.planSeeded"), "info");
                            }}
                            className="w-full text-start text-xs font-bold flex items-center gap-2 px-2.5 py-2 min-h-11 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1" style={{ color: "var(--arbor-ink)" }}
                          >
                            <Icon name="playlist_add" size={16} style={{ color: "var(--arbor-muted)" }} /> {t("coach.action.plan")}
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
            </React.Fragment>
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
              : FOLLOW_UPS.map((q) => ({ key: q.labelKey, label: t(q.labelKey, { name: childFirst || t("learn.yourChild") }), prompt: q.prompt }));
            return (
            // F-TALK-2 (mock L415): three white chips under the last answer,
            // aligned with its text (the 24 px mark + gap); 44 px floor (MOB-03).
            <div className="flex flex-wrap gap-2 me-auto max-w-[85%] ps-9">
              {chips.map((q) => (
                <button
                  type="button"
                  key={q.key}
                  dir="auto"
                  onClick={() => handleChatSend(q.prompt, { displayText: q.label })}
                  className="text-[13px] px-4 py-1.5 min-h-[44px] rounded-full transition flex items-center gap-1.5 font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-clay)" }}
                >
                  {q.label}
                  <Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" />
                </button>
              ))}
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

          {/* B-AIOPS-02 — the resting line: the family's voice time for today
              is spent. Its own polite status in the place the thread ends (a
              resting state is not a failure, so it is never the alert card):
              the same calm card shape in the sky tint, title + one sentence,
              no countdown, no retry. Typing and the crisis door are unchanged. */}
          {voiceResting && !isChatLoading && !failureCopy && (
            <div
              role="status"
              data-testid="coach-voice-resting"
              className="flex items-start gap-3 rounded-2xl p-4 me-auto max-w-[85%]"
              style={{ background: "var(--arbor-sky-soft)", color: "var(--arbor-sky-ink)" }}
            >
              <Icon name="mic_off" size={16} className="flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-xs leading-relaxed font-extrabold" dir="auto">{t("elev.aierrors.voiceResting.title")}</p>
                <p className="text-xs leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink)" }}>{t("elev.aierrors.voiceResting.body")}</p>
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
                  {failureCopy.actionKey && (failureCopy.actionRoute || fileConsentFailure) && (
                    <button
                      type="button"
                      onClick={() => fileConsentFailure ? requestCompanionConsentReview(childProfile.id) : setActiveTab(failureCopy.actionRoute!)}
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
            deleted — the hero composer above is the one input. F-TALK-2 (mock
            L417-433): the composer follows the thread directly; the visit
            handoff (ia-b6) rides in each answer's actions, beside Teacher note. */}
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
            // Parity 9 Oct: the conversation is always embedded now, so
            // `!embedded` meant the free -> Plus card could never show. It shows
            // again in the panel, but only while the input holds NOTHING (no
            // draft, no file, no dictation): a composition in progress never
            // meets a commercial card.
            surfaceIdle={!isChatLoading && !failureCopy && voicePhase === "off" && (!embedded || (!chatInput.trim() && composerFiles === 0))}
            online={online}
          />
        </div>
      </div>

      {/* Trust & Safety — constant posture (GP-05/AI-08): the bar never grades
          or colours the child. F-TALK-2: it renders only when the last answer
          carries the contract's internal escalation signal (TS-1/TS-3), so
          the escalate path stays and a calm answer ends at its own text. */}
      {lastMessage?.sender === "ai" && userTurnExists && escalationSignal && (
        <TrustSafetyBar
          note={t("coach.trust.note")}
          lang={uiLang}
          onEscalate={escalationSignal ? () => setActiveTab("consult") : undefined}
        />
      )}

      </div>

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

      <ToneSheet open={toneOpen} onClose={() => setToneOpen(false)} selectedLens={selectedLens} onSelect={setSelectedLens} t={t} />

      {visible && voiceReviewOpen && voicePhase === "off" && <VoiceCloseCard
        sessionId={voiceSessionIdRef.current} proposals={conversationProposals} language={uiLang}
        pending={proposalPending > 0} failed={proposalFailed} busy={!!proposalBusyId || nextStepBusy} onClose={discardVoiceReview}
        // B-VOICE-04: the session's one next step, kept as today's step only
        // on the parent's tap, through the coach's own "try it" writer.
        nextStep={voiceNextText ? { text: voiceNextText, language: getAiLanguage() === "he" ? "he" : "en" } : null}
        nextStepKept={!!voiceNextText && (nextStepKeptFor === voiceSessionIdRef.current || activeTodayAction?.recommendation?.trim() === voiceNextText)}
        nextStepBusy={nextStepBusy} nextStepFailed={nextStepFailed}
        onKeepNextStep={() => void keepVoiceNextStep()}>
        {/* B-AIOPS-02: when the family's voice time ended the talk, the review
            says so first (the same resting words, never an error). */}
        {voiceResting && <p role="status" data-testid="voice-review-resting" className="text-xs leading-relaxed pb-2" dir="auto" style={{ color: "var(--arbor-ink)" }}>
          {t("elev.aierrors.voiceResting.title")}. {t("elev.aierrors.voiceResting.body")}
        </p>}
        {voiceTalkEnded && !voiceResting && <p role="status" data-testid="voice-review-ended" className="text-xs leading-relaxed pb-2" dir="auto" style={{ color: "var(--arbor-ink)" }}>
          {t("elev.aierrors.voiceTalkEnded")}
        </p>}
        <ConversationProposalTray
          inline
          proposals={conversationProposals}
          language={uiLang}
          busyId={proposalBusyId}
          onEdit={(id, summary) => setConversationProposals((items) => items.map((item) => item.id === id ? { ...item, summary } : item))}
          onDiscard={(id) => setConversationProposals((items) => items.filter((item) => item.id !== id))}
          onConfirm={async (proposal) => {
            if (proposalCommitRef.current) return;
            proposalCommitRef.current = true;
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
            } finally { proposalCommitRef.current = false; setProposalBusyId(null); }
          }}
        />
      </VoiceCloseCard>}

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
          // B-STATUS-02: "Recording · m:ss" whenever the microphone is open —
          // the fallback loop listens only in its listening turn; a Live call
          // streams the microphone for the whole session.
          recording={voicePhase === "listening" || liveSession}
          onOrbTap={() => { if (voicePhase === "speaking" && !liveCtlRef.current && voiceOnRef.current) bargeInVoice(); }}
          onClose={stopVoice}
        />
      )}


    </motion.div>
  );
}
