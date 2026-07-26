/**
 * ASK-1 + AIR-1 (ask-cadence, 2026-07-25 AI-excellence Wave 2) — incremental
 * extraction of ONE top-level string field from a *streaming* JSON document.
 *
 * The coach contract streams from the model as raw JSON text (tool-call
 * partial_json chunks on Claude, JSON-mode text chunks on Gemini). The
 * parent-facing prose lives in the contract's leading `text` field; this
 * extractor tails that field's value as it generates so /chat can release it
 * as screened sentence deltas — WITHOUT waiting for (or trusting) a complete,
 * parseable document. The full document is still parsed + zod-validated +
 * screened at `done` exactly as before; this module feeds only the live
 * preview stream.
 *
 * Design constraints:
 *  - append-only output: every `push()` returns ONLY newly available,
 *    fully-unescaped characters of the target field's value. A partial escape
 *    sequence (`\`, `\u12`) at a chunk boundary is held back until complete,
 *    so no caller ever sees a half-decoded escape.
 *  - depth-aware: only a `"text"` KEY of the TOP-LEVEL object matches; a
 *    `text` key inside nested objects/arrays (or the string VALUE "text")
 *    never triggers capture.
 *  - single-shot: after the field's closing quote, capture is finished for
 *    the document's lifetime (`finished()` turns true, further pushes return "").
 *  - never throws on malformed input — it simply stops finding the field; the
 *    authoritative JSON.parse at `done` owns error handling.
 */

const ESCAPE_MAP: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
};

export type JsonTextFieldExtractor = {
  /** Feed the next raw JSON chunk; returns newly captured (unescaped) field text. */
  push: (chunk: string) => string;
  /** True once the target field's closing quote has been consumed. */
  finished: () => boolean;
};

export const createJsonTextFieldExtractor = (field = "text"): JsonTextFieldExtractor => {
  // Structural state.
  let depth = 0; // object/array nesting depth; the root object is depth 1
  const stack: ("obj" | "arr")[] = [];
  let expectKey = false; // inside an object, the next string is a KEY
  let pendingKey: string | null = null; // key whose ':' we've seen — next value belongs to it

  // String state.
  let inString = false;
  let stringIsKey = false;
  let keyBuf = "";
  let capturing = false; // inside the target field's string value
  let done = false;

  // Escape state (spans chunk boundaries).
  let esc = false; // previous char was '\'
  let unicode: string | null = null; // accumulating the 4 hex digits of \uXXXX

  const push = (chunk: string): string => {
    if (done || !chunk) return "";
    let out = "";

    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];

      if (inString) {
        if (unicode !== null) {
          unicode += ch;
          if (unicode.length === 4) {
            const code = Number.parseInt(unicode, 16);
            const decoded = Number.isNaN(code) ? "" : String.fromCharCode(code);
            if (capturing) out += decoded;
            else if (stringIsKey) keyBuf += decoded;
            unicode = null;
          }
          continue;
        }
        if (esc) {
          esc = false;
          if (ch === "u") {
            unicode = "";
            continue;
          }
          const decoded = ESCAPE_MAP[ch] ?? ch;
          if (capturing) out += decoded;
          else if (stringIsKey) keyBuf += decoded;
          continue;
        }
        if (ch === "\\") {
          esc = true;
          continue;
        }
        if (ch === '"') {
          inString = false;
          if (capturing) {
            capturing = false;
            done = true;
            return out; // single-shot: the field is complete
          }
          if (stringIsKey) {
            pendingKey = keyBuf;
            stringIsKey = false;
          }
          continue;
        }
        if (capturing) out += ch;
        else if (stringIsKey) keyBuf += ch;
        continue;
      }

      // Outside any string.
      if (ch === '"') {
        inString = true;
        if (expectKey && stack[stack.length - 1] === "obj") {
          stringIsKey = true;
          keyBuf = "";
          expectKey = false;
        } else if (pendingKey === field && depth === 1) {
          // The value string of the top-level target key — start capturing.
          capturing = true;
          pendingKey = null;
        } else {
          pendingKey = null;
        }
        continue;
      }
      if (ch === "{") {
        depth += 1;
        stack.push("obj");
        expectKey = true;
        pendingKey = null;
        continue;
      }
      if (ch === "[") {
        depth += 1;
        stack.push("arr");
        pendingKey = null;
        continue;
      }
      if (ch === "}" || ch === "]") {
        depth -= 1;
        stack.pop();
        expectKey = false;
        pendingKey = null;
        continue;
      }
      if (ch === ",") {
        if (stack[stack.length - 1] === "obj") expectKey = true;
        pendingKey = null;
        continue;
      }
      if (ch === ":") {
        // pendingKey (set when the key string closed) now owns the next value.
        continue;
      }
      // Whitespace or a non-string scalar (number/true/false/null): a scalar
      // value consumes the pending key.
      if (!/\s/.test(ch)) pendingKey = null;
    }

    return out;
  };

  return { push, finished: () => done };
};
