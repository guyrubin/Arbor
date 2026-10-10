/**
 * B-SHELL-39 — "Tell Arbor about {name}": one guided conversation. Arbor
 * asks "Tell me about {name}", then one follow-up at a time (≤ 4), each about
 * the parent's last answer; the parent answers by voice or text; Arbor plays
 * back what it heard as items the parent keeps, edits or removes.
 *
 * This module is the pure half shared by the server (types, limits) and the
 * client (the readback session, the profile projection and the commit plan).
 * No React, no network, no storage: the network and the writes are injected
 * services, so onboarding's FirstRunController and the "Tell Arbor more"
 * door run the same session and the same tests.
 *
 * @icon-font-ignore — a pure module: its string literals ("commit", "add") are
 * states and operations, never Material Symbols icon names.
 *
 * Rules it carries (Guy, 10 Oct; ROS decision 2026-10-10):
 *  - D2: no raw transcript is stored — only the items the parent keeps.
 *  - Nothing is written before "Keep these"; Undo restores the prior state.
 *  - Every kept item carries `source: "describe"` and `confirmedAt`.
 *  - Every item is the parent's words (the server drops an item whose quote is
 *    not in what the parent said). No verdict, score or AI reading of the child.
 */
import type { ChildProfile } from "../types";
import { isDomainId, type DomainId } from "./domains/registry";
import { screenForImmediateEscalation } from "../safety/escalation";

export const DESCRIBE_KINDS = ["strength", "interest", "worry", "focus", "preference", "milestone", "context"] as const;
export type DescribeKind = (typeof DESCRIBE_KINDS)[number];
export const isDescribeKind = (value: unknown): value is DescribeKind =>
  typeof value === "string" && (DESCRIBE_KINDS as readonly string[]).includes(value);

/** The parent's description, in characters (the textarea's maxLength). */
export const DESCRIBE_TEXT_MAX = 2000;
/** One item's words, in characters. */
export const DESCRIBE_ITEM_MAX = 120;
export const MAX_FOCUS_AREAS = 3;
export const MAX_PARENT_PREFERENCES = 8;
/** Follow-up questions after the opening, one at a time (server-enforced too). */
export const MAX_FOLLOW_UPS = 4;
/** The whole-readback Undo window after "Keep these". */
export const DESCRIBE_UNDO_MS = 10_000;

// ── What the child doc stores ────────────────────────────────────────────────

/** What the parent wants to work on now, in their words (≤ 3). */
export interface FocusArea { id: string; words: string; domainId?: DomainId; since: string; source: "describe"; confirmedAt: string }
/** How the parent wants Arbor to help (≤ 8). A wish; never overrides safety. */
export interface ParentPreference { id: string; words: string; since: string; source: "describe"; confirmedAt: string }
/** Provenance for a strength, interest or worry kept from the readback. The
 *  words also stay in `strengths` / `interests` / `challenges`, which every
 *  existing reader uses; a worry keeps the area it belongs to here. */
export interface DescribedItem { id: string; kind: "strength" | "interest" | "worry"; words: string; domainId?: DomainId; since: string; source: "describe"; confirmedAt: string }

/** The kinds the child doc holds (milestones and context live elsewhere). */
export type ProfileKind = "strength" | "interest" | "worry" | "focus" | "preference";
export const PROFILE_KINDS: readonly ProfileKind[] = ["strength", "interest", "worry", "focus", "preference"];

/** Something Arbor already holds in the parent's words. `source: "profile"`
 *  is a line written elsewhere (Profile, older onboarding) with no describe record. */
export interface KeptDescribeItem { id: string; kind: ProfileKind; words: string; domainId?: DomainId; source: "describe" | "profile" }

// ── What the route returns ───────────────────────────────────────────────────

export type DescribeOp = "add" | "replace" | "remove";
export interface DescribeDraftItem {
  id: string;
  kind: DescribeKind;
  /** The parent's words for this one thing (≤ 120 characters). */
  text: string;
  /** An exact span of what the parent said (server-checked). */
  quote: string;
  op: DescribeOp;
  /** The kept item a replace or remove acts on. */
  itemId?: string;
  domainId?: DomainId;
  /** The words carry a diagnosis term the parent said themselves. */
  parentReported?: true;
  /** A catalogue milestone the parent's words match (later door only). */
  milestoneId?: string;
  milestoneTitle?: string;
}
export interface DescribeDraft {
  items: DescribeDraftItem[];
  /** ONE question about the answer just given, or null when nothing worth
   *  asking remains (always null after the 4th follow-up). */
  nextQuestion: string | null;
  /** The question's language, and a screened-sentence token for /api/tts. */
  nextQuestionLang?: "en" | "he";
  nextQuestionToken?: string;
}

