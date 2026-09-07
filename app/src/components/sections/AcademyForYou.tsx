/**
 * AcademyForYou (AP-053) — Academy "For You" section.
 *
 * Joins the EXISTING copilot focus recommendation (computeDevScore → focusDomain)
 * with Academy course progress by domain (masterclasses explored vs available).
 *
 * SAFETY GATE (board-cleared 2026-06-22, TIGHTENED by OBJ-GROWTH-05 2026-09-07):
 *  - The 2026-06 framing ("a good place to explore next") was still a pointer at
 *    a ranking of the child's areas, and it rendered against 0 noticed
 *    milestones and 0 logs. Law 1 bans weakest-domain pointers outright, so the
 *    ranking may order the card internally but is never NAMED, and at day-0 the
 *    card falls back to the age-only why-line (learn.whyAge) the Learn lane
 *    already uses.
 *  - No warning/amber/red token on the recommended-domain card (neutral/positive only).
 *  - Domains are NOT rendered as a ranked deficit list.
 *  - Verbatim cleared copy is used verbatim — no paraphrase.
 *  - No new AI call. No new Firestore read. Pure frontend join.
 *
 * Data sources:
 *  - focusDomain: computeDevScore from existing milestones (same path as DevScoreCard /
 *    ScholarHubCard — no new read, no new write).
 *  - course progress: MASTERCLASSES catalogue + localStorage "arbor.masterclasses.done"
 *    (same key used by Masterclasses.tsx, read-only here).
 *
 * TOKEN-ONLY styling: var(--arbor-*). No raw hex. No index.css edits.
 * Logical CSS for HE/RTL. Touch targets >= 44px.
 */

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useDevScore } from "../../hooks/useDevScore";
import { MASTERCLASSES, FRAME_LABELS } from "../../lib/masterclasses";
import type { FrameId } from "../../lib/masterclasses";
import framework from "../../framework.json";
import { cardCls, ProgressBar, RadialProgress, domainVisual, PASTEL } from "../ui/kit";
import { TrustLink } from "../trust/TrustLink";

// ── Domain label lookup (mirrors DevScoreCard + ScholarHubCard) ───────────────

const DOMAIN_LABEL: Record<string, string> = Object.fromEntries(
  (framework.domains as { id: string; label: string }[]).map((d) => [d.id, d.label])
);
/**
 * LC-13 / item 8: framework.json's `label` is English-only, so the Learning
 * Map printed English domain names inside the Hebrew app. The six monitored
 * domains already have a bilingual dictionary — `screen.domain.<id>`, used by
 * the screening surfaces — so this reuses it rather than minting a second
 * canon. `translate` returns the key itself when it is missing, which is the
 * signal to fall back to framework.json (today only `ecosystem_stressors`).
 */
const labelFor = (id: string, t: (key: string) => string) => {
  const key = `screen.domain.${id}`;
  const translated = t(key);
  return translated === key ? DOMAIN_LABEL[id] ?? id : translated;
};

// ── Course-progress read ───────────────────────────────────────────────────────

const DONE_KEY = "arbor.masterclasses.done";

function loadExplored(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(DONE_KEY) || "{}");
  } catch {
    return {};
  }
}

/**
 * Map each masterclass to a domain. We derive this from MASTERCLASS_VIRTUES
 * (defined in Masterclasses.tsx) — but here we use a frame → domain mapping
 * so the component stays self-contained and independent.
 *
 * Masterclass frames map to primary developmental domains:
 *   aim      → independence_adaptive_skills (responsibility / competence)
 *   twoAxes  → attachment_regulation        (warmth & structure / co-regulation)
 *   story    → social_development           (narrative, courage in social context)
 *   shadow   → attachment_regulation        (hard feelings / regulation)
 *   marriage → ecosystem_stressors          (co-parenting / family context)
 *   shepherd → independence_adaptive_skills (next steward / autonomy ladder)
 *
 * This is an editorial mapping for the "explore" surface only — not a
 * developmental claim about the child. No diagnostic content here.
 */
const FRAME_TO_DOMAIN: Record<FrameId, string> = {
  aim: "independence_adaptive_skills",
  twoAxes: "attachment_regulation",
  story: "social_development",
  shadow: "attachment_regulation",
  marriage: "ecosystem_stressors",
  shepherd: "independence_adaptive_skills",
};

