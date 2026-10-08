import React, { useState } from "react";
import { Icon } from "../ui/Icon";
import { FreeText } from "../ui/FreeText";
import { useLanguage } from "../../context/LanguageContext";
import { resolveHebrewSlash } from "../../lib/hebrewSlashGender";
import { quoteShareText, quotesByMonth, type KeptQuote } from "../../lib/loop/tonight";
import { shareWordsText } from "../../lib/share";

const monthLabel = (month: string, lang: "en" | "he"): string => {
  const d = new Date(`${month}-01T12:00:00`);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { month: "long", year: "numeric" });
};
const dayLabel = (day: string, lang: "en" | "he"): string => {
  const d = new Date(`${day}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "short" });
};

/**
 * B-LOOP-10 — "Things {name} said": the quotes kept from Tonight's second
 * question, by month, each in the editorial serif with its day. One tap
 * shares ONE quote as plain text (lib/share shareWordsText: never a link,
 * never an image, never the whole list). Shelf-independent; counts nothing.
 */
export default function ThingsSaid({ quotes, childName, gender }: { quotes: readonly KeptQuote[]; childName: string; gender?: string | null }) {
  const { t, uiLang } = useLanguage();
  const lang: "en" | "he" = uiLang === "he" ? "he" : "en";
  const [sent, setSent] = useState<string | null>(null);
  const name = childName || t("today.record.childFallback");
  const title = lang === "he" ? resolveHebrewSlash(t("elev.loop.said.title", { name }), gender) : t("elev.loop.said.title", { name });
  return (
    <section data-testid="things-said" aria-label={title} className="space-y-3">
      <h3 className="font-semibold leading-tight" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)", fontSize: "var(--t-lg)" }}>
        {title}
      </h3>
      {quotes.length === 0 ? (
        <p data-testid="things-said-empty" className="text-[14px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.loop.said.empty")}</p>
      ) : (
        quotesByMonth(quotes).map((g) => (
          <div key={g.month} className="space-y-2">
            <p className="text-[12.5px] font-semibold" style={{ color: "var(--arbor-muted)" }}>{monthLabel(g.month, lang)}</p>
            <ul className="space-y-2">
              {g.quotes.map((q) => (
                <li key={q.id} data-testid="things-said-quote" className="flex items-start gap-2">
                  <figure className="min-w-0 flex-1">
                    <blockquote className="border-s-2 ps-3 text-[16px] leading-snug" style={{ borderColor: "var(--arbor-clay)", color: "var(--arbor-ink)", fontFamily: "var(--font-editorial)" }}>
                      <FreeText text={t("elev.loop.ms.quoted", { text: q.note })} />
                    </blockquote>
                    <figcaption className="mt-1 ps-3 text-[12px]" style={{ color: "var(--arbor-muted)" }}>{dayLabel(q.noticedOn, lang)}</figcaption>
                  </figure>
                  <button
                    type="button"
                    data-testid="things-said-share"
                    aria-label={t("elev.loop.said.share")}
                    onClick={() => {
                      void shareWordsText(quoteShareText(q, name, dayLabel(q.noticedOn, lang))).then((r) => setSent(r === "shared" || r === "copied" ? q.id : null));
                    }}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
                    style={{ color: sent === q.id ? "var(--arbor-green-ink)" : "var(--arbor-muted)" }}
                  >
                    <Icon name={sent === q.id ? "check" : "send"} size={18} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