/** The body the client posts to /api/describe-child. */
export interface DescribeRequest {
  text: string;
  childProfile: { id?: string; name?: string; age?: number; birthDate?: string; birthMonth?: string; ageMonths?: number; ageMonthsAsOf?: string; preterm?: ChildProfile["preterm"] };
  language: "en" | "he";
  keptItems: { id: string; kind: ProfileKind; words: string }[];
  milestoneCandidateIds?: string[];
  /** The follow-up this text answers (absent for the opening answer). */
  question?: string;
  /** Follow-ups already asked, oldest first. */
  askedQuestions?: string[];
}

// ── Small helpers ────────────────────────────────────────────────────────────

const normalize = (text: string): string => text.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
const same = (a: string, b: string): boolean => normalize(a) === normalize(b);
const hash = (text: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
};

/** Cut to `max` characters at a word boundary when one is close. */
export function clipWords(text: string, max = DESCRIBE_ITEM_MAX): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trim();
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : [];

// ── The child doc, as items ──────────────────────────────────────────────────

type DescribeFields = Pick<ChildProfile, "strengths" | "challenges" | "interests" | "focusAreas" | "parentPreferences" | "describedItems">;

/** Everything the child doc holds in the parent's words, as readback items:
 *  what "Tell Arbor more" loads, and what My child / What Arbor knows list. */
export function keptItemsFromProfile(profile: Partial<DescribeFields> | null | undefined): KeptDescribeItem[] {
  if (!profile) return [];
  const ledger = Array.isArray(profile.describedItems) ? profile.describedItems : [];
  const out: KeptDescribeItem[] = [];
  const seen = new Set<string>();
  const push = (item: KeptDescribeItem) => { if (!seen.has(item.id)) { seen.add(item.id); out.push(item); } };
  const fromList = (kind: "strength" | "interest" | "worry", list: unknown) => {
    for (const words of strings(list)) {
      const record = ledger.find((d) => d && d.kind === kind && typeof d.words === "string" && same(d.words, words));
      push(record
        ? { id: record.id, kind, words, ...(record.domainId && isDomainId(record.domainId) ? { domainId: record.domainId } : {}), source: "describe" }
        : { id: `${kind}:${hash(normalize(words))}`, kind, words, source: "profile" });
    }
  };
  fromList("strength", profile.strengths);
  fromList("interest", profile.interests);
  fromList("worry", profile.challenges);
  for (const focus of Array.isArray(profile.focusAreas) ? profile.focusAreas : []) {
    if (focus && typeof focus.words === "string" && focus.words.trim()) {
      push({ id: focus.id, kind: "focus", words: focus.words, ...(focus.domainId && isDomainId(focus.domainId) ? { domainId: focus.domainId } : {}), source: "describe" });
    }
  }
  for (const wish of Array.isArray(profile.parentPreferences) ? profile.parentPreferences : []) {
    if (wish && typeof wish.words === "string" && wish.words.trim()) push({ id: wish.id, kind: "preference", words: wish.words, source: "describe" });
  }
  return out;
}

// ── The commit plan (pure): kept readback items → one child-doc patch ───────

export type DescribePatch = Partial<Pick<ChildProfile, "strengths" | "interests" | "interestsUpdatedAt" | "challenges" | "focusAreas" | "parentPreferences" | "describedItems">>;
const PATCH_FIELDS = ["strengths", "interests", "interestsUpdatedAt", "challenges", "focusAreas", "parentPreferences", "describedItems"] as const;

export interface DescribeCommitPlan {
  /** Only the fields that change. */
  patch: DescribePatch;
  /** The same fields before the change (`undefined` = the field was absent). */
  previous: DescribePatch;
  /** Context items and milestones without a confirmed catalogue match →
   *  approved memory, in the parent's words. */
  memoryFacts: string[];
  /** Catalogue milestones the parent confirmed ("Not this" not pressed). */
  milestoneIds: string[];
  /** Items kept (memory and milestones included). */
  kept: number;
  /** Items not kept because Focus (3) or preferences (8) were full. */
  overCap: number;
}

