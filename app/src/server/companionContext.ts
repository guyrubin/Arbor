/**
 * B-AI-01 — CompanionContext v1 (v2 since B-PROG-01): the ONE server-side context service.
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
 * B-PROG-01 (v2): the child's ACTIVE program enrolment (`programs` rows,
 * lib/programs/enrolment) becomes `program: { id, name, shelf, week, skill,
 * scripts[≤3], measures }` — program content only (the week's skill and the
 * coach scripts Arbor wrote, the measure definitions), never a count about
 * the child. Present only when an enrolment is active; the `child` audience
 * never sees it (the whole context is empty for it, fail closed).
 *
 * B-LOOP-13 (v2): the JOURNAL block — `journal: { shelfCoverage, nextMilestones,
 * candidates, restedShelves, practice, nightAnswers }` (ai/journalContext).
 * Built ONLY from: the client's sanitized journal request (30-day shelf
 * counts, open milestone ids, today's candidate practice ids, the day pin,
 * the "not sure" shelves) resolved against the CATALOGUE (titles, age lines
 * and say-lines are never taken from the wire), and the practice dose rows of
 * `actionLoops` (the server ledger first; the client's rows only when the
 * ledger holds none — local adapter). Today's practice = today's dose row,
 * else the day pin. Night answers = the evening outcome + the parent's
 * Tonight line (`whatHappened`, ≤ 240 chars), never the `quote` keepsake.
 * The `child` audience never sees it (fail closed, like the whole context).
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
import type { LocalizedText } from "../content/governance.js";
import type { ShelfId } from "../lib/shelves/registry.js";
import { programName } from "../content/programs/index.js";
import { activeProgramWeek } from "../lib/programs/enrolment.js";
import { PRACTICES, type Practice } from "../content/practices.js";
import { milestoneAgeLine } from "../lib/milestoneAgeLine.js";
import { translate } from "../lib/i18n.js";
import { ALL_MILESTONES, isCatalogueMilestone, milestoneAgeWindow } from "../lib/milestoneData.js";
import { comparisonMonthsOf } from "../lib/age/forChild.js";
import { buildMilestoneCandidates } from "./milestoneMatch.js";
import { SHELF_IDS, shelfLabel } from "../lib/shelves/registry.js";
import { resolveHebrewSlash } from "../lib/hebrewSlashGender.js";
import type { ChildProfile } from "../types.js";
import {
  MAX_JOURNAL_CANDIDATES,
  MAX_JOURNAL_MILESTONES,
  MAX_NIGHT_ANSWERS,
  acceptedJournalDay,
  sanitizeDoseRow,
  sanitizeJournalRequest,
  WHY_KEYS,
  type CompanionJournal,
  type JournalCandidate,
  type JournalDoseRow,
  type JournalNightAnswer,
  type JournalPractice,
  type JournalRequest,
} from "../ai/journalContext.js";

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

/** B-PROG-01 — the active program block: Arbor's own program content for the
 *  current week, never a count or a read of the child. */
export type CompanionProgram = {
  id: string;
  /** The program's name (EN + HE). */
  name: LocalizedText;
  shelf: ShelfId;
  /** 1-based program week. */
  week: number;
  /** The week's parent skill (EN + HE). */
  skill: LocalizedText;
  /** The week's in-the-moment coach scripts, ≤ 3 (EN + HE). */
  scripts: LocalizedText[];
  /** The measure definitions (ids + EN labels) — what the family counts, never a value. */
  measures: { dose: true; parentProxy: { id: string; label: string }; childProxy: { id: string; label: string } };
};

export const MAX_PROGRAM_SCRIPTS = 3;

export type CompanionContext = {
  profile: ModelProfile | null;
  approvedFacts: CompanionFact[];
  acceptedActions: CompanionAction[];
  keptInsights: CompanionInsight[];
  weeklyCounts?: WeeklyContext | null;
  /** B-PROG-01: only when an enrolment is active (parent audience only). */
  program?: CompanionProgram;
  /** B-LOOP-13: parent audience only, when a journal request or a ledger
   *  practice row exists (ai/journalContext). */
  journal?: CompanionJournal;
};

