/**
 * AP-054 — Language Lab Vocab View
 *
 * Combined-total-first bilingual vocabulary count and trend view.
 * Read-only over parent-logged phrase observations (ChildCollection "langObs").
 * No ASR, no automated word detection, no new child-data write from this component.
 *
 * BINDING SLP-CLEARED COPY (board-cleared per ASHA + Core et al. 2013):
 *  - LEADS with the COMBINED TOTAL; per-language counts are SECONDARY neutral context.
 *  - B-GROWTH-14: no "Hebrew / English" mix line (it assumed two languages a
 *    Russian- or Arabic-speaking family does not have) and no per-language
 *    chart (a proportional picture). Counts per PROFILE language + a month list.
 *  - Interpretation caption is REQUIRED adjacent to the counts.
 *  - Provenance line is REQUIRED and visible at all times.
 *  - Activity section title: "Ideas for both languages" — NEVER "balanced activities".
 *  - Activity sub-line: "These are ideas, not instructions…" — REQUIRED.
 *  - First-view disclaimer is REQUIRED (re-accessible via toggle).
 *  - NO red/amber on the lower-count language.
 *  - The month list is a plain count per month; it NEVER characterizes one language.
 *  - NEVER a readiness score/percentile/verdict.
 */

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { SectionCard, cardCls, Chip } from "../ui/kit";
import { T } from "../../lib/tokens";
import { fmtDay } from "../../lib/formatDate";
import {
  aggregateLangCounts,
  combinedTotal,
  monthlyWordCounts,
  profileLangCounts,
  type LangObservation,
} from "../../growth/vocabAgg";

// AP-043 tokens only — no raw hex/rgba.
const LANG_COLORS = {
  0: T.greenInk,    // first language: green (primary, neither "better" nor "worse")
  1: T.skyInk,      // second language: sky (secondary, neutral)
  2: T.lavInk,      // third language: lavender
} as const;

function langColor(idx: number): string {
  return (LANG_COLORS as Record<number, string>)[idx] ?? T.muted;
}

// ── Disclaimer panel ─────────────────────────────────────────────────────────

function DisclaimerPanel({ t, onClose }: { t: (k: string, v?: Record<string, string | number>) => string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-2xl p-5 space-y-3 text-sm"
      style={{ background: T.greenSoft, color: T.ink }}
      role="dialog"
      aria-label={t("vl.disclaimerToggle")}
    >
      {/* REQUIRED first-view disclaimer — verbatim board-cleared copy */}
      <p className="leading-relaxed text-xs" style={{ color: T.ink }}>
        {t("vl.disclaimer")}
      </p>
      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl min-h-[44px]"
          style={{ background: T.greenInk, color: T.onAccent }}
        >
          {t("vl.disclaimerClose")}
        </button>
      </div>
    </motion.div>
  );
}

// ── Inline phrase log form ────────────────────────────────────────────────────
// Parents log phrases explicitly; this component writes to the "langObs"
// collection. Zero ASR, zero automated detection.

/**
 * The Language Lab's primary move. It used to render at the BOTTOM of this
 * view, which itself renders last on the hub — the input sat at y 2431 on a
 * phone, so the one thing a parent comes here to do was two and a half screens
 * below the fold. It is exported and mounted directly under the hub header
 * (LanguageLabTab) instead. The vocabulary COUNTER stays demoted where AP-054
 * put it: an empty counter is still never the hero. The form is not a counter.
 */
