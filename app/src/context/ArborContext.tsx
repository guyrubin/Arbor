import { acceptTodayAction as persistAcceptedTodayAction } from "../actionLoop/accept";
import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from "react";
import {
  ChildProfile,
  BehaviorLog,
  Milestone,
  ActionPlan,
  BehaviorAnalysis,
  MemoryReviewItem,
  BehaviorContext,
  DevelopmentalDomainId,
  CoachContract,
  CouncilTake,
  PlayLog,
  ActionLoopEntry,
  ActionCapacity,
  ActionOutcome,
  InsightRecord,
  PlanCheckAnswer,
} from "../types";
import { useToastOptional } from "./ToastContext";
import { validateLogDraft, buildMomentLog, isIncidentType, MOMENT_BEHAVIOR_TYPE } from "../content/behaviorTaxonomy";
import type { ScoredActivity } from "../playbank/select";
import type { PlayActivity } from "../playbank/content";
import { ROUTE_IDS, resolveHash, FALLBACK_ROUTE, type ActiveTab } from "../lib/routes";
import {
  initialMilestones,
  demoSeedFor,
} from "../initialData";
import { useProfile } from "./ProfileContext";
import { api, ApiError, authHeaders, getAiLanguage, PaywallError, streamCouncil } from "../lib/api";
import { useChildCollection } from "../hooks/useChildCollection";
import { useFamilyTopics } from "../hooks/useFamilyTopics";
import type { ExplainAnswer } from "../lib/explainAnswer";
import { track } from "../lib/analytics";
import { isKidModeActive } from "../lib/kidModeGate";
import { runInstrumented } from "../hooks/useAsyncAction";
import { trackFirstPlan, trackInviteActivated, trackPlayCompleted } from "../lib/loopEvents";
import { trackCaptureStarted, trackCaptureSaved, trackPlanGenerated } from "../lib/kpiEvents";
import { todayOutcomeProps, type TodayOutcomeVia } from "../lib/loopEvents";
import { notePlanCreatedFromAnswer } from "../lib/captureProposals";
import { consumeReferralCode } from "../lib/attribution";
import { refreshEntitlement } from "../hooks/useEntitlement";
import { takeCoachSeed } from "../lib/onboardingJourney";
import { matchLearnCards, type SavedLearnItem } from "../learn/learnLibrary";
import { LEARN_CARDS } from "../learn/learnCards";
import { isLearnPilotCard } from "../learn/learnPilotRelease";
import { concernsForBehaviors } from "../content/selectCards";
import { ageYearsFromProfile } from "../lib/childAge";
import { ageWindowMilestones, comparisonAgeMonths } from "../lib/milestoneData";
import { observeMilestoneDoc, type ObserveOptions, type ObserveStatus } from "../lib/milestones/observe";
import type { ShelfId } from "../lib/shelves/registry";
import { hydrateMilestones } from "./milestoneHydration";
import { completeObservation, isObservationAction, isUrgentOnboardingAction, activeActionFor, sortActionLoop, todayActionId, type ChildResponse, type HeldAnswer, type PlanStepRef } from "../actionLoop/model";
import { planStepStatusAfter } from "../lib/plans";
import { answeredToday, fromRecordRowId, fromRecordEntry, type FromRecordAnswer, type FromRecordOpener } from "../lib/today/fromRecord";
import { recentTypeCounts } from "../lib/planRecord";
import { appendVoiceUser, applyVoiceDelta, settleVoiceTurn } from "../lib/voiceTranscript";
import type { ConversationChangeRecord, ConversationProposal } from "../lib/conversationProposals";
import { restorableMilestone } from "../lib/conversationProposals";
import { appendChatUser, appendChatAck, applyChatDelta, settleChatTurn, abortChatStream, hasUserTurn } from "../lib/chatStream";
import { buildChatContext, readWeeklyContextConsent } from "../ai/chatContext";
import { buildJournalRequest } from "../ai/journalContext";
import { readTodayPin } from "../lib/practice/todayPin";
import { dayKey } from "../practice/signals";
import type { JournalFilter } from "../lib/journalFilters";
import type { CaptureSource } from "../components/overview/ConfirmCaptureReview";
import { useLanguage } from "./LanguageContext";
import { threadForTopic } from "../lib/topicConversation";
import type { ExportAudience } from "../consult/packet";
import type { ProfessionalReportType } from "../lib/reportExport";
import { ageMonthsOf } from "../lib/age/forChild";

/** B-CAREPRO-13 — what a caller may hand the Consult composer. All optional;
 *  `preset` is a professional PDF type (never "teacher": the School Brief is
 *  the one teacher document). */
export type ConsultPrefill = {
  reason?: string;
  note?: string;
  audience?: ExportAudience;
  preset?: Exclude<ProfessionalReportType, "teacher">;
};

const readLS = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeLS = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};

const renderApiConnectionError = (message: string) => {
  const reason = message || "An exception occurred while connecting to Arbor services.";
  const authHint = /failed_precondition|requires an index|firestore\/indexes/i.test(reason)
    ? "Arbor couldn't read your child's memory because a database index is still building. This is a server-side setup step, not an API-key issue — please try again in a few minutes."
    : /authorization|unauthorized|firebase id token/i.test(reason)
    ? "Refresh the page and sign in again. If the production site shows Sandbox Parent, the browser build is missing Firebase client configuration."
    : "If this continues, check the Arbor API deployment and model provider configuration.";
  return `### Connection Error\nCould not fetch response from the server.\n\n**Reason:** ${reason}\n\n${authHint}`;
};

// IA-1: URL hash routing. Each leaf view maps to `#/<tab>` for deep links and a
// working browser back/forward button. The `ActiveTab` type and this runtime
// guard both derive from the ROUTE_IDS single source of truth in lib/routes.ts —
// re-exported here so existing `import { ActiveTab } from "../context/ArborContext"`
// call sites keep working unchanged.
export type { ActiveTab };
const VALID_TABS = new Set<string>(ROUTE_IDS);

/** The modality a "log a moment" entry tile promises; the capture surface opens
 *  in this mode when a request is pending. "ai-draft" (AI-CAP-4) is the coach
 *  handoff: the extraction seam already filled the draft, so Behaviors opens
 *  the form VISIBLE, scrolled into view, with the review gate armed and the
 *  factual ai-draft provenance — the only write path stays confirmReview. */
export type CaptureMode = "voice" | "photo" | "text" | "ai-draft";
/** Non-functional export — lets the F1 capability-floor harness import the
 *  canonical tab list without re-deriving it. Zero behavior change: this
 *  array is derived from VALID_TABS and is never read by any render path. */
export const ALL_TABS: ActiveTab[] = [...VALID_TABS] as ActiveTab[];

/* ── OBJ-PROFILE-04 · the memory ledger read, with a back-off ────────────────
 *
 * `GET /api/memory/<child>` was re-fired on every mount with no back-off and no
 * ceiling; one lane produced 65 console errors in a session, and the surface
 * reported every failure as "Something interrupted the connection" — including
 * HTTP 429, which is not a connection problem and is not the parent's to fix.
 *
 * The retry policy is deliberately short and finite: three reads at most,
 * spaced 2 s / 4 s / 8 s, then stop and say so once. A ledger that is rate
 * limited will still be rate limited on read four; hammering it is how four
 * lanes sharing one limiter turned a slow response into a wall of errors.
 * Injectable `sleep` and `alive` so the policy is testable without a clock. */

/** Why a ledger read failed. Distinguished because the COPY differs. */
export type MemoryReadFailure = "rate_limited" | "error";

/** 2 s, 4 s, 8 s. Three reads total, ~14 s, then quiet. */
export const MEMORY_RETRY_DELAYS_MS: readonly number[] = [2000, 4000, 8000];

export type MemoryReadAttempt = { status: number; items?: unknown[] };

export async function pollMemoryReview(deps: {
  attempt: () => Promise<MemoryReadAttempt>;
  sleep?: (ms: number) => Promise<void>;
  alive?: () => boolean;
  delays?: readonly number[];
}): Promise<{ tries: number; waited: number[]; failure: MemoryReadFailure | null; items: unknown[] }> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const alive = deps.alive ?? (() => true);
  const delays = deps.delays ?? MEMORY_RETRY_DELAYS_MS;
  const waited: number[] = [];
  let tries = 0;
  let failure: MemoryReadFailure = "error";
  while (tries < delays.length) {
    tries += 1;
    let res: MemoryReadAttempt | null = null;
    try {
      res = await deps.attempt();
    } catch {
      failure = "error";
    }
    if (!alive()) return { tries, waited, failure, items: [] };
    if (res) {
      if (res.status >= 200 && res.status < 300) return { tries, waited, failure: null, items: res.items ?? [] };
      failure = res.status === 429 ? "rate_limited" : "error";
    }
    // The LAST attempt is not followed by a wait — the loop is over.
    if (tries < delays.length) { waited.push(delays[tries - 1]); await sleep(delays[tries - 1]); }
  }
  return { tries, waited, failure, items: [] };
}

import { attachmentMetadata, parseCompanionAttachments, type ComposerAttachment, type AttachmentReceipt, type AttachmentContext } from "../lib/companionAttachments";
import { requestCompanionConversation } from "../lib/companionConversation";
import { councilConversation } from "../lib/councilConversation";

export type ChatMessage = {
  attachments?: AttachmentReceipt[];
  attachmentContext?: AttachmentContext;
  sender: "user" | "ai";
  text: string;
  /** ASK-5: what the parent actually SAW and tapped (localized chip label /
   *  scenario summary). Rendered as the user bubble when present; `text`
   *  stays the canonical prompt that went to the model. */
  displayText?: string;
  lens?: string;
  contract?: CoachContract;
  council?: CouncilTake[];
  /** COACH-2: true while this AI bubble is the live voice caption still
   *  accumulating streamed deltas; stripped when the voice turn settles. */
  voiceLive?: boolean;
  /** ASK-1/AIR-1: true while this AI bubble is the live Ask answer still
   *  accumulating streamed (server-screened) deltas; stripped on settle. */
  chatLive?: boolean;
  /** ASK-1: the bubble still shows the LOCAL acknowledgment copy — replaced
   *  (never appended to) by the first real streamed delta. */
  chatAck?: boolean;
};
export type ChatResponsePayload = { attachmentContext?: AttachmentContext; text: string; memoryReviewItems?: MemoryReviewItem[]; contract?: CoachContract; council?: CouncilTake[] };
export type Conversation = { topicId?: string; id: string; title: string; messages: ChatMessage[]; updatedAt: string };

// ASK-7: the English WELCOME_MESSAGE bubble was deleted — a fresh thread is
// simply []. Orientation lives ONCE on the surface itself (mascot empty state
// + fast-start scenarios); guards key off hasUserTurn/hasAiTurn predicates
// instead of message-count checks. Legacy saved conversations that still
// contain the old welcome bubble render it as an ordinary AI message.

/**
 * Holds the full Arbor application state and the API handlers that were
 * previously inlined in App.tsx. Exposed via ArborProvider / useArbor so the
 * decomposed tab + layout components can consume state without prop drilling.
 */