/** A readback row: a server draft item plus the parent's choices on it. */
export interface ReadbackItem extends DescribeDraftItem {
  keep: boolean;
  /** The parent's edit of the words. */
  edited?: string;
  /** "Not this" on a milestone match: the words are kept as a note instead. */
  milestoneDeclined?: boolean;
  /** 0 = the first description, 1–2 = follow-up answers. */
  round: number;
}

interface Working {
  strengths: string[]; interests: string[]; challenges: string[];
  focusAreas: FocusArea[]; parentPreferences: ParentPreference[]; describedItems: DescribedItem[];
}

const working = (profile: Partial<DescribeFields>): Working => ({
  strengths: strings(profile.strengths),
  interests: strings(profile.interests),
  challenges: strings(profile.challenges),
  focusAreas: Array.isArray(profile.focusAreas) ? [...profile.focusAreas] : [],
  parentPreferences: Array.isArray(profile.parentPreferences) ? [...profile.parentPreferences] : [],
  describedItems: Array.isArray(profile.describedItems) ? [...profile.describedItems] : [],
});

const LIST_OF: Record<"strength" | "interest" | "worry", "strengths" | "interests" | "challenges"> = { strength: "strengths", interest: "interests", worry: "challenges" };

function removeKept(w: Working, target: KeptDescribeItem): void {
  if (target.kind === "focus") { w.focusAreas = w.focusAreas.filter((f) => f.id !== target.id); return; }
  if (target.kind === "preference") { w.parentPreferences = w.parentPreferences.filter((p) => p.id !== target.id); return; }
  const list = LIST_OF[target.kind];
  w[list] = w[list].filter((words) => !same(words, target.words));
  w.describedItems = w.describedItems.filter((d) => d.id !== target.id && !(d.kind === target.kind && same(d.words, target.words)));
}

type AddResult = "added" | "duplicate" | "full";
function addKept(w: Working, kind: ProfileKind, words: string, domainId: DomainId | undefined, id: string, at: string): AddResult {
  const since = at.slice(0, 10);
  const meta = { source: "describe" as const, confirmedAt: at, since };
  if (kind === "focus") {
    if (w.focusAreas.some((f) => same(f.words, words))) return "duplicate";
    if (w.focusAreas.length >= MAX_FOCUS_AREAS) return "full";
    w.focusAreas.push({ id, words, ...(domainId ? { domainId } : {}), ...meta });
    return "added";
  }
  if (kind === "preference") {
    if (w.parentPreferences.some((p) => same(p.words, words))) return "duplicate";
    if (w.parentPreferences.length >= MAX_PARENT_PREFERENCES) return "full";
    w.parentPreferences.push({ id, words, ...meta });
    return "added";
  }
  const list = LIST_OF[kind];
  if (w[list].some((existing) => same(existing, words))) return "duplicate";
  w[list].push(words);
  w.describedItems.push({ id, kind, words, ...(domainId ? { domainId } : {}), ...meta });
  return "added";
}

const isProfileKind = (kind: DescribeKind): kind is ProfileKind => (PROFILE_KINDS as readonly string[]).includes(kind);

/** The final words of a readback row (the parent's edit wins). */
export const readbackWords = (item: Pick<ReadbackItem, "text" | "edited">): string => clipWords(item.edited ?? item.text);

/**
 * Kept readback rows → the one patch, the memory facts and the milestones.
 * A replace removes the kept item it names, then adds the new words; a
 * remove only removes. Rows whose words are empty are skipped.
 */
