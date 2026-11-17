import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import type { DomainId } from "../../lib/domains/registry";
import { fmtDay, fmtDayV10 } from "../../lib/formatDate";
import { tGCare } from "../../lib/growthCareText";
import { milestoneText } from "../../lib/milestoneData";
import type { ObserveStatus } from "../../lib/milestones/observe";
import { groupMilestonesByShelf, shelfBands } from "../../lib/milestones/shelfMap";
import { shelfOfMilestone } from "../../lib/milestones/selectByShelf";
import { shelfLabel, shelvesOfDomain } from "../../lib/shelves/registry";
import type { Milestone } from "../../types";
import { Icon } from "../ui/Icon";
import { Receipt } from "../ui/Receipt";
import { SegmentedAnswers } from "../ui/SegmentedAnswers";
import { PARENT_RECORD_COPY } from "./parentRecordCopy";
import { NOTICE_DETAIL_COPY } from "./noticeDetailCopy";
import { milestonesV10Copy } from "./milestonesV10Copy";
import { bandLabel, milestoneAgeLine } from "../../lib/milestoneAgeLine";
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
 *
 * v3 F-CHILD-4 (MOB-02): in the phone sheet the tile it opened from has no
 * room to quote the area's newest moment, so the sheet opens on it (the
 * mock's open area): the day and the parent's own words, on a neutral rule.
 * v10.1: no area picture and no area ink on Milestones (one accent, glyph and
 * name tell the areas apart).
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

/** The skills an open area lists to mark (its current band and the parent's own rows). Pure. */
export function areaRowIds(milestones: readonly Milestone[], domain: DomainId, currentBandMonths: number): Set<string> {
  const byShelf = groupMilestonesByShelf([...milestones]);
  return new Set(shelvesOfDomain(domain).flatMap((shelf) =>
    shelfBands(byShelf[shelf], currentBandMonths).filter((b) => b.current || b.months === -1).flatMap((b) => b.items.map((m) => m.id))));
}

/**
 * V77 "Earlier and later": the skill just before and just after this one on
 * its shelf (the nearest lower and higher catalogue band), for reading only.
 * Pure.
 */
export function shelfNeighbours(m: Milestone, shelfItems: readonly Milestone[]): { earlier: Milestone | null; later: Milestone | null } {
  const age = m.ageMonths;
  if (typeof age !== "number" || m.custom) return { earlier: null, later: null };
  const banded = shelfItems.filter((x) => !x.custom && typeof x.ageMonths === "number" && x.id !== m.id);
  const lower = banded.filter((x) => x.ageMonths! < age);
  const higher = banded.filter((x) => x.ageMonths! > age);
  const lowBand = lower.length ? Math.max(...lower.map((x) => x.ageMonths!)) : null;
  const highBand = higher.length ? Math.min(...higher.map((x) => x.ageMonths!)) : null;
  return {
    earlier: lowBand === null ? null : lower.find((x) => x.ageMonths === lowBand) ?? null,
    later: highBand === null ? null : higher.find((x) => x.ageMonths === highBand) ?? null,
  };
}

/**
 * V77 "Earlier and later" (reading only): the production age line, then the
 * nearest earlier and later skill on the same shelf, each with "by <age>".
 * Nothing when none of the three exists.
 */
export function EarlierLater({ milestone: m, milestones, gender = null }: { milestone: Milestone; milestones: readonly Milestone[]; gender?: string | null }) {
  const { t, uiLang } = useLanguage();
  const v10Copy = milestonesV10Copy(uiLang);
  const shelf = shelfOfMilestone(m);
  const items = useMemo(() => (shelf ? groupMilestonesByShelf([...milestones])[shelf] : []), [milestones, shelf]);
  const { earlier, later } = shelfNeighbours(m, items);
  const age = milestoneAgeLine(m, t);
  if (!earlier && !later && !age) return null;
  const col = (label: string, n: Milestone | null) => {
    if (!n) return null;
    const by = bandLabel(n.ageMonths, t);
    return <div><dt>{label}</dt><dd><span dir="auto">{milestoneText(n, "title", t, { gender })}</span>{by && <span className="area-detail-by">{v10Copy.byAge.replace("{age}", by)}</span>}</dd></div>;
  };
  return (
    <details className="area-detail-around" data-testid="area-detail-around">
      <summary><span>{v10Copy.earlierLater}</span><Icon name="expand_more" size={18} /></summary>
      {age && <p className="area-detail-age">{age}</p>}
      {(earlier || later) && <dl className="area-detail-cols">{col(v10Copy.earlier, earlier)}{col(v10Copy.later, later)}</dl>}
    </details>
  );
}

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
  /** A cached or pending snapshot cannot show an acknowledged-save receipt. */
  confirmed?: boolean;
  gender?: string | null;
  /** The write seam; resolves when the answer is stored. */
  onAnswer: (milestoneId: string, status: ObserveStatus) => Promise<unknown> | undefined;
  /** Opens the note-and-date keepsake for a first the parent just saw. */
  onKeep?: (milestoneId: string) => void;
  /** Opens the same child-scoped object reached from Now and Moments. */
  onOpenObservation?: (milestoneId: string) => void;
  /** Writes a skill the parent names on this area; resolves once it is stored. */
  onAddOwn?: (title: string) => Promise<unknown>;
  /** The chosen watch, when its skill files on this area. */
  watch?: AreaWatch | null;
  /** Restores a watch the parent just stopped, when it filed on this area. */
  onUndoWatch?: (() => void) | null;
  onCheck: () => void;
  onExplore: () => void;
  onOpenMoments: () => void;
  /** The id the open row's button points at (aria-controls). */
  id?: string;
  /** The area's newest moment (the sheet's opening line); absent inline. */
  lastMoment?: { at: string; text: string } | null;
  /** V77 board: no area sentence, "Next to notice", each row with its words
   *  and an Earlier and later disclosure (reading only). */
  v10?: boolean;
}

