import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useHeroAvatar } from "../ui/HeroAvatar";
import { Avatar } from "../ui/Avatar";
import { asksForHero, childPicture } from "../../lib/childPicture";
import ProfileEditDrawer from "../profile/ProfileEditDrawer";
// B-GROWTH-05 — physical measurements (spine domain 7) live here, under Details.
import PhysicalGrowthCard from "./PhysicalGrowthCard";
// B-CAREPRO-06: memory text renders through the same plain-words scrub the
// Story queue uses — the parent never reads a fact in an assessment register.
import { scrubMemoryProposals, toParentWords } from "../../server/parentWordsScrub";
// GP-01: the months-precise age label.
import { formatChildAge } from "../../lib/age/format";
import { fmtDay } from "../../lib/formatDate";
import { useHashQuery } from "../../hooks/useHashQuery";
// v3 F-CHILD-3 — the eight areas and the ONE guided conversation.
import { asAspectId, buildAspects, toldSummary, waitingOffPage, type AspectId } from "../../lib/aboutAspects";
import AspectCard from "../about/AspectCard";
import TellArborMore from "../describe/TellArborMore";
// v3 F-CHILD-4 (MOB-02) — on a phone the pill closes with My child's doors.
import ChildDoors, { useChildPhoneLayout } from "../companion/ChildDoors";
import "../about/about.css";

/**
 * v3 F-CHILD-3 — My child › About (#/profile). The parent tells Arbor about
 * the child in their own words and sees what Arbor already knows:
 *  1. the describe card — "Tell Arbor about {name}", by voice or in writing,
 *     both opening the ONE guided conversation (TellArborMore), and a count
 *     line that says how many areas were told, never against a total;
 *  2. the eight areas — each the newest thing told with its source and day,
 *     or the question Arbor would ask; a proposal waits inside its area with
 *     Confirm / No; "Tell more" opens the conversation on that area; the door
 *     to everything Arbor remembers (#/memory) closes the section;
 *  3. Details — name, age, birth date, born early and measurements, folded
 *     into one row that opens the profile drawer.
 * Goals live on Milestones; the Family Circle lives in Care › Trusted sharing.
 * `?aspect=<id>` opens the conversation on that area (#/language and
 * #/strengths land here). Nothing on the page grades the child: no share, no
 * fill, no "of 8".
 *
 * v3 F-CHILD-4 (MOB-02) — on a phone (below 768 px) the page is the mock's
 * one stack, and it closes with My child's doors (journal, memory, check,
 * Care). The doors' memory door IS the page's one door to #/memory there, so
 * the quiet check line under the areas is wide-screen only: one door per
 * room at every width. The door reads the same waiting queue and is handed
 * the areas, so it speaks only of a proposal no area here shows: the same
 * answer as the wide line.
 */
/** The route's ONE primary move (B-SHELL-26): capture-moment, now on "Tell
 *  Arbor by voice" — telling Arbor one thing, rendered once in every state. */
const CAPTURE_MOVE = { "data-primary-move": "capture-moment" } as const;

type SheetMode = "write" | "voice";
type SheetOpen = { aspect: AspectId | null; mode: SheetMode };

/** A date-only value ("2023-04-10") is read at local noon, so it never shows
 *  the day before west of UTC. */
const dayOf = (value: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);

