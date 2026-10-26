/**
 * useHeroSheet — one profile-approved identity, from the shared hero resolver.
 * Current matching docs play synchronously (idle + cheer are enough). Proof
 * and sandbox-injected sheets may replace an approved portrait only when
 * their heroId matches its hash. Otherwise the same portrait plays through
 * idle pose fallback; full pose animation awaits a matching approved sheet.
 * With no approved avatar, only explicit stock or neutral placeholder art can
 * play in production; unbound proof/device sheets are sandbox-only because
 * their legacy storage key has no owner scope. All live docs and async results
 * are scoped to owner, child, canonical avatar and current document snapshot.
 * Read-only: nothing here draws, keys or generates (the builder is parent-side
 * only and is never imported under kidmode/ outside its own files).
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { firebaseEnabled } from "../../../lib/firebase";
import { resolveHeroUrl } from "../../../lib/heroIdentity";
import { heroAvatarHash, stockHeroSheetUrl } from "../../../lib/heroSheetContract";
import { fetchProofJson } from "../proofAssets";
import { devPlaceholderSheet } from "./devPlaceholderSheet";
import { loadProofHeroSheet, parseHeroSheet, readStoredHeroSheet, type HeroSheet } from "./heroSheet";
import { heroSheetOwnerKey, sheetFromDocs, subscribeHeroSheetDocs, subscribeHeroSheetOwner, type HeroSheetDocs } from "../../../lib/heroSheetStore";

/**
 * B-BOOK-71 / B-GAME-35 (20 Oct): no production child id lives in this public
 * source. The proof sheet (the public proof folder) plays only in the sandbox
 * (no Firebase). The reference family's approved identity is protected by its
 * own private data instead: his game poses are his own heroSheet docs for his
 * current avatar (the chain reads them first; ensureHeroSheet never redraws a
 * complete sheet of the current hero), and his book carries an admin-uploaded
 * sheet, which the server never replaces (book sheet commit) and never narrates
 * over (book narration): both answer 409 book_sheet_admin.
 */

export type HeroSheetFrom = "child" | "proof" | "device" | "stock" | "avatar" | "placeholder";

export interface HeroChainChild {
  id: string;
  photoUrl?: string | null;
  avatar?: unknown;
  comicAvatarUrl?: string;
  stockHeroId?: unknown;
}

export const stockSheetUrl = stockHeroSheetUrl;

/** Same visual authority as the profile's generated-hero preview. */
export function heroSheetAvatarUrl(child: HeroChainChild | null | undefined): string | null {
  return child ? resolveHeroUrl({ ...child, photoUrl: child.photoUrl ?? undefined }) : null;
}

/** No drawing or new identity: the exact approved portrait, reused for every
 * missing pose until a sheet for this avatar exists. HeroFigure contains the
 * original image within this square instead of stretching or cropping it. */
export function avatarFallbackSheet(url: string): HeroSheet {
  return { v: 1, heroId: heroAvatarHash(url), source: "avatar", theme: "film3d", poses: {
    idle: { url, w: 1, h: 1, foot: { x: 0.5, y: 1 } },
  } };
}

const boundToAvatar = (sheet: HeroSheet | null, hash: string | null, allowUnbound: boolean): sheet is HeroSheet => !!sheet && (hash ? sheet.heroId === hash : allowUnbound);

/** Review/status writes do not alter the drawing. Keep the exact sheet object
 * so a live game does not reload its assets when only bookkeeping changes. */
function sameDrawing(a: HeroSheet, b: HeroSheet): boolean {
  if (a.heroId !== b.heroId || a.source !== b.source || a.theme !== b.theme) return false;
  const keys = Object.keys(a.poses) as (keyof HeroSheet["poses"])[];
  if (keys.length !== Object.keys(b.poses).length) return false;
  return keys.every(key => {
    const left = a.poses[key], right = b.poses[key];
    return !!left && !!right && left.url === right.url && left.w === right.w && left.h === right.h && left.scale === right.scale
      && left.foot.x === right.foot.x && left.foot.y === right.foot.y
      && left.head?.x === right.head?.x && left.head?.y === right.head?.y && left.head?.r === right.head?.r
      && left.hand?.l?.[0] === right.hand?.l?.[0] && left.hand?.l?.[1] === right.hand?.l?.[1]
      && left.hand?.r?.[0] === right.hand?.r?.[0] && left.hand?.r?.[1] === right.hand?.r?.[1];
  });
}

/** May this child play as the proof hero? Sandbox only (no Firebase). */
export function proofAllowedFor(childId: string, opts: { firebase?: boolean } = {}): boolean {
  return !!childId && (opts.firebase ?? firebaseEnabled) === false;
}

export interface ChainSources {
  docs: HeroSheetDocs | null;
  proofAllowed: boolean;
  /** Explicit local sandbox seam; production never treats a missing avatar as a wildcard. */
  allowUnboundProof?: boolean;
  loadProof: () => Promise<HeroSheet | null>;
  readDevice: () => HeroSheet | null;
  loadStock: (id: string) => Promise<HeroSheet | null>;
}