export function planDescribeCommit(profile: Partial<DescribeFields> | null | undefined, rows: readonly ReadbackItem[], now: Date, newId: (row: ReadbackItem, index: number) => string = (row, i) => `d-${now.getTime().toString(36)}-${i}-${hash(row.text)}`): DescribeCommitPlan {
  const base = profile ?? {};
  const w = working(base);
  const kept = keptItemsFromProfile(base);
  const at = now.toISOString();
  const memoryFacts: string[] = [];
  const milestoneIds: string[] = [];
  let count = 0;
  let overCap = 0;
  rows.forEach((row, index) => {
    if (!row.keep) return;
    const target = row.itemId ? kept.find((k) => k.id === row.itemId) : undefined;
    if ((row.op === "replace" || row.op === "remove") && target) removeKept(w, target);
    if (row.op === "remove") { if (target) count++; return; }
    const words = readbackWords(row);
    if (!words) return;
    if (row.kind === "milestone" && row.milestoneId && !row.milestoneDeclined) {
      if (!milestoneIds.includes(row.milestoneId)) milestoneIds.push(row.milestoneId);
      count++;
      return;
    }
    if (row.kind === "milestone" || row.kind === "context") {
      if (!memoryFacts.some((fact) => same(fact, words))) memoryFacts.push(words);
      count++;
      return;
    }
    if (!isProfileKind(row.kind)) return;
    // A replace keeps the area of the item it replaces unless the row names one.
    const domainId = row.domainId ?? target?.domainId;
    const result = addKept(w, row.kind, words, domainId, newId(row, index), at);
    if (result === "full") overCap++;
    else count++;
  });
  const before: Record<string, unknown> = base as Record<string, unknown>;
  const after: Record<string, unknown> = { ...w };
  if (JSON.stringify(strings(base.interests)) !== JSON.stringify(w.interests)) after.interestsUpdatedAt = at;
  const patch: Record<string, unknown> = {};
  const previous: Record<string, unknown> = {};
  for (const field of PATCH_FIELDS) {
    if (!(field in after)) continue;
    const prior = before[field];
    const next = after[field];
    const priorJson = JSON.stringify(prior ?? (field === "interestsUpdatedAt" ? null : []));
    if (JSON.stringify(next) === priorJson) continue;
    patch[field] = next;
    previous[field] = prior === undefined ? undefined : Array.isArray(prior) ? [...prior] : prior;
  }
  return { patch: patch as DescribePatch, previous: previous as DescribePatch, memoryFacts, milestoneIds, kept: count, overCap };
}

/** One kept item's later Edit (My child / What Arbor knows): a replace. */
export function planKeptEdit(profile: Partial<DescribeFields>, itemId: string, words: string, now: Date): DescribeCommitPlan | null {
  const target = keptItemsFromProfile(profile).find((k) => k.id === itemId);
  const clipped = clipWords(words);
  if (!target || !clipped) return null;
  return planDescribeCommit(profile, [{ id: "edit", kind: target.kind, text: clipped, quote: clipped, op: "replace", itemId, ...(target.domainId ? { domainId: target.domainId } : {}), keep: true, round: 0 }], now, () => target.source === "describe" ? target.id : `d-${now.getTime().toString(36)}-${hash(clipped)}`);
}

/** One kept item's later Remove. */
export function planKeptRemove(profile: Partial<DescribeFields>, itemId: string, now: Date): DescribeCommitPlan | null {
  const target = keptItemsFromProfile(profile).find((k) => k.id === itemId);
  if (!target) return null;
  return planDescribeCommit(profile, [{ id: "remove", kind: target.kind, text: target.words, quote: target.words, op: "remove", itemId, keep: true, round: 0 }], now);
}

// ── The readback, grouped as the parent reads it ────────────────────────────

export type ReadbackGroup = "about" | "hard" | "focus" | "help" | "milestones";
export const READBACK_GROUPS: readonly ReadbackGroup[] = ["about", "hard", "focus", "help", "milestones"];
export const groupOf = (kind: DescribeKind): ReadbackGroup =>
  kind === "worry" ? "hard" : kind === "focus" ? "focus" : kind === "preference" ? "help" : kind === "milestone" ? "milestones" : "about";

// ── The guided conversation + readback (an external store; onboarding and the door) ──

/** One turn of the thread: Arbor's question and the parent's answer. Turn 0
 *  is the opening ("Tell me about {name}"); up to MAX_FOLLOW_UPS follow. */
export interface ThreadTurn {
  id: string;
  question: string;
  answer?: string;
  status: "open" | "answering" | "answered" | "skipped";
  /** The question's language and its screened-sentence TTS token (follow-ups). */
  lang?: "en" | "he";
  ttsToken?: string;
}
/** idle → drafting (the opening answer) → asking (one open follow-up) ⇄
 *  drafting → ready (the readback) → committing → kept. */