export default function ChildProfile() {
  const { childProfile, approvedMemoryItems, pendingMemoryItems, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const phone = useChildPhoneLayout();
  // B-SHELL-27: ONE resolver (hero render → photo → initial) — the same face
  // the sidebar and the switcher show; "Create hero" only when there is none.
  const { name: heroName } = useHeroAvatar();
  const picture = childPicture(childProfile);
  const hasHero = !asksForHero(childProfile);
  const first = childProfile.name.split(" ")[0] || childProfile.name;
  const [editingProfile, setEditingProfile] = useState(false);

  // The query wins: `?aspect=lang` opens the conversation on that area. A tap
  // (or closing) is remembered against the query it was made under, so a new
  // `?aspect=` reopens and the same one does not reopen after Close.
  const queryAspect = asAspectId(useHashQuery().get("aspect"));
  const [tap, setTap] = useState<{ from: AspectId | null; open: SheetOpen | null } | null>(null);
  const sheet: SheetOpen | null = tap && tap.from === queryAspect
    ? tap.open
    : queryAspect ? { aspect: queryAspect, mode: "write" } : null;
  const openSheet = (aspect: AspectId | null, mode: SheetMode) => setTap({ from: queryAspect, open: { aspect, mode } });
  const closeSheet = () => setTap({ from: queryAspect, open: null });

  // B-CAREPRO-06: the areas read the scrubbed lists; a fact the scrub drops
  // is not shown here and stays in the ledger (#/memory).
  const aspects = useMemo(() => buildAspects({
    profile: childProfile,
    approved: scrubMemoryProposals(approvedMemoryItems),
    pending: scrubMemoryProposals(pendingMemoryItems),
    words: toParentWords,
  }), [childProfile, approvedMemoryItems, pendingMemoryItems]);
  // A proposal no area shows waits on #/memory (the same scrubbed queue it
  // lists): the door says so in a sentence, no number.
  const waiting = useMemo(() => waitingOffPage(aspects, scrubMemoryProposals(pendingMemoryItems)), [aspects, pendingMemoryItems]);
  const { told, dated } = toldSummary(aspects);
  const toldLine = told === 0
    ? t("companion.about.toldNone")
    : told === 1
    ? t(dated ? "companion.about.toldOne" : "companion.about.toldOneUndated")
    : t(dated ? "companion.about.toldMany" : "companion.about.toldManyUndated", { n: told });

  // Details: name · age · birth date · born early — each its own bidi island.
  const weeks = childProfile.preterm?.gestationalWeeks;
  const detailSegments = [
    childProfile.name,
    formatChildAge(childProfile, t),
    childProfile.birthDate ? t("companion.about.birthDate", { date: fmtDay(dayOf(childProfile.birthDate), uiLang) }) : "",
    typeof weeks === "number" && weeks > 0 && weeks < 37 ? t("companion.about.bornEarly", { weeks }) : "",
  ].filter(Boolean) as string[];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="about-page" data-testid="profile-about">
      {/* 1 — the describe card. No dir on the h1: it keeps text-align:start in
          the PAGE direction; t() isolates the name inside the sentence. */}
      <section data-module="about-describe" data-testid="profile-hub-hero" className="about-describe" aria-labelledby="about-title">
        <div className="about-describe-body">
          <p className="about-kicker">{t("companion.about.kicker", { name: first })}</p>
          <h1 id="about-title">{t("companion.about.title", { name: first })}</h1>
          <p className="about-describe-sub">{t("companion.about.sub")}</p>
          <p className="about-told" data-testid="about-told-line">{toldLine}</p>
          <div className="about-ctas">
            <button type="button" className="about-cta about-cta-primary touch-target" data-testid="about-voice" {...CAPTURE_MOVE} onClick={() => openSheet(null, "voice")}>
              <Icon name="graphic_eq" size={20} />{t("companion.about.voice")}
            </button>
            <button type="button" className="about-cta about-cta-secondary touch-target" data-testid="about-write" onClick={() => openSheet(null, "write")}>
              <Icon name="edit_note" size={20} />{t("companion.about.write")}
            </button>
          </div>
        </div>
        {/* The art panel: area blobs and the hero render or the initial —
            never an uploaded photo here. Decorative. */}
        <div className="about-art" aria-hidden="true" data-testid="about-art">
          <span className="about-art-blob about-art-blob-a" />
          <span className="about-art-blob about-art-blob-b" />
          <span className="about-art-blob about-art-blob-c" />
          <span className="about-art-face">
            {picture.kind === "hero" && picture.url
              ? <img src={picture.url} alt="" />
              : <span className="about-art-initial">{picture.initial}</span>}
          </span>
        </div>
      </section>

      {/* 2 — the eight areas, then the door to everything Arbor remembers. */}
      <section data-module="about-aspects" aria-labelledby="about-aspects-title" className="flex flex-col gap-3">
        <div className="about-aspects-head">
          <p className="about-kicker">{t("companion.about.aspectsKicker")}</p>
          <h2 id="about-aspects-title">{t("companion.about.aspectsTitle")}</h2>
          <p>{t("companion.about.aspectsSub")}</p>
        </div>
        <ul className="about-grid" data-testid="about-aspects">
          {aspects.map((state) => (
            <li key={state.id}>
              <AspectCard state={state} name={first} onTell={(id) => openSheet(id, "write")} onEditDetails={() => setEditingProfile(true)} />
            </li>
          ))}
        </ul>
        {!phone && (
        <button type="button" data-testid="profile-remember-check" onClick={() => setActiveTab("memory")} className="about-memory-door min-h-11">
          <span className="about-memory-door-text">
            <span>{t("elev.profile.remembers.title")}</span>
            {waiting && <span className="about-memory-waiting" data-testid="about-memory-waiting">{t("companion.about.memoryWaiting")}</span>}
          </span>
          <Icon name="chevron_right" size={20} className="rtl:rotate-180" />
        </button>
        )}
      </section>

      {/* 3 — Details: ONE tap — the row opens the profile drawer (name, age,
          birth date, born early). Create hero follows when there is none.
          Measurements are their own closed disclosure: the growth log is not
          in the drawer. The folded log is the route's demoted module (R25). */}
      <section data-module="about-details" className="about-details" data-testid="about-details" aria-label={t("companion.about.details")}>
        <button type="button" data-testid="about-details-edit" onClick={() => setEditingProfile(true)} className="about-details-row min-h-11">
          <Avatar name={childProfile.name} photoURL={picture.url} size={40} />
          <span className="about-details-text">
            <span className="about-details-title">{t("companion.about.details")}</span>
            <span className="about-details-line" data-testid="profile-identity-line">
              {detailSegments.map((seg, i) => (
                <React.Fragment key={i}>
                  {i > 0 && " · "}
                  <bdi dir="auto">{seg}</bdi>
                </React.Fragment>
              ))}
            </span>
          </span>
          <span className="about-details-edit">{t("companion.about.detailsEdit")}</span>
          <Icon name="chevron_right" size={20} className="rtl:rotate-180" />
        </button>
        {!hasHero && <button type="button" onClick={() => setEditingProfile(true)} className="block min-h-11 text-start text-sm font-bold" style={{ color: "var(--arbor-clay)" }}><Icon name="auto_awesome" size={16} className="inline-block me-1" />{t("cp.hero.create", { name: heroName })}<span className="block text-xs font-normal" style={{ color: "var(--arbor-muted)" }}>{t("cp.hero.subline")}</span></button>}
        {/* B-GROWTH-05 — Measurements: the parent-logged growthEntries log,
            the UNCHANGED card, closed by default; the pediatrician packet
            still reads the same collection. */}
        <details data-testid="profile-measurements" data-module-disclosure="about-details" className="about-measurements">
          <summary>
            <Icon name="straighten" size={20} style={{ color: "var(--arbor-muted)" }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("elev.growthTruth.profile.measurements.title")}</span>
              <span className="block text-[12px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.growthTruth.profile.measurements.sub")}</span>
            </span>
            <Icon name="expand_more" size={20} style={{ color: "var(--arbor-muted)" }} />
          </summary>
          <div data-module="about-measurements" data-module-demoted className="about-measurements-body">
            <PhysicalGrowthCard embedded />
          </div>
        </details>
      </section>

      {/* A phone closes the pill with the doors (no data-module: navigation).
          The areas tell the memory door which proposals this page shows. */}
      {phone && <ChildDoors shownAreas={aspects} />}

      {sheet && <TellArborMore key={`${sheet.aspect ?? "all"}-${sheet.mode}`} aspect={sheet.aspect} mode={sheet.mode} onClose={closeSheet} />}
      <ProfileEditDrawer open={editingProfile} onClose={() => setEditingProfile(false)} />
    </motion.div>
  );
}