/** Raw ledger rows as the client writes them — validated field by field here.
 *  `programs` (B-PROG-01) is optional: a source that does not read it yields no program block. */
export type CompanionLedger = { actionLoops: unknown[]; insights: unknown[]; programs?: unknown[] };

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

/** B-PROG-01: the active enrolment → the program block, or null (no active
 *  enrolment, unknown program, malformed row). The week is computed at `now`. */
export const projectActiveProgram = (rows: readonly unknown[], now: number = Date.now()): CompanionProgram | null => {
  const active = activeProgramWeek(rows, new Date(now));
  if (!active) return null;
  const name = programName(active.program.id);
  if (!name) return null;
  const { program, week, content } = active;
  return {
    id: program.id,
    name,
    shelf: program.shelf,
    week,
    skill: content.skill,
    scripts: content.coachScripts.slice(0, MAX_PROGRAM_SCRIPTS).map((s) => s.text),
    measures: {
      dose: true,
      parentProxy: { id: program.measures.parentProxy.id, label: program.measures.parentProxy.label.en },
      childProxy: { id: program.measures.childProxy.id, label: program.measures.childProxy.label.en },
    },
  };
};

/** The one context line the four program-aware prompts render (B-PROG-01). */
export const programPromptLine = (program?: CompanionProgram | null): { name: string; week: number; skill: string } | undefined =>
  program ? { name: program.name.en, week: program.week, skill: program.skill.en } : undefined;

/* ── B-LOOP-13: the journal block ─────────────────────────────────────────── */

const PRACTICE_BY_ID: ReadonlyMap<string, Practice> = new Map(PRACTICES.map((p) => [p.id, p]));
const CATALOGUE_IDS: ReadonlySet<string> = new Set(ALL_MILESTONES.filter((m) => isCatalogueMilestone(m)).map((m) => m.id));
const enT = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);

/** Practice dose rows of THIS child from the ledger (validated; other rows ignored). */
const ledgerDoseRows = (rows: readonly unknown[], childId: string): JournalDoseRow[] => {
  const prefix = `practice.${childId}.`;
  return rows.map(sanitizeDoseRow).filter((r): r is JournalDoseRow => !!r && r.id.startsWith(prefix));
};

/**
 * The journal block (B-LOOP-13). Pure: the sanitized request + the ledger's
 * action rows → the capped block. Every text comes from the catalogue except
 * `whatHappened` (the parent's Tonight line, ≤ 240). Sizes: ≤ 6 milestones,
 * ≤ 6 candidates, ≤ 3 night answers.
 */
