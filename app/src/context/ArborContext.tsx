import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from "react";
import {
  ChildProfile,
  BehaviorLog,
  Milestone,
  ActionPlan,
  BedtimeStory,
  BehaviorAnalysis,
  SchoolBrief,
  MemoryReviewItem,
  BehaviorContext,
  DevelopmentalDomainId,
} from "../types";
import {
  sampleBehaviorLogs,
  initialMilestones,
  defaultActionPlans,
  sampleBedtimeStory,
} from "../initialData";
import { useProfile } from "./ProfileContext";
import { api, authHeaders, getAiLanguage } from "../lib/api";
import { useChildCollection } from "../hooks/useChildCollection";
import { track } from "../lib/analytics";

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

export type ActiveTab =
  // existing leaf views (preserved)
  | "overview"
  | "coach"
  | "behaviors"
  | "milestones"
  | "plans"
  | "stories"
  | "weekly"
  | "scholar"
  | "language"
  | "handoff"
  | "safety"
  // new capability views (IA refactor)
  | "profile"        // Child Intelligence › Development Profile
  | "memory"         // Child Intelligence › Child Memory
  | "strengths"      // Child Intelligence › Strengths & Challenges
  | "find-pro"       // Care Network › Find a Professional
  | "care-team"      // Care Network › My Care Team
  | "appointments"   // Care Network › Appointments
  | "sharing"        // Care Network › Trusted Sharing
  | "reports"        // Care Network › Reports
  | "masterclasses"  // Arbor Academy › Parent Masterclasses
  | "family";        // Arbor Academy › Family Formation