interface DomainCourseRow {
  domainId: string;
  explored: number;
  available: number;
}

function buildDomainRows(explored: Record<string, boolean>): DomainCourseRow[] {
  // Count masterclasses per domain and how many explored
  const map = new Map<string, { explored: number; available: number }>();

  for (const mc of MASTERCLASSES) {
    const domainId = FRAME_TO_DOMAIN[mc.frame];
    const existing = map.get(domainId) ?? { explored: 0, available: 0 };
    existing.available += 1;
    if (explored[mc.id]) existing.explored += 1;
    map.set(domainId, existing);
  }

  return Array.from(map.entries())
    .map(([domainId, { explored: ex, available: av }]) => ({
      domainId,
      explored: ex,
      available: av,
    }))
    .sort((a, b) => a.domainId.localeCompare(b.domainId));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AcademyForYou({ onNavigateToMasterclasses }: { onNavigateToMasterclasses?: () => void }) {
  const { milestones, childProfile } = useArbor();
  const { t, aiLang } = useLanguage();
  const firstName = (childProfile.name || "").split(" ")[0];
  const he = aiLang === "he";

  // "Why" expansion state
  const [whyOpen, setWhyOpen] = useState(false);

  // The ONE shared dev-score derivation (hooks/useDevScore) — the same result
  // DevScoreCard and ScholarHubCard read. Only focusDomain is required here.
  const score = useDevScore();

  // Course exploration state from localStorage (same key as Masterclasses.tsx).
  const explored = useMemo(() => loadExplored(), []);

  // Domain rows for the course roll-up
  const domainRows = useMemo(() => buildDomainRows(explored), [explored]);

  // The recommended domain label
  const focusDomain = score.focusDomain;
  const focusLabel = focusDomain ? labelFor(focusDomain, t) : null;

  // OBJ-GROWTH-05: `confidence` measures how big the milestone CATALOGUE is for
  // this age, not how much the parent has noticed — so the ranked card used to
  // render a "good place to explore next" with 0 milestones noticed and 0 logs.
  // Nothing noticed = nothing to rank; the card falls back to the age-only
  // teach line the Learn lane already ships (learn.whyAge).
  const noticed = score.domains.reduce((n, d) => n + d.reached, 0);

  // ── No-data state (nothing noticed yet, or no focus derivable) ──────────
  if (score.confidence === "none" || noticed === 0 || !focusDomain || !focusLabel) {
    return (
      <div
        className={`${cardCls} p-5`}
        data-testid="academy-foryou-nodata"
      >
        <div className="flex items-center gap-3 mb-3">
          <span
            className="inline-flex items-center justify-center rounded-2xl flex-shrink-0"
            style={{
              background: "var(--arbor-green-soft)",
              color: "var(--arbor-green-ink)",
              width: 40,
              height: 40,
            }}
          >
            <Icon name="explore" size={20} />
          </span>
          <span
            className="text-[11px] uppercase tracking-widest font-bold"
            style={{ color: "var(--arbor-green-ink)" }}
          >
            {t("foryou.eyebrow")}
          </span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
          {t("foryou.nodata")}
        </p>
        <p className="text-[12px] leading-relaxed mt-2" style={{ color: "var(--arbor-muted)" }} data-testid="academy-foryou-why-age">
          {t("learn.whyAge", { name: firstName })}
        </p>
      </div>
    );
  }

  // ── Main view ─────────────────────────────────────────────────────────────
  // Find the domain row for the recommended domain
  const recommendedRow = domainRows.find((r) => r.domainId === focusDomain);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid="academy-foryou"
      className="space-y-4"
    >
      {/* ── Recommended domain card (NEUTRAL/POSITIVE token — no warn/amber/red) ── */}
      <div
        className={`${cardCls} p-5`}
        data-testid="academy-foryou-recommended"
        style={{
          /* Positive/neutral token: green-soft background, green-ink text — no warn/amber/red */
          background: "var(--arbor-paper-elevated)",
          border: "1px solid var(--arbor-rule)",
        }}
      >
        {/* Section header — VERBATIM cleared copy */}
        <div className="flex items-center gap-3 mb-4">
          <span
            className="inline-flex items-center justify-center rounded-2xl flex-shrink-0"
            style={{
              background: "var(--arbor-green-soft)",
              color: "var(--arbor-green-ink)",
              width: 40,
              height: 40,
            }}
          >
            <Icon name="explore" size={20} />
          </span>
          <h2
            className="text-[15px] font-extrabold leading-snug"
            style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}
          >
            {/* OBJ-GROWTH-05: no "explore next" ranking language. */}
            {t("elev.growthTruth.learn.header")}
          </h2>
        </div>

        {/* Recommended domain chip — POSITIVE/NEUTRAL styling only */}
        <div
          className="rounded-2xl px-4 py-2.5 mb-4"
          style={{
            background: "var(--arbor-green-soft)",
            border: "1px solid rgba(52,178,119,0.20)",
          }}
          data-testid="academy-foryou-domain-chip"
        >
          <span
            className="text-sm font-extrabold"
            style={{ color: "var(--arbor-green-ink)" }}
          >
            {focusLabel}
          </span>
        </div>

        {/* Recommendation line — VERBATIM cleared copy */}
        <p
          className="text-[14px] leading-relaxed mb-4"
          style={{ color: "var(--arbor-ink)" }}
          data-testid="academy-foryou-rec-line"
          dir="auto"
        >
          {t("foryou.recLine", { domain: focusLabel })}
        </p>

        {/* "Here's why" expansion — LOAD-BEARING verbatim copy.
            Masterplan 3.1: the TrustLink chip rides the SAME row as the why
            toggle (not inside the collapsed body) so the why → Trust Center
            chain is reachable without expanding. It stays a quiet lav chip —
            the "Explore the Academy" CTA below remains this card's primary. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button
            className="inline-flex items-center gap-1.5 text-[13px] font-bold min-h-[44px] rounded-xl px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{
              color: "var(--arbor-green-ink)",
              background: "var(--arbor-paper-deep)",
              border: "1px solid var(--arbor-rule)",
            }}
            onClick={() => setWhyOpen((v) => !v)}
            aria-expanded={whyOpen}
            data-testid="academy-foryou-why-toggle"
          >
            {t("foryou.whyToggle")}
            {whyOpen
              ? <Icon name="expand_less" size={16} />
              : <Icon name="expand_more" size={16} />}
          </button>
          <TrustLink surface="academy-foryou" />

          <AnimatePresence>
            {whyOpen && (
              <motion.div
                key="why-body"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden w-full"
              >
                <p
                  className="text-[13.5px] leading-relaxed mt-3 rounded-xl px-4 py-3"
                  style={{
                    color: "var(--arbor-ink-soft)",
                    background: "var(--arbor-paper-deep)",
                    border: "1px solid var(--arbor-rule)",
                  }}
                  data-testid="academy-foryou-why-body"
                  dir="auto"
                >
                  {/* OBJ-GROWTH-05: the reason is about what the FAMILY has
                      opened, never "the area you've logged least about". At
                      day-0 the card never reaches here (age-only branch above). */}
                  {t("elev.growthTruth.learn.why.explored", { name: firstName })}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Course roll-up for the recommended domain */}
        {recommendedRow && (
          <div
            className="mt-5 rounded-xl px-4 py-3"
            style={{
              background: "var(--arbor-paper-deep)",
              border: "1px solid var(--arbor-rule)",
            }}
          >
            <p
              className="text-[11px] uppercase tracking-widest font-bold mb-1"
              style={{ color: "var(--arbor-muted)" }}
            >
              {/* "Courses to explore for [Domain]" — VERBATIM cleared copy */}
              {t("foryou.coursesLabel", { domain: focusLabel })}
            </p>
            <p
              className="text-[14px] font-extrabold"
              style={{ color: "var(--arbor-ink)" }}
              data-testid="academy-foryou-progress"
            >
              {/* "[X] of [Y] explored" — VERBATIM cleared copy (NOT "% complete") */}
              {t("foryou.progress", {
                x: recommendedRow.explored,
                y: recommendedRow.available,
              })}
            </p>
          </div>
        )}

        {/* CTA to open masterclasses */}
        {onNavigateToMasterclasses && (
          <button
            onClick={onNavigateToMasterclasses}
            className="mt-4 inline-flex items-center gap-1.5 font-bold text-[13px] rounded-xl px-4 py-2.5 min-h-[44px] transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{
              background: "var(--arbor-paper-deep)",
              color: "var(--arbor-green-ink)",
              border: "1px solid var(--arbor-clay-dim)",
            }}
            data-testid="academy-foryou-cta"
          >
            <Icon name="school" size={17} />
            {t("foryou.cta")}
          </button>
        )}
      </div>

      {/* ── Learning Map — all-domains course roll-up ───────────────────────────
          The design's "Learning Map" spine: an overall progress ring over a
          per-domain list of COUNT bars (icon + dot + cleared "X of Y explored"
          label + a count-based bar). NOT a ranked deficit list — ordered
          alphabetically by domain id. The ring/bars render value/total COUNTS
          (explored masterclasses of available), never a 0–100 competence verdict;
          the cleared verbatim "X of Y explored" text is kept in ADDITION to the
          bar. Ring accent is --arbor-green-ink via tone="mint" (never blue). */}
      {domainRows.length > 0 && (() => {
        const totalExplored = domainRows.reduce((s, r) => s + r.explored, 0);
        const totalAvailable = domainRows.reduce((s, r) => s + r.available, 0);
        return (
          <div
            className={`${cardCls} p-5`}
            data-testid="academy-foryou-all-domains"
          >
            <h3
              className="text-[13px] font-extrabold uppercase tracking-widest mb-4"
              style={{ color: "var(--arbor-muted)" }}
            >
              {t("foryou.allDomainsHeader")}
            </h3>

            {/* Overall ring — a COUNT of explored courses across domains, not a
                competence score. Centre label shows the raw count, never "%". */}
            <div className="flex items-center gap-4 mb-5">
              <RadialProgress value={totalExplored} total={totalAvailable} tone="mint" size={88} thickness={9}>
                <span className="text-center leading-none">
                  <span className="block text-[18px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>
                    {totalExplored}
                  </span>
                  <span className="block text-[10px] font-bold" style={{ color: "var(--arbor-muted)" }}>
                    / {totalAvailable}
                  </span>
                </span>
              </RadialProgress>
              <p className="text-[13px] leading-relaxed min-w-0" style={{ color: "var(--arbor-ink-soft)" }} dir="auto">
                {t("foryou.progress", { x: totalExplored, y: totalAvailable })}
              </p>
            </div>

            <div className="space-y-3.5">
              {/* Alphabetical order only — never rendered as a ranked deficit list */}
              {domainRows.map((row) => {
                const v = domainVisual(row.domainId);
                const DomainIcon = v.icon;
                return (
                  <div
                    key={row.domainId}
                    data-testid={`academy-foryou-domain-row-${row.domainId}`}
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      {/* leading domain color dot + lucide icon */}
                      <span
                        className="inline-flex items-center justify-center rounded-lg flex-shrink-0"
                        style={{ background: PASTEL[v.tone].soft, color: PASTEL[v.tone].ink, width: 26, height: 26 }}
                      >
                        <DomainIcon className="w-3.5 h-3.5" aria-hidden />
                      </span>
                      <span
                        className="text-[13px] font-bold truncate flex-1 min-w-0"
                        style={{ color: "var(--arbor-ink)" }}
                        title={labelFor(row.domainId, t)}
                      >
                        {labelFor(row.domainId, t)}
                      </span>
                      {/* "[X] of [Y] explored" — VERBATIM cleared label, kept in ADDITION to the bar */}
                      <span
                        className="text-[12px] font-extrabold flex-shrink-0"
                        style={{ color: "var(--arbor-muted)" }}
                      >
                        {t("foryou.progress", { x: row.explored, y: row.available })}
                      </span>
                    </div>
                    {/* COUNT bar (explored / available), domain-colored — not a verdict */}
                    <ProgressBar value={row.explored} total={row.available} tone={v.tone} height={7} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Non-diagnostic provenance note */}
      <p className="text-[11.5px] px-1" style={{ color: "var(--arbor-faint)" }}>
        {t("foryou.provenance")}
      </p>
    </motion.div>
  );
}
