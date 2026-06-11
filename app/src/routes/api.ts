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
import { selectCouncil, runScholarTakes, renderCouncilForSynthesis } from "../services/council.js";
import { buildGrant, type ShareStore } from "../sharing/shares.js";
import { getStorySpec } from "../lib/heroJourneys.js";
import { ARBOR_PROFESSIONALS, filterProfessionals } from "../services/professionals.js";
import { Type } from "@google/genai";
import { createRedaction, REDACTION_DIRECTIVE, type RedactionContext } from "../server/redaction.js";
import { screenModelOutput, renderBlockedOutputMarkdown } from "../safety/outputScreen.js";
import { logger, requestIdOf } from "../server/logger.js";
import { computeWeeklyDigestStats, fallbackDigestNarrative } from "../server/digest.js";
import { buildConsultRequest, type ConsultStore } from "../server/consultRequests.js";
import { resolveEntitlement, COACH_METER, type EntitlementStore } from "../server/entitlements.js";
import type { UsageCounterStore } from "../server/quotaStore.js";

type ApiDeps = {
  config: ArborConfig;
  modelProvider: ModelProvider;
  memoryStore: MemoryStore;
  shareStore: ShareStore;
  framework: FrameworkDefinition;
  entitlementStore: EntitlementStore;
  counters: UsageCounterStore;
  consultStore: ConsultStore;
};

/** Redact PII from a profile object by round-tripping its JSON through the redactor. */
const redactProfile = <T,>(privacy: RedactionContext, profile: T): T =>
  profile ? (JSON.parse(privacy.redact(JSON.stringify(profile))) as T) : profile;

/** The authenticated actor (or a sandbox identity when auth is not enforced). */
const actorOf = (req: express.Request) => ({
  uid: (req as any).user?.uid || "local-sandbox",
  email: ((req as any).user?.email as string | null) || null,
});

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

