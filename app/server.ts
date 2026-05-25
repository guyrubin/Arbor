import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { promises as fs, readFileSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin is not allowed by Arbor CORS policy."));
  }
}));
const apiRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Rate limit exceeded",
    details: "Too many Arbor requests from this IP. Please wait a minute and try again."
  }
});

app.use("/api", apiRateLimiter);
app.use(express.json({ limit: "250kb" }));

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const SERVER_ENTRY = process.argv[1] || "";
const IS_BUNDLED_SERVER = /(^|[\\/])dist[\\/]server\.cjs$/.test(SERVER_ENTRY);
const MEMORY_LEDGER_PATH = path.join(process.cwd(), ".data", "memory-ledger.json");
const FRAMEWORK_PATH = path.join(process.cwd(), "src", "framework.json");

type FrameworkDefinition = {
  domains: {
    id: string;
    label: string;
    tracks: string;
    guidanceOutput: string;
    safetyBoundary: string;
    milestoneAliases: string[];
  }[];
  ageBands: { id: string; label: string; coreTask: string; productBehavior: string }[];
  sixFrames: { id: string; label: string; description: string }[];
};

const FRAMEWORK = JSON.parse(readFileSync(FRAMEWORK_PATH, "utf8")) as FrameworkDefinition;

const buildDevelopmentalFrameworkPrompt = (framework: FrameworkDefinition) => `
DEVELOPMENTAL FRAMEWORK:
- Domains:
${framework.domains.map((domain) => `  * ${domain.id} (${domain.label}): tracks ${domain.tracks}; outputs ${domain.guidanceOutput}; boundary ${domain.safetyBoundary}.`).join("\n")}
- Age bands:
${framework.ageBands.map((band) => `  * ${band.id} (${band.label}): ${band.coreTask}; product behavior ${band.productBehavior}.`).join("\n")}
- Six Frames:
${framework.sixFrames.map((frame) => `  * ${frame.label}: ${frame.description}.`).join("\n")}
- AI pipeline: classify intent/domain, safety triage, non-diagnostic hypotheses, same-day plan, parent script, observation target, memory proposal, audience handoff.
- Return domain ids exactly as listed above, not display labels or milestone aliases.
`;

const NON_DIAGNOSTIC_CONTRACT = `
ARBOR DEVELOPMENTAL AI CONTRACT:
- You are parent support software, not a clinician, therapist, doctor, or diagnostic service.
- Save and state observations, not labels. Never diagnose autism, ADHD, anxiety, speech delay, trauma, or any condition.
- Route every answer through age band, developmental domains, safety triage, and one practical parent action.
- Prefer uncertainty language: "may", "could", "one possibility", "watch for".
- Include escalation thresholds when symptoms, safety, regression, injury, abuse, self-harm, or sustained impairment are mentioned.
- Ask for professional advice when a concern is persistent, severe, sudden, medical, or outside parent coaching.
`;

const DEVELOPMENTAL_FRAMEWORK = buildDevelopmentalFrameworkPrompt(FRAMEWORK);

type CoachResponse = {
  riskLevel: string;
  ageBand: string;
  domains: string[];
  nonDiagnosticHypotheses: { label: string; confidence: string; rationale: string }[];
  todayPlan: string[];
  parentScript: string;
  avoid: string[];
  observe: string[];
  escalateIf: string[];
  frameRouting: {
    aim: string;
    twoAxes: string;
    story: string;
    shadow: string;
    marriage: string;
    shepherd: string;
  };
  memoryProposals: { fact: string; source: string; retention: string }[];
  handoffNotes: { teacher: string; professional: string };
};

type MemoryStatus = "pending" | "approved" | "rejected" | "deleted";

type MemoryLedgerEvent = {
  eventId: string;
  memoryId: string;
  childId: string;
  eventType: "proposed" | "approved" | "rejected" | "deleted" | "edited";
  status: MemoryStatus;
  fact: string;
  source: string;
  retention: string;
  createdAt: string;
  actor: "system" | "parent";
  prompt?: string;
  frameRouting?: CoachResponse["frameRouting"];
};

