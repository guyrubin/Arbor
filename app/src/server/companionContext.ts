/**
 * B-AI-01 — CompanionContext v1: the ONE server-side context service.
 *
 * Before this module every AI route assembled its own picture of the family:
 * `/voice` + `/live/token` through spokenContext.ts, `/chat` through a
 * newest-first memory slice, `/todays-focus` from counts the CLIENT sent.
 * The companion plan (22 Sep, §4 "One context service") names this seam:
 *
 *   assembleCompanionContext({ purpose, childId, audience }) →
 *     { profile, approvedFacts[], acceptedActions[≤5], keptInsights[≤5], weeklyCounts? }
 *
 * What it reads (and nothing else):
 *   · approved memory facts — the parent-approved ledger, through the bounded
 *     selector in memory/memoryService.ts (keyword overlap + recency, 2,400
 *     chars; pending / rejected / expired never pass);
 *   · the `actionLoops` ledger — steps the parent accepted and the outcome
 *     they reported (B-AI-05 keeps history; superseded rows are left out);
 *   · kept insights — suggestion lines the parent tapped "Keep this" on
 *     (`insights` rows of kind `kept-insight`, B-AI-04).
 *
 * What it never reads: moment free text (`behaviorLogs.notes`) — Guy G-14
 * keeps it out of every prompt; weekly counts arrive only as the caller's
 * already-sanitized counts. Every read is scoped to the AUTHENTICATED uid's
 * own child path (users/{uid}/children/{childId}/…), so child A's ledger can
 * never be read into child B's context.
 */
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import type { WeeklyContext } from "../ai/chatContext.js";
import { promptProfile, type ModelProfile } from "../ai/prompts.js";
import type { ActionSource } from "../actionLoop/model.js";
import { enforceMemoryRetention, foldMemoryEvents, selectApprovedFacts } from "../memory/memoryService.js";
import type { MemoryStore } from "../memory/types.js";

export type CompanionPurpose =
  | "chat"
  | "todays-focus"
  | "voice"
  | "live"
  | "digest"
  | "generate-plan"
  | "analyze-behavior";

/** `child` is the Kid Mode register: it gets NO family context (fail closed). */
export type CompanionAudience = "parent" | "child";

export type CompanionFact = { text: string; sourceId: string; createdAt: string; source: string; retention: string };

export type CompanionAction = {
  recommendation: string;
  source: ActionSource;
  status: "accepted" | "completed";
  outcome?: "helped" | "somewhat" | "not_today";
  acceptedAt: string;
};

export type CompanionInsight = { text: string; createdAt: string };

export type CompanionContext = {
  profile: ModelProfile | null;
  approvedFacts: CompanionFact[];
  acceptedActions: CompanionAction[];
  keptInsights: CompanionInsight[];
  weeklyCounts?: WeeklyContext | null;
};

/** Raw ledger rows as the client writes them — validated field by field here. */
export type CompanionLedger = { actionLoops: unknown[]; insights: unknown[] };

/** Server-side read of the parent's own child ledgers. */
export interface CompanionLedgerSource {
  load(uid: string, childId: string): Promise<CompanionLedger>;
}

export const MAX_ACCEPTED_ACTIONS = 5;
export const MAX_KEPT_INSIGHTS = 5;
const ACTION_TEXT_CAP = 300;
const INSIGHT_TEXT_CAP = 300;
const DEFAULT_MAX_FACTS = 8;

/** Runtime mirror of the client ActionSource union. The mapped type fails to
 *  compile when actionLoop/model.ts adds a source that is not listed here. */
const ACTION_SOURCE_SET: { [K in ActionSource]: true } = {
  "today-guidance": true,
  digest: true,
  "learn-read": true,
  "family-ritual": true,
  coach: true,
  plan: true,
  vision: true,
  "hard-moment": true,
  "from-record": true,
  practice: true,
};
const OUTCOMES = new Set(["helped", "somewhat", "not_today"]);

const clean = (value: unknown, cap: number): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, cap) : "";

const validIso = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));

/** ≤5 most recent accepted / completed steps (superseded rows are not steps the parent tried). */
export const projectAcceptedActions = (rows: readonly unknown[]): CompanionAction[] => {
  const out: CompanionAction[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const recommendation = clean(r.recommendation, ACTION_TEXT_CAP);
    if (!recommendation || !validIso(r.acceptedAt)) continue;
    if (r.status !== "accepted" && r.status !== "completed") continue;
    // B-TODAY-28: a "From your record" answer is the parent's read of how
    // things are, not a step tried — it never reaches the companion context.
    if (r.source === "from-record") continue;
    const source = typeof r.source === "string" && r.source in ACTION_SOURCE_SET ? (r.source as ActionSource) : "today-guidance";
    const action: CompanionAction = { recommendation, source, status: r.status, acceptedAt: r.acceptedAt };
    if (r.status === "completed" && typeof r.outcome === "string" && OUTCOMES.has(r.outcome)) {
      action.outcome = r.outcome as CompanionAction["outcome"];
    }
    out.push(action);
  }
  return out.sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt)).slice(0, MAX_ACCEPTED_ACTIONS);
};

