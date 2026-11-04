/**
 * B-PROG-16 — the next-day handback of the one shared book.
 *
 * Mounted on Now only while `arbor.flags.programSharedObject` is "1".
 * Cover words, one thing for tomorrow, and a question the parent can ask.
 * Dismiss hides it. Save writes the parent's own sentence to the journal,
 * with no prefix and no script. The read ledger has no path to copy.
 */
import React, { useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { activeProgramWeek } from "../../lib/programs/enrolment";
import { resolveHebrewSlash } from "../../lib/hebrewSlashGender";
import { activePlans, planShelf } from "../../lib/plans/planWeek";
import type { PlanBookDoc } from "../../lib/library/plans/planBookDoc";
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
  card, lang, labels, onDismiss, onSave,
}: {
  card: BookHandback;
  lang: "en" | "he";
  labels: HandbackLabels;
  onDismiss: () => void;
  onSave: (text: string) => Promise<boolean>;
}) {
  const [words, setWords] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const text = words.trim();
  const save = async () => {
    if (!text || saving) return;
    setSaving(true);
    setFailed(false);
    const ok = await onSave(text);
    setSaving(false);
    if (!ok) setFailed(true);
  };
  return (
    <section className="now-handback" data-testid="program-book-handback" dir={lang === "he" ? "rtl" : "ltr"} aria-label={labels.handback}>
      <p className="now-handback-kicker">{labels.handback}</p>
      <p className="now-handback-title" dir="auto"><bdi>{card.title}</bdi></p>
      <p className="now-handback-line" dir="auto" data-testid="program-book-cover"><bdi>{card.coverLine}</bdi></p>
      <p className="now-handback-line" dir="auto" data-testid="program-book-tomorrow"><span className="now-handback-kicker">{labels.tomorrow}</span> <bdi>{card.tomorrow}</bdi></p>
      <p className="now-handback-line" dir="auto" data-testid="program-book-ask"><span className="now-handback-kicker">{labels.ask}</span> <bdi>{card.askAfter}</bdi></p>
      <label className="now-handback-label">
        {labels.words}
        <textarea className="now-handback-words" dir="auto" maxLength={500} value={words} placeholder={labels.placeholder} onChange={(e) => { setWords(e.target.value); setFailed(false); }} />
      </label>
      <div className="now-handback-actions">
        <button type="button" className="min-h-11" data-testid="program-book-dismiss" onClick={onDismiss}>{labels.dismiss}</button>
        <button type="button" className="min-h-11 now-handback-save" data-testid="program-book-save" disabled={!text || saving} onClick={() => { void save(); }}>{labels.save}</button>
      </div>
      {failed && <p className="now-handback-error" role="alert">{labels.saveError}</p>}
    </section>
  );
}

/** The Now card. Renders nothing unless yesterday's read is the week's one object. */
export default function ProgramBookHandback() {
  const { childProfile, addMoment } = useArbor();
  const { t, uiLang } = useLanguage();
  const now = useNowClock();
  const lang = uiLang === "he" ? "he" : "en";
  const programs = useChildCollection<{ id: string }>(childProfile.id, "programs");
  const planRows = useChildCollection<PlanBookDoc>(childProfile.id, "books");
  const reads = useChildCollection<BookRead>(childProfile.id, BOOK_READS);
  const [dismissed, setDismissed] = useState<string[]>(() => readDismissedHandbacks(deviceStore(), childProfile.id));
  const card = useMemo(() => {
    const program = activeProgramWeek(programs.items, now);
    if (!program) return null;
    const skill = lang === "he" ? resolveHebrewSlash(program.content.skill.he, childProfile.gender) : program.content.skill.en;
    const chosenIds = activePlans(planRows.items, now)
      .filter((p) => planShelf(p.def) === program.program.shelf)
      .map((p) => p.def.id);
    const result = bookHandback({
      weekShelf: program.program.shelf,
      chosenIds,
      objects: catalogueSharedObjects(),
      reads: reads.items,
      now,
      lang,
      gender: childProfile.gender,
      childName: childProfile.name ?? "",
      dismissed,
      weekSkill: skill,
    });
    return "key" in result ? result : null;
  }, [programs.items, planRows.items, reads.items, now, lang, childProfile.gender, childProfile.name, dismissed]);
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
  const hide = (key: string) => setDismissed(dismissHandback(deviceStore(), childProfile.id, key));
  return (
    <ProgramBookHandbackView
      key={card.key}
      card={card}
      lang={lang}
      labels={labels}
      onDismiss={() => hide(card.key)}
      onSave={async (text) => {
        const saved = await addMoment(text, { callerShowsFailure: true });
        if (!saved) return false;
        hide(card.key);
        return true;
      }}
    />
  );
}
