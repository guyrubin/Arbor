/**
 * A library's saved-comic reader is ephemeral state owned by one signed-in
 * account and one child. Neither child-id collisions across accounts nor
 * sibling changes may reuse the previous reader's open/hidden-grid state.
 * Keep the key a collision-safe tuple (not ambiguous string concatenation).
 */
export function scopedKidLibraryKey(owner: string, childId: string): string {
  return JSON.stringify([owner, childId]);
}
