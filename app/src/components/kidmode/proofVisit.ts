/**
 * Proof visit — B-GAME-07d (g): ONE step for the owner to open the proof game
 * on his own machine.
 *
 *   http://localhost:<port>/?proof=sneak[&lang=he|en][&age=3..12]
 *
 * ONLY when the app is served from `localhost` or `127.0.0.1` (exact host
 * names), a visit with `proof=sneak`:
 *   - sets the device flag `arbor.flags.sneakFreeze` = "1",
 *   - opens Kid Mode directly in the game (`arbor.kidmode.active` =
 *     { open, view: "arcade", worldId: "sneak" }) for the child in the app
 *     (the sandbox's seeded child),
 *   - `lang`: sets the app language (`arbor.uiLang`), exactly as choosing it
 *     in Settings would — the app keeps a language choice;
 *   - `age`: the game starts at that age's track and level for this visit
 *     only (nothing is written to the child's profile or the device level).
 * On any other host the parameter does nothing; without it nothing changes.
 *
 * Imported FIRST by main.tsx: it runs before the Kid Mode gate and the
 * language provider read storage, so the first paint is already the game.
 */

export const PROOF_HOSTS: readonly string[] = ["localhost", "127.0.0.1"];

export interface ProofVisit {
  game: "sneak";
  lang: "en" | "he" | null;
  age: number | null;
}

/** True only for the exact local development host names. */
export function isProofHost(hostname: string | null | undefined): boolean {
  return typeof hostname === "string" && PROOF_HOSTS.includes(hostname.toLowerCase());
}

/** The proof visit a location asks for, or null (wrong host, no parameter). */
export function readProofVisit(loc: { hostname: string; search: string } | null | undefined): ProofVisit | null {
  if (!loc || !isProofHost(loc.hostname)) return null;
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(loc.search || "");
  } catch {
    return null;
  }
  if (q.get("proof") !== "sneak") return null;
  const l = q.get("lang");
  const lang = l === "he" || l === "en" ? l : null;
  const a = Number(q.get("age"));
  const age = q.has("age") && Number.isInteger(a) && a >= 3 && a <= 12 ? a : null;
  return { game: "sneak", lang, age };
}

/** Write the visit's device state (flag, Kid Mode in the game, language). */
export function applyProofVisit(v: ProofVisit, storage: Pick<Storage, "setItem">): void {
  storage.setItem("arbor.flags.sneakFreeze", "1");
  storage.setItem("arbor.kidmode.active", JSON.stringify({ open: true, view: "arcade", worldId: "sneak" }));
  if (v.lang) {
    storage.setItem("arbor.uiLang", v.lang);
    storage.setItem("arbor.aiLang", v.lang);
  }
}

let current: ProofVisit | null = null;

/** This page load's proof visit (null for everyone without the parameter). */
export function proofVisit(): ProofVisit | null {
  return current;
}

/** Run once at module load (browser only). Exported for tests. */
export function initProofVisit(loc: { hostname: string; search: string } | null | undefined, storage: Pick<Storage, "setItem"> | null | undefined): ProofVisit | null {
  current = null;
  const v = readProofVisit(loc);
  if (!v || !storage) return null;
  try {
    applyProofVisit(v, storage);
    current = v;
  } catch {
    /* storage unavailable: the app opens as usual */
  }
  return current;
}

try {
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") initProofVisit(window.location, localStorage);
} catch {
  /* never blocks the app */
}
