/**
 * heroPersistence — writing a generated hero to the child document, honestly.
 *
 * A generated hero is stored INLINE: `photoUrl` carries the (bounded) data URL
 * and `avatar` carries the metadata that makes it a hero at all — resolveHeroUrl
 * returns null for a photo with no `avatar`, so the two fields must be written
 * TOGETHER or the child silently has no hero.
 *
 * The second half is the honesty: ProfileContext.updateChild swallowed a failed
 * Firestore write, leaving the parent looking at a hero that exists only in
 * memory until the next reload. It now reports whether the write landed, and
 * this helper hands that boolean to the caller so the parent can be told.
 */

import type { AvatarResult } from "./avatarGate";
import type { ChildProfile } from "../../types";

export type HeroPatch = Pick<ChildProfile, "photoUrl" | "avatar">;

/** The exact patch shape ProfileEditDrawer and WowOnboarding already write. */
export function heroPatch(result: AvatarResult, now: () => Date = () => new Date()): HeroPatch {
  return {
    photoUrl: result.dataUrl,
    avatar: { style: result.style, source: result.source, createdAt: now().toISOString() },
  };
}

/**
 * Persist the hero. Returns false when the remote write failed — the caller
 * raises a parent-visible error instead of pretending it saved. A legacy
 * updateChild that resolves void is treated as success (no behaviour change).
 */
export async function persistHero(
  childId: string,
  result: AvatarResult,
  deps: {
    updateChild: (id: string, patch: Partial<ChildProfile>) => Promise<boolean | void>;
    now?: () => Date;
  },
): Promise<boolean> {
  const ok = await deps.updateChild(childId, heroPatch(result, deps.now));
  return ok !== false;
}
