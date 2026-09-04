/* ════════════════════════════════════════════════════════════════════════════
   captureProposals — AI-04: universal capture for TYPED coach turns.

   THE GAP THIS CLOSES
   ───────────────────
   A live VOICE turn already produces something keepable: CoachTab calls
   `deriveConversationProposals(transcript)`, ConversationProposalTray shows the
   draft rows, and "Save" runs the ONE durable-write seam
   (ArborContext.commitConversationProposal) — an explicit, atomic, auditable,
   reversible write that stamps `conversationProposalId` + `sourceExcerpt` on
   the behaviour log and files a full ConversationChangeRecord in the
   registered `conversationChanges` subcollection.

   A TYPED turn produced NOTHING keepable. The parent read a structured answer
   — today's steps, what to watch for, words to say — and the only way to keep
   any of it was to retype it into the log form. That is the exact opposite of
   the north star (structured AI output + ONE-TAP SAVE).

   WHY THIS IS DERIVED, NOT ASKED FOR
   ──────────────────────────────────
   The typed answer is ALREADY structured: `CoachContract` carries `todayPlan`,
   `observe` and `parentScript` as discrete, server-screened strings. So a
   proposal here is a QUOTE of what the parent just read — no second model
   call, no second safety surface, no cost, and fully deterministic (which is
   why every rule in this file is unit-testable in the node suite).

   CLINICAL FIREWALL — WHAT MAY NEVER BECOME A KEEPABLE ROW
   ────────────────────────────────────────────────────────
   `KEEPABLE_CONTRACT_FIELDS` is an ALLOW-LIST, and `NEVER_KEEPABLE_FIELDS`
   names the fields that are deliberately excluded and why:
     · riskLevel               — a verdict primitive; banned from parent rows.
     · domains                 — an area pointer, i.e. a "weakest area" read.
     · nonDiagnosticHypotheses — hypothesis language; a hypothesis filed as a
                                 kept moment reads later as a finding.
     · escalateIf              — safety routing, not a keepsake.
     · avoid                   — negative framing about the child's handling.
   A kept row is a thing the PARENT chose to keep, never evidence about the
   child.

   PROVENANCE
   ──────────
   Every proposal carries the prompt behind the answer (`TYPED_TURN_PROMPT`)
   and the parent's own question as `sourceExcerpt`. The pin is guarded against
   src/ai/prompts.ts by captureProposals.test.ts, so a server prompt bump
   cannot silently leave kept rows attributed to a prompt that no longer
   exists.

   AI-04's THIRD CLAUSE — NOW CLOSED
   ─────────────────────────────────
   "Flip the contract to `consented`" is done, and it is now a true statement.
   The gate had two halves:
     (a) "Keep this" writes a Journal row with provenance — this module and
         ArborContext.commitConversationProposal ship it;
     (b) coach turns are private by default — `signalTimeline.ts` no longer
         has an Ask-thread ingest source at all (the key is gone from
         TimelineSources, not merely left unread), and `hooks/useTimeline`
         no longer hands it that list.
   With (b) shipped, `surfaceContract.ts` declares the coach surface's
   `threadWrite` as "consented". The guard in captureProposals.test.ts still
   stands, pointing the other way now: it fails loudly if that declaration
   says "consented" while an unconditional ingest loop is reintroduced.
   Nothing was deleted to get there — the conversations subcollection is
   untouched, still on the GDPR export and erase sweeps, and the threads stay
   readable in the coach's own history.

   Pure, clock-injected, framework-free.
   ════════════════════════════════════════════════════════════════════════════ */
import type { ChatMessage } from "../context/ArborContext";
import type { ConversationProposal } from "./conversationProposals";
import type { CoachContract } from "../types";

/**
 * The prompt behind every typed coach answer, pinned client-side.
 * `key` + `version` mirror src/ai/prompts.ts PROMPT_VERSIONS.coach_chat; the
 * guard test fails the build when they drift, because a kept row's provenance
 * must name the prompt that actually produced the sentence.
 */
export const TYPED_TURN_PROMPT = { key: "coach_chat", version: "1.2.0" } as const;

/** The structured contract fields a parent may keep. ALLOW-LIST — see header. */
export const KEEPABLE_CONTRACT_FIELDS = ["todayPlan", "parentScript", "observe"] as const;
export type KeepableField = (typeof KEEPABLE_CONTRACT_FIELDS)[number];

/** Deliberately excluded, with the reason in the header. Asserted by test. */
export const NEVER_KEEPABLE_FIELDS = [
  "riskLevel", "domains", "nonDiagnosticHypotheses", "escalateIf", "avoid",
] as const;

/** Flooding a tray is not one-tap save — at most this many rows per answer. */
export const MAX_TYPED_PROPOSALS = 4;

