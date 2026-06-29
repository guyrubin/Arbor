import { z } from "zod";
import { Type } from "@google/genai";
import type { FrameworkDefinition } from "../services/framework.js";

export const NON_DIAGNOSTIC_CONTRACT = `
ARBOR DEVELOPMENTAL AI CONTRACT:
- You are parent support software, not a clinician, therapist, doctor, or diagnostic service.
- Save and state observations, not labels. Never diagnose autism, ADHD, anxiety, speech delay, trauma, or any condition.
- Route every answer through age band, developmental domains, safety triage, and one practical parent action.
- Prefer uncertainty language: "may", "could", "one possibility", "watch for".
- Include escalation thresholds when symptoms, safety, regression, injury, abuse, self-harm, or sustained impairment are mentioned.
- Ask for professional advice when a concern is persistent, severe, sudden, medical, or outside parent coaching.
`;

export const frameRoutingSchema = z.object({
  aim: z.string().min(1),
  twoAxes: z.string().min(1),
  story: z.string().min(1),
  shadow: z.string().min(1),
  marriage: z.string().min(1),
  shepherd: z.string().min(1)
});

export const coachResponseZodSchema = z.object({
  riskLevel: z.string().min(1),
  ageBand: z.string().min(1),
  domains: z.array(z.string().min(1)).min(1),
  nonDiagnosticHypotheses: z.array(z.object({
    label: z.string().min(1),
    confidence: z.string().min(1),
    rationale: z.string().min(1)
  })),
  todayPlan: z.array(z.string().min(1)).min(1),
  parentScript: z.string().min(1),
  avoid: z.array(z.string().min(1)),
  observe: z.array(z.string().min(1)),
  escalateIf: z.array(z.string().min(1)).min(1),
  frameRouting: frameRoutingSchema,
  memoryProposals: z.array(z.object({
    fact: z.string().min(1),
    source: z.string().min(1),
    retention: z.string().min(1)
  })),
  handoffNotes: z.object({
    teacher: z.string().min(1),
    professional: z.string().min(1)
  }),
  sourceCardsUsed: z.array(z.string()).optional()
});

export type CoachResponse = z.infer<typeof coachResponseZodSchema>;

export const createCoachResponseGeminiSchema = (framework: FrameworkDefinition) => ({
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
    "handoffNotes",
    "sourceCardsUsed"
  ],
  properties: {
    riskLevel: { type: Type.STRING },
    ageBand: { type: Type.STRING },
    domains: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: framework.domains.map((domain) => domain.id) }
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
    },
    sourceCardsUsed: { type: Type.ARRAY, items: { type: Type.STRING } }
  }
});

export const renderCoachResponse = (response: CoachResponse) => {
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
${response.memoryProposals.map((item) => `- ${item.fact} (${item.source}; ${item.retention})`).join("\n") || "- No durable child memory proposed."}

### Knowledge Cards Used
${response.sourceCardsUsed?.map((card) => `- ${card}`).join("\n") || "- No Arbor AI Wiki card attached."}

### Handoff Note
Teacher: ${response.handoffNotes.teacher}

Professional: ${response.handoffNotes.professional}`;
};
