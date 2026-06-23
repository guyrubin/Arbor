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
import { BookOpen, Info, Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { SectionCard, cardCls, Chip } from "../ui/kit";
import { T } from "../../lib/tokens";
import {
  aggregateLangCounts,
  combinedTotal,
  mixPct,
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

function PhraseLogForm({
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
          className="inline-flex items-center gap-1 text-xs font-bold px-4 rounded-xl min-h-[44px] transition disabled:opacity-40"
          style={{ background: T.greenInk, color: T.onAccent }}
          aria-label={t("vl.logSave")}
        >
          <Plus className="w-3.5 h-3.5" />
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
  const hePct = mixPct(heCount, total);
  const enPct = mixPct(enCount, total);

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
          <Info className="w-3.5 h-3.5" />
          {t("vl.disclaimerToggle")}
        </button>
      )}

      <SectionCard
        title={t("vl.sectionTitle")}
        icon={<BookOpen className="w-5 h-5" />}
        tone="sky"
      >
        <div className="space-y-5">
          {/* ── COMBINED TOTAL LEADS (required by spec) ── */}
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
                {t("vl.mixValue", { hePct, enPct })}
              </p>

              {/* Per-language bars — NO warning/amber/red token on either bar */}
              <div className="space-y-2 pt-1">
                {counts.map((c, idx) => {
                  const pct = mixPct(c.count, total);
                  return (
                    <div key={c.language} className="space-y-0.5">
                      <div className="flex justify-between text-[10px]" style={{ color: T.muted }}>
                        <span>{c.language}</span>
                        <span>{pct}% · {c.count}</span>
                      </div>
                      <div
                        className="h-2 rounded-full overflow-hidden"
                        style={{ background: T.rule }}
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${c.language}: ${pct}%`}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            background: langColor(idx),
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

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

      {/* ── Vocabulary trend (last 90 days) ── */}
      <SectionCard
        title={t("vl.trendTitle")}
        icon={<BookOpen className="w-5 h-5" />}
        tone="mint"
      >
        {total === 0 ? (
          <p className="text-xs py-4 text-center" style={{ color: T.muted }}>
            {t("vl.trendEmpty")}
          </p>
        ) : (
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
        )}
      </SectionCard>

      {/* ── Ideas for both languages ── */}
      <SectionCard
        title={t("vl.activitiesTitle")}
        icon={<BookOpen className="w-5 h-5" />}
        tone="sky"
        action={
          <button
            onClick={() => setShowActivities((v) => !v)}
            className="inline-flex items-center gap-1 text-xs min-h-[44px]"
            style={{ color: T.muted }}
            aria-expanded={showActivities}
          >
            {showActivities ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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

      {/* ── Inline phrase log form ── */}
      <PhraseLogForm
        childId={childId}
        languages={languages}
        onAdded={() => {}}
        t={t}
      />

      {/* ── Empty state below log form ── */}
      {total === 0 && (
        <p className="text-xs text-center py-2" style={{ color: T.faint }}>
          {t("vl.logEmpty")}
        </p>
      )}
    </div>
  );
}
