/**
 * Masterplan 1.3 — coach conversational context, as ONE pure module.
 *
 * The coach was stateless per turn: /api/chat got {message, childProfile,
 * scholarLens, language, libraryContext} and nothing else, so "he" in a
 * follow-up question landed on a model that had never seen the previous
 * answer. This module is the WHOLE context-assembly seam, both sides:
 *
 *  - CLIENT (ArborContext.sendMessage calls `buildChatContext`): derive
 *    `recentTurns` (last turns of the SAME thread, already on screen — no new
 *    consent surface needed, the parent is literally looking at these words)
 *    and, ONLY behind the per-child parent toggle, `weeklyContext` — COUNTS
 *    AND CATEGORIES ONLY (a moment count, the most frequent trigger label, a
 *    milestone count, the last action outcome), never raw log text.
 *
 *  - SERVER (routes/api.ts /chat calls the `sanitize*` pair): the body fields
 *    are client-supplied prompt input, so they are re-validated hard — role
 *    whitelist, string types, per-turn + total char caps (~4000), integer
 *    clamps, outcome enum — regardless of what the client sent.
 *
 * Pure on purpose (no React, no node imports): unit-testable in isolation and
 * importable from both the browser bundle and the express routes.
 *
 * CONSENT MODEL: recentTurns needs no new consent (same-thread text the
 * parent just typed/read, already persisted in the conversation). The weekly
 * digest is consent-gated per child via localStorage
 * `arbor.coach.weeklyContext.{childId}` — DEFAULT OFF, absent field when off,
 * so an off-toggle request is byte-identical to today's prompt.
 */

export type RecentTurnRole = "parent" | "coach";
export type RecentTurn = { role: RecentTurnRole; text: string };

export type WeeklyContextOutcome = "helped" | "somewhat" | "not_today";
export type WeeklyContext = {
  /** Behavior moments logged in the trailing 7 days — an integer, never text. */
  momentCount: number;
  /** Milestones newly observed ("yes") in the trailing 7 days. */
  milestonesCrossedCount: number;
  /** Outcome of the most recent completed suggested action this week. */
  lastActionOutcome?: WeeklyContextOutcome;
};

// ── Caps (shared by client assembly AND server sanitation — the server
//    re-enforces them defensively on whatever the wire delivered) ────────────
export const RECENT_TURNS_MAX = 6;
export const RECENT_TURN_CHAR_CAP = 800;
export const RECENT_TURNS_TOTAL_CHAR_CAP = 4000;
// (The former TOP_TRIGGER_CHAR_CAP is gone with the field itself — the weekly
// context is counts + closed enums only; no free text crosses this seam.)
const COUNT_MAX = 999;

const VALID_ROLES: ReadonlySet<string> = new Set(["parent", "coach"]);
const VALID_OUTCOMES: ReadonlySet<string> = new Set(["helped", "somewhat", "not_today"]);

/**
 * Server-defensive (and client-shared) normalization of a recentTurns array:
 * shape/role/type whitelist, per-turn char cap, keep only the MOST RECENT
 * `RECENT_TURNS_MAX` turns, then drop oldest-first until the total stays
 * under `RECENT_TURNS_TOTAL_CHAR_CAP`. Anything malformed degrades to [] —
 * the prompt then renders byte-identical to the no-continuity path.
 */
export const sanitizeRecentTurns = (raw: unknown): RecentTurn[] => {
  if (!Array.isArray(raw)) return [];
  const cleaned: RecentTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { role, text } = item as { role?: unknown; text?: unknown };
    if (typeof role !== "string" || !VALID_ROLES.has(role)) continue;
    if (typeof text !== "string") continue;
    const trimmed = text.trim();
    if (!trimmed) continue;
    cleaned.push({ role: role as RecentTurnRole, text: trimmed.slice(0, RECENT_TURN_CHAR_CAP) });
  }
  // Most recent turns win: take the tail, then enforce the total budget by
  // dropping the OLDEST of what remains.
  let windowed = cleaned.slice(-RECENT_TURNS_MAX);
  let total = windowed.reduce((sum, t) => sum + t.text.length, 0);
  while (windowed.length > 1 && total > RECENT_TURNS_TOTAL_CHAR_CAP) {
    total -= windowed[0].text.length;
    windowed = windowed.slice(1);
  }
  if (windowed.length === 1 && total > RECENT_TURNS_TOTAL_CHAR_CAP) {
    windowed = [{ ...windowed[0], text: windowed[0].text.slice(0, RECENT_TURNS_TOTAL_CHAR_CAP) }];
  }
  return windowed;
};

const clampCount = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(COUNT_MAX, Math.max(0, Math.round(value)));
};

/**
 * Server-defensive normalization of the weeklyContext body field. Returns
 * null (⇒ NO prompt line, byte-identical path) unless the shape is a valid
 * counts-and-categories object. NO free text survives sanitation (a legacy
 * `topTrigger` field is dropped — the trigger box is parent free-typed text,
 * and the consent contract promises "never your written notes"); the outcome
 * must be one of the three enum values.
 */
export const sanitizeWeeklyContext = (raw: unknown): WeeklyContext | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const wc = raw as Record<string, unknown>;
  const momentCount = clampCount(wc.momentCount);
  const milestonesCrossedCount = clampCount(wc.milestonesCrossedCount);
  if (momentCount === null || milestonesCrossedCount === null) return null;
  const out: WeeklyContext = { momentCount, milestonesCrossedCount };
  if (typeof wc.lastActionOutcome === "string" && VALID_OUTCOMES.has(wc.lastActionOutcome)) {
    out.lastActionOutcome = wc.lastActionOutcome as WeeklyContextOutcome;
  }
  return out;
};

