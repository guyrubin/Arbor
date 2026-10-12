import React, { useMemo, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import type { DomainId } from "../../lib/domains/registry";
import { fmtDay } from "../../lib/formatDate";
import { tGCare } from "../../lib/growthCareText";
import { milestoneText } from "../../lib/milestoneData";
import type { ObserveStatus } from "../../lib/milestones/observe";
import { groupMilestonesByShelf, shelfBands } from "../../lib/milestones/shelfMap";
import { shelfLabel, shelvesOfDomain } from "../../lib/shelves/registry";
import type { Milestone } from "../../types";
import { Icon } from "../ui/Icon";
import { Receipt } from "../ui/Receipt";
import { SegmentedAnswers } from "../ui/SegmentedAnswers";
import { PARENT_RECORD_COPY } from "./parentRecordCopy";
import "./developmentMap.css";

/**
 * v3 F-CHILD-1 — one area row, opened: why the area matters, the skills of
 * the child's current band (and the parent's own rows) with Seen it / Not yet
 * / Not sure in a two-column grid, the skills coming next as titles to read,
 * an "Add your own" line, and three doors (the 5-minute check, Explore this
 * with Arbor, Open the moments). One body: inline under its row on a wide
 * screen, inside a bottom Sheet on a phone (MilestoneAreas decides).
 *
 * One record source: every answer writes through ArborContext's
 * setMilestoneObservation (lib/milestones/observe, the one write seam), the
 * same documents the row's Seen-it pips read. The pressed cell is
 * SegmentedAnswers' neutral state mark, never a verdict colour. "Saved."
 * appears only after the write resolves; a write that fails says so. After a
 * fresh Seen it resolves, the skill offers a note and a date for the first.
 *
 * The skill the parent chose to watch for (Development Check) leads its area,
 * with the re-check date and a way to stop watching. The detail stamps no
 * module and carries no primary move.
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

export interface AreaWatch {
  milestoneId: string;
  /** The saved re-check date from the Development Check, if any. */
  recheckDueAt?: string | null;
  onStop: () => void;
}

export interface AreaRowDetailProps {
  domain: DomainId;
  milestones: readonly Milestone[];
  /** The child's current band (preterm-corrected), lib/milestoneData. */
  currentBandMonths: number;
  gender?: string | null;
  /** The write seam; resolves when the answer is stored. */
  onAnswer: (milestoneId: string, status: ObserveStatus) => Promise<unknown> | undefined;
  /** Opens the note-and-date keepsake for a first the parent just saw. */
  onKeep?: (milestoneId: string) => void;
  /** Writes a skill the parent names on this area. */
  onAddOwn?: (title: string) => void;
  /** The chosen watch, when its skill files on this area. */
  watch?: AreaWatch | null;
  /** Restores a watch the parent just stopped, when it filed on this area. */
  onUndoWatch?: (() => void) | null;
  onCheck: () => void;
  onExplore: () => void;
  onOpenMoments: () => void;
  /** The id the open row's button points at (aria-controls). */
  id?: string;
}

