/**
 * CMP/SEC: PII redaction before model calls (WAF backlog P0).
 *
 * The child's name (and incidental contact PII typed by the parent) must never
 * leave the trust boundary toward the LLM. Every AI endpoint builds its prompt
 * normally, then passes it through `redact()` at the model-call seam; model
 * output is passed through `restore()` / `restoreDeep()` before it reaches the
 * client or any store, so the product still reads fully personalized.
 *
 * The model is told the hero is called [Child] and asked to use that token
 * verbatim — substitution back to the real name is exact and lossless.
 */

export const CHILD_ALIAS = "[Child]";

/** Matches the alias case-insensitively and tolerant of model spacing drift. */
const ALIAS_RESTORE = /\[\s*child\s*\]/gi;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Conservative phone matcher: international/long digit runs with separators,
// 9+ digits total, so ages, durations, and counts are never touched.
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/g;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const countDigits = (s: string) => (s.match(/\d/g) || []).length;

export type RedactionContext = {
  /** Scrub PII from text that is about to be sent to a model. */
  redact: (text: string) => string;
  /** Put the child's real name back into model output text. */
  restore: (text: string) => string;
  /** Recursively restore every string field of a parsed model response. */
  restoreDeep: <T>(value: T) => T;
  /** Incremental restorer for token streams (handles aliases split across chunks). */
  createStreamRestorer: () => { push: (chunk: string) => string; flush: () => string };
  childName: string | null;
};

export const createRedaction = (childName?: string | null): RedactionContext => {
  const name = (childName || "").trim();
  // Single-character "names" would shred ordinary words; skip them.
  const nameRe = name.length >= 2 ? new RegExp(`\\b${escapeRegExp(name)}\\b`, "gi") : null;

  const redact = (text: string) => {
    if (!text) return text;
    let out = text;
    if (nameRe) out = out.replace(nameRe, CHILD_ALIAS);
    out = out.replace(EMAIL, "[email]");
    out = out.replace(PHONE, (m) => (countDigits(m) >= 9 ? "[phone]" : m));
    return out;
  };

  const restore = (text: string) => {
    if (!text || !name) return text;
    return text.replace(ALIAS_RESTORE, name);
  };

  const restoreDeep = <T,>(value: T): T => {
    if (typeof value === "string") return restore(value) as unknown as T;
    if (Array.isArray(value)) return value.map((v) => restoreDeep(v)) as unknown as T;
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = restoreDeep(v);
      return out as unknown as T;
    }
    return value;
  };

  // For SSE token streams: hold back a tail as long as the alias so a token like
  // "[Chi" + "ld]" split across chunks is still restored before it is emitted.
  const createStreamRestorer = () => {
    let carry = "";
    const HOLD = CHILD_ALIAS.length;
    return {
      push(chunk: string) {
        const text = carry + (chunk || "");
        const restored = restore(text);
        // Only hold back if the tail could be the start of an alias.
        const tail = restored.slice(-HOLD);
        const openBracket = tail.lastIndexOf("[");
        if (openBracket !== -1 && !tail.slice(openBracket).includes("]")) {
          carry = restored.slice(restored.length - (HOLD - openBracket));
          return restored.slice(0, restored.length - (HOLD - openBracket));
        }
        carry = "";
        return restored;
      },
      flush() {
        const rest = restore(carry);
        carry = "";
        return rest;
      },
    };
  };

  return { redact, restore, restoreDeep, createStreamRestorer, childName: name || null };
};

/**
 * Directive appended to redacted prompts so the model keeps the alias verbatim
 * (it is restored server-side after generation).
 */
export const REDACTION_DIRECTIVE =
  `\nPRIVACY: The child is referred to as ${CHILD_ALIAS}. Use the token ${CHILD_ALIAS} verbatim wherever the child's name belongs — never invent a name.`;
