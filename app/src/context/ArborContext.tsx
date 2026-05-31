import React, { createContext, useContext, useState, useEffect, useRef } from "react";
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

export type ActiveTab =
  | "overview"
  | "coach"
  | "behaviors"
  | "milestones"
  | "plans"
  | "stories"
  | "weekly"
  | "scholar"
  | "handoff"
  | "safety";

export type ChatMessage = { sender: "user" | "ai"; text: string; lens?: string };
export type ChatResponsePayload = { text: string; memoryReviewItems?: MemoryReviewItem[] };

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

const chatStorageKey = (childId: string) => `arbor.chat.${childId}`;

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

  // Navigation State
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [showAiRail, setShowAiRail] = useState<boolean>(true);

  // App Core States
  const [behaviorLogs, setBehaviorLogs] = useState<BehaviorLog[]>(sampleBehaviorLogs);
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones);
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>(defaultActionPlans);
  const [currentStory, setCurrentStory] = useState<BedtimeStory>(sampleBedtimeStory);

  // Active Interactive / Selection States
  const [selectedLens, setSelectedLens] = useState<string>("Integrated Balanced");
  const [chatInput, setChatInput] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
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
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Analyze checked vs unchecked milestones for a ${childProfile.age}-year-old child named ${childProfile.name} in transition:
Checked:
${checkedList || "None"}

Unchecked:
${uncheckedList || "None"}

Give a Vygotskian scaffolding learning assessment, outlining a real plan of how to master these goals. Highlight the path to bilingual confidence (Hebrew-English) and sensory self-regulation. Give 2 custom interactive exercises the parent can embed in daily play. Format with exact clean display headings.`,
          childProfile: childProfile,
          scholarLens: "Vygotskian Scaffolding",
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

  // Restore each child's last conversation when the active child changes.
  const loadedChatChild = useRef<string | null>(null);
  useEffect(() => {
    if (loadedChatChild.current === childProfile.id) return;
    loadedChatChild.current = childProfile.id;
    try {
      const raw = localStorage.getItem(chatStorageKey(childProfile.id));
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChatMessages(parsed);
          return;
        }
      }
    } catch {
      /* ignore */
    }
    setChatMessages([WELCOME_MESSAGE]);
  }, [childProfile.id]);

  // Persist the last 10 messages per child.
  useEffect(() => {
    try {
      localStorage.setItem(chatStorageKey(childProfile.id), JSON.stringify(chatMessages.slice(-10)));
    } catch {
      /* ignore */
    }
  }, [chatMessages, childProfile.id]);

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
      const res = await fetch(`/api/memory/${encodeURIComponent(childProfile.id)}`);
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
        headers: { "Content-Type": "application/json" },
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

    const updatedMessages = [...chatMessages, { sender: "user" as const, text: promptValue, lens: selectedLens }];
    setChatMessages(updatedMessages);
    setIsChatLoading(true);

    const controller = new AbortController();
    chatAbortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        signal: controller.signal,
        body: JSON.stringify({
          message: promptValue,
          childProfile: childProfile,
          scholarLens: selectedLens || "Integrated Balanced",
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
  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogTrigger.trim() || !newLogResponse.trim()) {
      alert("Please provide trigger details and active response summary.");
      return;
    }
    const logItem: BehaviorLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      behaviorType: newLogType,
      intensity: newLogIntensity,
      durationMinutes: newLogDuration,
      trigger: newLogTrigger,
      response: newLogResponse,
      notes: newLogNotes || undefined,
      context: newLogContext,
      resolved: false,
    };

    setBehaviorLogs([logItem, ...behaviorLogs]);
    setNewLogTrigger("");
    setNewLogResponse("");
    setNewLogNotes("");
    alert("Behavior log saved to Dylan's developmental observation timeline.");
  };

  // Trigger analysis for logs
  const handleAnalyzeBehaviors = async () => {
    setIsAnalyzingBehavior(true);
    setApiError(null);
    try {
      const res = await fetch("/api/analyze-behavior", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logs: behaviorLogs, childProfile: childProfile }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.details || errData.error || "Failed to generate analysis");
      }

      const data = await res.json();
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
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeTopic: planChallengeTopic, childProfile: childProfile }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.details || errData.error || "Failed to generate plan");
      }

      const planData: ActionPlan = await res.json();
      planData.id = `plan-${Date.now()}`;
      setActionPlans([planData, ...actionPlans]);
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
      const res = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childName: childProfile.name,
          age: childProfile.age,
          topic: storyTopic,
          moral: storyMoral,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.details || errData.error || "Failed to write story");
      }

      const newStory: BedtimeStory = await res.json();
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
      const res = await fetch("/api/generate-handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childProfile: childProfile,
          logs: behaviorLogs,
          milestones: milestones,
          audience: handoffAudience,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.details || errData.error || "Failed to build briefing");
      }

      const briefData = await res.json();
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
    setBehaviorLogs((prev) => prev.map((l) => (l.id === id ? { ...l, resolved: !l.resolved } : l)));
  };

  // Toggle milestone checking
  const handleToggleMilestone = (id: string) => {
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, checked: !m.checked } : m)));
  };

  // Add a custom milestone to a chosen domain
  const addCustomMilestone = (title: string, domain: DevelopmentalDomainId) => {
    setMilestones((prev) => [
      ...prev,
      {
        id: `ms-${Date.now()}`,
        domain,
        ageGroup: "Custom",
        title,
        description: "Custom milestone added by parent.",
        checked: false,
        custom: true,
      },
    ]);
  };

  // Set a step's kanban status (todo / doing / done); keeps `completed` in sync.
  const setPlanStepStatus = (planId: string, phaseIdx: number, stepIdx: number, status: "todo" | "doing" | "done") => {
    setActionPlans((prev) =>
      prev.map((p) => {
        if (p.id !== planId) return p;
        const phases = p.phases.map((ph, phI) => {
          if (phI !== phaseIdx) return ph;
          const steps = ph.steps.map((st, stI) =>
            stI === stepIdx ? { ...st, status, completed: status === "done" } : st
          );
          return { ...ph, steps };
        });
        return { ...p, phases };
      })
    );
  };

  // Toggle checklist inside Action Phase
  const handleTogglePlanStep = (planId: string, phaseIdx: number, stepIdx: number) => {
    setActionPlans((prev) =>
      prev.map((p) => {
        if (p.id !== planId) return p;
        const updatedPhases = p.phases.map((ph, phI) => {
          if (phI !== phaseIdx) return ph;
          const updatedSteps = ph.steps.map((st, stI) => {
            if (stI !== stepIdx) return st;
            return { ...st, completed: !st.completed };
          });
          return { ...ph, steps: updatedSteps };
        });
        return { ...p, phases: updatedPhases };
      })
    );
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
    setBehaviorLogs,
    milestones,
    setMilestones,
    actionPlans,
    setActionPlans,
    currentStory,
    setCurrentStory,
    selectedLens,
    setSelectedLens,
    chatInput,
    setChatInput,
    chatMessages,
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
    toggleLogResolved,
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