export const projectJournal = (input: {
  request: JournalRequest | null;
  /** The server ledger's actionLoops rows (empty when unread). */
  actionLoops: readonly unknown[];
  childId: string;
  childProfile?: unknown;
  now?: number;
  /** Round 2: with an active program the client's (program week) order stands. */
  keepOrder?: boolean;
}): CompanionJournal => {
  const req: JournalRequest = input.request ?? {};
  const now = input.now ?? Date.now();
  const day = acceptedJournalDay(req.dateKey, now);
  const shelfCoverage = Object.fromEntries(SHELF_IDS.map((id) => [id, req.shelfCoverage?.[id] ?? 0])) as CompanionJournal["shelfCoverage"];
  const nextMilestones = buildMilestoneCandidates(req.nextMilestoneIds ?? [], input.childProfile)
    .filter((m) => CATALOGUE_IDS.has(m.id))
    .slice(0, MAX_JOURNAL_MILESTONES)
    .map((m) => ({ id: m.id, shelf: m.shelf as ShelfId, title: m.title, ageLine: milestoneAgeLine({ id: m.id }, enT) }));
  const restedShelves = [...(req.restedShelves ?? [])];
  // Candidates: catalogue practices inside the child's age window, never on a rested shelf.
  const months = comparisonMonthsOf((input.childProfile ?? null) as ChildProfile | null);
  const window = months === null ? null : milestoneAgeWindow(months);
  const kept: Practice[] = [];
  for (const id of req.candidatePracticeIds ?? []) {
    const p = PRACTICE_BY_ID.get(id);
    if (!p || !window || !window.includes(p.ageMonths) || restedShelves.includes(p.shelf)) continue;
    kept.push(p);
    if (kept.length >= MAX_JOURNAL_CANDIDATES) break;
  }
  // Round 2 (framer, 6 Oct): the model never ranks shelves. The candidates
  // arrive in the pure chooser's order (thinnest shelf first, ties by shelf
  // order — lib/milestones/selectByShelf shelvesThinnestFirst); the server
  // re-applies that order (stable within a shelf) whatever the wire order,
  // except under an active program, whose week order stands. FIRST TIER =
  // the candidates on a shelf as thin as the first one's (the chooser's own
  // shelf, plus any shelf tied with it; under a program: the first's shelf).
  const order = (shelf: ShelfId) => SHELF_IDS.indexOf(shelf);
  const ordered = input.keepOrder
    ? kept
    : kept.map((p, i) => ({ p, i })).sort((a, b) => (shelfCoverage[a.p.shelf] - shelfCoverage[b.p.shelf]) || (order(a.p.shelf) - order(b.p.shelf)) || (a.i - b.i)).map((x) => x.p);
  const head = ordered[0];
  const inFirstTier = (p: Practice) => !!head && (input.keepOrder ? p.shelf === head.shelf : shelfCoverage[p.shelf] === shelfCoverage[head.shelf]);
  const candidates: JournalCandidate[] = ordered.map((p) => ({ id: p.id, shelf: p.shelf, say: p.say.en, milestoneId: p.milestoneId, firstTier: inFirstTier(p), do: p.do.en }));
  // Dose rows: the server ledger first; the client's rows only when the ledger has none.
  const prefix = `practice.${input.childId}.`;
  const fromLedger = ledgerDoseRows(input.actionLoops, input.childId);
  const rows = (fromLedger.length ? fromLedger : (req.doseRows ?? []).filter((r) => r.id.startsWith(prefix)))
    .filter((r) => PRACTICE_BY_ID.has(r.practiceId) && r.id.slice(prefix.length) <= day);
  const asPractice = (p: Practice, state: JournalPractice["state"]): JournalPractice => ({ id: p.id, shelf: p.shelf, say: p.say.en, state, date: day });
  const todayRow = rows.find((r) => r.id === `${prefix}${day}`);
  const todayPractice = todayRow ? PRACTICE_BY_ID.get(todayRow.practiceId) : undefined;
  const pinned = req.pinnedPracticeId ? PRACTICE_BY_ID.get(req.pinnedPracticeId) : undefined;
  // Precedence (B-LOOP-11): today's dose row > the parent's day pin > none (the AI or the chooser picks).
  const practice: JournalPractice | null = todayRow && todayPractice
    ? asPractice(todayPractice, todayRow.outcome === "not_today" ? "not_today" : "done")
    : pinned
      ? asPractice(pinned, "pending")
      : null;
  const nightAnswers: JournalNightAnswer[] = rows
    .filter((r) => r.outcome || r.whatHappened)
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, MAX_NIGHT_ANSWERS)
    .map((r) => ({
      date: r.id.slice(prefix.length),
      practice: PRACTICE_BY_ID.get(r.practiceId)!.say.en,
      ...(r.outcome ? { practiceOutcome: r.outcome } : {}),
      ...(r.whatHappened ? { whatHappened: r.whatHappened } : {}),
    }));
  return { shelfCoverage, nextMilestones, candidates, restedShelves, practice, nightAnswers };
};

/** Round 2: a practice's own catalogue say-line in the parent's language
 *  (HE slash forms resolved by gender, as Today's card renders it) — the
 *  sayThis fallback. "" for an unknown id. */