type MemoryReviewItem = Omit<MemoryLedgerEvent, "eventId" | "eventType" | "actor"> & {
  latestEventId: string;
};

const renderCoachResponse = (response: CoachResponse) => {
  const hypotheses = response.nonDiagnosticHypotheses
    .map((item) => `- **${item.label}** (${item.confidence}): ${item.rationale}`)
    .join("\n");

  return `### 1. What May Be Happening
${hypotheses || "One possibility is a temporary mismatch between the child's developmental capacity, the environment, and the demand being placed on them."}

### 2. Why It May Be Happening
Age band: **${response.ageBand}**. Domains: **${response.domains.join(", ")}**. Risk level: **${response.riskLevel}**.

### 3. What To Do Today
${response.todayPlan.map((step) => `- ${step}`).join("\n")}

### 4. What Is The Parent Script
"${response.parentScript}"

### 5. What To Avoid
${response.avoid.map((item) => `- ${item}`).join("\n")}

### 6. What To Observe
${response.observe.map((item) => `- ${item}`).join("\n")}

### 7. When To Escalate
${response.escalateIf.map((item) => `- ${item}`).join("\n")}

### Frame Routing
- **Aim:** ${response.frameRouting.aim}
- **Two Axes:** ${response.frameRouting.twoAxes}
- **Story:** ${response.frameRouting.story}
- **Shadow:** ${response.frameRouting.shadow}
- **Marriage:** ${response.frameRouting.marriage}
- **Shepherd:** ${response.frameRouting.shepherd}

### Pending Memory Review
${response.memoryProposals.map((item) => `- ${item.fact} (${item.source}; ${item.retention})`).join("\n")}

### Handoff Note
Teacher: ${response.handoffNotes.teacher}

Professional: ${response.handoffNotes.professional}`;
};

