import express from "express";
import type { ArborConfig } from "../config/env.js";
import type { ModelProvider } from "../ai/modelRouter.js";
import type { MemoryStore } from "../memory/types.js";
import { createCoachResponseGeminiSchema, coachResponseZodSchema, NON_DIAGNOSTIC_CONTRACT, renderCoachResponse } from "../contracts/coach.js";
import { buildDevelopmentalFrameworkPrompt, type FrameworkDefinition } from "../services/framework.js";
import { screenForImmediateEscalation, renderEscalationMarkdown } from "../safety/escalation.js";
import { appendMemoryProposals, foldMemoryEvents, getApprovedMemoryContext, toChildId, toFamilyId, transitionMemory } from "../memory/memoryService.js";
import { loadKnowledgeCardsWithMetadata, renderKnowledgeContext, retrieveKnowledgeCards, loadCardsByIds } from "../knowledge/wiki.js";
import { resolveScholar } from "../services/scholars.js";
import { getStorySpec } from "../lib/heroJourneys.js";
import { ARBOR_PROFESSIONALS, filterProfessionals } from "../services/professionals.js";
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

  // Care Network › Find a Professional (CAP-8). Curated, Arbor-verified, filterable.
  router.get("/professionals", (req, res) => {
    const professionals = filterProfessionals(ARBOR_PROFESSIONALS, {
      specialty: req.query.specialty ? String(req.query.specialty) : undefined,
      language: req.query.language ? String(req.query.language) : undefined,
      mode: req.query.mode ? String(req.query.mode) : undefined,
      q: req.query.q ? String(req.query.q) : undefined,
    });
    res.json({ professionals });
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
    const { message, childProfile, scholarLens, language } = req.body;
    const languageDirective =
      language === "he"
        ? "\nIMPORTANT: Write every human-readable text value in the JSON response in natural, warm Hebrew (עברית). Keep JSON keys in English."
        : "";
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
      const familyId = toFamilyId(childProfile);
      const approvedMemory = await getApprovedMemoryContext(memoryStore, childId);
      // SCH-3: the selected lens is now load-bearing — its scholar's card(s) are
      // guaranteed into the context and lead, alongside age/domain matches.
      const scholar = resolveScholar(scholarLens);
      const retrievedCards = await retrieveKnowledgeCards({
        ageBand: childProfile?.ageBand,
        domains: Array.isArray(childProfile?.domains) ? childProfile.domains : undefined,
        allowedUse: "coach_context",
        limit: 4
      });
      const scholarCards = await loadCardsByIds(scholar.cardIds);
      const seenCardIds = new Set<string>();
      const knowledgeCards = [...scholarCards, ...retrievedCards]
        .filter((card) => (seenCardIds.has(card.id) ? false : (seenCardIds.add(card.id), true)))
        .slice(0, 5);

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

ACTIVE SCHOLAR LENS — apply this method, do not just name it:
${scholar.name} — ${scholar.concept}. ${scholar.method}
Ground "What To Do Today" and the parent script in this lens, and prefer Six Frame "${scholar.defaultFrame}" unless safety dictates otherwise.
Parent question:
${message}

Return only JSON that matches the response schema. Keep todayPlan to 1-3 steps. Include sourceCardsUsed as source-card ids you used.${languageDirective}
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
        familyId,
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

  // LOG-1 (v6): ambient logging — the AI drafts a structured behavior log from a
  // free-text or voice description so the parent confirms instead of filling a
  // form. Non-diagnostic; safety-screened; the client falls back gracefully if
  // extraction is unavailable.
  router.post("/extract-log", async (req, res) => {
    const { message, childProfile } = req.body;
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "A description (message) is required" });
      return;
    }

    const escalationMatch = screenForImmediateEscalation({ message });
    if (escalationMatch) {
      res.status(409).json({
        error: "Professional support recommended",
        details: `This description may need professional or urgent attention before Arbor drafts a log. Category: ${escalationMatch.category}.`,
        escalationCategory: escalationMatch.category
      });
      return;
    }

    try {
      const prompt = `
${NON_DIAGNOSTIC_CONTRACT}
You are Arbor's logging assistant. Read the parent's description of a moment with their child and extract ONE structured behavior log. Observations only — never a diagnosis.

Child: ${childProfile ? JSON.stringify(childProfile) : "unknown"}
Parent description: "${message}"

Rules:
- behaviorType: a short 2-4 word label for the moment (e.g. "Morning refusal", "Screen shutoff meltdown", "Sibling conflict").
- intensity: integer 1 (mild) to 5 (severe), inferred from the description.
- durationMinutes: best-guess integer (use 10 if unclear).
- context: one of exactly Home, School, Transit, Public.
- trigger: the immediate antecedent in a few words ("" if unknown).
- response: what the parent did, if mentioned ("" if unknown).
- notes: one short neutral sentence capturing anything else useful ("" if none).
Return only JSON matching the schema.`;

      const draft = await modelProvider.generateJson({
        route: "analysis_structured",
        prompt,
        temperature: 0.2,
        schema: {
          type: Type.OBJECT,
          required: ["behaviorType", "intensity", "durationMinutes", "context", "trigger", "response", "notes"],
          properties: {
            behaviorType: { type: Type.STRING },
            intensity: { type: Type.NUMBER },
            durationMinutes: { type: Type.NUMBER },
            context: { type: Type.STRING, enum: ["Home", "School", "Transit", "Public"] },
            trigger: { type: Type.STRING },
            response: { type: Type.STRING },
            notes: { type: Type.STRING }
          }
        }
      });
      res.json(draft);
    } catch (error: any) {
      console.error("Arbor Log Extraction Error:", error);
      res.status(500).json({ error: "Failed to draft a log", details: error.message });
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

  // Hero Journey: personalize a FIXED, vetted story spine to the child. The plot
  // comes from the catalog (lib/heroJourneys) — the model only writes narration.
  router.post("/generate-hero-journey", async (req, res) => {
    const { storyId, childName, age, language } = req.body;
    const story = getStorySpec(storyId);
    if (!story) {
      res.status(404).json({ error: "Unknown hero journey", details: `No story with id "${storyId}".` });
      return;
    }

    const escalationMatch = screenForImmediateEscalation({ topic: story.theme });
    if (escalationMatch) {
      res.status(409).json({
        error: "Professional support recommended",
        details: `This theme may require professional assessment before Arbor generates child-facing narrative. Category: ${escalationMatch.category}.`,
        escalationCategory: escalationMatch.category
      });
      return;
    }

    const languageDirective =
      language === "he"
        ? "\nIMPORTANT: Write every human-readable text value in the JSON response in natural, warm Hebrew (עברית). Keep JSON keys and the beatId values in English."
        : "";

    const heroName = (childName && String(childName).trim()) || "the hero";
    const decision = story.beats.find((b) => b.id === "decision");
    const choiceCount = decision?.choices?.length ?? 3;
    const spineText = story.beats
      .map((b, i) => `${i + 1}. [${b.id}] ${b.title}: ${b.spine}`)
      .join("\n");
    const choicesText = (decision?.choices ?? [])
      .map((c) => `- ${c.id}: "${c.label}" (cue: ${c.outcomeHint})`)
      .join("\n");

    try {
      const prompt = `${NON_DIAGNOSTIC_CONTRACT}
You are Arbor's gentle children's storyteller. Turn a FIXED story spine into a warm, cinematic story in which the CHILD is the hero.

Hero (the child): ${heroName}, age ${age ?? 5}.
Story: "${story.title}" — theme: ${story.theme}. Learning objective: ${story.learningObjective}.

RULES:
- Follow the spine EXACTLY, beat by beat, in order. Do not add, remove, reorder, or change the plot.
- Make ${heroName} the hero, by name. Warm, present, vivid but simple words for ages 4-8.
- 2 to 4 short sentences per beat. Gentle and non-graphic: no real violence, blood, death, or frightening detail. Conflict stays emotional/symbolic and always resolves kindly.
- For the 'decision' beat narration, end by inviting the child to choose — do NOT say which option is best.
- Personalize each of the ${choiceCount} choices: rewrite "label" as a short first-person action, and write a 1-2 sentence "consequence" expanding its cue. Keep every consequence kind — no choice is harshly punished.
- Give a one-line "imagePrompt" per beat for an illustrator (storybook style, no text in the image).
- Keep the reflection's practiced[] and questions[] close to those provided, lightly personalized to ${heroName}.

SPINE (8 beats — return one scene per beat, same order, with matching beatId):
${spineText}

DECISION CHOICES (keep these exact ids):
${choicesText}

Reflection — practiced themes: ${story.parentReflection.practiced.join(", ")}
Reflection — parent questions:
${story.parentReflection.questions.map((q) => "- " + q).join("\n")}
${languageDirective}`;

      const render = (await modelProvider.generateJson({
        route: "creative_low_risk",
        prompt,
        temperature: 0.7,
        schema: {
          type: Type.OBJECT,
          required: ["scenes", "choices", "reflection"],
          properties: {
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["beatId", "title", "narration", "imagePrompt"],
                properties: {
                  beatId: { type: Type.STRING },
                  title: { type: Type.STRING },
                  narration: { type: Type.STRING },
                  imagePrompt: { type: Type.STRING }
                }
              }
            },
            choices: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["id", "label", "consequence"],
                properties: {
                  id: { type: Type.STRING },
                  label: { type: Type.STRING },
                  consequence: { type: Type.STRING }
                }
              }
            },
            reflection: {
              type: Type.OBJECT,
              required: ["practiced", "questions"],
              properties: {
                practiced: { type: Type.ARRAY, items: { type: Type.STRING } },
                questions: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          }
        }
      })) as Record<string, unknown>;

      res.json({
        storyId: story.id,
        title: language === "he" ? story.titleHe : story.title,
        ...render
      });
    } catch (error: any) {
      console.error("Arbor Hero Journey Error:", error);
      res.status(500).json({ error: "Failed to generate Arbor hero journey", details: error.message });
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
                required: ["heading", "text"],
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
    const knowledge = await loadKnowledgeCardsWithMetadata();
    res.json({
      product: "Arbor",
      cardCount: knowledge.cards.length,
      byType: knowledge.byType,
      loadedFrom: knowledge.loadedFrom,
      cardIds: knowledge.cards.map((card) => card.id)
    });
  });

  return router;
};
