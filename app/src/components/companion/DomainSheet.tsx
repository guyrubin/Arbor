import React, { useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { ageMonthsOf } from "../../lib/age/forChild";
import { domainName, type DomainId } from "../../lib/domains/registry";
import { bandForAgeMonths, comparisonAgeMonths, milestoneText } from "../../lib/milestoneData";
import type { ObserveStatus } from "../../lib/milestones/observe";
import { groupMilestonesByShelf, shelfBands } from "../../lib/milestones/shelfMap";
import { shelfLabel, shelvesOfDomain } from "../../lib/shelves/registry";
import type { Milestone } from "../../types";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { Receipt } from "../ui/Receipt";
import { SegmentedAnswers } from "../ui/SegmentedAnswers";
import { Sheet, useCompactSurface } from "../ui/Sheet";
import "./developmentMap.css";

/**
 * v3 FEAT-03 — the domain sheet behind a development-map tile: why the area
 * matters, the skills of the child's current band with Seen it / Not yet /
 * Not sure, the skills coming next as titles to read, and three doors (the
 * 5-minute check, Explore this with Arbor, Open the moments).
 *
 * One record source: the answers write through ArborContext's
 * setMilestoneObservation (lib/milestones/observe, the one write seam), the
 * same milestone documents #/milestones and the map's counts read. The pressed
 * cell is SegmentedAnswers' neutral state mark, never a verdict colour; no
 * answer is counted or totalled here. "Saved." appears only after the write
 * resolves; a write that fails says so and shows no receipt.
 *
 * A bottom Sheet below lg, the centred Modal above (useCompactSurface). The
 * sheet stamps no module and carries no primary move.
 */
const WHY_KEYS: Readonly<Record<DomainId, string>> = {
  talking: "companion.devMap.why.talking",
  moving: "companion.devMap.why.moving",
  hands: "companion.devMap.why.hands",
  thinking: "companion.devMap.why.thinking",
  playing: "companion.devMap.why.playing",
  feelings: "companion.devMap.why.feelings",
  body: "companion.devMap.why.body",
  family: "companion.devMap.why.family",
};

export interface DomainSheetBodyProps {
  domain: DomainId;
  milestones: readonly Milestone[];
  /** The child's current band (preterm-corrected), lib/milestoneData. */
  currentBandMonths: number;
  gender?: string | null;
  /** The write seam; resolves when the answer is stored. */
  onAnswer: (milestoneId: string, status: ObserveStatus) => Promise<unknown> | undefined;
  onCheck: () => void;
  onExplore: () => void;
  onOpenMoments: () => void;
}

export function DomainSheetBody({ domain, milestones, currentBandMonths, gender = null, onAnswer, onCheck, onExplore, onOpenMoments }: DomainSheetBodyProps) {
  const { t, uiLang } = useLanguage();
  const [written, setWritten] = useState<{ id: string; saved: boolean } | null>(null);
  const byShelf = useMemo(() => groupMilestonesByShelf(milestones), [milestones]);
  const shelves = shelvesOfDomain(domain);
  const sections = shelves.map((shelf) => {
    const bands = shelfBands(byShelf[shelf], currentBandMonths);
    return {
      shelf,
      now: bands.filter((b) => b.current).flatMap((b) => b.items),
      own: bands.filter((b) => b.months === -1).flatMap((b) => b.items),
      next: bands.filter((b) => b.later).flatMap((b) => b.items),
    };
  });
  const title = (m: Milestone) => milestoneText(m, "title", t, { gender });
  const answer = (m: Milestone, status: ObserveStatus) => {
    setWritten(null);
    const write = onAnswer(m.id, status);
    if (!write) return;
    write.then(
      () => setWritten({ id: m.id, saved: true }),
      () => setWritten({ id: m.id, saved: false }),
    );
  };
  const skill = (m: Milestone) => (
    <li key={m.id} data-testid="domain-sheet-skill" data-milestone={m.id}>
      <p className="domain-sheet-skill-title" dir="auto">{title(m)}</p>
      <SegmentedAnswers
        className="mt-2"
        ariaLabel={title(m)}
        selected={m.observationStatus ?? (m.checked ? "yes" : null)}
        onAnswer={(status) => answer(m, status)}
      />
      {written?.id === m.id && (written.saved
        ? <Receipt testId="domain-sheet-saved" size="sm" className="mt-1">{t("companion.devMap.saved")}</Receipt>
        : <p className="domain-sheet-failed" role="alert" data-testid="domain-sheet-failed">{t("companion.devMap.saveFailed")}</p>)}
    </li>
  );
  const answerable = sections.some((s) => s.now.length > 0 || s.own.length > 0);
  // Body spans two shelves (Sleep, Food & growth); a heading names each only
  // when both carry rows. The catalogue has no Sleep skill, so Sleep fills
  // from the parent's own rows and Body usually reads as one list.
  const shown = sections.filter((s) => s.now.length + s.own.length + s.next.length > 0);
  return (
    <div className="domain-sheet" data-testid="domain-sheet" data-domain={domain} dir={uiLang === "he" ? "rtl" : "ltr"}>
      <p className="domain-sheet-why">{t(WHY_KEYS[domain])}</p>
      {!answerable && <p className="domain-sheet-empty" data-testid="domain-sheet-empty">{t("companion.devMap.empty")}</p>}
      {shown.map(({ shelf, now, own, next }) => (
        <section key={shelf} className="domain-sheet-shelf" data-shelf={shelf}>
          {shown.length > 1 && <h3>{shelfLabel(shelf, t)}</h3>}
          {now.length > 0 && (
            <>
              <p className="domain-sheet-band">{t("ms.currentBand")}</p>
              <ul className="domain-sheet-skills">{now.map(skill)}</ul>
            </>
          )}
          {own.length > 0 && (
            <>
              <p className="domain-sheet-band">{t("elev.loop.shelf.own")}</p>
              <ul className="domain-sheet-skills">{own.map(skill)}</ul>
            </>
          )}
          {next.length > 0 && (
            <details className="domain-sheet-later" data-testid="domain-sheet-later">
              <summary>
                <span>{t("elev.loop.shelf.next")} · {t("elev.loop.shelf.later")}</span>
                <Icon name="expand_more" size={18} />
              </summary>
              <ul>
                {next.map((m) => <li key={m.id} data-testid="domain-sheet-later-item" dir="auto">{title(m)}</li>)}
              </ul>
            </details>
          )}
        </section>
      ))}
      <div className="domain-sheet-actions">
        <button type="button" data-testid="domain-sheet-check" onClick={onCheck}>
          <Icon name="fact_check" size={20} />
          <span>{t("companion.devMap.check")}</span>
        </button>
        <button type="button" data-testid="domain-sheet-explore" onClick={onExplore}>
          <Icon name="forum" size={20} />
          <span>{t("companion.devMap.explore")}</span>
        </button>
        <button type="button" data-testid="domain-sheet-moments" onClick={onOpenMoments}>
          <Icon name="photo_library" size={20} />
          <span>{t("companion.devMap.moments")}</span>
        </button>
      </div>
    </div>
  );
}

export interface DomainSheetProps {
  /** The open domain; null = closed. */
  domain: DomainId | null;
  onClose: () => void;
  onCheck: () => void;
  onExplore: (domain: DomainId) => void;
  onOpenMoments: (domain: DomainId) => void;
}

export default function DomainSheet({ domain, onClose, onCheck, onExplore, onOpenMoments }: DomainSheetProps) {
  const { childProfile, milestones, setMilestoneObservation } = useArbor();
  const { t } = useLanguage();
  const Surface = useCompactSurface() ? Sheet : Modal;
  const currentBandMonths = bandForAgeMonths(comparisonAgeMonths(ageMonthsOf(childProfile), childProfile.preterm?.gestationalWeeks)).months;
  return (
    <Surface open={domain !== null} onClose={onClose} title={domain ? domainName(domain, t) : undefined} maxWidth="max-w-xl">
      {domain && (
        <DomainSheetBody
          key={domain}
          domain={domain}
          milestones={milestones}
          currentBandMonths={currentBandMonths}
          gender={childProfile.gender ?? null}
          onAnswer={(id, status) => setMilestoneObservation(id, status)}
          onCheck={onCheck}
          onExplore={() => onExplore(domain)}
          onOpenMoments={() => onOpenMoments(domain)}
        />
      )}
    </Surface>
  );
}
