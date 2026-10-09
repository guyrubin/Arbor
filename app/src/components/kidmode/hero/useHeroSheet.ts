/**
 * useHeroSheet — B-GAME-13c: who plays. The resolution chain, first found wins:
 *   1 the child's own generated sheet (heroSheet docs; a partial sheet plays
 *     once idle + cheer exist, the rest through the fallback map; a sheet drawn
 *     from another hero than the child's current one is stale and skipped);
 *   2 the proof sheet (/_proof/hero/sheet.json) — ONLY for the children in
 *     PROOF_HERO_CHILD_IDS (the owner's son; one constant), or on a build
 *     without Firebase (the local sandbox, where there are no other families);
 *   3 a sheet injected on the device (`arbor.heroSheet.<cid>` as one HeroSheet
 *     object: the sandbox proof path);
 *   4 the stock hero the family chose (`stockHeroId` on the child; its sheet
 *     at stockHeroSheetUrl(id) in lib/heroSheetContract; absent = skip);
 *   5 the dev placeholder.
 * Read-only: nothing here draws, keys or generates (the builder is parent-side
 * only and is never imported under kidmode/ outside its own files).
 */
import { useEffect, useMemo, useState } from "react";
import { firebaseEnabled } from "../../../lib/firebase";
import { heroAvatarHash, stockHeroSheetUrl } from "../../../lib/heroSheetContract";
import { fetchProofJson } from "../proofAssets";
import { devPlaceholderSheet } from "./devPlaceholderSheet";
import { loadProofHeroSheet, parseHeroSheet, readStoredHeroSheet, type HeroSheet } from "./heroSheet";
import { sheetFromDocs, subscribeHeroSheetDocs, type HeroSheetDocs } from "../../../lib/heroSheetStore";

/**
 * The children who may play as the proof hero (the owner's son). Child ids,
 * not names. K1 (9 Oct): his production child id — the one child folder with
 * book assets in the child-assets bucket — so the release keeps his proof
 * hero; the list can go once his sheet lives in his own heroSheet docs.
 */
export const PROOF_HERO_CHILD_IDS: readonly string[] = ["child-1780330920145"];

export type HeroSheetFrom = "child" | "proof" | "device" | "stock" | "placeholder";

export interface HeroChainChild {
  id: string;
  photoUrl?: string | null;
  stockHeroId?: unknown;
}

export const stockSheetUrl = stockHeroSheetUrl;

/** May this child play as the proof hero? */
export function proofAllowedFor(childId: string, opts: { firebase?: boolean; allowList?: readonly string[] } = {}): boolean {
  if (!childId) return false;
  const list = opts.allowList ?? PROOF_HERO_CHILD_IDS;
  return list.includes(childId) || (opts.firebase ?? firebaseEnabled) === false;
}

export interface ChainSources {
  docs: HeroSheetDocs | null;
  proofAllowed: boolean;
  loadProof: () => Promise<HeroSheet | null>;
  readDevice: () => HeroSheet | null;
  loadStock: (id: string) => Promise<HeroSheet | null>;
}

/** The chain, over injectable sources (fixtures in the test). */
export async function resolveHeroSheetChain(child: HeroChainChild, src: ChainSources): Promise<{ sheet: HeroSheet; from: HeroSheetFrom }> {
  const hash = typeof child.photoUrl === "string" && child.photoUrl.startsWith("data:image/") ? heroAvatarHash(child.photoUrl) : null;
  const own = sheetFromDocs(src.docs, hash);
  if (own) return { sheet: own, from: "child" };
  if (src.proofAllowed) {
    const proof = await src.loadProof().catch(() => null);
    if (proof) return { sheet: proof, from: "proof" };
  }
  const device = src.readDevice();
  if (device) return { sheet: device, from: "device" };
  const stockId = typeof child.stockHeroId === "string" && /^[a-z0-9-]{1,40}$/i.test(child.stockHeroId) ? child.stockHeroId : null;
  if (stockId) {
    const stock = await src.loadStock(stockId).catch(() => null);
    if (stock) return { sheet: stock, from: "stock" };
  }
  return { sheet: devPlaceholderSheet(), from: "placeholder" };
}

export async function loadStockHeroSheet(id: string): Promise<HeroSheet | null> {
  const raw = await fetchProofJson(stockSheetUrl(id));
  const sheet = raw ? parseHeroSheet(raw) : null;
  return sheet ? { ...sheet, source: "stock", heroId: id } : null;
}

/** Live docs of the child's own sheet (undefined until the first read). */
export function useHeroSheetDocs(childId: string): HeroSheetDocs | null | undefined {
  const [state, setState] = useState<{ childId: string; docs: HeroSheetDocs | null } | undefined>(undefined);
  useEffect(() => {
    if (!childId) return;
    return subscribeHeroSheetDocs(childId, (docs) => setState({ childId, docs }));
  }, [childId]);
  return state && state.childId === childId ? state.docs : undefined;
}

/**
 * The resolved sheet for this child. `ready` is false until the child's own
 * docs have been read once and the chain has settled; until then `sheet` is
 * the device sheet or the placeholder (never empty, never blocking).
 */
export function useHeroSheetState(child: HeroChainChild | null | undefined): { ready: boolean; sheet: HeroSheet; from: HeroSheetFrom } {
  const childId = child?.id ?? "";
  const docs = useHeroSheetDocs(childId);
  const photoUrl = child?.photoUrl ?? null;
  const stockHeroId = typeof child?.stockHeroId === "string" ? child.stockHeroId : null;
  const fallback = useMemo(() => {
    const device = readStoredHeroSheet(childId);
    return device ? { sheet: device, from: "device" as const } : { sheet: devPlaceholderSheet(), from: "placeholder" as const };
  }, [childId]);
  const [resolved, setResolved] = useState<{ key: string; sheet: HeroSheet; from: HeroSheetFrom } | null>(null);
  const key = `${childId}|${docs === undefined ? "-" : docs?.meta ? `${docs.meta.avatarHash}:${docs.meta.status}:${Object.keys(docs.poses).sort().join(",")}` : "0"}|${photoUrl ? heroAvatarHash(photoUrl) : ""}|${stockHeroId ?? ""}`;
  useEffect(() => {
    if (!childId || docs === undefined) return;
    let alive = true;
    void resolveHeroSheetChain({ id: childId, photoUrl, stockHeroId }, {
      docs,
      proofAllowed: proofAllowedFor(childId),
      loadProof: () => loadProofHeroSheet(),
      readDevice: () => readStoredHeroSheet(childId),
      loadStock: loadStockHeroSheet,
    }).then((r) => { if (alive) setResolved({ key, ...r }); });
    return () => { alive = false; };
    // `key` carries docs, hero and stock choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (resolved && resolved.key === key) return { ready: true, sheet: resolved.sheet, from: resolved.from };
  // No child: nothing to wait for.
  return { ready: !childId, ...fallback };
}

/** The sheet to draw now (see useHeroSheetState). */
export function useHeroSheet(child: HeroChainChild | null | undefined): HeroSheet {
  return useHeroSheetState(child).sheet;
}
