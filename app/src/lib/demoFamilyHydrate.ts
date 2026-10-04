import { CHILD_SUBCOLLECTIONS } from "./childData";

/**
 * B-DIST-01 — sandbox only. When `npm run seed:demo -- --apply` has written a
 * demo-family bundle, the sandbox server serves it at /sandbox/demo-family.json
 * (server/demoFamilyRoute.ts — not mounted in prod). Before the first render,
 * main.tsx calls this in local-sandbox mode (no Firebase): the invented family
 * is written into the SAME keys the app reads — `arbor.<collection>.<childId>`
 * (useChildCollection's sandbox store), `arbor.children` + `arbor.activeChildId`
 * (ProfileContext) — so every surface, the rendered sweep and the parent's-week
 * drive read a populated record on day 1.
 *
 * Only collections in CHILD_SUBCOLLECTIONS are written (export / erase cover
 * every one). A marker (`version@seededAt`) makes a reload a no-op; a re-seed
 * re-writes. No bundle (404), a slow server or a malformed body → the app
 * renders exactly as before.
 */
export const DEMO_FAMILY_URL = "/sandbox/demo-family.json";
export const DEMO_FAMILY_MARKER = "arbor.demoFamily.seeded";
const LS_PROFILES = "arbor.children";
const LS_ACTIVE = "arbor.activeChildId";

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type Bundle = {
  version?: unknown;
  seededAt?: unknown;
  child?: { id?: unknown; demo?: unknown } & Record<string, unknown>;
  collections?: Record<string, unknown>;
};

export type HydrateResult = "seeded" | "current" | "none";

export async function hydrateDemoFamily({
  fetchImpl = fetch,
  storage = localStorage,
  timeoutMs = 1500,
}: { fetchImpl?: typeof fetch; storage?: StorageLike; timeoutMs?: number } = {}): Promise<HydrateResult> {
  let bundle: Bundle;
  try {
    const res = await fetchImpl(DEMO_FAMILY_URL, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json" } });
    if (!res.ok) return "none";
    bundle = (await res.json()) as Bundle;
  } catch {
    return "none";
  }
  const child = bundle?.child;
  const childId = typeof child?.id === "string" ? child.id : "";
  if (!childId || child?.demo !== true || !bundle.collections || typeof bundle.collections !== "object") return "none";

  const marker = `${String(bundle.version)}@${String(bundle.seededAt)}`;
  if (storage.getItem(DEMO_FAMILY_MARKER) === marker) return "current";

  for (const [name, docs] of Object.entries(bundle.collections)) {
    if (!CHILD_SUBCOLLECTIONS.includes(name) || !Array.isArray(docs)) continue;
    storage.setItem(`arbor.${name}.${childId}`, JSON.stringify(docs));
  }
  let profiles: Record<string, unknown>[] = [];
  try {
    const raw = storage.getItem(LS_PROFILES);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) profiles = parsed;
  } catch {
    profiles = [];
  }
  storage.setItem(LS_PROFILES, JSON.stringify([child, ...profiles.filter((p) => p?.id !== childId)]));
  storage.setItem(LS_ACTIVE, childId);
  storage.setItem(DEMO_FAMILY_MARKER, marker);
  return "seeded";
}
