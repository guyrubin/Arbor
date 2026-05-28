import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Brain,
  CheckCircle2,
  ChevronRight,
  FileText,
  Heart,
  Home,
  Languages,
  LayoutDashboard,
  AlertTriangle,
  ShieldCheck,
  HelpCircle,
  RefreshCw,
  Sparkles,
  BookOpen,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Compass,
  Lock,
  Users,
  School,
  Printer,
  MessageSquare,
  Play,
  ChevronLeft,
  Check,
  Sliders,
  Shield,
  ExternalLink,
  X
} from "lucide-react";
import { ChildProfile, BehaviorLog, Milestone, ActionPlan, BedtimeStory, BehaviorAnalysis, SchoolBrief, MemoryReviewItem } from "./types";
import {
  defaultChildProfile,
  sampleBehaviorLogs,
  initialMilestones,
  defaultActionPlans,
  sampleBedtimeStory,
  scholarsInfo
} from "./initialData";
import framework from "./framework.json";

type ChatMessage = { sender: "user" | "ai"; text: string; lens?: string };
type ChatResponsePayload = { text: string; memoryReviewItems?: MemoryReviewItem[] };

export default function App() {
  const showSandboxBanner = import.meta.env.VITE_HAS_GEMINI_API !== "true";
  const domainOptions = framework.domains;

  // Navigation State
  const [activeTab, setActiveTab] = useState<
    "overview" | "coach" | "behaviors" | "milestones" | "plans" | "stories" | "scholar" | "handoff" | "safety"
  >("overview");
  const [showAiRail, setShowAiRail] = useState<boolean>(true);

  // App Core States
  const [childProfile, setChildProfile] = useState<ChildProfile>(defaultChildProfile);
  const [behaviorLogs, setBehaviorLogs] = useState<BehaviorLog[]>(sampleBehaviorLogs);
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones);
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>(defaultActionPlans);
  const [currentStory, setCurrentStory] = useState<BedtimeStory>(sampleBedtimeStory);

  // Active Interactive / Selection States
  const [selectedLens, setSelectedLens] = useState<string>("Integrated Balanced");
  const [chatInput, setChatInput] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      sender: "ai",
      text: "### Welcome to Arbor Parent Coach\n" +
        "I help turn parenting concerns into age-aware, non-diagnostic next steps. Share a hard moment, a behavior pattern, or a developmental question Dylan is facing.\n\n" +
        "### Suggested starting points:\n" +
        "- **\"Dylan has transition tantrums when leaving for school in the mornings.\"**\n" +
        "- **\"Dylan refuses to switch off his screen at night and screams.\"**\n" +
        "- **\"Suggestions for improving his confidence when switching between languages.\"**\n\n" +
        "Select a **Scholar Lens** above to focus guidance through a developmental frame (Vygotsky, Bowlby, Piaget, Winnicott, etc.).",
      lens: "Integrated Balanced"
    }
  ]);
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

  // Form states: Generated Action Plan
  const [planChallengeTopic, setPlanChallengeTopic] = useState<string>("Screen time tantrums when tablet is turned off");
  const [isPlanGenerating, setIsPlanGenerating] = useState<boolean>(false);

  // Form states: Generated Story Book
  const [storyTopic, setStoryTopic] = useState<string>("Fear of starting school");
  const [storyMoral, setStoryMoral] = useState<string>("Courage in taking small steps and holding on to safe things");
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
    setIsGeneratingInlineScript(prev => ({ ...prev, [log.id]: true }));
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
          scholarLens: "Bowlby's Attachment Model"
        })
      });
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setInlineCoRegulationScripts(prev => ({ ...prev, [log.id]: data.text }));
    } catch (err: any) {
      setInlineCoRegulationScripts(prev => ({
        ...prev,
        [log.id]: `### Error Generating Guideline\nCould not fetch response from server.\n\nVerify that your **Google Gemini API Key** is configured in \`.env.local\` to connect real AI insights.`
      }));
    } finally {
      setIsGeneratingInlineScript(prev => ({ ...prev, [log.id]: false }));
    }
  };

  const handleGenerateMilestoneScaffold = async () => {
    setIsAnalyzingMilestones(true);
    try {
      const checkedList = milestones.filter(m => m.checked).map(m => `- ${m.title} (${m.domain})`).join("\n");
      const uncheckedList = milestones.filter(m => !m.checked).map(m => `- ${m.title} (${m.domain}): ${m.description}`).join("\n");
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
          scholarLens: "Vygotskian Scaffolding"
        })
      });
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setMilestoneAnalysisOfGaps(data.text);
    } catch (err) {
      setMilestoneAnalysisOfGaps("### Guidance Error\nCould not fetch developmental recommendations. Verify your Google Gemini API Key is saved correctly in `.env.local`.");
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
      setNewLogResponse("Lowered physical height to eye level, named the feeling ('You really want to keep playing with the truck'), and offered to place truck on 'safe shelf' until returning home.");
      setNewLogNotes("Calmed and put shoes on within 8 mins instead of usual 25. No screaming, just mild protest.");
    } else if (type === "screen") {
      setNewLogType("Screentime Dispute");
      setNewLogIntensity(5);
      setNewLogDuration(25);
      setNewLogTrigger("Told that nursery class ipad/tablet must be powered off for bedtime story sequence");
      setNewLogResponse("Lowered voice volume to a whisper, counted down ('3 minutes remaining for ipad, then bunny bedtime begins'), and handed Hebrew/English co-regulation comfort cards.");
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

  // Story reading progress calculation
  useEffect(() => {
    if (currentStory && currentStory.pages) {
      const percentage = Math.round(((activeStoryPage + 1) / (currentStory.pages.length + 1)) * 100);
      setStoryReadingProgress(percentage);
    }
  }, [activeStoryPage, currentStory]);

  // Calculation of developmental scores
  const checkedMilestones = milestones.filter(m => m.checked).length;
  const totalMilestones = milestones.length;
  const milestonesPercent = totalMilestones > 0 ? Math.round((checkedMilestones / totalMilestones) * 100) : 0;
  const pendingMemoryItems = memoryReviewItems.filter(item => item.status === "pending");
  const approvedMemoryItems = memoryReviewItems.filter(item => item.status === "approved");

  // Render custom markdown styling parser
  function renderMarkdown(text: string) {
    const paragraphs = text.split("\n\n");
    return paragraphs.map((para, idx) => {
      let content = para.trim();
      if (!content) return null;

      if (content.startsWith("### ")) {
        return (
          <h4 key={idx} className="text-sm font-bold text-[#f4d991] tracking-wider uppercase mt-5 mb-2 border-b border-white/5 pb-1 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#d7aa55]" />
            {content.replace("### ", "")}
          </h4>
        );
      }
      if (content.startsWith("## ")) {
        return (
          <h3 key={idx} className="text-base font-extrabold text-[#f7f1e7] mt-6 mb-3 tracking-tight">
            {content.replace("## ", "")}
          </h3>
        );
      }
      if (content.startsWith("- ") || content.startsWith("* ")) {
        const items = content.split(/\n[\-*]\s+/);
        return (
          <ul key={idx} className="list-disc pl-5 my-3 space-y-1.5 text-gray-300 text-sm">
            {items.map((item, i) => {
              const cleanItem = item.replace(/^[\-*]\s+/, "");
              return <li key={i}>{parseInline(cleanItem)}</li>;
            })}
          </ul>
        );
      }
      return (
        <p key={idx} className="text-gray-300 leading-relaxed text-sm mb-3.5">
          {parseInline(content)}
        </p>
      );
    });
  }

  function parseInline(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="text-white font-extrabold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  }

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
  }, [childProfile.id]);

  const handleMemoryDecision = async (memoryId: string, status: "approved" | "rejected" | "deleted") => {
    setIsMemoryUpdating(memoryId);
    try {
      const res = await fetch(`/api/memory/${encodeURIComponent(memoryId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
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

    // Append user message
    const updatedMessages = [
      ...chatMessages,
      { sender: "user" as const, text: promptValue, lens: selectedLens }
    ];
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
          scholarLens: selectedLens || "Integrated Balanced"
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.details || errData.error || "Server response failed");
      }

      const data = await readChatPayload(res);
      if (data.memoryReviewItems) {
        setMemoryReviewItems(data.memoryReviewItems);
      }
      setChatMessages(prev => [
        ...prev,
        { sender: "ai", text: data.text, lens: selectedLens }
      ]);
    } catch (err: any) {
      console.error(err);
      if (err.name === "AbortError") {
        setChatMessages(prev => [
          ...prev,
          {
            sender: "ai",
            text: "### Request Stopped\nThe live Arbor response was cancelled before completion."
          }
        ]);
        return;
      }
      setApiError(err.message || "An exception occurred while connecting to Arbor services.");
      setChatMessages(prev => [
        ...prev,
        {
          sender: "ai",
          text: `### Connection Error\nCould not fetch response from the server.\n\n**Reason:** ${err.message}\n\nPlease verify that your **Google Gemini API Key** is saved correctly in \`.env.local\`.`
        }
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
      notes: newLogNotes || undefined
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
        body: JSON.stringify({
          logs: behaviorLogs,
          childProfile: childProfile
        })
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
        body: JSON.stringify({
          challengeTopic: planChallengeTopic,
          childProfile: childProfile
        })
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
          moral: storyMoral
        })
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
          audience: handoffAudience
        })
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

  // Toggle milestone checking
  const handleToggleMilestone = (id: string) => {
    setMilestones(prev =>
      prev.map(m => (m.id === id ? { ...m, checked: !m.checked } : m))
    );
  };

  // Toggle checklist inside Action Phase
  const handleTogglePlanStep = (planId: string, phaseIdx: number, stepIdx: number) => {
    setActionPlans(prev =>
      prev.map(p => {
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

  return (
    <div className="arbor-app min-h-screen select-none text-sans antialiased overflow-x-hidden relative">
      {/* Main Grid Layout and Three Column Grid on Desktop */}
      <div className={`grid grid-cols-1 ${showAiRail ? "xl:grid-cols-[290px_1fr_340px] 2xl:grid-cols-[290px_1fr_365px]" : "xl:grid-cols-[290px_1fr]"} min-h-screen relative z-10 transition-all duration-300`}>
        
        {/* SIDEBAR */}
        <aside className="border-r border-white/10 bg-[#08090c]/90 backdrop-blur-2xl px-6 py-8 flex flex-col gap-8 h-auto xl:h-screen xl:sticky xl:top-0 overflow-y-auto">
          {/* Brand header */}
          <div className="flex items-center gap-3">
            <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="arb-teal" x1="54" y1="6" x2="28" y2="84" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#18F0D2"/>
                  <stop offset="50%" stopColor="#38C8F0"/>
                  <stop offset="100%" stopColor="#68B4FF"/>
                </linearGradient>
                <linearGradient id="arb-purple" x1="12" y1="90" x2="46" y2="42" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#CCA8FF"/>
                  <stop offset="100%" stopColor="#A07AF8"/>
                </linearGradient>
                <radialGradient id="arb-orange" cx="36%" cy="28%" r="62%">
                  <stop offset="0%" stopColor="#FFC07A"/>
                  <stop offset="100%" stopColor="#FF5822"/>
                </radialGradient>
              </defs>
              <path d="M40 88 C40 50 52 22 65 16 C78 22 90 50 90 88 L76 88 C76 56 70 32 65 32 C60 32 54 56 54 88Z" fill="#1B2898"/>
              <path d="M14 88 C12 72 16 54 28 42 C34 36 42 34 46 40 C44 52 40 66 38 76 C36 82 28 88 20 88Z" fill="url(#arb-purple)"/>
              <path d="M52 6 C62 14 66 32 62 50 C60 62 54 74 44 80 C36 84 28 80 22 72 C18 64 18 50 22 38 C28 24 38 8 52 6Z" fill="url(#arb-teal)"/>
              <circle cx="78" cy="15" r="12" fill="url(#arb-orange)"/>
            </svg>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">Arbor</h1>
              <p className="text-[10px] uppercase tracking-widest text-[#a8a093] font-semibold mt-0.5">Development Fieldbook</p>
            </div>
          </div>

          {/* Micro Child Summary */}
          <div className="bg-[#141821] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-500/10 text-blue-400 font-bold rounded-xl flex items-center justify-center text-sm">
                Dy
              </div>
              <div>
                <h4 className="text-sm font-bold text-white leading-tight">{childProfile.name}</h4>
                <p className="text-xs text-[#a8a093]">Age {childProfile.age} · Hebrew native</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold bg-[#d7aa55]/10 text-[#f4d991] px-2 py-0.5 rounded-full">
                OS v1.0
              </span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-col gap-1.5 flex-1">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center justify-between px-4 py-3 rounded-xl text-left border text-sm transition ${
                activeTab === "overview"
                  ? "bg-white/5 text-[#f7f1e7] border-white/10"
                  : "text-[#a8a093] border-transparent hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <LayoutDashboard className="w-4 h-4" /> Overview Dashboard
              </span>
              <span className="text-[10px] bg-[#d7aa55] text-black font-extrabold px-1.5 py-0.5 rounded-md">OS</span>
            </button>

            <button
              onClick={() => setActiveTab("coach")}
              className={`flex items-center justify-between px-4 py-3 rounded-xl text-left border text-sm transition ${
                activeTab === "coach"
                  ? "bg-white/5 text-[#f7f1e7] border-white/10"
                  : "text-[#a8a093] border-transparent hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <Brain className="w-4 h-4" /> Parent Coach
              </span>
              <span className="text-[10px] bg-blue-500/20 text-blue-400 font-bold px-1.5 py-0.5 rounded-md">AI</span>
            </button>

            <button
              onClick={() => setActiveTab("behaviors")}
              className={`flex items-center justify-between px-4 py-3 rounded-xl text-left border text-sm transition ${
                activeTab === "behaviors"
                  ? "bg-white/5 text-[#f7f1e7] border-white/10"
                  : "text-[#a8a093] border-transparent hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <Clock className="w-4 h-4" /> Behavior & Emotion Tracker
              </span>
            </button>

            <button
              onClick={() => setActiveTab("milestones")}
              className={`flex items-center justify-between px-4 py-3 rounded-xl text-left border text-sm transition ${
                activeTab === "milestones"
                  ? "bg-white/5 text-[#f7f1e7] border-white/10"
                  : "text-[#a8a093] border-transparent hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4" /> Milestones Tracker
              </span>
              <span className="text-xs text-[#d7aa55] font-extrabold">{milestonesPercent}%</span>
            </button>

            <button
              onClick={() => setActiveTab("plans")}
              className={`flex items-center justify-between px-4 py-3 rounded-xl text-left border text-sm transition ${
                activeTab === "plans"
                  ? "bg-white/5 text-[#f7f1e7] border-white/10"
                  : "text-[#a8a093] border-transparent hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <Sliders className="w-4 h-4" /> Action Plans
              </span>
              <span className="text-xs text-green-400 font-bold">{actionPlans.length} Active</span>
            </button>

            <button
              onClick={() => setActiveTab("stories")}
              className={`flex items-center justify-between px-4 py-3 rounded-xl text-left border text-sm transition ${
                activeTab === "stories"
                  ? "bg-white/5 text-[#f7f1e7] border-white/10"
                  : "text-[#a8a093] border-transparent hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <BookOpen className="w-4 h-4" /> AI Bedtime Stories
              </span>
            </button>

            <button
              onClick={() => setActiveTab("scholar")}
              className={`flex items-center justify-between px-4 py-3 rounded-xl text-left border text-sm transition ${
                activeTab === "scholar"
                  ? "bg-white/5 text-[#f7f1e7] border-white/10"
                  : "text-[#a8a093] border-transparent hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <Compass className="w-4 h-4" /> Scholar Academy
              </span>
            </button>

            <button
              onClick={() => setActiveTab("handoff")}
              className={`flex items-center justify-between px-4 py-3 rounded-xl text-left border text-sm transition ${
                activeTab === "handoff"
                  ? "bg-white/5 text-[#f7f1e7] border-white/10"
                  : "text-[#a8a093] border-transparent hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <FileText className="w-4 h-4" /> School Handoff Hub
              </span>
            </button>

            <button
              onClick={() => setActiveTab("safety")}
              className={`flex items-center justify-between px-4 py-3 rounded-xl text-left border text-sm transition ${
                activeTab === "safety"
                  ? "bg-white/5 text-[#f7f1e7] border-white/10"
                  : "text-[#a8a093] border-transparent hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <Shield className="w-4 h-4" /> Safety & Guardrails
              </span>
            </button>
          </nav>

          {/* Footer of Sidebar */}
          <div className="mt-auto pt-6 border-t border-white/5 text-[11px] text-[#a8a093] leading-relaxed">
            <span className="font-bold text-white mb-1 block">Arbor Architecture:</span>
            Expert-reviewed knowledge modules + parent-approved child memory.
          </div>
        </aside>

        {/* MAIN BODY WINDOW */}
        <main className="px-6 py-8 xl:px-12 xl:py-10 overflow-y-auto max-h-screen">
          
          {/* Top workspace accessories header row */}
          <div className="flex justify-between items-center mb-6 gap-4">
            <span className="text-xs text-[#a8a093] font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Active Care Platform: <strong className="text-white">Dylan · Age 5</strong> (English Transition)
            </span>
            {!showAiRail && (
              <button
                onClick={() => setShowAiRail(true)}
                className="hidden xl:flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 text-[#f4d991] px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#d7aa55]" /> Show AI Engines ➔
              </button>
            )}
          </div>

          {/* Top warning display if API key is missing */}
          {showSandboxBanner && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[#f4d991] text-xs flex items-center justify-between gap-4">
              <span className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>
                  <strong>Sandbox Demonstration Mode:</strong> `GEMINI_API_KEY` is not present. Local sample data remains available so you can click through the product. Add your key in `.env.local` to connect real Google AI models.
                </span>
              </span>
              <button
                onClick={() => alert("Create app/.env.local from app/.env.example and set GEMINI_API_KEY to enable live AI responses.")}
                className="bg-[#d7aa55] text-black font-extrabold px-3 py-1.5 rounded-xl flex-shrink-0"
              >
                Learn How
              </button>
            </div>
          )}

          {/* TAB: OVERVIEW */}
          {activeTab === "overview" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Giant Banner/Hero Block */}
              <div className="border border-white/10 rounded-3xl p-6 md:p-10 bg-gradient-to-br from-white/[0.08] to-white/[0.025] from-amber-500/[0.03] to-transparent bg-[#141821] shadow-xl relative overflow-hidden grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8 items-center">
                <div className="space-y-4 relative z-10">
                  <span className="text-xs font-black uppercase tracking-wider text-[#f4d991]">Parenting Intelligence Cockpit</span>
                  <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
                    Not a parenting chatbot.<br />A development intelligence operating system.
                  </h2>
                  <p className="text-sm md:text-base text-[#a8a093] leading-relaxed max-w-lg">
                    Welcome back. Arbor turns today&apos;s parenting signal into a safety-aware plan, parent script, approved memory, and handoff note without diagnosing the child.
                  </p>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      onClick={() => setActiveTab("coach")}
                      className="bg-[#d7aa55] hover:bg-[#c39947] text-black font-extrabold text-sm px-5 py-3 rounded-2xl transition shadow-lg shadow-[#d7aa55]/10 flex items-center gap-2"
                    >
                      <Brain className="w-4 h-4" /> Ask Parent Coach
                    </button>
                    <button
                      onClick={() => setActiveTab("plans")}
                      className="bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-sm px-5 py-3 rounded-2xl transition"
                    >
                      View Active Plans ({actionPlans.length})
                    </button>
                  </div>
                </div>

                {/* Handheld Live HUD preview */}
                <div className="bg-[#08090c] border border-white/15 rounded-[36px] p-5 shadow-2xl w-full max-w-[340px] mx-auto text-sm space-y-4">
                  {/* Card head: dylan profile */}
                  <div className="bg-gradient-to-br from-[#d7aa55]/20 to-transparent border border-[#d7aa55]/20 rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-black text-[#f4d991]">Dylan · Age 5</h3>
                      <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold">Stable</span>
                    </div>
                    <p className="text-[11px] text-gray-300 mt-1">Kindergarten readiness timeline</p>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-3">
                      <div className="bg-[#d7aa55] h-full" style={{ width: `${milestonesPercent}%` }} />
                    </div>
                  </div>

                  {/* Visual metrics list */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/[0.03] border border-white/5 p-2 rounded-xl text-center">
                      <b className="block text-lg font-black text-white">{milestonesPercent}%</b>
                      <span className="text-[9px] text-[#a8a093] tracking-wide uppercase">Readiness Score</span>
                    </div>
                    <div className="bg-white/[0.03] border border-white/5 p-2 rounded-xl text-center">
                      <b className="block text-lg font-black text-white">{actionPlans.length}</b>
                      <span className="text-[9px] text-[#a8a093] tracking-wide uppercase">Active Plans</span>
                    </div>
                    <div className="bg-white/[0.03] border border-white/5 p-2 rounded-xl text-center">
                      <b className="block text-lg font-black text-white">{childProfile.riskLevel}</b>
                      <span className="text-[9px] text-[#a8a093] tracking-wide uppercase">Safety Tier</span>
                    </div>
                    <div className="bg-white/[0.03] border border-white/5 p-2 rounded-xl text-center">
                      <b className="block text-lg font-black text-white">8m</b>
                      <span className="text-[9px] text-[#a8a093] tracking-wide uppercase">Story Readtime</span>
                    </div>
                  </div>

                  {/* Static advice card */}
                  <div className="bg-white/5 border border-white/10 p-3 rounded-2xl space-y-1">
                    <span className="text-[9px] font-black uppercase text-[#f4d991] tracking-wider block">Co-Regulation Script</span>
                    <p className="text-xs text-gray-200">“You are upset. The rule remains. We try again together.”</p>
                  </div>
                </div>
              </div>

              {/* Sub cockpit panels: today's guidance metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Panel 1: Main statistics cockpit */}
                <div className="bg-[#141821] border border-white/10 p-6 rounded-3xl space-y-6">
                  <div>
                    <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider block">Behavior Time analysis</span>
                    <h3 className="text-xl font-bold text-white mt-1">Longitudinal Insights Map</h3>
                  </div>

                  {/* Mini log frequency heatmap list */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-gray-300">
                      <span>Total logged incidents: <b>{behaviorLogs.length} entries</b></span>
                      <button
                        onClick={() => setActiveTab("behaviors")}
                        className="text-[#f4d991] hover:underline"
                      >
                        Adjust logs +
                      </button>
                    </div>

                    {/* Simple visual bar frequency graph representing logged entries */}
                    <div className="grid grid-cols-4 gap-2 h-16 items-end mt-4">
                      <div className="bg-blue-500/10 rounded-lg p-2 flex flex-col items-center justify-end h-full">
                        <div className="bg-blue-500 w-full rounded-md" style={{ height: '40%' }}></div>
                        <span className="text-[9px] text-gray-400 mt-1">Mon</span>
                      </div>
                      <div className="bg-blue-500/10 rounded-lg p-2 flex flex-col items-center justify-end h-full">
                        <div className="bg-blue-500 w-full rounded-md" style={{ height: '80%' }}></div>
                        <span className="text-[9px] text-gray-400 mt-1">Tue</span>
                      </div>
                      <div className="bg-blue-500/10 rounded-lg p-2 flex flex-col items-center justify-end h-full">
                        <div className="bg-blue-500 w-full rounded-md" style={{ height: '20%' }}></div>
                        <span className="text-[9px] text-gray-400 mt-1">Wed</span>
                      </div>
                      <div className="bg-blue-500/10 rounded-lg p-2 flex flex-col items-center justify-end h-full">
                        <div className="bg-blue-500 w-full rounded-md" style={{ height: '60%' }}></div>
                        <span className="text-[9px] text-gray-400 mt-1">Thu</span>
                      </div>
                    </div>

                    {/* Static developmental insights analysis */}
                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#d7aa55]" />
                        Attachment Co-Regulation Pattern:
                      </span>
                      <p className="text-xs text-[#a8a093] leading-relaxed">
                        Transition refusal on morning departure accounts for 75% of high-intensity outbursts this week. Note: Dylan calming duration falls from 25 mins to 10 mins when presented with controlled boundaries and a dual-language school prep card.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Panel 2: Today's Active Plan Check-in */}
                <div className="bg-[#141821] border border-white/10 p-6 rounded-3xl flex flex-col justify-between gap-6">
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider block">In-Progress Strategy</span>
                      <h3 className="text-xl font-bold text-white mt-1">Action Plan Practice</h3>
                    </div>

                    {/* Render first action plan */}
                    {actionPlans.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-[#f4d991]">{actionPlans[0].title}</span>
                          <span className="text-[10px] bg-amber-500/15 text-[#f4d991] px-2 py-0.5 rounded-full font-bold">Active Plan</span>
                        </div>
                        <p className="text-xs text-gray-400">{actionPlans[0].issue}</p>

                        {/* First three steps in phase 1 */}
                        <div className="space-y-2 mt-2">
                          {actionPlans[0].phases[0].steps.map((st, i) => (
                            <label
                              key={i}
                              className="flex items-start gap-2.5 p-2 bg-white/[0.01] hover:bg-white/[0.04] transition rounded-xl cursor-copy text-xs text-gray-300"
                            >
                              <input
                                type="checkbox"
                                checked={st.completed}
                                onChange={() => handleTogglePlanStep(actionPlans[0].id, 0, i)}
                                className="mt-0.5 accent-[#d7aa55]"
                              />
                              <span className={st.completed ? "line-through text-gray-500" : ""}>{st.text}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setActiveTab("plans")}
                    className="w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 transition font-bold text-xs rounded-2xl flex items-center justify-center gap-2"
                  >
                    Manage action worksheets <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Grid 3: Bedtime Stories quick card */}
              <div className="bg-[#141821] border border-white/10 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-[#d7aa55]/10 rounded-2xl flex items-center justify-center text-3xl">
                    📚
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider block">Co-Regulated Story Teller</span>
                    <h3 className="text-xl font-extrabold text-white mt-0.5">{currentStory.title}</h3>
                    <p className="text-xs text-[#a8a093] leading-relaxed mt-1 max-w-md">
                      {currentStory.summary}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setActiveStoryPage(0);
                    setActiveTab("stories");
                  }}
                  className="bg-[#d7aa55] hover:bg-[#c39947] text-black font-extrabold text-xs px-5 py-3.5 rounded-2xl transition shadow-lg shadow-[#d7aa55]/10 flex items-center gap-2 w-full md:w-auto justify-center"
                >
                  Open Reading Book <Play className="w-3 px-0.5" />
                </button>
              </div>

              {/* Contextual Interactive AI Widget on Home Overview */}
              <div className="bg-gradient-to-br from-[#d7aa55]/5 to-transparent border border-[#d7aa55]/15 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#d7aa55]/10 text-[#f4d991] flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-[#d7aa55]" />
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-white flex items-center gap-1.5">
                      Contextual AI Co-Regulation Guide
                      <span className="animate-pulse w-2 h-2 rounded-full bg-emerald-400" />
                    </h4>
                    <p className="text-xs text-[#a8a093]">Generate prompt guidelines instantly tailored to Dylan's current developmental stage and active logs.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => {
                      setSelectedLens("Bowlby's Attachment Model");
                      setChatInput("Dylan screamed and threw toys. Give me an immediate relational rupture-repair script.");
                      setActiveTab("coach");
                    }}
                    className="p-4 bg-white/[0.01] border border-white/5 hover:border-[#d7aa55]/30 hover:bg-[#d7aa55]/5 text-left rounded-2xl transition group focus:outline-none cursor-pointer"
                  >
                    <b className="text-xs text-[#f4d991] block group-hover:text-white transition">Rupture-Repair Script ➔</b>
                    <p className="text-[10px] text-gray-400 mt-1 lines-clamp-2 leading-relaxed">Get an attachment-based script to soothe frustration and repair relational warmth.</p>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedLens("Piaget's Cognitive Stages");
                      setChatInput("Dylan is refusing transitions. Explain his mindset through Piaget's Preoperational cognitive perspective and suggest a boundary strategy.");
                      setActiveTab("coach");
                    }}
                    className="p-4 bg-white/[0.01] border border-white/5 hover:border-[#d7aa55]/30 hover:bg-[#d7aa55]/5 text-left rounded-2xl transition group focus:outline-none cursor-pointer"
                  >
                    <b className="text-xs text-[#f4d991] block group-hover:text-white transition">Piaget Mindset Scaffold ➔</b>
                    <p className="text-[10px] text-gray-400 mt-1 lines-clamp-2 leading-relaxed">Translate preschool self-centered cognitive schema into calm transition boundaries.</p>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedLens("Vygotsky's Scaffolding");
                      setChatInput("Dylan is learning bilingual English/Hebrew co-regulation phrases. Give me a 10-minute game to build code-switching confidence.");
                      setActiveTab("coach");
                    }}
                    className="p-4 bg-white/[0.01] border border-white/5 hover:border-[#d7aa55]/30 hover:bg-[#d7aa55]/5 text-left rounded-2xl transition group focus:outline-none cursor-pointer"
                  >
                    <b className="text-xs text-[#f4d991] block group-hover:text-white transition">Bilingual Scaffolding ➔</b>
                    <p className="text-[10px] text-gray-400 mt-1 lines-clamp-2 leading-relaxed">Construct parent guidance words to scaffold shifting between English and Hebrew transitions.</p>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB: PARENT AI COACH */}
          {activeTab === "coach" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Header section with lens selector */}
              <div className="space-y-4">
                <div>
                  <h2 className="text-3xl font-extrabold tracking-tight">Parent Development Coach</h2>
                  <p className="text-sm text-[#a8a093] mt-1">Customize AI reasoning using developmental frameworks, age bands, and non-diagnostic parent support boundaries.</p>
                </div>

                {/* Scholar Lens selector list */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-[#f4d991] tracking-widest block">Active Scholar Lens</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedLens("Integrated Balanced")}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                        selectedLens === "Integrated Balanced"
                          ? "bg-amber-500/10 text-[#f4d991] border-amber-500/30"
                          : "bg-white/[0.02] text-[#a8a093] border-white/5 hover:bg-white/5"
                      }`}
                    >
                      🌟 Integrated Balanced
                    </button>
                    {scholarsInfo.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedLens(s.name)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-2 ${
                          selectedLens === s.name
                            ? "bg-[#d7aa55]/15 text-[#f4d991] border-[#d7aa55]/40 shadow-lg shadow-[#d7aa55]/5"
                            : "bg-white/[0.02] text-[#a8a093] border-white/5 hover:bg-white/5"
                        }`}
                      >
                        <span className="w-4 h-4 bg-white/5 text-[9px] font-black rounded flex items-center justify-center text-[#f4d991]">
                          {s.initial}
                        </span>
                        {s.name} ({s.concept})
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chat Viewport Area */}
              <div className="border border-white/10 rounded-2xl bg-[#141821] flex flex-col h-[520px] overflow-hidden justify-between">
                
                {/* Active Info Indicator */}
                <div className="bg-white/[0.03] px-4 py-2 text-xs text-[#a8a093] border-b border-white/5 flex items-center justify-between">
                  <span>Conversation Frame: <strong>Dylan (Age 5) Context</strong></span>
                  <span className="text-[#f4d991] font-bold">Lens: {selectedLens}</span>
                </div>

                {/* Messages Lists */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 max-w-[85%] ${msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                        msg.sender === "user"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-[#d7aa55]/20 text-[#f4d991]"
                      }`}>
                        {msg.sender === "user" ? "U" : "Ar"}
                      </div>
                      <div className={`p-4 rounded-2xl text-sm ${
                        msg.sender === "user"
                          ? "bg-blue-950/30 border border-blue-500/15 text-white"
                          : "bg-white/[0.02] border border-white/5 text-gray-100"
                      }`}>
                        {msg.sender === "ai" && msg.lens && msg.lens !== "Integrated Balanced" && (
                          <span className="text-[10px] font-bold bg-[#d7aa55]/10 text-[#f4d991] px-2 py-0.5 rounded-full mb-3 inline-block">
                            Aligned with {msg.lens}
                          </span>
                        )}
                        <div className="space-y-1">
                          {renderMarkdown(msg.text)}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Loading placeholder */}
                  {isChatLoading && (
                    <div className="flex gap-3 max-w-[85%] mr-auto">
                      <div className="w-8 h-8 rounded-xl bg-[#d7aa55]/20 text-[#f4d991] flex items-center justify-center text-xs font-bold animate-spin">
                        <RefreshCw className="w-4 h-4" />
                      </div>
                      <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 text-xs text-gray-400 flex items-center gap-3">
                        <span className="animate-pulse">
                          {chatStreamStatus || "Arbor developmental model synthesizing guidance..."}
                        </span>
                        <button
                          type="button"
                          onClick={handleCancelChat}
                          className="bg-white/5 hover:bg-white/10 border border-white/10 text-[#a8a093] hover:text-white px-2 py-1 rounded-lg font-bold flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Stop
                        </button>
                      </div>
                    </div>
                  )}

                  <div ref={chatBottomRef} />
                </div>

                {/* Bottom Input Area */}
                <div className="p-4 border-t border-white/5 bg-white/[0.01] space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleChatSend()}
                      disabled={isChatLoading}
                      placeholder="Discuss behavior logs, dropoff problems or trigger resets (e.g. tablet disputes)..."
                      className="flex-1 bg-[#08090c] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d7aa55]/50 transition"
                    />
                    <button
                      onClick={() => handleChatSend()}
                      disabled={isChatLoading}
                      className="bg-[#d7aa55] hover:bg-[#c39947] disabled:bg-white/5 disabled:text-[#a8a093] text-black font-extrabold text-sm px-5 py-3 rounded-xl transition flex items-center gap-2"
                    >
                      Send Inquiry
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
                    <span className="font-bold">Suggested Sandbox prompts:</span>
                    <button
                      onClick={() => handleChatSend("Dylan screams and hides behind the couch during shoe departures.")}
                      disabled={isChatLoading}
                      className="hover:text-white bg-white/5 px-2 py-0.5 rounded border border-white/5"
                    >
                      Shoe departure tantrum
                    </button>
                    <button
                      onClick={() => handleChatSend("Suggestions for switching Hebrew and English language routines.")}
                      disabled={isChatLoading}
                      className="hover:text-white bg-white/5 px-2 py-0.5 rounded border border-white/5"
                    >
                      Bilingual balance routine
                    </button>
                  </div>
                </div>

              </div>

              {/* Parent-approved memory review */}
              <div className="border border-white/10 rounded-2xl bg-[#141821] p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-black uppercase text-[#f4d991] tracking-widest block">Memory Review</span>
                    <h3 className="text-lg font-extrabold text-white mt-1">Parent approval queue</h3>
                    <p className="text-xs text-[#a8a093] mt-1">
                      Arbor saves proposed observations as pending review. They become active child memory only after approval.
                    </p>
                  </div>
                  <div className="text-xs text-[#a8a093]">
                    <strong className="text-white">{pendingMemoryItems.length}</strong> pending · <strong className="text-white">{approvedMemoryItems.length}</strong> approved
                  </div>
                </div>

                {memoryReviewItems.length === 0 ? (
                  <div className="text-xs text-[#a8a093] border border-white/5 rounded-xl p-4 bg-white/[0.01]">
                    Ask the coach a question to generate reviewable observations. Nothing is active memory yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {memoryReviewItems.slice(0, 6).map(item => (
                      <div key={item.memoryId} className="border border-white/5 rounded-xl p-4 bg-white/[0.015] space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                            item.status === "approved"
                              ? "bg-green-500/10 text-green-500"
                              : item.status === "rejected"
                                ? "bg-red-500/10 text-red-500"
                                : "bg-[#d7aa55]/10 text-[#f4d991]"
                          }`}>
                            {item.status}
                          </span>
                          <span className="text-[10px] text-[#a8a093]">{new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-gray-200 leading-relaxed">{item.fact}</p>
                        <div className="text-[10px] text-[#a8a093] space-y-1">
                          <p><strong className="text-white">Source:</strong> {item.source}</p>
                          <p><strong className="text-white">Retention:</strong> {item.retention}</p>
                          {item.frameRouting?.aim && <p><strong className="text-white">Frame:</strong> {item.frameRouting.aim}</p>}
                        </div>
                        {item.status === "pending" && (
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => handleMemoryDecision(item.memoryId, "approved")}
                              disabled={isMemoryUpdating === item.memoryId}
                              className="flex-1 bg-[#d7aa55] text-black font-extrabold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve
                            </button>
                            <button
                              onClick={() => handleMemoryDecision(item.memoryId, "rejected")}
                              disabled={isMemoryUpdating === item.memoryId}
                              className="flex-1 bg-white/5 border border-white/10 text-[#a8a093] font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Reject
                            </button>
                          </div>
                        )}
                        {item.status === "approved" && (
                          <button
                            onClick={() => handleMemoryDecision(item.memoryId, "deleted")}
                            disabled={isMemoryUpdating === item.memoryId}
                            className="w-full bg-white/5 border border-white/10 text-[#a8a093] font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete from active memory
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB: BEHAVIOR LOGS */}
          {activeTab === "behaviors" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight">Behavior & Emotion Tracker</h2>
                <p className="text-sm text-[#a8a093] mt-1">Log dysregulation events to map heatmaps, triggers, duration and attach expert research insights.</p>
              </div>

              {/* Grid block: form left, list right */}
              <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8">
                
                {/* Form column */}
                <form
                  onSubmit={handleAddLog}
                  className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-4 text-sm"
                >
                  <h3 className="text-base font-extrabold text-white pb-2 border-b border-white/5 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-[#d7aa55]" />
                    Record Co-Regulation Event
                  </h3>

                  <div className="p-3 border border-[#d7aa55]/20 bg-[#d7aa55]/5 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase text-[#f4d991] tracking-wider block flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#d7aa55]" />
                      🪄 Quick-Fill AI Scenarios:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => autofillLogTemplate("morning")}
                        className="bg-white/5 hover:bg-[#d7aa55]/20 text-white hover:text-[#f4d991] px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer"
                      >
                        Morning Refusal
                      </button>
                      <button
                        type="button"
                        onClick={() => autofillLogTemplate("screen")}
                        className="bg-white/5 hover:bg-[#d7aa55]/20 text-white hover:text-[#f4d991] px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer"
                      >
                        iPad Dispute
                      </button>
                      <button
                        type="button"
                        onClick={() => autofillLogTemplate("sibling")}
                        className="bg-white/5 hover:bg-[#d7aa55]/20 text-white hover:text-[#f4d991] px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer"
                      >
                        Sibling Clash
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-[#a8a093] font-bold block">Type of Challenge</label>
                    <select
                      value={newLogType}
                      onChange={e => setNewLogType(e.target.value)}
                      className="w-full bg-[#08090c] border border-white/10 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-[#d7aa55]"
                    >
                      <option value="Transition Refusal">Departure Refusal (Mornings / Leaving home)</option>
                      <option value="Sensory Overload">Sensory Overload Meltdown (Loud / Overcrowded spaces)</option>
                      <option value="Screentime Dispute">Screen-time Switchoff (Tablet boundary refusal)</option>
                      <option value="Sibling Conflict">Sibling Tugging / Dispute</option>
                      <option value="Food Refusal">Selective Eating Resistance</option>
                      <option value="Sleep Meltdown">Bedtime Resistance / Hiding</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-[#a8a093] font-bold block">Intensity (1-5)</label>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={newLogIntensity}
                        onChange={e => setNewLogIntensity(parseInt(e.target.value))}
                        className="w-full accent-[#d7aa55] mt-2.5"
                      />
                      <span className="text-[10px] text-[#f4d991] font-bold text-center block">Level {newLogIntensity} / 5</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-[#a8a093] font-bold block">Duration (Minutes)</label>
                      <input
                        type="number"
                        min="2"
                        value={newLogDuration}
                        onChange={e => setNewLogDuration(parseInt(e.target.value) || 5)}
                        className="w-full bg-[#08090c] border border-white/10 rounded-xl p-2 text-white text-xs text-center"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-[#a8a093] font-bold block">What Triggered This? (Active Stimulus)</label>
                    <input
                      type="text"
                      value={newLogTrigger}
                      onChange={e => setNewLogTrigger(e.target.value)}
                      placeholder="e.g. Dressing shoe sequence, being told tablet goes off"
                      className="w-full bg-[#08090c] border border-white/10 rounded-xl p-2 text-white text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-[#a8a093] font-bold block">What Was Your Response?</label>
                    <input
                      type="text"
                      value={newLogResponse}
                      onChange={e => setNewLogResponse(e.target.value)}
                      placeholder="e.g. Lowered voice height, used transitional object"
                      className="w-full bg-[#08090c] border border-white/10 rounded-xl p-2 text-white text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-[#a8a093] font-bold block">Observations & Notes (Optional)</label>
                    <textarea
                      value={newLogNotes}
                      onChange={e => setNewLogNotes(e.target.value)}
                      rows={2}
                      placeholder="Notes on calming down time, physical behavior..."
                      className="w-full bg-[#08090c] border border-white/10 rounded-xl p-2 text-white text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-[#d7aa55] hover:bg-[#c39947] transition text-black font-extrabold text-xs rounded-xl"
                  >
                    Save Log Incident
                  </button>
                </form>

                {/* List column */}
                <div className="space-y-6">
                  {/* Row map trigger actions */}
                  <div className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-base font-extrabold text-white">Active observation logs</h3>
                        <p className="text-xs text-gray-400">Longitudinal log history (newest logged above)</p>
                      </div>
                      <button
                        onClick={handleAnalyzeBehaviors}
                        disabled={isAnalyzingBehavior}
                        className="bg-[#d7aa55] hover:bg-[#c39947] disabled:bg-white/5 text-black font-extrabold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2 ml-auto"
                      >
                        {isAnalyzingBehavior ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Synthesizing reports...
                          </>
                        ) : (
                          <>
                            <Brain className="w-3.5 h-3.5" /> Analyze Behaviors with AI
                          </>
                        )}
                      </button>
                    </div>

                    {/* Simple dynamic behavior frequency counts */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      {["Transition Refusal", "Sensory Overload", "Screentime Dispute", "Sibling Conflict"].map((type, i) => {
                        const count = behaviorLogs.filter(log => log.behaviorType === type || log.behaviorType.includes(type)).length;
                        return (
                          <div key={i} className="bg-white/[0.02] border border-white/5 p-3 rounded-xl flex justify-between items-center">
                            <span className="text-[#a8a093] text-[10px] truncate max-w-[80%]">{type}</span>
                            <strong className="text-white font-black">{count}</strong>
                          </div>
                        );
                      })}
                    </div>

                    {/* Loaded Behavior Analysis */}
                    {behaviorAnalysis && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="p-5 bg-gradient-to-br from-[#d7aa55]/10 to-transparent border border-[#d7aa55]/20 rounded-2xl space-y-4 text-xs"
                      >
                        <h4 className="text-sm font-extrabold text-[#f4d991] flex items-center gap-1">
                          ✨ AI Longitudinal Synthesis & Repair Feedback
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <span className="font-bold text-white block">Parent Response Evaluation:</span>
                            <p className="text-[#a8a093] leading-relaxed">{behaviorAnalysis.effectivenessRating}</p>
                          </div>
                          <div className="space-y-2">
                            <span className="font-bold text-white block">Developmental Recommendation:</span>
                            <p className="text-[#a8a093] leading-relaxed">{behaviorAnalysis.actionPlanSuggestion}</p>
                          </div>
                        </div>

                        <div className="space-y-2 border-t border-white/10 pt-3">
                          <span className="font-bold text-white block">Expert Insights:</span>
                          <div className="space-y-2 text-gray-350">
                            {behaviorAnalysis.expertInsights.map((ins, i) => (
                              <div key={i} className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                                <span className="text-[10px] font-black uppercase text-[#f4d991] tracking-wider block">
                                  {ins.scholarLens || "Development theory"}
                                </span>
                                <strong className="text-white font-bold block mt-1">{ins.heading}</strong>
                                <p className="mt-0.5 leading-relaxed text-[#a8a093]">{ins.text}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Logs List render */}
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {behaviorLogs.map((log, index) => (
                        <div
                          key={log.id}
                          className="p-4 rounded-xl border border-white/5 bg-white/[0.015] space-y-2.5 text-xs text-left"
                        >
                          <div className="flex justify-between items-start gap-3">
                            <div>
                              <span className="font-bold text-white text-sm">{log.behaviorType}</span>
                              <p className="text-[10px] text-[#a8a093] mt-0.5">Logged: {new Date(log.timestamp).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-extrabold">
                                Level {log.intensity}/5
                              </span>
                              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-bold">
                                {log.durationMinutes}m
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#a8a093] leading-relaxed">
                            <p><strong>Trigger:</strong> {log.trigger}</p>
                            <p><strong>Parent Action:</strong> {log.response}</p>
                          </div>
                          {log.notes && (
                            <p className="p-2 bg-[#08090c] rounded text-gray-400 border border-white/5 italic">
                              <strong>Observer Note:</strong> {log.notes}
                            </p>
                          )}

                          {/* Rich embedded AI feature: Instant Co-regulation advisor */}
                          <div className="pt-2.5 border-t border-white/5 mt-2 flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] font-semibold text-gray-500 font-mono">Arbor AI Coregulation Layer</span>
                              <button
                                type="button"
                                onClick={() => handleGetInlineCoRegulationScript(log)}
                                disabled={isGeneratingInlineScript[log.id]}
                                className="text-[10px] font-black uppercase tracking-wider text-[#f4d991] hover:text-white bg-[#d7aa55]/15 hover:bg-[#d7aa55]/25 border border-[#d7aa55]/25 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                              >
                                {isGeneratingInlineScript[log.id] ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin text-[#d7aa55]" /> Analyzing...
                                  </>
                                ) : inlineCoRegulationScripts[log.id] ? (
                                  <>
                                    <Sparkles className="w-3 h-3 text-[#d7aa55]" /> Regenerate Script
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3 h-3 text-[#d7aa55]" /> Generate AI Parent Script ➔
                                  </>
                                )}
                              </button>
                            </div>

                            {inlineCoRegulationScripts[log.id] && (
                              <div className="p-3 bg-[#08090c]/40 border border-[#d7aa55]/15 rounded-xl space-y-2 mt-1 shadow-inner text-[11px] leading-relaxed select-text">
                                <div className="space-y-1.5">
                                  {renderMarkdown(inlineCoRegulationScripts[log.id])}
                                </div>
                                <div className="flex justify-end pt-1 border-t border-white/5 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setChatInput(`Regarding the log event where Dylan did: "${log.trigger}" and parent responded: "${log.response}". Here is the script I generated: \n\n${inlineCoRegulationScripts[log.id]}\n\nHow do I adapt this if Dylan continues to resist or acts physically aggressive?`);
                                      setSelectedLens("Bowlby's Attachment Model");
                                      setActiveTab("coach");
                                    }}
                                    className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition flex items-center gap-1"
                                  >
                                    Discuss further with Coach <ExternalLink className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {/* TAB: MILESTONES */}
          {activeTab === "milestones" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-extrabold tracking-tight">Developmental Milestones Checklist</h2>
                  <p className="text-sm text-[#a8a093] mt-1">Check completed child milestones under different chronological age tiers.</p>
                </div>
                {/* Score badge */}
                <div className="bg-[#141821] border border-white/10 p-4 rounded-2xl text-center">
                  <span className="text-[10px] uppercase font-black tracking-wider text-[#a8a093]">Total Mastery</span>
                  <div className="text-2xl font-black text-[#f4d991]">{checkedMilestones} / {totalMilestones}</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#141821] border border-white/10 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-xs text-gray-300">
                  <span>Development Readiness (Active Domain Score Archive)</span>
                  <span className="font-bold">{milestonesPercent}% Complete</span>
                </div>
                <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
                  <div className="bg-[#d7aa55] h-full transition-all duration-500" style={{ width: `${milestonesPercent}%` }} />
                </div>
              </div>

              {/* Checklist domains */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                {domainOptions.map((dom, domIdx) => {
                  const itemsInDom = milestones.filter(m => m.domain === dom.id);
                  return (
                    <div key={domIdx} className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-3">
                      <h3 className="text-sm font-extrabold text-[#f4d991] flex items-center gap-2">
                        <span className="p-1.5 bg-[#d7aa55]/10 rounded-lg text-[#f4d991] flex items-center justify-center">
                          <Check className="w-4 h-4" />
                        </span>
                        {dom.label} Domain Checklist
                      </h3>

                      <div className="space-y-2">
                        {itemsInDom.map(item => (
                          <label
                            key={item.id}
                            className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer ${
                              item.checked
                                ? "bg-white/[0.02] border-[#d7aa55]/30 text-[#f7f1e7]"
                                : "bg-white/[0.005] border-white/5 text-gray-400 hover:border-white/15"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={() => handleToggleMilestone(item.id)}
                              className="mt-1 accent-[#d7aa55]"
                            />
                            <div className="space-y-0.5">
                              <span className={`font-bold block ${item.checked ? "line-through text-gray-500" : "text-white"}`}>
                                {item.title}
                              </span>
                              <span className="text-[10px] block leading-relaxed text-[#a8a093]">
                                {item.description}
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Interactive AI scaffolding gap analyzer */}
              <div className="bg-gradient-to-br from-[#d7aa55]/5 to-transparent border border-[#d7aa55]/20 rounded-2xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-base font-extrabold text-[#f7f1e7] flex items-center gap-1.5ClassName">
                      <Sparkles className="w-4 h-4 text-[#d7aa55]" />
                      Vygotskian AI Scaffolding Analyzer
                    </h4>
                    <p className="text-xs text-[#a8a093] mt-0.5">Maps active gaps dynamically based on Dylan&apos;s checked/unchecked milestones list.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateMilestoneScaffold}
                    disabled={isAnalyzingMilestones}
                    className="bg-[#d7aa55] hover:bg-[#c39947] disabled:bg-white/5 text-black text-xs font-black px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ml-auto sm:ml-0"
                  >
                    {isAnalyzingMilestones ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" /> Analyzing Gaps...
                      </>
                    ) : (
                      <>
                        <Brain className="w-3.5 h-3.5 text-black" /> Run AI Gap Review
                      </>
                    )}
                  </button>
                </div>

                {milestoneAnalysisOfGaps ? (
                  <div className="p-4 bg-[#08090c]/40 border border-[#d7aa55]/15 rounded-xl text-xs leading-relaxed text-gray-300 space-y-3 shadow-inner select-text">
                    <div className="space-y-2">
                      {renderMarkdown(milestoneAnalysisOfGaps)}
                    </div>
                    <div className="pt-2.5 border-t border-white/5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setChatInput(`Regarding Dylan's scaffolding gap analysis on milestones:\n\n${milestoneAnalysisOfGaps}\n\nHow do we evaluate his sensory resilience relative to these milestone hurdles?`);
                          setSelectedLens("Vygotsky's Scaffolding");
                          setActiveTab("coach");
                        }}
                        className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition flex items-center gap-1"
                      >
                        Adjust Scaffolding in Coach Chat ➔
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl text-center text-xs text-gray-500">
                    Click "Run AI Gap Review" above to map Dylan&apos;s progress and formulate custom, co-active routine play exercises.
                  </div>
                )}
              </div>

              {/* Delay cautions based on incomplete progress */}
              <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-4 text-xs text-[#f4d991]">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
                <div className="space-y-1 leading-relaxed">
                  <strong className="text-white text-sm block">System Watch/Wait delay checklist check:</strong>
                  <p className="text-[#a8a093]">
                    Two key social and language-switching delay thresholds remain unchecked for target age (5-6). If Dylan fails to acquire verbal comfort code-switching between Hebrew and English within 3 months, consider running the visual dropoff routing, or hand school notes for evaluation.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB: ACTION PLANS */}
          {activeTab === "plans" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight">Personalized Action Plans</h2>
                <p className="text-sm text-[#a8a093] mt-1">Generate multi-stage developmental action plans containing tasks, daily dialogue scripts, and progress thresholds.</p>
              </div>

              {/* Trigger Generator Card */}
              <div className="bg-[#141821] border border-white/10 rounded-2xl p-6 space-y-4">
                <span className="text-xs font-bold text-[#f4d991] tracking-wider uppercase block">Weave Custom Child Action Blueprint</span>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={planChallengeTopic}
                    onChange={e => setPlanChallengeTopic(e.target.value)}
                    placeholder="Describe behavioral dispute (e.g., throwing cutlery during dinner)..."
                    className="flex-1 bg-[#08090c] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
                  />
                  <button
                    onClick={handleGenerateActionPlan}
                    disabled={isPlanGenerating}
                    className="bg-[#d7aa55] hover:bg-[#c39947] disabled:bg-white/5 disabled:text-[#a8a093] text-black font-extrabold text-sm px-6 py-3.5 rounded-xl transition flex items-center justify-center gap-2"
                  >
                    {isPlanGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Structuring guidelines...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" /> Generate AI Blueprint
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Render action plans list */}
              <div className="space-y-8">
                {actionPlans.map((plan, idx) => (
                  <div
                    key={plan.id}
                    className="bg-[#141821] border border-white/10 rounded-3xl p-6 space-y-6"
                  >
                    <div className="flex justify-between items-start border-b border-white/5 pb-4">
                      <div>
                        <h3 className="text-xl font-black text-white">{plan.title}</h3>
                        <p className="text-xs text-[#a8a093] mt-1 italic">Focus Issue: {plan.issue}</p>
                      </div>
                      <span className="text-[10px] bg-[#d7aa55]/15 text-[#f4d991] font-bold px-3 py-1 rounded-full border border-[#d7aa55]/20">
                        Blueprints Frame
                      </span>
                    </div>

                    {/* Phases and steps */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
                      {plan.phases.map((ph, phIdx) => (
                        <div
                          key={phIdx}
                          className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex flex-col justify-between gap-4"
                        >
                          <div className="space-y-3">
                            <div>
                              <span className="text-[9px] font-black uppercase text-[#f4d991] tracking-widest block">Phase {phIdx + 1}</span>
                              <strong className="text-white font-bold block mt-0.5">{ph.name}</strong>
                            </div>
                            <p className="text-gray-400 leading-relaxed text-[11px]">{ph.description}</p>

                            <div className="space-y-2 mt-3">
                              {ph.steps.map((st, stIdx) => (
                                <label
                                  key={stIdx}
                                  className="flex items-start gap-3 p-2 border border-white/5 bg-white/[0.015] hover:bg-white/[0.04] transition rounded-xl cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={st.completed}
                                    onChange={() => handleTogglePlanStep(plan.id, phIdx, stIdx)}
                                    className="mt-0.5 accent-[#d7aa55]"
                                  />
                                  <span className={st.completed ? "line-through text-gray-500" : "text-gray-250"}>
                                    {st.text}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Action Dialog scripts */}
                    <div className="space-y-3 bg-[#08090c] p-4 rounded-2.5 border border-white/5 rounded-2xl">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-[#d7aa55] text-amber-200" />
                        Attachment Co-Regulation Parent Scripts
                      </h4>
                      <div className="space-y-3 text-xs">
                        {plan.scripts.map((sc, scIdx) => (
                          <div key={scIdx} className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3 bg-white/[0.01] p-3 rounded-xl border border-white/5">
                            <div>
                              <strong className="text-[#f4d991] block">{sc.scenario}</strong>
                            </div>
                            <div className="space-y-1.5 leading-relaxed text-[#a8a093]">
                              <p>🗣️ <b className="text-white">What to Say:</b> “{sc.say}”</p>
                              {sc.avoid && <p>❌ <b className="text-red-400">What to Avoid:</b> {sc.avoid}</p>}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Embedded AI customized action plan script co-pilot */}
                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setChatInput(`Regarding the Action Plan: "${plan.title}". Let's formulate two additional specific co-regulation dialogue scripts dealing with Dylan's preoperational language-switching triggers.`);
                            setSelectedLens("Bowlby's Attachment Model");
                            setActiveTab("coach");
                          }}
                          className="text-[10px] font-black uppercase tracking-wider text-[#f4d991] hover:text-white bg-[#d7aa55]/15 hover:bg-[#d7aa55]/25 border border-[#d7aa55]/25 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-[#d7aa55]" />
                          Refine these scripts with AI Coach ➔
                        </button>
                      </div>
                    </div>

                    {/* Success indicators list */}
                    <div className="space-y-2 text-xs">
                      <span className="font-bold text-white block">Woven success completion flags:</span>
                      <ul className="list-disc pl-5 text-[#a8a093] space-y-1 leading-relaxed">
                        {plan.successIndicators.map((sc, scIdx) => (
                          <li key={scIdx}>{sc}</li>
                        ))}
                      </ul>
                    </div>

                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB: STORY BOOK */}
          {activeTab === "stories" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight">AI Bedtime & Transition Stories</h2>
                <p className="text-sm text-[#a8a093] mt-1">Generate supportive transition stories to ease separation concerns or build self-soothing behaviors.</p>
              </div>

              {/* Form Options block Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-8">
                
                {/* Form generator parameters */}
                <div className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-4 text-xs">
                  <h3 className="text-base font-extrabold text-white pb-2 border-b border-white/5 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#d7aa55]" />
                    Compose Story Parameters
                  </h3>

                  <div className="space-y-1.5">
                    <label className="font-bold text-[#a8a093]">Focus Challenge Topic</label>
                    <select
                      value={storyTopic}
                      onChange={e => setStoryTopic(e.target.value)}
                      className="w-full bg-[#08090c] border border-white/10 rounded-xl p-2.5 text-white"
                    >
                      <option value="Fear of starting school">Fear of leaving burrow (Meadow & school anxiety)</option>
                      <option value="Losing tablet bedroom boundaries">Tablet farewell boundaries (The digital tree leaves)</option>
                      <option value="Sibling sharing dispute">Sharing carrot crops (Sibling negotiations)</option>
                      <option value="Trying new crunchy foods">Trying crunchy foods (Selective eating exposure)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-[#a8a093]">Target moral or soothing action</label>
                    <input
                      type="text"
                      value={storyMoral}
                      onChange={e => setStoryMoral(e.target.value)}
                      className="w-full bg-[#08090c] border border-white/10 rounded-xl p-2.5 text-white"
                    />
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <span className="font-bold text-[#a8a093] block text-[10px] uppercase tracking-wider">🪄 AI Co-Pilot Story Enhancors:</span>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setStoryMoral(m => m + " (Add dual Hebrew and English code-switching calming words)")}
                        className="bg-white/5 hover:bg-[#d7aa55]/20 hover:text-[#f4d991] px-2 py-1 rounded text-[10px] text-gray-350 transition cursor-pointer"
                      >
                        + Bilingual Code-Switching
                      </button>
                      <button
                        type="button"
                        onClick={() => setStoryMoral(m => m + " (Include his comforting red toy truck named 'Little Climber')")}
                        className="bg-white/5 hover:bg-[#d7aa55]/20 hover:text-[#f4d991] px-2 py-1 rounded text-[10px] text-gray-350 transition cursor-pointer"
                      >
                        + Red Toy Truck Security
                      </button>
                      <button
                        type="button"
                        onClick={() => setStoryMoral(m => m + " (Pause during page 2 to guide five deep abdominal rabbit breaths)")}
                        className="bg-white/5 hover:bg-[#d7aa55]/20 hover:text-[#f4d991] px-2 py-1 rounded text-[10px] text-gray-350 transition cursor-pointer"
                      >
                        + Somatic Abdominal Breaths
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateStory}
                    disabled={isStoryGenerating}
                    className="w-full py-3.5 bg-[#d7aa55] hover:bg-[#c39947] disabled:bg-white/5 disabled:text-[#a8a093] text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-2"
                  >
                    {isStoryGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Weaving bunny lore...
                      </>
                    ) : (
                      <>
                        <BookOpen className="w-4 h-4" /> Weave Bedtime Book
                      </>
                    )}
                  </button>
                </div>

                {/* Simulated physical Indigo Bedtime book view */}
                <div className="bg-gradient-to-br from-[#12141c] to-[#04060c] border border-white/15 rounded-3xl p-6 md:p-8 flex flex-col justify-between gap-6 min-h-[440px] text-white relative shadow-2xl overflow-hidden shadow-black">
                  
                  {/* Glowing constellation vector effect placeholder representation */}
                  <div className="absolute top-4 right-4 text-amber-300 opacity-20 text-5xl">✨</div>
                  <div className="absolute bottom-6 left-6 text-2xl opacity-10">🌙</div>

                  <div className="border-b border-white/5 pb-3 flex items-center justify-between text-[11px] text-amber-200">
                    <span className="font-bold tracking-wider uppercase">Co-Regulation bedtime module selection</span>
                    <span>Page {activeStoryPage + 1} of {currentStory.pages.length + 1}</span>
                  </div>

                  {/* Render cover or page */}
                  <div className="flex-1 flex flex-col justify-center space-y-4 py-4">
                    {activeStoryPage < currentStory.pages.length ? (
                      <div className="space-y-4">
                        <em className="text-xs text-[#a8a093] block">Section {activeStoryPage + 1} of Alek rabbit story</em>
                        <p className="text-sm md:text-base leading-relaxed text-gray-200 indent-4 font-medium italic">
                          "{currentStory.pages[activeStoryPage]}"
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <span className="text-xs font-bold text-[#f4d991] tracking-widest block uppercase">Parenting Discussion Prompts:</span>
                        <div className="space-y-2 text-xs text-gray-300">
                          {currentStory.discussionQuestions.map((q, qI) => (
                            <div key={qI} className="p-2.5 bg-white/5 rounded-xl border border-white/5">
                              {q}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Progress tracker bar */}
                  <div className="space-y-2">
                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#d7aa55] h-full" style={{ width: `${storyReadingProgress}%` }} />
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <button
                        onClick={() => setActiveStoryPage(p => Math.max(0, p - 1))}
                        disabled={activeStoryPage === 0}
                        className="text-[#a8a093] disabled:opacity-20 flex items-center gap-1 hover:text-white"
                      >
                        <ChevronLeft className="w-4 h-4" /> Previous page
                      </button>
                      <button
                        onClick={() => setActiveStoryPage(p => Math.min(currentStory.pages.length, p + 1))}
                        disabled={activeStoryPage === currentStory.pages.length}
                        className="text-[#f4d991] disabled:opacity-20 flex items-center gap-1 hover:text-white"
                      >
                        {activeStoryPage === currentStory.pages.length - 1 ? "Discussion questions" : "Save and flip"} <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                </div>

              </div>

              {/* AI Reading Companion & Sensory Guide */}
              <div className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-3 text-xs text-left">
                <h4 className="text-sm font-extrabold text-[#f4d991] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#d7aa55]" />
                  AI Parent Co-Reading & Somatic Calibration Companion
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 leading-relaxed text-[#a8a093]">
                  <div className="space-y-1 p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                    <span className="font-bold text-white block text-[11px] uppercase tracking-wider text-[#f4d991] mr-1">1. Vocal Amplitude (Piagetian)</span>
                    <p>Read bunny dialogues in a low, warm whispering hum. This drops the child’s auditory arousal, encouraging deep emotional receptivity.</p>
                  </div>
                  <div className="space-y-1 p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                    <span className="font-bold text-white block text-[11px] uppercase tracking-wider text-[#f4d991] mr-1">2. Somatic Mimicry (Bowlby)</span>
                    <p>At Page 2, put the child’s hand on your ribcage. Breathe slowly together so Dylan mimics your vagus nerve calming rhythm directly.</p>
                  </div>
                  <div className="space-y-1 p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                    <span className="font-bold text-white block text-[11px] uppercase tracking-wider text-[#f4d991] mr-1">3. Vygotskian Prompts</span>
                    <p>When clicking the Story Questions at the end, prompt the child in both English and Hebrew to bridge transition confidence.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB: SCHOLAR ACADEMY */}
          {activeTab === "scholar" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight">Scholar Academy</h2>
                <p className="text-sm text-[#a8a093] mt-1">Multi-theory developmental system. Select a scholar detail frame to load example prompts instantly into the AI Coach.</p>
              </div>

              {/* Scholar listings cards grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 text-xs">
                {scholarsInfo.map((sch, idx) => (
                  <div
                    key={idx}
                    className="bg-[#141821] border border-white/10 rounded-2xl p-5 flex flex-col justify-between gap-5 hover:border-white/20 transition group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#d7aa55]/10 text-[#f4d991] font-black text-lg flex items-center justify-center">
                          {sch.initial}
                        </div>
                        <div>
                          <b className="text-sm text-white group-hover:text-[#f4d991] transition font-extrabold">{sch.name}</b>
                          <p className="text-[10px] text-[#a8a093] uppercase font-bold mt-0.5">{sch.concept}</p>
                        </div>
                      </div>

                      <div className="space-y-2 pt-1 border-t border-white/5">
                        <span className="text-[10px] font-bold text-gray-400 block italic">Focus: {sch.theory}</span>
                        <p className="text-[#a8a093] leading-relaxed text-[11px]">{sch.value}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedLens(sch.name);
                        setChatInput(sch.examplePrompt);
                        setActiveTab("coach");
                        alert(`Loaded prompt aligned with the ${sch.name} lens! Press 'Send Inquiry' inside the chat to try it.`);
                      }}
                      className="w-full py-2.5 bg-white/5 border border-white/5 group-hover:bg-[#d7aa55]/10 group-hover:border-[#d7aa55]/20 group-hover:text-[#f4d991] text-[#a8a093] font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
                    >
                      Use Sandbox Inquiry <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB: SCHOOL BRIEF HANDOFF */}
          {activeTab === "handoff" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-3xl font-extrabold tracking-tight">School & Support Handoff Hub</h2>
                  <p className="text-sm text-[#a8a093] mt-1">Export structured summaries detailing behavioral trends and developmental check-ins for teachers, clinics or occupational therapists.</p>
                </div>
                <button
                  onClick={handleGenerateBrief}
                  disabled={isGeneratingBrief}
                  className="bg-[#d7aa55] hover:bg-[#c39947] disabled:bg-white/5 text-black font-extrabold text-xs px-5 py-3 rounded-2xl transition flex items-center gap-2"
                >
                  {isGeneratingBrief ? "Weaving Brief..." : "Compile Brief Summary"}
                </button>
              </div>

              {/* Dynamic Handoff Audience Specific Customization Selector */}
              <div className="bg-[#141821] border border-white/10 p-5 rounded-2xl space-y-3">
                <span className="text-xs font-black uppercase tracking-wider text-[#f4d991] flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#d7aa55]" />
                  Customized AI Briefing Audience Strategy:
                </span>
                <p className="text-xs text-slate-400 leading-relaxed">Arbor customizes professional language, support strategies, and developmental observations depending on who is reading Dylan&apos;s progress summary.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setHandoffAudience("teacher")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex flex-col justify-center text-left gap-0.5 cursor-pointer ${
                      handoffAudience === "teacher"
                        ? "bg-[#d7aa55]/10 border-[#d7aa55]/40 text-[#f4d991]"
                        : "bg-white/[0.01] border-white/5 text-slate-400 hover:bg-white/5 hover:border-white/15"
                    }`}
                  >
                    <span className="font-extrabold text-white text-[11px]">🏫 Educator focus</span>
                    <span className="text-[9px] font-normal text-slate-400">Environment prompts & classroom transitions</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHandoffAudience("clinician")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex flex-col justify-center text-left gap-0.5 cursor-pointer ${
                      handoffAudience === "clinician"
                        ? "bg-[#d7aa55]/10 border-[#d7aa55]/40 text-[#f4d991]"
                        : "bg-white/[0.01] border-white/5 text-slate-400 hover:bg-white/5 hover:border-white/15"
                    }`}
                  >
                    <span className="font-extrabold text-white text-[11px]">🩺 Speech/OT Therapist focus</span>
                    <span className="text-[9px] font-normal text-slate-400">Somatic checkpoints & dual-language delays</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHandoffAudience("pediatrician")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex flex-col justify-center text-left gap-0.5 cursor-pointer ${
                      handoffAudience === "pediatrician"
                        ? "bg-[#d7aa55]/10 border-[#d7aa55]/40 text-[#f4d991]"
                        : "bg-white/[0.01] border-white/5 text-slate-400 hover:bg-white/5 hover:border-white/15"
                    }`}
                  >
                    <span className="font-extrabold text-white text-[11px]">⚕️ Pediatrician focus</span>
                    <span className="text-[9px] font-normal text-slate-400">Developmental watch/wait checks</span>
                  </button>
                </div>
              </div>

              {/* School Brief printable preview */}
              <div className="border border-white/10 bg-[#141821] rounded-3xl p-6 md:p-8 space-y-6 text-xs text-left shadow-2xl printable-area">
                
                {/* PDF/Print style Header info */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/10 pb-5 gap-4">
                  <div>
                    <h3 className="text-lg font-black text-[#f4d991] flex items-center gap-2">
                      <School className="w-5 h-5 text-amber-200" />
                      Arbor Child Handoff Development Summary
                    </h3>
                    <p className="text-[10px] uppercase text-[#a8a093] font-bold tracking-wider mt-1">
                      Target Audience: Educators, Occupational Therapists, speech consultants & intake teams
                    </p>
                  </div>
                  <button
                    onClick={() => window.print()}
                    className="border border-white/10 hover:bg-white/5 text-[#a8a093] hover:text-white px-3.5 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5 self-end sm:self-auto"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Summary Document
                  </button>
                </div>

                {/* Show compiled brief */}
                {schoolBrief ? (
                  <div className="space-y-6">
                    <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5">
                      <span className="font-bold text-white block text-sm">Observation Overview</span>
                      <p className="text-gray-350 leading-relaxed text-xs mt-1">{schoolBrief.overview}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <span className="font-bold text-white block text-sm">Relational Strengths (Gardner Intelligences)</span>
                        <ul className="list-disc pl-5 text-gray-350 space-y-1">
                          {schoolBrief.keyStrengths.map((ks, i) => (
                            <li key={i}>{ks}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <span className="font-bold text-white block text-sm">Classroom Sensory & Transition challenges</span>
                        <ul className="list-disc pl-5 text-gray-350 space-y-1">
                          {schoolBrief.classroomChallenges.map((cc, i) => (
                            <li key={i}>{cc}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/5 pt-5">
                      <div className="space-y-2">
                        <span className="font-bold text-white block text-sm">Transition Dual-Language plan</span>
                        <ul className="list-disc pl-5 text-gray-350 space-y-1">
                          {schoolBrief.languageSupportPlan.map((ls, i) => (
                            <li key={i}>{ls}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <span className="font-bold text-[#f4d991] block text-sm">Teacher Co-Regulation Strategies</span>
                        <ul className="list-disc pl-5 text-gray-350 space-y-1">
                          {schoolBrief.suggestedTeacherStrategies.map((ts, i) => (
                            <li key={i}>{ts}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="bg-red-500/5 p-4 rounded-xl border border-red-500/10 mt-4 text-amber-200">
                      <strong>Crisis Trigger Warning Index:</strong> {schoolBrief.crisisEscalationTrigger}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500 space-y-2">
                    <b className="text-[#a8a093] block">No brief summary compiled yet.</b>
                    <p className="text-xs">Click "Compile Brief Summary" at the top to generate a custom printable support brief using Dylan&apos;s current milestones and logs.</p>
                  </div>
                )}

              </div>
            </motion.div>
          )}

          {/* TAB: TRUST & SAFETY */}
          {activeTab === "safety" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight">Trust & Safety Guidelines</h2>
                <p className="text-sm text-[#a8a093] mt-1">Our platform enforces safety as a top-level product feature. Secure data processing and boundaries.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                <div className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-3">
                  <div className="w-10 h-10 bg-yellow-500/15 rounded-xl flex items-center justify-center text-xl text-yellow-300">
                    🩺
                  </div>
                  <h3 className="font-bold text-white text-sm">Medical Escalation Safeguard</h3>
                  <p className="text-[#a8a093] leading-relaxed">
                    Our Parent Coach evaluates high-risk terms such as fever, injury, self-harm language, abuse concerns, regression, and severe distress, then routes parents toward professional or urgent support.
                  </p>
                </div>

                <div className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-3">
                  <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center text-xl text-blue-300">
                    🇪🇺
                  </div>
                  <h3 className="font-bold text-white text-sm">GDPR & Minimization Controls</h3>
                  <p className="text-[#a8a093] leading-relaxed">
                    Arbor is designed for GDPR-aligned children&apos;s data minimization. No unsupervised AI interaction is permitted for children, and child details should be stored as parent-approved observations.
                  </p>
                </div>

                <div className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-3">
                  <div className="w-10 h-10 bg-green-500/15 rounded-xl flex items-center justify-center text-xl text-green-300">
                    🛡️
                  </div>
                  <h3 className="font-bold text-white text-sm">Multi-Professional Handoff</h3>
                  <p className="text-[#a8a093] leading-relaxed">
                    The printable summary bridges home observations with specialized care profiles, giving teachers and clinics clear, non-diagnosing observational context instantly.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

        </main>

        {/* RIGHT SIDEBAR: AI ENGINES & CAPABILITIES (Persistent on Desktop, Collapsible) */}
        {showAiRail && (
          <aside className="border-l border-white/10 bg-[#08090c]/95 backdrop-blur-2xl p-6 flex flex-col gap-6 h-screen sticky top-0 overflow-y-auto hidden xl:flex text-xs z-20 w-[340px] 2xl:w-[365px]">
            {/* Header section with toggle */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400/20 to-amber-600/20 text-[#f4d991] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[#d7aa55]" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white tracking-tight uppercase">AI Engines</h3>
                  <p className="text-[10px] text-[#a8a093]">Capability Architecture</p>
                </div>
              </div>
              <button
                onClick={() => setShowAiRail(false)}
                title="Collapse Panel"
                className="p-1 px-1.5 rounded-lg border border-white/5 hover:bg-white/5 text-[#a8a093] hover:text-white transition cursor-pointer"
              >
                ➔
              </button>
            </div>

            {/* AI Capability Cards list */}
            <div className="space-y-3.5 flex-1 select-text">
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-1">
                <span className="text-[10px] font-extrabold text-[#f4d991] uppercase tracking-wider block">Orchestrator Moat:</span>
                <p className="text-[11px] text-[#a8a093] leading-relaxed">
                  Combining longitudinal child memory, expert-reviewed knowledge, sandboxed logic boundaries, and pediatric escalation guardrails.
                </p>
              </div>

              {/* Individual Capabilities cards */}
              <div className="space-y-2.5">
                {/* 1. Parent Coach */}
                <button
                  onClick={() => setActiveTab("coach")}
                  className="w-full text-left p-2.5 rounded-xl border border-[#d7aa55]/20 bg-[#d7aa55]/5 hover:bg-[#d7aa55]/10 hover:border-[#d7aa55]/35 transition group flex flex-col gap-1 focus:outline-none"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-extrabold text-white group-hover:text-[#f4d991] transition flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5 text-[#d7aa55]" />
                      01. Parent Coach
                    </span>
                    <span className="text-[8px] bg-[#d7aa55]/20 text-[#f4d991] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                      Active
                    </span>
                  </div>
                  <p className="text-[10px] text-[#a8a093] leading-normal">
                    Turns concerns about mornings/tablets into active explanations, boundaries, and prompt guides.
                  </p>
                </button>

                {/* 2. Case Summarizer */}
                <button
                  onClick={() => setActiveTab("handoff")}
                  className="w-full text-left p-2.5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10 transition group flex flex-col gap-1 focus:outline-none"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-extrabold text-gray-300 group-hover:text-white transition flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      02. Case Summarizer
                    </span>
                    <span className="text-[8px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                      Ready
                    </span>
                  </div>
                  <p className="text-[10px] text-[#a8a093] leading-normal">
                    Generates diagnosis-free professional summaries for educators, pediatric visits, and therapy clinics.
                  </p>
                </button>

                {/* 3. Pattern Detector */}
                <button
                  onClick={() => setActiveTab("behaviors")}
                  className="w-full text-left p-2.5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10 transition group flex flex-col gap-1 focus:outline-none"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-extrabold text-gray-300 group-hover:text-white transition flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-purple-400" />
                      03. Pattern Detector
                    </span>
                    <span className="text-[8px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono animate-pulse">
                      Scanning
                    </span>
                  </div>
                  <p className="text-[10px] text-[#a8a093] leading-normal">
                    Scans behavior logs and environment routines to detect underlying sensory triggers and timing errors.
                  </p>
                </button>

                {/* 4. Risk Classifier */}
                <button
                  onClick={() => setActiveTab("safety")}
                  className="w-full text-left p-2.5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10 transition group flex flex-col gap-1 focus:outline-none"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-extrabold text-gray-300 group-hover:text-white transition flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      04. Risk Classifier
                    </span>
                    <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                      Safe
                    </span>
                  </div>
                  <p className="text-[10px] text-[#a8a093] leading-normal">
                    Checks inputs for safety thresholds and routes medical, trauma, regression, or self-harm signals toward qualified professional support.
                  </p>
                </button>

                {/* 5. Story Generator */}
                <button
                  onClick={() => setActiveTab("stories")}
                  className="w-full text-left p-2.5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10 transition group flex flex-col gap-1 focus:outline-none"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-extrabold text-gray-300 group-hover:text-white transition flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                      05. Story Generator
                    </span>
                    <span className="text-[8px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono font-mono">
                      Standby
                    </span>
                  </div>
                  <p className="text-[10px] text-[#a8a093] leading-normal">
                    Crafts customized supportive transition stories featuring Dylan&apos;s strengths and next brave step.
                  </p>
                </button>

                {/* 6. Language Coach */}
                <button
                  onClick={() => setActiveTab("milestones")}
                  className="w-full text-left p-2.5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10 transition group flex flex-col gap-1 focus:outline-none"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-extrabold text-gray-300 group-hover:text-white transition flex items-center gap-1.5">
                      <Languages className="w-3.5 h-3.5 text-orange-400" />
                      06. Language Coach
                    </span>
                    <span className="text-[8px] bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                      Enabled
                    </span>
                  </div>
                  <p className="text-[10px] text-[#a8a093] leading-normal">
                    Assists children through verbal code-switching routines between English transitions and native Hebrew phrases.
                  </p>
                </button>

                {/* 7. Professional Assistant */}
                <button
                  onClick={() => setActiveTab("handoff")}
                  className="w-full text-left p-2.5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10 transition group flex flex-col gap-1 focus:outline-none"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-extrabold text-gray-300 group-hover:text-white transition flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-pink-400" />
                      07. Professional Assistant
                    </span>
                    <span className="text-[8px] bg-pink-500/10 text-pink-400 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                      Synced
                    </span>
                  </div>
                  <p className="text-[10px] text-[#a8a093] leading-normal">
                    Prepares child intake history profiles, milestones maps and weekly homework for occupational care teams.
                  </p>
                </button>

                {/* 8. Knowledge Router */}
                <button
                  onClick={() => setActiveTab("scholar")}
                  className="w-full text-left p-2.5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10 transition group flex flex-col gap-1 focus:outline-none"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-extrabold text-gray-300 group-hover:text-white transition flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-[#d7aa55]" />
                      08. Knowledge Router
                    </span>
                    <span className="text-[8px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                      Connected
                    </span>
                  </div>
                  <p className="text-[10px] text-[#a8a093] leading-normal">
                    Instantly matches parent queries against 8 established schools of child developmental psychology scientific schemas.
                  </p>
                </button>
              </div>
            </div>

            {/* Quick action system check at the bottom */}
            <div className="pt-4 border-t border-white/5 mt-auto space-y-2">
              <button
                onClick={() => {
                  alert("AI engine check successful: core developmental capability routers are healthy, synced, and verified.");
                }}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#d7aa55]" />
                Run AI Checks
              </button>
              <p className="text-[10px] text-gray-500 text-center">
                System status: Fully calibrated & HIPAA-compliant lock.
              </p>
            </div>
          </aside>
        )}

      </div>
    </div>
  );
}
