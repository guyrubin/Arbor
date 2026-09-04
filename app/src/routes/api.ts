import express from "express";
import { createHash } from "node:crypto";
import type { ArborConfig } from "../config/env.js";
import { isAbortError, newAbortError, type ModelCallBudget, type ModelProvider } from "../ai/modelRouter.js";
import { abortableIterate, raceWithAbort } from "../ai/modelRetry.js";
import type { MemoryStore } from "../memory/types.js";
import { createCoachResponseGeminiSchema, coachResponseZodSchema, NON_DIAGNOSTIC_CONTRACT, renderCoachResponse, buildSourceCards } from "../contracts/coach.js";
import { PROMPT_VERSIONS, buildChatPrompt, buildCouncilSynthesisPrompt, buildExtractLogPrompt, buildVoiceReplyPrompt, promptProfile } from "../ai/prompts.js";
// Masterplan 1.3 — server-defensive sanitizers for the two OPTIONAL /chat body
// fields (recentTurns transcript + counts-only weeklyContext). Both degrade to
// the byte-identical legacy prompt on any malformed/absent input.
import { sanitizeRecentTurns, sanitizeWeeklyContext } from "../ai/chatContext.js";
import { buildDevelopmentalFrameworkPrompt, type FrameworkDefinition } from "../services/framework.js";
import { screenForImmediateEscalation, renderEscalationMarkdown, escalationMatchForCategory } from "../safety/escalation.js";
import { DEFAULT_MEMORY_RETENTION, appendMemoryProposals, enforceMemoryRetention, foldMemoryEvents, getApprovedMemoryContext, getApprovedMemoryContextDetail, toChildId, toFamilyId, transitionMemory } from "../memory/memoryService.js";
import { loadKnowledgeCardsWithMetadata, renderKnowledgeContext, retrieveKnowledgeCards, loadCardsByIds } from "../knowledge/wiki.js";
// AI-03: the retrieval keys the routes actually have. `childProfile.ageBand`
// and `childProfile.domains` do not exist on ChildProfile and were never on
// the wire, so both filters were permanently inert — see knowledge/retrievalKeys.
import { COACH_EXCLUDED_CARD_TYPES, retrievalKeysFor } from "../knowledge/retrievalKeys.js";
import { resolveScholar } from "../services/scholars.js";
import { selectCouncil, runScholarTakes, renderCouncilForSynthesis } from "../services/council.js";
import { buildGrant, isShareActive, type ShareStore } from "../sharing/shares.js";
import { getStorySpec } from "../lib/heroJourneys.js";
import { ARBOR_PROFESSIONALS, filterProfessionals } from "../services/professionals.js";
import { Type } from "@google/genai";
import { createRedaction, REDACTION_DIRECTIVE, type RedactionContext } from "../server/redaction.js";
import { runAccountDeletion, createFirestoreDeletionOps } from "../server/accountDeletion.js";
import { screenModelOutput, screenModelOutputLexical, renderBlockedOutputMarkdown, outputClassifierEnabled, type OutputScreenVerdict } from "../safety/outputScreen.js";
import { SENTENCE_BOUNDARY_SCAN } from "../lib/sentenceStream.js";
import { createJsonTextFieldExtractor } from "../server/jsonTextStream.js";
import { mintTtsToken, verifyTtsToken } from "../server/ttsToken.js";
import { assembleHeroJourneyScreenable } from "../safety/heroJourneyScreenable.js";
import { logger, requestIdOf } from "../server/logger.js";
import { requireChildOwnership } from "../server/requireChildOwnership.js";
import { requireConsent } from "../server/requireConsent.js";
import { CANONICAL_BEHAVIOR_TYPES } from "../content/behaviorTaxonomy.js";
import { buildConsent, type ConsentPurpose, type ConsentStore } from "../sharing/consent.js";
import { computeWeeklyDigestStats, fallbackDigestNarrative, buildDigestEmail } from "../server/digest.js";
import { resolveEmailProvider } from "../server/emailProvider.js";
import { buildConsultRequest, type ConsultStore } from "../server/consultRequests.js";
import { resolveEntitlement, COACH_METER, type EntitlementStore } from "../server/entitlements.js";
import type { ReferralStore } from "../server/referral.js";
import { scoreChildUtterance, childAsrConfigured, NotConfiguredError } from "../server/childAsr.js";
import { dispatchSpeechSynthesis, screenAndSynthesizeSpeech, synthesizeSpeech, ttsConfigured, NotConfiguredError as TtsNotConfigured, UnsafeTtsOutputError } from "../server/tts.js";
import { AiProviderError } from "../ai/capabilities/contracts.js";
import type { CapabilityRegistry } from "../ai/capabilities/registry.js";
import { billingCheckoutUrl } from "../server/billing.js";
import { buildLiveSystemInstruction, liveSpeechConfig, SPOKEN_COACH_PERSONA, spokenLanguageDirective } from "../lib/livePersona.js";
import { isAdmin } from "../server/admin.js";
import type { AdminMetricsStore } from "../server/adminMetrics.js";
import type { UsageCounterStore } from "../server/quotaStore.js";
import { buildWaitlistEntry, isValidEmail, notifyWaitlistSafely, type WaitlistNotifier, type WaitlistStore } from "../server/waitlist.js";
import { createSharedChildRecordSource, resolveSharedPacket, type SharedChildRecordSource } from "../server/sharedPacket.js";

type ApiDeps = {
  config: ArborConfig;
  modelProvider: ModelProvider;
  memoryStore: MemoryStore;
  shareStore: ShareStore;
  consentStore: ConsentStore;
  framework: FrameworkDefinition;
  entitlementStore: EntitlementStore;
  referralStore: ReferralStore;
  counters: UsageCounterStore;
  consultStore: ConsultStore;
  adminMetrics: AdminMetricsStore;
  waitlistStore: WaitlistStore;
  waitlistNotifier?: WaitlistNotifier | null;
  /** C2: push token store (FCM). Off-by-default client-side via VITE_FIREBASE_VAPID_KEY. */
  pushTokenStore?: import("../server/pushTokens.js").PushTokenStore;
  /** CARE-2: read seam for the recipient shared view (injectable for tests);
   *  defaults to the Firestore/local source derived from config. */
  sharedChildSource?: SharedChildRecordSource;
  /** AIR-8: the boot-time CapabilityRegistry. When present (production wiring
   *  via createApp), /api/tts resolves synthesis through
   *  registry.get("speech_synthesis", ...) — the live dispatch seam. */
  aiCapabilityRegistry?: CapabilityRegistry;
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

/**
 * AI-07 — the screened sentence relay, as ONE seam.
 *
 * /chat grew this inline: tail the contract's leading `text` prose out of the
 * raw JSON stream, restore aliases FIRST (the NAME_SUBJECT lexical floor
 * assumes restored names), then release each COMPLETE sentence as its own SSE
 * delta only after `screenModelOutputLexical` passes on the CUMULATIVE restored
 * prose. /council had no streaming at all, so a council answer was a silent
 * spinner until the whole multi-agent orchestration finished. Rather than write
 * a second copy of this (and risk the two screens drifting), both routes now
 * drive the same relay.
 *
 * CLINICAL FIREWALL: a flagged span reaches NO SSE frame — `push`/`flush`
 * return the verdict and release nothing further. Structured panels stay gated
 * at `done`, where the full pre-cadence screen still runs on the complete
 * rendered answer.
 */
const createScreenedProseRelay = (
  res: express.Response,
  restorer: { push: (chunk: string) => string; flush: () => string },
  enabled: boolean,
) => {
  const proseExtractor = createJsonTextFieldExtractor("text");
  let released = "";
  let pending = "";
  const release = (): OutputScreenVerdict | null => {
    for (;;) {
      const boundary = SENTENCE_BOUNDARY_SCAN.exec(pending);
      if (!boundary) return null;
      const sliceEnd = boundary.index + boundary[0].length;
      const bytes = pending.slice(0, sliceEnd);
      // Cumulative alias-restored screen — never a sentence in isolation.
      const verdict = screenModelOutputLexical((released + bytes).trim());
      if (verdict.flagged) return verdict;
      writeSse(res, "delta", { text: bytes });
      released += bytes;
      pending = pending.slice(sliceEnd);
    }
  };
  return {
    push(chunk: string): OutputScreenVerdict | null {
      if (!enabled) return null;
      pending += restorer.push(proseExtractor.push(chunk));
      return release();
    },
    /** The trailing fragment (no sentence boundary yet) is NOT emitted — the
     *  full, screened text arrives in `done` and the client swaps it in. */
    flush(): OutputScreenVerdict | null {
      if (!enabled) return null;
      pending += restorer.flush();
      return release();
    },
  };
};

const parseJson = <T>(value: unknown) => {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return parsed as T;
};

/**
 * AIR-9: per-route deadline budgets. No provider call may run unbounded — a
 * wedged upstream used to mean an indefinite parent-facing spinner (the /chat
 * req-close abort only stopped the SSE relay; the upstream call kept running
 * and billing). Each AI route now threads an AbortSignal budget into the
 * provider, tied BOTH to a deadline and to the client going away, and maps
 * deadline expiry to a calm parent-register error in the existing payload
 * shape. Budgets are env-tunable (ARBOR_BUDGET_<KIND>_MS) so tests and ops can
 * adjust without code changes.
 */
const ROUTE_BUDGET_DEFAULTS_MS = { coach: 45_000, analysis: 15_000, voice: 20_000, image: 60_000 } as const;
type RouteBudgetKind = keyof typeof ROUTE_BUDGET_DEFAULTS_MS;
const routeBudgetMs = (kind: RouteBudgetKind): number => {
  const fromEnv = Number(process.env[`ARBOR_BUDGET_${kind.toUpperCase()}_MS`]);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : ROUTE_BUDGET_DEFAULTS_MS[kind];
};

/** Calm parent-register copy for a deadline expiry — never technical, never alarming. */
const DEADLINE_ERROR = {
  error: "Arbor is taking longer than usual",
  details: "Nothing is wrong with your question — the answer just took too long to prepare. Please try again in a moment.",
} as const;

type RouteBudget = {
  budget: ModelCallBudget;
  signal: AbortSignal;
  /** True when the abort came from the DEADLINE (→ calm error), not the client leaving. */
  readonly timedOut: boolean;
  /** True when the abort came from the client going away (→ end silently). */
  clientGone(): boolean;
  /** Stop the deadline timer once the response has been produced. */
  settle(): void;
};

const createRouteBudget = (res: express.Response, kind: RouteBudgetKind): RouteBudget => {
  const totalMs = routeBudgetMs(kind);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, totalMs);
  (timer as { unref?: () => void }).unref?.();
  // The real client-disconnect signal is the RESPONSE 'close' while the
  // response is not yet ended (the request's own 'close' fires as soon as the
  // JSON body is consumed — long before an SSE response ends).
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
    clearTimeout(timer);
  });
  return {
    budget: { signal: controller.signal, deadlineAt: Date.now() + totalMs, totalMs },
    signal: controller.signal,
    get timedOut() { return timedOut; },
    clientGone: () => controller.signal.aborted && !timedOut,
    settle: () => clearTimeout(timer),
  };
};

/**
 * VC-6: the two /voice safety fallbacks are SPOKEN ALOUD mid-crisis, so they
 * must match the session language — a Hebrew-speaking parent in a Hebrew voice
 * session must never hear an English sentence at the worst possible moment.
 * Server-side he/en map keyed on the request `language` (mirrors the /voice
 * languageDirective pattern). The strings deliberately restate NO helpline
 * numbers — the numbers travel in `resourcesMarkdown`
 * (renderEscalationMarkdown verbatim), which the CRITICAL_HELPLINE_LITERALS
 * tripwire already covers. HE crisis copy is queued for clinical sign-off
 * (GG-4); the fail-closed behavior ships now.
 */
const VOICE_SAFETY_FALLBACKS = {
  en: {
    escalation:
      "I want to make sure you get the right help. This may need a real person right now — please reach out to a professional or local support line. ",
    blocked:
      "I want to be careful here. That's something best looked at with a professional who can see your child in person — like your pediatrician or family health centre. I can help you write down what you're noticing so that conversation is easier.",
  },
  he: {
    escalation:
      "חשוב לי שתקבלו עכשיו את העזרה הנכונה. ייתכן שזה מצריך אדם אמיתי ממש עכשיו — אנא פנו לאיש מקצוע או לקו תמיכה מקומי. ",
    blocked:
      "אני רוצה להיזהר כאן. את זה הכי טוב לבדוק עם איש מקצוע שיכול לראות את ילדכם מקרוב — למשל רופא הילדים או טיפת חלב. אני יכול לעזור לכם לרשום את מה שאתם שמים לב אליו, כדי שהשיחה הזו תהיה קלה יותר.",
  },
} as const;

const voiceSafetyFallback = (language: unknown) =>
  VOICE_SAFETY_FALLBACKS[language === "he" ? "he" : "en"];