// ── Client-side consent flag (per child, DEFAULT OFF) ───────────────────────

export const weeklyContextConsentKey = (childId: string): string =>
  `arbor.coach.weeklyContext.${childId}`;

/** Absent / unreadable localStorage ⇒ false — the toggle is OFF by default. */
export const readWeeklyContextConsent = (childId: string): boolean => {
  try {
    return globalThis.localStorage?.getItem(weeklyContextConsentKey(childId)) === "on";
  } catch {
    return false;
  }
};

export const writeWeeklyContextConsent = (childId: string, on: boolean): void => {
  try {
    if (on) globalThis.localStorage?.setItem(weeklyContextConsentKey(childId), "on");
    else globalThis.localStorage?.removeItem(weeklyContextConsentKey(childId));
  } catch {
    /* consent stays off when storage is unavailable */
  }
};

// ── Client-side assembly ────────────────────────────────────────────────────

/** Structural view of ArborContext's ChatMessage — no import, no cycle. */
export type ThreadTurnLike = {
  sender: "user" | "ai";
  text: string;
  chatAck?: boolean;
  chatLive?: boolean;
  voiceLive?: boolean;
};

export type WeeklyContextSources = {
  behaviorLogs: ReadonlyArray<{ timestamp: string; trigger?: string }>;
  milestones: ReadonlyArray<{ checked: boolean; observationUpdatedAt?: string }>;
  actionLoop: ReadonlyArray<{ outcome?: string; outcomeAt?: string }>;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const withinWeek = (iso: string | undefined, now: number): boolean => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t <= now && now - t <= WEEK_MS;
};

/**
 * Compute the counts-only weekly digest from data the client ALREADY holds.
 * No raw log text ever enters the result — counts and closed enums ONLY (the
 * trigger box is free-typed parent text, so it never leaves the device here).
 */
export const computeWeeklyContext = (sources: WeeklyContextSources, now: Date = new Date()): WeeklyContext => {
  const nowMs = now.getTime();
  const weekLogs = sources.behaviorLogs.filter((l) => withinWeek(l.timestamp, nowMs));

  const milestonesCrossedCount = sources.milestones.filter(
    (m) => m.checked && withinWeek(m.observationUpdatedAt, nowMs),
  ).length;

  let lastActionOutcome: WeeklyContextOutcome | undefined;
  let lastOutcomeAt = "";
  for (const entry of sources.actionLoop) {
    if (!entry.outcome || !VALID_OUTCOMES.has(entry.outcome)) continue;
    if (!withinWeek(entry.outcomeAt, nowMs)) continue;
    if ((entry.outcomeAt ?? "") > lastOutcomeAt) {
      lastOutcomeAt = entry.outcomeAt ?? "";
      lastActionOutcome = entry.outcome as WeeklyContextOutcome;
    }
  }

  const out: WeeklyContext = { momentCount: weekLogs.length, milestonesCrossedCount };
  if (lastActionOutcome) out.lastActionOutcome = lastActionOutcome;
  return out;
};

/**
 * THE one call ArborContext.sendMessage makes (see the patch spec in the
 * masterplan report): turn the on-screen thread + already-held child data
 * into the two optional /api/chat body fields. Both fields are ABSENT (not
 * empty) when they carry nothing, so the legacy request body — and therefore
 * the server prompt — stays byte-identical.
 */
/**
 * Settled real turns only: the local ack bubble and still-streaming live
 * bubbles (chat or voice caption) never enter a transcript. Shared by the
 * typed and SPOKEN context builders so the two cannot drift.
 */
const settledTurns = (thread: ReadonlyArray<ThreadTurnLike>): RecentTurn[] =>
  sanitizeRecentTurns(
    thread
      .filter((m) => !m.chatAck && !m.chatLive && !m.voiceLive && m.text.trim())
      .map<RecentTurn>((m) => ({ role: m.sender === "user" ? "parent" : "coach", text: m.text })),
  );

/**
 * AI-02 — the SPOKEN counterpart of `buildChatContext`. A voice turn is the
 * same conversation as the typed one (both write into `chatMessages`), so it
 * carries the same same-thread continuity and needs no new consent surface.
 * The weekly digest is deliberately NOT included: it is consent-gated per
 * child for the typed path and a spoken turn must not silently widen it.
 * Absent (not empty) when the thread carries nothing, so a first spoken turn
 * produces a request byte-identical to today's.
 */
export const buildVoiceContext = (
  thread: ReadonlyArray<ThreadTurnLike>,
): { recentTurns?: RecentTurn[] } => {
  const recentTurns = settledTurns(thread);
  return recentTurns.length > 0 ? { recentTurns } : {};
};

export const buildChatContext = (input: {
  thread: ReadonlyArray<ThreadTurnLike>;
  behaviorLogs: WeeklyContextSources["behaviorLogs"];
  milestones: WeeklyContextSources["milestones"];
  actionLoop: WeeklyContextSources["actionLoop"];
  weeklyContextEnabled: boolean;
  now?: Date;
}): { recentTurns?: RecentTurn[]; weeklyContext?: WeeklyContext } => {
  const recentTurns = settledTurns(input.thread);

  const out: { recentTurns?: RecentTurn[]; weeklyContext?: WeeklyContext } = {};
  if (recentTurns.length > 0) out.recentTurns = recentTurns;
  if (input.weeklyContextEnabled) {
    out.weeklyContext = computeWeeklyContext(
      { behaviorLogs: input.behaviorLogs, milestones: input.milestones, actionLoop: input.actionLoop },
      input.now,
    );
  }
  return out;
};
