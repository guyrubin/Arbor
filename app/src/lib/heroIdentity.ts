/** Canonical generated-hero reference shared by display and generation.
 * Legacy comicAvatarUrl remains authoritative when present. The modern
 * photoUrl slot is a hero only with generated metadata and an inline image;
 * an uploaded profile photo must never silently become an illustration input.
 * Provider-specific source/consent checks still apply after resolution. */
const isGeneratedHeroMeta = (avatar: unknown): boolean => {
  if (!avatar || typeof avatar !== "object") return false;
  const source = (avatar as { source?: unknown }).source;
  return source === "descriptor" || source === "photo";
};

export const resolveHeroUrl = (child: {
  avatar?: unknown;
  photoUrl?: string;
  comicAvatarUrl?: string;
}): string | null => {
  if (child.comicAvatarUrl) return child.comicAvatarUrl;
  const url = child.photoUrl;
  if (!url || !isGeneratedHeroMeta(child.avatar)) return null;
  return url.startsWith("data:image/") ? url : null;
};