export type DescribeStatus = "idle" | "drafting" | "asking" | "ready" | "committing" | "kept" | "failed";
export interface DescribeSessionState {
  status: DescribeStatus;
  items: ReadbackItem[];
  thread: ThreadTurn[];
  /** Why the last request did not produce what was asked for. */
  error: "" | "model" | "crisis" | "keepFailed" | "followUp";
  /** After "Keep these": what was written, for Undo. */
  receipt: DescribeReceipt | null;
  /** Epoch ms when the Undo window closes. */
  undoUntil: number;
}

/** What a commit wrote, enough to put everything back. */
export interface DescribeReceipt {
  plan: DescribeCommitPlan;
  /** Approved memory ids written from context items. */
  memoryIds: string[];
  /** Milestone documents as they were before (opaque to this module). */
  milestonesBefore: unknown[];
}

/** One request: the answer, the question it answers, and every item so far. */
export interface DescribeDraftInput {
  text: string;
  /** The follow-up this answers (absent for the opening answer). */
  question?: string;
  /** Follow-ups already asked, oldest first (the server stops after the 4th). */
  askedQuestions: string[];
  /** Kept items on the child doc AND the items drafted so far. */
  keptItems: KeptDescribeItem[];
}

export interface DescribeServices {
  /** POST /api/describe-child. Throws on failure; an escalation throws an
   *  error whose `status` is 409. */
  draft: (input: DescribeDraftInput) => Promise<DescribeDraft>;
  /** The child doc the plan is computed against, read at Keep time. */
  profile: () => Partial<DescribeFields> | null;
  /** Writes the plan; resolves with what to undo. */
  commit: (plan: DescribeCommitPlan) => Promise<DescribeReceipt>;
  undo: (receipt: DescribeReceipt) => Promise<void>;
  now?: () => Date;
}

const emptySession = (): DescribeSessionState => ({ status: "idle", items: [], thread: [], error: "", receipt: null, undoUntil: 0 });
/** An idle conversation (nothing asked, nothing kept). */
export const emptyDescribeState = (): DescribeSessionState => emptySession();

/** The worries a parent kept from a readback that are still in `challenges`:
 *  onboarding's completion write keeps them beside its own one-worry line. */
export function describedWorries(profile: Partial<DescribeFields> | null | undefined): string[] {
  if (!profile) return [];
  const challenges = strings(profile.challenges);
  return (Array.isArray(profile.describedItems) ? profile.describedItems : [])
    .filter((d) => d && d.kind === "worry" && typeof d.words === "string")
    .map((d) => challenges.find((c) => same(c, d.words)))
    .filter((c): c is string => !!c);
}

const isEscalation = (error: unknown): boolean => !!error && typeof error === "object" && (error as { status?: unknown }).status === 409;

/** A draft from the server → readback rows (keep on by default). */
export function readbackRows(draft: DescribeDraft, round: number, existing: readonly ReadbackItem[] = []): ReadbackItem[] {
  const taken = new Set(existing.map((item) => item.id));
  return draft.items.map((item, index) => {
    let id = `r${round}-${item.id || index}`;
    while (taken.has(id)) id = `${id}-${index}`;
    taken.add(id);
    return { ...item, id, keep: true, round };
  });
}

/**
 * A later answer's rows joined to the readback. A row that replaces or
 * removes an item DRAFTED earlier in this conversation updates that row in
 * place (the earlier row was never written); a row acting on a kept item
 * stays a replace/remove of the child doc; anything already said is dropped.
 */
export function mergeRows(existing: readonly ReadbackItem[], fresh: readonly ReadbackItem[]): ReadbackItem[] {
  let out = [...existing];
  for (const row of fresh) {
    const drafted = row.itemId ? out.find((item) => item.id === row.itemId) : undefined;
    if (drafted && row.op === "remove") { out = out.filter((item) => item.id !== drafted.id); continue; }
    if (drafted && row.op === "replace") {
      out = out.map((item) => (item.id === drafted.id ? { ...item, kind: row.kind, text: row.text, quote: row.quote, edited: undefined, ...(row.domainId ? { domainId: row.domainId } : {}), ...(row.parentReported ? { parentReported: true as const } : {}), round: row.round } : item));
      continue;
    }
    if (out.some((item) => item.kind === row.kind && item.op === row.op && same(readbackWords(item), row.text))) continue;
    out.push(row);
  }
  return out;
}

