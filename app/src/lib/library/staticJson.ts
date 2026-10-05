/**
 * lib/library/staticJson — B-BOOK-08: the ONE network read in the book
 * library: a static JSON manifest from the app's own public folder (a hero
 * sheet's manifest.json). It refuses anything that is not a same-origin,
 * root-relative `.json` path under /_dev/, /visuals/ or /audio/ — so it can
 * never reach an API, a model or another host (noModelCalls.test allows
 * fetch only in this file, and tests this rule). Failure = null, never throws.
 */
// dotted file names are allowed (`p9.cues.json`, a narration cue sidecar)
const ALLOWED = /^\/(?:_dev|visuals|audio)\/[A-Za-z0-9_\-/]+(?:\.[A-Za-z0-9_-]+)*\.json$/;

export function isStaticJsonPath(path: string): boolean {
  return ALLOWED.test(path) && !path.includes("..") && !path.includes("//");
}

export async function loadStaticJson(path: string): Promise<unknown | null> {
  if (!isStaticJsonPath(path) || typeof fetch === "undefined") return null;
  try {
    const res = await fetch(path, { credentials: "same-origin", cache: "no-cache" });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) return null;
    return await res.json();
  } catch {
    return null;
  }
}