export function PhraseLogForm({
  childId,
  languages,
  onAdded,
  t,
}: {
  childId: string;
  languages: string[];
  onAdded: () => void;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const col = useChildCollection<LangObservation>(childId, "langObs", {
    orderByField: "timestamp",
    orderDir: "desc",
    max: 500,
  });

  const [phrase, setPhrase] = useState("");
  const [lang, setLang] = useState(languages[0] ?? "");

  const handleAdd = () => {
    const trimmed = phrase.trim();
    if (!trimmed || !lang) return;
    const id = `${lang}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const obs: LangObservation = {
      id,
      timestamp: new Date().toISOString(),
      language: lang,
      phrase: trimmed.slice(0, 120),
    };
    void col.upsert(obs);
    setPhrase("");
    onAdded();
  };

  return (
    <div className={`${cardCls} p-4 space-y-3`}>
      <p className="text-xs font-bold" style={{ color: T.muted }}>
        {t("vl.logTitle")}
      </p>
      <div className="flex gap-2">
        <input
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          placeholder={t("vl.logPlaceholder")}
          className="flex-1 rounded-xl px-3 py-2 text-xs min-h-[44px] focus:outline-none"
          style={{
            background: T.paperDeep,
            border: `1px solid var(--arbor-rule-strong)`,
            color: T.ink,
          }}
          maxLength={120}
          aria-label={t("vl.logPlaceholder")}
        />
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="rounded-xl px-2 py-2 text-xs min-h-[44px] focus:outline-none"
          style={{
            background: T.paperDeep,
            border: `1px solid var(--arbor-rule-strong)`,
            color: T.ink,
          }}
          aria-label={t("vl.logLangLabel")}
        >
          {languages.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          disabled={!phrase.trim()}
          // Item 9: the row's flex-1 input squeezed this to 32 px wide even
          // though min-h-[44px] was already set — a height floor is not a hit
          // box. shrink-0 + the width floor keep the primary move tappable.
          className="inline-flex shrink-0 items-center justify-center gap-1 text-xs font-bold px-4 min-w-11 rounded-xl min-h-[44px] transition disabled:opacity-40"
          style={{ background: T.greenInk, color: T.onAccent }}
          aria-label={t("vl.logSave")}
        >
          <Icon name="add" size={14} />
          {t("vl.logSave")}
        </button>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * B-GROWTH-16 — the words written down, as the SECOND top-level module of
 * #/language (under the log form): the first-view disclaimer (REQUIRED,
 * re-accessible), the combined total, the per-language counts in the
 * profile's own languages with the interpretation caption, the latest five
 * words with their dates, and the provenance line. Counts and dates only —
 * no share, no bar, no comparison between languages (GP-20 firewall).
 */
export function WordsList() {
  const { childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const languages = (childProfile.languages ?? []).map((l) => l.trim()).filter(Boolean);
  const first = childProfile.name.split(" ")[0];
  const obsCol = useChildCollection<LangObservation>(childProfile.id, "langObs", {
    orderByField: "timestamp",
    orderDir: "desc",
    max: 500,
  });
  const observations = obsCol.items;
  const counts = useMemo(() => aggregateLangCounts(observations), [observations]);
  const total = useMemo(() => combinedTotal(counts), [counts]);
  const langRows = useMemo(() => profileLangCounts(languages, counts), [languages, counts]);
  const latest = useMemo(
    () => [...observations].sort((x, y) => (x.timestamp < y.timestamp ? 1 : -1)).slice(0, 5),
    [observations],
  );

  return (
    <div className="space-y-3" data-testid="lang-words-list">
      <AnimatePresence>
        {showDisclaimer && total > 0 && (
          <DisclaimerPanel t={t} onClose={() => setShowDisclaimer(false)} />
        )}
      </AnimatePresence>
      <SectionCard
        title={t("vl.sectionTitle")}
        icon={<Icon name="menu_book" size={20} />}
        tone="sky"
        action={!showDisclaimer && total > 0 ? (
          <button
            onClick={() => setShowDisclaimer(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold min-h-11"
            style={{ color: T.muted }}
          >
            <Icon name="info" size={14} />
            {t("vl.disclaimerToggle")}
          </button>
        ) : undefined}
      >
        <div className="space-y-4">
          {total === 0 ? (
            <div className="text-center py-2 space-y-2">
              <p className="text-sm leading-relaxed" style={{ color: T.ink }}>
                {t("lang.vocabEmptyTitle", { first })}
              </p>
              <p className="text-xs" style={{ color: T.muted }}>
                {t("lang.vocabEmptyNote")}
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm font-bold" style={{ color: T.ink }} data-testid="vl-total">
                {total === 1 ? t("vl.totalCountOne") : t("vl.totalCount", { n: total })}
              </p>
              <div className="rounded-2xl p-4 space-y-2" style={{ background: T.paperDeep }}>
                <ul className="space-y-1" data-testid="vl-lang-counts">
                  {langRows.map((c, idx) => (
                    <li key={c.language} className="flex justify-between text-[12px]">
                      <span style={{ color: T.muted }}>
                        <span
                          aria-hidden="true"
                          className="inline-block w-1.5 h-1.5 rounded-full me-1.5 align-middle"
                          style={{ background: langColor(idx) }}
                        />
                        {c.language}
                      </span>
                      <span style={{ color: T.ink }}>{c.count}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] italic leading-relaxed pt-1" style={{ color: T.muted }} data-testid="vl-interpret-caption">
                  {t("vl.interpretCaption")}
                </p>
              </div>
              <div>
                <p className="text-[12px] font-bold mb-1.5" style={{ color: T.muted }}>{t("elev.growth.lang.words.latest")}</p>
                <ul className="space-y-1" data-testid="vl-latest-words">
                  {latest.map((w) => (
                    <li key={w.id} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 break-words" dir="auto" style={{ color: T.ink }}>{w.phrase}</span>
                      <span className="flex-shrink-0 text-[12px]" style={{ color: T.muted }}>
                        {w.language} · {fmtDay(w.timestamp, uiLang)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
          <p className="text-[11px] leading-relaxed" style={{ color: T.faint }} data-testid="vl-provenance">
            {t("vl.provenance")}
          </p>
        </div>
      </SectionCard>
    </div>
  );
}

export default function LanguageLabVocabView() {
  const { childProfile } = useArbor();
  const { t, uiLang } = useLanguage();

  const [showActivities, setShowActivities] = useState(false);

  const childId = childProfile.id;
  const languages = (childProfile.languages ?? []).map((l) => l.trim()).filter(Boolean);
  const first = childProfile.name.split(" ")[0];

  // READ-ONLY collection consumer — no writes from this component.
  const obsCol = useChildCollection<LangObservation>(childId, "langObs", {
    orderByField: "timestamp",
    orderDir: "desc",
    max: 500,
  });

  const observations = obsCol.items;

  // B-GROWTH-14: a plain month list in place of the stacked per-language chart.
  const months = useMemo(() => monthlyWordCounts(observations, 6), [observations]);
  const monthFmt = useMemo(
    () => new Intl.DateTimeFormat(uiLang === "he" ? "he-IL" : "en-US", { month: "long", timeZone: "UTC" }),
    [uiLang],
  );
  const monthFmtYear = useMemo(
    () => new Intl.DateTimeFormat(uiLang === "he" ? "he-IL" : "en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    [uiLang],
  );
  const thisYear = new Date().getUTCFullYear();

  // If fewer than 2 languages configured, show a gentle prompt.
  if (languages.length < 2) {
    return (
      <div className={`${cardCls} p-6 text-sm`} style={{ color: T.muted }}>
        {t("vl.noLangs", { first })}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* B-GROWTH-16: the words list (with its first-view disclaimer, the
          per-language counts, the interpretation caption and the provenance
          line) moved up to a top-level module — see WordsList below. What
          stays here, in the disclosure, is the month list and the ideas. */}

      {/* ── B-GROWTH-14: words logged per month — a plain list, newest first,
          at most six. Replaces the stacked per-language area chart. ── */}
      {months.length > 0 && (
        <SectionCard
          title={t("vl.month.title")}
          icon={<Icon name="calendar_month" size={20} />}
          tone="mint"
        >
          <ul className="space-y-1.5 text-sm" data-testid="vl-month-list">
            {months.map((m) => {
              const label = (m.year === thisYear ? monthFmt : monthFmtYear).format(new Date(Date.UTC(m.year, m.month, 1)));
              return (
                <li key={`${m.year}-${m.month}`} style={{ color: T.ink }}>
                  {m.count === 1 ? t("vl.month.row.one", { month: label }) : t("vl.month.row", { month: label, n: m.count })}
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}

      {/* ── Ideas for both languages ── */}
      <SectionCard
        title={t("vl.activitiesTitle")}
        icon={<Icon name="menu_book" size={20} />}
        tone="sky"
        action={
          <button
            onClick={() => setShowActivities((v) => !v)}
            /* R10 → R19: 44 tall, 16 WIDE. `min-w-11` measured 16 again —
               index.css resets min-width on every button/anchor UNLAYERED, so
               the layered utility loses; `.touch-target` is the floor that
               survives (see touchFloor.todayBehaviorsCoach.test.ts). */
            className="touch-target gap-1 text-xs"
            style={{ color: T.muted }}
            aria-expanded={showActivities}
            aria-label={t("vl.activitiesTitle")}
          >
            {showActivities ? <Icon name="expand_less" size={16} /> : <Icon name="expand_more" size={16} />}
          </button>
        }
      >
        <div className="space-y-3">
          <AnimatePresence>
            {showActivities && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                {languages.map((lang) => {
                  const isHe = /hebrew|עברית/i.test(lang);
                  const isEn = /english|אנגלית/i.test(lang);
                  const titleKey = isHe
                    ? "vl.actHeTitle"
                    : isEn
                    ? "vl.actEnTitle"
                    : "vl.actGenTitle";
                  const bodyKey = isHe
                    ? "vl.actHeBody"
                    : isEn
                    ? "vl.actEnBody"
                    : "vl.actGenBody";
                  return (
                    <div key={lang} className={`${cardCls} p-4 space-y-1 text-xs`}>
                      {/* Activity item pattern — verbatim format, optional enrichment, NEVER "catch up" */}
                      <p className="font-bold" style={{ color: T.ink }}>
                        {t(titleKey, { lang })}
                      </p>
                      <p style={{ color: T.muted }}>{t(bodyKey, { lang })}</p>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Activity sub-line — REQUIRED, verbatim board-cleared */}
          <p
            className="text-[11px] italic"
            style={{ color: T.muted }}
            data-testid="vl-activity-subline"
          >
            {t("vl.activitySubLine")}
          </p>
        </div>
      </SectionCard>

      {/* The phrase log form used to close this view; it is now mounted under
          the hub header (LanguageLabTab) so the primary move is above the fold. */}
    </div>
  );
}
