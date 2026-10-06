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
 *    chart (a proportional picture). Counts per PROFILE language.
 *  - Interpretation caption is REQUIRED adjacent to the counts.
 *  - Provenance line is REQUIRED and visible at all times.
 *  - Activity section title: "Ideas for both languages" — NEVER "balanced activities".
 *  - Activity sub-line: "These are ideas, not instructions…" — REQUIRED.
 *  - First-view disclaimer is REQUIRED (re-accessible via toggle).
 *  - NO red/amber on the lower-count language.
 *  - B-GROWTH-36: NO per-month count list (never month against month).
 *  - NEVER a readiness score/percentile/verdict.
 */

import React, { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { SectionCard, cardCls, Chip } from "../ui/kit";
import { T } from "../../lib/tokens";
import { fmtDay, fmtDayShort } from "../../lib/formatDate";
import { languageName } from "../../lib/languageName";
import { childScopedKey } from "../../lib/childLocalState";
import {
  aggregateLangCounts,
  combinedTotal,
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
      // W2-GROWTH r1: an inline note, not a dialog role.
      aria-label={t("vl.disclaimerToggle")}
      data-testid="vl-disclaimer"
    >
      {/* REQUIRED first-view disclaimer — verbatim board-cleared copy */}
      <p className="leading-relaxed text-xs" style={{ color: T.ink }}>
        {t("vl.disclaimer")}
      </p>
      <div className="flex justify-end">
        <button
          onClick={onClose}
          // W2-GROWTH r1: a quiet text button — the page's one filled CTA is Add phrase.
          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl min-h-[44px]"
          style={{ background: "transparent", color: T.greenInk }}
          data-testid="vl-disclaimer-close"
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
  /** B-GROWTH-36: the saved word, so the page can show its say-back. */
  onAdded: (obs?: LangObservation) => void;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const col = useChildCollection<LangObservation>(childId, "langObs", {
    orderByField: "timestamp",
    orderDir: "desc",
    max: 500,
  });

  const [phrase, setPhrase] = useState("");
  const [lang, setLang] = useState(languages[0] ?? "");
  // W2-GROWTH r2: Add phrase is ALIVE at rest (the page's one CTA gradient);
  // an empty tap focuses the input and names what to write — aria-disabled,
  // never `disabled`, so the primary move never reads as a dead paper well.
  const inputRef = useRef<HTMLInputElement>(null);
  const [emptyHint, setEmptyHint] = useState(false);
  const empty = !phrase.trim();

  const handleAdd = () => {
    const trimmed = phrase.trim();
    if (!trimmed) {
      setEmptyHint(true);
      inputRef.current?.focus();
      return;
    }
    if (!lang) return;
    const id = `${lang}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const obs: LangObservation = {
      id,
      timestamp: new Date().toISOString(),
      language: lang,
      phrase: trimmed.slice(0, 120),
    };
    void col.upsert(obs);
    setPhrase("");
    onAdded(obs);
  };

  return (
    <div className={`${cardCls} p-4 space-y-3`}>
      <p className="text-xs font-bold" style={{ color: T.muted }}>
        {t("vl.logTitle")}
      </p>
      {/* W2-GROWTH r1: the Add button was clipped at 375 ("+ Add phr") — the
          flex-1 input had no min-w-0 so the row could not shrink. Below sm the
          row wraps: the input takes the full width, then the language select
          and Add share the second row; from sm up it is one row again. */}
      <div className="flex flex-wrap sm:flex-nowrap gap-2" data-testid="vl-log-row">
        <input
          ref={inputRef}
          value={phrase}
          onChange={(e) => { setPhrase(e.target.value); if (emptyHint) setEmptyHint(false); }}
          aria-describedby={emptyHint ? "vl-log-empty-hint" : undefined}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          placeholder={t("vl.logPlaceholder")}
          className="basis-full sm:basis-auto flex-1 min-w-0 rounded-xl px-3 py-2 text-xs min-h-[44px] focus:outline-none"
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
          className="min-w-0 rounded-xl px-2 py-2 text-xs min-h-[44px] focus:outline-none"
          style={{
            background: T.paperDeep,
            border: `1px solid var(--arbor-rule-strong)`,
            color: T.ink,
          }}
          aria-label={t("vl.logLangLabel")}
        >
          {languages.map((l) => (
            // Law 8: the stored value stays as written; the label is the reader's language.
            <option key={l} value={l}>{languageName(l, t)}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          aria-disabled={empty || undefined}
          // Item 9: the row's flex-1 input squeezed this to 32 px wide even
          // though min-h-[44px] was already set — a height floor is not a hit
          // box. shrink-0 + the width floor keep the primary move tappable.
          // W2-GROWTH r2: the page's ONE gradient CTA, at rest too — the
          // primary move reads first; an empty tap focuses the input instead.
          className="inline-flex flex-1 sm:flex-none shrink-0 items-center justify-center gap-1 text-xs font-bold px-4 min-w-11 rounded-xl min-h-[44px] transition"
          style={{ background: "var(--gradient-cta)", color: "var(--arbor-on-accent)" }}
          data-testid="vl-log-add"
          aria-label={t("vl.logSave")}
        >
          <Icon name="add" size={14} />
          {t("vl.logSave")}
        </button>
      </div>
      {emptyHint && (
        <p id="vl-log-empty-hint" className="text-xs" style={{ color: T.muted }} role="status" data-testid="vl-log-empty-hint">
          {t("vl.logEmptyHint")}
        </p>
      )}
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
/** W2-GROWTH r1 — the bilingual note shows on FIRST view only; the dismissal
 *  is remembered per child (device-local, swept with the child). Re-access
 *  stays on the vl.disclaimerToggle info button. Storage failures (private
 *  window) fall back to showing the note — never to hiding the REQUIRED copy. */
export const vocabNoteSeenKey = (childId: string) => childScopedKey("lang.noteSeen", childId);
function readNoteSeen(childId: string): boolean {
  try { return globalThis.localStorage?.getItem(vocabNoteSeenKey(childId)) === "1"; } catch { return false; }
}
function writeNoteSeen(childId: string): void {
  try { globalThis.localStorage?.setItem(vocabNoteSeenKey(childId), "1"); } catch { /* best effort */ }
}

export function WordsList() {
  const { childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const [showDisclaimer, setShowDisclaimer] = useState(() => !readNoteSeen(childProfile.id));
  const closeDisclaimer = () => { writeNoteSeen(childProfile.id); setShowDisclaimer(false); };
  // A word saved on this visit (the form writes `timestamp: now`) — the quiet
  // confirmation names where it goes; no confetti, no count delta.
  const mountedAt = useRef(Date.now());
  const languages = (childProfile.languages ?? []).map((l) => l.trim()).filter(Boolean);
  const bilingual = languages.length >= 2;
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
      <SectionCard
        title={t("vl.sectionTitle")}
        icon={<Icon name="menu_book" size={20} />}
        tone="sky"
        action={!showDisclaimer && total > 0 && bilingual ? (
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
              {/* B-GROWTH-NEW-1C/1D: the child's own newest word leads, quoted and
                  dated in the reader's language; after a save on this visit the
                  same line confirms where the word goes. */}
              {latest[0] && (() => {
                const w = latest[0];
                const justAdded = Date.parse(w.timestamp) >= mountedAt.current;
                return (
                  <div
                    className="rounded-2xl p-4 space-y-1 transition-colors duration-200"
                    style={justAdded
                      ? { background: T.greenSoft, color: T.greenInk }
                      : { background: T.paperElevated, border: "1px solid var(--arbor-rule)" }}
                    data-testid="vl-newest-word"
                    data-just-added={justAdded ? "true" : undefined}
                    aria-live="polite"
                  >
                    <p className="text-xs font-bold" style={{ color: justAdded ? T.greenInk : T.muted }}>
                      {justAdded ? t("vl.newest.added", { first }) : t("vl.newest.label", { first })}
                    </p>
                    <p style={{ fontFamily: "var(--font-editorial)", fontSize: "var(--t-xl)", color: T.ink }}>
                      <bdi dir="auto">“{w.phrase}”</bdi>
                    </p>
                    <p className="text-xs" style={{ color: T.muted }}>
                      {languageName(w.language, t)} · {fmtDayShort(w.timestamp, uiLang)}
                    </p>
                  </div>
                );
              })()}
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
                        {languageName(c.language, t)}
                      </span>
                      <span style={{ color: T.ink }}>{c.count}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] italic leading-relaxed pt-1" style={{ color: T.muted }} data-testid="vl-interpret-caption">
                  {t("vl.interpretCaption")}
                </p>
              </div>
              {latest.length > 1 && <div>
                <p className="text-[12px] font-bold mb-1.5" style={{ color: T.muted }}>{t("elev.growth.lang.words.latest")}</p>
                <ul className="space-y-1" data-testid="vl-latest-words">
                  {latest.slice(1).map((w) => (
                    <li key={w.id} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 break-words" dir="auto" style={{ color: T.ink }}>{w.phrase}</span>
                      <span className="flex-shrink-0 text-[12px]" style={{ color: T.muted }}>
                        {languageName(w.language, t)} · {fmtDay(w.timestamp, uiLang)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>}
              {/* W2-GROWTH r2: the REQUIRED first-view note (re-accessible via
                  vl.disclaimerToggle) comes AFTER the child's words — it filled
                  the 375 fold above them, so "words first" was false on the
                  first view. Only when the profile carries 2+ languages. */}
              <AnimatePresence>
                {showDisclaimer && bilingual && (
                  <DisclaimerPanel t={t} onClose={closeDisclaimer} />
                )}
              </AnimatePresence>
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
  const { t } = useLanguage();

  const [showActivities, setShowActivities] = useState(false);

  const languages = (childProfile.languages ?? []).map((l) => l.trim()).filter(Boolean);
  const first = childProfile.name.split(" ")[0];

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
          stays here, in the disclosure, is the ideas.
          B-GROWTH-36: the per-month word count list is GONE — never month
          against month (vocabAgg.test pins its absence). */}

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
                        {t(titleKey, { lang: languageName(lang, t) })}
                      </p>
                      <p style={{ color: T.muted }}>{t(bodyKey, { lang: languageName(lang, t) })}</p>
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
