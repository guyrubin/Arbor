import express from "express";
import type { ArborConfig } from "../config/env.js";
import type { ModelProvider } from "../ai/modelRouter.js";
import type { MemoryStore } from "../memory/types.js";
import { createCoachResponseGeminiSchema, coachResponseZodSchema, NON_DIAGNOSTIC_CONTRACT, renderCoachResponse } from "../contracts/coach.js";
import { buildDevelopmentalFrameworkPrompt, type FrameworkDefinition } from "../services/framework.js";
import { screenForImmediateEscalation, renderEscalationMarkdown } from "../safety/escalation.js";
import { appendMemoryProposals, foldMemoryEvents, getApprovedMemoryContext, toChildId, transitionMemory } from "../memory/memoryService.js";
import { loadKnowledgeCards, renderKnowledgeContext, retrieveKnowledgeCards } from "../knowledge/wiki.js";
import { Type } from "@google/genai";

type ApiDeps = {
  config: ArborConfig;
  modelProvider: ModelProvider;
  memoryStore: MemoryStore;
  framework: FrameworkDefinition;
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

const parseJson = <T>(value: unknown) => {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return parsed as T;
};

export const createApiRouter = ({ config, modelProvider, memoryStore, framework }: ApiDeps) => {
  const router = express.Router();
  const developmentalFramework = buildDevelopmentalFrameworkPrompt(framework);
  const coachResponseSchema = createCoachResponseGeminiSchema(framework);

  router.get("/memory/:childId", async (req, res) => {
    try {
      let items = foldMemoryEvents(await memoryStore.listEvents(req.params.childId), req.params.childId);
      const status = req.query.status ? String(req.query.status) : undefined;
      if (status) items = items.filter((item) => item.status === status);
      res.json({ items });
    } catch (error: any) {
      console.error("Memory Read Error:", error);
      res.status(500).json({ error: "Failed to read Arbor memory review ledger", details: error.message });
    }
  });

  router.patch("/memory/:memoryId", async (req, res) => {
    try {
      const { status, fact, retention, source } = req.body;
      if (!["pending", "approved", "rejected", "deleted", "expired"].includes(status)) {
        res.status(400).json({ error: "Invalid Arbor memory status" });
        return;
      }

      const result = await transitionMemory(memoryStore, req.params.memoryId, status, { fact, retention, source });
      if (!result) {
        res.status(404).json({ error: "Arbor memory item not found" });
        return;
      }

      res.json(result);
    } catch (error: any) {
      console.error("Memory Update Error:", error);
      res.status(500).json({ error: "Failed to update Arbor memory review item", details: error.message });
    }
  });

  router.post("/onboarding/family-child", async (req, res) => {
    try {
      const { familyId, childId, userId, childProfile } = req.body;
      if (!familyId || !childId || !userId) {
        res.status(400).json({ error: "familyId, childId, and userId are required" });
        return;
      }
      if (!memoryStore.ensureFamilyChild) {
        res.json({ familyId, childId, userId, adapter: "local", created: false });
        return;
      }
      await memoryStore.ensureFamilyChild({ familyId, childId, userId, childProfile });
      res.json({ familyId, childId, userId, adapter: "firestore", created: true });
    } catch (error: any) {
      console.error("Arbor Onboarding Error:", error);
      res.status(500).json({ error: "Failed to create Arbor family/child documents", details: error.message });
    }
  });

  router.post("/chat", async (req, res) => {
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

    const abortController = new AbortController();
    req.on("close", () => abortController.abort());

    try {
      const childId = toChildId(childProfile);
      const approvedMemory = await getApprovedMemoryContext(memoryStore, childId);
      const knowledgeCards = await retrieveKnowledgeCards({
        ageBand: childProfile?.ageBand,
        domains: Array.isArray(childProfile?.domains) ? childProfile.domains : undefined,
        allowedUse: "coach_context",
        limit: 4
      });

      const prompt = `
${NON_DIAGNOSTIC_CONTRACT}
${developmentalFramework}

ARBOR APPROVED CHILD MEMORY:
${approvedMemory || "No parent-approved child memory available."}

ARBOR AI WIKI SOURCE CARDS:
${renderKnowledgeContext(knowledgeCards) || "No matching Arbor AI Wiki cards found. Use the framework contract and keep uncertainty explicit."}

You are the Arbor Parent Coach, a developmental parenting support assistant.
Current Child Profile Context:
${childProfile ? JSON.stringify(childProfile, null, 2) : "None provided"}

Active Scholar Lens/Concept: ${scholarLens || "Integrated Balanced"}
Parent question:
${message}

Return only JSON that matches the response schema. Keep todayPlan to 1-3 steps. Include sourceCardsUsed as source-card ids you used.
`;

      let rawResponse = "";
      if (streamResponse) {
        beginSse(res);
        writeSse(res, "status", {
          text: "Arbor is routing the question through child memory, AI Wiki cards, safety, and Six Frames."
        });
      }

      for await (const chunk of modelProvider.generateJsonStream({
        route: "coach_high_stakes",
        prompt,
        schema: coachResponseSchema,
        temperature: 0.45
      })) {
        if (abortController.signal.aborted) return;
        rawResponse += chunk;
        if (streamResponse) writeSse(res, "chunk", { characters: rawResponse.length });
      }

      const structured = coachResponseZodSchema.parse(parseJson(rawResponse.trim()));
      if (!structured.sourceCardsUsed?.length && knowledgeCards.length > 0) {
        structured.sourceCardsUsed = knowledgeCards.map((card) => card.id);
      }
      const memoryReviewItems = await appendMemoryProposals(memoryStore, childId, structured.memoryProposals, {
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
      console.error("Arbor Chat Error:", error);
      const payload = { error: "Failed to query Arbor parent coach", details: error.message };
      if (streamResponse) {
        if (!res.headersSent) beginSse(res);
        writeSse(res, "error", payload);
        res.end();
      } else {
        res.status(500).json(payload);
      }
    }
  });

  router.post("/generate-plan", async (req, res) => {
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

    try {
      const prompt = `
${NON_DIAGNOSTIC_CONTRACT}
${developmentalFramework}

Generate a structured, non-diagnostic Arbor action plan.
Profile: ${JSON.stringify(childProfile)}
Focus Challenge: "${challengeTopic}"
Return JSON with title, issue, phases, scripts, and successIndicators.
`;
      const response = await modelProvider.generateJson({
        route: "analysis_structured",
        prompt,
        schema: {
          type: Type.OBJECT,
          required: ["title", "issue", "phases", "scripts", "successIndicators"],
          properties: {
            title: { type: Type.STRING },
            issue: { type: Type.STRING },
            phases: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {} } },
            scripts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {} } },
            successIndicators: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      });
      res.json(response);
    } catch (error: any) {
      console.error("Arbor Action Plan Error:", error);
      res.status(500).json({ error: "Failed to generate Arbor action plan", details: error.message });
    }
  });

  router.post("/generate-story", async (req, res) => {
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

    try {
      const prompt = `
${NON_DIAGNOSTIC_CONTRACT}
Create an Arbor transition story for ${childName}, age ${age}.
Topic: ${topic}
Moral / Target skill: ${moral}
Return JSON with title, pages, illustrationPrompt, discussionQuestions, summary.
`;
      res.json(await modelProvider.generateJson({
        route: "creative_low_risk",
        prompt,
        schema: {
          type: Type.OBJECT,
          required: ["title", "pages", "illustrationPrompt", "discussionQuestions", "summary"],
          properties: {
            title: { type: Type.STRING },
            pages: { type: Type.ARRAY, items: { type: Type.STRING } },
            illustrationPrompt: { type: Type.STRING },
            discussionQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            summary: { type: Type.STRING }
          }
        },
        temperature: 0.7
      }));
    } catch (error: any) {
      console.error("Arbor Story Error:", error);
      res.status(500).json({ error: "Failed to generate Arbor supportive story", details: error.message });
    }
  });

  router.post("/analyze-behavior", async (req, res) => {
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

    try {
      const prompt = `
${NON_DIAGNOSTIC_CONTRACT}
${developmentalFramework}
Analyze Arbor parent-logged observations.
Child Details: ${JSON.stringify(childProfile)}
Behavior Logs: ${JSON.stringify(logs)}
Return JSON with frequencyCount, intensityTrend, triggerBreakdown, effectivenessRating, expertInsights, actionPlanSuggestion.
`;
      res.json(await modelProvider.generateJson({
        route: "analysis_structured",
        prompt,
        schema: {
          type: Type.OBJECT,
          required: ["frequencyCount", "intensityTrend", "triggerBreakdown", "effectivenessRating", "expertInsights", "actionPlanSuggestion"],
          properties: {
            frequencyCount: { type: Type.OBJECT, properties: {} },
            intensityTrend: { type: Type.STRING },
            triggerBreakdown: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {} } },
            effectivenessRating: { type: Type.STRING },
            expertInsights: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {} } },
            actionPlanSuggestion: { type: Type.STRING }
          }
        }
      }));
    } catch (error: any) {
      console.error("Arbor Behavior Analysis Error:", error);
      res.status(500).json({ error: "Failed to analyze Arbor behavior logs", details: error.message });
    }
  });

  router.post("/generate-handoff", async (req, res) => {
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

    try {
      const prompt = `
${NON_DIAGNOSTIC_CONTRACT}
Create an Arbor professional handoff brief for ${String(audience).toUpperCase()}.
Child Details: ${JSON.stringify(childProfile)}
Key Logged Behaviors: ${JSON.stringify(logs)}
Milestone Context: ${JSON.stringify(milestones)}
Return JSON with title, date, overview, keyStrengths, classroomChallenges, languageSupportPlan, suggestedTeacherStrategies, crisisEscalationTrigger.
`;
      res.json(await modelProvider.generateJson({
        route: "handoff_structured",
        prompt,
        schema: {
          type: Type.OBJECT,
          required: ["title", "date", "overview", "keyStrengths", "classroomChallenges", "languageSupportPlan", "suggestedTeacherStrategies", "crisisEscalationTrigger"],
          properties: {
            title: { type: Type.STRING },
            date: { type: Type.STRING },
            overview: { type: Type.STRING },
            keyStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            classroomChallenges: { type: Type.ARRAY, items: { type: Type.STRING } },
            languageSupportPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedTeacherStrategies: { type: Type.ARRAY, items: { type: Type.STRING } },
            crisisEscalationTrigger: { type: Type.STRING }
          }
        }
      }));
    } catch (error: any) {
      console.error("Arbor Handoff Brief Error:", error);
      res.status(500).json({ error: "Failed to generate Arbor handoff brief", details: error.message });
    }
  });

  router.get("/architecture/status", (_req, res) => {
    res.json({
      product: "Arbor",
      arborEnv: config.arborEnv,
      modelProvider: config.modelProvider,
      memoryAdapter: config.memoryAdapter,
      highRiskReviewQueueEnabled: config.enableHighRiskReviewQueue
    });
  });

  router.get("/architecture/knowledge", async (_req, res) => {
    const cards = await loadKnowledgeCards();
    res.json({
      product: "Arbor",
      cardCount: cards.length,
      cardIds: cards.map((card) => card.id)
    });
  });

  return router;
};