// IA-1: URL hash routing. Each leaf view maps to `#/<tab>` for deep links and a
// working browser back/forward button.
const VALID_TABS = new Set<string>([
  "overview", "coach", "behaviors", "milestones", "plans", "stories", "weekly", "scholar", "language", "handoff", "safety",
  "profile", "memory", "strengths", "find-pro", "care-team", "appointments", "sharing", "reports", "masterclasses", "family",
]);
function tabFromHash(): ActiveTab | null {
  try {
    const h = window.location.hash.replace(/^#\/?/, "").trim();
    return VALID_TABS.has(h) ? (h as ActiveTab) : null;
  } catch {
    return null;
  }
}

export type ChatMessage = { sender: "user" | "ai"; text: string; lens?: string };
export type ChatResponsePayload = { text: string; memoryReviewItems?: MemoryReviewItem[] };
export type Conversation = { id: string; title: string; messages: ChatMessage[]; updatedAt: string };

export const WELCOME_MESSAGE: ChatMessage = {
  sender: "ai",
  text:
    "### Welcome to Arbor Parent Coach\n" +
    "I help turn parenting concerns into age-aware, non-diagnostic next steps. Share a hard moment, a behavior pattern, or a developmental question your child is facing.\n\n" +
    "### Suggested starting points:\n" +
    "- **\"Transition tantrums when leaving for school in the mornings.\"**\n" +
    "- **\"Refuses to switch off the screen at night and screams.\"**\n" +
    "- **\"Suggestions for improving confidence when switching between languages.\"**\n\n" +
    "Select a **Scholar Lens** above to focus guidance through a developmental frame (Vygotsky, Bowlby, Piaget, Winnicott, etc.).",
  lens: "Integrated Balanced",
};


/**
 * Holds the full Arbor application state and the API handlers that were
 * previously inlined in App.tsx. Exposed via ArborProvider / useArbor so the
 * decomposed tab + layout components can consume state without prop drilling.
 */
function useArborState() {
  const showSandboxBanner = import.meta.env.VITE_HAS_GEMINI_API !== "true";

  // Active child comes from ProfileContext so every AI call, log, and plan is
  // scoped to the selected child rather than a hardcoded profile.
  const { activeChild, updateChild } = useProfile();
  const childProfile: ChildProfile = activeChild;

  // Navigation State (persisted preferences). Initial tab: URL hash wins (deep
  // link), then last-used (localStorage), then Home.
  const [activeTab, setActiveTabState] = useState<ActiveTab>(() => tabFromHash() || (readLS("arbor.activeTab") as ActiveTab) || "overview");
  const setActiveTab = (t: ActiveTab) => {
    setActiveTabState(t);
    try { if (window.location.hash.replace(/^#\/?/, "") !== t) window.location.hash = `/${t}`; } catch { /* noop */ }
    try { track("view_tab", { tab: t }); } catch { /* noop */ }
  };
  const [showAiRail, setShowAiRail] = useState<boolean>(() => readLS("arbor.aiRail") !== "false");

  // App Core States — persisted per child (Firestore when authed, localStorage in sandbox)
  const logsCol = useChildCollection<BehaviorLog>(childProfile.id, "behaviorLogs", {
    sandboxSeed: sampleBehaviorLogs,
    orderByField: "timestamp",
    orderDir: "desc",
    max: 300,
  });
  const milestonesCol = useChildCollection<Milestone>(childProfile.id, "milestones", {
    seed: initialMilestones,
    sandboxSeed: initialMilestones,
  });
  const plansCol = useChildCollection<ActionPlan>(childProfile.id, "actionPlans", { sandboxSeed: defaultActionPlans });

  const behaviorLogs = useMemo(
    () => [...logsCol.items].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)),
    [logsCol.items]
  );
  const milestones = useMemo(() => {
    const order = new Map(initialMilestones.map((m, i) => [m.id, i]));
    const list = milestonesCol.items.length > 0 ? milestonesCol.items : initialMilestones;
    return [...list].sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
  }, [milestonesCol.items]);
  const actionPlans = useMemo(() => {
    const ts = (id: string) => {
      const m = /(\d{10,})/.exec(id);
      return m ? Number(m[1]) : 0;
    };
    return [...plansCol.items].sort((a, b) => ts(b.id) - ts(a.id));
  }, [plansCol.items]);

  const [currentStory, setCurrentStory] = useState<BedtimeStory>(sampleBedtimeStory);

  // Active Interactive / Selection States
  const [selectedLens, setSelectedLens] = useState<string>(() => readLS("arbor.lens") || "Integrated Balanced");
  const [chatInput, setChatInput] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  // Multi-thread coach conversations (persisted per child).
  const conversationsCol = useChildCollection<Conversation>(childProfile.id, "conversations");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const conversations = useMemo(
    () => [...conversationsCol.items].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [conversationsCol.items]
  );
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [chatStreamStatus, setChatStreamStatus] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);

  // Form states: Log Behavior
  const [newLogType, setNewLogType] = useState<string>("Transition Refusal");
  const [newLogIntensity, setNewLogIntensity] = useState<number>(3);
  const [newLogDuration, setNewLogDuration] = useState<number>(15);
  const [newLogTrigger, setNewLogTrigger] = useState<string>("");
  const [newLogResponse, setNewLogResponse] = useState<string>("");
  const [newLogNotes, setNewLogNotes] = useState<string>("");
  const [newLogContext, setNewLogContext] = useState<BehaviorContext>("Home");
  const [newLogPhoto, setNewLogPhoto] = useState<string>("");
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // Form states: Generated Action Plan
  const [planChallengeTopic, setPlanChallengeTopic] = useState<string>(
    "Screen time tantrums when tablet is turned off"
  );
  const [isPlanGenerating, setIsPlanGenerating] = useState<boolean>(false);

  // Form states: Generated Story Book
  const [storyTopic, setStoryTopic] = useState<string>("Fear of starting school");
  const [storyMoral, setStoryMoral] = useState<string>(
    "Courage in taking small steps and holding on to safe things"
  );
  const [isStoryGenerating, setIsStoryGenerating] = useState<boolean>(false);
  const [activeStoryPage, setActiveStoryPage] = useState<number>(0);
  const [storyReadingProgress, setStoryReadingProgress] = useState<number>(0);

  // Form states: Behavior Analysis
  const [behaviorAnalysis, setBehaviorAnalysis] = useState<BehaviorAnalysis | null>(null);
  const [isAnalyzingBehavior, setIsAnalyzingBehavior] = useState<boolean>(false);

  // Form states: School Brief
  const [schoolBrief, setSchoolBrief] = useState<SchoolBrief | null>(null);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState<boolean>(false);
  const [memoryReviewItems, setMemoryReviewItems] = useState<MemoryReviewItem[]>([]);
  const [isMemoryUpdating, setIsMemoryUpdating] = useState<string | null>(null);

  // Embedded Interactive AI States and Helpers
  const [handoffAudience, setHandoffAudience] = useState<"teacher" | "clinician" | "pediatrician">("teacher");
  const [milestoneAnalysisOfGaps, setMilestoneAnalysisOfGaps] = useState<string>("");
  const [isAnalyzingMilestones, setIsAnalyzingMilestones] = useState<boolean>(false);
  const [inlineCoRegulationScripts, setInlineCoRegulationScripts] = useState<{ [logId: string]: string }>({});
  const [isGeneratingInlineScript, setIsGeneratingInlineScript] = useState<{ [logId: string]: boolean }>({});

  const handleGetInlineCoRegulationScript = async (log: BehaviorLog) => {
    setIsGeneratingInlineScript((prev) => ({ ...prev, [log.id]: true }));
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          message: `Create a brief, highly actionable parental co-regulation script for a ${childProfile.age}-year-old child experiencing the following event:
Type of challenge: ${log.behaviorType}
Duration: ${log.durationMinutes} mins
Intensity: ${log.intensity}/5
Trigger: ${log.trigger}
Current Parent response: ${log.response}

Respond with EXACTLY three short markdown items:
### 1. Developmental Co-regulation Read
(Name why this happens from an attachment perspective in 1 brief sentence)

### 2. Exact Reassuring Script
(Provide real direct verbal scripts parent can say immediately to support)

### 3. Key Trap to Avoid
(State what the parent should avoid doing/saying)`,
          childProfile: childProfile,
          scholarLens: "Bowlby's Attachment Model",
          language: getAiLanguage(),
        }),
      });
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setInlineCoRegulationScripts((prev) => ({ ...prev, [log.id]: data.text }));
    } catch (err: any) {
      setInlineCoRegulationScripts((prev) => ({
        ...prev,
        [log.id]: `### Error Generating Guideline\nCould not fetch response from server.\n\nVerify that your **Google Gemini API Key** is configured in \`.env.local\` to connect real AI insights.`,
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
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          message: `Analyze checked vs unchecked milestones for a ${childProfile.age}-year-old child named ${childProfile.name} in transition:
Checked:
${checkedList || "None"}

Unchecked:
${uncheckedList || "None"}

Give a Vygotskian scaffolding learning assessment, outlining a real plan of how to master these goals. Highlight the path to bilingual confidence (Hebrew-English) and sensory self-regulation. Give 2 custom interactive exercises the parent can embed in daily play. Format with exact clean display headings.`,
          childProfile: childProfile,
          scholarLens: "Vygotskian Scaffolding",
          language: getAiLanguage(),
        }),
      });
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setMilestoneAnalysisOfGaps(data.text);
    } catch (err) {
      setMilestoneAnalysisOfGaps(
        "### Guidance Error\nCould not fetch developmental recommendations. Verify your Google Gemini API Key is saved correctly in `.env.local`."
      );
    } finally {
      setIsAnalyzingMilestones(false);
    }
  };

  const autofillLogTemplate = (type: "morning" | "screen" | "sibling") => {
    if (type === "morning") {
      setNewLogType("Transition Refusal");
      setNewLogIntensity(4);
      setNewLogDuration(20);
      setNewLogTrigger("Asked to put down the red wooden truck and put boots on to leave for nursery school");
      setNewLogResponse(
        "Lowered physical height to eye level, named the feeling ('You really want to keep playing with the truck'), and offered to place truck on 'safe shelf' until returning home."
      );
      setNewLogNotes("Calmed and put shoes on within 8 mins instead of usual 25. No screaming, just mild protest.");
    } else if (type === "screen") {
      setNewLogType("Screentime Dispute");
      setNewLogIntensity(5);
      setNewLogDuration(25);
      setNewLogTrigger("Told that nursery class ipad/tablet must be powered off for bedtime story sequence");
      setNewLogResponse(
        "Lowered voice volume to a whisper, counted down ('3 minutes remaining for ipad, then bunny bedtime begins'), and handed Hebrew/English co-regulation comfort cards."
      );
      setNewLogNotes("Exhibited high intensity crying initially, but shifted focus quickly once comfort cards were hold.");
    } else {
      setNewLogType("Sibling Conflict");
      setNewLogIntensity(3);
      setNewLogDuration(10);
      setNewLogTrigger("Dispute over sharing coloring markers during afternoon quiet playtime");
      setNewLogResponse("Did not yell. Walked over, structured drawing turns using sandbox egg-timer visual cues.");
      setNewLogNotes("Resolved marker dispute within 2 turns without tearing coloring pages.");
    }
  };

  // Auto Scroll Chat
  const chatBottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatLoading]);

  // Start a fresh (unsaved) conversation when the active child changes.
  const loadedChatChild = useRef<string | null>(null);
  useEffect(() => {
    if (loadedChatChild.current === childProfile.id) return;
    loadedChatChild.current = childProfile.id;
    setActiveConversationId(null);
    setChatMessages([WELCOME_MESSAGE]);
  }, [childProfile.id]);

  // Persist the active conversation (once it has real content).
  useEffect(() => {
    if (!activeConversationId || chatMessages.length <= 1) return;
    const firstUser = chatMessages.find((m) => m.sender === "user");
    const title = (firstUser ? firstUser.text : "Conversation").replace(/[#*]/g, "").trim().slice(0, 48) || "Conversation";
    void conversationsCol.upsert({
      id: activeConversationId,
      title,
      messages: chatMessages.slice(-30),
      updatedAt: new Date().toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages, activeConversationId]);

  // Coach conversation thread controls.
  const newConversation = () => {
    setActiveConversationId(null);
    setChatMessages([WELCOME_MESSAGE]);
  };
  const openConversation = (id: string) => {
    const c = conversationsCol.items.find((x) => x.id === id);
    if (!c) return;
    setActiveConversationId(id);
    setChatMessages(c.messages.length ? c.messages : [WELCOME_MESSAGE]);
  };
  const deleteConversation = (id: string) => {
    void conversationsCol.remove(id);
    if (id === activeConversationId) newConversation();
  };

  // IA-1: keep the URL hash in sync with the active view, and respond to
  // back/forward by reading the hash.
  useEffect(() => {
    const onHash = () => { const t = tabFromHash(); if (t) setActiveTabState(t); };
    if (typeof window !== "undefined") {
      if (!window.location.hash) { try { window.history.replaceState(null, "", `#/${activeTab}`); } catch { /* noop */ } }
      window.addEventListener("hashchange", onHash);
    }
    return () => { if (typeof window !== "undefined") window.removeEventListener("hashchange", onHash); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist UI preferences.
  useEffect(() => writeLS("arbor.activeTab", activeTab), [activeTab]);
  useEffect(() => writeLS("arbor.aiRail", String(showAiRail)), [showAiRail]);
  useEffect(() => writeLS("arbor.lens", selectedLens), [selectedLens]);

  // Story reading progress calculation
  useEffect(() => {
    if (currentStory && currentStory.pages) {
      const percentage = Math.round(((activeStoryPage + 1) / (currentStory.pages.length + 1)) * 100);
      setStoryReadingProgress(percentage);
    }
  }, [activeStoryPage, currentStory]);

  // Calculation of developmental scores
  const checkedMilestones = milestones.filter((m) => m.checked).length;
  const totalMilestones = milestones.length;
  const milestonesPercent = totalMilestones > 0 ? Math.round((checkedMilestones / totalMilestones) * 100) : 0;
  const pendingMemoryItems = memoryReviewItems.filter((item) => item.status === "pending");
  const approvedMemoryItems = memoryReviewItems.filter((item) => item.status === "approved");

  // --- HANDLERS: SERVER API CALLS ---

  const refreshMemoryReview = async () => {
    try {
      const res = await fetch(`/api/memory/${encodeURIComponent(childProfile.id)}`, {
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error("Memory review fetch failed");
      const data = await res.json();
      setMemoryReviewItems(data.items || []);
    } catch (err) {
      console.warn("Could not load memory review items", err);
    }
  };

  useEffect(() => {
    refreshMemoryReview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childProfile.id]);

  const handleMemoryDecision = async (memoryId: string, status: "approved" | "rejected" | "deleted") => {
    setIsMemoryUpdating(memoryId);
    try {
      const res = await fetch(`/api/memory/${encodeURIComponent(memoryId)}`, {
        method: "PATCH",
        headers: await authHeaders(),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Memory review update failed");
      const data = await res.json();
      setMemoryReviewItems(data.items || []);
    } catch (err: any) {
      alert(err.message || "Could not update memory review item.");
    } finally {
      setIsMemoryUpdating(null);
    }
  };

  const readStreamingChatResponse = async (res: Response): Promise<ChatResponsePayload> => {
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Streaming response body unavailable");

    const decoder = new TextDecoder();
    let buffer = "";
    let finalPayload: ChatResponsePayload | null = null;

    const handleBlock = (block: string) => {
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
        setChatStreamStatus(data.text || "Arbor is preparing the developmental response...");
      } else if (eventName === "chunk") {
        setChatStreamStatus(`Receiving structured guidance (${data.characters || 0} chars)`);
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

  const readChatPayload = async (res: Response): Promise<ChatResponsePayload> => {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      return readStreamingChatResponse(res);
    }
    return await res.json();
  };

  const handleCancelChat = () => {
    setChatStreamStatus("Stopping request...");
    chatAbortRef.current?.abort();
  };

  // Handle Parent Coach Chat
  const handleChatSend = async (customPrompt?: string) => {
    const promptValue = customPrompt || chatInput;
    if (!promptValue.trim() || isChatLoading) return;

    if (!customPrompt) setChatInput("");
    setApiError(null);
    setChatStreamStatus("Connecting to Arbor...");

    // Begin a persisted conversation on the first message of a fresh thread.
    if (!activeConversationId) setActiveConversationId(`conv-${Date.now()}`);

    const updatedMessages = [...chatMessages, { sender: "user" as const, text: promptValue, lens: selectedLens }];
    setChatMessages(updatedMessages);
    setIsChatLoading(true);

    const controller = new AbortController();
    chatAbortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: await authHeaders({ Accept: "text/event-stream" }),
        signal: controller.signal,
        body: JSON.stringify({
          message: promptValue,
          childProfile: childProfile,
          scholarLens: selectedLens || "Integrated Balanced",
          language: getAiLanguage(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.details || errData.error || "Server response failed");
      }

      const data = await readChatPayload(res);
      if (data.memoryReviewItems) {
        setMemoryReviewItems(data.memoryReviewItems);
      }
      setChatMessages((prev) => [...prev, { sender: "ai", text: data.text, lens: selectedLens }]);
      track("coach_message", { lens: selectedLens });
    } catch (err: any) {
      console.error(err);
      if (err.name === "AbortError") {
        setChatMessages((prev) => [
          ...prev,
          { sender: "ai", text: "### Request Stopped\nThe live Arbor response was cancelled before completion." },
        ]);
        return;
      }
      setApiError(err.message || "An exception occurred while connecting to Arbor services.");
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: `### Connection Error\nCould not fetch response from the server.\n\n**Reason:** ${err.message}\n\nPlease verify that your **Google Gemini API Key** is saved correctly in \`.env.local\`.`,
        },
      ]);
    } finally {
      setIsChatLoading(false);
      setChatStreamStatus(null);
      chatAbortRef.current = null;
    }
  };

  // Add a Custom Behavior Log
  const resetLogForm = () => {
    setNewLogTrigger("");
    setNewLogResponse("");
    setNewLogNotes("");
    setNewLogPhoto("");
    setEditingLogId(null);
  };

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogTrigger.trim() || !newLogResponse.trim()) {
      alert("Please provide trigger details and active response summary.");
      return;
    }
    const existing = editingLogId ? behaviorLogs.find((l) => l.id === editingLogId) : null;
    const logItem: BehaviorLog = {
      id: existing ? existing.id : `log-${Date.now()}`,
      timestamp: existing ? existing.timestamp : new Date().toISOString(),
      behaviorType: newLogType,
      intensity: newLogIntensity,
      durationMinutes: newLogDuration,
      trigger: newLogTrigger,
      response: newLogResponse,
      notes: newLogNotes || undefined,
      context: newLogContext,
      resolved: existing ? existing.resolved : false,
      resolutionNotes: existing?.resolutionNotes,
      photoAttachment: newLogPhoto || undefined,
    };

    void logsCol.upsert(logItem);
    if (!existing) track("log_created", { type: newLogType, intensity: newLogIntensity, context: newLogContext });
    resetLogForm();
  };

  // Load a log into the form for editing.
  const startEditLog = (id: string) => {
    const log = behaviorLogs.find((l) => l.id === id);
    if (!log) return;
    setNewLogType(log.behaviorType);
    setNewLogIntensity(log.intensity);
    setNewLogDuration(log.durationMinutes);
    setNewLogTrigger(log.trigger);
    setNewLogResponse(log.response);
    setNewLogNotes(log.notes || "");
    setNewLogContext(log.context || "Home");
    setNewLogPhoto(log.photoAttachment || "");
    setEditingLogId(id);
  };
  const cancelEditLog = () => resetLogForm();

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
      const planData = await api.generatePlan({ challengeTopic: planChallengeTopic, childProfile });
      planData.id = `plan-${Date.now()}`;
      await plansCol.upsert(planData);
      track("plan_generated", { title: planData.title });
      alert(`Action Plan successfully woven: "${planData.title}"`);
    } catch (err: any) {
      console.error(err);
      setApiError(err.message || "Failed to generate developmental Action Plan.");
    } finally {
      setIsPlanGenerating(false);
    }
  };

  // Generate Book Bedtime Story
  const handleGenerateStory = async () => {
    setIsStoryGenerating(true);
    setApiError(null);
    try {
      const newStory = await api.generateStory({
        childName: childProfile.name,
        age: childProfile.age,
        topic: storyTopic,
        moral: storyMoral + (getAiLanguage() === "he" ? " (Write the entire story in warm, natural Hebrew.)" : ""),
      });
      setCurrentStory(newStory);
      setActiveStoryPage(0);
      alert(`Co-regulated Bedtime Story completed: "${newStory.title}"`);
    } catch (err: any) {
      console.error(err);
      setApiError(err.message || "Failed to write story.");
    } finally {
      setIsStoryGenerating(false);
    }
  };

  // Generate Handoff Brief Report
  const handleGenerateBrief = async () => {
    setIsGeneratingBrief(true);
    setApiError(null);
    try {
      const briefData = await api.generateBrief({
        childProfile,
        logs: behaviorLogs,
        milestones,
        audience: handoffAudience,
      });
      setSchoolBrief(briefData);
    } catch (err: any) {
      console.error(err);
      setApiError(err.message || "Failed to generate professional school ready brief.");
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  // Mark a behavior log resolved / unresolved
  const toggleLogResolved = (id: string) => {
    const log = behaviorLogs.find((l) => l.id === id);
    if (log) void logsCol.upsert({ ...log, resolved: !log.resolved });
  };

  // Deletions (data correction)
  const deleteLog = (id: string) => void logsCol.remove(id);
  const deletePlan = (id: string) => void plansCol.remove(id);
  const deleteMilestone = (id: string) => void milestonesCol.remove(id);

  // Toggle milestone checking
  const handleToggleMilestone = (id: string) => {
    const m = milestones.find((x) => x.id === id);
    if (m) void milestonesCol.upsert({ ...m, checked: !m.checked });
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
    showSandboxBanner,
    activeTab,
    setActiveTab,
    showAiRail,
    setShowAiRail,
    childProfile,
    updateChild,
    behaviorLogs,
    logsLoaded: logsCol.loaded,
    milestones,
    actionPlans,
    plansLoaded: plansCol.loaded,
    currentStory,
    setCurrentStory,
    selectedLens,
    setSelectedLens,
    chatInput,
    setChatInput,
    chatMessages,
    conversations,
    activeConversationId,
    newConversation,
    openConversation,
    deleteConversation,
    isChatLoading,
    chatStreamStatus,
    apiError,
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
    deleteMilestone,
    planChallengeTopic,
    setPlanChallengeTopic,
    isPlanGenerating,
    storyTopic,
    setStoryTopic,
    storyMoral,
    setStoryMoral,
    isStoryGenerating,
    activeStoryPage,
    setActiveStoryPage,
    storyReadingProgress,
    behaviorAnalysis,
    isAnalyzingBehavior,
    schoolBrief,
    setSchoolBrief,
    isGeneratingBrief,
    memoryReviewItems,
    isMemoryUpdating,
    handoffAudience,
    setHandoffAudience,
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
    handleMemoryDecision,
    handleCancelChat,
    handleChatSend,
    handleAddLog,
    handleAnalyzeBehaviors,
    handleGenerateActionPlan,
    handleGenerateStory,
    handleGenerateBrief,
    handleToggleMilestone,
    addCustomMilestone,
    handleTogglePlanStep,
    setPlanStepStatus,
  };
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
