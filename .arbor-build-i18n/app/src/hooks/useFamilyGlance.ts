/**
 * C3 — Family Glance hook.
 *
 * Reads each child's LATEST persisted DevScore snapshot from localStorage
 * (the same key that DevScoreCard writes: `arbor.devscore.<childId>`).
 * This is purely reading existing data — no new data collection, no network
 * call, no Firestore access. The snapshot is written by DevScoreCard weekly
 * as the parent navigates to the Development tab, so it is always the most
 * recently seen score for each child.
 *
 * Returns a summary row per child, sorted: active child first, then by name.
 * Returns an empty array for single-child households (caller hides the panel).
 */
import { useMemo } from "react";
import { useProfile } from "../context/ProfileContext";
import type { DevScoreSnapshot } from "../growth/devScore";

export interface FamilyGlanceRow {
  id: string;
  name: string;
  age: number;
  photoUrl?: string;
  /** 0–100 overall score, or null when no snapshot exists yet. */
  overall: number | null;
  /** Raw reached/total across all domains, or null when no snapshot exists. */
  reached: number | null;
  total: number | null;
  isActive: boolean;
}

function readSnapshot(childId: string): DevScoreSnapshot | null {
  try {
    const raw = localStorage.getItem(`arbor.devscore.${childId}`);
    if (!raw) return null;
    return JSON.parse(raw) as DevScoreSnapshot;
  } catch {
    return null;
  }
}

export function useFamilyGlance(): FamilyGlanceRow[] {
  const { profiles, activeChild } = useProfile();

  return useMemo(() => {
    if (profiles.length <= 1) return [];

    return profiles
      .map((p): FamilyGlanceRow => {
        const snap = readSnapshot(p.id);
        return {
          id: p.id,
          name: p.name,
          age: p.age,
          photoUrl: p.photoUrl,
          overall: snap?.overall ?? null,
          // Reconstruct reached/total from the byDomain map when available.
          // The snapshot stores per-domain scores (0-100) not raw counts, so
          // we expose `overall` as the primary number; reached/total are omitted
          // from the snapshot format and surfaced as null to keep the glance honest.
          reached: null,
          total: null,
          isActive: p.id === activeChild.id,
        };
      })
      .sort((a, b) => {
        // Active child always first.
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [profiles, activeChild.id]);
}
