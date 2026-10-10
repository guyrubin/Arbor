/**
 * B-SHELL-39 — the deterministic checks behind POST /api/describe-child.
 *
 * The model proposes; this module decides what a parent may be shown:
 *  - an item whose `quote` is not a span of what the parent said is DROPPED,
 *    so no invented fact survives (grounding is checked, not trusted);
 *  - every item's words pass `toParentWords` (plain parent words) and
 *    `findClinicalDiagnosisTerm`: a diagnosis term survives ONLY when the
 *    parent said it — the item then shows the parent's own quote, tagged
 *    `parentReported`; a term the model introduced drops the item;
 *  - a replace or remove may only name an item the parent already kept;
 *  - Focus is capped at 3 and preferences at 8;
 *  - a follow-up question that probes for a condition, a diagnosis or a test
 *    is dropped (questions are about what the parent raised, never diagnostic).
 * Pure and deterministic: no network, no storage.
 */
import { findClinicalDiagnosisTerm } from "../lib/clinicalScan.js";
import { toParentWords } from "./parentWordsScrub.js";
import { screenForConditionQuestion } from "../safety/conditionQuestion.js";
import { isDomainId } from "../lib/domains/registry.js";
import { validateMilestoneMatch } from "./milestoneMatch.js";
import type { MilestoneMatchCandidate } from "../ai/prompts.js";
import {
  DESCRIBE_ITEM_MAX,
  MAX_FOCUS_AREAS,
  MAX_FOLLOW_UPS,
  MAX_PARENT_PREFERENCES,
  PROFILE_KINDS,
  clipWords,
  isDescribeKind,
  type DescribeDraft,
  type DescribeDraftItem,
  type ProfileKind,
} from "../lib/describeChild.js";

/** The most kept items one request may carry (the prompt lists them). */
export const MAX_KEPT_ITEMS = 40;
/** The most raw items read from one model reply. */
const MAX_RAW_ITEMS = 24;
const FOLLOW_UP_MAX = 160;

export type KeptRef = { id: string; kind: ProfileKind; words: string };

/** The request's kept items, validated: ids are opaque short tokens, words
 *  are the parent's (≤ 160 characters), kinds are the five profile kinds. */
export function sanitizeKeptItems(raw: unknown): KeptRef[] {
  if (!Array.isArray(raw)) return [];
  const out: KeptRef[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (out.length >= MAX_KEPT_ITEMS) break;
    if (!entry || typeof entry !== "object") continue;
    const value = entry as Record<string, unknown>;
    const id = typeof value.id === "string" ? value.id.trim().slice(0, 64) : "";
    const words = typeof value.words === "string" ? value.words.trim().replace(/\s+/g, " ").slice(0, 160) : "";
    const kind = value.kind;
    if (!id || !/^[\w:.-]+$/.test(id) || seen.has(id) || !words) continue;
    if (typeof kind !== "string" || !(PROFILE_KINDS as readonly string[]).includes(kind)) continue;
    seen.add(id);
    out.push({ id, kind: kind as ProfileKind, words });
  }
  return out;
}

/**
 * The comparison form for grounding: Unicode NFC, Hebrew points dropped,
 * curly quotes and dashes straightened, whitespace collapsed, lower case. A
 * dictated "she’s" and a typed "she's" are the same span; a paraphrase is not.
 */