/** The items a request carries: what the child doc holds plus the profile-kind
 *  rows drafted so far (ids are the readback's own, so an answer can replace one). */
export function keptAndDrafted(profile: Partial<DescribeFields> | null, rows: readonly ReadbackItem[]): KeptDescribeItem[] {
  const drafted: KeptDescribeItem[] = rows
    .filter((row) => row.op === "add" && (PROFILE_KINDS as readonly string[]).includes(row.kind))
    .map((row) => ({ id: row.id, kind: row.kind as ProfileKind, words: readbackWords(row), ...(row.domainId ? { domainId: row.domainId } : {}), source: "describe" as const }));
  return [...keptItemsFromProfile(profile), ...drafted];
}

export type DescribeOutcome = "asking" | "ready" | "failed" | "crisis" | "empty";

export class DescribeSession {
  private state: DescribeSessionState = emptySession();
  private listeners = new Set<() => void>();
  /** Bumped by reset(): a reply from an abandoned request is dropped. */
  private generation = 0;
  constructor(public services: DescribeServices) {}
  snapshot = () => this.state;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private put(next: Partial<DescribeSessionState>) { this.state = { ...this.state, ...next }; this.listeners.forEach((fn) => fn()); }
  private now() { return this.services.now?.() ?? new Date(); }

  /** Back to an empty conversation (a new description, or the parent left). */
  reset() { this.generation++; this.state = emptySession(); this.listeners.forEach((fn) => fn()); }

  /** The follow-ups asked so far (not the opening). */
  private asked(): ThreadTurn[] { return this.state.thread.slice(1); }

  /** The turn after an answer: one open follow-up, or the readback. */
  private next(draft: DescribeDraft, round: number, items: ReadbackItem[], thread: ThreadTurn[]): DescribeOutcome {
    const question = typeof draft.nextQuestion === "string" ? draft.nextQuestion.trim() : "";
    const already = new Set(thread.map((turn) => normalize(turn.question)));
    if (question && thread.length - 1 < MAX_FOLLOW_UPS && !already.has(normalize(question))) {
      const turn: ThreadTurn = { id: `q${round + 1}`, question, status: "open", ...(draft.nextQuestionLang ? { lang: draft.nextQuestionLang } : {}), ...(draft.nextQuestionToken ? { ttsToken: draft.nextQuestionToken } : {}) };
      this.put({ status: "asking", items, thread: [...thread, turn], error: "" });
      return "asking";
    }
    this.put({ status: "ready", items, thread, error: "" });
    return "ready";
  }

  /** The opening answer. Resolves with the outcome so a caller can take its
   *  fallback path: "crisis" (no request was made), "failed" (model error or
   *  timeout — the caller keeps today's path, no retry loop), "empty"
   *  (nothing to play back and nothing to ask), "asking" (one follow-up is
   *  open) or "ready" (the readback). */
  async start(text: string, openingQuestion = ""): Promise<DescribeOutcome> {
    const words = text.trim().slice(0, DESCRIBE_TEXT_MAX);
    if (!words || this.state.status === "drafting" || this.state.status === "committing") return "empty";
    if (screenForImmediateEscalation({ message: words })) { this.put({ ...emptySession(), status: "failed", error: "crisis" }); return "crisis"; }
    const generation = ++this.generation;
    const opening: ThreadTurn = { id: "q0", question: openingQuestion, answer: words, status: "answered" };
    this.put({ ...emptySession(), status: "drafting", thread: [opening] });
    try {
      const draft = await this.services.draft({ text: words, askedQuestions: [], keptItems: keptItemsFromProfile(this.services.profile()) });
      if (generation !== this.generation) return "failed";
      const items = readbackRows(draft, 0);
      if (!items.length && !draft.nextQuestion) { this.put({ ...emptySession() }); return "empty"; }
      return this.next(draft, 0, items, [opening]);
    } catch (error) {
      if (generation !== this.generation) return "failed";
      const crisis = isEscalation(error);
      this.put({ ...emptySession(), status: "failed", error: crisis ? "crisis" : "model" });
      return crisis ? "crisis" : "failed";
    }
  }