const readMemoryLedger = async (): Promise<MemoryLedgerEvent[]> => {
  try {
    const raw = await fs.readFile(MEMORY_LEDGER_PATH, "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
    return Array.isArray(parsed) ? (parsed as MemoryLedgerEvent[]) : [];
  } catch (error: any) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
};

const writeMemoryLedger = async (events: MemoryLedgerEvent[]) => {
  await fs.mkdir(path.dirname(MEMORY_LEDGER_PATH), { recursive: true });
  await fs.writeFile(MEMORY_LEDGER_PATH, JSON.stringify(events, null, 2));
};

const toChildId = (childProfile: any) => {
  if (childProfile?.id) return String(childProfile.id);
  if (childProfile?.name) return String(childProfile.name).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return "default-child";
};

const foldMemoryEvents = (events: MemoryLedgerEvent[], childId?: string): MemoryReviewItem[] => {
  const latest = new Map<string, MemoryReviewItem>();

  for (const event of events) {
    if (childId && event.childId !== childId) continue;
    latest.set(event.memoryId, {
      memoryId: event.memoryId,
      childId: event.childId,
      status: event.status,
      fact: event.fact,
      source: event.source,
      retention: event.retention,
      createdAt: event.createdAt,
      prompt: event.prompt,
      frameRouting: event.frameRouting,
      latestEventId: event.eventId
    });
  }

  return [...latest.values()]
    .filter((item) => item.status !== "deleted")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

const appendMemoryProposals = async (
  childId: string,
  proposals: CoachResponse["memoryProposals"],
  context: { prompt: string; frameRouting: CoachResponse["frameRouting"] }
) => {
  if (proposals.length === 0) return foldMemoryEvents(await readMemoryLedger(), childId);

  const events = await readMemoryLedger();
  const current = foldMemoryEvents(events, childId);
  const now = new Date().toISOString();
  const nextEvents = [...events];

  for (const proposal of proposals) {
    const duplicate = current.find(
      (item) =>
        item.fact.trim().toLowerCase() === proposal.fact.trim().toLowerCase() &&
        item.status !== "rejected"
    );
    if (duplicate) continue;

    nextEvents.push({
      eventId: randomUUID(),
      memoryId: randomUUID(),
      childId,
      eventType: "proposed",
      status: "pending",
      fact: proposal.fact,
      source: proposal.source,
      retention: proposal.retention,
      createdAt: now,
      actor: "system",
      prompt: context.prompt,
      frameRouting: context.frameRouting
    });
  }

  await writeMemoryLedger(nextEvents);
  return foldMemoryEvents(nextEvents, childId);
};

const transitionMemory = async (
  memoryId: string,
  status: MemoryStatus,
  edits: Partial<Pick<MemoryLedgerEvent, "fact" | "retention" | "source">> = {}
) => {
  const events = await readMemoryLedger();
  const current = foldMemoryEvents(events).find((item) => item.memoryId === memoryId);
  if (!current) return null;

  const eventTypeByStatus: Record<MemoryStatus, MemoryLedgerEvent["eventType"]> = {
    pending: "edited",
    approved: "approved",
    rejected: "rejected",
    deleted: "deleted"
  };

  const nextEvent: MemoryLedgerEvent = {
    eventId: randomUUID(),
    memoryId,
    childId: current.childId,
    eventType: eventTypeByStatus[status],
    status,
    fact: edits.fact ?? current.fact,
    source: edits.source ?? current.source,
    retention: edits.retention ?? current.retention,
    createdAt: new Date().toISOString(),
    actor: "parent",
    prompt: current.prompt,
    frameRouting: current.frameRouting
  };

  const nextEvents = [...events, nextEvent];
  await writeMemoryLedger(nextEvents);
  return {
    item: foldMemoryEvents(nextEvents).find((item) => item.memoryId === memoryId),
    items: foldMemoryEvents(nextEvents, current.childId)
  };
};

type EscalationCategory =
  | "self_harm"
  | "abuse_or_unsafe_home"
  | "medical_urgent"
  | "developmental_regression"
  | "caregiver_distress";

type EscalationMatch = {
  category: EscalationCategory;
  label: string;
  resourcePlaceholder: string;
};

const escalationCategories: {
  category: EscalationCategory;
  label: string;
  resourcePlaceholder: string;
  patterns: RegExp[];
}[] = [
  {
    category: "self_harm",
    label: "self-harm or suicide language",
    resourcePlaceholder: "Local resource placeholder: add country-specific child/adolescent crisis line and emergency number.",
    patterns: [
      /suicid|self[-\s]?harm|kill (himself|herself|myself)|want(s)? to die/i,
      /להתאבד|אובדני|אובדנית|לפגוע בעצמי|לפגוע בעצמו|לפגוע בעצמה|רוצה למות/i
    ]
  },
  {
    category: "abuse_or_unsafe_home",
    label: "abuse, violence, neglect, or unsafe home concern",
    resourcePlaceholder: "Local resource placeholder: add country-specific child protection, domestic violence, and emergency contacts.",
    patterns: [
      /abuse|assault|violence|unsafe at home|neglect|molest|sexual abuse|hurting (him|her|my child)/i,
      /התעללות|תקיפה|אלימות|לא בטוח בבית|לא בטוחה בבית|הזנחה|פוגעים בו|פוגעים בה|מכה אותו|מכה אותה/i
    ]
  },
  {
    category: "medical_urgent",
    label: "urgent medical symptom",
    resourcePlaceholder: "Local resource placeholder: add local pediatric urgent-care line, nurse line, poison control, and emergency number.",
    patterns: [
      /can't breathe|cannot breathe|blue lips|seizure|unconscious|head injury|fever.*(baby|infant|newborn)|dehydration|poison|overdose/i,
      /לא נושם|לא נושמת|קוצר נשימה|שפתיים כחולות|פרכוס|מחוסר הכרה|איבד הכרה|איבדה הכרה|פגיעת ראש|חום.*(תינוק|תינוקת|יילוד|יילודה)|התייבשות|רעל|מנת יתר/i
    ]
  },
  {
    category: "developmental_regression",
    label: "sudden developmental regression",
    resourcePlaceholder: "Local resource placeholder: add pediatrician, youth health clinic, and developmental screening referral contacts.",
    patterns: [
      /sudden regression|lost speech|stopped walking|developmental regression|lost skills|no longer speaks/i,
      /רגרסיה|איבד דיבור|איבדה דיבור|הפסיק לדבר|הפסיקה לדבר|הפסיק ללכת|הפסיקה ללכת|איבוד כישורים/i
    ]
  },
  {
    category: "caregiver_distress",
    label: "caregiver distress or risk of caregiver harm",
    resourcePlaceholder: "Local resource placeholder: add parent crisis support, family doctor, emergency mental-health line, and trusted backup-care contact.",
    patterns: [
      /i('m| am) overwhelmed|i can'?t do this anymore|i cannot do this anymore|i hit (him|her|my child)|i slapped|thinking of hurting|afraid i will hurt|going to hurt/i,
      /אני מוצף|אני מוצפת|אני לא יכול יותר|אני לא יכולה יותר|הרבצתי לו|הרבצתי לה|פגעתי בו|פגעתי בה|מפחד לפגוע|מפחדת לפגוע/i
    ]
  }
];

const extractSafetyText = (fields: Record<string, unknown>) =>
  Object.entries(fields)
    .filter(([, value]) => typeof value === "string")
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

const screenForImmediateEscalation = (fields: Record<string, unknown>): EscalationMatch | null => {
  const text = extractSafetyText(fields);
  if (!text) return null;

  for (const category of escalationCategories) {
    if (category.patterns.some((pattern) => pattern.test(text))) {
      return {
        category: category.category,
        label: category.label,
        resourcePlaceholder: category.resourcePlaceholder
      };
    }
  }

  return null;
};

const renderEscalationMarkdown = (match: EscalationMatch) => `### 1. What May Be Happening
This may involve **${match.label}**, which is outside the safe scope of an AI parenting coach.

### 2. Why It May Be Happening
Some situations need real-time assessment from a qualified person because timing, physical safety, and local context matter.

### 3. What To Do Today
Pause the app plan and contact the right local support now. If there is immediate danger, use local emergency services.

### 4. What Is The Parent Script
"I am going to get another adult to help us right now. You are not in trouble."

### 5. What To Avoid
Do not wait for an AI answer if there is danger, injury, abuse, severe illness, self-harm language, caregiver loss of control, or sudden loss of skills.

### 6. What To Observe
Write down what happened, when it started, duration, physical symptoms, safety risks, and who is currently with the child.

### 7. When To Escalate
Escalate now. Category: **${match.category}**.

### Local Resource Placeholder
${match.resourcePlaceholder}`;

// Initialize the Google GenAI SDK safely
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY is not defined. AI functionalities will fail until defined.");
  }
  return new GoogleGenAI({
    apiKey: apiKey || "MOCK_KEY",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

const ai = getAiClient();

// Clean up standard utility to handle undefined keys
const checkApiKey = (res: express.Response) => {
  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({
      error: "Missing API Key",
      details: "GEMINI_API_KEY is not configured. Add it to .env.local to enable Arbor AI features."
    });
    return false;
  }
  return true;
};

const wantsSse = (req: express.Request) => req.headers.accept?.includes("text/event-stream") ?? false;

const beginSse = (res: express.Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
};

const writeSse = (res: express.Response, event: string, data: unknown) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

// --- API ENDPOINT: CHILD MEMORY REVIEW ---
app.get("/api/memory/:childId", async (req, res) => {
  try {
    const events = await readMemoryLedger();
    let items = foldMemoryEvents(events, req.params.childId);
    const status = req.query.status ? String(req.query.status) : undefined;
    if (status) {
      items = items.filter((item) => item.status === status);
    }
    res.json({ items });
  } catch (error: any) {
    console.error("Memory Read Error:", error);
    res.status(500).json({ error: "Failed to read memory review ledger", details: error.message });
  }
});

app.patch("/api/memory/:memoryId", async (req, res) => {
  try {
    const { status, fact, retention, source } = req.body;
    if (!["pending", "approved", "rejected", "deleted"].includes(status)) {
      res.status(400).json({ error: "Invalid memory status" });
      return;
    }

    const result = await transitionMemory(req.params.memoryId, status, { fact, retention, source });
    if (!result) {
      res.status(404).json({ error: "Memory item not found" });
      return;
    }

    res.json(result);
  } catch (error: any) {
    console.error("Memory Update Error:", error);
    res.status(500).json({ error: "Failed to update memory review item", details: error.message });
  }
});

const coachResponseSchema = {
  type: Type.OBJECT,
  required: [
    "riskLevel",
    "ageBand",
    "domains",
    "nonDiagnosticHypotheses",
    "todayPlan",
    "parentScript",
    "avoid",
    "observe",
    "escalateIf",
    "frameRouting",
    "memoryProposals",
    "handoffNotes"
  ],
  properties: {
    riskLevel: { type: Type.STRING },
    ageBand: { type: Type.STRING },
    domains: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
        enum: FRAMEWORK.domains.map((domain) => domain.id)
      }
    },
    nonDiagnosticHypotheses: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["label", "confidence", "rationale"],
        properties: {
          label: { type: Type.STRING },
          confidence: { type: Type.STRING },
          rationale: { type: Type.STRING }
        }
      }
    },
    todayPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
    parentScript: { type: Type.STRING },
    avoid: { type: Type.ARRAY, items: { type: Type.STRING } },
    observe: { type: Type.ARRAY, items: { type: Type.STRING } },
    escalateIf: { type: Type.ARRAY, items: { type: Type.STRING } },
    frameRouting: {
      type: Type.OBJECT,
      required: ["aim", "twoAxes", "story", "shadow", "marriage", "shepherd"],
      properties: {
        aim: { type: Type.STRING },
        twoAxes: { type: Type.STRING },
        story: { type: Type.STRING },
        shadow: { type: Type.STRING },
        marriage: { type: Type.STRING },
        shepherd: { type: Type.STRING }
      }
    },
    memoryProposals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["fact", "source", "retention"],
        properties: {
          fact: { type: Type.STRING },
          source: { type: Type.STRING },
          retention: { type: Type.STRING }
        }
      }
    },
    handoffNotes: {
      type: Type.OBJECT,
      required: ["teacher", "professional"],
      properties: {
        teacher: { type: Type.STRING },
        professional: { type: Type.STRING }
      }
    }
  }
};

