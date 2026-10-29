/**
 * Wave 4 (B-ASKJB-49 follow-up) — a 409 that is not the crisis screen never
 * becomes the crisis card.
 *
 * The book and plan routes answer 409 with their own code (`hero_missing`: the
 * child has no hero yet), and so does /live/token (`live_renewal_invalid`),
 * while request() turned every 409 into EscalationRequiredError. Now such a
 * code reaches its caller as ApiError(code, 409); the crisis 409 contract (no
 * code, `escalationCategory`) still raises EscalationRequiredError, and so does
 * any 409 the client cannot place. A scan of the server keeps
 * NON_CRISIS_409_CODES equal to the non-crisis codes the server really answers.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./firebase", () => ({ auth: null, firebaseEnabled: false }));

import { api, ApiError, EscalationRequiredError, NON_CRISIS_409_CODES, nonCrisis409Code } from "./api";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function serverFiles(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) serverFiles(p, acc);
    else if (/\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name)) acc.push(p);
  }
  return acc;
}
/** `NAME.key` → value for every object of string constants in the sources
 *  (heroSheetContract.ts HERO_POSE_REFUSALS: refuse(409, HERO_POSE_REFUSALS.missing, …)). */
function constants(sources: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const src of sources) {
    for (const m of src.matchAll(/\bconst (\w+)\s*=\s*\{([^{}]*)\}/g)) {
      for (const pair of m[2].matchAll(/\b(\w+):\s*["']([a-z_]+)["']/g)) out.set(`${m[1]}.${pair[1]}`, pair[2]);
    }
  }
  return out;
}
/** Every code a server route answers with a 409 that carries no crisis category.
 *  Round 2 (superset): a refuse helper with or without `res`, a code passed as a
 *  constant (`HERO_POSE_REFUSALS.anchor`), and a status chosen by the code
 *  (`code === "activity_changed" ? 409`, sent in `error`). A code the scan cannot
 *  resolve is reported as `unresolved:<expression>`, so it fails the equality. */
function server409Codes(sources: string[], known = constants(sources)): string[] {
  const codes = new Set<string>();
  const resolve = (expression: string) => {
    const literal = /^["']([a-z_]+)["']$/.exec(expression);
    return literal ? literal[1] : known.get(expression) ?? `unresolved:${expression}`;
  };
  for (const src of sources) {
    for (const m of src.matchAll(/\b\w+\(\s*(?:res\s*,\s*)?409\s*,\s*([^,]+?)\s*,/g)) codes.add(resolve(m[1]));
    for (const m of src.matchAll(/\.status\(\s*409\s*\)\.json\(\{([^}]*)\}/g)) {
      const code = /\bcode:\s*["']([a-z_]+)["']/.exec(m[1]);
      if (code && !/escalationCategory/.test(m[1])) codes.add(code[1]);
    }
    for (const m of src.matchAll(/\b\w+\s*===\s*["']([a-z_]+)["']\s*\?\s*409\b/g)) codes.add(m[1]);
  }
  return [...codes].sort();
}
const LIB_SOURCES = serverFiles(path.join(SRC, "lib")).map((f) => readFileSync(f, "utf8"));
const SOURCES = [...serverFiles(path.join(SRC, "server")), ...serverFiles(path.join(SRC, "routes"))].map((f) => readFileSync(f, "utf8"));

function answer(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } })));
}
afterEach(() => { vi.unstubAllGlobals(); });

describe("a non-crisis 409 reaches its caller as its own error", () => {
  it("hero_missing is ApiError(hero_missing, 409), never EscalationRequiredError", async () => {
    answer(409, { error: "Create the hero first", code: "hero_missing" });
    const error = await api.listShares().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(EscalationRequiredError);
    expect(error.status).toBe(409);
    expect(error.message).toBe("hero_missing");
  });

  it.each([...NON_CRISIS_409_CODES])("%s is its own error", async (code) => {
    answer(409, { error: "x", code });
    const error = await api.listShares().catch((e) => e);
    expect(error).not.toBeInstanceOf(EscalationRequiredError);
    expect(error.message).toBe(code);
  });

  it("the crisis 409 contract still raises EscalationRequiredError with its category", async () => {
    answer(409, { error: "Professional support recommended", details: "Category: self_harm.", escalationCategory: "self_harm" });
    const error = await api.listShares().catch((e) => e);
    expect(error).toBeInstanceOf(EscalationRequiredError);
    expect(error.category).toBe("self_harm");
  });

  it.each([
    ["no code", { error: "Professional support recommended" }],
    ["an unknown code", { error: "x", code: "something_new" }],
    ["a known code beside a crisis category", { error: "x", code: "hero_missing", escalationCategory: "self_harm" }],
    ["a body that cannot be parsed", "<html>"],
  ] as const)("negative control: %s still escalates", async (_name, body) => {
    answer(409, body);
    expect(await api.listShares().catch((e) => e)).toBeInstanceOf(EscalationRequiredError);
  });

  it("nonCrisis409Code reads only an exact known code", () => {
    expect(nonCrisis409Code({ code: "hero_missing" })).toBe("hero_missing");
    expect(nonCrisis409Code({ code: "HERO_MISSING" })).toBeNull();
    expect(nonCrisis409Code(null)).toBeNull();
  });
});

describe("the set is exactly what the server answers", () => {
  it("every non-crisis 409 code in server/ and routes/ is in NON_CRISIS_409_CODES, and nothing else is", () => {
    const codes = server409Codes(SOURCES, constants([...SOURCES, ...LIB_SOURCES]));
    for (const code of ["hero_anchor_missing", "hero_book_anchor_missing", "activity_changed"]) expect(codes, code).toContain(code);
    expect(codes).toContain("hero_missing");
    expect(codes).toEqual([...NON_CRISIS_409_CODES].sort());
  });

  it("negative control: a new non-crisis 409 is found, and a crisis 409 is not", () => {
    expect(server409Codes(['return refuse(res, 409, "book_new_state", "x");'])).toEqual(["book_new_state"]);
    expect(server409Codes(['res.status(409).json({ available: false, code: "new_state" });'])).toEqual(["new_state"]);
    expect(server409Codes(['res.status(409).json({ error: "Professional support recommended", escalationCategory: m.category });'])).toEqual([]);
  });

  it("round 2 probes: a constant code, a refuse without res, a status chosen by the code, and an unresolvable code", () => {
    const consts = 'export const BOOK_REFUSALS = {\n  waiting: "book_waiting",\n  /** a doc comment */\n  gone: "book_gone",\n};';
    expect(server409Codes([consts, 'if (!x) return refuse(409, BOOK_REFUSALS.gone, "Gone");'])).toEqual(["book_gone"]);
    expect(server409Codes(['return refuse(409, "plain_state", "x");'])).toEqual(["plain_state"]);
    expect(server409Codes(['res.status(code === "access_ended" ? 403 : code === "item_changed" ? 409 : 503).json({ error: code });'])).toEqual(["item_changed"]);
    expect(server409Codes(['return refuse(409, makeCode(x), "x");'])).toEqual(["unresolved:makeCode(x)"]);
    expect(server409Codes(['return refuse(409, OTHER.unknown, "x");'])).toEqual(["unresolved:OTHER.unknown"]);
  });

  it("a known code sent in `error` (no `code` field) is its own error too; a crisis `error` still escalates", async () => {
    answer(409, { error: "activity_changed" });
    const error = await api.listShares().catch((e) => e);
    expect(error).not.toBeInstanceOf(EscalationRequiredError);
    expect(error.message).toBe("activity_changed");
    answer(409, { error: "Professional support recommended" });
    expect(await api.listShares().catch((e) => e)).toBeInstanceOf(EscalationRequiredError);
  });
});
