/**
 * C3 - Family Glance hook.
 *
 * Returns a summary row per child, sorted active child first, then by name.
 * Returns an empty array for single-child households so callers hide the panel.
 */
import { useMemo } from "react";
import { useProfile } from "../context/ProfileContext";

export interface FamilyGlanceRow {
  id: string;
  name: string;
  age: number;
  photoUrl?: string;
  isActive: boolean;
}

export function useFamilyGlance(): FamilyGlanceRow[] {
  const { profiles, activeChild } = useProfile();

  return useMemo(() => {
    if (profiles.length <= 1) return [];

    return profiles
      .map((p): FamilyGlanceRow => ({
        id: p.id,
        name: p.name,
        age: p.age,
        photoUrl: p.photoUrl,
        isActive: p.id === activeChild.id,
      }))
      .sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [profiles, activeChild.id]);
}