// --- API ENDPOINT: CHAT COACH ---
app.post("/api/chat", async (req, res) => {
  const { message, childProfile, scholarLens } = req.body;
  const streamResponse = wantsSse(req);

  const escalationMatch = screenForImmediateEscalation({ message });
  if (escalationMatch) {
    const payload = {
      text: renderEscalationMarkdown(escalationMatch),
      riskLevel: "urgent",
      escalationCategory: escalationMatch.category
    };
    if (streamResponse) {
      beginSse(res);
      writeSse(res, "done", payload);
      res.end();
    } else {
      res.json(payload);
    }
    return;
  }

  if (!checkApiKey(res)) return;
  const abortController = new AbortController();
  req.on("close", () => abortController.abort());

  try {
    const prompt = `
${NON_DIAGNOSTIC_CONTRACT}
${DEVELOPMENTAL_FRAMEWORK}

You are the Arbor Parent Coach, a developmental parenting support assistant.
You provide compassionate, non-judgmental, evidence-informed guidance for children from Birth to Age 12.
You integrate developmental frameworks like Bowlby (attachment), Vygotsky (scaffolding), Piaget (cognitive stages), Winnicott (good enough parent), Montessori (independence), and Bronfenbrenner (ecosystem).

Current Child Profile Context:
${childProfile ? JSON.stringify(childProfile, null, 2) : "None provided"}

Active Scholar Lens/Concept: ${scholarLens || "Integrated Balanced"}
Modify your emphasis to highlight this scholar's approach in your reasoning when a custom scholar is selected.

Parent question:
${message}

Return only JSON that matches the response schema. Keep todayPlan to 1-3 steps.
`;

    const responseStream = await ai.models.generateContentStream({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: coachResponseSchema,
        temperature: 0.7,
      }
    });

    let rawResponse = "";
    if (streamResponse) {
      beginSse(res);
      writeSse(res, "status", {
        text: "Arbor is routing the question through developmental domains, safety, and Six Frames."
      });
    }

    for await (const chunk of responseStream) {
      if (abortController.signal.aborted) return;
      const text = chunk.text || "";
      if (!text) continue;
      rawResponse += text;
      if (streamResponse) {
        writeSse(res, "chunk", { characters: rawResponse.length });
      }
    }

    const structured = JSON.parse(rawResponse.trim()) as CoachResponse;
    const memoryReviewItems = await appendMemoryProposals(toChildId(childProfile), structured.memoryProposals, {
      prompt: message,
      frameRouting: structured.frameRouting
    });
    const payload = { text: renderCoachResponse(structured), contract: structured, memoryReviewItems };
    if (streamResponse) {
      writeSse(res, "done", payload);
      res.end();
    } else {
      res.json(payload);
    }
  } catch (error: any) {
    if (abortController.signal.aborted) return;
    console.error("Gemini Chat Error:", error);
    const payload = { error: "Failed to query parenting AI coach", details: error.message };
    if (streamResponse) {
      if (!res.headersSent) beginSse(res);
      writeSse(res, "error", payload);
      res.end();
    } else {
      res.status(500).json(payload);
    }
  }
});

