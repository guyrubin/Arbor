/**
 * AP-054 — Language Lab Vocab View
 *
 * Combined-total-first bilingual vocabulary count and trend view.
 * Read-only over parent-logged phrase observations (ChildCollection "langObs").
 * No ASR, no automated word detection, no new child-data write from this component.
 *
 * BINDING SLP-CLEARED COPY (board-cleared per ASHA + Core et al. 2013):
 *  - LEADS with the COMBINED TOTAL; per-language mix is SECONDARY neutral context.
 *  - Mix label: "Logged mix: Hebrew / English" — NOT "balance"/"imbalance"/"gap".
 *  - Interpretation caption is REQUIRED adjacent to the mix display.
 *  - Provenance line is REQUIRED and visible at all times.
 *  - Activity section title: "Ideas for both languages" — NEVER "balanced activities".
 *  - Activity sub-line: "These are ideas, not instructions…" — REQUIRED.
 *  - First-view disclaimer is REQUIRED (re-accessible via toggle).
 *  - NO red/amber on the lower-count language.
 *  - Trend lines show per-language growth but NEVER characterize one as falling behind.
 *  - NEVER a readiness score/percentile/verdict.
 */

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { SectionCard, cardCls, Chip } from "../ui/kit";
import { T } from "../../lib/tokens";
import {
  aggregateLangCounts,
  combinedTotal,
  buildVocabTrend,
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

export default function LanguageLabVocabView() {
  const { childProfile } = useArbor();
  const { t } = useLanguage();

  const [showDisclaimer, setShowDisclaimer] = useState(true);
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

  // Aggregate counts.
  const counts = useMemo(() => aggregateLangCounts(observations), [observations]);
  const total = useMemo(() => combinedTotal(counts), [counts]);

  // Trend data.
  const trend = useMemo(
    () => buildVocabTrend(observations, Date.now(), 90),
    [observations],
  );

  // Derive HE and EN counts for the mix display.
  // Searches for languages containing "Hebrew"/"English" (case-insensitive)
  // to handle variations like "Hebrew", "עברית", "English", "אנגלית".
  const heCount = counts.find((c) => /hebrew|עברית/i.test(c.language))?.count ?? 0;
  const enCount = counts.find((c) => /english|אנגלית/i.test(c.language))?.count ?? 0;

  // If fewer than 2 languages configured, show a gentle prompt.
  if (languages.length < 2) {
    return (
      <div className={`${cardCls} p-6 text-sm`} style={{ color: T.muted }}>
        {t("vl.noLangs", { first })}
      </div>
    );
  }

  // Trend chart data — use cumulative total + per-language breakdown.
  const chartData = trend.map((pt) => ({
    label: pt.label,
    total: pt.cumulativeTotal,
    ...Object.fromEntries(
      languages.map((l) => [l, pt.byLanguage[l] ?? 0])
    ),
  }));

  return (
    <div className="space-y-5">
      {/* Disclaimer — first-view (REQUIRED, re-accessible) */}
      <AnimatePresence>
        {showDisclaimer && (
          <DisclaimerPanel t={t} onClose={() => setShowDisclaimer(false)} />
        )}
      </AnimatePresence>

      {/* Re-open disclaimer toggle */}
      {!showDisclaimer && (
        <button
          onClick={() => setShowDisclaimer(true)}
          className="inline-flex items-center gap-1.5 text-xs font-bold min-h-[44px]"
          style={{ color: T.muted }}
        >
          <Icon name="info" size={14} />
          {t("vl.disclaimerToggle")}
        </button>
      )}

      <SectionCard
        title={t("vl.sectionTitle")}
        icon={<Icon name="menu_book" size={20} />}
        tone="sky"
      >
        <div className="space-y-5">
          {total === 0 ? (
            /* ── Teaching empty state — optional, private, never the hero ── */
            <div className="text-center py-2 space-y-2">
              <p className="text-sm leading-relaxed" style={{ color: T.ink }}>
                {t("lang.vocabEmptyTitle", { first })}
              </p>
              <p className="text-xs" style={{ color: T.muted }}>
                {t("lang.vocabEmptyNote")}
              </p>
            </div>
          ) : (
            /* ── COMBINED TOTAL LEADS (required by spec) ── */
            <div className="text-center py-2">
              <p className="text-[10px] uppercase font-bold tracking-widest mb-1" style={{ color: T.muted }}>
                {t("vl.totalLabel")}
              </p>
              <p
                className="text-4xl font-extrabold"
                style={{ fontFamily: T.fontDisplay, color: T.greenInk }}
              >
                {total}
              </p>
              <p className="text-xs mt-1" style={{ color: T.muted }}>
                {total === 1 ? t("vl.totalCountOne") : t("vl.totalCount", { n: total })}
              </p>
            </div>
          )}

          {/* ── Mix display — SECONDARY neutral context ── */}
          {total > 0 && (
            <div
              className="rounded-2xl p-4 space-y-2"
              style={{ background: T.paperDeep }}
            >
              {/* Mix label — verbatim board-cleared copy */}
              <p className="text-xs font-bold" style={{ color: T.muted }}>
                {t("vl.mixLabel")}
              </p>

              {/* Mix value — verbatim format */}
              <p className="text-xs" style={{ color: T.ink }}>
                {t("vl.mixValue", { heCount, enCount })}
              </p>

              {/* GP-20 clinical firewall: per-language COUNTS. The share
                  percentage, its proportional bar and the `progressbar` role
                  (aria-valuenow carried the same percentage to a screen reader)
                  all graded one language against another on a parent surface. */}
              <ul className="space-y-1 pt-1">
                {counts.map((c, idx) => (
                  <li key={c.language} className="flex justify-between text-[10px]">
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

              {/* Interpretation caption — REQUIRED adjacent, verbatim board-cleared */}
              <p
                className="text-[11px] italic leading-relaxed pt-1"
                style={{ color: T.muted }}
                data-testid="vl-interpret-caption"
              >
                {t("vl.interpretCaption")}
              </p>
            </div>
          )}

          {/* ── Provenance line — REQUIRED, visible ── */}
          <p
            className="text-[11px] leading-relaxed"
            style={{ color: T.faint }}
            data-testid="vl-provenance"
          >
            {t("vl.provenance")}
          </p>
        </div>
      </SectionCard>

      {/* ── Vocabulary trend (last 90 days) — hidden until there's data to show ── */}
      {total > 0 && (
        <SectionCard
          title={t("vl.trendTitle")}
          icon={<Icon name="menu_book" size={20} />}
          tone="mint"
        >
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(41,51,63,0.06)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke={T.muted}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke={T.muted}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#ffffff",
                    border: "1px solid rgba(41,51,63,0.12)",
                    borderRadius: 12,
                    fontSize: 11,
                  }}
                  labelStyle={{ color: T.inkSoft, fontWeight: 700 }}
                />
                {/* Per-language areas — NO warning color on any language */}
                {languages.map((lang, idx) => (
                  <Area
                    key={lang}
                    type="monotone"
                    dataKey={lang}
                    stackId="1"
                    stroke={langColor(idx)}
                    fill={langColor(idx)}
                    fillOpacity={0.18}
                    strokeWidth={2}
                    dot={false}
                    name={lang}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
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
