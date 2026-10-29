import { useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { BOOK_READS, type BookRead } from "../../lib/bookReads";
import { bookTomorrowRow, playAtHomeRow, readHandbackDismissed, writeHandbackDismissed, type HandbackDismissed } from "../../lib/kidHandback";
import { playRealKey } from "../kidmode/games/sneakFreeze/handBack";
import type { PracticeEvent } from "../../types";
import { BrandChip } from "../ui/BrandChip";
import Icon from "../ui/Icon";
import { NOW_COPY } from "./nowViewCopy";

/**
 * B-BOOK-66 (mechanism half) + B-GAME-23 — Kid Mode's hand-back on the
 * parent's Today: at most two receipt-sized rows INSIDE the existing "Today at
 * a glance" list (NowAgendaExtras), never a card or a module. The pure rules
 * (yesterday's finished book, the last seven days of play, the firewall) live
 * in lib/kidHandback; this file only renders them.
 *
 *  · the book row: the hero-free cover plate, the book's `tomorrow` line, its
 *    `askAfter` question; "Log it" opens the ONE capture sheet empty, with the
 *    question as the sheet's cue above the field, so the Journal moment is the
 *    parent's own words and only their Save writes it. "Log it" never hides the
 *    row (a cancelled sheet must not lose it): the row stays for its day until
 *    the parent hides it;
 *  · the play row: visits this week, the experiences met, one off-screen idea.
 * Each row hides for this read / sitting on "Hide" (device-local, per child).
 * A separate component like the agenda's other rows (CompanionOfferSlot,
 * FamilyOfferLines): it owns two child collections the list does not read.
 */
export default function NowKidHandback() {
  const { childProfile, openCaptureSheet } = useArbor();
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const copy = NOW_COPY[lang];
  const childId = childProfile.id;
  const reads = useChildCollection<BookRead>(childId, BOOK_READS);
  const events = useChildCollection<PracticeEvent>(childId, "practiceEvents", { orderByField: "timestamp", orderDir: "desc", max: 800 });
  const [state, setState] = useState<{ childId: string; value: HandbackDismissed } | null>(null);
  const dismissed = state?.childId === childId ? state.value : readHandbackDismissed(childId);
  const now = useMemo(() => new Date(), []);
  const firstName = (childProfile.name || "").split(" ")[0] ?? "";
  const book = bookTomorrowRow(reads.items, now, { lang, gender: childProfile.gender, name: firstName }, dismissed);
  const play = playAtHomeRow(events.items, now, dismissed);
  if (!book && !play) return null;
  const hide = (patch: HandbackDismissed) => {
    const next = { ...dismissed, ...patch };
    writeHandbackDismissed(childId, next);
    setState({ childId, value: next });
  };
  const ask = book ? copy.bookRowAsk(t("elev.loop.ms.quoted", { text: book.askAfter })) : "";
  const met = play ? play.experiences.map((x) => copy.playExperience[x]).join(", ") : "";
  return <>
    {book && <div className="now-handback-row" data-testid="today-handback-book">
      {book.cover
        ? <img className="now-handback-cover" src={book.cover} alt="" width={44} height={44} loading="lazy" decoding="async" />
        : <BrandChip icon="auto_stories" tone="lav" shape="arch" />}
      <span className="now-handback-copy">
        <b dir="auto">{copy.bookRowTitle(book.title)}</b>
        <small dir="auto">{book.tomorrow}</small>
        <small dir="auto">{ask}</small>
      </span>
      <span className="now-handback-actions">
        <button type="button" className="now-handback-log" aria-label={copy.logItAria} onClick={() => openCaptureSheet({ mode: "text", cue: ask })}>{copy.logIt}</button>
        <button type="button" className="now-handback-hide" aria-label={copy.hideRow} onClick={() => hide({ book: book.key })}><Icon name="close" size={18} /></button>
      </span>
    </div>}
    {play && <div className="now-handback-row" data-testid="today-handback-play">
      <BrandChip icon="toys" tone="green" shape="drop" />
      <span className="now-handback-copy">
        <b>{copy.playRowTitle}</b>
        <small dir="auto">{copy.playVisits(play.visits)}{met ? ` · ${copy.playMet(met)}` : ""}</small>
        <small dir="auto">{t(playRealKey(firstName, childProfile.gender), { name: firstName })}</small>
      </span>
      <span className="now-handback-actions">
        <button type="button" className="now-handback-hide" aria-label={copy.hideRow} onClick={() => hide({ play: play.key })}><Icon name="close" size={18} /></button>
      </span>
    </div>}
  </>;
}
