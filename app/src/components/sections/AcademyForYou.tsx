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
 * B-PLAY-01 (law 1, overrides AP-053's verbatim copy): the lowest-score
 * ranker still ORDERS which courses lead, but nothing on this card NAMES it —
 * no domain chip, no "Arbor suggests starting with {domain}", no domain in the
 * courses label, and no per-domain ring/bars (the Learning Map lives in
 * Growth). The title says what the pick is built from: the child's age and
 * what the parent noticed.
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
import { domainLabel } from "../../lib/domains/registry";
import { cardCls } from "../ui/kit";
import { TrustLink } from "../trust/TrustLink";

// ── Domain label lookup ───────────────────────────────────────────────────────

/**
 * B-GROWTH-26: a framework domain id is named by the ONE domain registry
 * (lib/domains/registry.ts → lib/i18nElevation/domains.ts, EN + HE) — the same
 * names Growth, Milestones and Science print. No framework.json label, no
 * private dictionary.
 */
const labelFor = (id: string, t: (key: string) => string) => domainLabel("developmental", id, t);

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
            {/* OBJ-GROWTH-05 / B-PLAY-01: no ranking language, no domain —
                the title names what the pick is built from. */}
            {t("foryou.title", { name: firstName })}
          </h2>
        </div>

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
              {/* B-PLAY-01: the label never names the (lowest-ranked) domain. */}
              {t("foryou.coursesLabel")}
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

      {/* B-PLAY-01: the per-domain Learning Map (ring + one bar and one domain
          label per row) left this card — the Map lives in Growth. What stays
          is the family's own course count across the catalogue, as text. */}
      {domainRows.length > 0 && (
        <p
          className="text-[13px] leading-relaxed px-1"
          style={{ color: "var(--arbor-ink-soft)" }}
          data-testid="academy-foryou-total"
          dir="auto"
        >
          {t("foryou.progress", {
            x: domainRows.reduce((n, r) => n + r.explored, 0),
            y: domainRows.reduce((n, r) => n + r.available, 0),
          })}
        </p>
      )}

      {/* Non-diagnostic provenance note */}
      <p className="text-[11.5px] px-1" style={{ color: "var(--arbor-faint)" }}>
        {t("foryou.provenance")}
      </p>
    </motion.div>
  );
}
