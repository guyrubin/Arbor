import React, { useMemo, useRef, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { translate } from "../../lib/i18n";
import { languageName } from "../../lib/languageName";
import { fmtDay } from "../../lib/formatDate";
import { genderedKey, type ChildGender } from "../../lib/today/fromRecord";
import { quoteKeepsakeDoc, quotesFromDocs, type KeptQuote } from "../../lib/loop/tonight";
import { plainLanguage, quoteLanguage, type SayBack } from "../../lib/language/sayBack";

/* ════════════════════════════════════════════════════════════════════════════
   B-GROWTH-36 — "Things {name} said" on #/language (a child of 3 and over).

   The add box keeps ONE thing the child said — a word, a question, a story,
   in the language it was said — as a `quote` keepsake: the SAME kind
   Tonight's step 2 writes (lib/loop/tonight `quoteKeepsakeDoc`, registered
   `keepsakes` collection, exported and erased with the child), plus the
   language the parent kept it under. Never a new collection.

   After a keep, the say-back (lib/language/sayBack, deterministic templates,
   zero model calls) is the largest text on the page: the words to say in the
   editorial serif at 19 px, in the language the family is keeping.

   CLINICAL FIREWALL: the child's words and their dates. No count, no list per
   month, no comparison between languages or months.
   ════════════════════════════════════════════════════════════════════════════ */

/** A kept quote's document, as this page writes it (the Tonight shape + language). */
type QuoteDoc = { id: string; kind?: string; note?: string; noticedOn?: string; language?: string };

/** The language a kept quote was saved under, by id (docs without one are skipped). */
export function quoteLanguages(docs: readonly unknown[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of docs) {
    const d = raw as QuoteDoc | null;
    if (d && d.kind === "quote" && typeof d.id === "string" && typeof d.language === "string" && d.language.trim()) out.set(d.id, d.language);
  }
  return out;
}

/** The say-back block: the small sans head, the words to say (the largest text), the honest line. */
export function SayBackBlock({ back, first, gender }: { back: SayBack; first: string; gender: ChildGender }) {
  const { t } = useLanguage();
  const gk = (k: string) => genderedKey(k, gender);
  const vars = { name: first, said: languageName(back.said, t), kept: languageName(back.answerIn, t) };
  const line = back.lineKey && back.lineLocale ? translate(back.lineLocale, gk(back.lineKey), back.lineVars) : null;
  return (
    <figure data-testid="say-back" data-say-back-mode={back.mode} aria-live="polite" className="border-s-2 ps-3" style={{ borderColor: "var(--arbor-blue)" }}>
      <figcaption data-testid="say-back-head" className="text-[14px] leading-snug" style={{ color: "var(--arbor-ink-soft)" }}>
        {t(gk(back.headKey), vars)}
      </figcaption>
      {line && (
        <blockquote
          data-testid="say-back-line"
          lang={back.lineLocale ?? undefined}
          dir={back.lineLocale === "he" ? "rtl" : "ltr"}
          className="mt-1.5 leading-snug"
          style={{ fontFamily: "var(--font-editorial)", fontSize: 19, color: "var(--arbor-ink)" }}
        >
          “{line}”
        </blockquote>
      )}
      <p data-testid="say-back-why" className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
        {t(gk(back.whyKey), vars)}
      </p>
    </figure>
  );
}

/** The add box for a child of 3 and over. `onKept` hands back the kept text + language. */
export function SaidCapture({
  childId,
  languages,
  first,
  gender,
  onKept,
}: {
  childId: string;
  languages: string[];
  first: string;
  gender: ChildGender;
  onKept: (kept: { text: string; language: string | null }) => void;
}) {
  const { t } = useLanguage();
  const gk = (k: string) => genderedKey(k, gender);
  const col = useChildCollection<QuoteDoc>(childId, "keepsakes");
  const [text, setText] = useState("");
  const [lang, setLang] = useState("");
  const [hint, setHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const options = useMemo(() => [...new Set(languages.map(plainLanguage).filter(Boolean))], [languages]);

  const keep = () => {
    const words = text.trim();
    if (!words) {
      setHint(true);
      inputRef.current?.focus();
      return;
    }
    const doc = quoteKeepsakeDoc(words);
    if (!doc) return;
    const language = lang || quoteLanguage(words, languages);
    void col.upsert({ ...doc, ...(language ? { language } : {}) });
    setText("");
    setLang("");
    onKept({ text: doc.note, language });
  };

  return (
    <form
      data-testid="said-capture"
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        keep();
      }}
    >
      <label htmlFor="said-input" className="block text-[15px] font-semibold" style={{ color: "var(--arbor-ink)" }}>
        {t(gk("elev.words.said.label"), { name: first })}
      </label>
      <div className="flex flex-wrap gap-2 sm:flex-nowrap">
        <input
          id="said-input"
          ref={inputRef}
          dir="auto"
          value={text}
          maxLength={280}
          onChange={(e) => {
            setText(e.target.value);
            if (hint) setHint(false);
          }}
          placeholder={t("elev.words.said.placeholder")}
          aria-describedby={hint ? "said-empty-hint" : undefined}
          className="min-h-[44px] min-w-0 flex-1 basis-full rounded-xl px-3 text-[15px] focus:outline-none sm:basis-auto"
          style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
        />
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          aria-label={t("elev.words.said.langLabel")}
          className="min-h-[44px] min-w-0 rounded-xl px-2 text-[14px] focus:outline-none"
          style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
        >
          <option value="">{t("elev.words.said.langAuto")}</option>
          {options.map((l) => (
            <option key={l} value={l}>{languageName(l, t)}</option>
          ))}
        </select>
        <button
          type="submit"
          data-testid="said-keep"
          aria-disabled={!text.trim() || undefined}
          className="inline-flex min-h-[44px] flex-1 shrink-0 items-center justify-center rounded-xl px-5 text-[15px] font-semibold sm:flex-none"
          style={{ background: "var(--arbor-blue)", color: "var(--arbor-on-accent)" }}
        >
          {t("elev.words.said.save")}
        </button>
      </div>
      {hint && (
        <p id="said-empty-hint" role="status" className="text-[13px]" style={{ color: "var(--arbor-muted)" }}>
          {t(gk("elev.words.said.emptyHint"), { name: first })}
        </p>
      )}
    </form>
  );
}

