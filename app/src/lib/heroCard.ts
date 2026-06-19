/**
 * Hero Card — compat shim. The canvas rendering logic moved to lib/shareCard.ts
 * (the generalized branded-share renderer behind all four loop artifacts, per
 * mk-p0-3). This file keeps `renderHeroCard`/`downloadHeroCard` working for
 * existing callers; new surfaces should use lib/share.ts (`shareCard`) +
 * lib/shareCard.ts directly so they get the native share sheet + loop events.
 */
import { renderHeroCard as renderAvatar, renderShareCard } from "./shareCard";

export const renderHeroCard = renderAvatar;

/** Render + trigger a download of the hero card (legacy direct-download path). */
export async function downloadHeroCard(opts: { imageUrl: string; name: string; age?: number }): Promise<void> {
  const { dataUrl } = await renderShareCard("avatar", opts);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${(opts.name || "hero").toLowerCase()}-arbor-hero-card.png`;
  a.click();
}
