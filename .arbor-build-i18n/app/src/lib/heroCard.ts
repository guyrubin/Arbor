/**
 * Hero Card — compat shim. The canvas rendering logic moved to lib/shareCard.ts
 * (the generalized branded-share renderer behind all four loop artifacts, per
 * mk-p0-3). This file keeps `renderHeroCard`/`downloadHeroCard` working for
 * existing callers; new surfaces should use lib/share.ts (`shareCard`) +
 * lib/shareCard.ts directly so they get the native share sheet + loop events.
 *
 * AP-050: downloadHeroCard now routes through renderHeroAvatarCanvas("hero_card")
 * so the Hero Card surface is part of the shared canvas module. Output is
 * byte-identical to the pre-migration direct renderShareCard("avatar", opts) call
 * because hero_card → artifact "avatar" → renderAvatarCard (same compositing path).
 */
import { renderHeroCard as renderAvatar } from "./shareCard";
import { renderHeroAvatarCanvas } from "./heroAvatarCanvas";

export const renderHeroCard = renderAvatar;

/** Render + trigger a download of the hero card.
 *  Routes through the shared HeroAvatarCanvas module (AP-050 hero_card template)
 *  which resolves to renderShareCard("avatar", opts) — identical output. */
export async function downloadHeroCard(opts: { imageUrl: string; name: string; age?: number }): Promise<void> {
  const { dataUrl } = await renderHeroAvatarCanvas("hero_card", opts);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${(opts.name || "hero").toLowerCase()}-arbor-hero-card.png`;
  a.click();
}
