/**
 * KidStage — B-KID-133 (D-01, KID-DESIGN-DIRECTION §2.4 "The Stage"): the lit
 * set behind every kid view. The overlay renders it as its first child
 * (absolute, inset 0, under the content). Layers:
 *   1. soft — the view's own picture, cover, blurred + a touch saturated,
 *      scaled 1.12 so the blur never shows a transparent edge;
 *   2. sharp (phone portrait, home + games) — the same picture crisp at the
 *      top, melting into the glow where play happens (the hero's face sits
 *      ~27-35 % down every film-3D card: it lands in the crisp band);
 *   3. tint + vignette in navy (`--arbor-ink`, never black).
 * Decorative (aria-hidden), never animated ("quiet by default"), blur only on
 * the 480 px derivative when the blur is strong. No art → the flat token stage.
 * Words never sit on it: every kid text lives on a paper plate.
 */
import type { CSSProperties } from "react";
import { kidArtSrcSet, type KidArt } from "../../lib/kidThemeManifest";
import { useKidTheme } from "../../hooks/useKidTheme";
import { kidStageArt, type KidStageScene } from "./kidStageArt";

/** Phone / tablet breakpoint where the tall art gives way to the wide art. */
export const KID_STAGE_TALL_MEDIA = "(max-width: 767px)";

function StageLayer({ wide, tall, className, sizes, lowRes }: { wide: KidArt; tall: KidArt | null; className: string; sizes: string; lowRes: boolean }) {
  // A heavy blur needs no more than the 480 px derivative (§2.4 performance).
  const set = (a: KidArt) => (lowRes ? a.src480 : kidArtSrcSet(a));
  return (
    <picture>
      {tall && tall !== wide && <source media={KID_STAGE_TALL_MEDIA} srcSet={set(tall)} sizes={sizes} />}
      <img src={wide.src480} srcSet={set(wide)} sizes={sizes} alt="" decoding="async" className={className} />
    </picture>
  );
}

export function KidStage({ scene }: { scene: KidStageScene }) {
  const theme = useKidTheme();
  const stage = kidStageArt(theme, scene);
  const wide = stage.wide ?? stage.tall;
  return (
    <div
      aria-hidden="true"
      className="kid-stage"
      data-kid-stage={stage.id}
      data-sharp-top={stage.sharpTop ? "" : undefined}
      data-empty={wide ? undefined : ""}
      style={{ "--stage-blur": `${stage.blur}px` } as CSSProperties}
    >
      {wide && (
        <StageLayer wide={wide} tall={stage.tall} className="kid-stage-soft" sizes="100vw" lowRes={stage.blur >= 16} />
      )}
      {wide && stage.sharpTop && (
        <StageLayer wide={wide} tall={stage.tall} className="kid-stage-sharp" sizes="100vw" lowRes={false} />
      )}
      <span className="kid-stage-tint" />
    </div>
  );
}

export default KidStage;