export default function AreaRowDetail({
  domain, milestones, currentBandMonths, gender = null, onAnswer, onKeep, onAddOwn, watch = null, onUndoWatch = null,
  onCheck, onExplore, onOpenMoments, id,
}: AreaRowDetailProps) {
  const { t, uiLang } = useLanguage();
  const copy = PARENT_RECORD_COPY[uiLang === "he" ? "he" : "en"];
  const [written, setWritten] = useState<{ id: string; saved: boolean; fresh: boolean } | null>(null);
  const [draft, setDraft] = useState("");
  const byShelf = useMemo(() => groupMilestonesByShelf(milestones), [milestones]);
  const shelves = shelvesOfDomain(domain);
  const watched = watch ? shelves.flatMap((shelf) => byShelf[shelf]).find((m) => m.id === watch.milestoneId) ?? null : null;
  const sections = shelves.map((shelf) => {
    const bands = shelfBands(byShelf[shelf], currentBandMonths);
    const pick = (keep: (b: (typeof bands)[number]) => boolean) =>
      bands.filter(keep).flatMap((b) => b.items).filter((m) => m.id !== watched?.id);
    return {
      shelf,
      now: pick((b) => b.current),
      own: pick((b) => b.months === -1),
      next: pick((b) => b.later),
    };
  });
  const title = (m: Milestone) => milestoneText(m, "title", t, { gender });
  const answer = (m: Milestone, status: ObserveStatus) => {
    setWritten(null);
    const wasSeen = m.checked === true || m.observationStatus === "yes";
    const write = onAnswer(m.id, status);
    if (!write) return;
    write.then(
      () => setWritten({ id: m.id, saved: true, fresh: status === "yes" && !wasSeen }),
      () => setWritten({ id: m.id, saved: false, fresh: false }),
    );
  };
  const skill = (m: Milestone, lead?: React.ReactNode) => (
    <li key={m.id} className="area-detail-skill" data-testid="area-detail-skill" data-milestone={m.id}>
      {lead}
      <p className="area-detail-skill-title" dir="auto">{title(m)}</p>
      <SegmentedAnswers
        className="mt-2"
        ariaLabel={title(m)}
        selected={m.observationStatus ?? (m.checked ? "yes" : null)}
        onAnswer={(status) => answer(m, status)}
      />
      {written?.id === m.id && (written.saved
        ? <Receipt testId="area-detail-saved" size="sm" className="mt-1">{t("companion.devMap.saved")}</Receipt>
        : <p className="area-detail-failed" role="alert" data-testid="area-detail-failed">{t("companion.devMap.saveFailed")}</p>)}
      {written?.id === m.id && written.saved && written.fresh && onKeep && (
        <button type="button" className="area-detail-keep" data-testid="area-detail-keep" onClick={() => onKeep(m.id)}>
          <Icon name="bookmark_add" size={16} />
          <span>{t("elev.waveR.keepsake.add")}</span>
        </button>
      )}
    </li>
  );
  const answerable = !!watched || sections.some((s) => s.now.length > 0 || s.own.length > 0);
  // Body spans two shelves (Sleep, Food & growth); a heading names each only
  // when both carry rows.
  const shown = sections.filter((s) => s.now.length + s.own.length + s.next.length > 0);
  const addOwn = (event: React.FormEvent) => {
    event.preventDefault();
    const words = draft.trim();
    if (!words || !onAddOwn) return;
    onAddOwn(words);
    setDraft("");
  };
  return (
    <div className="area-detail" id={id} data-testid="area-detail" data-domain={domain} dir={uiLang === "he" ? "rtl" : "ltr"}>
      <p className="area-detail-why">{t(WHY_KEYS[domain])}</p>
      {watched && (
        <ul className="area-detail-skills area-detail-watch" data-testid="area-detail-watch">
          {skill(watched, (
            <p className="area-detail-band">{copy.chosenFocus}</p>
          ))}
          <li className="area-detail-watch-meta">
            {watch?.recheckDueAt && (
              <p className="area-detail-recheck" data-testid="area-detail-recheck">{t("elev.growth.recheck.date", { date: fmtDay(watch.recheckDueAt, uiLang) })}</p>
            )}
            <button type="button" className="area-detail-text" data-testid="area-detail-unwatch" onClick={watch?.onStop}>
              <Icon name="visibility_off" size={16} />
              <span>{tGCare(uiLang, "elev.gcare.growth.watch.clear")}</span>
            </button>
          </li>
        </ul>
      )}
      {onUndoWatch && (
        <div className="area-detail-undo" role="status">
          <span>{copy.watchCleared}</span>
          <button type="button" className="area-detail-text" data-testid="area-detail-watch-undo" onClick={onUndoWatch}>
            <Icon name="undo" size={16} />
            <span>{copy.undo}</span>
          </button>
        </div>
      )}
      {!answerable && <p className="area-detail-empty" data-testid="area-detail-empty">{t("companion.devMap.empty")}</p>}
      {shown.map(({ shelf, now, own, next }) => (
        <section key={shelf} className="area-detail-shelf" data-shelf={shelf}>
          {shown.length > 1 && <h3>{shelfLabel(shelf, t)}</h3>}
          {now.length > 0 && (
            <>
              <p className="area-detail-band">{t("ms.currentBand")}</p>
              <ul className="area-detail-skills">{now.map((m) => skill(m))}</ul>
            </>
          )}
          {own.length > 0 && (
            <>
              <p className="area-detail-band">{t("elev.loop.shelf.own")}</p>
              <ul className="area-detail-skills">{own.map((m) => skill(m))}</ul>
            </>
          )}
          {next.length > 0 && (
            <details className="area-detail-later" data-testid="area-detail-later">
              <summary>
                <span>{t("elev.loop.shelf.next")} · {t("elev.loop.shelf.later")}</span>
                <Icon name="expand_more" size={18} />
              </summary>
              <ul>
                {next.map((m) => <li key={m.id} data-testid="area-detail-later-item" dir="auto">{title(m)}</li>)}
              </ul>
            </details>
          )}
        </section>
      ))}
      {onAddOwn && (
        <form className="area-detail-add" data-testid="area-detail-add" onSubmit={addOwn}>
          <input
            type="text"
            className="area-detail-add-input"
            data-testid="area-detail-add-input"
            dir="auto"
            maxLength={120}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("companion.milestones.addOwnHint")}
            aria-label={t("companion.milestones.addOwn")}
          />
          <button type="submit" className="area-detail-add-save" data-testid="area-detail-add-save" disabled={!draft.trim()}>
            <Icon name="add" size={18} />
            <span>{t("companion.milestones.addOwn")}</span>
          </button>
        </form>
      )}
      <div className="area-detail-actions">
        <button type="button" className="area-detail-check" data-testid="area-detail-check" onClick={onCheck}>
          <Icon name="fact_check" size={18} />
          <span>{t("companion.milestones.check")}</span>
        </button>
        <button type="button" className="area-detail-explore" data-testid="area-detail-explore" onClick={onExplore}>
          <Icon name="forum" size={18} />
          <span>{t("companion.devMap.explore")}</span>
        </button>
        <button type="button" className="area-detail-moments" data-testid="area-detail-moments" onClick={onOpenMoments}>
          <Icon name="photo_library" size={18} />
          <span>{t("companion.devMap.moments")}</span>
        </button>
      </div>
    </div>
  );
}
