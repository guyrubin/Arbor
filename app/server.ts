import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const IS_BUNDLED_SERVER = path.basename(__dirname) === "dist";

const NON_DIAGNOSTIC_CONTRACT = `
ARBOR DEVELOPMENTAL AI CONTRACT:
- You are parent support software, not a clinician, therapist, doctor, or diagnostic service.
- Save and state observations, not labels. Never diagnose autism, ADHD, anxiety, speech delay, trauma, or any condition.
- Route every answer through age band, developmental domains, safety triage, and one practical parent action.
- Prefer uncertainty language: "may", "could", "one possibility", "watch for".
- Include escalation thresholds when symptoms, safety, regression, injury, abuse, self-harm, or sustained impairment are mentioned.
- Ask for professional advice when a concern is persistent, severe, sudden, medical, or outside parent coaching.
`;

const DEVELOPMENTAL_FRAMEWORK = `
DEVELOPMENTAL FRAMEWORK:
- Domains: attachment_regulation, language_communication, cognition_executive_function, social_development, independence_adaptive_skills, sensory_motor_patterns, ecosystem_stressors.
- Age bands: 0-12m, 12-36m, 3-5y, 6-8y, 9-12y.
- Six Frames: Aim, Two Axes, Story, Shadow, Marriage, Shepherd.
- AI pipeline: classify intent/domain, safety triage, non-diagnostic hypotheses, same-day plan, parent script, observation target, memory proposal, audience handoff.
`;

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
  memoryProposals: { fact: string; source: string; retention: string }[];
  handoffNotes: { teacher: string; professional: string };
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

### Memory Proposal
${response.memoryProposals.map((item) => `- ${item.fact} (${item.source}; ${item.retention})`).join("\n")}

### Handoff Note
Teacher: ${response.handoffNotes.teacher}

Professional: ${response.handoffNotes.professional}`;
};

const immediateEscalationPatterns = [
  /suicid|self[-\s]?harm|kill (himself|herself|myself)|want(s)? to die/i,
  /abuse|assault|violence|unsafe at home|neglect/i,
  /can't breathe|cannot breathe|blue lips|seizure|unconscious|head injury/i,
  /fever.*(baby|infant|newborn)|dehydration|poison|overdose/i,
  /sudden regression|lost speech|stopped walking|developmental regression/i
];

const screenForImmediateEscalation = (parts: unknown[]) => {
  const text = parts
    .filter(Boolean)
    .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
    .join("\n");

  return immediateEscalationPatterns.some((pattern) => pattern.test(text));
};

const escalationMarkdown = `### 1. What May Be Happening
This may be outside the safe scope of an AI parenting coach.

### 2. Why It May Be Happening
Some concerns need real-time assessment from a qualified professional because timing and context matter.

### 3. What To Do Today
Pause the app plan and contact the appropriate local professional service now. If there is immediate danger, use local emergency services.

### 4. What Is The Parent Script
"I am going to get another adult to help us right now. You are not in trouble."

### 5. What To Avoid
Do not wait for an AI answer if there is danger, injury, abuse, severe illness, self-harm language, or sudden regression.

### 6. What To Observe
Write down what happened, when it started, duration, physical symptoms, and any safety risks so a professional can assess it.

### 7. When To Escalate
Escalate now for immediate danger, medical symptoms, self-harm language, abuse concerns, severe distress, or sudden loss of skills.`;

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

// --- API ENDPOINT: CHAT COACH ---
app.post("/api/chat", async (req, res) => {
  if (!checkApiKey(res)) return;

  const { message, childProfile, scholarLens } = req.body;

  if (screenForImmediateEscalation([message, childProfile])) {
    res.json({ text: escalationMarkdown, riskLevel: "urgent" });
    return;
  }

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

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
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
            "memoryProposals",
            "handoffNotes"
          ],
          properties: {
            riskLevel: { type: Type.STRING },
            ageBand: { type: Type.STRING },
            domains: { type: Type.ARRAY, items: { type: Type.STRING } },
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
        },
        temperature: 0.7,
      }
    });

    const structured = JSON.parse(response.text.trim()) as CoachResponse;
    res.json({ text: renderCoachResponse(structured), contract: structured });
  } catch (error: any) {
    console.error("Gemini Chat Error:", error);
    res.status(500).json({ error: "Failed to query parenting AI coach", details: error.message });
  }
});

// --- API ENDPOINT: ACTION PLAN GENERATOR (JSON) ---
app.post("/api/generate-plan", async (req, res) => {
  if (!checkApiKey(res)) return;

  const { challengeTopic, childProfile } = req.body;

  if (screenForImmediateEscalation([challengeTopic, childProfile])) {
    res.status(409).json({
      error: "Professional support recommended",
      details: "This concern may require professional or urgent assessment before Arbor generates a parent plan."
    });
    return;
  }

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
  if (!checkApiKey(res)) return;

  const { childName, age, topic, moral } = req.body;

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
  if (!checkApiKey(res)) return;

  const { logs, childProfile } = req.body;

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
  if (!checkApiKey(res)) return;

  const { childProfile, logs, milestones, audience = "teacher" } = req.body;

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