/** Spoken when the model produced an empty reply on /voice (pre-cadence literal, unchanged). */
const VOICE_EMPTY_REPLY_FALLBACK = "Let's take this one step at a time — tell me a little more about what's happening.";

export const createApiRouter = ({ config, modelProvider, memoryStore, shareStore, consentStore, framework, entitlementStore, referralStore, counters, consultStore, adminMetrics, waitlistStore, waitlistNotifier, pushTokenStore, sharedChildSource, aiCapabilityRegistry }: ApiDeps) => {
  const router = express.Router();
  // CARE-2: the recipient shared-view read seam (Firestore in prod, null locally).
  const sharedSource = sharedChildSource ?? createSharedChildRecordSource(config, memoryStore);
  const developmentalFramework = buildDevelopmentalFrameworkPrompt(framework);
  const coachResponseSchema = createCoachResponseGeminiSchema(framework);
  // Per-child authorization (closes the IDOR on child-scoped reads/erasure).
  const requireOwnership = requireChildOwnership(memoryStore);

  /**
   * AI-02: the ownership predicate behind requireOwnership, usable INSIDE a
   * route that must not 403 on it. /voice grounds a spoken turn in the child's
   * approved memory; a caller who does not own that childId simply gets no
   * memory block (the turn still answers) rather than another family's facts.
   * Fails CLOSED on any lookup error — the same posture as the middleware.
   */
  const mayReadChildMemory = async (req: express.Request, childId: string): Promise<boolean> => {
    if (!memoryStore.ownsChild) return true;       // single-tenant store
    const { uid } = actorOf(req);
    if (uid === "local-sandbox") return true;      // unauthenticated local/dev
    if (!childId) return false;
    try {
      return await memoryStore.ownsChild(uid, childId);
    } catch {
      return false;
    }
  };

  /**
   * OWN-1: the familyId that reaches ownership-bearing ledger writes is derived
   * from the AUTHENTICATED uid (families collection-group lookup, creating the
   * family on first touch) — NEVER from client-supplied childProfile.familyId.
   * The old toFamilyId fallback stamped 'default-family' onto child docs, so
   * ownsChild could never return true and every requireOwnership route
   * (memory review, privacy export/erase) 403'd in production.
   * Fails CLOSED: a resolution error propagates to the route's error handler
   * rather than silently re-stamping 'default-family' over a good familyId.
   * toFamilyId remains only for single-tenant/local stores (no ensureFamilyForUser).
   */
  const resolveFamilyId = async (req: express.Request, childProfile: unknown): Promise<string> => {
    const { uid } = actorOf(req);
    if (memoryStore.ensureFamilyForUser && uid !== "local-sandbox") {
      return (await memoryStore.ensureFamilyForUser(uid)).familyId;
    }
    return toFamilyId(childProfile);
  };

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
      // SPC2 enforce-on-read: approved facts past their retention window are
      // excluded from the parent-visible list and tombstoned as "expired".
      let items = await enforceMemoryRetention(
        memoryStore,
        foldMemoryEvents(await memoryStore.listEvents(req.params.childId), req.params.childId)
      );
      const status = req.query.status ? String(req.query.status) : undefined;
      if (status) items = items.filter((item) => item.status === status);
      res.json({ items });
    } catch (error: any) {
      logger.error("Memory Read Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to read Arbor memory review ledger", details: error.message });
    }
  });

  // Propose a PENDING, parent-owned memory from a Today surface (e.g. Rhythm's
  // repeated friction peak). Reuses appendMemoryProposals so dedupe + ledger
  // semantics match coach-originated proposals. Nothing enters AI context until
  // the parent approves it in My Child › Memory.
  router.post("/memory/:childId/propose", requireOwnership, async (req, res) => {
    try {
      const { fact, source, retention, prompt, familyId } = req.body ?? {};
      if (typeof fact !== "string" || !fact.trim()) {
        res.status(400).json({ error: "A non-empty memory fact is required" });
        return;
      }
      const items = await appendMemoryProposals(
        memoryStore,
        req.params.childId,
        [{ fact: fact.trim(), source: source || "rhythm", retention: retention || DEFAULT_MEMORY_RETENTION }],
        // OWN-1: uid-derived family in prod; the body's familyId is only the
        // single-tenant/local fallback (via toFamilyId inside resolveFamilyId).
        { familyId: await resolveFamilyId(req, { familyId }), prompt: prompt || "rhythm:pattern", frameRouting: null }
      );
      res.json({ items });
    } catch (error: any) {
      logger.error("Memory Propose Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to propose Arbor memory item", details: error.message });
    }
  });

  router.patch("/memory/:memoryId", async (req, res) => {
    try {
      const { status, fact, retention, source } = req.body;
      if (!["pending", "approved", "rejected", "deleted", "expired"].includes(status)) {
        res.status(400).json({ error: "Invalid Arbor memory status" });
        return;
      }

      // OWN-1: per-child authorization for transitions. The route addresses a
      // memoryId, so resolve it to its childId from the ledger FIRST, then
      // apply the same fail-closed ownership rule as requireChildOwnership
      // (same single-tenant / local-sandbox no-ops as the middleware).
      if (memoryStore.ownsChild) {
        const { uid } = actorOf(req);
        if (uid !== "local-sandbox") {
          const target = foldMemoryEvents(await memoryStore.listEvents()).find(
            (item) => item.memoryId === req.params.memoryId
          );
          if (!target) {
            res.status(404).json({ error: "Arbor memory item not found" });
            return;
          }
          const owned = await memoryStore.ownsChild(uid, target.childId).catch(() => false);
          if (!owned) {
            res.status(403).json({ error: "Not authorized for this child." });
            return;
          }
        }
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
      // CARE-6: ?history=1 includes revoked/expired grants — the owner's own
      // grant records ARE the sharing audit trail (created/expired/revoked
      // dates). Owner-only; recipient reads never resolve inactive grants.
      const includeInactive = req.query.history === "1";
      res.json({ shares: await shareStore.listByOwner(uid, childId, { includeInactive }) });
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

  // CARE-2: the recipient shared VIEW — a read-only, scope-exact packet for a
  // live grant. All authorization (recipient email, server-enforced
  // expiry/revocation, CARE-3 fail-closed scope resolution) and the fail-closed
  // egress guards (forbidden-token scan + non-clinician clinical-term scan) run
  // inside resolveSharedPacket → buildSharedScopePacket — the ONLY egress for
  // recipient-facing child data. Never returns raw subcollection documents.
  router.get("/shared/:grantId/packet", async (req, res) => {
    const { email } = actorOf(req);
    try {
      const result = await resolveSharedPacket({
        grantId: req.params.grantId,
        recipientEmail: email,
        shareStore,
        source: sharedSource,
      });
      if (result.status === 200) {
        res.json(result.view);
        return;
      }
      res.status(result.status).json({ error: result.error });
    } catch (error: any) {
      logger.error("Arbor Shared Packet Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to load the shared view", details: error.message });
    }
  });

  // OWN-1: provisions the families/{familyId}/members/{uid} + children/{childId}
  // docs that requireChildOwnership authorizes against. Identity is SERVER-derived:
  // client-supplied familyId/userId are ignored entirely — honoring them let a
  // caller graft a child into an arbitrary family (IDOR). Idempotent, so the
  // client also calls it per loaded profile to backfill pre-existing accounts.
  router.post("/onboarding/family-child", async (req, res) => {
    try {
      const { childId, childProfile } = req.body ?? {};
      if (!childId || typeof childId !== "string") {
        res.status(400).json({ error: "childId is required" });
        return;
      }
      const { uid } = actorOf(req);
      if (!memoryStore.ensureFamilyChild || !memoryStore.ensureFamilyForUser) {
        res.json({ familyId: toFamilyId(childProfile), childId, userId: uid, adapter: "local", created: false });
        return;
      }
      const { familyId } = await memoryStore.ensureFamilyForUser(uid);
      await memoryStore.ensureFamilyChild({ familyId, childId, userId: uid, childProfile });
      res.json({ familyId, childId, userId: uid, adapter: "firestore", created: true });
    } catch (error: any) {
      logger.error("Arbor Onboarding Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to create Arbor family/child documents", details: error.message });
    }
  });

  // LL-A9 — Learn Library grounding: the client may attach the read it matched
  // to the parent's question ({id, title, keyPoints}). Sanitized hard (shape,
  // string type, length caps) because it is client-supplied prompt input; it
  // rides the existing knowledgeContext channel so the pinned prompt template
  // is untouched and requests without it stay byte-identical (EVAL-6).
  const renderLibraryGrounding = (raw: unknown): string => {
    if (!raw || typeof raw !== "object") return "";
    const lc = raw as { id?: unknown; title?: unknown; keyPoints?: unknown; editorialPilot?: unknown };
    if (typeof lc.title !== "string" || !Array.isArray(lc.keyPoints)) return "";
    // Batch-4 reads ship under an editorial pilot with no individual clinical
    // review. Strict === true, so only that flag adds text; every other request
    // renders byte-identically to before (EVAL-6).
    const pilotNote = lc.editorialPilot === true
      ? " This read is an Arbor editorial pilot: it has not had individual clinical review, so do not describe it as clinician-approved."
      : "";
    const title = lc.title.slice(0, 200);
    const points = lc.keyPoints
      .filter((p): p is string => typeof p === "string")
      .slice(0, 5)
      .map((p, i) => `${i + 1}) ${p.slice(0, 300)}`);
    if (!title || points.length === 0) return "";
    return (
      `\n\nARBOR LEARN LIBRARY (curated parent-facing read matched to this question — align your guidance with its stance; if it fits, mention that the "${title}" read is available in Arbor's Library):\n` +
      `"${title}" — key points: ${points.join(" ")}` + pilotNote
    );
  };

  router.post("/chat", async (req, res) => {
    // 1.3: `recentTurns` (same-thread continuity, no consent change — the
    // parent is looking at these turns) and `weeklyContext` (parent-toggle-
    // gated, counts/categories only) are OPTIONAL and hard-sanitized below;
    // requests without them produce a prompt byte-identical to coach_chat 1.0.0.
    const { message, childProfile, scholarLens, language, libraryContext, recentTurns, weeklyContext } = req.body;
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

    // AIR-9: 45s coach budget — aborts the upstream call on deadline OR when
    // the client goes away (the old res-close abort only stopped the SSE relay).
    const budget = createRouteBudget(res, "coach");

    try {
      // ASK-1 Phase 1: SSE opens immediately and `status` events carry honest,
      // MILESTONE-driven stage keys (memory → sources → plan) instead of the
      // old fixed English sentence + character counters. The client owns the
      // localized copy (i18n `coach.status.*`), so a Hebrew session never sees
      // an English status string.
      if (streamResponse) {
        beginSse(res);
        writeSse(res, "status", { stage: "memory" });
      }

      const childId = toChildId(childProfile);
      // OWN-1: uid-derived family — never the client-supplied childProfile.familyId.
      const familyId = await resolveFamilyId(req, childProfile);
      // ASK-6: keep the fact COUNT alongside the prompt context — the count
      // (an integer only, never content) is backfilled onto the contract so
      // the parent can SEE the answer was grounded in facts they approved.
      const { context: approvedMemory, factsUsed: approvedMemoryFactsUsed } =
        await getApprovedMemoryContextDetail(memoryStore, childId, config.memoryPromptMaxFacts);
      if (streamResponse) writeSse(res, "status", { stage: "sources" });
      // SCH-3: the selected lens is now load-bearing — its scholar's card(s) are
      // guaranteed into the context and lead, alongside age/domain matches.
      const scholar = resolveScholar(scholarLens);
      const retrievedCards = await retrieveKnowledgeCards({
        // AI-03: derived from the child's real age + this question's own
        // subject, not from two fields the client never sends.
        ...retrievalKeysFor(childProfile, message),
        allowedUse: "coach_context",
        excludeTypes: COACH_EXCLUDED_CARD_TYPES,
        limit: 4
      });
      const scholarCards = await loadCardsByIds(scholar.cardIds);
      const seenCardIds = new Set<string>();
      const knowledgeCards = [...scholarCards, ...retrievedCards]
        .filter((card) => (seenCardIds.has(card.id) ? false : (seenCardIds.add(card.id), true)))
        .slice(0, 5);

      // EVAL-6: version-pinned named builder (ai/prompts.ts) — byte-identical
      // to the old inline template; promptVersion is stamped into telemetry.
      const prompt = buildChatPrompt({
        developmentalFramework,
        approvedMemory,
        knowledgeContext: renderKnowledgeContext(knowledgeCards) + renderLibraryGrounding(libraryContext),
        childProfile,
        scholar,
        message,
        languageDirective,
        // 1.3 — client-supplied prompt input, so the caps are re-enforced HERE
        // (role whitelist, per-turn 800 chars, last 6 turns, ~4000-char total;
        // integer clamps + trigger-label cap + outcome enum) no matter what
        // the wire delivered. Empty/invalid ⇒ "" blocks ⇒ legacy bytes.
        recentTurns: sanitizeRecentTurns(recentTurns),
        weeklyContext: sanitizeWeeklyContext(weeklyContext)
      });

      // SEC/CMP P0: child PII never reaches the model — redact at the call seam,
      // restore in the parsed output so the product stays personalized.
      const privacy = createRedaction(childProfile?.name);

      // VC-8 parity, shared by the mid-stream flag and the done-time flag so
      // the blocked-fallback payload shapes stay byte-identical (AIR-1 cond 5).
      const buildBlockedPayload = (outputVerdict: OutputScreenVerdict) => {
        logger.warn("Coach output blocked by output safety screen", {
          requestId: requestIdOf(req),
          category: outputVerdict.category,
          reason: outputVerdict.reason,
        });
        // VC-8: crisis-category output routes to the SAME crisis surface as a
        // crisis INPUT (renderEscalationMarkdown resources + urgent risk) —
        // harm-normalizing model language must end in crisis help, never the
        // generic renderBlockedOutputMarkdown.
        if (outputVerdict.category === "crisis") {
          const crisisMatch = escalationMatchForCategory(outputVerdict.escalationCategory);
          return {
            text: renderEscalationMarkdown(crisisMatch),
            riskLevel: "urgent",
            escalationCategory: crisisMatch.category,
            outputBlocked: true,
            blockedCategory: "crisis" as const,
          };
        }
        return { text: renderBlockedOutputMarkdown(), outputBlocked: true, blockedCategory: outputVerdict.category };
      };

      // ASK-1 Phase 2 + AIR-1: real streaming. The contract's leading `text`
      // prose field is tailed out of the raw JSON stream (jsonTextStream), fed
      // through the alias RESTORER FIRST (the NAME_SUBJECT lexical floor
      // assumes restored names — same ordering as /voice), and released as
      // sentence deltas — each only after screenModelOutputLexical passes on
      // the CUMULATIVE restored prose. On any flag the stream stops and `done`
      // carries the standard blocked payload; the flagged span reaches NO SSE
      // frame. Structured panels stay gated at `done`, where the full
      // pre-cadence screen (lexical + optional semantic classifier) still runs
      // on the complete rendered answer — a done-time flag makes the client
      // RETRACT the streamed bubble and replace it (firewall CONDITIONS 1-3).
      // AI-07: this relay is now the SHARED seam (see createScreenedProseRelay
      // above) — /council drives the identical screen, so the two cannot drift.
      const relay = createScreenedProseRelay(res, privacy.createStreamRestorer(), streamResponse);

      let rawResponse = "";
      if (streamResponse) writeSse(res, "status", { stage: "plan" });

      // The stream is ALSO raced at the route seam (abortableIterate) so even a
      // provider that ignores the signal cannot outlive the budget.
      for await (const chunk of abortableIterate(modelProvider.generateJsonStream({
        route: "coach_high_stakes",
        prompt: privacy.redact(prompt) + REDACTION_DIRECTIVE,
        schema: coachResponseSchema,
        temperature: 0.45,
        budget: budget.budget,
        promptVersion: PROMPT_VERSIONS.coach_chat.version
      }), budget.signal)) {
        if (budget.signal.aborted) { if (!budget.timedOut) return; throw newAbortError(); }
        rawResponse += chunk;
        const verdict = relay.push(chunk);
        if (verdict) {
          writeSse(res, "done", buildBlockedPayload(verdict));
          res.end();
          return;
        }
      }
      {
        const verdict = relay.flush();
        if (verdict) {
          writeSse(res, "done", buildBlockedPayload(verdict));
          res.end();
          return;
        }
      }
      if (budget.signal.aborted) { if (!budget.timedOut) return; throw newAbortError(); }

      const structured = privacy.restoreDeep(coachResponseZodSchema.parse(parseJson(rawResponse.trim())));
      if (!structured.sourceCardsUsed?.length && knowledgeCards.length > 0) {
        structured.sourceCardsUsed = knowledgeCards.map((card) => card.id);
      }
      // COACH-6: resolve the cited ids to real titles + types from the server
      // knowledge registry so the citation drawer never shows raw slugs.
      structured.sourceCards = buildSourceCards(structured.sourceCardsUsed, knowledgeCards);
      // ASK-6: integer count only (clinical firewall) — the model never emits
      // this; it is the number of approved facts injected into the prompt.
      structured.approvedMemoryFactsUsed = approvedMemoryFactsUsed;

      // AI-2: output-side safety screen (lexical floor + optional semantic classifier).
      const renderedText = renderCoachResponse(structured);
      const outputVerdict = await screenModelOutput(modelProvider, renderedText);
      if (outputVerdict.flagged) {
        // Done-time flag (lexical floor on the FULL rendered answer + the
        // semantic classifier when enabled): same payload as the mid-stream
        // flag — the client retracts any streamed bubble and replaces it.
        const blockedPayload = buildBlockedPayload(outputVerdict);
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
      budget.settle();
      const payload = { text: renderedText, contract: structured, memoryReviewItems };
      if (streamResponse) {
        writeSse(res, "done", payload);
        res.end();
      } else {
        res.json(payload);
      }
    } catch (error: any) {
      budget.settle();
      if (budget.clientGone()) return;
      if (budget.timedOut || isAbortError(error)) {
        // AIR-9: deadline expiry → calm parent-register error, same payload
        // shape as the existing error event (client copy stays localized).
        logger.warn("Arbor Chat deadline exceeded", { requestId: requestIdOf(req) });
        if (streamResponse) {
          if (!res.headersSent) beginSse(res);
          writeSse(res, "error", DEADLINE_ERROR);
          res.end();
        } else {
          res.status(504).json(DEADLINE_ERROR);
        }
        return;
      }
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
    // AIR-9: one 45s budget covers the whole council (parallel takes + synthesis).
    const budget = createRouteBudget(res, "coach");
    try {
      const childId = toChildId(childProfile);
      // OWN-1: uid-derived family — never the client-supplied childProfile.familyId.
      const familyId = await resolveFamilyId(req, childProfile);
      // ASK-6: same count-only memory visibility as /chat.
      const { context: approvedMemory, factsUsed: approvedMemoryFactsUsed } =
        await getApprovedMemoryContextDetail(memoryStore, childId, config.memoryPromptMaxFacts);
      const lead = resolveScholar(scholarLens);
      // AI-03: council selection was keyed on childProfile.domains too — a
      // field that does not exist, so every council was the lead scholar plus
      // the same default pair regardless of what the parent asked.
      const retrievalKeys = retrievalKeysFor(childProfile, message);
      const childDomains = retrievalKeys.domains ?? [];
      const council = selectCouncil(lead, childDomains, 3);

      // SEC/CMP P0: scholar agents and the synthesizer only ever see redacted input.
      const privacy = createRedaction(childProfile?.name);

      // 1) Each scholar agent deliberates in parallel (raced at the route seam
      // too, so a signal-ignoring provider cannot outlive the budget).
      const takes = await raceWithAbort(runScholarTakes(modelProvider, council, {
        message: privacy.redact(message),
        childProfile: redactProfile(privacy, childProfile),
        language,
        budget: budget.budget
      }), budget.signal);

      // 2) Ground the synthesis in the council's cards + approved memory.
      const scholarCards = await loadCardsByIds(council.flatMap((s) => s.cardIds));
      const retrievedCards = await retrieveKnowledgeCards({
        // AI-03: same derived keys as /chat. `childDomains` (the old source)
        // read childProfile.domains, which no client has ever sent.
        ...retrievalKeys,
        allowedUse: "coach_context",
        excludeTypes: COACH_EXCLUDED_CARD_TYPES,
        limit: 4
      });
      const seen = new Set<string>();
      const knowledgeCards = [...scholarCards, ...retrievedCards]
        .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
        .slice(0, 6);

      // EVAL-6: version-pinned named builder (ai/prompts.ts) — byte-identical
      // to the old inline template; promptVersion is stamped into telemetry.
      const prompt = buildCouncilSynthesisPrompt({
        developmentalFramework,
        approvedMemory,
        knowledgeContext: renderKnowledgeContext(knowledgeCards),
        childProfile,
        councilTakes: renderCouncilForSynthesis(takes),
        message,
        languageDirective
      });

      const raw = await raceWithAbort(modelProvider.generateJson({
        route: "coach_high_stakes",
        prompt: privacy.redact(prompt) + REDACTION_DIRECTIVE,
        schema: coachResponseSchema,
        temperature: 0.4,
        budget: budget.budget,
        promptVersion: PROMPT_VERSIONS.council_synthesis.version
      }), budget.signal);
      const structured = privacy.restoreDeep(coachResponseZodSchema.parse(raw));
      const restoredTakes = privacy.restoreDeep(takes);
      if (!structured.sourceCardsUsed?.length && knowledgeCards.length > 0) {
        structured.sourceCardsUsed = knowledgeCards.map((c) => c.id);
      }
      // COACH-6: same citation-title resolution as /chat.
      structured.sourceCards = buildSourceCards(structured.sourceCardsUsed, knowledgeCards);
      // ASK-6: integer count only (clinical firewall).
      structured.approvedMemoryFactsUsed = approvedMemoryFactsUsed;

      // AI-2: output-side safety screen.
      const renderedText = renderCoachResponse(structured);
      const outputVerdict = await screenModelOutput(modelProvider, renderedText);
      if (outputVerdict.flagged) {
        logger.warn("Council output blocked by output safety screen", {
          requestId: requestIdOf(req),
          category: outputVerdict.category,
          reason: outputVerdict.reason,
        });
        // VC-8: crisis output → crisis resources, never the generic blocked state.
        if (outputVerdict.category === "crisis") {
          const crisisMatch = escalationMatchForCategory(outputVerdict.escalationCategory);
          res.json({
            text: renderEscalationMarkdown(crisisMatch),
            riskLevel: "urgent",
            escalationCategory: crisisMatch.category,
            outputBlocked: true,
            blockedCategory: "crisis",
            council: [],
          });
          return;
        }
        res.json({ text: renderBlockedOutputMarkdown(), outputBlocked: true, blockedCategory: outputVerdict.category, council: [] });
        return;
      }

      const memoryReviewItems = await appendMemoryProposals(memoryStore, childId, structured.memoryProposals, {
        familyId,
        prompt: message,
        frameRouting: structured.frameRouting
      });
      budget.settle();
      res.json({ text: renderedText, contract: structured, council: restoredTakes, memoryReviewItems });
    } catch (error: any) {
      budget.settle();
      if (budget.clientGone()) return;
      if (budget.timedOut || isAbortError(error)) {
        logger.warn("Arbor Council deadline exceeded", { requestId: requestIdOf(req) });
        res.status(504).json(DEADLINE_ERROR);
        return;
      }
      logger.error("Arbor Council Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to convene the scholar council", details: error.message });
    }
  });

  // RT-2 (v6): STREAMING voice coach over SSE, independent of the Live bidi API.
  // AI-V1+AIR-2 (voice-cadence, 2026-07-25): sentence-boundary screened
  // streaming. The reply is split at lib/sentenceStream boundaries, the output
  // screen runs on the CUMULATIVE alias-restored text at every boundary (never
  // a sentence in isolation), and each sentence is emitted as its own delta
  // ONLY after its screen passes — the client speaks sentence 1 while 2..N
  // generate, and nothing unscreened ever leaves the server. On any flag the
  // stream stops and the calm localized fallback is emitted instead; the
  // flagged span appears in NO SSE frame. When the semantic classifier is ON
  // (ENABLE_OUTPUT_SAFETY_CLASSIFIER=true) the pre-cadence full-buffer
  // behavior is kept, config-gated, because the classifier needs the whole
  // reply. Cadence contract pinned by evals/voice-loop-v1
  // (routes/voiceLoopEval.test.ts) + routes/voiceCadence.test.ts.
  router.post("/voice", async (req, res) => {
    // AI-02: `recentTurns` joins the existing fields — the SAME sanitized
    // same-thread transcript /chat accepts (masterplan 1.3), re-capped here.
    const { message, childProfile, scholarLens, language, recentTurns } = req.body;
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "A message is required" });
      return;
    }
    const escalationMatch = screenForImmediateEscalation({ message });
    beginSse(res);
    if (escalationMatch) {
      // VC-4: voice parents must get the SAME crisis help as typists. Speak a
      // short localized redirect (VC-6) and carry the FULL resources block in
      // the done payload — renderEscalationMarkdown(match) VERBATIM, so the
      // escalationLiteralsIntact tripwire covers every helpline number on this
      // path too. The client stops the voice loop and renders the resources
      // on screen (never resumes listening after a crisis turn).
      writeSse(res, "delta", { text: voiceSafetyFallback(language).escalation });
      writeSse(res, "done", {
        escalation: escalationMatch.category,
        resourcesMarkdown: renderEscalationMarkdown(escalationMatch)
      });
      res.end();
      return;
    }

    // AIR-9: 20s voice budget. Combines the deadline with the client-gone
    // abort (the RESPONSE 'close' while not ended — see createRouteBudget) and
    // threads the signal into the provider so the upstream call actually stops.
    const budget = createRouteBudget(res, "voice");
    try {
      const scholar = resolveScholar(scholarLens);
      // AI-02: a spoken turn used to be the ONLY coach surface with no memory,
      // no source cards and no thread — while the Ask data-contract panel above
      // the mic told the parent every question carries all three. The claim now
      // holds on this path: same approved-memory read, same retrieval keys, same
      // continuity transcript as /chat. The memory read is ownership-gated and
      // fails CLOSED to "no memory" so a spoken turn never breaks on it.
      const voiceChildId = toChildId(childProfile);
      const voiceMemory = (await mayReadChildMemory(req, voiceChildId))
        ? await getApprovedMemoryContext(memoryStore, voiceChildId, config.memoryPromptMaxFacts)
        : "";
      const voiceCards = await retrieveKnowledgeCards({
        ...retrievalKeysFor(childProfile, message),
        allowedUse: "coach_context",
        excludeTypes: COACH_EXCLUDED_CARD_TYPES,
        limit: 3
      });
      const voiceTurns = sanitizeRecentTurns(recentTurns);
      // AI-V9: persona + language directive come from the ONE shared spoken
      // persona module (lib/livePersona.ts) — byte-shared with the Live path.
      const languageDirective = spokenLanguageDirective(language);
      const privacy = createRedaction(childProfile?.name);
      // EVAL-6: version-pinned named builder (ai/prompts.ts). The persona is
      // passed in so lib/livePersona.ts stays the only module stating
      // SPOKEN_COACH_PERSONA; spokenLanguageDirective(language) stays here too.
      const prompt = buildVoiceReplyPrompt({
        persona: SPOKEN_COACH_PERSONA,
        scholar,
        childProfile,
        message,
        languageDirective,
        // AI-02 grounding. Each block renders "" when its source is empty, so a
        // first turn with no memory and no matched card keeps the legacy bytes.
        approvedMemory: voiceMemory,
        knowledgeContext: renderKnowledgeContext(voiceCards),
        recentTurns: voiceTurns
      });

      // SAFE-V1 + AI-V1/AIR-2: the output-safety screen (AI-2) MUST gate /voice
      // the same way it gates /chat and /council — nothing unscreened ever
      // leaves the server. Delivery is config-gated:
      //   - classifier OFF (default): sentence-boundary streaming. Each
      //     complete sentence is screened via the lexical floor on the
      //     CUMULATIVE alias-restored text (cross-sentence diagnosis spans
      //     stay caught) and released as its own delta only after it passes.
      //   - classifier ON: the pre-cadence full-buffer path — assemble, run
      //     screenModelOutput once (lexical + semantic), then emit ONE delta.
      // SEC/CMP P0: redacted prompt in; aliases restored on the way out.
      const restorer = privacy.createStreamRestorer();
      // AI-V5: each screened sentence carries a short-TTL HMAC token so
      // /api/tts can skip ONLY the model re-screen for text that /voice
      // already screened (its lexical floor still runs unconditionally).
      const ttsLang = language === "he" ? "he" : "en";
      const streamRequest = { route: "analysis_structured" as const, prompt: privacy.redact(prompt) + REDACTION_DIRECTIVE, temperature: 0.6, budget: budget.budget, promptVersion: PROMPT_VERSIONS.voice_reply.version };

      // Flagged-output SSE tail, shared by both delivery paths — payloads are
      // byte-identical to the pre-cadence SAFE-V1 behavior.
      const emitBlocked = (outputVerdict: OutputScreenVerdict) => {
        logger.warn("Voice output blocked by output safety screen", {
          requestId: requestIdOf(req),
          category: outputVerdict.category,
          reason: outputVerdict.reason,
        });
        // VC-8: crisis-category output speaks the CRISIS redirect and puts
        // the full resources block on screen — never the generic blocked
        // state. The `escalation` key makes handleVoiceDone stop the loop,
        // so the mic never resumes after a crisis turn (input-path parity).
        if (outputVerdict.category === "crisis") {
          const crisisMatch = escalationMatchForCategory(outputVerdict.escalationCategory);
          writeSse(res, "delta", { text: voiceSafetyFallback(language).escalation });
          writeSse(res, "done", {
            escalation: crisisMatch.category,
            resourcesMarkdown: renderEscalationMarkdown(crisisMatch),
            outputBlocked: true,
            blockedCategory: "crisis",
          });
          res.end();
          return;
        }
        // Never speak the flagged draft. Speak a calm, non-diagnostic spoken
        // fallback that mirrors the /chat blocked behavior (handoff to a real
        // professional) instead — localized per VC-6. blockedMarkdown gives
        // the client a VISIBLE blocked state with byte parity to /chat's
        // renderBlockedOutputMarkdown surface (VC-4 condition 3).
        writeSse(res, "delta", { text: voiceSafetyFallback(language).blocked });
        writeSse(res, "done", {
          outputBlocked: true,
          blockedCategory: outputVerdict.category,
          blockedMarkdown: renderBlockedOutputMarkdown()
        });
        res.end();
      };

      if (outputClassifierEnabled()) {
        // Full-buffer path (config-gated): the semantic classifier judges the
        // WHOLE reply, so buffer, screen once, then emit everything at once.
        let assembled = "";
        for await (const chunk of abortableIterate(modelProvider.streamText(streamRequest), budget.signal)) {
          if (budget.signal.aborted) { if (!budget.timedOut) { res.end(); return; } throw newAbortError(); }
          assembled += restorer.push(chunk || "");
        }
        assembled += restorer.flush();
        assembled = assembled.trim();
        if (budget.signal.aborted) { if (!budget.timedOut) { res.end(); return; } throw newAbortError(); }

        // Screen the assembled text BEFORE it is sent to TTS / streamed to the client.
        if (assembled) {
          const outputVerdict = await screenModelOutput(modelProvider, assembled);
          if (outputVerdict.flagged) { emitBlocked(outputVerdict); return; }
        }
        const spoken = assembled || VOICE_EMPTY_REPLY_FALLBACK;
        writeSse(res, "delta", { text: spoken, tts: { text: spoken, token: mintTtsToken(spoken, ttsLang) } });
        writeSse(res, "done", {});
        res.end();
        return;
      }

      // Streaming path (default): release each sentence the moment its
      // cumulative screen passes. `released` = alias-restored bytes already
      // emitted (all screened); `pending` = bytes still waiting for a
      // sentence boundary. Byte-exact slicing keeps the concatenated deltas
      // identical to the full restored reply, so the client splitter
      // (lib/sentenceStream, same module) reconstructs the same sentences.
      let released = "";
      let pending = "";
      const releaseCompleteSentences = (): OutputScreenVerdict | null => {
        for (;;) {
          const boundary = SENTENCE_BOUNDARY_SCAN.exec(pending);
          if (!boundary) return null;
          const sliceEnd = boundary.index + boundary[0].length;
          const bytes = pending.slice(0, sliceEnd);
          // Cumulative alias-restored screen — never a sentence in isolation.
          const verdict = screenModelOutputLexical((released + bytes).trim());
          if (verdict.flagged) return verdict;
          const sentence = bytes.trim();
          writeSse(res, "delta", { text: bytes, tts: { text: sentence, token: mintTtsToken(sentence, ttsLang) } });
          released += bytes;
          pending = pending.slice(sliceEnd);
        }
      };

      for await (const chunk of abortableIterate(modelProvider.streamText(streamRequest), budget.signal)) {
        if (budget.signal.aborted) { if (!budget.timedOut) { res.end(); return; } throw newAbortError(); }
        pending += restorer.push(chunk || "");
        const verdict = releaseCompleteSentences();
        if (verdict) { emitBlocked(verdict); return; }
      }
      pending += restorer.flush();
      if (budget.signal.aborted) { if (!budget.timedOut) { res.end(); return; } throw newAbortError(); }
      const verdict = releaseCompleteSentences();
      if (verdict) { emitBlocked(verdict); return; }

      // End of stream: run the SAME combined screen seam as SAFE-V1 over the
      // FULL cumulative text before releasing the trailing fragment. (The
      // semantic layer is a no-op in this branch — classifier is off — so
      // this stays synchronous-fast while keeping the seam identical.)
      const finalText = (released + pending).trim();
      if (finalText) {
        const outputVerdict = await screenModelOutput(modelProvider, finalText);
        if (outputVerdict.flagged) { emitBlocked(outputVerdict); return; }
      }
      if (!finalText) {
        writeSse(res, "delta", { text: VOICE_EMPTY_REPLY_FALLBACK, tts: { text: VOICE_EMPTY_REPLY_FALLBACK, token: mintTtsToken(VOICE_EMPTY_REPLY_FALLBACK, ttsLang) } });
      } else if (pending.trim()) {
        const sentence = pending.trim();
        writeSse(res, "delta", { text: pending, tts: { text: sentence, token: mintTtsToken(sentence, ttsLang) } });
      }
      budget.settle();
      writeSse(res, "done", {});
      res.end();
    } catch (error: any) {
      budget.settle();
      if (budget.clientGone()) return;
      if (budget.timedOut || isAbortError(error)) {
        // AIR-9: deadline expiry → calm parent-register error (the client
        // stops the loop and shows the retry state, never a hung orb).
        logger.warn("Arbor Voice deadline exceeded", { requestId: requestIdOf(req) });
        if (!res.headersSent) beginSse(res);
        writeSse(res, "error", DEADLINE_ERROR);
        res.end();
        return;
      }
      logger.error("Arbor Voice Stream Error", error, { requestId: requestIdOf(req) });
      if (!res.headersSent) beginSse(res);
      writeSse(res, "error", { error: "Voice stream failed", details: error.message });
      res.end();
    }
  });

  // VC-7 (live-enablement-gate): Live is available ONLY when the explicit
  // LIVE_ENABLED flag AND the key are both set. Keying on the key alone made
  // the GD-3 hazard an accidental env change — setting GEMINI_API_KEY for any
  // other reason would have silently routed all voice around the screened
  // /voice path. Flipping the flag to true IS the GD-3 unlock (Guy decision).
  const liveConfigured = () => Boolean(config.liveEnabled && config.geminiApiKey);

  // AI-V8: availability computed from config alone — no SDK call, no token
  // mint, no network. CoachTab probes THIS on mount; a real ephemeral token is
  // minted only when the parent actually toggles voice. (An availability
  // endpoint keyed on the key alone would recreate the VC-7 hazard.)
  router.get("/live/availability", (_req, res) => {
    res.json({ available: liveConfigured() });
  });

  // RT-1 (v6): Gemini Live streaming. Mint a short-lived ephemeral token so the
  // browser can open a Live (bidiGenerateContent) audio session DIRECTLY without
  // ever seeing the server key. Reports availability so the client can fall back
  // to the browser voice loop when Live isn't configured/provisioned.
  // Metered by createAiQuota in createApp.ts (same list as the other paid mints).
  router.post("/live/token", async (req, res) => {
    if (!liveConfigured()) {
      res.json({ available: false, reason: "Gemini Live is not enabled on this server." });
      return;
    }
    const apiKey = config.geminiApiKey as string;
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      const model = config.liveModel;
      const expireTime = new Date(Date.now() + 20 * 60 * 1000).toISOString();
      // AI-V9: the instruction + voice are built per session language from the
      // ONE shared spoken-persona module and pinned server-side.
      const systemInstruction = buildLiveSystemInstruction(req.body?.language);
      const speechConfig = liveSpeechConfig(req.body?.language);
      const token = await ai.authTokens.create({
        config: {
          uses: 1,
          expireTime,
          // FW-NEW-P0: pin the persona, voice, and transcription-on INTO the
          // token's constraints at mint time. The Live API rejects a connect
          // config that conflicts with these, so a modified client cannot
          // substitute an arbitrary systemInstruction, swap the voice, or
          // disable the transcription the turn-guard screens against.
          liveConnectConstraints: {
            model,
            config: {
              systemInstruction,
              speechConfig,
              inputAudioTranscription: {},
              outputAudioTranscription: {},
            },
          },
          httpOptions: { apiVersion: "v1alpha" }
        }
      });
      // The pinned instruction/speechConfig are echoed back so the client's
      // connect config stays byte-identical to the pin (cosmetic — the token
      // constraints are authoritative).
      res.json({ available: true, token: (token as any).name, model, expiresAt: expireTime, systemInstruction, speechConfig });
    } catch (error: any) {
      logger.error("Arbor Live Token Error", error, { requestId: requestIdOf(req) });
      res.json({ available: false, reason: error.message });
    }
  });

  // VC-2 + VC-3 (live-turn-guard): the authoritative per-turn screen + audit
  // log for Gemini Live. The client liveTurnGuard posts every finalized turn
  // here and releases NOTHING until this verdict says "continue" (a failure to
  // answer is treated as FLAGGED client-side — VC-5 fail-closed). Sits inside
  // createApiRouter (inherits /api auth) + requireChildOwnership on childId,
  // and on the createAiQuota allow-list (createApp.ts).
  router.post("/live/turn", requireOwnership, async (req, res) => {
    const { role, text, language } = req.body ?? {};
    if ((role !== "user" && role !== "model") || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "role ('user' or 'model') and a non-empty text are required" });
      return;
    }
    // VC-3 condition 2: every turn is auditable even when clean — chars +
    // verdict category ONLY, NEVER the transcript text (child-data minimalism).
    const audit = (verdictCategory: string | null) =>
      logger.info("live.turn", {
        requestId: requestIdOf(req),
        uid: actorOf(req).uid,
        role,
        chars: text.length,
        verdictCategory,
      });
    try {
      if (role === "user") {
        const match = screenForImmediateEscalation({ text });
        audit(match?.category ?? null);
        if (match) {
          // VC-2 condition 3: resources are renderEscalationMarkdown VERBATIM
          // (the CRITICAL_HELPLINE_LITERALS tripwire covers this path); the
          // spoken redirect is the localized VC-6 fallback line.
          res.json({
            action: "stop_crisis",
            category: match.category,
            resourcesMarkdown: renderEscalationMarkdown(match),
            spokenText: voiceSafetyFallback(language).escalation,
          });
          return;
        }
        res.json({ action: "continue" });
        return;
      }
      const verdict = await screenModelOutput(modelProvider, text);
      audit(verdict.category);
      if (verdict.flagged) {
        // VC-8: crisis-category MODEL output stops the session with the SAME
        // crisis surface as a user-role crisis (resources verbatim + spoken
        // redirect) — never the generic blocked state.
        if (verdict.category === "crisis") {
          const crisisMatch = escalationMatchForCategory(verdict.escalationCategory);
          res.json({
            action: "stop_crisis",
            category: crisisMatch.category,
            resourcesMarkdown: renderEscalationMarkdown(crisisMatch),
            spokenText: voiceSafetyFallback(language).escalation,
          });
          return;
        }
        res.json({
          action: "stop_blocked",
          category: verdict.category,
          blockedMarkdown: renderBlockedOutputMarkdown(),
          spokenText: voiceSafetyFallback(language).blocked,
        });
        return;
      }
      res.json({ action: "continue" });
    } catch (error: any) {
      // Fail CLOSED: a screening error must never read as a clean verdict —
      // the non-200 makes the client guard drop the turn and halt the session.
      logger.error("Arbor Live Turn Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Live turn screening failed" });
    }
  });

  // LOG-1 (v6): ambient logging — the AI drafts a structured behavior log from a
  // free-text or voice description so the parent confirms instead of filling a
  // form. Non-diagnostic; safety-screened; the client falls back gracefully if
  // extraction is unavailable.
  router.post("/extract-log", async (req, res) => {
    const { message, childProfile, language } = req.body;
    // EVAL-3 (capture-extract-v1 empty-input scenario): empty-ISH input —
    // missing, non-string, or whitespace-only — answers 400 before any model
    // call; a blank description must never burn a model round-trip.
    if (!message || typeof message !== "string" || !message.trim()) {
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

    // AIR-9: 15s analysis budget — "logging a moment" must fail calm and fast,
    // never spin on a wedged upstream.
    const budget = createRouteBudget(res, "analysis");
    try {
      // AI-CAP-2: mirror /chat's languageDirective — a Hebrew-speaking parent's
      // draft must come back in Hebrew. behaviorType/context stay per schema
      // (English/enum) so the AI-CAP-8 taxonomy mapping and clamps keep working.
      const languageDirective =
        language === "he"
          ? '\nIMPORTANT: The parent speaks Hebrew. Write "trigger", "response" and "notes" in natural, warm Hebrew (עברית). Keep "behaviorType" as a short English label and "context" exactly one of the schema values.'
          : "";
      // EVAL-6: version-pinned named builder (ai/prompts.ts) — the canonical
      // six stay joined HERE so the taxonomy grep guard keeps pinning this
      // route to CANONICAL_BEHAVIOR_TYPES.join(...) from the shared module.
      const prompt = buildExtractLogPrompt({
        childProfile,
        message,
        behaviorTypes: CANONICAL_BEHAVIOR_TYPES.join(" | "),
        languageDirective
      });

      const privacy = createRedaction(childProfile?.name);
      const draft = await raceWithAbort(modelProvider.generateJson({
        route: "analysis_structured",
        prompt: privacy.redact(prompt) + REDACTION_DIRECTIVE,
        temperature: 0.2,
        budget: budget.budget,
        promptVersion: PROMPT_VERSIONS.extract_log.version,
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
      }), budget.signal);
      budget.settle();
      res.json(privacy.restoreDeep(draft));
    } catch (error: any) {
      budget.settle();
      if (budget.clientGone()) return;
      if (budget.timedOut || isAbortError(error)) {
        logger.warn("Arbor Log Extraction deadline exceeded", { requestId: requestIdOf(req) });
        res.status(504).json(DEADLINE_ERROR);
        return;
      }
      logger.error("Arbor Log Extraction Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to draft a log", details: error.message });
    }
  });

  // Harbor voice-first interaction boundary. The realtime model can produce
  // ephemeral proposals, but this route owns no store and exposes no mutation.
  router.post("/conversation/proposals", async (req, res) => {
    const { transcript, childProfile, milestones, language } = req.body ?? {};
    if (typeof transcript !== "string" || !transcript.trim()) {
      res.status(400).json({ error: "A finalized transcript is required" });
      return;
    }
    const escalationMatch = screenForImmediateEscalation({ message: transcript });
    if (escalationMatch) {
      res.status(409).json({ error: "Professional support recommended", escalationCategory: escalationMatch.category });
      return;
    }
    const safeMilestones = Array.isArray(milestones) ? milestones.slice(0, 160).map((item) => ({
      id: String(item?.id ?? "").slice(0, 160),
      title: String(item?.title ?? "").slice(0, 300),
      status: item?.observationStatus ?? (item?.checked ? "yes" : "not_yet"),
    })).filter((item) => item.id && item.title) : [];
    const privacy = createRedaction(childProfile?.name);
    const languageDirective = language === "he"
      ? "Write summaries and source excerpts in natural Hebrew. Preserve English words the parent used."
      : "Write summaries and source excerpts in English. Preserve Hebrew words the parent used.";
    const prompt = `${NON_DIAGNOSTIC_CONTRACT}
You are Harbor's proposal extractor. The parent remains in control.
Extract only concrete, parent-stated information that could usefully update the product.
Never diagnose, infer hidden traits, or invent a date, milestone, frequency, response, or report fact.
Return zero to eight proposals only. You cannot and must not claim anything was saved.
Targets: observation (a concrete event or recurring pattern); milestone (only a directly supported supplied milestone, using its exact id); journal (a meaningful family moment); report_fact (a concrete fact useful in a future parent-reviewed report).
Each proposal needs a concise summary, an exact short excerpt from the transcript, confidence 0..1, and occurredAt only when explicit. Milestones also need milestoneId and milestoneStatus (yes, not_sure, not_yet). Avoid duplicate facts across targets.
${languageDirective}
Child profile: ${JSON.stringify(redactProfile(privacy, childProfile ?? {}))}
Available milestones: ${JSON.stringify(safeMilestones)}
Finalized parent transcript: ${privacy.redact(transcript.trim())}${REDACTION_DIRECTIVE}`;
    const budget = createRouteBudget(res, "analysis");
    try {
      const raw = await raceWithAbort(modelProvider.generateJson({
        route: "analysis_structured", prompt, temperature: 0.1, budget: budget.budget,
        promptVersion: "harbor-conversation-proposals-v1",
        schema: { type: Type.OBJECT, required: ["proposals"], properties: { proposals: { type: Type.ARRAY, items: {
          type: Type.OBJECT, required: ["target", "summary", "sourceExcerpt", "confidence"], properties: {
            target: { type: Type.STRING, enum: ["observation", "milestone", "journal", "report_fact"] },
            summary: { type: Type.STRING }, sourceExcerpt: { type: Type.STRING }, confidence: { type: Type.NUMBER },
            occurredAt: { type: Type.STRING }, milestoneId: { type: Type.STRING },
            milestoneStatus: { type: Type.STRING, enum: ["yes", "not_sure", "not_yet"] },
          },
        } } } },
      }), budget.signal);
      budget.settle();
      const restored = privacy.restoreDeep(raw) as { proposals?: Array<Record<string, unknown>> };
      const proposals = Array.isArray(restored.proposals) ? restored.proposals.slice(0, 8) : [];
      const screenable = proposals.map((item) => `${item?.summary ?? ""}\n${item?.sourceExcerpt ?? ""}`).join("\n");
      if (screenable) {
        const verdict = await screenModelOutput(modelProvider, screenable);
        if (verdict.flagged) { res.status(422).json({ error: "Proposal output was blocked by Arbor safety policy" }); return; }
      }
      res.json({ proposals });
    } catch (error) {
      budget.settle();
      if (budget.clientGone()) return;
      if (budget.timedOut || isAbortError(error)) { res.status(504).json(DEADLINE_ERROR); return; }
      logger.error("Harbor proposal extraction error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Could not prepare proposed updates" });
    }
  });

  // ── AIR-5: Today's Focus — a dedicated LIGHTWEIGHT generation path. The
  // Overview card used to POST /api/chat (the heaviest route in the app:
  // Claude, memory fetch, wiki retrieval, full coach schema) and throw away
  // everything but three sentences — while silently burning the free plan's
  // daily coach meter on an ambient card the parent never asked for. This
  // endpoint runs analysis_structured (flash, thinking off per AIR-3) with a
  // 2-field schema, sits INSIDE the hourly AI quota but OUTSIDE the coach
  // meter (createApp.ts), and caches per user+child per calendar day.
  //
  // Firewall CONDITIONS (AIR-5): (1) output passes screenModelOutput before
  // return — this must never become the first unscreened parent-facing
  // generative surface; (2) prompt embeds NON_DIAGNOSTIC_CONTRACT; (3) focus
  // text is observation/next-step only (the 2-field schema enforces shape,
  // the prompt bans assessments/scores/percentages/trends); (4) the cache
  // stores only payloads that already passed the screen (it is written
  // strictly AFTER the verdict).
  const focusDateKey = () => new Date().toISOString().slice(0, 10);
  const focusCache = new Map<string, Record<string, unknown>>();
  const FOCUS_CACHE_MAX = 1000;

  router.post("/todays-focus", async (req, res) => {
    const { childProfile, signals, language } = req.body ?? {};
    const count = Math.max(0, Math.min(500, Number(signals?.count ?? 0) || 0));
    const topTrigger = String(signals?.topTrigger ?? "").slice(0, 80);
    const lastActionRecommendation = String(signals?.lastActionRecommendation ?? "").slice(0, 300);
    const lastActionOutcome = ["helped", "somewhat", "not_today"].includes(signals?.lastActionOutcome)
      ? (signals.lastActionOutcome as string)
      : "";
    const lang = language === "he" ? "he" : "en";
    const dateKey = focusDateKey();

    const cacheKey = `${actorOf(req).uid}:${childProfile?.id ?? "none"}:${dateKey}:${lang}`;
    const cached = focusCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    // AIR-9: focus is ambient — it gets the tight analysis budget.
    const budget = createRouteBudget(res, "analysis");
    try {
      const languageDirective =
        lang === "he"
          ? "\nIMPORTANT: The parent speaks Hebrew. Write both fields in natural, warm Hebrew (עברית)."
          : "";
      const prompt = `${NON_DIAGNOSTIC_CONTRACT}
You are Arbor's Today's Focus writer for a calm parenting app.
Child: ${childProfile ? JSON.stringify(promptProfile(childProfile)) : "unknown"}
What the parent has logged this week: ${count} moment${count === 1 ? "" : "s"}, most often around "${topTrigger || "transitions"}".${lastActionRecommendation && lastActionOutcome ? ` The parent last tried "${lastActionRecommendation}" and reported the attempt as "${lastActionOutcome}". Use that parent-reported outcome to avoid repeating an unhelpful step and adapt effort or framing.` : ""}
Write today's single most useful parenting focus:
- "focus": 1-2 short, warm sentences naming what to pay attention to today — an observation about the child's week, never an assessment.
- "tryToday": ONE small, concrete thing to try today — a developmental mechanism (serve-and-return, co-regulation, a transition cue), phrased as a doable step.
Never include a score, percentage, trend, severity, readiness claim, diagnosis, or outcome claim. No headings, no markdown, no emojis.${languageDirective}
Return only JSON matching the schema.`;

      const privacy = createRedaction(childProfile?.name);
      const draft = (await raceWithAbort(modelProvider.generateJson({
        route: "analysis_structured",
        prompt: privacy.redact(prompt) + REDACTION_DIRECTIVE,
        temperature: 0.5,
        budget: budget.budget,
        schema: {
          type: Type.OBJECT,
          required: ["focus", "tryToday"],
          properties: {
            focus: { type: Type.STRING },
            tryToday: { type: Type.STRING }
          }
        }
      }), budget.signal)) as { focus?: unknown; tryToday?: unknown };

      const restored = privacy.restoreDeep(draft) as { focus?: unknown; tryToday?: unknown };
      const focus = String(restored.focus ?? "").replace(/[#*]/g, "").replace(/\s+/g, " ").trim().slice(0, 400);
      const tryToday = String(restored.tryToday ?? "").replace(/[#*]/g, "").replace(/\s+/g, " ").trim().slice(0, 300);
      const text = [focus, tryToday].filter(Boolean).join(" ");
      if (!text) {
        budget.settle();
        res.status(502).json({ error: "Focus generation returned no usable text" });
        return;
      }

      // Firewall condition 1: the FULL output screen gates the return. Flagged
      // output never reaches the parent (and never reaches the cache).
      const outputVerdict = await screenModelOutput(modelProvider, text);
      budget.settle();
      if (outputVerdict.flagged) {
        logger.warn("Todays Focus output blocked by output safety screen", {
          requestId: requestIdOf(req),
          category: outputVerdict.category,
          reason: outputVerdict.reason,
        });
        res.status(422).json({ error: "Arbor couldn't draft a focus for today. Please try again later." });
        return;
      }

      // AI-19: provenance of the inputs the focus was built from — an integer
      // count, the parent-tagged category label, and the parent-reported
      // outcome enum. Never intensity, never a percentage, never note text.
      const inputsUsed: { momentCount: number; topTrigger?: string; lastActionOutcome?: string } = { momentCount: count };
      if (topTrigger) inputsUsed.topTrigger = topTrigger;
      if (lastActionOutcome) inputsUsed.lastActionOutcome = lastActionOutcome;
      const payload = { text, focus, tryToday, inputsUsed, generatedAt: new Date().toISOString(), dateKey };
      // Firewall condition 4: only screened payloads are cached.
      if (focusCache.size >= FOCUS_CACHE_MAX) {
        const oldest = focusCache.keys().next().value;
        if (oldest !== undefined) focusCache.delete(oldest);
      }
      focusCache.set(cacheKey, payload);
      res.json(payload);
    } catch (error: any) {
      budget.settle();
      if (budget.clientGone()) return;
      if (budget.timedOut || isAbortError(error)) {
        logger.warn("Todays Focus deadline exceeded", { requestId: requestIdOf(req) });
        res.status(504).json(DEADLINE_ERROR);
        return;
      }
      logger.error("Arbor Todays Focus Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to draft today's focus", details: error.message });
    }
  });

  // AI-01 (2026-09-03): POST /explain — the lightweight "why does this
  // matter / what can I try" generator for NON-coach surfaces (Milestones ›
  // Explain + Analyze gaps, Behaviors › inline co-regulation script). Those
  // surfaces used to POST /api/chat with a synthetic UI prompt and render the
  // coach's INTERNAL markdown (Frame Routing, Pending Memory Review, Knowledge
  // Cards Used, Handoff Note) as a prose wall — while appendMemoryProposals
  // wrote pending memory facts the parent never discussed.
  //
  // Built on the /todays-focus template: analysis_structured (analysis
  // budget, NOT the coach meter), a 2-field schema {explanation, tryToday},
  // NON_DIAGNOSTIC_CONTRACT embedded, screenModelOutput BEFORE return, a
  // per-day cache keyed uid/child/lang/subject(+details digest) that stores
  // only screened payloads, and — the load-bearing contract — NO memory
  // proposals and NO coach-contract rendering (pinned by
  // routes/explainRoute.test.ts).
  const explainCache = new Map<string, Record<string, unknown>>();
  const EXPLAIN_CACHE_MAX = 2000;
  const EXPLAIN_SUBJECT_MAX = 160;
  const EXPLAIN_DETAILS_MAX = 2400;

  router.post("/explain", async (req, res) => {
    const { childProfile, subject, details, language } = req.body ?? {};
    const subjectText = typeof subject === "string" ? subject.replace(/\s+/g, " ").trim().slice(0, EXPLAIN_SUBJECT_MAX) : "";
    if (!subjectText) {
      res.status(400).json({ error: "A subject to explain is required" });
      return;
    }
    const detailsText = typeof details === "string" ? details.trim().slice(0, EXPLAIN_DETAILS_MAX) : "";
    const lang = language === "he" ? "he" : "en";

    // Same input gate as /generate-plan: a subject/detail that reads as an
    // immediate-escalation concern gets professional routing, never a model
    // explanation.
    const escalationMatch = screenForImmediateEscalation({ subject: subjectText, details: detailsText });
    if (escalationMatch) {
      res.status(409).json({
        error: "Professional support recommended",
        details: `This concern may require professional or urgent assessment. Category: ${escalationMatch.category}.`,
        escalationCategory: escalationMatch.category,
      });
      return;
    }

    const detailsDigest = detailsText ? createHash("sha256").update(detailsText, "utf8").digest("hex").slice(0, 16) : "none";
    const cacheKey = `${actorOf(req).uid}:${childProfile?.id ?? "none"}:${focusDateKey()}:${lang}:${subjectText.toLowerCase()}:${detailsDigest}`;
    const cached = explainCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    // AIR-9: an explainer is ambient-weight — the tight analysis budget.
    const budget = createRouteBudget(res, "analysis");
    try {
      const languageDirective =
        lang === "he"
          ? "\nIMPORTANT: The parent speaks Hebrew. Write both fields in natural, warm Hebrew (עברית)."
          : "";
      const prompt = `${NON_DIAGNOSTIC_CONTRACT}
${developmentalFramework}
You are Arbor's explainer for a calm parenting app. A parent tapped "explain" on something in their child's record.
Child: ${childProfile ? JSON.stringify(promptProfile(childProfile)) : "unknown"}
Subject: ${subjectText}${detailsText ? `\nWhat the parent's record shows (counts and labels the parent entered):\n${detailsText}` : ""}
Write:
- "explanation": 2-4 warm, plain sentences on why this matters for a child at this age and what it typically looks like — an observation, never an assessment of THIS child, never a readiness or delay claim.
- "tryToday": ONE small, concrete thing the parent can try today, phrased as a doable step with the words they could say.
Never include a score, percentage, trend, severity, diagnosis, or outcome claim. No headings, no markdown, no emojis, no bullet lists.${languageDirective}
Return only JSON matching the schema.`;

      const privacy = createRedaction(childProfile?.name);
      const draft = (await raceWithAbort(modelProvider.generateJson({
        route: "analysis_structured",
        prompt: privacy.redact(prompt) + REDACTION_DIRECTIVE,
        temperature: 0.5,
        budget: budget.budget,
        schema: {
          type: Type.OBJECT,
          required: ["explanation", "tryToday"],
          properties: {
            explanation: { type: Type.STRING },
            tryToday: { type: Type.STRING }
          }
        }
      }), budget.signal)) as { explanation?: unknown; tryToday?: unknown };

      const restored = privacy.restoreDeep(draft) as { explanation?: unknown; tryToday?: unknown };
      const clean = (v: unknown, cap: number) => String(v ?? "").replace(/[#*]/g, "").replace(/\s+/g, " ").trim().slice(0, cap);
      const explanation = clean(restored.explanation, 700);
      const tryToday = clean(restored.tryToday, 400);
      const text = [explanation, tryToday].filter(Boolean).join(" ");
      if (!text) {
        budget.settle();
        res.status(502).json({ error: "Explanation returned no usable text" });
        return;
      }

      // Firewall condition 1: the FULL output screen gates the return.
      const outputVerdict = await screenModelOutput(modelProvider, text);
      budget.settle();
      if (outputVerdict.flagged) {
        logger.warn("Explain output blocked by output safety screen", {
          requestId: requestIdOf(req),
          category: outputVerdict.category,
          reason: outputVerdict.reason,
        });
        res.status(422).json({ error: "Arbor couldn't explain that right now. Please try again later." });
        return;
      }

      const payload = { explanation, tryToday, text, generatedAt: new Date().toISOString(), dateKey: focusDateKey() };
      if (explainCache.size >= EXPLAIN_CACHE_MAX) {
        const oldest = explainCache.keys().next().value;
        if (oldest !== undefined) explainCache.delete(oldest);
      }
      explainCache.set(cacheKey, payload);
      res.json(payload);
    } catch (error: any) {
      budget.settle();
      if (budget.clientGone()) return;
      if (budget.timedOut || isAbortError(error)) {
        logger.warn("Explain deadline exceeded", { requestId: requestIdOf(req) });
        res.status(504).json(DEADLINE_ERROR);
        return;
      }
      logger.error("Arbor Explain Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to explain that", details: error.message });
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

  // COPPA gate (A2): /vision sends a photo of the child / their environment to a
  // multimodal model. It is biometric-adjacent child-image processing, so it
  // requires the same `face_processing` parental consent as avatar generation,
  // captured at onboarding (A3). The gate applies whenever an image is present
  // and fails CLOSED (451) without an active grant — and, because requireConsent
  // reads `childId` from the body, the client MUST send childId or every call 451s.
  router.post("/vision", requireConsent(consentStore, "face_processing", (req) => !!req.body?.image), async (req, res) => {
    const { image, mode = "observe", note, childProfile, language } = req.body;
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
    // AIX-S1: mirror /digest's languageDirective — a Hebrew parent must get
    // Hebrew observations/tryToday/summary back on the flagship vision surface.
    const languageDirective = language === "he" ? "\nWrite every human-readable value in warm, natural Hebrew (עברית)." : "";

    const prompt = isDoc
      ? `${NON_DIAGNOSTIC_CONTRACT}
${guard}
You can SEE the attached document photo. Read it (OCR) and extract what matters for this child's care.
Child: ${childProfile ? JSON.stringify(promptProfile(childProfile)) : "unknown"}
Parent note: "${typeof note === "string" ? note : ""}"
Return JSON: offTopic, documentType, summary, keyPoints[], suggestedMemory[] (durable facts the parent could approve), questionsForProfessional[], handoffNote.${languageDirective}`
      : `${NON_DIAGNOSTIC_CONTRACT}
${developmentalFramework}
${guard}
You can SEE the attached photo. Describe only what is observable and relevant, then give gentle, non-diagnostic next steps.
Child: ${childProfile ? JSON.stringify(promptProfile(childProfile)) : "unknown"}
Parent note: "${typeof note === "string" ? note : ""}"
Return JSON: offTopic, observations[], possibleMeanings[], tryToday[] (1-3), avoid[], nonDiagnosticNote.${languageDirective}`;

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

  // Neural TTS (Epic A) — OUTPUT-only natural read-aloud, default-OFF. The text was
  // already screened upstream (screenModelOutput) before it was returned to the
  // client, so this is NOT a safety boundary and takes NO child voice in → no new
  // consent purpose. When off (or hard-killed) it 503s and the client uses the
  // browser SpeechSynthesis floor.
  router.get("/tts", (_req, res) => {
    res.json({ configured: ttsConfigured(config) });
  });

  router.post("/tts", async (req, res) => {
    if (!ttsConfigured(config)) {
      res.status(503).json({ configured: false, error: "Neural TTS is not configured" });
      return;
    }
    const { text, language, screenedToken } = req.body ?? {};
    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "text is required" });
      return;
    }
    const clipped = text.slice(0, 4000);
    const lang: "en" | "he" = language === "he" ? "he" : "en";
    try {
      // AI-V5 firewall condition 3: the synchronous lexical floor runs
      // UNCONDITIONALLY on every /api/tts call — even with a valid screened
      // token (belt for HMAC bugs).
      const lexical = screenModelOutputLexical(clipped);
      if (lexical.flagged) throw new UnsafeTtsOutputError(lexical);
      // A valid short-TTL HMAC token (minted by /voice ONLY for sentences that
      // passed its own cumulative screen, over these exact bytes + lang) skips
      // ONLY the model re-screen. Absent / invalid / expired / text-altered →
      // the FULL screen runs (fail closed) — 'already-screened' provenance is
      // proven cryptographically, never client-asserted.
      // AIR-8: with the boot registry present (production wiring), synthesis
      // resolves through registry.get("speech_synthesis", ...).execute — the
      // registry is the dispatch seam, and its adapter re-runs the lexical
      // floor, so no branch reaches unscreened synthesis.
      const ttsInput = { text: clipped, lang } as const;
      const result = verifyTtsToken(screenedToken, clipped, lang)
        ? await (aiCapabilityRegistry
            ? dispatchSpeechSynthesis(aiCapabilityRegistry, config, ttsInput)
            : synthesizeSpeech(config, ttsInput))
        : await screenAndSynthesizeSpeech(config, modelProvider, ttsInput, aiCapabilityRegistry);
      res.json(result);
    } catch (error: any) {
      if (error instanceof UnsafeTtsOutputError) {
        logger.warn("Arbor TTS safety block", { requestId: requestIdOf(req), category: error.verdict.category });
        res.status(422).json({ error: "This text cannot be spoken by Arbor." });
        return;
      }
      if (error instanceof TtsNotConfigured) {
        res.status(503).json({ configured: false });
        return;
      }
      // AIR-8: a registry missing the speech_synthesis adapter fails CLOSED —
      // visible degrade to the browser SpeechSynthesis floor, never a silent
      // fallback to a direct provider call.
      if (error instanceof AiProviderError && error.code === "not_configured") {
        logger.warn("Arbor TTS registry not_configured (fail closed)", { requestId: requestIdOf(req) });
        res.status(503).json({ configured: false });
        return;
      }
      logger.error("Arbor TTS error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to synthesize speech", details: error?.message });
    }
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

    // AIR-9: 60s image budget.
    const budget = createRouteBudget(res, "image");
    try {
      const image = await raceWithAbort(modelProvider.generateImage({
        prompt,
        images: referenceImage ? [referenceImage] : undefined,
        budget: budget.budget
      }), budget.signal);
      budget.settle();
      // The reference photo (referenceImage) is intentionally discarded here — it is
      // never written to storage, logs, or the response.
      res.json({
        dataUrl: `data:${image.mimeType};base64,${image.data}`,
        style: style ?? "storybook",
        source: referenceImage ? "photo" : "descriptor"
      });
    } catch (error: any) {
      budget.settle();
      if (budget.clientGone()) return;
      if (budget.timedOut || isAbortError(error)) {
        logger.warn("Arbor Avatar deadline exceeded", { requestId: requestIdOf(req) });
        res.status(504).json(DEADLINE_ERROR);
        return;
      }
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

    // AIR-9: 60s image budget.
    const budget = createRouteBudget(res, "image");
    try {
      const image = await raceWithAbort(modelProvider.generateImage({
        prompt,
        images: referenceImage ? [referenceImage] : undefined,
        budget: budget.budget
      }), budget.signal);
      budget.settle();
      res.json({ dataUrl: `data:${image.mimeType};base64,${image.data}` });
    } catch (error: any) {
      budget.settle();
      if (budget.clientGone()) return;
      if (budget.timedOut || isAbortError(error)) {
        logger.warn("Arbor Scene deadline exceeded", { requestId: requestIdOf(req) });
        res.status(504).json(DEADLINE_ERROR);
        return;
      }
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

    // AIR-9: 60s image budget.
    const budget = createRouteBudget(res, "image");
    try {
      const image = await raceWithAbort(modelProvider.generateImage({
        prompt,
        images: referenceImage ? [referenceImage] : undefined,
        budget: budget.budget
      }), budget.signal);
      budget.settle();
      res.json({ dataUrl: `data:${image.mimeType};base64,${image.data}` });
    } catch (error: any) {
      budget.settle();
      if (budget.clientGone()) return;
      if (budget.timedOut || isAbortError(error)) {
        logger.warn("Arbor Comic deadline exceeded", { requestId: requestIdOf(req) });
        res.status(504).json(DEADLINE_ERROR);
        return;
      }
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
Profile: ${JSON.stringify(promptProfile(childProfile))}
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
- 2 to 4 short sentences per beat. Gentle and non-graphic: no real violence, blood, death, or frightening detail. BUT the stakes must feel REAL: in the 'fear' beat let the challenge genuinely loom (the giant truly is big, the dark truly is unknown), and let the brave path cost something real. The conflict stays emotional/symbolic and resolves with hope, not by pretending the fear was never there.
- For the 'decision' beat narration, end by inviting the child to choose — do NOT say which option is best.
- Personalize each of the ${choiceCount} choices: rewrite "label" as a short first-person action, and write a 1-2 sentence "consequence" expanding its cue. Keep every consequence kind — no choice is harshly punished.
- This story is rendered as a COMIC BOOK starring ${heroName}. For each beat also return:
  • "imagePrompt": a one-line description of a dynamic, exciting comic-book ACTION panel for this beat (vivid pose, setting, emotion) — describe only the scene, no text/words drawn in it.
  • "sfx": an array of 2-3 SHORT, punchy comic sound-effect words IN THE SAME LANGUAGE AS THE STORY that fit this exact beat (${language === "he" ? 'Hebrew, e.g. ["ואוש!","בום!"]; for a calm beat ["אהה…","נצנוץ!"]' : 'English, e.g. ["WHOOSH!","BOOM!"]; for a calm beat ["AHH…","TWINKLE!"]'}). Vary them per beat — never reuse the same set.
  • "dialogue": ONE very short, exciting first-person hero line ${heroName} would shout or say in this beat (max ~8 words), IN THE SAME LANGUAGE AS THE STORY, for a comic speech bubble. Keep it kid-friendly and energetic.
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

      // AI-2: output-side safety screen. Every other generative route screens its
      // model output; the hero journey emits model-authored narration/dialogue/sfx/
      // titles/choices/reflection, so screen ALL of those (on the alias-restored,
      // child-facing text) before returning. Fails closed → blocked fallback. This
      // is also the precondition for ever voicing this span (neural TTS).
      const heroScreenable = assembleHeroJourneyScreenable(render);
      const outputVerdict = await screenModelOutput(modelProvider, heroScreenable);
      if (outputVerdict.flagged) {
        logger.warn("Hero journey output blocked by output safety screen", {
          requestId: requestIdOf(req),
          category: outputVerdict.category,
          reason: outputVerdict.reason,
        });
        res.json({ text: renderBlockedOutputMarkdown(), outputBlocked: true, blockedCategory: outputVerdict.category });
        return;
      }

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

  // AP-057: Bedtime Stories — day-rooted, avatar-starring nightly story.
  // Distinct from /generate-story (topic/moral) and /generate-hero-journey (fixed spine).
  // BINDING SAFETY CONDITIONS (all enforced here):
  //   1. ESCALATION SCREEN on raw day-event text BEFORE generation (→ 409 if triggered).
  //   2. REDACTION at the generation seam: createRedaction(childName) wraps the model call.
  //   3. GENERATE-AND-DISCARD default: stories are NOT persisted, so no new child-data store.
  //      GDPR reachability: no store to wire — the clearing approach is the clearance.
  //   4. ai_training default-OFF: nothing written to any training pipeline.
  //   5. NON-PATHOLOGIZING prompt: warmth, strengths-based, no deficit/diagnostic framing.
  //   6. No new ConsentPurpose; avatar is the existing generated avatar (no new face capture).
  router.post("/generate-bedtime-story", async (req, res) => {
    const { childName, age, dayEvents, avatarDescription, language } = req.body;

    // Validate day events array
    if (!Array.isArray(dayEvents) || dayEvents.length === 0) {
      res.status(400).json({ error: "dayEvents must be a non-empty array of day event objects" });
      return;
    }

    // ── SAFETY CONDITION 1: ESCALATION SCREEN on the actual day-derived input ──
    // Screen every event description. A logged injury / abuse disclosure /
    // regression event MUST never seed a cheerful bedtime story — return 409 before
    // any generation, matching the same non-diagnostic contract as /generate-story.
    const { buildEscalationInput } = await import("../lib/bedtimeStories.js");
    const escalationInput = buildEscalationInput(
      dayEvents.map((e: Record<string, unknown>) => ({
        description: typeof e.description === "string" ? e.description : String(e.description ?? ""),
        tone: typeof e.tone === "string" ? e.tone : undefined,
      }))
    );
    const escalationMatch = screenForImmediateEscalation(escalationInput);
    if (escalationMatch) {
      res.status(409).json({
        error: "Professional support recommended",
        details: `Today's logged events may require professional or urgent assessment before Arbor generates a bedtime story. Category: ${escalationMatch.category}.`,
        escalationCategory: escalationMatch.category
      });
      return;
    }

    try {
      // ── SAFETY CONDITION 2: REDACTION AT THE GENERATION SEAM ──
      // createRedaction(childName) must wrap the model call: redact → model → restoreDeep.
      const privacy = createRedaction(childName);

      const { buildBedtimeStoryPrompt } = await import("../lib/bedtimeStories.js");
      const rawPrompt = buildBedtimeStoryPrompt({
        childName: childName ?? "your child",
        age: age ?? 4,
        dayEvents: dayEvents.map((e: Record<string, unknown>) => ({
          description: typeof e.description === "string" ? e.description : String(e.description ?? ""),
          tone: typeof e.tone === "string" ? e.tone : undefined,
        })),
        avatarDescription: typeof avatarDescription === "string" ? avatarDescription : undefined,
        language: language === "he" ? "he" : "en",
      });

      // Prepend NON_DIAGNOSTIC_CONTRACT (same as /generate-story and /generate-hero-journey).
      const fullPrompt = `${NON_DIAGNOSTIC_CONTRACT}\n\n${rawPrompt}`;

      // Redact child PII, call model, restore PII in output.
      const result = privacy.restoreDeep(await modelProvider.generateJson({
        route: "creative_low_risk",
        prompt: privacy.redact(fullPrompt) + REDACTION_DIRECTIVE,
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

      // ── SAFETY CONDITION 3: GENERATE-AND-DISCARD ──
      // The result is returned directly to the client and NOT persisted anywhere.
      // No bedtimeStory store exists. GDPR export/erase have nothing to reach
      // because generate-and-discard produces no new persistent child-data.
      // ai_training is default-OFF: nothing written to a training pipeline here.
      res.json(result);
    } catch (error: any) {
      logger.error("Arbor Bedtime Story Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to generate Arbor bedtime story", details: error.message });
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
Child Details: ${JSON.stringify(promptProfile(childProfile))}
Behavior Logs: ${JSON.stringify(logs)}
Return JSON with frequencyCount, intensityTrend, triggerBreakdown, expertInsights, actionPlanSuggestion.
`;
      const privacy = createRedaction(childProfile?.name);
      const analysis = privacy.restoreDeep(await modelProvider.generateJson({
        route: "analysis_structured",
        prompt: privacy.redact(prompt) + REDACTION_DIRECTIVE,
        schema: {
          type: Type.OBJECT,
          required: ["frequencyCount", "intensityTrend", "triggerBreakdown", "expertInsights", "actionPlanSuggestion"],
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
      })) as Record<string, any>;

      // W0.4: the app never scores the parent. effectivenessRating was removed
      // from the prompt/schema above; strip it defensively in case the model
      // emits it anyway so no parent-grading text can reach the client.
      delete analysis.effectivenessRating;

      // AI-2 / CI-13: output-side safety screen for the model-authored free-text
      // fields. expertInsights[].heading/.text and actionPlanSuggestion are the
      // diagnostic-label-leak surfaces here; the numeric/structured fields are
      // kept regardless. Mirror the /chat and /voice blocked behavior — log a
      // warn with requestId+category and DO NOT leak the flagged text; swap the
      // free-text fields for a safe, non-diagnostic fallback.
      const insights = Array.isArray(analysis.expertInsights) ? analysis.expertInsights : [];
      const screenable = [
        ...insights.flatMap((i: any) => [i?.heading, i?.text]),
        analysis.actionPlanSuggestion,
      ].filter((s: unknown): s is string => typeof s === "string" && s.length > 0).join("\n");
      const outputVerdict = await screenModelOutput(modelProvider, screenable);
      if (outputVerdict.flagged) {
        logger.warn("Behavior analysis output blocked by output safety screen", {
          requestId: requestIdOf(req),
          category: outputVerdict.category,
          reason: outputVerdict.reason,
        });
        analysis.expertInsights = [{
          heading: "Let's pause on the interpretation",
          text: "Part of what Arbor drafted stepped outside what an AI parenting coach should say — it sounded diagnostic or medical. Arbor only offers observations, never a diagnosis. If you're worried about a possible condition, bring these notes to your pediatrician or family health centre; you can generate a professional handoff brief from Reports & Handoffs to make that conversation easier.",
        }];
        analysis.actionPlanSuggestion = "Share these logs with a qualified professional who can assess your child in person before acting on a specific plan.";
        analysis.outputBlocked = true;
        analysis.blockedCategory = outputVerdict.category;
      }

      res.json(analysis);
    } catch (error: any) {
      logger.error("Arbor Behavior Analysis Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to analyze Arbor behavior logs", details: error.message });
    }
  });

  router.post("/generate-handoff", async (req, res) => {
    const { childProfile, logs, milestones, audience = "teacher", language } = req.body;
    // LC-11: the client sends `language`, and until this line existed the
    // argument was INERT — a Hebrew-reading parent handed their child's teacher
    // an English brief. Same directive the coach and vision routes use.
    const handoffLanguageDirective =
      language === "he"
        ? "\nIMPORTANT: Write every human-readable text value in the JSON response in natural, warm Hebrew (עברית). Keep JSON keys in English."
        : "";
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
Child Details: ${JSON.stringify(promptProfile(childProfile))}
Key Logged Behaviors: ${JSON.stringify(logs)}
Milestone Context: ${JSON.stringify(milestones)}
Return JSON with title, date, overview, keyStrengths, classroomChallenges, languageSupportPlan, suggestedTeacherStrategies, crisisEscalationTrigger.${handoffLanguageDirective}
`;
      const privacy = createRedaction(childProfile?.name);
      const brief = privacy.restoreDeep(await modelProvider.generateJson({
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
      }));

      // AI-2 parity. This was the ONE parent-facing generative route that
      // returned model output unscreened — and it is the output a parent hands
      // to a teacher or clinician. Every other generative route in this file
      // screens before it reaches a person; so does this one now.
      const brf = (brief ?? {}) as Record<string, unknown>;
      const briefText = [
        brf.title, brf.overview, brf.crisisEscalationTrigger,
        ...([brf.keyStrengths, brf.classroomChallenges, brf.languageSupportPlan, brf.suggestedTeacherStrategies]
          .flatMap((list) => (Array.isArray(list) ? list : []))),
      ].filter((span): span is string => typeof span === "string" && span.trim().length > 0).join("\n");
      const briefVerdict = await screenModelOutput(modelProvider, briefText);
      if (briefVerdict.flagged) {
        // Same 409 + escalationCategory contract the input screen above uses,
        // which lib/api.ts already surfaces as a typed error to the UI.
        res.status(409).json({
          error: "Professional support recommended",
          details: "Arbor could not produce a routine brief for this history. Please review it with a qualified adult.",
          escalationCategory: briefVerdict.category ?? "output-screen",
        });
        return;
      }
      res.json(brief);
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

  // mk-p0-2 referral loop: the signed-in parent's stable invite code + link +
  // earned-months counter. Anonymous/sandbox callers get no code (UI shows the
  // "sign in to get your link" state instead).
  router.get("/referral/code", async (req, res) => {
    try {
      const actor = actorOf(req);
      if (!actor.uid || actor.uid === "local-sandbox") {
        res.json({ code: null, link: null, earnedMonths: 0, maxed: false });
        return;
      }
      const code = await referralStore.codeForUid(actor.uid);
      const earnedMonths = await referralStore.earnedMonths(actor.uid);
      const base = (config.appUrl || "").replace(/\/+$/, "");
      res.json({
        code,
        link: `${base}/?ref=${encodeURIComponent(code)}`,
        earnedMonths,
        maxed: earnedMonths >= config.referralMaxGrants,
      });
    } catch (error: any) {
      logger.error("Arbor Referral Code Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to load referral code", details: error.message });
    }
  });

  // mk-p0-2: redeem a referral on the referred parent's activation. Grants one
  // comp Plus month to both parties (guards enforced server-side); idempotent.
  router.post("/referral/activate", async (req, res) => {
    try {
      const actor = actorOf(req);
      if (!actor.uid || actor.uid === "local-sandbox") {
        res.status(401).json({ error: "Sign in required" });
        return;
      }
      const code = String(req.body?.code ?? "").trim();
      if (!code) {
        res.status(400).json({ error: "Missing referral code" });
        return;
      }
      const result = await referralStore.activateReferral({ code, redeemerUid: actor.uid });
      if (!result.ok) {
        // Soft-fail: an unknown/self code is not an error the parent should see.
        res.json(result);
        return;
      }
      res.json(result);
    } catch (error: any) {
      logger.error("Arbor Referral Activate Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to activate referral", details: error.message });
    }
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
Child: ${childProfile ? JSON.stringify(promptProfile(childProfile)) : "unknown"}
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
      }) as Record<string, unknown>) as Record<string, unknown>;
      // Output safety screen — same wall as /chat, /voice and behavior-analysis.
      // The recap is auto-generated on week-open and its title rides an external
      // share card (W2.1), so digest free text must never bypass the screen: on a
      // flagged verdict we serve the deterministic counts-only fallback verbatim.
      const digestScreenable = [
        narrative.title, narrative.subject, narrative.preheader, narrative.summary,
        ...(Array.isArray(narrative.highlights) ? narrative.highlights : []),
        ...(Array.isArray(narrative.watchFor) ? narrative.watchFor : []),
        narrative.tryThisWeek,
      ].filter((s: unknown): s is string => typeof s === "string" && s.length > 0).join("\n");
      const digestVerdict = await screenModelOutput(modelProvider, digestScreenable);
      if (digestVerdict.flagged) {
        logger.warn("Digest narrative blocked by output safety screen — serving deterministic fallback", {
          requestId: requestIdOf(req),
          category: digestVerdict.category,
          reason: digestVerdict.reason,
        });
        res.json({ ...fallback, stats, generated: "fallback", outputBlocked: true });
        return;
      }
      res.json({ ...narrative, stats, generated: "ai" });
    } catch (error: any) {
      logger.warn("Digest AI narrative unavailable — serving deterministic fallback", {
        requestId: requestIdOf(req),
        errorMessage: error?.message,
      });
      res.json({ ...fallback, stats, generated: "fallback" });
    }
  });

  // W2 2.2: weekly-email channel status — reflects server/emailProvider.ts.
  // FAIL-CLOSED: enabled only when EMAIL_PROVIDER names an IMPLEMENTED
  // provider; today none exists, so this truthfully reports the channel off
  // while the client keeps the (real) opt-in list.
  router.get("/digest/email-status", (_req, res) => {
    const provider = resolveEmailProvider();
    res.json({ enabled: provider.enabled, provider: provider.provider });
  });

  // W2 2.2: render the week's digest as the email it WOULD be — subject +
  // preheader + plain-text body (reuses the digest's own fields; counts only,
  // previousWeekMoments never rendered). NO send happens here, ever; the
  // response carries the provider status so callers can't mistake a preview
  // for a delivery capability.
  router.post("/digest/email-preview", (req, res) => {
    const { childProfile, logs, milestones, language } = req.body;
    const childName = (childProfile?.name && String(childProfile.name)) || "Your child";
    const stats = computeWeeklyDigestStats(Array.isArray(logs) ? logs : [], Array.isArray(milestones) ? milestones : []);
    // Deterministic narrative on purpose: the preview must be cheap, instant,
    // and truthful with AI off — same fields the in-app digest fallback uses.
    const narrative = fallbackDigestNarrative(childName, stats);
    const email = buildDigestEmail({
      childName,
      language: language === "he" ? "he" : "en",
      narrative,
      stats,
    });
    const provider = resolveEmailProvider();
    res.json({ enabled: provider.enabled, provider: provider.provider, ...email });
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
      // GDPR Art. 17 parity with /account/delete, which purges Storage. Erasing
      // ONE child left that child's uploaded photos in the bucket — Firestore
      // was swept, the images were not. Scoped to this child's own prefix
      // (lib/storage.ts writes users/{uid}/children/{childId}/photos/...), so a
      // sibling's data is never touched.
      let storageFiles = 0;
      let storageNote: string | undefined;
      const bucketName = config.storageBucket;
      if (!bucketName) {
        storageNote = "skipped: no storage bucket configured";
      } else {
        try {
          const { getStorage } = await import("firebase-admin/storage");
          await getStorage().bucket(bucketName).deleteFiles({ prefix: `users/${uid}/children/${childId}/` });
          storageFiles = 1;
          storageNote = `storage prefix users/{uid}/children/${childId}/ removed`;
        } catch (err: unknown) {
          // A bucket that was never provisioned is a clean no-op, not a failure.
          const message = err instanceof Error ? err.message : String(err);
          if (!/not exist|notFound|404/i.test(message)) throw err;
          storageNote = "bucket not provisioned";
        }
      }
      logger.info("GDPR erasure executed", { requestId: requestIdOf(req), childId, memoryEvents, shares, consents, storageFiles });
      res.json({ erased: { memoryEvents, shares, consents, storageFiles }, storageNote, childId, erasedAt: new Date().toISOString() });
    } catch (error: any) {
      logger.error("Arbor Privacy Erasure Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to erase server-side data", details: error.message });
    }
  });

  // STORE-4 (Apple 5.1.1(v) / Play account-deletion / GDPR Art. 17): FULL account
  // deletion — every server-held record keyed to the uid (entitlements, referral,
  // push tokens, quota windows, consult requests, waitlist, shares, per-child
  // data, families, the users/{uid} tree, Storage uploads, the RevenueCat
  // subscriber) and finally the Firebase Auth user. The receipt is honest:
  // per-class counts + failures; any failure ⇒ complete:false and the Auth user
  // survives so the parent can retry (never an orphaned, unreachable dataset).
  router.post("/account/delete", async (req, res) => {
    const { uid, email } = actorOf(req);
    if (req.body?.confirm !== "DELETE") {
      res.status(400).json({ error: "confirm: \"DELETE\" is required" });
      return;
    }
    // Sandbox/local mode holds no server data — the client wipes local stores.
    if (config.memoryAdapter !== "firestore" || uid === "local-sandbox") {
      res.json({ uid, complete: true, authDeleted: false, receiptAt: new Date().toISOString(), classes: [], mode: "local" });
      return;
    }
    try {
      const ops = createFirestoreDeletionOps(config, {
        memoryEraseChild: (childId) => memoryStore.eraseChild(childId),
        consentEraseByChild: (childId) => consentStore.eraseByChild(childId),
        shareEraseByChild: (ownerUid, childId) => shareStore.eraseByChild(ownerUid, childId),
        pushTokensRemove: (u) => pushTokenStore.remove(u),
      });
      const receipt = await runAccountDeletion(ops, uid, email);
      logger.info("Account deletion executed", {
        requestId: requestIdOf(req),
        complete: receipt.complete,
        authDeleted: receipt.authDeleted,
        failedClasses: receipt.classes.filter((c) => c.failed > 0).map((c) => c.class),
      });
      res.json(receipt);
    } catch (error: any) {
      logger.error("Arbor Account Deletion Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Account deletion failed", details: error.message });
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

  // B2: pre-auth email/waitlist capture — no account required.
  //
  // Accepts: { email, source?, market?, consent: true }
  // - email      required; RFC 5321 basic validation; max 320 chars.
  // - consent    must be the boolean true — explicit, never pre-filled.
  // - source     optional; landing page identifier (e.g. "landing-en").
  // - market     optional; ISO market code (e.g. "il", "nl").
  //
  // Privacy: stores ONLY email + consentAt + source + market. No name, no child
  // data, no UID (caller is not authenticated). The existing IP-level rate limiter
  // (30 req/min/IP on /api) provides the abuse backstop — no separate middleware.
  //
  // Idempotent: duplicate email → 200 { ok: true, duplicate: true }.
  router.post("/waitlist", async (req, res) => {
    const { email, source, market, consent } = req.body ?? {};

    if (consent !== true) {
      res.status(400).json({ error: "Explicit consent is required to join the waitlist" });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: "A valid email address is required" });
      return;
    }

    try {
      const isDuplicate = await waitlistStore.has(email);
      if (!isDuplicate) {
        const entry = await waitlistStore.add(buildWaitlistEntry({ email, source, market }));
        // WAITLIST-DECOUPLE: lead is now saved. Founder notification is best-effort —
        // a delivery failure is logged but never fails the parent's request.
        await notifyWaitlistSafely(waitlistNotifier, entry, (notifyError) =>
          logger.error("Arbor Waitlist Notify Error", notifyError, { requestId: requestIdOf(req) }));
      }
      res.json({ ok: true, duplicate: isDuplicate });
    } catch (error: any) {
      logger.error("Arbor Waitlist Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to record waitlist entry" });
    }
  });

  // C2 — Background push (FCM) opt-in / opt-out + smoke-test send.
  // OFF BY DEFAULT: routes only mounted when pushTokenStore is present; no VAPID
  // key in the Vite build = pushCapable() false client-side = these are never called.
  // AADC: no guilt/streak/child-data push. Parent channel only; explicit opt-in.
  if (pushTokenStore) {
    router.post("/push/register", async (req, res) => {
      const { uid } = actorOf(req);
      const { token } = req.body ?? {};
      if (typeof token !== "string" || token.length < 10) {
        res.status(400).json({ error: "A valid FCM registration token is required" });
        return;
      }
      try {
        await pushTokenStore.upsert(uid, token);
        res.json({ ok: true });
      } catch (err) {
        logger.error("Push register error", err as Error, { requestId: requestIdOf(req) });
        res.status(500).json({ error: "Failed to register push token" });
      }
    });

    router.delete("/push/register", async (req, res) => {
      const { uid } = actorOf(req);
      try {
        await pushTokenStore.remove(uid);
        res.json({ ok: true });
      } catch (err) {
        logger.error("Push unregister error", err as Error, { requestId: requestIdOf(req) });
        res.status(500).json({ error: "Failed to unregister push token" });
      }
    });

    // Self-only FCM path proof (before Cloud Scheduler is provisioned).
    router.post("/push/test-send", async (req, res) => {
      const { uid } = actorOf(req);
      try {
        const { sendNudgePush } = await import("../server/pushTokens.js");
        const result = await sendNudgePush(uid, pushTokenStore);
        if (result === "no-token") {
          res.status(404).json({ error: "No push token for this user — enable push notifications first" });
          return;
        }
        res.json({ ok: true, result });
      } catch (err) {
        logger.error("Push test-send error", err as Error, { requestId: requestIdOf(req) });
        res.status(500).json({ error: "Push test-send failed" });
      }
    });
  }

  return router;
};
