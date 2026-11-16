import React from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useHeroAvatar } from "../ui/HeroAvatar";
import { Avatar } from "../ui/Avatar";
import { asksForHero, childPicture } from "../../lib/childPicture";
import { formatChildAge } from "../../lib/age/format";
import { fmtDay } from "../../lib/formatDate";
import { languageName } from "../../lib/languageName";
import { Icon } from "../ui/Icon";
import { GlyphChip } from "../../design/primitives";
import AboutLastVisit from "./AboutLastVisit";
import { aboutCopy } from "./aboutViewCopy";

/** A date-only value ("2023-04-10") is read at local noon, so it never shows
 *  the day before west of UTC. */
const dayOf = (value: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);

/**
 * v10.1 — the child's own tile on About: who the child is (name, age, birth
 * date, born early, languages), Edit details (the profile drawer, one tap),
 * Create hero when there is none, Measurements (the parent-logged growth log,
 * a disclosure that opens in the tile), the last visit as one line, and Moments and
 * keepsakes (the notebook's keepsakes fold). Each segment is its own bidi
 * island.
 */
export default function AboutChildTile({ onEditDetails, measurements, onKeepsakes, compact }: {
  onEditDetails: () => void;
  /** The Measurements disclosure (owned by the page: it is the route's one disclosure). */
  measurements: React.ReactNode;
  onKeepsakes: () => void;
  /** Phone: name · age in the heading, one line of details. */
  compact?: boolean;
}) {
  const { childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const copy = aboutCopy(uiLang);
  const { name: heroName } = useHeroAvatar();
  const picture = childPicture(childProfile);
  const first = childProfile.name.split(" ")[0] || childProfile.name;
  const age = formatChildAge(childProfile, t);
  const weeks = childProfile.preterm?.gestationalWeeks;
  const details = [
    childProfile.birthDate ? t("companion.about.birthDate", { date: fmtDay(dayOf(childProfile.birthDate), uiLang) }) : "",
    typeof weeks === "number" && weeks > 0 && weeks < 37 ? t("companion.about.bornEarly", { weeks }) : "",
    (childProfile.languages ?? []).map((l) => languageName(l, t)).join(" · "),
  ].filter(Boolean) as string[];
  const identity = [childProfile.name, age, ...details];
  return (
    <section className="vt about-child" data-testid="about-details" aria-labelledby="about-child-title">
      <div className="vh">
        <GlyphChip icon="person" kind="date" />
        <h3 className="h3" id="about-child-title">{compact ? copy.identity(first, age) : first}</h3>
      </div>
      <div className="line about-child-id">
        {!compact && <Avatar name={childProfile.name} photoURL={picture.url} size={40} />}
        <span className="about-child-text" data-testid="profile-identity-line">
          {(compact ? details : identity).map((seg, i) => (
            <React.Fragment key={i}>
              {i > 0 && " · "}
              <bdi dir="auto">{seg}</bdi>
            </React.Fragment>
          ))}
        </span>
      </div>
      <div className="line wrap about-child-btns">
        <button type="button" className="btn sm nowrap about-btn-tint touch-target" data-testid="about-details-edit" onClick={onEditDetails}>{t("companion.about.detailsEdit")}</button>
        {asksForHero(childProfile) && (
          <button type="button" className="btn sm ghost nowrap about-btn-card touch-target" data-testid="about-hero-create" onClick={onEditDetails}>
            {t("cp.hero.create", { name: heroName })}
          </button>
        )}
        {measurements}
      </div>
      <AboutLastVisit />
      <button type="button" className="rowlink about-keepsakes touch-target" data-testid="about-keepsakes" onClick={onKeepsakes}>
        <GlyphChip icon="bookmark" />
        <span className="about-keepsakes-text"><b>{t("elev.childmem.more.title")}</b><span>{t("elev.childmem.more.sub")}</span></span>
        <Icon name="chevron_right" size={16} className="rtl:-scale-x-100" />
      </button>
    </section>
  );
}