function useArborState() {
  const showSandboxBanner = import.meta.env.VITE_HAS_GEMINI_API !== "true";
  // ASK-1: honest streaming statuses + the acknowledgment bubble are localized
  // through the SAME i18n dictionaries as the rest of the UI — a Hebrew
  // session must never see an English status string.
  const { t, uiLang } = useLanguage();
  // Critic r1 (Law 8): the sandbox demo record is seeded in the parent's
  // language on first load (same ids and counts in both locales).
  const demoSeed = demoSeedFor(uiLang === "he" ? "he" : "en");
  // TJB-01: every blocking alert() in this provider is gone — feedback goes
  // through the app toast (ToastProvider wraps ArborProvider in App.tsx; the
  // optional accessor keeps unit renders without a provider from throwing).
  const toastCtx = useToastOptional();
  const toast = (message: string, type?: "success" | "error" | "info") => toastCtx?.toast(message, type);

  // Active child comes from ProfileContext so every AI call, log, and plan is
  // scoped to the selected child rather than a hardcoded profile.
  const { activeChild, updateChild, captureOnboardingLifetime } = useProfile();
  const childProfile: ChildProfile = activeChild;
  const topicState = useFamilyTopics(childProfile.id);
  const { activeFamilyTopic } = topicState;

  // Navigation State (persisted preferences). Initial tab: URL hash wins (deep
  // link), then last-used (localStorage), then Home.
  //
  // IA-13: an UNKNOWN hash is not the same as no hash. `#/nonexistent` used to
  // fall through to the stored tab, so a stale link rendered Reports under a
  // URL that said something else. resolveHash separates the two: an unknown
  // hash lands on Today, and the flag below turns into one replaceState + one
  // quiet sentence in the effect that runs after mount.
  const initialHash = resolveHash(typeof window === "undefined" ? "" : window.location.hash, readLS("arbor.activeTab"));
  const [activeTab, setActiveTabState] = useState<ActiveTab>(initialHash.tab);
  const unknownHashRef = useRef<boolean>(initialHash.unknown);
  const setActiveTab = (t: ActiveTab) => {
    // KID-LOCK (W0.9, LEAK 3): while Kid Mode is open, parent navigation is
    // frozen at the root. Kid surfaces reuse parent tabs (HeroJourneyTab,
    // HeroArcade) whose CTAs call setActiveTab("comics"/"family") under the
    // overlay — without this guard the hash + arbor.activeTab mutate silently
    // and the parent exits (or the child reloads) into the wrong tab.
    if (isKidModeActive()) {
      try { track("kidlock_blocked_nav", { tab: t }); } catch { /* noop */ }
      return;
    }
    setActiveTabState(t);
    try { if (window.location.hash.replace(/^#\/?/, "") !== t) window.location.hash = `/${t}`; } catch { /* noop */ }
    try { track("view_tab", { tab: t }); } catch { /* noop */ }
  };

  /**
   * Capture hand-off: a surface that offers "log a moment" entry tiles (Journal)
   * can name the modality it promised. Today consumes the legacy nudge request
   * into the shared capture sheet; direct capture doors use openCaptureSheet.
   */
  const [pendingCaptureMode, setPendingCaptureMode] = useState<CaptureMode | null>(null);
  // ENG-22: the ONE seam every capture entry goes through (bar, bell nudge,
  // deep link) — so `capture_started` is emitted once, here, and a new entry
  // point is instrumented the day it is written. Mode id only, never content.
  const requestCapture = (mode: CaptureMode) => {
    trackCaptureStarted(mode);
    setPendingCaptureMode(mode);
  };
  const consumeCaptureRequest = () => setPendingCaptureMode(null);

  /**
   * Evidence deep-link hand-off (TODAY-6 / AR-CAP-03): a surface that cites a
   * specific logged moment (ProgressNarrative's evidence rows) names the
   * timeline signal id it cited, and the Journal scrolls to + highlights
   * exactly that row, then clears the request. Mirrors the capture seam above.
   * CLINICAL FIREWALL: the request carries ONLY the ledger signal id — never a
   * derived score, verdict, or any other payload.
   */
  const [pendingJournalFocusId, setPendingJournalFocusId] = useState<string | null>(null);
  const requestJournalFocus = (signalId: string) => { setPendingJournalFilter(null); setPendingJournalFocusId(signalId); };
  const consumeJournalFocus = () => setPendingJournalFocusId(null);
  // B-ASKJB-23: selecting the Journal record is a consume-once handoff.
  // A newer filter request replaces a stale row focus, and vice versa.
  const [pendingJournalFilter, setPendingJournalFilter] = useState<JournalFilter | null>(null);
  const requestJournalFilter = (filter: JournalFilter) => { setPendingJournalFocusId(null); setPendingJournalFilter(filter); };
  const consumeJournalFilter = () => setPendingJournalFilter(null);

  /**
   * AIX-S3 — handoff-note → Consult composer prefill seam (mirrors the
   * capture seam above). Born for ArborVision (deleted 2026-10-09); today a
   * coach answer's teacher note (CoachTab onAddToHandoff) threads here and
   * the Consult flow (AskSpecialist) consumes it
   * into a PARENT-EDITABLE note field. Prefill is NOT consent: nothing is
   * shared or sent without the existing explicit consult act (copy / download
   * / export / send), all of which stay behind the reviewed-checkbox gate.
   */
  //
  // B-CAREPRO-13 — ONE seam carries all four fields a caller can know: the
  // reason for the visit (the reason box), a parent-editable note, the
  // audience the packet is for, and a professional preset for the PDF menu.
  // Callers: Coach teacher note (note + audience "teacher"), Vision handoff
  // (note), Screening elevated (reason), Safety ticked signs (reason). Every
  // field lands EDITABLE; the reviewed-checkbox gate still guards every export.
  const [pendingConsultPrefill, setPendingConsultPrefill] = useState<ConsultPrefill | null>(null);
  const requestConsultPrefill = (prefill: ConsultPrefill) => setPendingConsultPrefill(prefill);
  const consumeConsultPrefill = () => setPendingConsultPrefill(null);

  /**
   * LL — Learn Library deep-link seam (mirrors the capture seam above). Any
   * surface can hand the parent to one specific read (cardId) or one shelf
   * (category); the Library consumes and clears the request on mount. Carries
   * ONLY a catalogue reference — never child data, never a derived verdict.
   * `source` tags provenance for telemetry.
   */
  const [pendingLearnRequest, setPendingLearnRequest] = useState<
    { cardId?: string; category?: string } | null
  >(null);
  const requestLearnRead = (req: { cardId?: string; category?: string; source?: string }) => {
    setPendingLearnRequest({ cardId: req.cardId, category: req.category });
    setActiveTab("learn");
    try { track("learn_deep_link", { source: req.source ?? "unknown" }); } catch { /* noop */ }
  };
  const consumeLearnRequest = () => setPendingLearnRequest(null);

  /**
   * The single seam for handing a prompt to Ask Arbor from anywhere in the app.
   * Historically 18+ surfaces hand-rolled the same `setChatInput(...) +
   * (setSelectedLens(...)) + setActiveTab("coach")` triple; that sprawl had no
   * lens coordination and no provenance. Route every external coach entry point
   * through here instead. `lens` is optional (a caller that wants to steer the
   * scholar frame passes one; callers that respect the parent's current lens
   * omit it). `source` tags where the seed came from for telemetry.
   */
  const seedCoach = (opts: { prompt?: string; lens?: string; source?: string }) => {
    if (activeConversationId && conversationTopicRef.current !== activeFamilyTopic?.id) newConversation();
    if (opts.prompt !== undefined) setChatInput(current => current.trim() && current.trim() !== opts.prompt?.trim() ? `${current}\n\n${opts.prompt}` : opts.prompt ?? current);
    if (opts.lens) setSelectedLens(opts.lens);
    requestCompanionConversation({ source: opts.source });
    try { track("coach_seed", { source: opts.source ?? "unknown" }); } catch { /* noop */ }
  };

  /**
   * AI-CAP-7 — post-confirm coach handoff. A gated capture confirm (BehaviorsTab
   * confirmReview / QuickLogModal confirm) may offer ONE dismissible, non-blocking
   * "want a next step?" CTA built from the just-confirmed log. Contract: never
   * auto-send (accept only PREFILLS the composer via the seedCoach seam, source
   * 'post-capture'), shown once per confirm (each confirm replaces the offer),
   * dismiss leaves no residue, and NOTHING here touches the behavior-log write
   * path. The offer carries only the prompt string — no scores, no verdicts.
   */
  const [postCaptureCoachPrompt, setPostCaptureCoachPrompt] = useState<string | null>(null);
  const offerPostCaptureCoach = (prompt: string) => setPostCaptureCoachPrompt(prompt);
  const dismissPostCaptureCoach = () => setPostCaptureCoachPrompt(null);
  const acceptPostCaptureCoach = () => {
    if (!postCaptureCoachPrompt) return;
    // Prefill only — the parent still presses send themselves.
    seedCoach({ prompt: postCaptureCoachPrompt, source: "post-capture" });
    setPostCaptureCoachPrompt(null);
  };
  // App Core States — persisted per child (Firestore when authed, localStorage in sandbox)
  const logsCol = useChildCollection<BehaviorLog>(childProfile.id, "behaviorLogs", {
    sandboxSeed: demoSeed.logs,
    orderByField: "timestamp",
    orderDir: "desc",
    max: 300,
  });
  const milestonesCol = useChildCollection<Milestone>(childProfile.id, "milestones", {
    seed: initialMilestones,
    sandboxSeed: initialMilestones,
  });
  const plansCol = useChildCollection<ActionPlan>(childProfile.id, "actionPlans", { sandboxSeed: demoSeed.plans });
  // B-GROWTH-15: the words the parent wrote down (`langObs`) — only their
  // timestamps reach the coach, as the weekly wordsLoggedCount (never text).
  const langObsCol = useChildCollection<{ id: string; timestamp: string }>(childProfile.id, "langObs", {
    orderByField: "timestamp", orderDir: "desc", max: 200,
  });
  // c2 — Daily Play completions: a positive, synced "win" record (NOT a
  // BehaviorLog) that closes the moat loop into the Story timeline.
  const playLogCol = useChildCollection<PlayLog>(childProfile.id, "playLogs", {
    orderByField: "timestamp",
    orderDir: "desc",
    max: 200,
  });
  const actionLoopCol = useChildCollection<ActionLoopEntry>(childProfile.id, "actionLoops", {
    orderByField: "acceptedAt",
    orderDir: "desc",
    max: 100,
    trackConfirmation: true,
  });
  // Harbor voice proposals are an append/update audit ledger. Drafts remain
  // ephemeral in CoachTab; only an explicit parent confirmation creates a row.
  const conversationChangesCol = useChildCollection<ConversationChangeRecord>(childProfile.id, "conversationChanges", {
    orderByField: "confirmedAt", orderDir: "desc", max: 300,
  });
  // Learn Library bookmarks — stores the card id only (curated-content
  // reference, not a child fact; Child Memory is NOT the store for these).
  const savedLearnCol = useChildCollection<SavedLearnItem>(childProfile.id, "savedLearn", {
    orderByField: "savedAt",
    orderDir: "desc",
    max: 200,
  });

  // TJB-04: the Behaviors "Analyze" synthesis + the parent's kept lines live in
  // the per-child `insights` subcollection (registered in CHILD_SUBCOLLECTIONS,
  // so GDPR export/erasure already cover it). Ordered by createdAt, which the
  // useTodaysFocus `todaysFocus` doc in the same collection does not carry —
  // that doc therefore never enters this list.
  const insightsCol = useChildCollection<InsightRecord>(childProfile.id, "insights", {
    orderByField: "createdAt",
    orderDir: "desc",
    max: 60,
  });

  const savedLearnIds = useMemo(() => savedLearnCol.items.map((s) => s.id), [savedLearnCol.items]);
  const toggleSavedLearn = (cardId: string) => {
    if (savedLearnCol.items.some((s) => s.id === cardId)) {
      void savedLearnCol.remove(cardId);
    } else {
      void savedLearnCol.upsert({ id: cardId, savedAt: new Date().toISOString() });
    }
    try { track("learn_save_toggle", { card: cardId }); } catch { /* noop */ }
  };

  const behaviorLogs = useMemo(
    () => [...logsCol.items].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)),
    [logsCol.items]
  );
  // B-LOOP-01 follow-up: retired catalogue ids (m-1…m-10) are dropped on
  // READ (never written, never deleted) — context/milestoneHydration.ts.
  const milestones = useMemo(() => hydrateMilestones(milestonesCol.items, initialMilestones), [milestonesCol.items]);
  const actionPlans = useMemo(() => {
    const ts = (id: string) => {
      const m = /(\d{10,})/.exec(id);
      return m ? Number(m[1]) : 0;
    };
    return [...plansCol.items].sort((a, b) => ts(b.id) - ts(a.id));
  }, [plansCol.items]);

  // c2 — single source of truth for Daily Play completions. Both Today and
  // Grow read `donePlayIds`; both write through `logPlayCompletion`.
  const playLogs = useMemo(
    () => [...playLogCol.items].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)),
    [playLogCol.items]
  );
  const donePlayIds = useMemo(() => playLogs.map((p) => p.activityId), [playLogs]);
  const actionLoop = useMemo(() => sortActionLoop(actionLoopCol.items.filter((entry) => !isUrgentOnboardingAction(entry))), [actionLoopCol.items]);
  const activeTodayAction = useMemo(
    () => activeActionFor(actionLoop, todayActionId(childProfile.id)),
    [actionLoop, childProfile.id]
  );
  // AIX-S6: `source` carries provenance — "today-guidance" (default) or
  // "digest" (the weekly digest's AI-generated tryThisWeek text). Callers own
  // the TODAY-1 guard: only model-generated focus text may reach this seam.
  // B-AI-05: an accept never overwrites a row (a completed outcome survives;
  // the new row takes a `.{n}` id); only TODAY's unrated step becomes
  // `superseded` — a previous day's unrated step stays the carry-over question
  // until rated or MAX_CARRY_DAYS pass (framer ruling, 1 Oct).
  // B-ASKJB-26: a plan step passes its PlanStepRef, stored on the row, so its
  // outcome moves that step (recordTodayOutcome below).
  // All surfaces share ownership of acceptance, even when Family stays mounted
  // behind the global Ask panel. The stable collection writer is child/auth
  // scoped; retire its requests synchronously when that identity changes.
  const acceptScopeRef = useRef({ writer: actionLoopCol.upsert, sequence: 0 });
  if (acceptScopeRef.current.writer !== actionLoopCol.upsert) acceptScopeRef.current = { writer: actionLoopCol.upsert, sequence: 0 };
  const acceptScope = acceptScopeRef.current;
  // B-STATUS-01: receipt callers opt in to acknowledgement of every write;
  // existing callers retain queued-write behaviour. The newest explicit choice
  // owns every unissued continuation. Already-issued writes are not rolled back;
  // this remains non-atomic and does not serialize work across browser tabs.
  const acceptTodayAction = (recommendation: string, capacity: ActionCapacity, source: ActionLoopEntry["source"] = "today-guidance", planStep?: PlanStepRef, options?: { awaitServer?: boolean; isCurrent?: () => boolean }) => {
    const operation = (async () => {
      const inScope = () => acceptScopeRef.current === acceptScope && options?.isCurrent?.() !== false;
      // A captured stale callback must not steal ownership from the live scope.
      if (!inScope()) throw new Error("The action request is no longer current");
      const sequence = ++acceptScope.sequence;
      const assertCurrent = () => {
        if (!inScope() || acceptScope.sequence !== sequence) throw new Error("The action request is no longer current");
      };
      // Lifetime checks belong here, never in the persisted collection payload.
      const { isCurrent: _isCurrent, ...writeOptions } = options ?? {};
      // The ledger as stored (urgent first-run rows included): the accept seam
      // supersedes or skips past a hidden row instead of reusing its id.
      await persistAcceptedTodayAction({ childId: childProfile.id, items: actionLoopCol.items,
        upsert: item => {
          assertCurrent();
          return actionLoopCol.upsert(item, options ? writeOptions : undefined);
        }, recommendation, capacity, source,
        ...(planStep ? { planStep } : {}), ...(activeFamilyTopic ? { topicId: activeFamilyTopic.id } : {}) });
      assertCurrent();
      try { track("today_action_accepted", { capacity, source }); } catch { /* noop */ }
    })();
    // Coach/Plans/Learn/Weekly event callbacks may ignore the return value.
    // Observe that rejection, but return the SAME original Promise: awaiting
    // callers still reject and cannot turn a cancelled write into a Receipt.
    void operation.catch(() => {});
    return operation;
  };
  // B-TODAY-15: `via` = where the outcome was rated (the step card or the
  // carry-over ask); the event carries via + daysLate (ids/enums/counts only).
  // B-ASKJB-33: a hard-moment row also stores `held` (the two-tap ask).
  const saveTodayOutcome = async (id: string, outcome: ActionOutcome, via: TodayOutcomeVia = "card", held?: HeldAnswer, options?: { awaitServer?: boolean }) => {
    const item = actionLoop.find((entry) => entry.id === id);
    if (!item) throw new Error("The selected action is no longer available");
    if (isObservationAction(item)) throw new Error("Observations record a moment, not an efficacy outcome");
    await actionLoopCol.upsert({ ...item, status: "completed", outcome, outcomeAt: new Date().toISOString(), ...(held ? { held } : {}) }, options);
    // B-ASKJB-26: a plan step's outcome moves the step — helped → done (the
    // next step becomes today's), somewhat → in progress (kept, next offered),
    // not_today → unchanged (tomorrow's step).
    if (item.source === "plan" && item.planId && item.phaseIdx !== undefined && item.stepIdx !== undefined) {
      const next = planStepStatusAfter(outcome);
      if (next) setPlanStepStatus(item.planId, item.phaseIdx, item.stepIdx, next);
    }
    try { track("today_action_outcome", todayOutcomeProps({ outcome, capacity: item.capacity, via, acceptedAt: item.acceptedAt })); } catch { /* noop */ }
  };
  /** Reuse the same child-scoped action ledger and strict receipt barrier.
   * The caller pins its visible question while an optimistic snapshot changes. */
  const observationAcceptSequence = acceptScope.sequence;
  const observationLifetime = captureOnboardingLifetime?.(childProfile.id);
  const saveTodayObservation = async (id: string, words: string, options?: { isCurrent?: () => boolean }) => {
    const assertCurrent = () => {
      if (acceptScopeRef.current !== acceptScope || acceptScope.sequence !== observationAcceptSequence || observationLifetime?.() === false || options?.isCurrent?.() === false) throw new Error("The observation request is no longer current");
    };
    assertCurrent();
    const item = actionLoop.find(entry => entry.id === id);
    if (!item) throw new Error("The selected observation is no longer available");
    const completed = completeObservation(item, words);
    await actionLoopCol.upsert(completed, { awaitServer: true });
    assertCurrent();
    return completed;
  };
  const recordTodayOutcome = (...args: Parameters<typeof saveTodayOutcome>) => {
    void saveTodayOutcome(...args).catch(() => toast(t("companion.arbor-context.your-response-wasn-t-saved-please-try-agai"), "error"));
  };
  const removeTodayAction = (id: string) => void actionLoopCol.remove(id);
  /** B-LOOP-09 — "Did it" / "Not today" on today's practice: ONE dose row per
   *  day on the actionLoops ledger (lib/practice/choosePractice). No streak,
   *  no count is derived from it on Today. */
  const recordPracticeDose = (entry: ActionLoopEntry) => {
    if (entry.source !== "practice") return;
    void actionLoopCol.upsert({ ...entry, ...(activeFamilyTopic ? { topicId: activeFamilyTopic.id } : {}) });
    try { track("practice_dose", { answer: entry.outcome === "not_today" ? "not_today" : "did" }); } catch { /* noop */ }
  };
  // B-ASKJB-33 — the second tap ("And {name}? Calmer · Same · Harder"):
  // stored on the same row for the visit packet; never feeds "last time".
  const recordChildResponse = (id: string, childResponse: ChildResponse) => {
    const item = actionLoop.find((entry) => entry.id === id);
    if (!item) return;
    void actionLoopCol.upsert({ ...item, childResponse });
    try { track("hard_moment_child_response", { response: childResponse }); } catch { /* noop */ }
  };
  // B-TODAY-28 — Today's "From your record" answer: ONE row on the same
  // actionLoops ledger (source "from-record", the parent's reflection), never
  // a new collection. ids/enums only in the event.
  const [recordAnswerWrites, setRecordAnswerWrites] = useState<Record<string, { opener: FromRecordOpener; status: "saving" | "failed" | "saved"; entry?: ActionLoopEntry }>>({});
  const recordWritesRef = useRef(new Map<string, Promise<ActionLoopEntry> | null>());
  const recordFromRecordAnswer = (opener: FromRecordOpener, answer: FromRecordAnswer, at = new Date()): Promise<ActionLoopEntry> => {
    if (currentChildRef.current !== childProfile.id) return Promise.reject(new Error("The active child changed"));
    const key = fromRecordRowId(childProfile.id, at);
    const pending = recordWritesRef.current.get(key);
    if (pending) return pending;
    if (!recordWritesRef.current.has(key) && !actionLoopCol.confirmed) return Promise.reject(new Error("The answer ledger is not confirmed yet"));
    const saved = answeredToday(actionLoop, childProfile.id, at);
    if (saved && !recordWritesRef.current.has(key)) return Promise.resolve(saved);
    const entry = fromRecordEntry(opener, answer, childProfile.id, at);
    setRecordAnswerWrites(rows => ({ ...rows, [key]: { opener, status: "saving" } }));
    const write = actionLoopCol.upsert(entry, { awaitServer: true })
      .then(() => {
        try { track("today_record_answer", { kind: opener.kind, answer }); } catch { /* noop */ }
        setRecordAnswerWrites(rows => ({ ...rows, [key]: { opener, status: "saved", entry } }));
        return entry;
      })
      .catch((error: unknown) => {
        recordWritesRef.current.set(key, null);
        setRecordAnswerWrites(rows => ({ ...rows, [key]: { opener, status: "failed" } }));
        throw error;
      });
    // Keep a resolved same-day promise too: late repeated taps cannot replace
    // the first answer while the collection snapshot catches up.
    recordWritesRef.current.set(key, write);
    return write;
  };
  // B-ASKJB-31 — the ONE "Hard moment now" sheet (mounted once in Shell).
  // Doors: Ask's fast-start chip, a Behaviors shelf card (opens on that card),
  // Today's capture-bar tile (B-TODAY-10). `askHardMomentRef` is the card the
  // sheet hands to Ask as a reference card above the composer — display only,
  // never written into a prompt (clinical veto).
  const [hardMomentNow, setHardMomentNow] = useState<{ open: boolean; cardId?: string }>({ open: false });
  const openHardMomentNow = (cardId?: string) => setHardMomentNow({ open: true, ...(cardId ? { cardId } : {}) });
  const closeHardMomentNow = () => setHardMomentNow({ open: false });
  const [askHardMomentRef, setAskHardMomentRef] = useState<string | null>(null);
  // B-GROWTH-19 — every Daily Play "We did this" path writes through here:
  // a ranked pick (ScoredActivity, carries its reason) OR a bare course step
  // (PlayActivity + the course id it was ticked in; reason "stage-match").
  const logPlayCompletion = (a: ScoredActivity | PlayActivity, source: PlayLog["source"], courseId?: string) => {
    const activity = "activity" in a ? a.activity : a;
    const reason: PlayLog["reason"] = "activity" in a ? a.reason : "stage-match";
    const day = dayKey(new Date());
    const id = `${activity.id}.${day}`;
    // Idempotent per activity per day: skip the loop event on a repeat tap.
    const alreadyDone = playLogCol.items.some((p) => p.id === id);
    const rec: PlayLog = {
      id,
      activityId: activity.id,
      title: activity.title,
      domain: activity.domain,
      reason,
      source,
      ...(courseId ? { courseId } : {}),
      timestamp: new Date().toISOString(),
    };
    void playLogCol.upsert(rec); // fire-and-forget, optimistic + local-first
    if (!alreadyDone) trackPlayCompleted(activity.domain, reason, source);
  };

  // Active Interactive / Selection States
  const [selectedLens, setSelectedLens] = useState<string>(() => readLS("arbor.lens") || "Integrated Balanced");
  // Onboarding → coach seeding: OnboardingFlow (which renders outside this
  // provider) leaves the parent's "what's on your mind" concern in the journey
  // store (lib/onboardingJourney); the coach composer starts pre-filled with it
  // on the very first session. takeCoachSeed() is read-once-and-clear.
  const [chatInput, setChatInput] = useState<string>(() => takeCoachSeed() ?? "");
  const [storedChatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatChildId, setChatChildId] = useState(childProfile.id);
  const currentChildRef = useRef(childProfile.id);
  currentChildRef.current = childProfile.id;
  const chatMessages = chatChildId === childProfile.id ? storedChatMessages : [];
  // Multi-thread coach conversations (persisted per child).
  const conversationsCol = useChildCollection<Conversation>(childProfile.id, "conversations");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversationRevision, setConversationRevision] = useState(0);
  const conversationTopicRef = useRef<string | undefined>(undefined);
  const conversations = useMemo(
    () => [...conversationsCol.items].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [conversationsCol.items]
  );
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [chatStreamStatus, setChatStreamStatus] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  // AI-06: the STATUS, kept beside the message. Without it the coach called
  // classifyAiFailure(null) and a 429 (quota, waiting helps) and a 451
  // (your permission is needed, waiting never helps) rendered one identical
  // sentence with a Retry button. The raw message is still never rendered.
  const [apiErrorStatus, setApiErrorStatus] = useState<number | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);

  // MON-2 paywall: a 402 (PaywallError) opens an inline upgrade prompt instead
  // of surfacing as an error. Tracks which feature was hit + the suggested plan.
  const [paywall, setPaywall] = useState<{ open: boolean; feature?: string; suggestedPlan?: "plus" | "family" }>({ open: false });
  // B-KID-32 (KC-21): a paywall is a PARENT moment. While Kid Mode is open a
  // 402 from a kid surface opens nothing — and nothing is queued for the
  // parent's exit (the modal used to pop up after the grown-up unlocked).
  const openPaywall = (feature?: string, suggestedPlan?: "plus" | "family") => {
    if (isKidModeActive()) return;
    setPaywall({ open: true, feature, suggestedPlan });
  };
  const closePaywall = () => setPaywall((p) => ({ ...p, open: false }));

  // Form states: Log Behavior
  const [newLogType, setNewLogType] = useState<string>("Transition Refusal");
  const [newLogIntensity, setNewLogIntensity] = useState<number>(3);
  const [newLogDuration, setNewLogDuration] = useState<number>(15);
  const [newLogTrigger, setNewLogTrigger] = useState<string>("");
  const [newLogResponse, setNewLogResponse] = useState<string>("");
  const [newLogNotes, setNewLogNotes] = useState<string>("");
  const [newLogContext, setNewLogContext] = useState<BehaviorContext | "">("");
  const [newLogPhoto, setNewLogPhoto] = useState<string>("");
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // Form states: Generated Action Plan
  const [planChallengeTopic, setPlanChallengeTopic] = useState<string>(
    "Screen time tantrums when tablet is turned off"
  );
  const [isPlanGenerating, setIsPlanGenerating] = useState<boolean>(false);

  // Form states: Behavior Analysis
  const [behaviorAnalysis, setBehaviorAnalysis] = useState<BehaviorAnalysis | null>(null);
  const [isAnalyzingBehavior, setIsAnalyzingBehavior] = useState<boolean>(false);

  const [memoryReviewState, setMemoryReviewState] = useState<{ childId: string; items: MemoryReviewItem[] }>({ childId: childProfile.id, items: [] });
  const memoryReviewItems = memoryReviewState.childId === childProfile.id ? memoryReviewState.items : [];
  const memoryScopeRef = useRef({ childId: childProfile.id });
  if (memoryScopeRef.current.childId !== childProfile.id) memoryScopeRef.current = { childId: childProfile.id };
  const memoryRequestRef = useRef(0);
  const [memoryLoadedChildId, setMemoryLoadedChildId] = useState<string | null>(null);
  const memoryReviewLoaded = memoryLoadedChildId === childProfile.id;
  const setMemoryReviewItems = (items: MemoryReviewItem[]) => setMemoryReviewState({ childId: childProfile.id, items });
  const [isMemoryUpdating, setIsMemoryUpdating] = useState<string | null>(null);
  // OWN-1: true while the last memory-review ledger read failed. Surfaces the
  // failure (Child Memory renders an error + retry card, the coach footer's
  // review invite degrades) instead of the old console.warn swallow, which
  // left the surface silently empty — indistinguishable from "no memory yet".
  const [memoryReviewError, setMemoryReviewError] = useState<boolean>(false);
  // OBJ-PROFILE-04: WHY the ledger is unreadable, not just that it is. A 429 is
  // a rate limit, and telling a parent "something interrupted the connection"
  // sends them to check their wifi over a problem on our side.
  const [memoryReviewErrorKind, setMemoryReviewErrorKind] = useState<MemoryReadFailure | null>(null);

  // Embedded Interactive AI States and Helpers
  const [milestoneAnalysisOfGaps, setMilestoneAnalysisOfGaps] = useState<ExplainAnswer | null>(null);
  const [isAnalyzingMilestones, setIsAnalyzingMilestones] = useState<boolean>(false);
  const [inlineCoRegulationScripts, setInlineCoRegulationScripts] = useState<{ [logId: string]: ExplainAnswer }>({});
  const [isGeneratingInlineScript, setIsGeneratingInlineScript] = useState<{ [logId: string]: boolean }>({});

  /**
   * Wave-T (lane A): the two inline explainers — the per-log co-regulation
   * script and the milestone scaffold — used to POST hand-written prompts to
   * /api/chat, the heaviest route in the app, burning the coach meter on
   * ambient cards. They now call the dedicated explain route:
   *   body    { childProfile, subject, details?, language }
   *   returns { explanation, tryToday, text }
   * The STRUCTURED fields are rendered (explanation, then one step in its own
   * framed block); the joined `text` is never used. This adapter is the ONLY
   * client seam for the route.
   *
   * AI-17: both explainers now STORE these two fields rather than flattening
   * them into markdown here. The string form is derived at the two places that
   * genuinely need a string — one-tap keep, and seeding a coach thread — via
   * explainAnswerText, which reproduces the old markdown byte for byte.
   */
  const explainViaApi = async (payload: { subject: string; details?: string }): Promise<ExplainAnswer> => {
    const res = await fetch("/api/explain", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        childProfile,
        subject: payload.subject,
        details: payload.details,
        language: getAiLanguage(),
      }),
    });
    if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Request failed (${res.status})`);
    const data = await res.json();
    return {
      explanation: String(data?.explanation ?? "").trim(),
      tryToday: String(data?.tryToday ?? "").trim(),
    };
  };
  /** A failed explainer answer travels through the SAME slot as a good one, so
   *  the notice still reaches MarkdownBlock and its helpline numbers stay
   *  tappable. It carries no step, so no block invites the parent to act. */
  const explainFailure = (message: string): ExplainAnswer =>
    ({ explanation: renderApiConnectionError(message), tryToday: "" });

  const handleGetInlineCoRegulationScript = async (log: BehaviorLog) => {
    setIsGeneratingInlineScript((prev) => ({ ...prev, [log.id]: true }));
    try {
      const result = await explainViaApi({
        subject: `A co-regulation script for this logged moment (${log.behaviorType})`,
        details: `Duration: ${log.durationMinutes} mins.${typeof log.intensity === "number" ? ` Intensity: ${log.intensity}/5.` : ""} Trigger: ${log.trigger}. What the parent tried: ${log.response || "not recorded"}.`,
      });
      setInlineCoRegulationScripts((prev) => ({ ...prev, [log.id]: result }));
    } catch (err: any) {
      setInlineCoRegulationScripts((prev) => ({
        ...prev,
        [log.id]: explainFailure(err?.message),
      }));
    } finally {
      setIsGeneratingInlineScript((prev) => ({ ...prev, [log.id]: false }));
    }
  };

  const handleGenerateMilestoneScaffold = async () => {
    setIsAnalyzingMilestones(true);
    try {
      const checkedList = milestones
        .filter((m) => m.checked)
        .map((m) => `- ${m.title} (${m.domain})`)
        .join("\n");
      const uncheckedList = milestones
        .filter((m) => !m.checked)
        .map((m) => `- ${m.title} (${m.domain}): ${m.description}`)
        .join("\n");
      const result = await explainViaApi({
        subject: "How to scaffold the next milestones through daily play (Vygotskian scaffolding)",
        details: `Milestones already noticed:\n${checkedList || "None"}\n\nNot yet noticed:\n${uncheckedList || "None"}`,
      });
      setMilestoneAnalysisOfGaps(result);
    } catch (err: any) {
      setMilestoneAnalysisOfGaps(explainFailure(err?.message));
    } finally {
      setIsAnalyzingMilestones(false);
    }
  };

  // B-ASKJB-23: retain the three situation starters without fabricating
  // observations. Choosing one changes classification only; the parent's
  // words, notes, intensity and duration remain their own editable inputs.
  const autofillLogTemplate = (type: "morning" | "screen" | "sibling") => {
    const types = { morning: "Transition Refusal", screen: "Screentime Dispute", sibling: "Sibling Conflict" };
    setNewLogType(types[type]);
  };

  // Auto Scroll Chat
  const chatBottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const anchor = chatBottomRef.current;
    const pane = anchor?.closest<HTMLElement>("[data-companion-scroll]");
    if (pane) {
      const latest = chatMessages[chatMessages.length - 1];
      const messages = pane.querySelectorAll<HTMLElement>('[data-companion-message="ai"]');
      const answer = messages[messages.length - 1];
      // Keep every ancestor still. A settled report starts at its explanation,
      // while incoming sentences follow the growing response inside this pane.
      pane.scrollTo({ top: !isChatLoading && latest?.contract && answer ? answer.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop - 12 : pane.scrollHeight, behavior: "auto" });
    } else anchor?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatLoading]);

  // Start a fresh (unsaved) conversation when the active child changes.
  const loadedChatChild = useRef<string | null>(null);
  useEffect(() => {
    if (loadedChatChild.current === childProfile.id) return;
    loadedChatChild.current = childProfile.id;
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    conversationTopicRef.current = undefined;
    setChatChildId(childProfile.id);
    setChatInput("");
    setIsChatLoading(false);
    setChatStreamStatus(null);
    setApiError(null);
    setActiveConversationId(null);
    setChatMessages([]);
  }, [childProfile.id]);

  // Persist the active conversation (once it has real content — ASK-7/ASK-8:
  // "real" means the parent actually asked something; ack-only or error-only
  // states never reach Firestore because no error bubbles are appended and a
  // thread without a user turn is skipped here).
  useEffect(() => {
    if (!activeConversationId || !hasUserTurn(chatMessages)) return;
    const firstUser = chatMessages.find((m) => m.sender === "user");
    // ASK-5: the title derives from what the parent SAW (displayText for a
    // tapped localized chip) — canonical text otherwise, same derivation.
    const title = (firstUser ? firstUser.displayText || firstUser.text : "Conversation").replace(/[#*]/g, "").trim().slice(0, 48) || "Conversation";
    void conversationsCol.upsert({
      id: activeConversationId,
      ...(conversationTopicRef.current ? { topicId: conversationTopicRef.current } : {}),
      title,
      messages: chatMessages.slice(-30),
      updatedAt: new Date().toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages, activeConversationId]);

  // COACH-2: the browser voice loop writes its transcript through the SAME
  // conversation persistence as typed chat (the upsert effect above) — the
  // dictated user turn and the streaming, SAFE-V1-screened AI reply land in
  // chatMessages, so a voice session survives a conversation switch. No new
  // capture path: this is the existing chat-message write seam.
  const appendVoiceUserTurn = (text: string) => {
    if (!text.trim()) return;
    prepareTopicConversation();
    setChatMessages((prev) => appendVoiceUser(prev, text, selectedLens));
  };
  const appendVoiceAiDelta = (delta: string) => {
    setChatMessages((prev) => applyVoiceDelta(prev, delta, selectedLens));
  };
  const finalizeVoiceAiTurn = () => {
    setChatMessages((prev) => settleVoiceTurn(prev));
  };

  // Coach conversation thread controls.
  const newConversation = () => {
    setConversationRevision(value => value + 1);
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    setIsChatLoading(false);
    conversationTopicRef.current = undefined;
    setActiveConversationId(null);
    setChatMessages([]);
    setChatInput("");
    setApiError(null);
    setChatStreamStatus(null);
  };
  // Explicit topic choices end the current thread. Opening history below uses
  // the raw selector so the saved conversation remains readable as recorded.
  const selectFamilyTopic = (id: string | null) => {
    if (id && !topicState.familyTopics.some(topic => topic.id === id)) return;
    if ((activeFamilyTopic?.id ?? null) !== id) newConversation();
    topicState.selectFamilyTopic(id);
  };
  const createFamilyTopic = async (...args: Parameters<typeof topicState.createFamilyTopic>) => {
    const topic = await topicState.createFamilyTopic(...args);
    if (currentChildRef.current === childProfile.id) newConversation();
    return topic;
  };
  const updateFamilyTopic = async (...args: Parameters<typeof topicState.updateFamilyTopic>) => {
    await topicState.updateFamilyTopic(...args);
    if (currentChildRef.current === childProfile.id && args[1].status === "archived" && activeFamilyTopic?.id === args[0]) newConversation();
  };
  const prepareTopicConversation = () => {
    const next = threadForTopic({ id: activeConversationId, topicId: conversationTopicRef.current, messages: chatMessages }, activeFamilyTopic?.id);
    if (!next.id) {
      if (activeConversationId || chatMessages.length) newConversation();
      conversationTopicRef.current = next.topicId;
      setActiveConversationId(`conv-${crypto.randomUUID()}`);
    }
    return next.messages;
  };
  const openConversation = (id: string) => {
    const c = conversationsCol.items.find((x) => x.id === id);
    if (!c) return;
    setConversationRevision(value => value + 1);
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    setIsChatLoading(false);
    setChatInput("");
    setApiError(null);
    setChatStreamStatus(null);
    conversationTopicRef.current = c.topicId;
    topicState.selectFamilyTopic(topicState.familyTopics.some(topic => topic.id === c.topicId) ? c.topicId! : null);
    setActiveConversationId(id);
    setChatMessages(c.messages);
  };
  const deleteConversation = (id: string) => {
    void conversationsCol.remove(id);
    if (id === activeConversationId) newConversation();
  };

  // IA-1: keep the URL hash in sync with the active view, and respond to
  // back/forward by reading the hash.
  useEffect(() => {
    // LEAK-3 companion: browser back/forward must not rotate parent tab state
    // while the kid overlay is up (same wall as the gated setActiveTab).
    const landOnFallback = () => {
      setActiveTabState(FALLBACK_ROUTE);
      try { window.history.replaceState(null, "", `#/${FALLBACK_ROUTE}`); } catch { /* noop */ }
      toast(t("elev.nav.linkMoved"), "info");
    };
    const onHash = () => {
      if (isKidModeActive()) return;
      const res = resolveHash(window.location.hash, null);
      if (res.unknown) { landOnFallback(); return; }
      if (window.location.hash) setActiveTabState(res.tab);
    };
    if (typeof window !== "undefined") {
      if (!window.location.hash) { try { window.history.replaceState(null, "", `#/${activeTab}`); } catch { /* noop */ } }
      // IA-13: the first load carried an unknown hash. The URL is corrected in
      // place (replaceState, so Back still leaves the app) and said once.
      else if (unknownHashRef.current) { unknownHashRef.current = false; landOnFallback(); }
      window.addEventListener("hashchange", onHash);
    }
    return () => { if (typeof window !== "undefined") window.removeEventListener("hashchange", onHash); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist UI preferences.
  useEffect(() => writeLS("arbor.activeTab", activeTab), [activeTab]);
  // B-SHELL-01: the static "how Arbor helps" rail is gone (trust moves to
  // per-answer provenance, the Ask lane's item); drop its stored flag once.
  useEffect(() => { try { localStorage.removeItem("arbor.aiRail"); } catch { /* ignore */ } }, []);
  useEffect(() => writeLS("arbor.lens", selectedLens), [selectedLens]);

  // Developmental COUNTS (never a score): windowed to the child's current CDC
  // band + one earlier (Wave T, GP-08) — the same window Growth, Milestones
  // and the Full Picture use, so Today never prints an all-ages denominator.
  const windowedMilestones = useMemo(() => {
    const chronoMonths = ageMonthsOf(childProfile);
    return ageWindowMilestones(milestones, comparisonAgeMonths(chronoMonths, childProfile.preterm?.gestationalWeeks));
  }, [milestones, childProfile]);
  const checkedMilestones = windowedMilestones.filter((m) => m.checked).length;
  const totalMilestones = windowedMilestones.length;
  const milestonesPercent = totalMilestones > 0 ? Math.round((checkedMilestones / totalMilestones) * 100) : 0;
  const pendingMemoryItems = memoryReviewItems.filter((item) => item.status === "pending");
  const approvedMemoryItems = memoryReviewItems.filter((item) => item.status === "approved");
  // UC-1 / B-SHELL-03: the Ask badge count = notes the coach surfaced that
  // still await the parent's review (the memory review queue). It is NOT a
  // count of unread messages. Never a fabricated "1".
  const pendingReviewCount = pendingMemoryItems.length;
  /** @deprecated alias of `pendingReviewCount` (B-SHELL-03), kept for readers. */
  const unreadCoachCount = pendingReviewCount;

  // --- HANDLERS: SERVER API CALLS ---

  const refreshMemoryReview = async () => {
    const scope = memoryScopeRef.current;
    const request = ++memoryRequestRef.current;
    const outcome = await pollMemoryReview({
      attempt: async () => {
        const res = await fetch(`/api/memory/${encodeURIComponent(childProfile.id)}`, {
          headers: await authHeaders(),
        });
        if (!res.ok) return { status: res.status };
        return { status: res.status, items: (await res.json()).items || [] };
      },
      alive: () => scope === memoryScopeRef.current && request === memoryRequestRef.current,
    });
    if (scope !== memoryScopeRef.current || request !== memoryRequestRef.current) return;
    setMemoryLoadedChildId(childProfile.id);
    if (!outcome.failure) {
      setMemoryReviewItems(outcome.items as MemoryReviewItem[]);
      setMemoryReviewError(false);
      setMemoryReviewErrorKind(null);
      return;
    }
    // ONE line per give-up, not one per attempt: the 65-error lane was the
    // absence of a ceiling, and a wall of identical warnings hides the rest.
    console.warn(`Could not load memory review items (${outcome.failure}, ${outcome.tries} tries)`);
    setMemoryReviewError(true);
    setMemoryReviewErrorKind(outcome.failure);
  };
  // OWN-1: parent-visible retry for a failed ledger read (Child Memory error card).
  const retryMemoryReview = () => {
    void refreshMemoryReview();
  };

  useEffect(() => {
    setMemoryReviewItems([]);
    setMemoryLoadedChildId(null);
    setMemoryReviewError(false);
    setMemoryReviewErrorKind(null);
    setIsMemoryUpdating(null);
    void refreshMemoryReview();
    return () => { memoryRequestRef.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childProfile.id]);

  // W2-CAREPRO c2 r1: resolves true ONLY when the server confirmed the write
  // (res.ok) — callers settle "Kept" on true, never on a swallowed failure.
  const handleMemoryDecision = async (memoryId: string, status: "approved" | "rejected" | "deleted"): Promise<boolean> => {
    const scope = memoryScopeRef.current;
    setIsMemoryUpdating(memoryId);
    try {
      const res = await fetch(`/api/memory/${encodeURIComponent(memoryId)}`, {
        method: "PATCH",
        headers: await authHeaders(),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Memory review update failed");
      const data = await res.json();
      if (scope !== memoryScopeRef.current) return false;
      setMemoryReviewItems(data.items || []);
      return true;
    } catch (err: any) {
      if (scope !== memoryScopeRef.current) return false;
      toast(t("ctx.toast.memoryReviewFailed"), "error");
      return false;
    } finally {
      if (scope === memoryScopeRef.current) setIsMemoryUpdating(null);
    }
  };

  // c1-rhythm: propose a PENDING, parent-owned memory from a Today surface.
  // Mirrors the fetch shape of refreshMemoryReview/handleMemoryDecision so the
  // native api-base shim + auth headers are reused. Throws on failure so the
  // caller (OverviewTab) can revert its button and toast honestly.
  const proposeMemory = async (
    fact: string,
    opts?: { source?: string; retention?: string; prompt?: string }
  ): Promise<void> => {
    const scope = memoryScopeRef.current;
    const res = await fetch(`/api/memory/${encodeURIComponent(childProfile.id)}/propose`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        fact,
        source: opts?.source ?? "rhythm",
        retention: opts?.retention ?? "3 months",
        prompt: opts?.prompt ?? "rhythm:pattern",
        familyId: (childProfile as any).familyId,
        childId: childProfile.id,
      }),
    });
    if (!res.ok) throw new Error("Memory proposal failed");
    const data = await res.json();
    if (scope !== memoryScopeRef.current) return;
    setMemoryReviewItems(data.items || []);
  };

  // ASK-1: map a server milestone stage key to its localized status line.
  const childFirstName = (childProfile.name || "").trim().split(/\s+/)[0] || "";
  const chatStageStatus = (stage: string): string => {
    if (stage === "memory") return t("coach.status.memory", { name: childFirstName });
    if (stage === "sources") return t("coach.status.sources");
    if (stage === "plan") return t("coach.status.plan");
    return t("coach.loading");
  };

  const readStreamingChatResponse = async (res: Response, isCurrent: () => boolean): Promise<ChatResponsePayload> => {
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Streaming response body unavailable");

    const decoder = new TextDecoder();
    let buffer = "";
    let finalPayload: ChatResponsePayload | null = null;

    const handleBlock = (block: string) => {
      if (!isCurrent()) return;
      if (!block.trim()) return;

      let eventName = "message";
      const dataLines: string[] = [];
      for (const rawLine of block.split("\n")) {
        const line = rawLine.trimEnd();
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
      if (dataLines.length === 0) return;

      const data = JSON.parse(dataLines.join("\n"));
      if (eventName === "status") {
        // ASK-1 Phase 1: the server sends honest milestone STAGE KEYS
        // (memory → sources → plan); the localized copy is owned here.
        setChatStreamStatus(chatStageStatus(String(data.stage || "")));
      } else if (eventName === "delta") {
        // ASK-1 Phase 2 / AIR-1: server-screened sentence delta — fold it
        // into the live bubble (the first one replaces the local ack copy).
        setChatMessages((prev) => applyChatDelta(prev, String(data.text || ""), selectedLens));
      } else if (eventName === "done") {
        finalPayload = data as ChatResponsePayload;
      } else if (eventName === "error") {
        throw new Error(data.details || data.error || "Streaming chat failed");
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let splitAt = buffer.indexOf("\n\n");
      while (splitAt !== -1) {
        handleBlock(buffer.slice(0, splitAt));
        buffer = buffer.slice(splitAt + 2);
        splitAt = buffer.indexOf("\n\n");
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) handleBlock(buffer);
    if (!finalPayload) throw new Error("Streaming chat ended without a final Arbor response");
    return finalPayload;
  };

  const readChatPayload = async (res: Response, isCurrent: () => boolean): Promise<ChatResponsePayload> => {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      return readStreamingChatResponse(res, isCurrent);
    }
    return await res.json();
  };

  const handleCancelChat = () => {
    setChatStreamStatus(t("coach.status.stopping"));
    chatAbortRef.current?.abort();
  };

  // Handle Parent Coach Chat. ASK-5: `opts.displayText` carries the localized
  // label the parent actually tapped (scenario / follow-up chip) — the bubble
  // shows their words while the canonical prompt goes to the model (the
  // approved hardMomentSurface pattern).
  const handleChatSend = async (customPrompt?: string, opts?: { displayText?: string; attachments?: ComposerAttachment[] }) => {
    let attachments: ComposerAttachment[];
    try { attachments = parseCompanionAttachments(opts?.attachments, childProfile.id); }
    catch { setApiError("Please attach these files again for the current child."); return false; }
    const promptValue = customPrompt || chatInput || (attachments.length ? (getAiLanguage() === "he" ? "מה אפשר להבין ממה שצירפתי, ומה אפשר לעשות יחד עכשיו?" : "Help me understand what I shared and suggest something we could try together.") : "");
    if (!promptValue.trim() || isChatLoading) return false;
    const topicThread = prepareTopicConversation();

    const sentDraft = !customPrompt ? chatInput : "";
    if (!customPrompt) setChatInput("");
    setApiError(null);
    setApiErrorStatus(null);
    setChatStreamStatus(t("coach.status.connecting"));


    // ASK-1: the user turn + an IMMEDIATE locally-rendered acknowledgment
    // bubble — the parent sees a response begin the moment they send, then the
    // first screened streamed sentence replaces the ack copy.
    // ASK-8: appendChatUser dedupes the retry path — after a failed turn the
    // thread already ends with this exact question, so Retry never re-appends.
    setChatMessages((prev) =>
      appendChatAck((() => {
        const next = appendChatUser(prev, promptValue, selectedLens, opts?.displayText);
        if (!attachments.length) return next;
        return [...next.slice(0, -1), { ...next[next.length - 1], attachments: attachmentMetadata(attachments) }];
      })(), t("coach.ack"), selectedLens),
    );
    setIsChatLoading(true);

    const controller = new AbortController();
    chatAbortRef.current = controller;
    const isCurrent = () => currentChildRef.current === childProfile.id && chatAbortRef.current === controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: await authHeaders({ Accept: "text/event-stream" }),
        signal: controller.signal,
        body: JSON.stringify({
          message: promptValue,
          childId: childProfile.id,
          ...(attachments.length ? { attachments } : {}),
          childProfile: childProfile,
          ...(activeFamilyTopic ? { topicId: activeFamilyTopic.id } : {}),
          scholarLens: selectedLens || "Integrated Balanced",
          language: getAiLanguage(),
          // LL-A9 — Learn Library grounding: attach the catalogue read that
          // matches this question (EN fields; the model localizes per the
          // language directive). Server sanitizes + caps; absent when no match.
          libraryContext: (() => {
            const match = matchLearnCards(LEARN_CARDS, {
              concerns: concernsForBehaviors([promptValue]),
              ageYears: ageYearsFromProfile(childProfile),
            }, 1)[0];
            // A batch-4 read ships under the editorial pilot, so the coach must
            // be told not to present it as clinician-approved — the same
            // disclosure the hard-moment seed carries. The flag is only set for
            // pilot cards, so every other request stays byte-identical (EVAL-6).
            return match
              ? {
                  id: match.id, title: match.title.en,
                  keyPoints: match.keyPoints.map((k) => k.en),
                  ...(isLearnPilotCard(match.id) ? { editorialPilot: true } : {}),
                }
              : undefined;
          })(),
          // Masterplan 1.3: same-thread continuity + consent-gated weekly counts.
          // `chatMessages` here is the PRE-append thread (setState hasn't flushed),
          // i.e. exactly the turns BEFORE the new question. Both fields are absent
          // when empty/off, keeping the request byte-identical to today's.
          ...buildChatContext({
            thread: topicThread,
            behaviorLogs,
            milestones,
            actionLoop,
            langObs: langObsCol.items,
            weeklyContextEnabled: readWeeklyContextConsent(childProfile.id),
            // B-LOOP-13 (coach_chat 1.7.0): today's practice — the day pin and
            // this child's dose rows (the server ledger wins when it has them).
            journal: buildJournalRequest({ childId: childProfile.id, dateKey: dayKey(new Date()), pinnedPracticeId: readTodayPin(childProfile.id), actionLoop }),
          }),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        if (!isCurrent()) return false;
        // MON-1: 402 = free-tier coach meter exhausted → render the Plus upsell
        // inline instead of an error.
        if (res.status === 402) {
          if (sentDraft) setChatInput(current => current.trim() ? current : sentDraft);
          openPaywall(errData?.upgrade?.feature || "coach_unlimited", errData?.upgrade?.plan === "family" ? "family" : "plus");
          // ASK-5: the meter bubble is localized like every other injected
          // message — never the server's English `details` string.
          setChatMessages((prev) => [
            ...abortChatStream(prev),
            { sender: "ai", text: `### ${t("coach.paywall.title")}\n${t("coach.paywall.body")}` },
          ]);
          return false;
        }
        // AI-06: throw the STATUS, not just a message. /chat is the one AI path
        // that used a raw fetch and a bare Error, so a 429 (quota) and a 451
        // (consent refused) both arrived at the coach statusless and collapsed
        // into a generic "try again" — offering a retry on a consent decision
        // the parent owns. lib/aiErrorCopy.ts classifies on status alone.
        throw new ApiError(
          errData.details || errData.error || "Server response failed",
          res.status,
          Number(res.headers.get("retry-after")) || undefined,
        );
      }

      const data = await readChatPayload(res, isCurrent);
      if (!isCurrent()) return false;
      // Attachment analysis deliberately returns no memory proposals; an empty
      // proposal payload must not erase the already loaded approved ledger.
      if (data.memoryReviewItems && !attachments.length) {
        setMemoryReviewItems(data.memoryReviewItems);
      }
      // ASK-1/AIR-1: settle the live bubble with the final payload. On a
      // done-time output-screen flag (payload.outputBlocked) this RETRACTS the
      // streamed prose and replaces it with the blocked/crisis markdown.
      setChatMessages((prev) => settleChatTurn(prev, data, selectedLens));
      track("coach_message", { lens: selectedLens });
      return true;
    } catch (err: any) {
      if (!isCurrent()) return false;
      if (err.name === "AbortError") {
        if (sentDraft) setChatInput(current => current.trim() ? current : sentDraft);
        // ASK-8: keep any screened partial prose (parity with the voice loop);
        // an ack-only bubble is dropped so no placeholder survives the stop.
        // No cancel bubble is appended — a stop is the parent's own action,
        // not a message from Arbor, and it must never persist into the thread.
        setChatMessages((prev) => abortChatStream(prev));
        return false;
      }
      // ASK-8: a failure surfaces as ONE calm role=alert retry card (CoachTab
      // renders t("coach.error") — never the raw err.message). No error bubble
      // is appended, so no Firestore/index/provider internals ever land in a
      // stressed parent's thread or in the persisted conversation.
      if (sentDraft) setChatInput(current => current.trim() ? current : sentDraft);
      setApiErrorStatus(err instanceof ApiError ? err.status : null);
      setApiError(err.message || "An exception occurred while connecting to Arbor services.");
      setChatMessages((prev) => abortChatStream(prev));
      return false;
    } finally {
      if (isCurrent()) {
        setIsChatLoading(false);
        setChatStreamStatus(null);
        chatAbortRef.current = null;
      }
    }
  };

  // SAGE-2: convene the multi-agent scholar council (non-streaming orchestration).
  // ASK-4: with an empty composer the council RE-ASKS the parent's last
  // question — its most natural moment is right after an answer, when
  // handleChatSend has already cleared chatInput; the old silent early-return
  // made the button a no-op exactly then. CoachTab disables the button (with
  // a hint) only when no prior user turn exists either.
  const handleCouncilSend = async (customPrompt?: string, opts?: { answerIndex?: number }) => {
    const eligibleThread = threadForTopic({ id: activeConversationId, topicId: conversationTopicRef.current, messages: chatMessages }, activeFamilyTopic?.id).messages;
    const continuation = councilConversation({ thread: eligibleThread, childId: childProfile.id, draft: chatInput, customPrompt, answerIndex: opts?.answerIndex });
    if (!continuation || isChatLoading) return;
    const promptValue = continuation.message;
    const sentDraft = continuation.consumesDraft ? chatInput : "";
    prepareTopicConversation();

    if (continuation.consumesDraft) setChatInput("");
    setApiError(null);
    setApiErrorStatus(null);
    setChatStreamStatus(t("coach.status.council"));

    // ASK-8: same retry-dedupe seam as handleChatSend — a council retry after
    // a failure reuses the trailing user question instead of duplicating it.
    // AI-07: the council streams and can be stopped, exactly like /chat. It used
    // to be one awaited api.council(...) — a silent spinner for the length of a
    // multi-agent orchestration, with no way out. It now takes the SAME ack
    // bubble → screened sentence deltas → settleChatTurn path, driven by the
    // same server-side relay, so the two answers cannot render or screen
    // differently. The controller goes in chatAbortRef, which is what the
    // existing Stop button already aborts — cancelling a council turn needed no
    // new affordance, only this wiring.
    setChatMessages((prev) =>
      appendChatAck(appendChatUser(prev, promptValue, selectedLens), t("coach.ack"), selectedLens),
    );
    setIsChatLoading(true);

    const controller = new AbortController();
    chatAbortRef.current = controller;
    const isCurrent = () => currentChildRef.current === childProfile.id && chatAbortRef.current === controller;

    try {
      const data = await streamCouncil(
        {
          message: promptValue,
          childProfile,
          ...(activeFamilyTopic ? { topicId: activeFamilyTopic.id } : {}),
          scholarLens: selectedLens || "Integrated Balanced",
          language: getAiLanguage(),
          ...(continuation.recentTurns ? { recentTurns: continuation.recentTurns, contextChildId: continuation.contextChildId } : {}),
        },
        (text) => { if (isCurrent()) setChatMessages((prev) => applyChatDelta(prev, text, selectedLens)); },
        {
          signal: controller.signal,
          onStatus: (stage) => { if (isCurrent()) setChatStreamStatus(chatStageStatus(stage)); },
        },
      );
      if (!isCurrent()) return;
      // Council deliberation creates no child facts and returns an empty queue.
      // Keep the authoritative memory read; this is not a ledger deletion.
      if (data.memoryReviewItems?.length) setMemoryReviewItems(data.memoryReviewItems);
      // The same settle seam as /chat — which is also the ONE place a done-time
      // output-screen flag retracts streamed prose. Appending a fresh bubble
      // here instead would leave the streamed text standing next to the
      // blocked replacement.
      setChatMessages((prev) => settleChatTurn(prev, data, selectedLens));
      track("coach_council", { lens: selectedLens, voices: data.council?.length || 0 });
    } catch (err: any) {
      if (!isCurrent()) return;
      if (sentDraft) setChatInput(current => current.trim() ? current : sentDraft);
      if (err.name === "AbortError") {
        // Parity with /chat: screened partial prose is kept, an ack-only bubble
        // is dropped, and no cancel message is written into the thread — a stop
        // is the parent's own action, not something Arbor says back to them.
        setChatMessages((prev) => abortChatStream(prev));
        return;
      }
      if (err instanceof PaywallError) {
        openPaywall(err.feature, err.plan);
      } else {
        // ASK-8: the calm retry card is the single error affordance — no
        // raw err.message bubble is appended to (or persisted with) the thread.
        setApiErrorStatus(err instanceof ApiError ? err.status : null);
        setApiError(err.message || "The scholar council could not be reached.");
      }
      // Whatever the failure, the live ack/partial bubble must not survive it.
      setChatMessages((prev) => abortChatStream(prev));
    } finally {
      if (isCurrent()) {
        setIsChatLoading(false);
        setChatStreamStatus(null);
        chatAbortRef.current = null;
      }
    }
  };

  // The Behaviors echo remembers only a newly saved row identity, never a
  // second draft. Its current record is read after save and disappears on Undo.
  const [lastSavedBehavior, setLastSavedBehavior] = useState<{ childId: string; id: string } | null>(null);

  const dismissBehaviorEcho = (id: string) => setLastSavedBehavior((previous) =>
    previous?.childId === childProfile.id && previous.id === id ? null : previous);

  // Add a Custom Behavior Log
  const captureScopeRef = useRef({ childId: childProfile.id });
  if (captureScopeRef.current.childId !== childProfile.id) captureScopeRef.current = { childId: childProfile.id };
  const captureScope = captureScopeRef.current;
  const currentCaptureDraftRef = useRef("");
  currentCaptureDraftRef.current = JSON.stringify([newLogType, newLogIntensity, newLogDuration, newLogTrigger, newLogResponse, newLogNotes, newLogContext, newLogPhoto, editingLogId]);
  const captureWritesRef = useRef(new Set<string>());
  const captureRevisionRef = useRef(0);
  const editingLogSnapshotRef = useRef<BehaviorLog | null>(null);
  const resetLogForm = () => {
    captureRevisionRef.current++;
    editingLogSnapshotRef.current = null;
    setNewLogType(MOMENT_BEHAVIOR_TYPE);
    setNewLogIntensity(3);
    setNewLogDuration(0);
    setNewLogContext("");
    setNewLogTrigger("");
    setNewLogResponse("");
    setNewLogNotes("");
    setNewLogPhoto("");
    setEditingLogId(null);
  };

  // TJB-01: the ONE validation rule lives in content/behaviorTaxonomy
  // (validateLogDraft) — trigger always, response only for incident types —
  // and the failure is a calm toast, never a blocking alert().
  // B-TODAY-20: returns the written row (null when invalid) so the capture
  // sheet's reply panel can echo and Undo exactly that row.
  // `callerShowsFailure`: see addMoment — one failed write, one message.
  const handleAddLog = async (e: React.FormEvent, { callerShowsFailure = false, contentSource }: { callerShowsFailure?: boolean; contentSource?: BehaviorLog["contentSource"] } = {}): Promise<BehaviorLog | null> => {
    e.preventDefault();
    const invalid = validateLogDraft({ behaviorType: newLogType, trigger: newLogTrigger, response: newLogResponse });
    if (invalid) {
      toast(t(invalid), "error");
      return null;
    }
    const existing = editingLogId ? (behaviorLogs.find((l) => l.id === editingLogId) ?? (editingLogSnapshotRef.current?.id === editingLogId ? editingLogSnapshotRef.current : null)) : null;
    if (editingLogId && !existing) return null;
    const logItem: BehaviorLog = {
      ...existing,
      ...(contentSource ? { contentSource } : {}),
      id: existing ? existing.id : `log-${Date.now()}`,
      timestamp: existing ? existing.timestamp : new Date().toISOString(),
      behaviorType: newLogType,
      // OBJ-BEH-03 / B-DATA-09: a Moment is "she said butterfly for the
      // first time" — it has no severity to grade, and the form never asks
      // for one. It stores NO intensity (as `momentLogFields` on the
      // addMoment path), never a neutral 1 or 3: absence keeps it outside
      // every intensity reducer, and no dots or level render for it.
      intensity: newLogType === MOMENT_BEHAVIOR_TYPE ? undefined : newLogIntensity,
      durationMinutes: newLogDuration,
      trigger: newLogTrigger,
      // A moment carries a response only if the parent actually wrote one.
      response: isIncidentType(newLogType) ? newLogResponse : newLogResponse.trim() || undefined,
      notes: newLogNotes || undefined,
      context: newLogContext || undefined,
      resolved: existing ? existing.resolved : false,
      resolutionNotes: existing?.resolutionNotes,
      photoAttachment: newLogPhoto || undefined,
    };

    // A problem's dormant marker cannot turn into a kept thing on conversion.
    // Otherwise preserve the marker/history: negative contentSource excludes
    // generated replacements without discarding genuine parent typo edits.
    if (existing && (existing.behaviorType !== MOMENT_BEHAVIOR_TYPE || newLogType !== MOMENT_BEHAVIOR_TYPE)) delete logItem.kept;

    const writeKey = `${childProfile.id}:draft`;
    if (captureWritesRef.current.has(writeKey) || captureScopeRef.current !== captureScope) return null;
    captureWritesRef.current.add(writeKey);
    const revision = captureRevisionRef.current;
    const draftSnapshot = currentCaptureDraftRef.current;
    try {
      await logsCol.upsert(logItem);
      if (captureScopeRef.current !== captureScope) return null;
      if (!existing) {
        setLastSavedBehavior({ childId: childProfile.id, id: logItem.id });
        track("log_created", { type: newLogType, intensity: logItem.intensity, context: logItem.context });
        trackCaptureSaved("log");
      } else {
        dismissBehaviorEcho(existing.id);
      }
      if (captureRevisionRef.current === revision && currentCaptureDraftRef.current === draftSnapshot) resetLogForm();
      return logItem;
    } catch {
      if (!callerShowsFailure && captureScopeRef.current === captureScope) toast(t("companion.capture.saveError"), "error");
      return null;
    } finally {
      captureWritesRef.current.delete(writeKey);
    }
  };

  /** One awaited persistence seam for plain moments. Unchosen place and
   * incident fields never leak from another capture into a neutral memory.
   * A failed write is announced ONCE: by this toast, unless the caller passes
   * `callerShowsFailure` because it renders the failure itself beside the kept
   * draft and its retry (QuickLogModal, TogetherView, KidExitRecap). */
  const addMoment = async (
    text: string,
    opts: { photoAttachment?: string; promptKey?: string; kept?: BehaviorLog["kept"]; contentSource?: BehaviorLog["contentSource"]; shelf?: ShelfId; milestoneId?: string; context?: BehaviorContext; notes?: string; callerShowsFailure?: boolean } = {},
  ): Promise<BehaviorLog | null> => {
    const { callerShowsFailure = false, ...writeOpts } = opts;
    const { shelf, milestoneId, context, notes, ...buildOpts } = writeOpts;
    const built = buildMomentLog(text, context ?? "", buildOpts);
    if (!built) return null;
    const { context: _unchosenContext, ...moment } = built;
    const logItem: BehaviorLog = {
      ...moment,
      ...(context ? { context } : {}),
      ...(notes?.trim() ? { notes: notes.trim() } : {}),
      ...(shelf ? { shelf } : {}),
      ...(milestoneId ? { milestoneId } : {}),
    };
    const writeKey = `${childProfile.id}:moment:${text}:${JSON.stringify(writeOpts)}`;
    if (captureWritesRef.current.has(writeKey) || captureScopeRef.current !== captureScope) return null;
    captureWritesRef.current.add(writeKey);
    try {
      await logsCol.upsert(logItem);
      if (captureScopeRef.current !== captureScope) return null;
      track("log_created", { type: logItem.behaviorType, context: logItem.context });
      trackCaptureSaved("moment");
      return logItem;
    } catch {
      if (!callerShowsFailure && captureScopeRef.current === captureScope) toast(t("companion.capture.saveError"), "error");
      return null;
    } finally {
      captureWritesRef.current.delete(writeKey);
    }
  };
  const saveMoment = addMoment;

  // Load a log into the form for editing.
  const startEditLog = (id: string, original?: BehaviorLog) => {
    const log = behaviorLogs.find((l) => l.id === id) ?? (original?.id === id ? original : undefined);
    if (!log) return;
    editingLogSnapshotRef.current = log;
    setNewLogType(log.behaviorType);
    // B-DATA-09: a moment carries no intensity — the sheet keeps its own.
    if (typeof log.intensity === "number") setNewLogIntensity(log.intensity);
    setNewLogDuration(log.durationMinutes);
    setNewLogTrigger(log.trigger);
    setNewLogResponse(log.response ?? "");
    setNewLogNotes(log.notes || "");
    captureRevisionRef.current++;
    setNewLogContext(log.context || "");
    setNewLogPhoto(log.photoAttachment || "");
    setEditingLogId(id);
  };
  const cancelEditLog = () => resetLogForm();

  // B-ASKJB-30 — capture and edit open the ONE sheet in place (QuickLogModal,
  // mounted once in Shell), from any screen: no hub switch on a capture path.
  //  - `review`: the draft is already filled (an AI extraction) — the sheet
  //    opens straight into ConfirmCaptureReview; the only write is Confirm.
  //  - `editLogId`: the incident form opens prefilled (startEditLog); Save
  //    updates the row through handleAddLog's editingLogId branch.
  // capture_started is emitted here for a capture (an edit is not one), and
  // pendingCaptureMode is NOT armed — Behaviors must not re-open it later.
  const [captureSheet, setCaptureSheet] = useState<{ open: boolean; mode?: CaptureMode; review?: CaptureSource; editLogId?: string; editLog?: BehaviorLog; initialText?: string; initialPhoto?: string }>({ open: false });
  const openCaptureSheet = (opts: { mode?: CaptureMode; review?: CaptureSource; editLogId?: string; editLog?: BehaviorLog; initialText?: string; initialPhoto?: string } = {}) => {
    if (opts.editLogId) startEditLog(opts.editLogId, opts.editLog);
    else {
      if (!opts.review) resetLogForm();
      trackCaptureStarted(opts.review === "ai-draft" ? "ai-draft" : opts.mode ?? "text");
    }
    setCaptureSheet({ open: true, ...opts });
  };
  const closeCaptureSheet = () => {
    captureRevisionRef.current++;
    setCaptureSheet({ open: false });
  };
  useEffect(() => {
    resetLogForm();
    setCaptureSheet({ open: false });
    setLastSavedBehavior(null);
    setPendingJournalFilter(null);
    setPendingJournalFocusId(null);
    // Child changes retire every capture draft and Journal handoff.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childProfile.id]);

  // Edit a custom milestone's title.
  const updateMilestoneTitle = (id: string, title: string) => {
    const m = milestones.find((x) => x.id === id);
    if (m && title.trim()) void milestonesCol.upsert({ ...m, title: title.trim() });
  };

  // Edit a plan step's text.
  const updatePlanStepText = (planId: string, phaseIdx: number, stepIdx: number, text: string) => {
    const plan = actionPlans.find((p) => p.id === planId);
    if (!plan || !text.trim()) return;
    const phases = plan.phases.map((ph, phI) => {
      if (phI !== phaseIdx) return ph;
      const steps = ph.steps.map((st, stI) => (stI === stepIdx ? { ...st, text: text.trim() } : st));
      return { ...ph, steps };
    });
    void plansCol.upsert({ ...plan, phases });
  };

  // Trigger analysis for logs
  const handleAnalyzeBehaviors = async () => {
    setIsAnalyzingBehavior(true);
    setApiError(null);
    try {
      const data = await api.analyzeBehavior({ logs: behaviorLogs, childProfile });
      setBehaviorAnalysis(data);
      // TJB-04: persist keyed by day so the synthesis survives a reload (one
      // row per child per day; a re-run the same day replaces it). Counts-only
      // provenance rides along for the why-line.
      const dateKey = new Date().toISOString().slice(0, 10);
      const record: InsightRecord = {
        id: `behavior-analysis-${dateKey}`,
        kind: "behavior-analysis",
        dateKey,
        createdAt: new Date().toISOString(),
        lang: getAiLanguage(),
        analysis: data,
        inputs: { logCount: behaviorLogs.length },
      };
      void insightsCol.upsert(record);
    } catch (err: any) {
      console.error(err);
      setApiError(err.message || "Failed to generate AI behavior evaluation.");
    } finally {
      setIsAnalyzingBehavior(false);
    }
  };

  // Generate Custom Action Plan
  const handleGenerateActionPlan = async () => {
    setIsPlanGenerating(true);
    setApiError(null);
    try {
      // M4: wrap with start/success/error analytics ("plan_create_*") without
      // disturbing the context-wide loading/error/paywall handling below.
      const planData = await runInstrumented("plan_create", () =>
        // B-ASKJB-27: the plan reads the record — behaviour COUNTS only (no
        // moment text, Guy G6); approved facts + past outcomes come from the
        // server's consent-checked CompanionContext.
        api.generatePlan({ challengeTopic: planChallengeTopic, childProfile, recentTypeCounts: recentTypeCounts(behaviorLogs, Date.now()) }),
      );
      planData.id = `plan-${Date.now()}`;
      await plansCol.upsert(planData);
      // N1-01-R3: step two — the actionPlans row is written, so a coach answer
      // that armed the latch becomes one plan_from_answer. A plan typed from
      // scratch in PlansTab finds no latch and emits nothing.
      notePlanCreatedFromAnswer();
      // N1-01-R6 (privacy): the plan TITLE is model-generated free text and
      // routinely names the child's difficulty — it never reaches the sink.
      // Counts and a surface id only, projected once in lib/kpiEvents and
      // reused by first_plan so the two events cannot drift apart.
      const planSteps = (planData.phases ?? []).reduce(
        (total, phase) => total + (phase?.steps?.length ?? 0),
        0,
      );
      const planProps = trackPlanGenerated({ steps: planSteps, source: "plans" });
      trackFirstPlan(planProps); // activation: only the family's first plan
      void maybeActivateReferral(); // mk-p0-2: a referred parent's activation closes the loop
      toast(t("ctx.toast.planWoven", { title: planData.title }), "success");
    } catch (err: any) {
      console.error(err);
      if (err instanceof PaywallError) openPaywall(err.feature || "advancedPlans", err.plan);
      else setApiError(err.message || "Failed to generate developmental Action Plan.");
    } finally {
      setIsPlanGenerating(false);
    }
  };

  // TJB-04: the latest persisted analysis for this child — what the Behaviors
  // card renders after a reload (session state wins while it exists).
  const behaviorAnalysisRecord = useMemo<InsightRecord | null>(
    () => insightsCol.items.find((r) => r.kind === "behavior-analysis" && !!r.analysis) ?? null,
    [insightsCol.items],
  );
  const behaviorAnalysisView: BehaviorAnalysis | null = behaviorAnalysis ?? behaviorAnalysisRecord?.analysis ?? null;

  /** TJB-04 "Keep this": one tap writes the suggestion line as a kept-insight
   *  row in the same subcollection (parent-owned record, no new sink). */
  const keepBehaviorInsight = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const now = new Date().toISOString();
    const row: InsightRecord = {
      id: `kept-${Date.now()}`,
      kind: "kept-insight",
      dateKey: now.slice(0, 10),
      createdAt: now,
      lang: getAiLanguage(),
      text: clean,
      sourceId: behaviorAnalysisRecord?.id,
    };
    void insightsCol.upsert(row);
    try { track("insight_kept", { source: "behavior-analysis" }); } catch { /* noop */ }
    toast(t("beh.analysis.kept", { name: (childProfile.name || "").split(" ")[0] }), "success");
  };
  const keptInsights = useMemo(() => insightsCol.items.filter((r) => r.kind === "kept-insight"), [insightsCol.items]);

  // Mark a behavior log resolved / unresolved
  const toggleLogResolved = (id: string) => {
    const log = behaviorLogs.find((l) => l.id === id);
    if (log) void logsCol.upsert({ ...log, resolved: !log.resolved });
  };

  // Deletions (data correction)
  const deleteLog = (id: string) => logsCol.remove(id);
  /** B-LOOP-06: the parent confirmed where a saved moment belongs (and,
   *  optionally, the milestone it evidences). Only the parent's tap calls it. */
  const fileMomentOnShelf = (logId: string, shelf: ShelfId, milestoneId?: string, original?: BehaviorLog) => {
    const log = behaviorLogs.find((l) => l.id === logId) ?? (original?.id === logId ? original : undefined);
    if (!log) return Promise.reject(new Error("The saved moment is no longer available"));
    return logsCol.upsert({ ...log, shelf, ...(milestoneId ? { milestoneId } : {}) });
  };
  const deletePlan = (id: string) => void plansCol.remove(id);
  // B-GROWTH-25: a ready-made routine starts as a plan in one tap — no goal,
  // no AI call; the template (lib/routineTemplates.routineToPlan) is the plan.
  const startPlanFromTemplate = (plan: ActionPlan) => plansCol.upsert(plan);
  const deleteMilestone = (id: string) => void milestonesCol.remove(id);

  // Toggle milestone checking
  const handleToggleMilestone = (id: string) => {
    const m = milestones.find((x) => x.id === id);
    if (m) void milestonesCol.upsert({ ...m, checked: !m.checked, observationStatus: !m.checked ? "yes" : "not_yet", observationUpdatedAt: new Date().toISOString() });
  };

  /** B-LOOP-04: every milestone answer (the Milestones tab, Today's Notice
   *  card, the journal shelf, a confirmed capture proposal) writes the ONE
   *  document lib/milestones/observe.ts builds — same answer, same bytes. */
  const setMilestoneObservation = (id: string, status: ObserveStatus, opts: ObserveOptions = {}) => {
    const milestone = milestones.find((item) => item.id === id);
    if (!milestone) return;
    return milestonesCol.upsert(observeMilestoneDoc(milestone, status, opts));
  };
  /** B-LOOP-04 (critic r3): Undo where the answer was given — writes back the
   *  document the surface held BEFORE the answer, byte for byte (setDoc
   *  replaces), so a mis-tap leaves no trace in the record or the packet. */
  const restoreMilestone = (previous: Milestone) => {
    if (!milestones.some((item) => item.id === previous.id)) return;
    void milestonesCol.upsert(previous);
  };

  /**
   * The ONLY durable-write seam for realtime conversation proposals. Provider
   * adapters receive no reference to this function. Confirmation is explicit,
   * atomic per proposal, auditable and reversible.
   */
  /**
   * AI-04: `origin` is the modality the proposal actually came from. This used
   * to be hardcoded — every kept row got an id prefixed "voice-" and the stored
   * response "Parent-confirmed from Harbor conversation". That was true while
   * the only tray was the live-voice one. It stopped being true the moment a
   * TYPED turn could be kept, and `log.response` is rendered to the parent and
   * printed into reports, so the app was telling them they had said something
   * out loud that they had typed. Defaults to "voice" so existing callers are
   * byte-identical.
   */
  const commitConversationProposal = async (
    proposal: ConversationProposal,
    origin: "voice" | "typed" = "voice",
  ): Promise<ConversationChangeRecord> => {
    if (proposal.childId !== childProfile.id) throw new Error("Proposal belongs to a different child");
    if (!proposal.summary.trim()) throw new Error("Proposal is empty");
    if (proposal.conflict?.code === "missing_milestone") throw new Error("The milestone no longer exists");
    const confirmedAt = new Date().toISOString();
    let commitRef: ConversationChangeRecord["commitRef"];
    let previousValue: unknown;
    if (proposal.target === "milestone") {
      const milestone = milestones.find((item) => item.id === proposal.milestoneId);
      if (!milestone || !proposal.milestoneStatus) throw new Error("Milestone proposal is incomplete");
      previousValue = milestone;
      await milestonesCol.upsert({ ...milestone, checked: proposal.milestoneStatus === "yes", observationStatus: proposal.milestoneStatus, observationUpdatedAt: confirmedAt });
      commitRef = { collection: "milestones", id: milestone.id };
    } else {
      const id = origin + "-" + proposal.id;
      const behaviorType = proposal.target === "observation" ? "Observation" : proposal.target === "journal" ? "Journal moment" : "Report fact";
      await logsCol.upsert({
        id, timestamp: proposal.occurredAt ?? confirmedAt, behaviorType, intensity: 1, durationMinutes: 0,
        trigger: proposal.summary.trim(),
        response: origin === "typed"
          ? "Parent-confirmed from a typed coach conversation"
          : "Parent-confirmed from Harbor conversation",
        notes: proposal.sourceExcerpt, context: "Home", resolved: false,
        conversationProposalId: proposal.id, sourceExcerpt: proposal.sourceExcerpt,
      });
      commitRef = { collection: "behaviorLogs", id };
    }
    const record: ConversationChangeRecord = {
      ...proposal, status: "committed", committedAt: confirmedAt, confirmedAt,
      confirmedBy: "parent", providerCanWrite: false, commitRef, previousValue,
    };
    await conversationChangesCol.upsert(record);
    track("voice_proposal_confirmed", { target: proposal.target, confidence: proposal.confidence, conflict: proposal.conflict?.code ?? "none" });
    return record;
  };

  const undoConversationChange = async (id: string) => {
    const record = conversationChangesCol.items.find((item) => item.id === id && item.status === "committed");
    if (!record?.commitRef) return;
    if (record.commitRef.collection === "milestones" && record.previousValue) {
      // B-DATA-08: only a whole Milestone of this id is written back; a
      // malformed audit value is never upserted — the audit row stays
      // "committed" and the parent is told the undo did not happen.
      const restored = restorableMilestone(record.previousValue, record.commitRef.id);
      if (!restored) {
        toast(t("elev.keep.undoFailed"), "error");
        return;
      }
      await milestonesCol.upsert(restored);
    }
    if (record.commitRef.collection === "behaviorLogs") await logsCol.remove(record.commitRef.id);
    await conversationChangesCol.upsert({ ...record, status: "undone" });
    track("voice_proposal_undone", { target: record.target });
  };

  // Add a custom milestone to a chosen domain
  const addCustomMilestone = (title: string, domain: DevelopmentalDomainId) => {
    void milestonesCol.upsert({
      id: `ms-${Date.now()}`,
      domain,
      ageGroup: "Custom",
      title,
      description: "Custom milestone added by parent.",
      checked: false,
      custom: true,
    });
  };

  // Set a step's kanban status (todo / doing / done); keeps `completed` in sync.
  const setPlanStepStatus = (planId: string, phaseIdx: number, stepIdx: number, status: "todo" | "doing" | "done") => {
    const plan = actionPlans.find((p) => p.id === planId);
    if (!plan) return;
    const phases = plan.phases.map((ph, phI) => {
      if (phI !== phaseIdx) return ph;
      const steps = ph.steps.map((st, stI) => (stI === stepIdx ? { ...st, status, completed: status === "done" } : st));
      return { ...ph, steps };
    });
    void plansCol.upsert({ ...plan, phases });
  };

  // B-ASKJB-26: the weekly "Signs it's working?" answer, appended to the plan.
  const recordPlanWeeklyCheck = (planId: string, answer: PlanCheckAnswer) => {
    const plan = actionPlans.find((p) => p.id === planId);
    if (!plan) return;
    void plansCol.upsert({ ...plan, weeklyChecks: [...(plan.weeklyChecks ?? []), { at: new Date().toISOString(), answer }] });
    try { track("plan_weekly_check", { answer }); } catch { /* noop */ }
  };

  // Toggle checklist inside Action Phase
  const handleTogglePlanStep = (planId: string, phaseIdx: number, stepIdx: number) => {
    const plan = actionPlans.find((p) => p.id === planId);
    if (!plan) return;
    const updatedPhases = plan.phases.map((ph, phI) => {
      if (phI !== phaseIdx) return ph;
      const updatedSteps = ph.steps.map((st, stI) => (stI === stepIdx ? { ...st, completed: !st.completed } : st));
      return { ...ph, steps: updatedSteps };
    });
    void plansCol.upsert({ ...plan, phases: updatedPhases });
  };

  return {
    ...topicState,
    selectFamilyTopic,
    createFamilyTopic,
    updateFamilyTopic,
    showSandboxBanner,
    activeTab,
    setActiveTab,
    childProfile,
    updateChild,
    behaviorLogs,
    logsLoaded: logsCol.loaded,
    milestones,
    // History freshness belongs to the raw collection, while its rendered
    // rows retain the catalogue fallback and retired-row read filtering.
    milestoneHistory: { items: milestones, sourceItems: milestonesCol.items },
    actionPlans,
    plansLoaded: plansCol.loaded,
    // c2 — Daily Play completion moat (single source of truth)
    playLogs,
    donePlayIds,
    logPlayCompletion,
    actionLoop,
    actionLoopConfirmed: actionLoopCol.confirmed,
    conversationChanges: conversationChangesCol.items,
    commitConversationProposal,
    undoConversationChange,
    activeTodayAction,
    actionLoopReady: actionLoopCol.loaded && !actionLoopCol.error,
    acceptTodayAction,
    recordTodayOutcome,
    saveTodayOutcome,
    saveTodayObservation,
    removeTodayAction,
    recordPracticeDose,
    recordFromRecordAnswer,
    recordAnswerWrites,
    recordAnswersConfirmed: actionLoopCol.confirmed,
    recordChildResponse,
    captureSheet,
    openCaptureSheet,
    closeCaptureSheet,
    hardMomentNow,
    openHardMomentNow,
    closeHardMomentNow,
    askHardMomentRef,
    setAskHardMomentRef,
    selectedLens,
    setSelectedLens,
    chatInput,
    setChatInput,
    seedCoach,
    savedLearnIds,
    toggleSavedLearn,
    pendingLearnRequest,
    requestLearnRead,
    consumeLearnRequest,
    postCaptureCoachPrompt,
    offerPostCaptureCoach,
    dismissPostCaptureCoach,
    acceptPostCaptureCoach,
    pendingCaptureMode,
    requestCapture,
    consumeCaptureRequest,
    lastSavedBehavior,
    dismissBehaviorEcho,
    pendingJournalFilter,
    requestJournalFilter,
    consumeJournalFilter,
    pendingJournalFocusId,
    requestJournalFocus,
    consumeJournalFocus,
    pendingConsultPrefill,
    requestConsultPrefill,
    consumeConsultPrefill,
    chatMessages,
    conversations,
    activeConversationId,
    conversationRevision,
    newConversation,
    openConversation,
    deleteConversation,
    isChatLoading,
    chatStreamStatus,
    apiError,
    apiErrorStatus,
    paywall,
    openPaywall,
    closePaywall,
    newLogType,
    setNewLogType,
    newLogIntensity,
    setNewLogIntensity,
    newLogDuration,
    setNewLogDuration,
    newLogTrigger,
    setNewLogTrigger,
    newLogResponse,
    setNewLogResponse,
    newLogNotes,
    setNewLogNotes,
    newLogContext,
    setNewLogContext,
    newLogPhoto,
    setNewLogPhoto,
    editingLogId,
    startEditLog,
    cancelEditLog,
    updateMilestoneTitle,
    updatePlanStepText,
    toggleLogResolved,
    deleteLog,
    deletePlan,
    startPlanFromTemplate,
    deleteMilestone,
    planChallengeTopic,
    setPlanChallengeTopic,
    isPlanGenerating,
    behaviorAnalysis: behaviorAnalysisView,
    behaviorAnalysisRecord,
    keepBehaviorInsight,
    keptInsights,
    isAnalyzingBehavior,
    memoryReviewItems,
    memoryReviewLoaded,
    isMemoryUpdating,
    memoryReviewError,
    memoryReviewErrorKind,
    retryMemoryReview,
    milestoneAnalysisOfGaps,
    isAnalyzingMilestones,
    inlineCoRegulationScripts,
    isGeneratingInlineScript,
    handleGetInlineCoRegulationScript,
    handleGenerateMilestoneScaffold,
    autofillLogTemplate,
    chatBottomRef,
    checkedMilestones,
    totalMilestones,
    milestonesPercent,
    pendingMemoryItems,
    approvedMemoryItems,
    pendingReviewCount,
    unreadCoachCount,
    handleMemoryDecision,
    proposeMemory,
    handleCancelChat,
    handleChatSend,
    handleCouncilSend,
    appendVoiceUserTurn,
    appendVoiceAiDelta,
    finalizeVoiceAiTurn,
    handleAddLog,
    addMoment,
    saveMoment,
    handleAnalyzeBehaviors,
    handleGenerateActionPlan,
    handleToggleMilestone,
    setMilestoneObservation,
    restoreMilestone,
    fileMomentOnShelf,
    addCustomMilestone,
    handleTogglePlanStep,
    setPlanStepStatus,
    recordPlanWeeklyCheck,
  };
}

const LS_REFERRAL_ACTIVATED = "arbor.referralActivated";

/**
 * mk-p0-2 referral loop (referred side). Fired alongside the family's first
 * generated plan: if a referral code was captured first-touch and we haven't
 * redeemed yet on this device, POST it once. On a real grant we announce the
 * activation event and refresh the entitlement so the Plan badge flips to Plus.
 * Best-effort and fully guarded — never blocks plan creation.
 */
async function maybeActivateReferral(): Promise<void> {
  const code = consumeReferralCode();
  if (!code) return;
  try {
    if (localStorage.getItem(LS_REFERRAL_ACTIVATED)) return;
    localStorage.setItem(LS_REFERRAL_ACTIVATED, new Date().toISOString());
  } catch {
    /* storage blocked — proceed (server still dedupes per uid) */
  }
  try {
    const result = await api.referralActivate(code);
    if (result.ok && result.status === "granted") {
      trackInviteActivated("referred");
      void refreshEntitlement();
    }
  } catch {
    // Roll back the device guard so a transient failure can retry next time.
    try { localStorage.removeItem(LS_REFERRAL_ACTIVATED); } catch { /* ignore */ }
  }
}

type ArborContextValue = ReturnType<typeof useArborState>;

const ArborContext = createContext<ArborContextValue | null>(null);

export function ArborProvider({ children }: { children: React.ReactNode }) {
  const value = useArborState();
  return <ArborContext.Provider value={value}>{children}</ArborContext.Provider>;
}

export function useArbor(): ArborContextValue {
  const ctx = useContext(ArborContext);
  if (!ctx) throw new Error("useArbor must be used within an ArborProvider");
  return ctx;
}

/**
 * Tolerant variant for components that mount both inside the app shell AND in
 * the pre-shell onboarding flow, which renders OUTSIDE ArborProvider (see
 * App.tsx ProfileGate). Returns null there instead of throwing — callers must
 * degrade gracefully (e.g. AvatarCreator falls back to an inline error when it
 * can't open the paywall).
 */
export function useArborOptional(): ArborContextValue | null {
  return useContext(ArborContext);
}
