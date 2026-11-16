import React from "react";
import { Scene, LivingForm, Fig, StartHere } from "../../../design/primitives";
import type { Composition } from "../../../design/useComposition";
import { useLanguage } from "../../../context/LanguageContext";
import { careCopy } from "./careV10Copy";

/* Care › People, section 1 (design v10.1): Trusted sharing as a scene — the
   page's H1 (production's "Trusted sharing"), its line, and how many people
   the family shares with right now (live grants only, the roster's rule).
   A count of adults the parent chose; nothing about the child. While the
   roster loads, or when nobody holds a share, no figure. */

const ART = "/visuals/parent/v2/area-family-960.webp";

export default function PeopleScene({ composition, title, sub, liveCount, loading }: {
  composition: Composition;
  title: string;
  sub: string;
  liveCount: number;
  loading: boolean;
}) {
  const { t, uiLang } = useLanguage();
  const c = careCopy(uiLang).people;
  const desk = composition === "desk";
  return (
    <Scene
      field="care"
      as="section"
      aria-labelledby="sharing-h1"
      className="care-scene care-people-scene"
      orbs={desk
        ? [{ size: 420, left: -230, bottom: -280, opacity: 0.8 }, { size: 360, right: -180, top: -240, opacity: 0.6, b: true }]
        : [{ size: 250, left: -150, bottom: -160, opacity: 0.8 }, { size: 220, right: -130, top: -140, opacity: 0.55, b: true }]}
    >
      <div className="line between care-scene-top">
        <span className="gsec">
          <span className="kicker">{t("nav.care")}</span>
          <StartHere>{t("elev.learnCare.brief.startHere")}</StartHere>
        </span>
      </div>
      <div className="line care-scene-main">
        {desk
          ? <LivingForm src={ART} width={160} height={110} crop={{ w: 200, h: 200, x: -20, y: -50 }} />
          : <LivingForm src={ART} width={72} height={50} crop={{ w: 90, h: 90, x: -9, y: -21 }} />}
        <div className="stack care-scene-head">
          <h1 id="sharing-h1" className="hero care-h1">{title}</h1>
          <p className="care-sub">{sub}</p>
        </div>
      </div>
      {!loading && (liveCount > 0
        ? <Fig n={liveCount} size={desk ? "md" : "sm"} unit={c.adults(liveCount)} sub={c.adultsSub} />
        : desk ? <p className="care-scene-when">{c.stopWhoNone}</p> : null)}
    </Scene>
  );
}
