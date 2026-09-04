import React, { useCallback, useMemo, useState } from "react";
import Icon from "../ui/Icon";
import { ShareButton } from "../ui/ShareButton";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { cardCls } from "../ui/kit";
import { PASTEL } from "../../lib/tokens";
import type { ShareCardOpts } from "../../lib/shareCard";
import {
  buildMonthKeepsake,
  monthKeepsakeStorageKey,
  monthKeyOf,
  shouldOfferMonthKeepsake,
  type MonthKeepsakeCard,
} from "../../lib/keepsakeMonth";

/**
 * MonthKeepsake — ENG-14(b): "{name}'s {Month}".
 *
 * A grep for month-in-review across the app returned nothing but billing, even
 * though lib/signalTimeline already builds MonthNodes: the parent could scroll
 * a timeline but was never HANDED the month. This offers it once, on the first
 * open of a new month, for the month that just ended.
 *
 * CLINICAL FIREWALL: counts and the parent's own words. No comparison with
 * last month, no delta, no percentage, no "best month", no domain ranking, no
 * colour meaning good or bad. The builder (lib/keepsakeMonth) sees exactly ONE
 * month and so cannot compute a trend even by accident. A month with two
 * moments is rendered with the same warmth as a month with twenty.
 */
const MONTH_FORMAT_FALLBACK = (month: number, year: number) => `${year}-${String(month).padStart(2, "0")}`;

function localizedMonth(month: number, year: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(year, month - 1, 1)),
    );
  } catch {
    return MONTH_FORMAT_FALLBACK(month, year);
  }
}

function readLastOffered(childId: string): string | null {
  try {
    return localStorage.getItem(monthKeepsakeStorageKey(childId));
  } catch {
    return null;
  }
}

export default function MonthKeepsake() {
  const { childProfile, behaviorLogs, milestones } = useArbor();
  const { t, uiLang } = useLanguage();
  const [dismissed, setDismissed] = useState(false);

  const childId = childProfile?.id;
  const firstName = (childProfile?.name || "").split(" ")[0];
  const currentMonthKey = monthKeyOf(Date.now()) ?? "";

  const keepsake = useMemo(() => {
    // The month that just ended, from the rows the family actually kept.
    const previousKey = (() => {
      const [y, m] = currentMonthKey.split("-").map(Number);
      if (!Number.isInteger(y) || !Number.isInteger(m)) return "";
      return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    })();
    if (!previousKey) return null;

    const inMonth = (stamp: string | undefined) => !!stamp && stamp.slice(0, 7) === previousKey;
    const monthLogs = (behaviorLogs ?? []).filter((l) => inMonth(l.timestamp));
    // The quote is the parent's OWN words, verbatim — their most recent note
    // from that month. Never rewritten, never sent anywhere.
    const quote = monthLogs.map((l) => (l.notes || "").trim()).filter(Boolean).slice(-1)[0];

    return buildMonthKeepsake({
      monthKey: previousKey,
      moments: monthLogs.length,
      // Windowed to the SAME month as the moments. Unfiltered, this reported a
      // year of noticing as August's, so a parent who noticed nothing that
      // month was handed "12 milestones you noticed" for it.
      milestones: (milestones ?? []).filter(
        (m) =>
          m.checked &&
          typeof m.observationUpdatedAt === "string" &&
          m.observationUpdatedAt.slice(0, 7) === previousKey,
      ).length,
      stories: 0,
      parentQuote: quote,
    });
  }, [behaviorLogs, milestones, currentMonthKey]);

  const offer =
    !dismissed &&
    !!childId &&
    shouldOfferMonthKeepsake({
      lastOfferedMonthKey: childId ? readLastOffered(childId) : null,
      keepsake,
      currentMonthKey,
    });

  const dismiss = useCallback(() => {
    if (childId && keepsake) {
      try {
        localStorage.setItem(monthKeepsakeStorageKey(childId), keepsake.monthKey);
      } catch {
        /* storage unavailable — worst case it is offered once more */
      }
    }
    setDismissed(true);
  }, [childId, keepsake]);

  if (!offer || !keepsake) return null;

  const monthLabel = localizedMonth(keepsake.month, keepsake.year, uiLang === "he" ? "he-IL" : "en-GB");
  const title = t("elev.keepsake.month.title", { name: firstName, month: monthLabel });
  const p = PASTEL.lav;

  const cardLine = (card: MonthKeepsakeCard) =>
    card.id === "quote" ? card.quote ?? "" : t(`elev.keepsake.month.card.${card.id}`, { count: card.count ?? 0 });

  return (
    <section className={`${cardCls} p-5`} data-testid="month-keepsake">
      <div className="flex items-start gap-3">
        <span
          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: p.soft, color: p.ink }}
        >
          <Icon name="calendar_month" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            className="text-[15px] font-extrabold leading-tight"
            dir="auto"
            style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
          >
            {title}
          </h2>
          <p className="text-xs mt-0.5" dir="auto" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.keepsake.month.sub")}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("elev.keepsake.month.dismiss")}
          className="grid place-items-center rounded-full shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          style={{ width: 44, height: 44, color: "var(--arbor-muted)" }}
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      {/* The cards: a count, or the parent's own sentence. Nothing else. */}
      <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {keepsake.cards.map((card) => (
          <div
            key={card.id}
            className="rounded-2xl p-3"
            style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
          >
            {card.id === "quote" && (
              <p
                className="text-[11px] uppercase tracking-widest font-bold mb-1"
                style={{ color: "var(--arbor-muted)" }}
              >
                {t("elev.keepsake.month.card.quote")}
              </p>
            )}
            <p
              className="text-[13px] leading-snug"
              dir="auto"
              style={{ color: card.id === "quote" ? "var(--arbor-ink-soft)" : "var(--arbor-ink)" }}
            >
              {cardLine(card)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <ShareButton
          artifact="growth_card"
          captionKey="elev.share.caption.month"
          surface="month_keepsake"
          childName={firstName}
          label={t("elev.keepsake.month.share")}
          getCardOpts={(): ShareCardOpts => ({
            name: firstName,
            headline: title,
            sub: t("elev.keepsake.month.sub"),
          })}
          variant="ghost"
        />
      </div>
    </section>
  );
}
