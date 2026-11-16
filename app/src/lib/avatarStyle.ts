import type { AvatarStyle } from "./api";

/** The persisted avatar medium, shared by portrait and generated world scenes.
 *  `studio3d` is the one look every new hero is made in (Guy, 16 Nov: one design
 *  language for every child); the older five stay readable for heroes already saved,
 *  and an unknown or missing value is an older hero, so it stays the comic medium. */
export const HOUSE_AVATAR_STYLE = "studio3d" as const satisfies AvatarStyle;
export const AVATAR_STYLE_IDS = ["storybook", "soft3d", "watercolor", "flat", "comichero", "studio3d"] as const satisfies readonly AvatarStyle[];

export function normalizeAvatarStyle(style: unknown): AvatarStyle {
  return typeof style === "string" && (AVATAR_STYLE_IDS as readonly string[]).includes(style)
    ? style as AvatarStyle
    : "comichero";
}