/** ≤5 newest kept-insight lines, verbatim (whitespace-collapsed, capped). */
export const projectKeptInsights = (rows: readonly unknown[]): CompanionInsight[] => {
  const out: CompanionInsight[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (r.kind !== "kept-insight" || !validIso(r.createdAt)) continue;
    const text = clean(r.text, INSIGHT_TEXT_CAP);
    if (text) out.push({ text, createdAt: r.createdAt });
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, MAX_KEPT_INSIGHTS);
};

export const emptyCompanionContext = (profile: ModelProfile | null = null): CompanionContext => ({
  profile,
  approvedFacts: [],
  acceptedActions: [],
  keptInsights: [],
});

/**
 * Assemble the context for one AI call. Every input read is optional
 * grounding: a failed memory or ledger read returns that part empty, never a
 * stale or unchecked value, and never fails the request.
 */
export const assembleCompanionContext = async (input: {
  purpose: CompanionPurpose;
  audience: CompanionAudience;
  childId: string | null;
  childProfile?: unknown;
  memoryStore: MemoryStore;
  /** Absent → no ledger reads (local adapter, or a transport that never reads them). */
  ledgerSource?: CompanionLedgerSource;
  /** The authenticated uid; the ledger read is scoped to this uid's child path. */
  uid?: string;
  /** The request text the facts are ranked against ("" → newest first). */
  query?: string;
  /** False when the caller has not authorized memory reads for this child. */
  canReadMemory?: boolean;
  maxFacts?: number;
  weeklyCounts?: WeeklyContext | null;
  now?: number;
}): Promise<CompanionContext> => {
  if (input.audience !== "parent") return emptyCompanionContext();
  const context = emptyCompanionContext(promptProfile(input.childProfile));
  if (input.weeklyCounts) context.weeklyCounts = input.weeklyCounts;
  const childId = input.childId;
  if (!childId) return context;
  const now = input.now ?? Date.now();

  if (input.canReadMemory !== false) {
    try {
      const live = await enforceMemoryRetention(input.memoryStore, foldMemoryEvents(await input.memoryStore.listEvents(childId), childId), now);
      const maxFacts = Math.max(1, input.maxFacts ?? DEFAULT_MAX_FACTS);
      context.approvedFacts = selectApprovedFacts(live, { query: input.query, maxFacts, now }).map((item) => ({
        text: item.fact,
        sourceId: item.memoryId,
        createdAt: item.createdAt,
        source: item.source,
        retention: item.retention,
      }));
    } catch {
      context.approvedFacts = [];
    }
  }

  if (input.ledgerSource && input.uid && input.canReadMemory !== false) {
    try {
      const ledger = await input.ledgerSource.load(input.uid, childId);
      context.acceptedActions = projectAcceptedActions(ledger.actionLoops ?? []);
      context.keptInsights = projectKeptInsights(ledger.insights ?? []);
    } catch {
      context.acceptedActions = [];
      context.keptInsights = [];
    }
  }
  return context;
};

/* ── Renderers (the prompt blocks; template text is pinned through ai/prompts.ts) ── */

/** /chat's approved-memory block: one line per fact, same shape as coach_chat ≤1.3. */
export const renderApprovedFactLines = (facts: readonly CompanionFact[]): string =>
  facts.map((f) => `- ${f.text} (${f.source}; retention: ${f.retention})`).join("\n");

/** The most recent RATED step — what /todays-focus adapts to. */
export const lastRatedAction = (actions: readonly CompanionAction[]): CompanionAction | null =>
  actions.find((a) => a.status === "completed" && !!a.outcome) ?? null;

/* ── Ledger sources ─────────────────────────────────────────────────────────── */

/** Local adapter: child ledgers live in the owner's browser; nothing to read. */
export class NullCompanionLedgerSource implements CompanionLedgerSource {
  async load(): Promise<CompanionLedger> {
    return { actionLoops: [], insights: [] };
  }
}

/** Firestore (Cloud Run ADC): users/{uid}/children/{childId}/{actionLoops,insights}.
 *  The uid is the AUTHENTICATED caller — a child under another account is
 *  simply not on this path. Bounded reads: 20 newest steps, kept insights only. */
export class FirestoreCompanionLedgerSource implements CompanionLedgerSource {
  private readonly db: Firestore;
  constructor(config: ArborConfig) {
    if (!getApps().length) {
      initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    }
    this.db = getFirestore(config.firestoreDatabaseId);
  }

  async load(uid: string, childId: string): Promise<CompanionLedger> {
    const childRef = this.db.doc(`users/${uid}/children/${childId}`);
    const [loops, insights] = await Promise.all([
      childRef.collection("actionLoops").orderBy("acceptedAt", "desc").limit(20).get(),
      childRef.collection("insights").where("kind", "==", "kept-insight").get(),
    ]);
    return {
      actionLoops: loops.docs.map((d) => d.data()),
      insights: insights.docs.map((d) => d.data()),
    };
  }
}

export const createCompanionLedgerSource = (config: ArborConfig): CompanionLedgerSource =>
  config.memoryAdapter === "firestore" ? new FirestoreCompanionLedgerSource(config) : new NullCompanionLedgerSource();
