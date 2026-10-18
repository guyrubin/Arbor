import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import type { DomainId } from "../../lib/domains/registry";
import { fmtDay } from "../../lib/formatDate";
import { tGCare } from "../../lib/growthCareText";
import { milestoneText } from "../../lib/milestoneData";
import type { ObserveStatus } from "../../lib/milestones/observe";
import { groupMilestonesByShelf, shelfBands } from "../../lib/milestones/shelfMap";
import { shelfLabel, shelvesOfDomain } from "../../lib/shelves/registry";
import { DOMAIN_VARS } from "../../lib/tokens";
import type { Milestone } from "../../types";
import { Icon } from "../ui/Icon";
import { Receipt } from "../ui/Receipt";
import { SegmentedAnswers } from "../ui/SegmentedAnswers";
import { PARENT_RECORD_COPY } from "./parentRecordCopy";
import { NOTICE_DETAIL_COPY } from "./noticeDetailCopy";
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
 * mock's open area): the day and the parent's own words, ruled in the
 * area's ink. Inline under a row the row already quotes it, so it is absent.
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
}

export default function AreaRowDetail({
  domain, milestones, currentBandMonths, confirmed = true, gender = null, onAnswer, onKeep, onOpenObservation, onAddOwn, watch = null, onUndoWatch = null,
  onCheck, onExplore, onOpenMoments, id, lastMoment = null,
}: AreaRowDetailProps) {
  const { t, uiLang } = useLanguage();
  const copy = PARENT_RECORD_COPY[uiLang === "he" ? "he" : "en"];
  const noticeCopy = NOTICE_DETAIL_COPY[uiLang === "he" ? "he" : "en"];
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
      // Earlier answers stay findable without re-asking every earlier skill.
      earlier: pick((b) => !b.current && !b.later && b.months !== -1)
        .filter((m) => !!m.observationStatus || m.checked === true),
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
      <SegmentedAnswers
        className="mt-2"
        ariaLabel={title(m)}
        selected={m.observationStatus ?? (m.checked ? "yes" : null)}
        disabled={pending !== null}
        onAnswer={(status) => answer(m, status)}
      />
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
      {lastMoment && (
        <p className="area-detail-last" data-testid="area-detail-last" style={{ borderInlineStartColor: DOMAIN_VARS[domain].ink }}>
          <span className="area-detail-last-when">
            {t("companion.milestones.lastMoment")}
            {" · "}
            <time dateTime={lastMoment.at}>{fmtDay(lastMoment.at, uiLang)}</time>
          </span>
          <span dir="auto">{lastMoment.text}</span>
        </p>
      )}
      <p className="area-detail-why">{t(WHY_KEYS[domain])}</p>
      {!confirmed && <p role="status" className="notice-object-note">{noticeCopy.unconfirmed}</p>}
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
      {shown.map(({ shelf, now, own, next, earlier }) => (
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
