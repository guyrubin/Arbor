import React, { useEffect, useMemo } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { HeroAvatar } from "../ui/HeroAvatar";
import framework from "../../framework.json";
import type { StoredDevScoreSnapshot } from "../../types";
import { isoWeekKey, prefersReducedMotion } from "../../lib/devscore";
import {
  computeDevScore, toSnapshot, shouldSnapshot, type DevScoreSnapshot,
} from "../../growth/devScore";

// Domain id → human label, resolved from the framework (e.g. social_development
// → "Social development"). Parents must never see machine ids.
const DOMAIN_LABEL: Record<string, string> = Object.fromEntries(
  (framework.domains as { id: string; label: string }[]).map((d) => [d.id, d.label])
);
const labelFor = (id: string) => DOMAIN_LABEL[id] ?? id;

/* My Child › Development — the Development picture (PRD C4).
 *
 * Wave-3 clinical subtraction (2026-06-26): the prior version rendered a 0–100
 * per-domain score, a single 0–100 overall ProgressRing, per-domain up/flat/down
 * trend glyphs, a DevRadarRing, and a "strong domain" dot — all verdicts on a
 * child metric (forbidden by the CI-22/23/24 firewall). Demoted.
 *
 * What remains: the parent-owned milestone LOG + CDC/AAP provenance + the
 * existing "a starting point, not a verdict" footnote + the honesty hedge.
 * New headline = a flat count of parent-checked milestones + the developmental
 * MECHANISM + one route-to-pro. Emits nothing about the child as a verdict. */

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const GREEN = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";
const RULE = "var(--arbor-rule)";