export const practiceSayLine = (id: string, lang: "en" | "he", gender?: string | null): string => {
  const p = PRACTICE_BY_ID.get(id);
  if (!p) return "";
  return lang === "he" ? resolveHebrewSlash(p.say.he, gender) : p.say.en;
};

/** Round 4: the coherence material of a practice — its do / say lines and its
 *  shelf name, EN + HE (the step may be written in either language). */
export const practiceMaterial = (id: string): string => {
  const p = PRACTICE_BY_ID.get(id);
  if (!p) return "";
  const label = (lang: "en" | "he") => shelfLabel(p.shelf, (k) => translate(lang, k));
  return [p.do.en, p.do.he, p.say.en, p.say.he, label("en"), label("he"), p.shelf].join(" ");
};

/**
 * Round 2/4: the server-rendered why (the chooser's reason, the two shapes
 * Today ships). HE: the closing "בשבילו" (agreeing with the shelf) follows the
 * child's gender through the shared slash resolver ("בשבילו/ה" → בשבילה for
 * a girl; boy / unknown keep בשבילו) — loop-he-register-thin-shelf on 1.3.2.
 */
export const renderWhyLine = (input: { reason: "empty" | "fewest"; shelf: ShelfId; lang: "en" | "he"; name: string; gender?: string | null }): string => {
  const t = (key: string, vars?: Record<string, string | number>) => translate(input.lang, key, vars);
  const text = t(WHY_KEYS[input.reason], { shelf: shelfLabel(input.shelf, t), name: input.name || t("today.record.childFallback") });
  return input.lang === "he" ? resolveHebrewSlash(text.replace(/בשבילו(?=[.\s]|$)/u, "בשבילו/ה"), input.gender) : text;
};

/** The practice line's input for coach_chat / voice_reply (null without a practice). */
export const todayPracticeLine = (journal?: CompanionJournal | null): Pick<JournalPractice, "say" | "state"> | null =>
  journal?.practice ? { say: journal.practice.say, state: journal.practice.state } : null;

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
  /** B-LOOP-13: the client's raw journal request (sanitized here). */
  journal?: unknown;
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

  let ledgerActions: readonly unknown[] = [];
  if (input.ledgerSource && input.uid && input.canReadMemory !== false) {
    try {
      const ledger = await input.ledgerSource.load(input.uid, childId);
      ledgerActions = ledger.actionLoops ?? [];
      context.acceptedActions = projectAcceptedActions(ledger.actionLoops ?? []);
      context.keptInsights = projectKeptInsights(ledger.insights ?? []);
      const program = projectActiveProgram(ledger.programs ?? [], now);
      if (program) context.program = program;
    } catch {
      context.acceptedActions = [];
      context.keptInsights = [];
      delete context.program;
      ledgerActions = [];
    }
  }

  // B-LOOP-13: the journal — the parent's own record; never on a turn that may not read memory.
  if (input.canReadMemory !== false) {
    const request = sanitizeJournalRequest(input.journal);
    if (request || ledgerDoseRows(ledgerActions, childId).length > 0) {
      try {
        context.journal = projectJournal({ request, actionLoops: ledgerActions, childId, childProfile: input.childProfile, now, keepOrder: !!context.program });
      } catch {
        delete context.journal;
      }
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
    return { actionLoops: [], insights: [], programs: [] };
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
    const [loops, insights, programs] = await Promise.all([
      childRef.collection("actionLoops").orderBy("acceptedAt", "desc").limit(20).get(),
      childRef.collection("insights").where("kind", "==", "kept-insight").get(),
      // B-PROG-01: the active enrolment only (one per child; 2 tolerates a race).
      childRef.collection("programs").where("status", "==", "active").limit(2).get(),
    ]);
    return {
      actionLoops: loops.docs.map((d) => d.data()),
      insights: insights.docs.map((d) => d.data()),
      programs: programs.docs.map((d) => d.data()),
    };
  }
}

export const createCompanionLedgerSource = (config: ArborConfig): CompanionLedgerSource =>
  config.memoryAdapter === "firestore" ? new FirestoreCompanionLedgerSource(config) : new NullCompanionLedgerSource();