/** The chain, over injectable sources (fixtures in the test). */
export async function resolveHeroSheetChain(child: HeroChainChild, src: ChainSources): Promise<{ sheet: HeroSheet; from: HeroSheetFrom }> {
  const avatarUrl = heroSheetAvatarUrl(child);
  const hash = avatarUrl ? heroAvatarHash(avatarUrl) : null;
  // A missing approved avatar must not disable the stale-sheet check.
  const own = hash ? sheetFromDocs(src.docs, hash) : null;
  if (own) return { sheet: own, from: "child" };
  if (src.proofAllowed) {
    const proof = await src.loadProof().catch(() => null);
    if (boundToAvatar(proof, hash, src.allowUnboundProof === true)) return { sheet: proof, from: "proof" };
  }
  const device = src.readDevice();
  if (boundToAvatar(device, hash, src.allowUnboundProof === true)) return { sheet: device, from: "device" };
  // A selected profile avatar outranks unrelated proof, device or stock art.
  if (avatarUrl) return { sheet: avatarFallbackSheet(avatarUrl), from: "avatar" };
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
function useOwnedHeroSheetDocs(childId: string): { ownerKey: string; docs: HeroSheetDocs | null | undefined } {
  const ownerKey = useSyncExternalStore(subscribeHeroSheetOwner, heroSheetOwnerKey, heroSheetOwnerKey);
  const [state, setState] = useState<{ ownerKey: string; childId: string; docs: HeroSheetDocs | null } | undefined>(undefined);
  useEffect(() => {
    if (!childId) return;
    let alive = true;
    const unsubscribe = subscribeHeroSheetDocs(childId, (docs) => {
      if (alive && heroSheetOwnerKey() === ownerKey) setState({ ownerKey, childId, docs });
    });
    return () => { alive = false; unsubscribe(); };
  }, [childId, ownerKey]);
  return { ownerKey, docs: state && state.childId === childId && state.ownerKey === ownerKey ? state.docs : undefined };
}

export function useHeroSheetDocs(childId: string): HeroSheetDocs | null | undefined {
  return useOwnedHeroSheetDocs(childId).docs;
}

/**
 * The resolved sheet for this child. `ready` is false until the child's own
 * docs have been read once and the chain has settled; until then `sheet` is
 * the approved portrait, else the sandbox device sheet or the placeholder.
 */
export function useHeroSheetState(child: HeroChainChild | null | undefined): { identityKey: string; ready: boolean; sheet: HeroSheet; from: HeroSheetFrom } {
  const childId = child?.id ?? "";
  const { ownerKey, docs } = useOwnedHeroSheetDocs(childId);
  const avatarUrl = heroSheetAvatarUrl(child);
  const hash = useMemo(() => avatarUrl ? heroAvatarHash(avatarUrl) : null, [avatarUrl]);
  const stockHeroId = typeof child?.stockHeroId === "string" ? child.stockHeroId : null;
  const identityKey = JSON.stringify([ownerKey, childId, hash, stockHeroId]);
  const ownCache = useRef<{ identityKey: string; sheet: HeroSheet } | null>(null);
  const own = useMemo(() => {
    const sheet = hash ? sheetFromDocs(docs, hash) : null;
    if (!sheet) { ownCache.current = null; return null; }
    if (ownCache.current?.identityKey === identityKey && sameDrawing(ownCache.current.sheet, sheet)) return ownCache.current.sheet;
    ownCache.current = { identityKey, sheet };
    return sheet;
  }, [identityKey, docs, hash]);
  const fallback = useMemo(() => {
    if (avatarUrl) return { sheet: avatarFallbackSheet(avatarUrl), from: "avatar" as const };
    const device = firebaseEnabled ? null : readStoredHeroSheet(childId);
    return device ? { sheet: device, from: "device" as const } : { sheet: devPlaceholderSheet(), from: "placeholder" as const };
  }, [identityKey, avatarUrl, childId]);
  const [resolved, setResolved] = useState<{ identityKey: string; docs: HeroSheetDocs | null; sheet: HeroSheet; from: HeroSheetFrom } | null>(null);
  useEffect(() => {
    if (!childId || docs === undefined || own) return;
    let alive = true;
    void resolveHeroSheetChain(child!, {
      docs,
      proofAllowed: proofAllowedFor(childId),
      allowUnboundProof: !firebaseEnabled,
      loadProof: () => loadProofHeroSheet(),
      readDevice: () => firebaseEnabled ? null : readStoredHeroSheet(childId),
      loadStock: loadStockHeroSheet,
    }).then((r) => { if (alive && heroSheetOwnerKey() === ownerKey) setResolved({ identityKey, docs, ...r }); });
    return () => { alive = false; };
    // Every docs snapshot counts: re-drawing an existing pose changes pixels
    // and anchors without changing the pose-name list or meta status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityKey, docs, own]);
  if (own) return { identityKey, ready: true, sheet: own, from: "child" };
  if (resolved && resolved.identityKey === identityKey && resolved.docs === docs) return { identityKey, ready: true, sheet: resolved.sheet, from: resolved.from };
  // No child: nothing to wait for.
  return { identityKey, ready: !childId, ...fallback };
}

/** The sheet to draw now (see useHeroSheetState). */
export function useHeroSheet(child: HeroChainChild | null | undefined): HeroSheet {
  return useHeroSheetState(child).sheet;
}
