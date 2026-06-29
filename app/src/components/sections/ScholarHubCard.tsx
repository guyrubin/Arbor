/**
 * Scholar Hub Card (AP-055) — weekly developmental-concept feed for Academy.
 *
 * Reads the EXISTING dev-score/domain data from useArbor() (milestones),
 * runs the same computeDevScore used by DevScoreCard, picks the lowest-scoring
 * domain via focusDomain, and surfaces ONE curated editorial article.
 *
 * FRAMING GATE: the lowest domain is presented as "a great area to nurture
 * this week" — NEVER as a deficit, weakness, delay, problem, or concern.
 *
 * No new child-data write. No AI call. Pure frontend + static catalogue.
 * TOKEN-DRIVEN styling only (var(--arbor-*)). HE/RTL via logical CSS props.
 */
import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { computeDevScore } from "../../growth/devScore";
import { selectWeeklyArticle } from "../../growth/scholarHub";
import framework from "../../framework.json";
import { cardCls } from "../ui/kit";

// Domain id → human label (same lookup used in DevScoreCard)
const DOMAIN_LABEL: Record<string, string> = Object.fromEntries(
  (framework.domains as { id: string; label: string }[]).map((d) => [d.id, d.label])
);
const labelFor = (id: string) => DOMAIN_LABEL[id] ?? id;

export default function ScholarHubCard() {
  const { milestones, childProfile } = useArbor();
  const { t, uiLang, aiLang } = useLanguage();
  const firstName = (childProfile.name || "your child").split(" ")[0];
  const he = aiLang === "he";
  const isRtl = uiLang === "he";
  const BackGlyph = isRtl ? ArrowRight : ArrowLeft;

  const [open, setOpen] = useState(false);

  // Read the EXISTING dev-score data (same computation as DevScoreCard).
  // No prior snapshot needed for the focus domain — we only need focusDomain,
  // which is derived from current milestone state regardless of trend history.
  const score = useMemo(
    () => computeDevScore(milestones.map((m) => ({ domain: m.domain, checked: m.checked }))),
    [milestones]
  );

  const { article, isDefault } = useMemo(
    () => selectWeeklyArticle(score.focusDomain),
    [score.focusDomain]
  );

  const title = he ? article.titleHe : article.titleEn;
  const body = he ? article.bodyHe : article.bodyEn;
  const topic = he ? article.topicHe : article.topicEn;

  // ── Graceful empty/no-data state ────────────────────────────────────────
  if (score.confidence === "none") {
    return (
      <div
        className={`${cardCls} p-5`}
        style={{ border: "1px solid var(--arbor-rule)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <span
            className="inline-flex items-center justify-center rounded-2xl flex-shrink-0"
            style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", width: 40, height: 40 }}
          >
            <Icon name="menu_book" size={20} />
          </span>
          <span
            className="text-[11px] uppercase tracking-widest font-bold"
            style={{ color: "var(--arbor-green-ink)" }}
          >
            {t("hub.scholar.eyebrow")}
          </span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
          {t("hub.scholar.nodata", { name: firstName })}
        </p>
      </div>
    );
  }

  // ── Reader overlay ───────────────────────────────────────────────────────
  if (open) {
    return (
      <AnimatePresence>
        <motion.div
          key="scholar-reader"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="rounded-[22px] p-6 space-y-5 max-w-[760px]"
          style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
          dir={isRtl ? "rtl" : "ltr"}
        >
          {/* Back button — logical direction */}
          <button
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1.5 text-sm font-bold min-h-[44px] rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ color: "var(--arbor-muted)" }}
            aria-label={t("hub.scholar.close")}
          >
            <BackGlyph className="w-4 h-4" aria-hidden />
            {t("hub.scholar.close")}
          </button>

          {/* Eyebrow + topic chip */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
            >
              <Icon name="menu_book" size={15} />
              {t("hub.scholar.eyebrow")}
            </span>
            <span
              className="rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide"
              style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}
            >
              {t("hub.scholar.topic", { topic })}
            </span>
            <span
              className="inline-flex items-center gap-1 text-[11px] font-bold"
              style={{ color: "var(--arbor-muted)" }}
            >
              <Icon name="schedule" size={13} />
              {t("hub.scholar.readMin", { n: article.readingMinutes })}
            </span>
          </div>

          {/* Title */}
          <h2
            className="text-xl md:text-[1.5rem] leading-tight tracking-tight"
            dir="auto"
            style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
          >
            {title}
          </h2>

          {/* Body — editorial content, no developmental claim */}
          <p className="text-[14.5px] leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>
            {body}
          </p>

          {/* Provenance hedge — editorial, not diagnostic */}
          <p className="text-[11.5px]" style={{ color: "var(--arbor-faint)" }}>
            {t("hub.scholar.provenance")}
          </p>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Card (collapsed) ─────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${cardCls} p-5`}
      style={{ border: "1px solid var(--arbor-rule)" }}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 mb-4">
        <span
          className="inline-flex items-center justify-center rounded-2xl flex-shrink-0"
          style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", width: 40, height: 40 }}
        >
          <Icon name="menu_book" size={20} />
        </span>
        <span
          className="text-[11px] uppercase tracking-widest font-bold"
          style={{ color: "var(--arbor-green-ink)" }}
        >
          {t("hub.scholar.eyebrow")}
        </span>
      </div>

      {/* Domain framing — strengths-based, invitational (FRAMING GATE) */}
      {!isDefault && score.focusDomain && (
        <div
          className="rounded-2xl px-4 py-2.5 mb-4 text-sm font-bold"
          style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
        >
          {t("hub.scholar.domainLabel", { domain: labelFor(score.focusDomain) })}
        </div>
      )}
      {isDefault && (
        <div
          className="rounded-2xl px-4 py-2.5 mb-4 text-sm font-bold"
          style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}
        >
          {t("hub.scholar.default.label")}
        </div>
      )}

      {/* Article preview */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide"
            style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}
          >
            {t("hub.scholar.topic", { topic })}
          </span>
          <span
            className="inline-flex items-center gap-1 text-[11px] font-bold"
            style={{ color: "var(--arbor-muted)" }}
          >
            <Icon name="schedule" size={13} />
            {t("hub.scholar.readMin", { n: article.readingMinutes })}
          </span>
        </div>
        <h3
          className="text-[15px] font-extrabold leading-snug"
          dir="auto"
          style={{ color: "var(--arbor-ink)" }}
        >
          {title}
        </h3>
        {/* Body preview — first 160 chars */}
        <p
          className="text-[12.5px] leading-relaxed line-clamp-2"
          dir="auto"
          style={{ color: "var(--arbor-muted)" }}
        >
          {body}
        </p>
      </div>

      {/* CTA */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 font-bold text-[13px] rounded-xl px-4 py-2.5 min-h-[44px] transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-clay-dim)" }}
      >
        {t("hub.scholar.read")}
      </button>

      {/* Provenance (compact) */}
      <p className="text-[11px] mt-3" style={{ color: "var(--arbor-faint)" }}>
        {t("hub.scholar.provenance")}
      </p>
    </motion.div>
  );
}