  /** The open follow-up's answer: extraction on that answer only, with the
   *  question it answers and every item so far; then the next question or
   *  the readback. A failure keeps the question open (the parent can retry,
   *  skip or finish) — the items so far are never lost. */
  async answer(text: string): Promise<DescribeOutcome> {
    const words = text.trim().slice(0, DESCRIBE_TEXT_MAX);
    const turn = this.state.thread.find((t) => t.status === "open");
    if (!words || !turn || this.state.status !== "asking") return this.state.status === "ready" ? "ready" : "empty";
    if (screenForImmediateEscalation({ message: words })) { this.put({ error: "crisis" }); return "crisis"; }
    const generation = this.generation;
    const round = this.state.thread.length - 1;
    const answered = this.state.thread.map((t) => (t.id === turn.id ? { ...t, answer: words, status: "answering" as const } : t));
    this.put({ status: "drafting", thread: answered, error: "" });
    try {
      const draft = await this.services.draft({
        text: words,
        question: turn.question,
        askedQuestions: this.asked().map((t) => t.question),
        keptItems: keptAndDrafted(this.services.profile(), this.state.items),
      });
      if (generation !== this.generation) return "failed";
      const items = mergeRows(this.state.items, readbackRows(draft, round, this.state.items));
      const thread = this.state.thread.map((t) => (t.id === turn.id ? { ...t, status: "answered" as const } : t));
      return this.next(draft, round, items, thread);
    } catch (error) {
      if (generation !== this.generation) return "failed";
      this.put({ status: "asking", thread: this.state.thread.map((t) => (t.id === turn.id ? { ...t, answer: undefined, status: "open" as const } : t)), error: isEscalation(error) ? "crisis" : "followUp" });
      return isEscalation(error) ? "crisis" : "failed";
    }
  }

  /** Skip the open question: no answer, so nothing more to ask — the readback. */
  skip() {
    if (this.state.status !== "asking") return;
    this.put({ status: "ready", thread: this.state.thread.map((t) => (t.status === "open" ? { ...t, status: "skipped" as const } : t)), error: "" });
  }
  /** "Done" at any point: straight to the readback. */
  done() { this.skip(); }

  toggle(itemId: string) { if (this.state.status === "ready") this.put({ items: this.state.items.map((i) => (i.id === itemId ? { ...i, keep: !i.keep } : i)) }); }
  edit(itemId: string, words: string) {
    if (this.state.status !== "ready") return;
    const clipped = words.slice(0, DESCRIBE_ITEM_MAX);
    this.put({ items: this.state.items.map((i) => (i.id === itemId ? { ...i, edited: clipped } : i)) });
  }
  /** Remove a row from the readback (it is never written). */
  remove(itemId: string) { if (this.state.status === "ready") this.put({ items: this.state.items.filter((i) => i.id !== itemId) }); }
  /** "Not this" on a milestone match: keep the words as a note instead. */
  declineMilestone(itemId: string) { if (this.state.status === "ready") this.put({ items: this.state.items.map((i) => (i.id === itemId ? { ...i, milestoneDeclined: true } : i)) }); }

  /** The plan "Keep these" would write right now (for the button's count). */
  preview(): DescribeCommitPlan {
    return planDescribeCommit(this.services.profile(), this.state.items, this.now());
  }

  /** "Keep these": the ONE write. Nothing reaches the child doc before it. */
  async keep(): Promise<boolean> {
    if (this.state.status !== "ready") return false;
    const plan = this.preview();
    if (!plan.kept) return false;
    const generation = this.generation;
    this.put({ status: "committing", error: "" });
    try {
      const receipt = await this.services.commit(plan);
      if (generation !== this.generation) return false;
      this.put({ status: "kept", receipt, undoUntil: this.now().getTime() + DESCRIBE_UNDO_MS });
      return true;
    } catch {
      if (generation !== this.generation) return false;
      this.put({ status: "ready", error: "keepFailed" });
      return false;
    }
  }

  /** Undo the whole readback within the window; per item afterwards is the
   *  kept list's own Remove. */
  async undo(): Promise<boolean> {
    const receipt = this.state.receipt;
    if (this.state.status !== "kept" || !receipt || this.now().getTime() > this.state.undoUntil) return false;
    this.put({ status: "committing" });
    try {
      await this.services.undo(receipt);
      this.put({ status: "ready", receipt: null, undoUntil: 0 });
      return true;
    } catch {
      this.put({ status: "kept", error: "keepFailed" });
      return false;
    }
  }
}