// --- API ENDPOINT: ACTION PLAN GENERATOR (JSON) ---
app.post("/api/generate-plan", async (req, res) => {
  const { challengeTopic, childProfile } = req.body;

  const escalationMatch = screenForImmediateEscalation({ challengeTopic });
  if (escalationMatch) {
    res.status(409).json({
      error: "Professional support recommended",
      details: `This concern may require professional or urgent assessment before Arbor generates a parent plan. Category: ${escalationMatch.category}.`,
      escalationCategory: escalationMatch.category
    });
    return;
  }

  if (!checkApiKey(res)) return;

  try {
    const prompt = `
${NON_DIAGNOSTIC_CONTRACT}
${DEVELOPMENTAL_FRAMEWORK}

Generate a structured, expert-designed behavior/routine Action Plan for a child with the following profile:
Profile: ${JSON.stringify(childProfile)}
Focus Challenge: "${challengeTopic}"

You must respond with a developmentally grounded, non-diagnostic, practical action plan in JSON format.
JSON Schema:
{
  "title": string (e.g., "Screen Time Boundary Reset Plan"),
  "issue": string (brief summary of development stage and root cause),
  "phases": [
    {
      "name": string (e.g., "Phase 1: Preparing the Environment"),
      "description": string,
      "steps": [
        { "text": string, "completed": false }
      ]
    }
  ],
  "scripts": [
    {
      "scenario": string (e.g., "When devices are turned off and protests begin"),
      "say": string,
      "avoid": string
    }
  ],
  "successIndicators": string[] (3-4 points of progress markers)
}
`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["title", "issue", "phases", "scripts", "successIndicators"],
          properties: {
            title: { type: Type.STRING },
            issue: { type: Type.STRING },
            phases: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["name", "description", "steps"],
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  steps: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      required: ["text", "completed"],
                      properties: {
                        text: { type: Type.STRING },
                        completed: { type: Type.BOOLEAN }
                      }
                    }
                  }
                }
              }
            },
            scripts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["scenario", "say", "avoid"],
                properties: {
                  scenario: { type: Type.STRING },
                  say: { type: Type.STRING },
                  avoid: { type: Type.STRING }
                }
              }
            },
            successIndicators: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    const parsedData = JSON.parse(response.text.trim());
    res.json(parsedData);
  } catch (error: any) {
    console.error("Gemini Action Plan Error:", error);
    res.status(500).json({ error: "Failed to generate action plan", details: error.message });
  }
});

