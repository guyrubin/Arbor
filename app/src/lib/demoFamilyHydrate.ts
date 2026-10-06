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
type BundleChild = { id?: unknown; demo?: unknown } & Record<string, unknown>;
type BundleBody = {
  child?: BundleChild;
  collections?: Record<string, unknown>;
  /** P2A AGES: the family's other children, each with her own collections. */
  siblings?: { child?: BundleChild; collections?: Record<string, unknown> }[];
};
type Bundle = BundleBody & {
  version?: unknown;
  seededAt?: unknown;
  /** W2-GROWTH r2 (Law 8): the same family in each UI language (seed-demo-family.mjs). */
  locales?: Partial<Record<"en" | "he", BundleBody>>;
};
/** LanguageContext's persisted UI language key. */
const LS_UI_LANG = "arbor.uiLang";

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
  // W2-GROWTH r2 (Law 8): a Hebrew parent's record is hydrated in Hebrew — the
  // HE sweep cell rendered "City kindergarten, first year" because the one
  // bundle was English. The bundle carries both locales; the UI language at
  // load picks one, and the marker carries the language, so a reload after a
  // language switch re-hydrates. An old single-locale bundle still works.
  let uiLang: "en" | "he" = "en";
  try { uiLang = storage.getItem(LS_UI_LANG) === "he" ? "he" : "en"; } catch { /* default en */ }
  const body: BundleBody = bundle?.locales?.[uiLang] ?? bundle;
  const child = body?.child;
  const childId = typeof child?.id === "string" ? child.id : "";
  if (!childId || child?.demo !== true || !body.collections || typeof body.collections !== "object") return "none";

  const marker = bundle?.locales?.[uiLang]
    ? `${String(bundle.version)}@${String(bundle.seededAt)}@${uiLang}`
    : `${String(bundle.version)}@${String(bundle.seededAt)}`;
  if (storage.getItem(DEMO_FAMILY_MARKER) === marker) return "current";

  const writeCollections = (id: string, collections: Record<string, unknown>) => {
    for (const [name, docs] of Object.entries(collections)) {
      if (!CHILD_SUBCOLLECTIONS.includes(name) || !Array.isArray(docs)) continue;
      storage.setItem(`arbor.${name}.${id}`, JSON.stringify(docs));
    }
  };
  writeCollections(childId, body.collections);
  // P2A AGES: a sibling is written only when she is a demo child with her own id.
  const siblings = (Array.isArray(body.siblings) ? body.siblings : []).filter(
    (s) => typeof s?.child?.id === "string" && s.child.id !== childId && s.child.demo === true && !!s.collections && typeof s.collections === "object",
  );
  for (const sib of siblings) writeCollections(String(sib.child!.id), sib.collections!);
  const seededIds = new Set([childId, ...siblings.map((s) => String(s.child!.id))]);
  let profiles: Record<string, unknown>[] = [];
  try {
    const raw = storage.getItem(LS_PROFILES);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) profiles = parsed;
  } catch {
    profiles = [];
  }
  storage.setItem(LS_PROFILES, JSON.stringify([child, ...siblings.map((s) => s.child), ...profiles.filter((p) => !seededIds.has(String(p?.id)))]));
  storage.setItem(LS_ACTIVE, childId);
  storage.setItem(DEMO_FAMILY_MARKER, marker);
  return "seeded";
}