export default function AreaRowDetail({
  domain, milestones, currentBandMonths, confirmed = true, gender = null, onAnswer, onKeep, onOpenObservation, onAddOwn, watch = null, onUndoWatch = null,
  onCheck, onExplore, onOpenMoments, id, lastMoment = null, v10 = false,
}: AreaRowDetailProps) {
  const { t, uiLang } = useLanguage();
  const copy = PARENT_RECORD_COPY[uiLang === "he" ? "he" : "en"];
  const noticeCopy = NOTICE_DETAIL_COPY[uiLang === "he" ? "he" : "en"];
  const v10Copy = milestonesV10Copy(uiLang);
  const [written, setWritten] = useState<{ id: string; saved: boolean; fresh: boolean; queued?: boolean } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const lifetime = useRef({ active: true, pending: false });
  useEffect(() => {
    lifetime.current.active = true;
    return () => { lifetime.current.active = false; };
  }, []);
  const [draft, setDraft] = useState("");
  // "Add your own": the line clears only after the row was stored; a failed
  // write keeps the parent's words and says so.
  const [adding, setAdding] = useState<"idle" | "pending" | "failed">("idle");
  const byShelf = useMemo(() => groupMilestonesByShelf(milestones), [milestones]);
  const isSeen = (m: Milestone) => m.observationStatus === "yes" || (!m.observationStatus && m.checked === true);
  const shelves = shelvesOfDomain(domain);
  const watched = watch ? shelves.flatMap((shelf) => byShelf[shelf]).find((m) => m.id === watch.milestoneId) ?? null : null;
  // V77: an area with nothing marked Seen yet asks "Mark what you have seen".
  const areaSeen = shelves.some((shelf) => byShelf[shelf].some(isSeen));
  const sections = shelves.map((shelf) => {
    const bands = shelfBands(byShelf[shelf], currentBandMonths);
    const pick = (keep: (b: (typeof bands)[number]) => boolean) =>
      bands.filter(keep).flatMap((b) => b.items).filter((m) => m.id !== watched?.id);
    // A skill already marked Seen it is on the area's dated line above; it is
    // not asked again here but stays one tap away under Your earlier answers.
    const seenNow = onOpenObservation ? pick((b) => b.current).filter(isSeen) : [];
    return {
      shelf,
      now: pick((b) => b.current).filter((m) => !seenNow.includes(m)),
      own: pick((b) => b.months === -1),
      next: pick((b) => b.later),
      // Earlier answers stay findable without re-asking every earlier skill.
      earlier: [...seenNow, ...pick((b) => !b.current && !b.later && b.months !== -1)
        .filter((m) => !!m.observationStatus || m.checked === true)],
    };
  });
  const title = (m: Milestone) => milestoneText(m, "title", t, { gender });
  const answer = (m: Milestone, status: ObserveStatus) => {
    if (!lifetime.current.active || lifetime.current.pending) return;
    setWritten(null);
    const wasSeen = m.checked === true || m.observationStatus === "yes";
    const write = onAnswer(m.id, status);
    if (!write) return;
    lifetime.current.pending = true;
    setPending(m.id);
    const finish = (saved: boolean, error?: unknown) => {
      lifetime.current.pending = false;
      if (!lifetime.current.active) return;
      setPending(null);
      setWritten({ id: m.id, saved, fresh: saved && status === "yes" && !wasSeen,
        queued: error instanceof Error && /write (?:needs an online confirmation|was not confirmed)/.test(error.message) });
    };
    write.then(
      () => finish(true),
      (error) => finish(false, error),
    );
  };
  const skill = (m: Milestone, lead?: React.ReactNode) => (
    <li key={m.id} className="area-detail-skill" data-testid="area-detail-skill" data-milestone={m.id}>
      {lead}
      {onOpenObservation ? <button type="button" className="area-detail-skill-open" data-testid="area-detail-open-observation" onClick={() => onOpenObservation(m.id)} aria-label={`${noticeCopy.open}: ${title(m)}`}>
        <span className="area-detail-skill-title" dir="auto">{title(m)}</span>
        <Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" />
      </button> : <p className="area-detail-skill-title" dir="auto">{title(m)}</p>}
      {v10 && (() => {
        const words = milestoneText(m, "desc", t, { gender });
        return words && words !== title(m) ? <p className="area-detail-skill-words" data-testid="area-detail-skill-words" dir="auto">{words}</p> : null;
      })()}
      <SegmentedAnswers
        className="mt-2"
        ariaLabel={title(m)}
        selected={m.observationStatus ?? (m.checked ? "yes" : null)}
        disabled={pending !== null}
        onAnswer={(status) => answer(m, status)}
      />
      {v10 && <EarlierLater milestone={m} milestones={milestones} gender={gender} />}
      {pending === m.id && <p role="status" className="notice-object-note" data-testid="area-detail-saving">{noticeCopy.saving}</p>}
      {written?.id === m.id && (written.saved
        ? confirmed && <Receipt testId="area-detail-saved" size="sm" className="mt-1">{t("companion.devMap.saved")}</Receipt>
        : written.queued ? <p className="notice-object-note" role="status" data-testid="area-detail-queued">{noticeCopy.pending}</p>
        : <p className="area-detail-failed" role="alert" data-testid="area-detail-failed">{t("companion.devMap.saveFailed")}</p>)}
      {written?.id === m.id && written.saved && written.fresh && confirmed && onKeep && (
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
  const shown = sections.filter((s) => s.now.length + s.own.length + s.next.length + s.earlier.length > 0);
  const addOwn = (event: React.FormEvent) => {
    event.preventDefault();
    const words = draft.trim();
    if (!words || !onAddOwn || adding === "pending") return;
    setAdding("pending");
    onAddOwn(words).then(
      () => {
        setAdding("idle");
        // Words typed while the write was in flight are the parent's next line: keep them.
        setDraft((current) => (current.trim() === words ? "" : current));
      },
      () => setAdding("failed"),
    );
  };
  return (
    <div className="area-detail" id={id} data-testid="area-detail" data-domain={domain} dir={uiLang === "he" ? "rtl" : "ltr"}>
      {lastMoment && !v10 && (
        <p className="area-detail-last" data-testid="area-detail-last">
          <span className="area-detail-last-when">
            {t("companion.milestones.lastMoment")}
            {" · "}
            <time dateTime={lastMoment.at}>{fmtDay(lastMoment.at, uiLang)}</time>
          </span>
          <span dir="auto">{lastMoment.text}</span>
        </p>
      )}
      {!v10 && <div className="area-detail-intro">
        <p className="area-detail-why">{t(WHY_KEYS[domain])}</p>
      </div>}
      {!confirmed && <p role="status" className="notice-object-note">{noticeCopy.unconfirmed}</p>}
      {watched && (
        <ul className="area-detail-skills area-detail-watch" data-testid="area-detail-watch">
          {skill(watched, (
            <p className="area-detail-band">{copy.chosenFocus}</p>
          ))}
          <li className="area-detail-watch-meta">
            {watch?.recheckDueAt && (
              <p className="area-detail-recheck" data-testid="area-detail-recheck">{t("elev.growth.recheck.date", { date: fmtDayV10(watch.recheckDueAt, uiLang) })}</p>
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
      {shown.map(({ shelf, now, own, next, earlier }) => (
        <section key={shelf} className="area-detail-shelf" data-shelf={shelf}>
          {shown.length > 1 && <h3>{shelfLabel(shelf, t)}</h3>}
          {now.length > 0 && (
            <>
              <p className="area-detail-band">{v10 ? (areaSeen ? v10Copy.nextToNotice : v10Copy.markSeen) : t("ms.currentBand")}</p>
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
          {earlier.length > 0 && onOpenObservation && (
            <details className="area-detail-later" data-testid="area-detail-earlier-answers">
              <summary><span>{noticeCopy.earlier}</span><Icon name="expand_more" size={18} /></summary>
              <ul>{earlier.map((m) => <li key={m.id}><button type="button" className="area-detail-skill-open" onClick={() => onOpenObservation(m.id)}>
                <span dir="auto">{title(m)}</span><Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" />
              </button></li>)}</ul>
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
            onChange={(event) => { setDraft(event.target.value); if (adding === "failed") setAdding("idle"); }}
            placeholder={t("companion.milestones.addOwnHint")}
            aria-label={t("companion.milestones.addOwn")}
          />
          <button
            type="submit"
            className="area-detail-add-save"
            data-testid="area-detail-add-save"
            disabled={!draft.trim() || adding === "pending"}
            aria-busy={adding === "pending" || undefined}
          >
            <Icon name="add" size={18} />
            <span>{t("companion.milestones.addOwn")}</span>
          </button>
          {adding === "failed" && (
            <p className="area-detail-failed area-detail-add-failed" role="alert" data-testid="area-detail-add-failed">{t("companion.devMap.saveFailed")}</p>
          )}
        </form>
      )}
      <div className="area-detail-actions">
        <button type="button" className="area-detail-check" data-testid="area-detail-check" onClick={onCheck}>
          <Icon name="fact_check" size={18} />
          <span>{t("companion.milestones.checkArea")}</span>
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