/** A draft the parent can keep, plus the field it was quoted from. */
export interface CaptureProposal {
  /** Handed verbatim to ArborContext.commitConversationProposal. */
  proposal: ConversationProposal;
  /** Which structured part of the answer this line is a quote of. */
  field: KeepableField;
}

export interface TypedProposalContext {
  childId: string;
  language: "en" | "he";
  /** Injected clock — no Date.now() in this module. */
  now: string;
}

const clean = (value: unknown, max: number): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

/**
 * FNV-1a over the turn text. Deterministic and dependency-free (node:crypto is
 * server-only), so the same exchange always yields the same turn id and a
 * re-render can never mint a duplicate proposal set.
 */
export function turnFingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * A settled TYPED answer, identified POSITIVELY.
 *
 * `contract` and `council` are written by settleChatTurn (lib/chatStream) and
 * by nothing else; settleVoiceTurn (lib/voiceTranscript) strips its own
 * `voiceLive` flag and never sets either. So their presence proves the turn
 * came through the typed Ask path — which matters, because the voice path
 * ALREADY derives its own proposals in CoachTab and a second tray over the
 * same turn would offer the parent the same line twice.
 *
 * Conservative on purpose: a typed answer that arrived with no contract simply
 * offers nothing. Missing a keepable line is a calm failure; double-offering a
 * voice line is not.
 */
export function isTypedAnswer(message: ChatMessage | undefined): boolean {
  if (!message || message.sender !== "ai") return false;
  if (message.chatLive || message.voiceLive) return false;
  return Boolean(message.contract) || Boolean(message.council?.length);
}

/** The lines a contract offers, in the order they are worth keeping. */
export function keepableLines(contract: CoachContract | undefined): { field: KeepableField; text: string }[] {
  if (!contract) return [];
  const out: { field: KeepableField; text: string }[] = [];
  for (const step of contract.todayPlan ?? []) {
    const text = clean(step, 600);
    if (text) out.push({ field: "todayPlan", text });
  }
  const script = clean(contract.parentScript, 600);
  if (script) out.push({ field: "parentScript", text: script });
  for (const line of contract.observe ?? []) {
    const text = clean(line, 600);
    if (text) out.push({ field: "observe", text });
  }
  return out;
}

/**
 * Build the tray for the MOST RECENT typed answer in the thread.
 *
 * Returns [] for a voice turn, a live turn, an answer with no contract, or a
 * thread with no AI turn at all — every one of which is a normal state, not an
 * error. The paired user turn supplies `sourceExcerpt`: the parent's own
 * question, which is what makes a kept row explainable a year later.
 */
export function buildTypedCaptureProposals(
  messages: readonly ChatMessage[],
  ctx: TypedProposalContext,
): CaptureProposal[] {
  if (!ctx.childId) return [];
  let answerIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender !== "ai") continue;
    answerIdx = isTypedAnswer(messages[i]) ? i : -1;
    break;
  }
  if (answerIdx < 0) return [];

  const answer = messages[answerIdx];
  const lines = keepableLines(answer.contract).slice(0, MAX_TYPED_PROPOSALS);
  if (!lines.length) return [];

  // The parent's question — what they asked, not what Arbor said back.
  let question = "";
  for (let i = answerIdx - 1; i >= 0; i--) {
    if (messages[i].sender === "user") {
      question = clean(messages[i].displayText || messages[i].text, 400);
      break;
    }
  }
  // No question in the thread (a seeded opening turn): fall back to the
  // answer's own opening sentence so the excerpt is never empty — an empty
  // excerpt is rejected by normalizeConversationProposals AND would leave a
  // saved row with no origin, which is the defect this item exists to close.
  const sourceExcerpt = question || clean(answer.contract?.text || answer.text, 400) || "—";

  const turnId = `typed-${turnFingerprint(`${question}||${answer.text}`)}`;

  return lines.map((line, index) => ({
    field: line.field,
    proposal: {
      id: `${turnId}-${index}`,
      // The prompt behind the answer travels with the proposal: the shared
      // ConversationProposal shape has no promptVersion field of its own, so
      // the session id names it. captureProvenance.ts records it as structured
      // fields on the kept row.
      sessionId: `coach-typed:${TYPED_TURN_PROMPT.key}@${TYPED_TURN_PROMPT.version}`,
      turnId,
      childId: ctx.childId,
      // "journal" — a moment the parent kept, never an "observation" (which is
      // incident-shaped) and never a milestone (which is a record of the child).
      target: "journal",
      summary: line.text,
      sourceExcerpt,
      sourceLanguage: ctx.language,
      // 1 is honest here and means "clear": this is a verbatim quote of a
      // sentence the parent just read, not a guess at what was said.
      confidence: 1,
      status: "draft",
      createdAt: ctx.now,
    },
  }));
}
