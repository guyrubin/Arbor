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
import { buildGrant, isShareActive, type ShareStore } from "../sharing/shares.js";
import { getStorySpec } from "../lib/heroJourneys.js";
import { ARBOR_PROFESSIONALS, filterProfessionals } from "../services/professionals.js";
import { Type } from "@google/genai";
import { createRedaction, REDACTION_DIRECTIVE, type RedactionContext } from "../server/redaction.js";
import { screenModelOutput, renderBlockedOutputMarkdown } from "../safety/outputScreen.js";
import { logger, requestIdOf } from "../server/logger.js";
import { requireChildOwnership } from "../server/requireChildOwnership.js";
import { requireConsent } from "../server/requireConsent.js";
import { buildConsent, type ConsentPurpose, type ConsentStore } from "../sharing/consent.js";
import { computeWeeklyDigestStats, fallbackDigestNarrative } from "../server/digest.js";
import { buildConsultRequest, type ConsultStore } from "../server/consultRequests.js";
import { resolveEntitlement, COACH_METER, type EntitlementStore } from "../server/entitlements.js";
import { scoreChildUtterance, childAsrConfigured, NotConfiguredError } from "../server/childAsr.js";
import { billingCheckoutUrl } from "../server/billing.js";
import { isAdmin } from "../server/admin.js";
import type { AdminMetricsStore } from "../server/adminMetrics.js";
import type { UsageCounterStore } from "../server/quotaStore.js";

