/**
 * Proof assets — B-GAME-07c: the owner's proof art, served from a LOCAL-ONLY
 * folder of the sandbox build.
 *
 *   app/public/_proof/hero/sheet.json   a HeroSheet (heroSheet.ts); sprite urls
 *                                       relative to that folder
 *   app/public/_proof/scene/art.json    a Partial<SneakArt> (sneakArt.ts); urls
 *                                       relative to that folder
 *
 * `app/public/_proof/` holds the likeness of the owner's son: it is in the
 * checkout's `.git/info/exclude` and a guard test fails if any file under it
 * is ever tracked. Read only while the game's flag is on; tried BEFORE the
 * local-storage keys and the placeholders. Absent files = today's behaviour.
 * Same-origin files (and data urls) only, so a canvas that draws them is
 * never tainted.
 */

export const PROOF_HERO_SHEET_URL = "/_proof/hero/sheet.json";
export const PROOF_SCENE_ART_URL = "/_proof/scene/art.json";

type JsonFetcher = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Resolve a url found inside a JSON file against that file's folder.
 *  data: / http(s): / absolute paths are kept; anything else with a scheme is
 *  returned as-is (the parsers reject it); "../" cannot climb above the root. */
export function resolveAgainst(url: string, jsonUrl: string): string {
  if (!url || url.startsWith("/") || SCHEME.test(url)) return url;
  const folder = jsonUrl.slice(0, jsonUrl.lastIndexOf("/") + 1);
  const parts: string[] = [];
  for (const seg of (folder + url).split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== "." && seg !== "") parts.push(seg);
  }
  return "/" + parts.join("/");
}

/** Deep-copy `raw`, resolving every `url` string field (and the art plate's
 *  orientation strings) against `jsonUrl`. */
export function resolveUrls(raw: unknown, jsonUrl: string): unknown {
  if (Array.isArray(raw)) return raw.map((v) => resolveUrls(v, jsonUrl));
  if (!raw || typeof raw !== "object") return raw;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (k === "url" && typeof v === "string") out[k] = resolveAgainst(v, jsonUrl);
    else if (k === "plate" && v && typeof v === "object" && !Array.isArray(v)) {
      const plate: Record<string, unknown> = {};
      for (const [o, u] of Object.entries(v as Record<string, unknown>)) plate[o] = typeof u === "string" ? resolveAgainst(u, jsonUrl) : u;
      out[k] = plate;
    } else out[k] = resolveUrls(v, jsonUrl);
  }
  return out;
}

/** Fetch a proof JSON (urls resolved), or null when absent / unreadable. */
export async function fetchProofJson(url: string, fetcher?: JsonFetcher): Promise<unknown | null> {
  const f: JsonFetcher | null = fetcher ?? (typeof fetch === "function" ? (u) => fetch(u, { cache: "no-cache" }) : null);
  if (!f) return null;
  try {
    const res = await f(url);
    if (!res.ok) return null;
    return resolveUrls(await res.json(), url);
  } catch {
    return null;
  }
}

/** True for a url a canvas can draw without being tainted: a data url or a
 *  same-origin path (relative, or absolute on this origin). */
export function sameOriginOrData(url: string): boolean {
  if (url.startsWith("data:")) return true;
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    const origin = typeof location !== "undefined" ? location.origin : null;
    return !!origin && new URL(url, origin).origin === origin;
  } catch {
    return false;
  }
}

/** Decode images before the first frame (bounded wait; failures ignored). */
export async function preloadImages(urls: readonly string[], timeoutMs = 2500): Promise<void> {
  if (typeof Image === "undefined" || urls.length === 0) return;
  const one = (u: string) =>
    new Promise<void>((resolve) => {
      try {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = u;
        if (typeof img.decode === "function") img.decode().then(() => resolve(), () => resolve());
      } catch {
        resolve();
      }
    });
  await Promise.race([Promise.all(urls.map(one)).then(() => undefined), new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}
