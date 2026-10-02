import React from "react";
import { Icon } from "../ui/Icon";
import { HeroAvatar } from "../ui/HeroAvatar";
import { useLanguage } from "../../context/LanguageContext";
import { track } from "../../lib/analytics";
import { countFor } from "./WhatChanged";

/**
 * B-TODAY-26 — Tonight, in Today's step slot (NL-4 · ENG-10 · TJB-28).
 *
 * When the evening door is open (lib/timeOfDay bedtimeDoorOpen: 18:00 on, or
 * the family's own wind-down hour) and no step is open, chooseTodayAction
 * picks `tonight` and this card IS the day's step: "Read tonight's story from
 * today's {n} moments" → #/bedtime-stories. Nothing is generated here — the
 * reader generates on ITS tap — and a quiet link opens the wind-down routine
 * (#/routines). While it renders, Today drops the coordinator's evening cue
 * (offer kind "tonight", the RhythmCue BEDTIME kind): one voice.
 *
 * Parent register, parent tokens (the night palette belongs to the reader
 * only). No timer, no streak, no "come back tomorrow". The count is
 * deriveReturnSignals().momentsToday — the day-close signal, no new count.
 */
export default function TonightCard({
  momentsToday,
  childName,
  onRead,
  onRoutine,
}: {
  momentsToday: number;
  childName: string;
  onRead: () => void;
  onRoutine: () => void;
}) {
  const { t, uiLang } = useLanguage();
  const headline =
    momentsToday === 0
      ? t("elev.tonight.headline.none", { name: childName })
      : momentsToday === 1
        ? t("elev.tonight.headline.one")
        : t("elev.tonight.headline.many", { n: countFor(momentsToday, uiLang) });
  return (
    <section
      data-testid="today-tonight"
      className="overflow-hidden rounded-[20px]"
      style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
    >
      <div className="p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <div aria-hidden="true" className="flex h-11 w-11 flex-none items-center justify-center rounded-full" style={{ background: "var(--arbor-paper-deep)" }}>
            <HeroAvatar size={40} mood="calm" animate={false} decorative />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.13em]" style={{ color: "var(--arbor-green-ink)" }}>{t("elev.tonight.eyebrow")}</span>
            <h2 className="mt-1.5 text-[21px] font-extrabold leading-[1.12] sm:text-[23px]" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>
              {headline}
            </h2>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-testid="today-tonight-read"
            onClick={() => {
              track("today_tonight_read", { moments: momentsToday });
              onRead();
            }}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-extrabold transition active:scale-[0.98]"
            style={{ background: "var(--arbor-gradient-primary)", color: "var(--arbor-on-accent)" }}
          >
            <Icon name="auto_stories" size={17} />
            {t("elev.tonight.read")}
          </button>
          <button
            type="button"
            data-testid="today-tonight-routine"
            onClick={onRoutine}
            className="inline-flex min-h-[44px] items-center gap-1.5 px-1 text-[13px] font-bold underline underline-offset-4"
            style={{ color: "var(--arbor-green-ink)" }}
          >
            {t("elev.tonight.routine")}
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * B-TODAY-26 — the day-close line in the continuation slot, after the sleep
 * hour: "Kept today: {n} moments" and a "Good night" that dismisses it for the
 * local day. A fact about the parent's day, never a verdict, never a nudge.
 */
export function DayCloseLine({ momentsToday, onGoodNight }: { momentsToday: number; onGoodNight: () => void }) {
  const { t, uiLang } = useLanguage();
  const kept =
    momentsToday === 0
      ? t("elev.dayclose.kept.none")
      : momentsToday === 1
        ? t("elev.dayclose.kept.one")
        : t("elev.dayclose.kept.many", { n: countFor(momentsToday, uiLang) });
  return (
    <div
      data-testid="today-dayclose"
      className="flex min-w-0 items-center justify-between gap-3 rounded-2xl px-4 py-2"
      style={{ background: "var(--arbor-paper-deep)" }}
    >
      <p className="min-w-0 text-[13.5px] font-bold" style={{ color: "var(--arbor-ink)" }}>{kept}</p>
      <button
        type="button"
        data-testid="today-dayclose-goodnight"
        onClick={onGoodNight}
        className="inline-flex min-h-[44px] flex-none items-center gap-1.5 px-2 text-[13px] font-extrabold"
        style={{ color: "var(--arbor-green-ink)" }}
      >
        <Icon name="bedtime" size={16} />
        {t("elev.dayclose.goodnight")}
      </button>
    </div>
  );
}
