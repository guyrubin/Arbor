import React, { useMemo } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { ContentWhyLine } from "../ui/ContentActionBar";
import { fmtDay } from "../../lib/formatDate";
import { buildFirstWordsLedger } from "../../lib/firstWords";
import type { LangObservation } from "../../growth/vocabAgg";

/* ════════════════════════════════════════════════════════════════════════════
   FirstWordsLedger — GP-33.

   The Language Lab writes every parent-logged phrase to the registered
   `langObs` child collection (lib/childData CHILD_SUBCOLLECTIONS, so it is
   swept by export and erase), and the child's RECORD never showed a single one
   of them. A word a child said is the most keepable thing the app collects,
   and it was living inside one tab, below the fold.

   This is the ledger on the Growth hub: two counts, then the most recent
   distinct phrases with the day each was first written down, and one door back
   to the Lab to add another.

   CLINICAL FIREWALL: phrases, languages and dates. No vocabulary-size
   expectation, no per-language mix percentage, no "typical by this age", no
   comparison of one language against another. growth/vocabAgg keeps the Lab's
   own aggregate view; nothing here re-derives a rate from it.
   ════════════════════════════════════════════════════════════════════════════ */
export default function FirstWordsLedger() {
  const { childProfile, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const firstName = (childProfile.name || "").split(" ")[0];

  const obsCol = useChildCollection<LangObservation>(childProfile.id, "langObs", {
    orderByField: "timestamp",
    orderDir: "desc",
  });
  const ledger = useMemo(() => buildFirstWordsLedger(obsCol.items), [obsCol.items]);

  const openLab = () => setActiveTab("language");

  return (
    <section
      data-testid="growth-first-words"
      aria-labelledby="growth-first-words-title"
      className="overflow-hidden rounded-[24px] p-4 sm:p-6"
      style={{
        background: "var(--arbor-paper-elevated)",
        border: "1px solid var(--arbor-rule)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em]"
            style={{ color: "var(--arbor-lav-ink)" }}
          >
            <Icon name="record_voice_over" size={16} />
            {t("elev.waveR.words.eyebrow")}
          </span>
          <h2
            id="growth-first-words-title"
            className="mt-2 break-words text-xl font-semibold leading-tight"
            style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
          >
            {firstName
              ? t("elev.waveR.words.title", { name: firstName })
              : t("elev.waveR.words.titleGeneric")}
          </h2>
          {/* Counts only — the ledger's size and how many languages it spans. */}
          <p className="mt-1 text-[13px] font-bold" style={{ color: "var(--arbor-muted)" }}>
            <span data-testid="growth-first-words-count">
              {ledger.wordCount === 1
                ? t("elev.waveR.words.count.one")
                : t("elev.waveR.words.count.many", { n: ledger.wordCount })}
            </span>
            {ledger.languageCount > 0 && (
              <>
                {" "}
                {ledger.languageCount === 1
                  ? t("elev.waveR.words.langs.one")
                  : t("elev.waveR.words.langs.many", { n: ledger.languageCount })}
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={openLab}
          data-testid="growth-first-words-add"
          className="inline-flex min-h-11 flex-shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold text-white transition active:scale-[0.98]"
          style={{ background: "var(--arbor-clay)" }}
        >
          <Icon name="add" size={18} /> {t("elev.waveR.words.add")}
        </button>
      </div>

      {ledger.rows.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {ledger.rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl p-3"
              style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
            >
              <span className="break-words text-sm font-bold" dir="auto" style={{ color: "var(--arbor-ink)" }}>
                “{row.phrase}”
              </span>
              <span className="text-[11px] font-bold" style={{ color: "var(--arbor-lav-ink)" }}>
                {row.language}
              </span>
              <span className="flex-1" />
              <span className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>
                {t("elev.waveR.words.firstOn", { date: fmtDay(row.firstLoggedAt, uiLang) })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <button
          type="button"
          onClick={openLab}
          className="mt-4 flex w-full items-center gap-3 rounded-xl p-3 text-start"
          style={{ minHeight: 44, background: "var(--arbor-paper-deep)", border: "1px dashed var(--arbor-rule-strong)" }}
        >
          <Icon name="add_circle" size={18} style={{ color: "var(--arbor-lav-ink)" }} />
          <span className="text-xs font-bold" style={{ color: "var(--arbor-ink)" }}>
            {t("elev.waveR.words.empty")}
          </span>
        </button>
      )}

      {/* GP-22 — where these rows come from, and the door to the Trust Center. */}
      <div className="mt-3">
        <ContentWhyLine why={t("elev.waveR.why.words")} trustLink surface="growth-first-words" />
      </div>
    </section>
  );
}