// --- API ENDPOINT: STORY GENERATOR (JSON) ---
app.post("/api/generate-story", async (req, res) => {
  const { childName, age, topic, moral } = req.body;

  const escalationMatch = screenForImmediateEscalation({ topic, moral });
  if (escalationMatch) {
    res.status(409).json({
      error: "Professional support recommended",
      details: `This story topic may require professional or urgent assessment before Arbor generates child-facing narrative support. Category: ${escalationMatch.category}.`,
      escalationCategory: escalationMatch.category
    });
    return;
  }

  if (!checkApiKey(res)) return;

  try {
    const prompt = `
${NON_DIAGNOSTIC_CONTRACT}
${DEVELOPMENTAL_FRAMEWORK}

Create an engaging, developmentally appropriate supportive bedtime or transition story for a child.
Child Name: ${childName}
Age: ${age} years old
Topic or Transition challenge: "${topic}"
Moral / Target skill to model: "${moral}"

The story must utilize the Vygotsky Zone of Proximal Development or Montessori self-regulation modeling, using animal analogies or imaginative frameworks to help the child process their feelings.
Return JSON with EXACTLY this structure:
{
  "title": string,
  "pages": string[] (exactly 4 progressive pages/chapters of story narrative suitable for bedtime reading, rich in imagery and soothing language),
  "illustrationPrompt": string (description of a beautiful, warm, minimalist watercolor illustration representing the cover scene),
  "discussionQuestions": string[] (3 parent-child discussion prompts to help reflect),
  "summary": string (short description)
}
`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["title", "pages", "illustrationPrompt", "discussionQuestions", "summary"],
          properties: {
            title: { type: Type.STRING },
            pages: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            illustrationPrompt: { type: Type.STRING },
            discussionQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            summary: { type: Type.STRING }
          }
        }
      }
    });

    const parsedStory = JSON.parse(response.text.trim());
    res.json(parsedStory);
  } catch (error: any) {
    console.error("Gemini Story Error:", error);
    res.status(500).json({ error: "Failed to generate supportive story", details: error.message });
  }
});

