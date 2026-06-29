/**
 * avatarGate — extracted consent-before-capture logic for AvatarCreator.
 *
 * BINDING SAFETY CONDITION AP-049 / F-NEW:
 * On the photo path (mode === "photo" && refPhoto exists), a face_processing
 * consent grant for the matching childId MUST be recorded BEFORE generateAvatar
 * is called. This module makes that ordering explicit and independently testable.
 *
 * AvatarCreator's useAsyncAction callback delegates to runAvatarGeneration so
 * the gate order is enforced in one place and verified by captureGate.test.ts.
 */

import type { AvatarStyle, AvatarDescriptors } from "../../lib/api";

export type AvatarGenInput = {
  mode: "describe" | "photo";
  refPhoto?: string;
  style: AvatarStyle;
  descriptors: AvatarDescriptors;
};

export type AvatarGenDeps = {
  /** Records parental face_processing consent. Must resolve before generateAvatar fires. */
  grantConsent: (opts: { childId: string; purpose: string }) => Promise<unknown>;
  /** Generates the avatar. Must NOT be called before grantConsent on the photo path. */
  generateAvatar: (payload: {
    childId?: string;
    style?: AvatarStyle;
    photo?: { dataUrl: string };
    descriptors?: AvatarDescriptors;
  }) => Promise<{ dataUrl: string; style: string; source: "descriptor" | "photo" }>;
};

/**
 * Run the avatar generation with the COPPA consent gate enforced.
 *
 * Photo path:  grantConsent fires FIRST, generateAvatar fires AFTER.
 * Describe path: grantConsent is skipped; generateAvatar fires directly.
 *
 * The reference photo is passed only as a transient dataUrl; it is never written
 * to Firestore or Storage — the server uses it for the single generation call only.
 */
export async function runAvatarGeneration(
  childId: string,
  input: AvatarGenInput,
  deps: AvatarGenDeps,
): Promise<{ dataUrl: string; style: string; source: "descriptor" | "photo" }> {
  if (input.mode === "photo" && input.refPhoto) {
    // MUST happen before generateAvatar — gate enforced by sequential await.
    await deps.grantConsent({ childId, purpose: "face_processing" });
    return deps.generateAvatar({
      childId,
      style: input.style,
      photo: { dataUrl: input.refPhoto },
    });
  }
  return deps.generateAvatar({
    childId,
    style: input.style,
    descriptors: input.descriptors,
  });
}
