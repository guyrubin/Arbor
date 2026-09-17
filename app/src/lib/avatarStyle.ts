import type { AvatarStyle } from "./api";

/** The persisted avatar medium, shared by portrait and generated world scenes. */
export const AVATAR_STYLE_IDS = ["storybook", "soft3d", "watercolor", "flat", "comichero"] as const satisfies readonly AvatarStyle[];

export function normalizeAvatarStyle(style: unknown): AvatarStyle {
  return typeof style === "string" && (AVATAR_STYLE_IDS as readonly string[]).includes(style)
    ? style as AvatarStyle
    : "comichero";
}