// --- API ENDPOINT: ANALYZE BEHAVIOR LOGS (JSON) ---
app.post("/api/analyze-behavior", async (req, res) => {
  const { logs, childProfile } = req.body;
  const safetyLogText = Array.isArray(logs)
    ? logs.map((log) => [log.behaviorType, log.trigger, log.response, log.notes].filter(Boolean).join(" ")).join("\n")
    : "";
  const escalationMatch = screenForImmediateEscalation({ behaviorLogs: safetyLogText });
  if (escalationMatch) {
    res.status(409).json({
      error: "Professional support recommended",
      details: `These behavior logs may require professional or urgent assessment before Arbor generates pattern analysis. Category: ${escalationMatch.category}.`,
      escalationCategory: escalationMatch.category
    });
    return;
  }

  if (!checkApiKey(res)) return;

  try {
    const prompt = `
${NON_DIAGNOSTIC_CONTRACT}
${DEVELOPMENTAL_FRAMEWORK}

You are a developmental pattern analyst evaluating parent-logged observations.
Child Details: ${JSON.stringify(childProfile)}
Behavior Logs: ${JSON.stringify(logs)}

Please perform longitudinal behavior analysis and return a structured JSON evaluation matching:
{
  "frequencyCount": { [behaviorType: string]: number },
  "intensityTrend": string ("increasing" | "decreasing" | "stable"),
  "triggerBreakdown": [
    { "trigger": string, "percentage": number }
  ],
  "effectivenessRating": string (evaluate parent's active responses, highlighting positive practices and noting what could be improved regarding attachment and regulation),
  "expertInsights": [
    {
      "heading": string,
      "text": string,
      "scholarLens": string (e.g., "Bowlby's Attachment Model" or "Bronfenbrenner's Ecosystem")
    }
  ],
  "actionPlanSuggestion": string (suggesting what kind of reset or action plan is recommended next)
}
`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["frequencyCount", "intensityTrend", "triggerBreakdown", "effectivenessRating", "expertInsights", "actionPlanSuggestion"],
          properties: {
            frequencyCount: {
              type: Type.OBJECT,
              properties: {} // Dynamic keys
            },
            intensityTrend: { type: Type.STRING },
            triggerBreakdown: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["trigger", "percentage"],
                properties: {
                  trigger: { type: Type.STRING },
                  percentage: { type: Type.NUMBER }
                }
              }
            },
            effectivenessRating: { type: Type.STRING },
            expertInsights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["heading", "text", "scholarLens"],
                properties: {
                  heading: { type: Type.STRING },
                  text: { type: Type.STRING },
                  scholarLens: { type: Type.STRING }
                }
              }
            },
            actionPlanSuggestion: { type: Type.STRING }
          }
        }
      }
    });

    const parsedAnalysis = JSON.parse(response.text.trim());
    res.json(parsedAnalysis);
  } catch (error: any) {
    console.error("Gemini Behavior Analysis Error:", error);
    res.status(500).json({ error: "Failed to analyze behavior logs", details: error.message });
  }
});

