/**
 * C3 — Family Glance panel.
 *
 * Compact cross-child overview for 2+ child households: each child's name,
 * age, and current overall DevScore at a glance. Rendered inside the
 * ProfileSwitcher dropdown so it lives alongside profile selection.
 *
 * Single-child households: this component is not rendered (the caller guards
 * on `rows.length > 1`, which the useFamilyGlance hook enforces).
 *
 * No new data collection — reads only what DevScoreCard already writes to
 * localStorage (weekly snapshot, `arbor.devscore.<childId>`).
 */
import React from "react";
import { Users } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useProfile } from "../../context/ProfileContext";
import { useFamilyGlance } from "../../hooks/useFamilyGlance";
import { Avatar } from "../ui/Avatar";
import { ProgressRing } from "../ui/ProgressRing";

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const RULE = "var(--arbor-rule)";
const GREEN = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";

export default function FamilyGlanceCard() {
  const { t } = useLanguage();
  const { setActiveChild } = useProfile();
  const rows = useFamilyGlance();

  // Guard: hidden for single-child households (useFamilyGlance returns [] then).
  if (rows.length === 0) return null;

  return (
    <section
      className="rounded-2xl overflow-hidden mt-2"
      style={{ border: `1px solid ${RULE}`, background: "var(--arbor-paper-elevated)" }}
      aria-label={t("family.glance.eyebrow")}
    >
      {/* Eyebrow */}
      <div
        className="flex items-center gap-1.5 px-3.5 py-2.5"
        style={{ borderBottom: `1px solid ${RULE}`, background: GREEN_SOFT }}
      >
        <Users className="w-3.5 h-3.5 flex-shrink-0" style={{ color: GREEN }} aria-hidden="true" />
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: GREEN }}>
          {t("family.glance.eyebrow")}
        </span>
      </div>

      {/* Per-child rows */}
      <ul className="divide-y" style={{ borderColor: RULE }}>
        {rows.map((row) => (
          <li key={row.id}>
            <button
              onClick={() => setActiveChild(row.id)}
              className="w-full flex items-center gap-3 px-3.5 py-3 text-left transition active:scale-[0.99]"
              style={{
                background: row.isActive ? "var(--arbor-paper-deep)" : "transparent",
              }}
              aria-label={t("family.glance.switch", { name: row.name })}
              aria-current={row.isActive ? "true" : undefined}
            >
              {/* Avatar */}
              <Avatar name={row.name} photoURL={row.photoUrl} size={32} ring={row.isActive} />

              {/* Name + age */}
              <div className="flex-1 min-w-0">
                <span
                  className="text-[13px] font-bold truncate block"
                  style={{ color: INK }}
                >
                  {row.name}
                </span>
                <span className="text-[11px]" style={{ color: MUTED }}>
                  Age {row.age}
                </span>
              </div>

              {/* Score ring + label */}
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                {row.overall !== null ? (
                  <>
                    <ProgressRing
                      value={row.overall}
                      size={32}
                      stroke={4}
                      animate={false}
                      color={row.isActive ? GREEN : "var(--arbor-clay)"}
                    >
                      <span
                        className="text-[9px] font-extrabold"
                        style={{ color: row.isActive ? GREEN : "var(--arbor-clay)" }}
                      >
                        {row.overall}
                      </span>
                    </ProgressRing>
                    <span className="text-[10px] font-bold" style={{ color: MUTED }}>
                      {t("family.glance.score", { score: row.overall })}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px]" style={{ color: "var(--arbor-faint)" }}>
                    {t("family.glance.nodata")}
                  </span>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
