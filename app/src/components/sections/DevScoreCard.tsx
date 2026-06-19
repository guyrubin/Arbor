import React, { useEffect, useMemo } from "react";
import { Gauge, ArrowUp, ArrowDown, Minus, Sparkles } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { ProgressRing } from "../ui/ProgressRing";
import { HeroAvatar } from "../ui/HeroAvatar";
import framework from "../../framework.json";
import type { StoredDevScoreSnapshot } from "../../types";
import { isoWeekKey, prefersReducedMotion } from "../../lib/devscore";
import {
  computeDevScore, toSnapshot, shouldSnapshot, type DevScoreSnapshot, type Trend,
} from "../../growth/devScore";

// Domain id → human label, resolved from the framework (e.g. social_development
// → "Social development"). Parents must never see machine ids.
const DOMAIN_LABEL: Record<string, string> = Object.fromEntries(
  (framework.domains as { id: string; label: string }[]).map((d) => [d.id, d.label])
);
const labelFor = (id: string) => DOMAIN_LABEL[id] ?? id;

/* My Child › Development — the Development picture (PRD C4). One number per
   domain from the age-appropriate milestones reached, an honest weekly trend,
   and a single "nurture next" pointer. Non-diagnostic. */

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const GREEN = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";
const RULE = "var(--arbor-rule)";

const TREND_ICON: Record<Trend, React.ReactNode> = {
  up: <ArrowUp className="w-3.5 h-3.5" style={{ color: "var(--arbor-green-ink)" }} />,
  down: <ArrowDown className="w-3.5 h-3.5" style={{ color: "var(--arbor-peach-ink)" }} />,
  flat: <Minus className="w-3.5 h-3.5" style={{ color: "var(--arbor-faint)" }} />,
};

export default function DevScoreCard() {
  const { milestones, childProfile, setChatInput, setActiveTab } = useArbor();
  const { t } = useLanguage();
  const firstName = (childProfile.name || "your child").split(" ")[0];
  const key = `arbor.devscore.${childProfile.id}`;
  const animateRing = !prefersReducedMotion();

  // Weekly snapshots are a cross-device moat artifact: persist through the same
  // child-collection path as the rest of the app (Firestore when signed in,
  // localStorage in sandbox), so trend survives a new device. localStorage stays
  // a first-paint read-through fallback only.
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

  // Record a fresh weekly snapshot so next week's trend is honest. Keyed by ISO
  // week so a day both surfaces render does not create a duplicate (Today never
  // writes — only this card does). Mirror to localStorage for first-paint.
  useEffect(() => {
    if (!snapshots.loaded || score.confidence === "none") return;
    if (!shouldSnapshot(prior, Date.now())) return;
    const now = Date.now();
    const snap = toSnapshot(score, now);
    try { localStorage.setItem(key, JSON.stringify(snap)); } catch { /* ignore */ }
    void snapshots.upsert({ id: isoWeekKey(now), ...snap });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score.confidence, snapshots.loaded]);

  if (score.confidence === "none") {
    return (
      <section className="rounded-[22px] p-6" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}` }}>
        <div className="flex items-start gap-3.5">
          {/* The child as the hero of their own record — modest, no comic frame here. */}
          <HeroAvatar size={48} mood="wave" animate={false} ring={false} className="flex-shrink-0" />
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: GREEN }}>
              <Gauge className="w-3.5 h-3.5" /> {t("devscore.eyebrow")}
            </span>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: MUTED, textWrap: "pretty" } as React.CSSProperties}>
              {t("devscore.empty", { name: firstName })}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const coachFocus = () => {
    if (!score.focusDomain) return;
    setChatInput(`I'd like to nurture ${firstName}'s ${labelFor(score.focusDomain).toLowerCase()} development. What are 2–3 simple things I can do this week?`);
    setActiveTab("coach");
  };

  return (
    <section className="rounded-[22px] overflow-hidden" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-sm)" }}>
      <div className="p-6">
        <div className="flex items-center gap-3">
          {/* The child as the hero of their own development record — modest parent register. */}
          <HeroAvatar size={44} mood="wave" animate={false} ring={false} className="flex-shrink-0" />
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: GREEN }}>
            <Gauge className="w-3.5 h-3.5" /> {t("devscore.eyebrow")}
          </span>
        </div>

        <div className="flex items-center gap-5 mt-3">
          <ProgressRing value={score.overall} size={72} stroke={8} animate={animateRing}>
            <span className="text-[18px] font-extrabold" style={{ color: GREEN }}>{score.overall}</span>
          </ProgressRing>
          <div className="min-w-0">
            <div className="text-[15px] font-extrabold" style={{ color: INK }}>{t("devscore.overall")}</div>
            <div className="text-[12.5px]" style={{ color: MUTED }}>
              {t("devscore.reached", {
                reached: score.domains.reduce((n, d) => n + d.reached, 0),
                total: score.domains.reduce((n, d) => n + d.total, 0),
              })}
            </div>
          </div>
        </div>

        {/* Per-domain bars */}
        <div className="mt-5 space-y-2.5">
          {score.domains.map((d) => (
            <div key={d.domain} className="flex items-center gap-3">
              <span className="w-36 flex-shrink-0 text-[13px] font-bold truncate" style={{ color: INK }} title={labelFor(d.domain)}>{labelFor(d.domain)}</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--arbor-paper-sunk)" }}>
                <div className="h-full rounded-full" style={{ width: `${d.score}%`, background: "var(--arbor-clay)" }} />
              </div>
              <span className="w-6 text-right text-[12px] font-extrabold" style={{ color: MUTED }}>{d.score}</span>
              <span className="w-4 flex-shrink-0" aria-hidden="true">{TREND_ICON[d.trend]}</span>
              {/* Trend non-visually (color alone fails AA): label, value, direction. */}
              <span className="sr-only">{t("devscore.bar.aria", { domain: labelFor(d.domain), score: d.score, trend: d.trend })}</span>
            </div>
          ))}
        </div>

        {/* Nurture-next */}
        {score.focusDomain && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl p-4" style={{ background: GREEN_SOFT }}>
            <span className="text-[13.5px] font-bold flex-1 min-w-0" style={{ color: GREEN }}>
              {t("devscore.focus", { domain: labelFor(score.focusDomain) })}
            </span>
            <button
              onClick={coachFocus}
              className="inline-flex items-center gap-1.5 font-bold text-[13px] rounded-xl px-4 py-2 transition active:scale-[0.98]"
              style={{ background: "var(--arbor-paper-elevated)", color: GREEN, border: `1px solid rgba(52,178,119,0.30)` }}
            >
              <Sparkles className="w-3.5 h-3.5" /> {t("devscore.coach")}
            </button>
          </div>
        )}

        <p className="text-[11.5px] mt-3.5" style={{ color: "var(--arbor-faint)" }}>{t("devscore.note")}</p>
      </div>
    </section>
  );
}