// --- API ENDPOINT: EXPORT BRIEF (JSON) ---
app.post("/api/generate-handoff", async (req, res) => {
  const { childProfile, logs, milestones, audience = "teacher" } = req.body;
  const safetyLogText = Array.isArray(logs)
    ? logs.map((log) => [log.behaviorType, log.trigger, log.response, log.notes].filter(Boolean).join(" ")).join("\n")
    : "";
  const escalationMatch = screenForImmediateEscalation({ handoffLogs: safetyLogText });
  if (escalationMatch) {
    res.status(409).json({
      error: "Professional support recommended",
      details: `This handoff should be reviewed by a qualified adult before Arbor generates a routine brief. Category: ${escalationMatch.category}.`,
      escalationCategory: escalationMatch.category
    });
    return;
  }

  if (!checkApiKey(res)) return;

  try {
    const prompt = `
${NON_DIAGNOSTIC_CONTRACT}
${DEVELOPMENTAL_FRAMEWORK}

Create a professional educational/support handoff brief based on a child's longitudinal profile.
This brief is specifically designed for the following target audience:
Target Audience: ${audience.toUpperCase()} 
- Mode guidelines:
  * "TEACHER" / Educator: Focus on classroom environment triggers, desk transition routines, student peers sharing, predictable dropoff cues and dual-language classroom guidelines.
  * "CLINICIAN" / Speech & Occupational Therapist: Focus on developmental milestones, sensory-motor regulation observations, English-Hebrew transition supports and developmental zone frameworks.
  * "PEDIATRICIAN" / Medical Provider: Focus on physical symptoms, milestone completion indexes, developmentally relevant observations and safety watchpoints.

Please adapt the professional language, recommended supports and overall focus of the brief to be suited for this recipient.

Child Details: ${JSON.stringify(childProfile)}
Key Logged Behaviors: ${JSON.stringify(logs)}
Milestone Context: ${JSON.stringify(milestones)}

Format output entirely in JSON matching:
{
  "title": string (e.g., "Educator support brief" or "Developmental support handoff report"),
  "date": string (current date/time representation),
  "overview": string (observational summary of child's strengths, adaptive functioning and profile customized for the recipient's vocabulary),
  "keyStrengths": string[] (strengths based on Bronfenbrenner / Gardner's multiple intelligences),
  "classroomChallenges": string[] (what environmental triggers or factors can lead to meltdowns),
  "languageSupportPlan": string[] (strategies for transition e.g., dual script language cards),
  "suggestedTeacherStrategies": string[] (concrete items: predictable arrival routines, visual prompts),
  "crisisEscalationTrigger": string (when the educator should de-escalate or call parents)
}
`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["title", "date", "overview", "keyStrengths", "classroomChallenges", "languageSupportPlan", "suggestedTeacherStrategies", "crisisEscalationTrigger"],
          properties: {
            title: { type: Type.STRING },
            date: { type: Type.STRING },
            overview: { type: Type.STRING },
            keyStrengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            classroomChallenges: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            languageSupportPlan: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            suggestedTeacherStrategies: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            crisisEscalationTrigger: { type: Type.STRING }
          }
        }
      }
    });

    const briefData = JSON.parse(response.text.trim());
    res.json(briefData);
  } catch (error: any) {
    console.error("Gemini Handoff Brief Error:", error);
    res.status(500).json({ error: "Failed to generate school readiness brief", details: error.message });
  }
});


// --- VITE MIDDLEWARE SETUP ---
const startServer = async () => {
  if (process.env.NODE_ENV !== "production" && !IS_BUNDLED_SERVER) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Arbor Dev Server] Listening on http://localhost:${PORT}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start full stack Express/Vite server:", error);
});
