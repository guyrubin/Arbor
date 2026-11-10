/**
 * B-PROG-16 — the next-day handback of the one shared book.
 *
 * Mounted on Now only while `arbor.flags.programSharedObject` is "1".
 * Cover words, one thing for tomorrow, and a question the parent can ask.
 * Dismiss hides it. Save writes the parent's own sentence to the journal,
 * with no prefix and no script. The read ledger has no path to copy.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { activeProgramWeek } from "../../lib/programs/enrolment";
import { resolveHebrewSlash } from "../../lib/hebrewSlashGender";
import { activePlans, planShelf } from "../../lib/plans/planWeek";
import { LibraryBookCover } from "../kidmode/LibraryBookCover";
import { useParentBookLibrary } from "./useParentBookLibrary";
import { ownedHandbackBook, reviewedParentBooks } from "../../lib/programs/parentBookLibrary";
import { BOOK_READS, type BookRead } from "../../lib/bookReads";
import { useNowClock } from "../companion/useNowClock";
import {
  bookHandback,
  catalogueSharedObjects,
  dismissHandback,
  readDismissedHandbacks,
  type BookHandback,
} from "../../lib/programs/sharedObject";

type Store = { getItem(key: string): string | null; setItem(key: string, value: string): void } | null;

function deviceStore(): Store {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export interface HandbackLabels {
  handback: string;
  tomorrow: string;
  ask: string;
  dismiss: string;
  save: string;
  words: string;
  placeholder: string;
  saveError: string;
}

export function ProgramBookHandbackView({
  card, lang, labels, onDismiss, onSave, cover,
}: {
  card: BookHandback;
  cover?: React.ReactNode;
  lang: "en" | "he";
  labels: HandbackLabels;
  onDismiss: () => void;
  onSave: (text: string) => Promise<boolean>;
}) {
  const [words, setWords] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const writing = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const text = words.trim();
  const save = async () => {
    if (!text || writing.current || !mounted.current) return;
    writing.current = true;
    setSaving(true);
    setFailed(false);
    try {
      const ok = await onSave(text);
      if (mounted.current && !ok) setFailed(true);
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      writing.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  return (
    <section className="now-handback" data-testid="program-book-handback" dir={lang === "he" ? "rtl" : "ltr"} aria-label={labels.handback}>
      <p className="now-handback-kicker">{labels.handback}</p>
      {cover && <div className="now-handback-art" data-testid="program-book-owned-cover">{cover}</div>}
      <p className="now-handback-title" dir="auto"><bdi>{card.title}</bdi></p>
      <p className="now-handback-line" dir="auto" data-testid="program-book-cover"><bdi>{card.coverLine}</bdi></p>
      <p className="now-handback-line" dir="auto" data-testid="program-book-tomorrow"><span className="now-handback-kicker">{labels.tomorrow}</span> <bdi>{card.tomorrow}</bdi></p>
      <p className="now-handback-line" dir="auto" data-testid="program-book-ask"><span className="now-handback-kicker">{labels.ask}</span> <bdi>{card.askAfter}</bdi></p>
      <label className="now-handback-label">
        {labels.words}
        <textarea className="now-handback-words" dir="auto" maxLength={500} value={words} disabled={saving} placeholder={labels.placeholder} onChange={(e) => { setWords(e.target.value); setFailed(false); }} />
      </label>
      <div className="now-handback-actions">
        <button type="button" className="min-h-11" data-testid="program-book-dismiss" disabled={saving} onClick={() => { if (!writing.current && mounted.current) onDismiss(); }}>{labels.dismiss}</button>
        <button type="button" className="min-h-11 now-handback-save" data-testid="program-book-save" disabled={!text || saving} onClick={() => { void save(); }}>{labels.save}</button>
      </div>
      {failed && <p className="now-handback-error" role="alert">{labels.saveError}</p>}
    </section>
  );
}

/** The Now card. Renders nothing unless yesterday's read is the week's one object. */
export default function ProgramBookHandback() {
  const { childProfile } = useArbor();
  const { user, firebaseEnabled, loading } = useAuth();
  if (firebaseEnabled && (loading || !user)) return null;
  const ownerId = firebaseEnabled ? user!.uid : "local-sandbox";
  return <ScopedProgramBookHandback key={JSON.stringify([ownerId, childProfile.id])} ownerId={ownerId} />;
}

function ScopedProgramBookHandback({ ownerId }: { ownerId: string }) {
  const { childProfile, addMoment } = useArbor();
  const { t, uiLang } = useLanguage();
  const now = useNowClock();
  const lang = uiLang === "he" ? "he" : "en";
  const programs = useChildCollection<{ id: string }>(childProfile.id, "programs");
  const reads = useChildCollection<BookRead>(childProfile.id, BOOK_READS);
  const library = useParentBookLibrary(childProfile.id, now);
  const planRows = library.plans;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [dismissed, setDismissed] = useState<string[]>(() => readDismissedHandbacks(deviceStore(), childProfile.id, ownerId));
  const card = useMemo(() => {
    const program = activeProgramWeek(programs.items, now);
    if (!program || !programs.loaded || programs.error || !planRows.loaded || planRows.error || !reads.loaded || reads.error) return null;
    const skill = lang === "he" ? resolveHebrewSlash(program.content.skill.he, childProfile.gender) : program.content.skill.en;
    const chosenIds = activePlans(planRows.items, now)
      .filter((p) => planShelf(p.def) === program.program.shelf)
      .map((p) => p.def.id);
    const result = bookHandback({
      weekShelf: program.program.shelf,
      chosenIds,
      objects: [...catalogueSharedObjects(), ...reviewedParentBooks(library.entries).map(row => row.object)],
      reads: reads.items,
      now,
      lang,
      gender: childProfile.gender,
      childName: childProfile.name ?? "",
      dismissed,
      weekSkill: skill,
    });
    return "key" in result ? result : null;
  }, [programs.items, programs.loaded, programs.error, planRows.items, planRows.loaded, planRows.error, reads.items, reads.loaded, reads.error, library.entries, now, lang, childProfile.gender, childProfile.name, dismissed]);
  const currentCard = useRef(card?.key);
  currentCard.current = card?.key;
  if (!card) return null;
  const labels: HandbackLabels = {
    handback: t("elev.program.object.handback"),
    tomorrow: t("elev.program.object.tomorrow"),
    ask: t("elev.program.object.ask"),
    dismiss: t("elev.program.object.dismiss"),
    save: t("elev.program.object.save"),
    words: t("elev.program.object.words"),
    placeholder: t("elev.program.object.placeholder"),
    saveError: t("elev.program.object.saveError"),
  };
  const entry = ownedHandbackBook(library.entries, card.objectId);
  const current = () => mounted.current && currentCard.current === card.key && programs.isCurrent() && planRows.isCurrent() && reads.isCurrent();
  const hide = (key: string) => {
    if (current()) setDismissed(dismissHandback(deviceStore(), childProfile.id, key, ownerId));
  };
  return (
    <ProgramBookHandbackView
      key={card.key}
      card={card}
      cover={entry ? <LibraryBookCover childId={childProfile.id} entry={entry} /> : undefined}
      lang={lang}
      labels={labels}
      onDismiss={() => hide(card.key)}
      onSave={async (text) => {
        if (!current()) return false;
        const saved = await addMoment(text, { callerShowsFailure: true, requireAcknowledgement: true, retryKey: `book-handback:${card.key}`, isCurrent: current });
        if (!saved || !current()) return false;
        hide(card.key);
        return true;
      }}
    />
  );
}
