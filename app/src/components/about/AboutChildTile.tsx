import React from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useHeroAvatar } from "../ui/HeroAvatar";
import { Avatar } from "../ui/Avatar";
import { asksForHero, childPicture } from "../../lib/childPicture";
import { formatChildAge } from "../../lib/age/format";
import { fmtDayFirst as fmtDay } from "../../lib/formatDate";
import { languageName } from "../../lib/languageName";
import { Icon } from "../ui/Icon";
import AboutLastVisit from "./AboutLastVisit";
import { aboutCopy } from "./aboutViewCopy";

/** A date-only value ("2023-04-10") is read at local noon, so it never shows
 *  the day before west of UTC. */
const dayOf = (value: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);

/**
 * v10.3 — the child's row on About (stop 3): who the child is (name · age,
 * birth date, born early, languages, each its own bidi island), Edit details
 * (the profile drawer, one tap), Create hero when there is none, Measurements
 * (the route's one disclosure, handed in by the page), then three ways on:
 * Moments and keepsakes (the notebook's keepsakes fold), Everything Arbor
 * remembers (the notebook, in place) and How Arbor works.
 */
export default function AboutChildTile({ onEditDetails, measurements, onKeepsakes, onLedger, ledgerOpen, onHowItWorks, compact }: {
  onEditDetails: () => void;
  /** The Measurements disclosure (owned by the page: it is the route's one disclosure). */
  measurements: React.ReactNode;
  onKeepsakes: () => void;
  /** The ONE door to everything Arbor remembers (the ledger opens in place). */
  onLedger: () => void;
  ledgerOpen: boolean;
  onHowItWorks: () => void;
  /** Phone: one column, the last visit among the links. */
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
  const go = (label: React.ReactNode, onClick: () => void, extra?: Record<string, unknown>) => (
    <button type="button" className="mbtn about-go touch-target" onClick={onClick} {...extra}>
      <span>{label}</span><Icon name="chevron_right" size={16} className="rtl:-scale-x-100" />
    </button>
  );
  return (
    <section className="vt about-child" data-testid="about-details" aria-labelledby="about-child-title">
      <div className="about-child-top">
        <div className="line about-child-id">
          <Avatar name={childProfile.name} photoURL={picture.url} size={40} />
          <span className="about-child-text">
            <h3 className="about-child-name" id="about-child-title">{copy.identity(first, age)}</h3>
            <span data-testid="profile-identity-line">
              {[childProfile.name, ...details].map((seg, i) => (
                <React.Fragment key={i}>
                  {i > 0 && " · "}
                  <bdi dir="auto">{seg}</bdi>
                </React.Fragment>
              ))}
            </span>
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
      </div>
      <div className={compact ? "about-child-links m" : "about-child-links"}>
        {compact && <AboutLastVisit />}
        {go(t("elev.childmem.more.title"), onKeepsakes, { "data-testid": "about-keepsakes" })}
        {go(<span data-testid="profile-remember-check" aria-expanded={ledgerOpen} aria-controls="about-memory-ledger">{t("companion.about.memory.open")}</span>, onLedger, { className: "mbtn about-go about-ledger-door touch-target" })}
        {go(t("nav.view.science"), onHowItWorks)}
      </div>
    </section>
  );
}