export default function DevScoreCard() {
  const { milestones, childProfile, seedCoach } = useArbor();
  const { t } = useLanguage();
  const firstName = (childProfile.name || "your child").split(" ")[0];
  const key = `arbor.devscore.${childProfile.id}`;
  const animateRing = !prefersReducedMotion();

  // Weekly snapshots are a cross-device moat artifact: persist through the same
  // child-collection path as the rest of the app (Firestore when signed in,
  // localStorage in sandbox), so trend survives a new device. localStorage stays
  // a first-paint read-through fallback only.
  // (Wave-3: snapshots still recorded for back-compat; nothing renders a verdict
  // from them anymore — they are a parent-owned log of progress over time.)
  const snapshots = useChildCollection<StoredDevScoreSnapshot>(childProfile.id, "devScoreSnapshots", {
    orderByField: "takenMs",
    orderDir: "desc",
    max: 52,
  });

  const prior = useMemo<DevScoreSnapshot | null>(() => {
    const latest = snapshots.items[0];
    if (latest) return { takenMs: latest.takenMs, overall: latest.overall, byDomain: latest.byDomain };
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshots.items, childProfile.id]);

  const score = useMemo(
    () => computeDevScore(milestones.map((m) => ({ domain: m.domain, checked: m.checked })), prior),
    [milestones, prior]
  );

  // Record a fresh weekly snapshot so the parent keeps an honest log of progress
  // over time (Wave-3: this is a parent-owned log; no verdict renders from it).
  useEffect(() => {
    if (!snapshots.loaded || score.confidence === "none") return;
    if (!shouldSnapshot(prior, Date.now())) return;
    const now = Date.now();
    const snap = toSnapshot(score, now);
    try { localStorage.setItem(key, JSON.stringify(snap)); } catch { /* ignore */ }
    void snapshots.upsert({ id: isoWeekKey(now), ...snap });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score.confidence, snapshots.loaded]);

  const reached = score.domains.reduce((n, d) => n + d.reached, 0);
  const total = score.domains.reduce((n, d) => n + d.total, 0);

  if (score.confidence === "none") {
    return (
      <section className="rounded-[22px] p-6" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}` }}>
        <div className="flex items-start gap-3.5">
          {/* The child as the hero of their own record — modest, no comic frame here. */}
          <HeroAvatar size={48} mood="wave" animate={false} ring={false} className="flex-shrink-0" />
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: GREEN }}>
              <Icon name="speed" size={15} /> {t("devscore.eyebrow")}
            </span>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: MUTED, textWrap: "pretty" } as React.CSSProperties}>
              {t("devscore.empty", { name: firstName })}
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Wave-3: the coach CTA is mechanism-only — it offers the parent ideas for
  // nurturing development generally. It is NOT a "your child is lowest in X"
  // pointer (that was a deficit verdict). The prompt is domain-agnostic.
  const coach = () => {
    seedCoach({ prompt: t("devscore.coach.prompt", { name: firstName }), source: "dev-score" });
  };

  return (
    <section className="rounded-[22px] overflow-hidden" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-sm)" }}>
      <div className="p-6">
        <div className="flex items-center gap-3">
          {/* The child as the hero of their own development record — modest parent register. */}
          <HeroAvatar size={44} mood="wave" animate={false} ring={false} className="flex-shrink-0" />
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: GREEN }}>
            <Icon name="speed" size={15} /> {t("devscore.eyebrow")}
          </span>
        </div>

        {/* Headline: flat count of parent-noticed milestones (NOT a percentage/share). */}
        <div className="flex items-center gap-5 mt-3">
          <div className="flex-none w-[72px] h-[72px] rounded-full flex flex-col items-center justify-center" style={{ background: GREEN_SOFT }}>
            <span className="text-[24px] font-extrabold leading-none" style={{ fontFamily: "var(--font-display)", color: GREEN }}>{reached}</span>
            <span className="text-[10px] font-bold mt-1" style={{ color: GREEN }}>{t("devscore.noticed.short")}</span>
          </div>
          <div className="min-w-0">
            <div className="text-[16px] font-extrabold" style={{ fontFamily: "var(--font-display)", color: INK }}>
              {t("devscore.noticed", { reached, total })}
            </div>
            {/* Developmental mechanism (parent observation + one-thing-to-try). */}
            <div className="text-[12.5px] mt-1.5 leading-relaxed" style={{ color: MUTED }}>
              {t("devscore.mechanism", { name: firstName })}
            </div>
          </div>
        </div>

        {/* Domain summary — sr-only, count-only (no score, no trend, no "0 to 100" scale).
            Wave-3: replaces the prior DevRadarRing + the verdict-shaped bar.aria. */}
        <div className="sr-only">
          {score.domains.map((d) => (
            <span key={d.domain}>
              {t("devscore.noticed.aria", { domain: labelFor(d.domain), reached: d.reached, total: d.total })}{"; "}
            </span>
          ))}
        </div>

        {/* Route-to-pro (mechanism-only — no deficit pointer). */}
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl p-4" style={{ background: GREEN_SOFT }}>
          <span className="text-[13.5px] font-bold flex-1 min-w-0" style={{ color: GREEN }}>
            {t("devscore.coach.headline")}
          </span>
          <button
            onClick={coach}
            className="inline-flex items-center gap-1.5 font-bold text-[13px] rounded-xl px-4 py-2 transition active:scale-[0.98]"
            style={{ background: "var(--arbor-paper-elevated)", color: GREEN, border: `1px solid rgba(52,178,119,0.30)` }}
          >
            <Icon name="auto_awesome" size={15} /> {t("devscore.coach")}
          </button>
        </div>

        <p className="text-[11.5px] mt-3.5" style={{ color: "var(--arbor-faint)" }}>{t("devscore.note")}</p>
        {/* CI-08 / CLM-004 — the provenance hedge (board-substantiated, Guy-approved 2026-06-22).
            Truth-before-avoidance: show the parent the basis. Pure provenance, never an outcome
            or "clinically validated" claim (CHARTER §3 p11). */}
        <p className="text-[11.5px] mt-1.5" style={{ color: "var(--arbor-faint)" }}>{t("honesty.grounded")}</p>
      </div>
    </section>
  );
}