export const createApiRouter = ({ config, modelProvider, memoryStore, shareStore, framework, entitlementStore, counters, consultStore }: ApiDeps) => {
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
      logger.error("Memory Read Error", error, { requestId: requestIdOf(req) });
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
      logger.error("Memory Update Error", error, { requestId: requestIdOf(req) });
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

  // TRB-3 + SAFE-4 (v6): co-parent / trusted sharing with server-enforced expiry.
  router.post("/shares", async (req, res) => {
    const { uid, email } = actorOf(req);
    const { childId, childName, recipientEmail, role, scopes, duration } = req.body;
    if (!childId || !recipientEmail) {
      res.status(400).json({ error: "childId and recipientEmail are required" });
      return;
    }
    try {
      const grant = await shareStore.create(
        buildGrant({ ownerUid: uid, ownerEmail: email, childId, childName, recipientEmail, role, scopes, duration }),
      );
      res.json(grant);
    } catch (error: any) {
      logger.error("Arbor Share Create Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to create share", details: error.message });
    }
  });

  router.get("/shares", async (req, res) => {
    const { uid } = actorOf(req);
    try {
      const childId = req.query.childId ? String(req.query.childId) : undefined;
      res.json({ shares: await shareStore.listByOwner(uid, childId) });
    } catch (error: any) {
      logger.error("Arbor Share List Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to list shares", details: error.message });
    }
  });

  router.delete("/shares/:id", async (req, res) => {
    const { uid } = actorOf(req);
    try {
      const revoked = await shareStore.revoke(req.params.id, uid);
      if (!revoked) {
        res.status(404).json({ error: "Share not found or not yours to revoke" });
        return;
      }
      res.json(revoked);
    } catch (error: any) {
      logger.error("Arbor Share Revoke Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to revoke share", details: error.message });
    }
  });

  // The co-parent / recipient side: grants shared *with* the signed-in adult.
  router.get("/shared-with-me", async (req, res) => {
    const { email } = actorOf(req);
    if (!email) { res.json({ shares: [] }); return; }
    try {
      res.json({ shares: await shareStore.listByRecipient(email) });
    } catch (error: any) {
      logger.error("Arbor Shared-With-Me Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to list shares", details: error.message });
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
      logger.error("Arbor Onboarding Error", error, { requestId: requestIdOf(req) });
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

      // SEC/CMP P0: child PII never reaches the model — redact at the call seam,
      // restore in the parsed output so the product stays personalized.
      const privacy = createRedaction(childProfile?.name);

      let rawResponse = "";
      if (streamResponse) {
        beginSse(res);
        writeSse(res, "status", {
          text: "Arbor is routing the question through child memory, AI Wiki cards, safety, and Six Frames."
        });
      }

      for await (const chunk of modelProvider.generateJsonStream({
        route: "coach_high_stakes",
        prompt: privacy.redact(prompt) + REDACTION_DIRECTIVE,
        schema: coachResponseSchema,
        temperature: 0.45
      })) {
        if (abortController.signal.aborted) return;
        rawResponse += chunk;
        if (streamResponse) writeSse(res, "chunk", { characters: rawResponse.length });
      }

      const structured = privacy.restoreDeep(coachResponseZodSchema.parse(parseJson(rawResponse.trim())));
      if (!structured.sourceCardsUsed?.length && knowledgeCards.length > 0) {
        structured.sourceCardsUsed = knowledgeCards.map((card) => card.id);
      }

      // AI-2: output-side safety screen (lexical floor + optional semantic classifier).
      const renderedText = renderCoachResponse(structured);
      const outputVerdict = await screenModelOutput(modelProvider, renderedText);
      if (outputVerdict.flagged) {
        logger.warn("Coach output blocked by output safety screen", {
          requestId: requestIdOf(req),
          category: outputVerdict.category,
          reason: outputVerdict.reason,
        });
        const blockedPayload = { text: renderBlockedOutputMarkdown(), outputBlocked: true, blockedCategory: outputVerdict.category };
        if (streamResponse) {
          writeSse(res, "done", blockedPayload);
          res.end();
        } else {
          res.json(blockedPayload);
        }
        return;
      }

      const memoryReviewItems = await appendMemoryProposals(memoryStore, childId, structured.memoryProposals, {
        familyId,
        prompt: message,
        frameRouting: structured.frameRouting
      });
      const payload = { text: renderedText, contract: structured, memoryReviewItems };
      if (streamResponse) {
        writeSse(res, "done", payload);
        res.end();
      } else {
        res.json(payload);
      }
    } catch (error: any) {
      if (abortController.signal.aborted) return;
      logger.error("Arbor Chat Error", error, { requestId: requestIdOf(req) });
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

  // SAGE-2 (v6): multi-agent scholar council. The orchestrator selects the most
  // relevant scholar agents, runs each as its own lensed model call (in parallel),
  // then synthesizes the takes into one coherent, non-diagnostic answer.
  router.post("/council", async (req, res) => {
    const { message, childProfile, scholarLens, language } = req.body;
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "A message is required" });
      return;
    }
    const escalationMatch = screenForImmediateEscalation({ message });
    if (escalationMatch) {
      res.json({ text: renderEscalationMarkdown(escalationMatch), riskLevel: "urgent", escalationCategory: escalationMatch.category, council: [] });
      return;
    }
    const languageDirective =
      language === "he"
        ? "\nIMPORTANT: Write every human-readable text value in the JSON response in natural, warm Hebrew (עברית). Keep JSON keys in English."
        : "";
    try {
      const childId = toChildId(childProfile);
      const familyId = toFamilyId(childProfile);
      const approvedMemory = await getApprovedMemoryContext(memoryStore, childId);
      const lead = resolveScholar(scholarLens);
      const childDomains = Array.isArray(childProfile?.domains) ? childProfile.domains : [];
      const council = selectCouncil(lead, childDomains, 3);

      // SEC/CMP P0: scholar agents and the synthesizer only ever see redacted input.
      const privacy = createRedaction(childProfile?.name);

      // 1) Each scholar agent deliberates in parallel.
      const takes = await runScholarTakes(modelProvider, council, {
        message: privacy.redact(message),
        childProfile: redactProfile(privacy, childProfile),
        language
      });

      // 2) Ground the synthesis in the council's cards + approved memory.
      const scholarCards = await loadCardsByIds(council.flatMap((s) => s.cardIds));
      const retrievedCards = await retrieveKnowledgeCards({
        ageBand: childProfile?.ageBand,
        domains: childDomains.length ? childDomains : undefined,
        allowedUse: "coach_context",
        limit: 4
      });
      const seen = new Set<string>();
      const knowledgeCards = [...scholarCards, ...retrievedCards]
        .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
        .slice(0, 6);

      const prompt = `
${NON_DIAGNOSTIC_CONTRACT}
${developmentalFramework}

ARBOR APPROVED CHILD MEMORY:
${approvedMemory || "No parent-approved child memory available."}

ARBOR AI WIKI SOURCE CARDS:
${renderKnowledgeContext(knowledgeCards) || "No matching cards; keep uncertainty explicit."}

You are the Arbor Parent Coach synthesizing a SCHOLAR COUNCIL into one answer.
Child Profile:
${childProfile ? JSON.stringify(childProfile, null, 2) : "None provided"}

${renderCouncilForSynthesis(takes)}

Integrate the council's distinct lenses into one coherent, non-diagnostic answer — lead with connection, then capability, then context. Do not contradict the lenses.
Parent question:
${message}

Return only JSON matching the response schema. Keep todayPlan to 1-3 steps. Include sourceCardsUsed.${languageDirective}
`;

      const raw = await modelProvider.generateJson({
        route: "coach_high_stakes",
        prompt: privacy.redact(prompt) + REDACTION_DIRECTIVE,
        schema: coachResponseSchema,
        temperature: 0.4
      });
      const structured = privacy.restoreDeep(coachResponseZodSchema.parse(raw));
      const restoredTakes = privacy.restoreDeep(takes);
      if (!structured.sourceCardsUsed?.length && knowledgeCards.length > 0) {
        structured.sourceCardsUsed = knowledgeCards.map((c) => c.id);
      }

      // AI-2: output-side safety screen.
      const renderedText = renderCoachResponse(structured);
      const outputVerdict = await screenModelOutput(modelProvider, renderedText);
      if (outputVerdict.flagged) {
        logger.warn("Council output blocked by output safety screen", {
          requestId: requestIdOf(req),
          category: outputVerdict.category,
          reason: outputVerdict.reason,
        });
        res.json({ text: renderBlockedOutputMarkdown(), outputBlocked: true, blockedCategory: outputVerdict.category, council: [] });
        return;
      }

      const memoryReviewItems = await appendMemoryProposals(memoryStore, childId, structured.memoryProposals, {
        familyId,
        prompt: message,
        frameRouting: structured.frameRouting
      });
      res.json({ text: renderedText, contract: structured, council: restoredTakes, memoryReviewItems });
    } catch (error: any) {
      logger.error("Arbor Council Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to convene the scholar council", details: error.message });
    }
  });

  // RT-2 (v6): realtime STREAMING voice coach. Streams plain spoken-friendly text
  // token-by-token over SSE so the client can speak each sentence the moment it
  // arrives (sentence-streamed TTS) — a true low-latency voice loop on Gemini
  // streaming (which is entitled here), independent of the Live bidi API.
  router.post("/voice", async (req, res) => {
    const { message, childProfile, scholarLens, language } = req.body;
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "A message is required" });
      return;
    }
    const escalationMatch = screenForImmediateEscalation({ message });
    beginSse(res);
    if (escalationMatch) {
      writeSse(res, "delta", { text: "I want to make sure you get the right help. This may need a real person right now — please reach out to a professional or local support line. " });
      writeSse(res, "done", { escalation: escalationMatch.category });
      res.end();
      return;
    }

    const abortController = new AbortController();
    req.on("close", () => abortController.abort());
    try {
      const scholar = resolveScholar(scholarLens);
      const languageDirective = language === "he" ? " Reply in warm, natural spoken Hebrew." : "";
      const privacy = createRedaction(childProfile?.name);
      const prompt = `${NON_DIAGNOSTIC_CONTRACT}
You are Arbor, a warm, calm parenting coach speaking OUT LOUD to a parent. Apply this lens: ${scholar.name} — ${scholar.method}
Child: ${childProfile ? JSON.stringify(childProfile) : "unknown"}
The parent just said: "${message}"
Reply in 2 to 4 short, spoken-friendly sentences: briefly acknowledge, then give one concrete thing to try, in plain everyday language. No markdown, no headings, no bullet points, no emojis. Observations only — never a diagnosis. If there's a safety concern, gently suggest professional help.${languageDirective}`;

      // SEC/CMP P0: redacted prompt in; aliases restored incrementally on the way out.
      const restorer = privacy.createStreamRestorer();
      let any = false;
      for await (const chunk of modelProvider.streamText({ route: "analysis_structured", prompt: privacy.redact(prompt) + REDACTION_DIRECTIVE, temperature: 0.6 })) {
        if (abortController.signal.aborted) { res.end(); return; }
        const restored = restorer.push(chunk || "");
        if (restored) { any = true; writeSse(res, "delta", { text: restored }); }
      }
      const tail = restorer.flush();
      if (tail) { any = true; writeSse(res, "delta", { text: tail }); }
      if (!any) writeSse(res, "delta", { text: "Let's take this one step at a time — tell me a little more about what's happening." });
      writeSse(res, "done", {});
      res.end();
    } catch (error: any) {
      if (abortController.signal.aborted) return;
      logger.error("Arbor Voice Stream Error", error, { requestId: requestIdOf(req) });
      if (!res.headersSent) beginSse(res);
      writeSse(res, "error", { error: "Voice stream failed", details: error.message });
      res.end();
    }
  });

  // RT-1 (v6): Gemini Live streaming. Mint a short-lived ephemeral token so the
  // browser can open a Live (bidiGenerateContent) audio session DIRECTLY without
  // ever seeing the server key. Reports availability so the client can fall back
  // to the browser voice loop when Live isn't configured/provisioned.
  router.post("/live/token", async (req, res) => {
    const apiKey = config.geminiApiKey;
    if (!apiKey) {
      res.json({ available: false, reason: "Gemini Live is not configured on this server." });
      return;
    }
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      const model = process.env.LIVE_MODEL || "gemini-2.0-flash-live-001";
      const expireTime = new Date(Date.now() + 20 * 60 * 1000).toISOString();
      const token = await ai.authTokens.create({
        config: {
          uses: 1,
          expireTime,
          liveConnectConstraints: { model },
          httpOptions: { apiVersion: "v1alpha" }
        }
      });
      res.json({ available: true, token: (token as any).name, model, expiresAt: expireTime });
    } catch (error: any) {
      logger.error("Arbor Live Token Error", error, { requestId: requestIdOf(req) });
      res.json({ available: false, reason: error.message });
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

      const privacy = createRedaction(childProfile?.name);
      const draft = await modelProvider.generateJson({
        route: "analysis_structured",
        prompt: privacy.redact(prompt) + REDACTION_DIRECTIVE,
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
      res.json(privacy.restoreDeep(draft));
    } catch (error: any) {
      logger.error("Arbor Log Extraction Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to draft a log", details: error.message });
    }
  });

  // VIS-2 + DOC-1 (v6): Arbor can SEE. The parent shows a photo (a moment, the
  // room, a drawing) or a document (school report, daycare form) and the model
  // reasons over the image — non-diagnostic, safety-gated.
  const parseDataUrl = (dataUrl: unknown) => {
    if (typeof dataUrl !== "string") return null;
    const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
    if (!m) return null;
    return { mimeType: m[1], data: m[2] };
  };

  router.post("/vision", async (req, res) => {
    const { image, mode = "observe", note, childProfile } = req.body;
    const parsed = parseDataUrl(image?.dataUrl ?? image);
    if (!parsed) {
      res.status(400).json({ error: "A base64 image data URL is required" });
      return;
    }
    // Image safety gate: cap payload size; only image MIME types.
    if (!parsed.mimeType.startsWith("image/")) {
      res.status(400).json({ error: "Only image uploads are supported" });
      return;
    }
    const approxBytes = Math.floor((parsed.data.length * 3) / 4);
    if (approxBytes > 6 * 1024 * 1024) {
      res.status(413).json({ error: "Image too large — please use a smaller photo" });
      return;
    }
    // Safety-screen any accompanying text.
    const escalationMatch = screenForImmediateEscalation({ note: typeof note === "string" ? note : "" });
    if (escalationMatch) {
      res.status(409).json({
        error: "Professional support recommended",
        details: `This may need professional or urgent attention before Arbor reviews an image. Category: ${escalationMatch.category}.`,
        escalationCategory: escalationMatch.category
      });
      return;
    }

    const isDoc = mode === "document";
    const guard = `IMAGE SAFETY GATE: Only analyze images relevant to a young child's development, wellbeing, environment, learning, artwork, or a child-related document. If the image is unrelated, a person other than in an ordinary family context, explicit, graphic, or otherwise outside parenting support, set "offTopic" to true and leave the other fields brief and empty. Never identify or judge people. Observations only — never a diagnosis.`;

    const prompt = isDoc
      ? `${NON_DIAGNOSTIC_CONTRACT}
${guard}
You can SEE the attached document photo. Read it (OCR) and extract what matters for this child's care.
Child: ${childProfile ? JSON.stringify(childProfile) : "unknown"}
Parent note: "${typeof note === "string" ? note : ""}"
Return JSON: offTopic, documentType, summary, keyPoints[], suggestedMemory[] (durable facts the parent could approve), questionsForProfessional[], handoffNote.`
      : `${NON_DIAGNOSTIC_CONTRACT}
${developmentalFramework}
${guard}
You can SEE the attached photo. Describe only what is observable and relevant, then give gentle, non-diagnostic next steps.
Child: ${childProfile ? JSON.stringify(childProfile) : "unknown"}
Parent note: "${typeof note === "string" ? note : ""}"
Return JSON: offTopic, observations[], possibleMeanings[], tryToday[] (1-3), avoid[], nonDiagnosticNote.`;

    const schema = isDoc
      ? {
          type: Type.OBJECT,
          required: ["offTopic", "documentType", "summary", "keyPoints", "suggestedMemory", "questionsForProfessional", "handoffNote"],
          properties: {
            offTopic: { type: Type.BOOLEAN },
            documentType: { type: Type.STRING },
            summary: { type: Type.STRING },
            keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedMemory: { type: Type.ARRAY, items: { type: Type.STRING } },
            questionsForProfessional: { type: Type.ARRAY, items: { type: Type.STRING } },
            handoffNote: { type: Type.STRING }
          }
        }
      : {
          type: Type.OBJECT,
          required: ["offTopic", "observations", "possibleMeanings", "tryToday", "avoid", "nonDiagnosticNote"],
          properties: {
            offTopic: { type: Type.BOOLEAN },
            observations: { type: Type.ARRAY, items: { type: Type.STRING } },
            possibleMeanings: { type: Type.ARRAY, items: { type: Type.STRING } },
            tryToday: { type: Type.ARRAY, items: { type: Type.STRING } },
            avoid: { type: Type.ARRAY, items: { type: Type.STRING } },
            nonDiagnosticNote: { type: Type.STRING }
          }
        };

    try {
      const privacy = createRedaction(childProfile?.name);
      const result = await modelProvider.generateJson({
        route: "analysis_structured",
        prompt: privacy.redact(prompt) + REDACTION_DIRECTIVE,
        temperature: 0.3,
        schema,
        images: [{ data: parsed.data, mimeType: parsed.mimeType }]
      });
      res.json({ mode, ...(privacy.restoreDeep(result) as Record<string, unknown>) });
    } catch (error: any) {
      logger.error("Arbor Vision Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to analyze the image", details: error.message });
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
      const privacy = createRedaction(childProfile?.name);
      const response = await modelProvider.generateJson({
        route: "analysis_structured",
        prompt: privacy.redact(prompt) + REDACTION_DIRECTIVE,
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
      res.json(privacy.restoreDeep(response));
    } catch (error: any) {
      logger.error("Arbor Action Plan Error", error, { requestId: requestIdOf(req) });
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
      const privacy = createRedaction(childName);
      const prompt = `
${NON_DIAGNOSTIC_CONTRACT}
Create an Arbor transition story for ${childName}, age ${age}.
Topic: ${topic}
Moral / Target skill: ${moral}
Return JSON with title, pages, illustrationPrompt, discussionQuestions, summary.
`;
      res.json(privacy.restoreDeep(await modelProvider.generateJson({
        route: "creative_low_risk",
        prompt: privacy.redact(prompt) + REDACTION_DIRECTIVE,
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
      })));
    } catch (error: any) {
      logger.error("Arbor Story Error", error, { requestId: requestIdOf(req) });
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

      const privacy = createRedaction(childName);
      const render = privacy.restoreDeep(await modelProvider.generateJson({
        route: "creative_low_risk",
        prompt: privacy.redact(prompt) + REDACTION_DIRECTIVE,
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
      logger.error("Arbor Hero Journey Error", error, { requestId: requestIdOf(req) });
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
      const privacy = createRedaction(childProfile?.name);
      res.json(privacy.restoreDeep(await modelProvider.generateJson({
        route: "analysis_structured",
        prompt: privacy.redact(prompt) + REDACTION_DIRECTIVE,
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
      })));
    } catch (error: any) {
      logger.error("Arbor Behavior Analysis Error", error, { requestId: requestIdOf(req) });
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
      const privacy = createRedaction(childProfile?.name);
      res.json(privacy.restoreDeep(await modelProvider.generateJson({
        route: "handoff_structured",
        prompt: privacy.redact(prompt) + REDACTION_DIRECTIVE,
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
      })));
    } catch (error: any) {
      logger.error("Arbor Handoff Brief Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to generate Arbor handoff brief", details: error.message });
    }
  });

  // MON-1: the client reads its plan + limits + usage here. The billing seam:
  // a Stripe/RevenueCat webhook writes entitlements/{uid}; nothing else changes.
  router.get("/entitlement", async (req, res) => {
    try {
      const actor = actorOf(req);
      const entitlement = await resolveEntitlement(entitlementStore, actor);
      const DAY_MS = 24 * 60 * 60 * 1000;
      const usage = entitlement.limits.coachMessagesPerDay !== null
        ? await counters.peek(COACH_METER, actor.uid, DAY_MS)
        : null;
      res.json({
        plan: entitlement.plan,
        limits: entitlement.limits,
        source: entitlement.source,
        enforced: entitlement.enforced,
        usage: { coachMessagesToday: usage?.count ?? 0 },
      });
    } catch (error: any) {
      logger.error("Arbor Entitlement Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to resolve entitlement", details: error.message });
    }
  });

  // RET-1: "{child}'s week" — deterministic stats core + AI narrative on top.
  // The same payload is the future push/email body (subject/preheader included).
  router.post("/digest", async (req, res) => {
    const { childProfile, logs, milestones, language } = req.body;
    const childName = (childProfile?.name && String(childProfile.name)) || "Your child";
    const stats = computeWeeklyDigestStats(Array.isArray(logs) ? logs : [], Array.isArray(milestones) ? milestones : []);
    const fallback = fallbackDigestNarrative(childName, stats);
    try {
      const privacy = createRedaction(childProfile?.name);
      const languageDirective = language === "he" ? "\nWrite every human-readable value in warm, natural Hebrew (עברית)." : "";
      const prompt = `${NON_DIAGNOSTIC_CONTRACT}
You are Arbor writing a parent's WEEKLY DIGEST — short, warm, concrete, zero fluff. Never diagnose.
Child: ${childProfile ? JSON.stringify(childProfile) : "unknown"}
This week's true, computed stats (do not contradict them): ${JSON.stringify(stats)}
Write: title (e.g. "${privacy.redact(childName)}'s week"), subject (email subject), preheader (one line), summary (2-3 sentences),
highlights (2-4 short bullets celebrating real effort/progress), watchFor (0-2 gentle observations worth keeping an eye on),
tryThisWeek (ONE concrete, doable suggestion grounded in the stats). Return only JSON matching the schema.${languageDirective}`;
      const narrative = privacy.restoreDeep(await modelProvider.generateJson({
        route: "analysis_structured",
        prompt: privacy.redact(prompt) + REDACTION_DIRECTIVE,
        temperature: 0.5,
        schema: {
          type: Type.OBJECT,
          required: ["title", "subject", "preheader", "summary", "highlights", "watchFor", "tryThisWeek"],
          properties: {
            title: { type: Type.STRING },
            subject: { type: Type.STRING },
            preheader: { type: Type.STRING },
            summary: { type: Type.STRING },
            highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
            watchFor: { type: Type.ARRAY, items: { type: Type.STRING } },
            tryThisWeek: { type: Type.STRING }
          }
        }
      }) as Record<string, unknown>);
      res.json({ ...(narrative as Record<string, unknown>), stats, generated: "ai" });
    } catch (error: any) {
      logger.warn("Digest AI narrative unavailable — serving deterministic fallback", {
        requestId: requestIdOf(req),
        errorMessage: error?.message,
      });
      res.json({ ...fallback, stats, generated: "fallback" });
    }
  });

  // CMP-2 (GDPR Art. 15/20): server-side data export for one child. The client
  // merges this with its own Firestore export into a single download.
  router.get("/privacy/export/:childId", async (req, res) => {
    const { uid } = actorOf(req);
    try {
      const childId = req.params.childId;
      const memoryEvents = await memoryStore.listEvents(childId);
      const shares = await shareStore.listByOwner(uid, childId);
      res.json({
        product: "Arbor",
        exportedAt: new Date().toISOString(),
        childId,
        serverData: { memoryEvents, shares },
      });
    } catch (error: any) {
      logger.error("Arbor Privacy Export Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to export server-side data", details: error.message });
    }
  });

  // CMP-2 (GDPR Art. 17): REAL server-side erasure — replaces the former
  // "processed server-side" placeholder. Hard-deletes the child's memory-event
  // ledger + child doc and every share grant the caller created for the child.
  router.post("/privacy/erase", async (req, res) => {
    const { uid } = actorOf(req);
    const { childId } = req.body;
    if (!childId || typeof childId !== "string") {
      res.status(400).json({ error: "childId is required" });
      return;
    }
    try {
      const memoryEvents = await memoryStore.eraseChild(childId);
      const shares = await shareStore.eraseByChild(uid, childId);
      logger.info("GDPR erasure executed", { requestId: requestIdOf(req), childId, memoryEvents, shares });
      res.json({ erased: { memoryEvents, shares }, childId, erasedAt: new Date().toISOString() });
    } catch (error: any) {
      logger.error("Arbor Privacy Erasure Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to erase server-side data", details: error.message });
    }
  });

  // MON-3 v1: professional intro/booking — records a durable consult request and
  // returns a ready-to-send email draft (email-based transaction first cut).
  router.post("/consult-requests", async (req, res) => {
    const { uid, email } = actorOf(req);
    const { professionalId, childId, note, preferredMode } = req.body;
    const professional = ARBOR_PROFESSIONALS.find((p) => p.id === professionalId);
    if (!professional) {
      res.status(404).json({ error: "Unknown professional" });
      return;
    }
    try {
      const request = await consultStore.create(buildConsultRequest({
        ownerUid: uid,
        ownerEmail: email,
        childId,
        professionalId: professional.id,
        professionalName: professional.name,
        specialty: professional.role,
        preferredMode,
        note,
      }));
      const intakeEmail = process.env.CONSULT_INTAKE_EMAIL || null;
      const subject = `Arbor consultation request — ${professional.name} (${professional.role})`;
      const body = [
        `Professional: ${professional.name} — ${professional.role}`,
        `Preferred mode: ${request.preferredMode}`,
        request.note ? `What's going on: ${request.note}` : null,
        `Request id: ${request.id}`,
      ].filter(Boolean).join("\n");
      res.json({
        request,
        mailto: intakeEmail
          ? `mailto:${intakeEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
          : null,
      });
    } catch (error: any) {
      logger.error("Arbor Consult Request Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to record the consultation request", details: error.message });
    }
  });

  router.get("/consult-requests", async (req, res) => {
    const { uid } = actorOf(req);
    try {
      res.json({ requests: await consultStore.listByOwner(uid) });
    } catch (error: any) {
      logger.error("Arbor Consult List Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to list consultation requests", details: error.message });
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
