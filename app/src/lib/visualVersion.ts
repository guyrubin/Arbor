export const VISUAL_ASSET_VERSION = "nextgen-20260621-01";

export function versionedVisual(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${VISUAL_ASSET_VERSION}`;
}
