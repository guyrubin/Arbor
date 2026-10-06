import React, { useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { goToRoute, useHashQuery } from "../../hooks/useHashQuery";
import { ageLabel } from "../../lib/childAge";
import { isUnderThree } from "../../lib/age/forChild";
import { languageName } from "../../lib/languageName";
import { buildFirstWordsLedger } from "../../lib/firstWords";
import { quotesFromDocs, type KeptQuote } from "../../lib/loop/tonight";
import { openPrintableReport, type ReportDoc } from "../../lib/reportExport";
import { buildLinesText, shareWordsText } from "../../lib/share";
import { genderedKey } from "../../lib/today/fromRecord";
import type { KeepsakeDoc } from "../../lib/firstsKeepsake";
import type { LangObservation } from "../../growth/vocabAgg";
import { quoteLanguages } from "./ThingsSaid";

/* ════════════════════════════════════════════════════════════════════════════
   B-GROWTH-37 — the "Things {name} said" page: ONE printable month page of the
   child's kept quotes (the `quote` keepsakes), his first name and age at the
   top, each quote in the editorial serif in the language it was said
   (`dir="auto"` per line), its day small. Under 3 the same page is the
   first-words poster (the `langObs` ledger).

   Reached at #/language?view=said (a mode of #/language: lib/routes.ts holds
   no sub-routes — REJECTIONS P2-WORDS B-GROWTH-37), `&month=YYYY-MM` picks
   the month.

   Two modules (the sub-page budget): the sheet, and its two actions —
   "Print" (the existing print shell, lib/reportExport) and "Send to…" (the
   text-only path, lib/share: the quotes as lines + one closing line). No
   PNG, no referral code, no link, no count.
   ════════════════════════════════════════════════════════════════════════════ */

/** "2026-10" → "October 2026" / "אוקטובר 2026". */
export function monthLabel(month: string, lang: "en" | "he"): string {
  const d = new Date(`${month}-01T12:00:00`);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { month: "long", year: "numeric" });
}
/** "2026-10-05" → "5 Oct" / "5 באוק׳". */
export function dayLabel(day: string, lang: "en" | "he"): string {
  const d = new Date(`${day}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "short" });
}

/** The months that hold a kept quote, newest first. */
export function saidMonths(quotes: readonly KeptQuote[]): string[] {
  return [...new Set(quotes.map((q) => q.noticedOn.slice(0, 7)).filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort().reverse();
}

/** The month the page shows: the asked one when it holds quotes, else the newest. */
export function pickMonth(quotes: readonly KeptQuote[], asked: string | null | undefined): string | null {
  const months = saidMonths(quotes);
  if (asked && months.includes(asked)) return asked;
  return months[0] ?? null;
}

/** One month's quotes, oldest first (a page reads like the month went). */
export function quotesOfMonth(quotes: readonly KeptQuote[], month: string | null): KeptQuote[] {
  if (!month) return [];
  return quotes.filter((q) => q.noticedOn.startsWith(month)).sort((a, b) => a.noticedOn.localeCompare(b.noticedOn) || a.id.localeCompare(b.id));
}

/** Pure: the "Send to…" text — each quote with its day, then the closing line. No URL. */
export function saidSendText(quotes: readonly KeptQuote[], opts: { lang: "en" | "he"; closing: string }): string {
  return buildLinesText(quotes.map((q) => `“${q.note}” · ${dayLabel(q.noticedOn, opts.lang)}`), opts.closing);
}

/** Pure: the printable document (the existing print shell's ReportDoc). */
export function saidPrintDoc(quotes: readonly KeptQuote[], opts: { lang: "en" | "he"; title: string; subtitle: string; month: string | null }): ReportDoc {
  return {
    title: opts.title,
    subtitle: opts.subtitle,
    sections: opts.month
      ? [{ heading: monthLabel(opts.month, opts.lang), body: quotes.map((q) => `“${q.note}” · ${dayLabel(q.noticedOn, opts.lang)}`) }]
      : [],
  };
}

export default function SaidPage() {
  const { childProfile } = useArbor();
  const { user } = useAuth();
  const { t, uiLang } = useLanguage();
  const lang: "en" | "he" = uiLang === "he" ? "he" : "en";
  const first = (childProfile.name || "").split(" ")[0] || t("today.record.childFallback");
  const gender = childProfile.gender;
  const gk = (k: string) => genderedKey(k, gender);
  const age = ageLabel(childProfile, t);
  const underThree = isUnderThree(childProfile);
  const parentFirst = (user?.displayName || t("nav.parent")).split(" ")[0];

  const keepsakes = useChildCollection<KeepsakeDoc & { language?: string }>(childProfile.id, "keepsakes");
  const obs = useChildCollection<LangObservation>(childProfile.id, "langObs", { orderByField: "timestamp", orderDir: "desc", max: 500 });
  const quotes = useMemo(() => quotesFromDocs(keepsakes.items), [keepsakes.items]);
  const langs = useMemo(() => quoteLanguages(keepsakes.items), [keepsakes.items]);
  const askedMonth = useHashQuery().get("month");
  const [month, setMonth] = useState<string | null>(() => pickMonth(quotes, askedMonth));
  const shownMonth = month && saidMonths(quotes).includes(month) ? month : pickMonth(quotes, askedMonth);
  const monthQuotes = useMemo(() => quotesOfMonth(quotes, shownMonth), [quotes, shownMonth]);
  const poster = useMemo(() => buildFirstWordsLedger(obs.items, 24).rows, [obs.items]);
  const [sent, setSent] = useState<"copied" | "shared" | null>(null);

  const title = underThree ? t("elev.words.page.posterTitle", { name: first }) : t(gk("elev.words.said.title"), { name: first });
  const closing = t("elev.words.page.closing", { parent: parentFirst, name: first });
  const lines: KeptQuote[] = underThree
    ? poster.map((r) => ({ id: r.id, note: r.phrase, noticedOn: r.firstLoggedAt.slice(0, 10) }))
    : monthQuotes;

  const print = () => void openPrintableReport(saidPrintDoc(lines, { lang, title, subtitle: `${first}, ${age}`, month: underThree ? null : shownMonth }), first, lang);
  const send = async () => {
    const r = await shareWordsText(saidSendText(lines, { lang, closing }));
    setSent(r === "copied" || r === "shared" ? r : null);
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-[720px] space-y-5" data-testid="said-page">
      <button
        type="button"
        onClick={() => goToRoute("language")}
        className="inline-flex min-h-[44px] items-center text-[14px]"
        style={{ color: "var(--arbor-ink-soft)" }}
      >
        {t("elev.words.page.back")}
      </button>

      {!underThree && saidMonths(quotes).length > 1 && (
        <div role="radiogroup" aria-label={t("elev.words.page.months")} className="flex flex-wrap gap-2">
          {saidMonths(quotes).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={m === shownMonth}
              onClick={() => setMonth(m)}
              className="inline-flex min-h-[44px] items-center rounded-full px-4 text-[14px]"
              style={m === shownMonth
                ? { background: "var(--arbor-ink)", color: "var(--arbor-paper)" }
                : { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule-strong)" }}
            >
              {monthLabel(m, lang)}
            </button>
          ))}
        </div>
      )}

      {/* The sheet — name, age, month, the child's words, their days. Nothing else.
          The keepsake month frame (B-INF-07) replaces the plain rule when it lands. */}
      <article
        data-module="said-sheet"
        data-testid="said-sheet"
        data-frame="plain"
        className="rounded-[20px] px-5 py-6 sm:px-8 sm:py-8"
        style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
      >
        <h1 className="leading-tight" style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--arbor-ink)" }}>{title}</h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--arbor-muted)" }}>
          {first}, {age}{!underThree && shownMonth ? ` · ${monthLabel(shownMonth, lang)}` : ""}
        </p>
        {lines.length === 0 ? (
          <p data-testid="said-page-empty" className="mt-6 text-[15px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.words.page.empty")}</p>
        ) : (
          <ul data-testid={underThree ? "said-poster" : "said-month"} className="mt-6 space-y-5">
            {lines.map((q) => {
              const lng = underThree ? poster.find((r) => r.id === q.id)?.language : langs.get(q.id);
              return (
                <li key={q.id}>
                  <p dir="auto" className="leading-snug" style={{ fontFamily: "var(--font-editorial)", fontSize: underThree ? 24 : 19, color: "var(--arbor-ink)" }}>
                    “{q.note}”
                  </p>
                  <p className="mt-1 text-[12px]" style={{ color: "var(--arbor-muted)" }}>
                    {[dayLabel(q.noticedOn, lang), lng ? languageName(lng, t) : ""].filter(Boolean).join(" · ")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </article>

      <div data-module="said-actions" className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid="said-send"
          onClick={() => void send()}
          disabled={lines.length === 0}
          className="inline-flex min-h-[44px] items-center rounded-xl px-5 text-[15px] font-semibold disabled:opacity-60"
          style={{ background: "var(--arbor-blue)", color: "var(--arbor-on-accent)" }}
        >
          {t("elev.words.page.send")}
        </button>
        <button
          type="button"
          data-testid="said-print"
          onClick={print}
          disabled={lines.length === 0}
          className="inline-flex min-h-[44px] items-center rounded-xl px-5 text-[15px] disabled:opacity-60"
          style={{ color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule-strong)" }}
        >
          {t("elev.words.page.print")}
        </button>
        {sent === "copied" && (
          <p role="status" className="text-[13px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.words.page.copied")}</p>
        )}
      </div>
    </div>
  );
}