/** The kept quotes, newest first: the child's words and their dates. Nothing counted. */
export function SaidList({ childId, first, gender, max = 8 }: { childId: string; first: string; gender: ChildGender; max?: number }) {
  const { t, uiLang } = useLanguage();
  const col = useChildCollection<QuoteDoc>(childId, "keepsakes");
  const quotes: KeptQuote[] = useMemo(() => quotesFromDocs(col.items).slice(0, max), [col.items, max]);
  const langs = useMemo(() => quoteLanguages(col.items), [col.items]);
  if (quotes.length === 0) {
    return (
      <p data-testid="said-empty" className="text-[14px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
        {t(genderedKey("elev.words.said.empty", gender), { name: first })}
      </p>
    );
  }
  return (
    <section aria-labelledby="said-kept-title">
      <h2 id="said-kept-title" className="text-[13px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.words.said.kept")}</h2>
      <ul data-testid="said-list" className="mt-1 divide-y" style={{ borderColor: "var(--arbor-rule)" }}>
        {quotes.map((q) => {
          const lang = langs.get(q.id);
          return (
            <li key={q.id} className="py-2.5">
              <p dir="auto" className="leading-snug" style={{ fontFamily: "var(--font-editorial)", fontSize: 17, color: "var(--arbor-ink)" }}>
                “{q.note}”
              </p>
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--arbor-muted)" }}>
                {[lang ? languageName(lang, t) : "", q.noticedOn ? fmtDay(`${q.noticedOn}T12:00:00`, uiLang) : ""].filter(Boolean).join(" · ")}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