type ApiDeps = {
  config: ArborConfig;
  modelProvider: ModelProvider;
  memoryStore: MemoryStore;
  shareStore: ShareStore;
  consentStore: ConsentStore;
  framework: FrameworkDefinition;
  entitlementStore: EntitlementStore;
  counters: UsageCounterStore;
  consultStore: ConsultStore;
  adminMetrics: AdminMetricsStore;
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

export const createApiRouter = ({ config, modelProvider, memoryStore, shareStore, consentStore, framework, entitlementStore, counters, consultStore, adminMetrics }: ApiDeps) => {
  const router = express.Router();
  const developmentalFramework = buildDevelopmentalFrameworkPrompt(framework);
  const coachResponseSchema = createCoachResponseGeminiSchema(framework);
  // Per-child authorization (closes the IDOR on child-scoped reads/erasure).
  const requireOwnership = requireChildOwnership(memoryStore);

  // ── COPPA-2026 consent ledger ──────────────────────────────────────────────
  const VALID_PURPOSES: ConsentPurpose[] = ["face_processing", "voice_processing", "ai_training"];
  // Grant / update a purpose-scoped consent for a child (parent-owner only).
  router.post("/consent", requireOwnership, async (req, res) => {
    const { childId, purpose, granted } = req.body ?? {};
    if (!childId || !VALID_PURPOSES.includes(purpose)) {
      res.status(400).json({ error: "childId and a valid purpose are required" });
      return;
    }
    const uid = (req as any).user?.uid || "local-sandbox";
    const grant = await consentStore.set(buildConsent({ childId: String(childId), purpose, granted: granted !== false, actorUid: uid }));
    res.json({ grant });
  });
  // List a child's consent records (parent-owner only).
  router.get("/consent/:childId", requireOwnership, async (req, res) => {
    res.json({ grants: await consentStore.list(req.params.childId) });
  });
  // Revoke a single consent grant.
  router.delete("/consent/:id", async (req, res) => {
    const grant = await consentStore.revoke(req.params.id);
    if (!grant) { res.status(404).json({ error: "Consent grant not found" }); return; }
    res.json({ grant });
  });

  router.get("/memory/:childId", requireOwnership, async (req, res) => {
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
    // MON-2: the co-parent seat is the Family tier's differentiator. Gate it on
    // the entitlement's coParentSeats (Free/Plus = 0, Family = 1) and the count of
    // active co-parent grants the owner already holds. 402 → client opens paywall.
    if (role === "co_parent") {
      const entitlement = await resolveEntitlement(entitlementStore, { uid, email });
      const seats = entitlement.limits.coParentSeats;
      if (seats < 1) {
        res.status(402).json({
          error: "Co-parent sharing is an Arbor Family feature",
          details: "Upgrade to Arbor Family to invite a co-parent to share your account.",
          upgrade: { feature: "coParentSeats", plan: "family" },
        });
        return;
      }
      const activeCoParents = (await shareStore.listByOwner(uid))
        .filter((g) => g.role === "co_parent" && isShareActive(g)).length;
      if (activeCoParents >= seats) {
        res.status(402).json({
          error: "Co-parent seat limit reached",
          details: `Your plan includes ${seats} co-parent seat${seats === 1 ? "" : "s"}. Revoke the current co-parent before inviting another.`,
          upgrade: { feature: "coParentSeats", plan: "family" },
        });
        return;
      }
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
      const approvedMemory = await getApprovedMemoryContext(memoryStore, childId, config.memoryPromptMaxFacts);
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
      const approvedMemory = await getApprovedMemoryContext(memoryStore, childId, config.memoryPromptMaxFacts);
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

  // Child articulation ASR (child voice only; parent voice = Gemini Live). GET
  // reports whether a cloud scorer is configured so the client caches capability
  // and falls back to on-device Web Speech when it isn't.
  router.get("/score-utterance", (_req, res) => {
    res.json({ configured: childAsrConfigured(config), provider: config.childAsrProvider });
  });

  router.post("/score-utterance", requireConsent(consentStore, "voice_processing", (req) => childAsrConfigured(config) && !!req.body?.audio), async (req, res) => {
    const { target, sound, level, audio } = req.body ?? {};
    if (!childAsrConfigured(config)) { res.json({ configured: false }); return; }
    if (!target || typeof target !== "string") { res.status(400).json({ error: "target is required" }); return; }

    // Lenient audio data-URL parse — MediaRecorder mime types include `;codecs=…`.
    const dataUrl: unknown = audio?.dataUrl ?? audio;
    const m = typeof dataUrl === "string" ? /^data:(.*?);base64,(.+)$/s.exec(dataUrl) : null;
    if (!m) { res.status(400).json({ error: "An audio data URL is required" }); return; }
    const mimeType = (typeof audio?.mimeType === "string" && audio.mimeType) || m[1].split(";")[0] || "audio/webm";
    if (!mimeType.startsWith("audio/")) { res.status(400).json({ error: "Only audio is supported" }); return; }
    const dataB64 = m[2];
    if (Math.floor((dataB64.length * 3) / 4) > 8 * 1024 * 1024) { res.status(413).json({ error: "Audio too large" }); return; }

    try {
      const result = await scoreChildUtterance(config, modelProvider, {
        target,
        sound: String(sound ?? ""),
        level: String(level ?? "word"),
        audio: { data: dataB64, mimeType },
      });
      res.json({ configured: true, ...result });
    } catch (error: any) {
      if (error instanceof NotConfiguredError) { res.json({ configured: false }); return; }
      logger.error("Child ASR Error", error, { requestId: requestIdOf(req) });
      res.status(502).json({ error: "Couldn't score that recording", details: error.message });
    }
  });

  // AVA-1: Augmented Avatar. Turn descriptors (default) or an optional reference
  // photo into a STYLIZED, non-photorealistic character. Privacy-first: the
  // reference photo is used only for this single generation call and is NEVER
  // persisted server-side. Outputs from Gemini 2.5 Flash Image carry SynthID + C2PA.
  const AVATAR_STYLES: Record<string, string> = {
    storybook: "a warm hand-illustrated children's storybook character, soft ink linework and gentle watercolor shading",
    soft3d: "a soft rounded 3D-rendered character, friendly and approachable, soft studio lighting",
    watercolor: "a soft watercolor children's-book character with loose painterly edges",
    flat: "a clean flat vector character illustration with simple rounded shapes and a cheerful palette",
    comichero: "a friendly child superhero in a bold, modern cel-shaded comic-book style: thick confident ink outlines, super-saturated primary colors (hero red + sky blue + sunshine yellow), halftone dot shading, an explosive radial action burst behind the hero, a flowing cape and a sleek fitted hero suit with a round chest emblem, a huge joyful grin and a dynamic mid-action pose — high-energy and exciting but always wholesome, never scary or violent, age-appropriate for young children"
  };

  router.post("/generate-avatar", requireConsent(consentStore, "face_processing", (req) => !!req.body?.photo), async (req, res) => {
    const { descriptors, photo, style } = req.body ?? {};
    const stylePrompt = AVATAR_STYLES[style as string] ?? AVATAR_STYLES.storybook;

    // Safety-screen any free-text descriptor the parent typed.
    const freeText = [descriptors?.vibe, descriptors?.notes].filter(Boolean).join(" ");
    const escalationMatch = screenForImmediateEscalation({ note: freeText });
    if (escalationMatch) {
      res.status(409).json({
        error: "Professional support recommended",
        details: `Let's pause on the avatar for now. Category: ${escalationMatch.category}.`,
        escalationCategory: escalationMatch.category
      });
      return;
    }

    // Optional reference photo: validate + size-cap, never store it.
    let referenceImage: { data: string; mimeType: string } | null = null;
    if (photo) {
      const parsed = parseDataUrl(photo?.dataUrl ?? photo);
      if (!parsed || !parsed.mimeType.startsWith("image/")) {
        res.status(400).json({ error: "Only image uploads are supported for the photo reference" });
        return;
      }
      const approxBytes = Math.floor((parsed.data.length * 3) / 4);
      if (approxBytes > 6 * 1024 * 1024) {
        res.status(413).json({ error: "Photo too large — please use a smaller image" });
        return;
      }
      referenceImage = parsed;
    }

    const cues = descriptors
      ? [
          descriptors.hair && `hair: ${descriptors.hair}`,
          descriptors.skin && `skin tone: ${descriptors.skin}`,
          descriptors.eyes && `eyes: ${descriptors.eyes}`,
          descriptors.vibe && `personality/vibe: ${descriptors.vibe}`
        ].filter(Boolean).join("; ")
      : "";

    const prompt = `Create a single, friendly, age-appropriate CHARACTER AVATAR for a child, for use in a calm parenting app.
Style: ${stylePrompt}.
This must be a STYLIZED, NON-photorealistic illustration — create an original, friendly character. Do NOT reproduce any real person's exact likeness.
${cues ? `Loose appearance cues (stylize, do not copy literally): ${cues}.` : "Use a warm, neutral, friendly child character."}
${referenceImage ? "A reference photo is attached ONLY to capture general vibe (approximate hair colour, age). Produce a cartoon character inspired by it — never a realistic reproduction of the person." : ""}
Framing: head-and-shoulders portrait, centered, simple soft background, warm and calm. Single character only. No text, no logos, no words drawn into the image.`;

    try {
      const image = await modelProvider.generateImage({
        prompt,
        images: referenceImage ? [referenceImage] : undefined
      });
      // The reference photo (referenceImage) is intentionally discarded here — it is
      // never written to storage, logs, or the response.
      res.json({
        dataUrl: `data:${image.mimeType};base64,${image.data}`,
        style: style ?? "storybook",
        source: referenceImage ? "photo" : "descriptor"
      });
    } catch (error: any) {
      logger.error("Arbor Avatar Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Couldn't create that avatar — please try again", details: error.message });
    }
  });

  // AVA-3: Child-as-hero. Render a storybook SCENE for one story beat, featuring the
  // child's own stylized character (passed as a reference for cross-scene consistency).
  // The reference is a generated stylized avatar (never a raw face) and is not stored.
  router.post("/generate-scene", async (req, res) => {
    const { imagePrompt, avatar, style } = req.body ?? {};
    if (!imagePrompt || typeof imagePrompt !== "string") {
      res.status(400).json({ error: "An imagePrompt is required" });
      return;
    }
    const escalationMatch = screenForImmediateEscalation({ note: imagePrompt });
    if (escalationMatch) {
      res.status(409).json({
        error: "Professional support recommended",
        details: `Let's pause this story scene. Category: ${escalationMatch.category}.`,
        escalationCategory: escalationMatch.category
      });
      return;
    }

    let referenceImage: { data: string; mimeType: string } | null = null;
    if (avatar) {
      const parsed = parseDataUrl(avatar?.dataUrl ?? avatar);
      if (parsed && parsed.mimeType.startsWith("image/")) {
        const approxBytes = Math.floor((parsed.data.length * 3) / 4);
        if (approxBytes <= 6 * 1024 * 1024) referenceImage = parsed;
      }
    }

    const stylePrompt = AVATAR_STYLES[style as string] ?? AVATAR_STYLES.storybook;
    const prompt = `Create a single, warm children's-storybook SCENE illustration.
Style: ${stylePrompt}.
Scene: ${imagePrompt}
${referenceImage
  ? "The attached character is the HERO of this story — feature this same stylized character as the main character in the scene, kept recognizable and consistent with the reference."
  : "Feature a single friendly child character as the hero."}
Gentle, non-scary, age-appropriate for ages 4-8. Calm, soft palette. No text, words, letters, or logos drawn in the image.`;

    try {
      const image = await modelProvider.generateImage({
        prompt,
        images: referenceImage ? [referenceImage] : undefined
      });
      res.json({ dataUrl: `data:${image.mimeType};base64,${image.data}` });
    } catch (error: any) {
      logger.error("Arbor Scene Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Couldn't illustrate this scene", details: error.message });
    }
  });

  // HERO COMIC (A3b): a single dynamic full-page comic-book panel that stars the
  // child's own stylized hero (avatar passed as a consistency reference, never a
  // raw face, never stored). Cel-shaded premium comic style with short SFX +
  // one dialogue line — wholesome and age-appropriate. Powered by the image model
  // (Nano Banana), which auto-applies SynthID + C2PA provenance.
  router.post("/generate-comic", async (req, res) => {
    const { avatar, heroName, sidekickName, theme, dialogue, sfx, setting, style, nameOnSuit } = req.body ?? {};
    const safeName = String(heroName ?? "the hero").slice(0, 40);
    const themeText = String(theme ?? "a brave, kind everyday adventure").slice(0, 200);

    const escalationMatch = screenForImmediateEscalation({ note: `${themeText} ${dialogue ?? ""}` });
    if (escalationMatch) {
      res.status(409).json({
        error: "Professional support recommended",
        details: `Let's pause this comic. Category: ${escalationMatch.category}.`,
        escalationCategory: escalationMatch.category
      });
      return;
    }

    let referenceImage: { data: string; mimeType: string } | null = null;
    if (avatar) {
      const parsed = parseDataUrl(avatar?.dataUrl ?? avatar);
      if (parsed && parsed.mimeType.startsWith("image/")) {
        const approxBytes = Math.floor((parsed.data.length * 3) / 4);
        if (approxBytes <= 6 * 1024 * 1024) referenceImage = parsed;
      }
    }

    const stylePrompt = AVATAR_STYLES[style as string] ?? AVATAR_STYLES.comichero;
    const sfxLine = Array.isArray(sfx) && sfx.length
      ? sfx.slice(0, 4).map((s: unknown) => String(s).slice(0, 12)).join(", ")
      : "KA-POW!, ZAP!, WHOOSH!";
    // Dialogue bubble is OPTIONAL: standalone comics pass a line; embedded story
    // panels omit it (the narration caption carries the words) so text isn't doubled.
    const dialogueLine = dialogue === undefined || dialogue === null ? "" : String(dialogue).slice(0, 120);

    // The hero's name on the chest emblem is what makes the panel feel like it's
    // truly THEIR comic (the viral hook). On by default for the comichero style.
    const showNameOnSuit = nameOnSuit !== false && safeName !== "the hero";
    const prompt = `Create a SINGLE dynamic full-page comic-book panel in a bold, premium cel-shaded comic art style: thick confident ink outlines, super-saturated primary colors, halftone dot shading, an EXPLOSIVE radial action burst and dramatic speed lines behind the hero, glowing sparkle effects — high-energy, eye-catching, and heroic, the kind of vivid panel a 5-8 year old would be thrilled to see themselves in.
Hero: ${stylePrompt}. Name: ${safeName}.
${referenceImage
  ? "The attached character is the HERO — feature this exact stylized character as the main, central figure in a confident mid-action pose, kept recognizable and consistent with the reference (same face, hair, suit)."
  : "Feature a single friendly child superhero as the central, large, mid-action figure."}
${showNameOnSuit ? `Write the hero's name "${safeName}" boldly and legibly across the round chest emblem of the suit.` : ""}
${sidekickName ? `Include a friendly younger sidekick named ${String(sidekickName).slice(0, 40)} in a matching hero suit beside them.` : ""}
Scene/theme: ${themeText}.
Setting: ${String(setting ?? "a cozy, lived-in family home interior").slice(0, 160)}.
Include 2-3 BIG, bold, stylized comic sound-effect words bursting in the scene with thick outlines and bright fills: ${sfxLine}.
${dialogueLine ? `Include ONE clean white speech bubble with a bold tail, containing the short, legible, friendly line: "${dialogueLine}".` : "Do not draw any speech bubbles or sentences — only the short sound-effect words."}
Wholesome and age-appropriate for young children: confident, joyful and exciting, but NO real violence, weapons, blood, fear, or scary imagery. Keep all text short, correctly spelled, and clearly legible.`;

    try {
      const image = await modelProvider.generateImage({
        prompt,
        images: referenceImage ? [referenceImage] : undefined
      });
      res.json({ dataUrl: `data:${image.mimeType};base64,${image.data}` });
    } catch (error: any) {
      logger.error("Arbor Comic Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Couldn't create this comic", details: error.message });
    }
  });

  // Generative Cognitive Adventure: a personalized, kids-safe comprehension story
  // returned in the exact AdventureScenario shape the Practice Studio already renders.
  // Server normalizes ids + enforces exactly one correct choice per scene.
  const ADVENTURE_SKILLS = ["vocabulary", "logic", "sequencing", "instructions", "abstract"];
  const normalizeAdventure = (raw: any, age: number) => {
    const scenesIn = Array.isArray(raw?.scenes) ? raw.scenes.slice(0, 4) : [];
    const scenes = scenesIn.map((sc: any, i: number) => {
      const choicesIn = Array.isArray(sc?.choices) ? sc.choices.slice(0, 3) : [];
      let seenCorrect = false;
      const choices = choicesIn.map((c: any, j: number) => {
        const correct = !seenCorrect && c?.correct === true;
        if (correct) seenCorrect = true;
        return {
          id: `c${j}`,
          emoji: typeof c?.emoji === "string" && c.emoji ? c.emoji : "•",
          text: String(c?.text ?? "").slice(0, 120),
          correct,
          feedback: String(c?.feedback ?? "").slice(0, 300),
        };
      });
      // Guarantee exactly one correct choice.
      if (choices.length > 0 && !choices.some((c: any) => c.correct)) choices[0].correct = true;
      return {
        id: `s${i}`,
        skill: ADVENTURE_SKILLS.includes(sc?.skill) ? sc.skill : "logic",
        prompt: String(sc?.prompt ?? "").slice(0, 300),
        choices,
      };
    }).filter((s: any) => s.choices.length >= 2 && s.prompt);
    return {
      id: `gen-${Date.now()}`,
      title: String(raw?.title ?? "A New Adventure").slice(0, 80),
      emoji: typeof raw?.emoji === "string" && raw.emoji ? raw.emoji : "🧭",
      ageBand: [Math.max(0, age - 1), age + 1] as [number, number],
      intro: String(raw?.intro ?? "").slice(0, 300),
      scenes,
    };
  };

  router.post("/generate-adventure", async (req, res) => {
    const { childProfile, focusSkill } = req.body ?? {};
    const name = (childProfile?.name && String(childProfile.name).trim()) || "your child";
    const age = Number(childProfile?.age ?? 5);
    const interests = Array.isArray(childProfile?.strengths) ? childProfile.strengths.slice(0, 4).join(", ") : "";

    // Safety gate on the child's free-text profile fields before generating child-facing play.
    const escalationMatch = screenForImmediateEscalation({
      behaviorLogs: [interests, ...(Array.isArray(childProfile?.challenges) ? childProfile.challenges : [])].join(" "),
    });
    if (escalationMatch) {
      res.status(409).json({
        error: "Professional support recommended",
        details: `Let's pause new story play for now. Category: ${escalationMatch.category}.`,
        escalationCategory: escalationMatch.category,
      });
      return;
    }

    const skillLine = ADVENTURE_SKILLS.includes(focusSkill)
      ? `Aim most scenes at this thinking skill: ${focusSkill}.`
      : "Vary the thinking skills across scenes (vocabulary, logic, sequencing, following instructions, abstract).";

    const prompt = `${NON_DIAGNOSTIC_CONTRACT}
You are Arbor's gentle children's storyteller. Build a SHORT "Cognitive Adventure" — a comprehension game disguised as a warm little story for ${name}, age ${age}.
${interests ? `Weave in things ${name} loves: ${interests}.` : ""}
${skillLine}

RULES:
- 3 scenes. Each scene: a 1-2 sentence situation ending in a simple question, plus EXACTLY 3 choices.
- Exactly ONE choice is correct; the other two are gentle, plausible, never silly-cruel.
- Every choice has warm, encouraging "feedback" — the child NEVER fails; wrong picks get a kind nudge to think again.
- Vocabulary and sentence length fit age ${age}. Use ${name} by name.
- Completely safe and non-scary: no violence, injury, death, fear, or frightening imagery. Conflict stays light and resolves kindly.
- Each scene names a "skill" from exactly: vocabulary, logic, sequencing, instructions, abstract.
- Give a short title, one emoji, and a one-sentence intro that addresses ${name}.
- Use "{name}" as a placeholder for the child's name in prompts/feedback where natural.`;

    const schema = {
      type: Type.OBJECT,
      required: ["title", "emoji", "intro", "scenes"],
      properties: {
        title: { type: Type.STRING },
        emoji: { type: Type.STRING },
        intro: { type: Type.STRING },
        scenes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            required: ["prompt", "skill", "choices"],
            properties: {
              prompt: { type: Type.STRING },
              skill: { type: Type.STRING },
              choices: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  required: ["text", "emoji", "correct", "feedback"],
                  properties: {
                    text: { type: Type.STRING },
                    emoji: { type: Type.STRING },
                    correct: { type: Type.BOOLEAN },
                    feedback: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      },
    };

    try {
      const privacy = createRedaction(name);
      const raw = privacy.restoreDeep(await modelProvider.generateJson({
        route: "creative_low_risk",
        prompt: privacy.redact(prompt) + REDACTION_DIRECTIVE,
        temperature: 0.8,
        schema,
      })) as Record<string, unknown>;
      const adventure = normalizeAdventure(raw, age);
      if (adventure.scenes.length === 0) {
        res.status(502).json({ error: "Couldn't build a complete adventure — please try again" });
        return;
      }
      res.json(adventure);
    } catch (error: any) {
      logger.error("Arbor Adventure Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Couldn't create that adventure — please try again", details: error.message });
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
- This story is rendered as a COMIC BOOK starring ${heroName}. For each beat also return:
  • "imagePrompt": a one-line description of a dynamic, exciting comic-book ACTION panel for this beat (vivid pose, setting, emotion) — describe only the scene, no text/words drawn in it.
  • "sfx": an array of 2-3 SHORT, punchy comic sound-effect words that fit this exact beat (e.g. ["WHOOSH!","BOOM!"]; for a calm beat ["AHH…","TWINKLE!"]). Vary them per beat — never reuse the same set.
  • "dialogue": ONE very short, exciting first-person hero line ${heroName} would shout or say in this beat (max ~8 words), for a comic speech bubble. Keep it kid-friendly and energetic.
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
                required: ["beatId", "title", "narration", "imagePrompt", "sfx", "dialogue"],
                properties: {
                  beatId: { type: Type.STRING },
                  title: { type: Type.STRING },
                  narration: { type: Type.STRING },
                  imagePrompt: { type: Type.STRING },
                  sfx: { type: Type.ARRAY, items: { type: Type.STRING } },
                  dialogue: { type: Type.STRING }
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
        status: entitlement.status ?? null,
        provider: entitlement.provider ?? null,
        currentPeriodEnd: entitlement.currentPeriodEnd ?? null,
        willRenew: entitlement.willRenew ?? null,
        isAdmin: isAdmin(actor),
      });
    } catch (error: any) {
      logger.error("Arbor Entitlement Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to resolve entitlement", details: error.message });
    }
  });

  // MON-2: start a hosted checkout (RevenueCat Web Billing / Stripe link) for the
  // signed-in parent. The uid is forwarded so the purchase webhook lands here.
  router.post("/billing/checkout", async (req, res) => {
    try {
      const actor = actorOf(req);
      const plan = String(req.body?.plan ?? "plus");
      const cadence = String(req.body?.cadence ?? "monthly");
      if (!["plus", "family"].includes(plan) || !["monthly", "annual"].includes(cadence)) {
        res.status(400).json({ error: "Invalid plan or cadence" });
        return;
      }
      const url = billingCheckoutUrl(config, {
        plan: plan as "plus" | "family",
        cadence: cadence as "monthly" | "annual",
        uid: actor.uid,
        email: actor.email,
      });
      if (!url) {
        res.status(503).json({ error: "Checkout not configured", details: `No checkout link set for ${plan} ${cadence}.` });
        return;
      }
      res.json({ url });
    } catch (error: any) {
      logger.error("Arbor Billing Checkout Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to start checkout", details: error.message });
    }
  });

  // MON-2: customer self-service portal link (manage / cancel web subscriptions).
  router.get("/billing/portal", (_req, res) => {
    res.json({ url: config.billingManageUrl ?? null });
  });

  // ADM-1: founder dashboard — total users, paying-by-plan, today's token spend.
  // Gated to ARBOR_ADMIN_UIDS / ARBOR_ADMIN_EMAILS; 403 for everyone else.
  router.get("/admin/overview", async (req, res) => {
    const actor = actorOf(req);
    if (!isAdmin(actor)) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
    try {
      res.json(await adminMetrics.overview());
    } catch (error: any) {
      logger.error("Arbor Admin Overview Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to load admin overview", details: error.message });
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
  router.get("/privacy/export/:childId", requireOwnership, async (req, res) => {
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
  router.post("/privacy/erase", requireOwnership, async (req, res) => {
    const { uid } = actorOf(req);
    const { childId } = req.body;
    if (!childId || typeof childId !== "string") {
      res.status(400).json({ error: "childId is required" });
      return;
    }
    try {
      const memoryEvents = await memoryStore.eraseChild(childId);
      const shares = await shareStore.eraseByChild(uid, childId);
      const consents = await consentStore.eraseByChild(childId);
      logger.info("GDPR erasure executed", { requestId: requestIdOf(req), childId, memoryEvents, shares, consents });
      res.json({ erased: { memoryEvents, shares, consents }, childId, erasedAt: new Date().toISOString() });
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
