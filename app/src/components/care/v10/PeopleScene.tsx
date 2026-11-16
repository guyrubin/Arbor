import React from "react";
import { Fig } from "../../../design/primitives";
import CareStage from "./CareStage";
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
    <CareStage
      composition={composition}
      labelledBy="sharing-h1"
      className="care-people-scene"
      kicker={t("nav.care")}
      art={ART}
      artOnPhone
      heading={<div className="stack care-heading"><h1 id="sharing-h1" className="hero care-h1">{title}</h1><p className="care-sub">{sub}</p></div>}
      figure={loading ? null : liveCount > 0
        ? <Fig n={liveCount} size={desk ? "xl" : "md"} unit={c.adults(liveCount)} sub={c.adultsSub} />
        : desk ? <p className="care-scene-when">{c.stopWhoNone}</p> : null}
    />
  );
}
