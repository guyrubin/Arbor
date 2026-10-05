/**
 * B-SHELL-27 — one face: the child's picture is the same everywhere.
 *
 * Production showed Dylan's hero in the sidebar card and the switcher (both
 * read `photoUrl` directly) while My Child and Stories showed the plant and
 * asked to "Create Dylan's hero" (they read `resolveHeroUrl`, which only
 * accepts a data: URL with generated-hero metadata, or `comicAvatarUrl`).
 * This is the ONE resolver every mount uses, in this order:
 *   1. the hero render (`comicAvatarUrl`, else a `photoUrl` marked generated);
 *   2. an uploaded photo (`photoUrl`);
 *   3. the initial letter.
 * "Create a hero" / "Give a hero" prompts render ONLY when it returns the
 * initial — nothing asks to create what already exists. Pure.
 */
export type ChildPictureKind = "hero" | "photo" | "initial";

export interface ChildPicture {
  kind: ChildPictureKind;
  /** The image URL (hero or photo), or null for the initial. */
  url: string | null;
  /** The first letter of the first name (shown when there is no image). */
  initial: string;
}

export interface ChildPictureSource {
  name?: string;
  photoUrl?: string;
  comicAvatarUrl?: string;
  avatar?: unknown;
}

const isGeneratedMeta = (avatar: unknown): boolean =>
  !!avatar && typeof avatar === "object" && (avatar as { source?: unknown }).source === "descriptor";

const usable = (url: string | undefined): url is string =>
  typeof url === "string" && /^(data:image\/|https:\/\/|blob:|\/)/.test(url.trim());

export function childPicture(child: ChildPictureSource): ChildPicture {
  const initial = (child.name || "").trim().charAt(0).toUpperCase();
  if (usable(child.comicAvatarUrl)) return { kind: "hero", url: child.comicAvatarUrl, initial };
  if (usable(child.photoUrl)) return { kind: isGeneratedMeta(child.avatar) ? "hero" : "photo", url: child.photoUrl, initial };
  return { kind: "initial", url: null, initial };
}

/** True when a "create / give a hero" prompt may render (the child has no picture at all). */
export function asksForHero(child: ChildPictureSource): boolean {
  return childPicture(child).kind === "initial";
}