export function groundingForm(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[֑-ׇ]/g, "")
    .replace(/[‘’‛′׳`´]/g, "'")
    .replace(/[“”‟″״]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

/** A quote counts only as a real span (≥ 2 characters) of what the parent said. */
export function quoteIsGrounded(quote: string, parentText: string): boolean {
  const q = groundingForm(quote).replace(/^["'.,;:!?\s-]+|["'.,;:!?\s-]+$/g, "");
  return q.length >= 2 && groundingForm(parentText).includes(q);
}

/** A follow-up question may ask about what the parent raised, never probe for
 *  a condition, a diagnosis, a test or a symptom. */
export function followUpIsSafe(question: string): boolean {
  if (findClinicalDiagnosisTerm(question)) return false;
  if (screenForConditionQuestion(question)) return false;
  return !/\b(symptom|symptoms|tested|testing|evaluat\w*|assess\w*|screen\w*|specialist|therap\w*)\b/i.test(question)
    && !/(תסמינ|בדיק|הערכה|אבחו|אבחנ|טיפול|מומח)/.test(question);
}

type RawItem = Record<string, unknown>;

/**
 * The model's reply → what the parent may see. `parentText` is exactly what
 * the parent said (the route has already restored the child's name in the
 * model reply). `kept` is the request's sanitized kept list; `candidates` are
 * the server-built catalogue milestones (empty in onboarding).
 */
export function finalizeDescribeDraft(
  raw: unknown,
  ctx: { parentText: string; kept: readonly KeptRef[]; candidates: readonly MilestoneMatchCandidate[] },
): DescribeDraft {
  const reply = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawItems = Array.isArray(reply.items) ? (reply.items as unknown[]).slice(0, MAX_RAW_ITEMS) : [];
  const keptIds = new Set(ctx.kept.map((k) => k.id));
  const items: DescribeDraftItem[] = [];
  let focus = 0;
  let preferences = 0;
  rawItems.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const value = entry as RawItem;
    const kind = value.kind;
    if (!isDescribeKind(kind)) return;
    const quote = typeof value.quote === "string" ? value.quote.trim() : "";
    const modelText = typeof value.text === "string" ? value.text.trim() : "";
    // 1. Grounding: no quote in the parent's words, no item.
    if (!quote || !quoteIsGrounded(quote, ctx.parentText)) return;
    // 2. The operation may only act on an item the parent already kept.
    const rawOp = value.op;
    const itemId = typeof value.itemId === "string" ? value.itemId.trim() : "";
    let op: DescribeDraftItem["op"] = "add";
    if ((rawOp === "replace" || rawOp === "remove") && itemId && keptIds.has(itemId)) op = rawOp;
    else if (rawOp === "remove") return;
    // 3. Plain parent words; a diagnosis term only in the parent's own quote.
    let text: string;
    let parentReported = false;
    if (findClinicalDiagnosisTerm(modelText) || findClinicalDiagnosisTerm(quote)) {
      if (!findClinicalDiagnosisTerm(quote)) return;
      text = clipWords(quote, DESCRIBE_ITEM_MAX);
      parentReported = true;
    } else {
      text = clipWords(toParentWords(modelText), DESCRIBE_ITEM_MAX);
    }
    if (!text) return;
    // 4. Caps.
    if (kind === "focus" && op !== "remove") { if (focus >= MAX_FOCUS_AREAS) return; focus++; }
    if (kind === "preference" && op !== "remove") { if (preferences >= MAX_PARENT_PREFERENCES) return; preferences++; }
    // 5. Duplicates in one reply.
    if (items.some((item) => item.kind === kind && groundingForm(item.text) === groundingForm(text) && item.op === op)) return;
    const domainId = typeof value.domainId === "string" && isDomainId(value.domainId) ? value.domainId : undefined;
    // 6. A milestone id only from the server's list, only when the words show it.
    let milestone: Pick<DescribeDraftItem, "milestoneId" | "milestoneTitle"> = {};
    if (kind === "milestone" && typeof value.milestoneId === "string" && ctx.candidates.length) {
      const match = validateMilestoneMatch({ milestoneId: value.milestoneId, confidence: "high" }, ctx.candidates, quote);
      const hit = match?.milestoneId ? ctx.candidates.find((c) => c.id === match.milestoneId) : undefined;
      if (hit) milestone = { milestoneId: hit.id, milestoneTitle: hit.title };
    }
    items.push({
      id: `i${index}`,
      kind,
      text,
      quote: clipWords(quote, 300),
      op,
      ...(op !== "add" ? { itemId } : {}),
      ...(domainId ? { domainId } : {}),
      ...(parentReported ? { parentReported: true as const } : {}),
      ...milestone,
    });
  });
  const followUps: string[] = [];
  for (const entry of Array.isArray(reply.followUps) ? (reply.followUps as unknown[]) : []) {
    if (followUps.length >= MAX_FOLLOW_UPS) break;
    if (typeof entry !== "string") continue;
    const question = clipWords(entry, FOLLOW_UP_MAX);
    if (!question || !followUpIsSafe(question)) continue;
    const plain = toParentWords(question);
    if (!plain || followUps.some((q) => groundingForm(q) === groundingForm(plain))) continue;
    followUps.push(plain);
  }
  return { items, followUps };
}

/** The model-authored text the output screen reads. A parent-reported item
 *  shows the parent's own quote — their words, not model output — and quotes
 *  are spans of the parent's input, so neither is screened as model output. */
export function describeScreenable(draft: DescribeDraft): { items: string[]; followUps: string[] } {
  return { items: draft.items.filter((item) => !item.parentReported).map((item) => item.text), followUps: draft.followUps };
}
