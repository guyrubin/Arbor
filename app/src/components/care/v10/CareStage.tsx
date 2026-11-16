import React from "react";
import { Scene, LivingForm, StartHere } from "../../../design/primitives";
import type { Composition } from "../../../design/useComposition";
import { useLanguage } from "../../../context/LanguageContext";

/* Care, together — the ONE hero field and stage-card header the four Care
   screens share (design V77: Visits, the Teacher brief, People, Records).
   The sapphire scene field, the header row (kicker · Start here, a note at
   its end), production's Living Form, the page heading and its figure, an
   optional card at the end (the brief's template), then the screen's own
   content. Desktop puts the art beside the heading; phone stacks the heading
   first and gives the art its row beside the figure. */

const ORBS = {
  desk: [{ size: 420, left: -230, bottom: -280, opacity: 0.8 }, { size: 360, right: -180, top: -240, opacity: 0.6, b: true }],
  phone: [{ size: 250, left: -150, bottom: -160, opacity: 0.8 }, { size: 220, right: -130, top: -140, opacity: 0.55, b: true }],
} as const;

export type CareStageProps = {
  composition: Composition;
  /** The id of the page's h1, which names the stage. */
  labelledBy: string;
  /** The header row's kicker (a node: a screen may stamp it). */
  kicker?: React.ReactNode;
  /** The header row's dashed "Start here" tag. */
  startHere?: boolean;
  /** Plain text at the header row's end. */
  note?: React.ReactNode;
  /** A Living Form from public/visuals (decorative, never evidence). */
  art: string;
  /** Phone: with no figure, set the art beside the heading (else no art). */
  artOnPhone?: boolean;
  heading: React.ReactNode;
  /** The stage's one figure (days to go, people you share with). */
  figure?: React.ReactNode;
  /** A card at the stage's end (desktop) or under the heading (phone). */
  aside?: React.ReactNode;
  /** Span the whole row (no rail beside the stage). */
  wide?: boolean;
  className?: string;
  children?: React.ReactNode;
} & Pick<React.HTMLAttributes<HTMLElement>, "id"> & { [data: `data-${string}`]: string | undefined };

export default function CareStage({ composition, labelledBy, kicker, startHere = true, note, art, artOnPhone = false, heading, figure, aside, wide = false, className, children, ...rest }: CareStageProps) {
  const { t } = useLanguage();
  const desk = composition === "desk";
  const form = desk
    ? <LivingForm src={art} width={196} height={136} crop={{ w: 250, h: 250, x: -27, y: -60 }} />
    : <LivingForm src={art} width={72} height={50} crop={{ w: 90, h: 90, x: -9, y: -21 }} />;
  const head = (kicker || startHere || note) ? (
    <div className="line between care-scene-top">
      <span className="gsec">
        {kicker && <span className="kicker">{kicker}</span>}
        {startHere && <StartHere>{t("elev.learnCare.brief.startHere")}</StartHere>}
      </span>
      {note && <span className="small care-stage-note">{note}</span>}
    </div>
  ) : null;
  const cls = ["care-stage care-scene", desk ? (wide ? "x12" : "x8") : "", className].filter(Boolean).join(" ");
  return (
    <Scene field="care" as="section" aria-labelledby={labelledBy} className={cls} orbs={[...ORBS[desk ? "desk" : "phone"]]} {...rest}>
      {head}
      {desk ? (
        <div className="line care-scene-main">
          {form}
          <div className="stack care-scene-head">
            {heading}
            {figure}
          </div>
          {aside && <div className="care-scene-aside">{aside}</div>}
        </div>
      ) : (
        <>
          {figure ? (
            <>
              {heading}
              <div className="line care-scene-main">
                {form}
                {figure}
              </div>
            </>
          ) : artOnPhone ? (
            <div className="line care-scene-main">
              {form}
              <div className="stack care-scene-head">{heading}</div>
            </div>
          ) : heading}
          {aside}
        </>
      )}
      {children}
    </Scene>
  );
}
