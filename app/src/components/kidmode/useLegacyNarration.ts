/**
 * useLegacyNarration — B-BOOK-73: a legacy kid book reads its pages from the
 * child's own narration files in the chosen narrator's voice
 * (lib/library/legacyNarration). Never a runtime voice: no manifest, no file,
 * Sound off, no gesture yet or a hidden tab = silence.
 *
 * `play(units)` reads a page's units in order on the ONE page voice channel
 * (lib/kidVoicePlayer, blessed by the child's first tap so an iPhone plays it
 * outside the tap) and returns the stop the page's effect calls on the turn.
 * `status` says which voice a page uses: "files" when this child has this
 * book's units in this language/gender, "none" otherwise (the caller falls
 * back to the K2.1 read-aloud), "loading" until the manifest answers.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { authHeaders } from "../../lib/api";
import { heroSheetOwnerKey } from "../../lib/heroSheetStore";
import { fetchBookAsset } from "../../lib/bookAssetStore";
import { bookAssetUrl } from "../../lib/library/bookAssetPaths";
import { kidVoiceElement } from "../../lib/kidVoicePlayer";
import { legacyFolder, legacyNarrationRel, legacySource, parseLegacyManifest, type LegacyNarrationManifest } from "../../lib/library/legacyNarration";
import { pageHasUserGesture, useKidReadAloudMuted } from "./audio/kidAudio";

/** One manifest read per owner, child and book per session (a miss is remembered too). */
const manifests = new Map<string, Promise<LegacyNarrationManifest | null>>();

async function loadManifest(childId: string, storyId: string): Promise<LegacyNarrationManifest | null> {
  try {
    const headers = await authHeaders();
    delete headers["Content-Type"];
    const res = await fetch(bookAssetUrl(childId, storyId, "manifest.json"), { headers, credentials: "same-origin" });
    if (!res.ok) return null;
    return parseLegacyManifest(await res.json(), storyId);
  } catch {
    return null;
  }
}

/** Test seam. */
export function resetLegacyNarrationForTest(): void {
  manifests.clear();
}

/** The pause after a page settles before it reads (the page-turn sound first). */
export const LEGACY_READ_DELAY_MS = 400;

export type LegacyVoiceStatus = "loading" | "files" | "none";

export function useLegacyNarration(childId: string | null, storyId: string | null, lang: "en" | "he", gender: string | undefined): {
  status: LegacyVoiceStatus;
  play: (units: readonly string[]) => () => void;
} {
  const muted = useKidReadAloudMuted(childId ?? "");
  const [manifest, setManifest] = useState<LegacyNarrationManifest | null>(null);
  const [answered, setAnswered] = useState<string | null>(null);
  const scopeKey = childId && storyId ? `${childId}|${storyId}` : null;
  useEffect(() => {
    setManifest(null);
    if (!childId || !storyId) return;
    const key = `${heroSheetOwnerKey()}|${childId}|${storyId}`;
    let pending = manifests.get(key);
    if (!pending) {
      pending = loadManifest(childId, storyId);
      manifests.set(key, pending);
    }
    let live = true;
    void pending.then((m) => { if (live) { setManifest(m); setAnswered(`${childId}|${storyId}`); } });
    return () => { live = false; };
  }, [childId, storyId]);

  const folder = legacyFolder(lang, gender);
  const status: LegacyVoiceStatus = !scopeKey ? "none" : answered !== scopeKey ? "loading" : manifest?.folders[folder]?.length ? "files" : "none";
  const blobs = useRef(new Map<string, Promise<string | null>>());
  useEffect(() => {
    const held = blobs.current;
    return () => {
      for (const p of held.values()) void p.then((u) => { if (u) URL.revokeObjectURL(u); });
      held.clear();
    };
  }, [childId, storyId]);

  const play = useCallback((units: readonly string[]): (() => void) => {
    if (!childId || !manifest || muted) return () => {};
    const have = new Set(manifest.folders[folder] ?? []);
    const list = units.filter((u) => have.has(u));
    const el = list.length ? kidVoiceElement("page") : null;
    if (!el) return () => {};
    const source = legacySource(manifest);
    const urlOf = (unit: string): Promise<string | null> => {
      const rel = legacyNarrationRel(manifest.set, folder, unit);
      let p = blobs.current.get(rel);
      if (!p) {
        p = fetchBookAsset(childId, source, rel).then((blob) => (blob ? URL.createObjectURL(blob) : null)).catch(() => null);
        blobs.current.set(rel, p);
      }
      return p;
    };
    let stopped = false;
    const next = async (i: number): Promise<void> => {
      if (stopped || i >= list.length) return;
      if (!pageHasUserGesture() || document.visibilityState === "hidden") return;
      const url = await urlOf(list[i]);
      if (stopped) return;
      if (!url) return next(i + 1);
      el.onended = () => { if (!stopped) void next(i + 1); };
      el.onerror = () => { if (!stopped) void next(i + 1); };
      el.src = url;
      el.play().catch(() => { /* refused (no gesture): silence */ });
    };
    for (const u of list) void urlOf(u); // warm this page's files while the turn settles
    const timer = setTimeout(() => { void next(0); }, LEGACY_READ_DELAY_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
      el.onended = null;
      el.onerror = null;
      try { el.pause(); } catch { /* ignore */ }
    };
  }, [childId, manifest, muted, folder]);

  return { status, play };
}
