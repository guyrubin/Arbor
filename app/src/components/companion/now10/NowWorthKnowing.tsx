import React, { useEffect, useMemo, useState } from "react";
import { useArbor } from "../../../context/ArborContext";
import { Know } from "../../../design/primitives";
import { ageYearsFromProfile } from "../../../lib/childAge";
import { concernsForBehaviors } from "../../../content/selectCards";
import { recentBehaviorTypes } from "../../../content/hardMomentSurface";
import { readLearnFeedback } from "../../../learn/learnFeedback";
import { pickDayKey, todaysLearnPick } from "../../../learn/todaysPick";
import type { LearnCard } from "../../../learn/learnLibrary";

/**
 * "Worth knowing" (one note a day on Now). The canvas sentences are new and
 * clinically unreviewed, so the note is bound to a read the app already ships:
 * today's Learn pick (the same ranking and per-day seed as For you › Library),
 * its own one-line hook as the note, its title as the link. The catalogue
 * loads after the screen (it is large), and no note renders until it has.
 */
export function useLearnCards(): LearnCard[] | null {
  const [cards, setCards] = useState<LearnCard[] | null>(null);
  useEffect(() => {
    let live = true;
    void import("../../../learn/learnCards").then((m) => { if (live) setCards(m.LEARN_CARDS); }).catch(() => {});
    return () => { live = false; };
  }, []);
  return cards;
}

export default function NowWorthKnowing({ lang, kicker, readMinutes, topicText, composition, now, cardId, source = "now-worth-knowing" }: {
  lang: "en" | "he";
  /** A screen whose note has its own subject names the read (Gentle reminders: transitions and warnings). */
  cardId?: string;
  source?: string;
  kicker: string;
  readMinutes: (m: number) => string;
  topicText?: string | null;
  composition: "desk" | "phone";
  now: Date;
}) {
  const { childProfile, behaviorLogs = [], requestLearnRead } = useArbor();
  const cards = useLearnCards();
  const day = pickDayKey(now);
  const pick = useMemo(() => {
    if (!cards) return null;
    if (cardId) { const card = cards.find((c) => c.id === cardId); return card ? { card } : null; }
    return todaysLearnPick(cards, {
      ageYears: ageYearsFromProfile(childProfile),
      focusDomain: null,
      recentConcerns: concernsForBehaviors(recentBehaviorTypes(behaviorLogs, now)),
      helpfulness: readLearnFeedback(),
      topicText: topicText ?? null,
    }, { childId: childProfile.id, dayKey: day, logs: behaviorLogs });
    // The pick is per child and day; logs move it only through their behaviour types.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, cardId, childProfile.id, day, behaviorLogs.length, topicText]);
  if (!pick) return null;
  const card = pick.card;
  const desk = composition === "desk";
  return <Know kicker={kicker} className={desk ? "x4 nw-know" : "nw-know m"}
    link={<button type="button" className="nw-know-link" data-testid="now-worth-knowing-read" onClick={() => requestLearnRead({ cardId: card.id, source })}>
      <span dir="auto">{card.title[lang]}</span> · {readMinutes(card.minutes)}
    </button>}>
    <span dir="auto" data-testid="now-worth-knowing">{card.hook[lang]}</span>
  </Know>;
}
