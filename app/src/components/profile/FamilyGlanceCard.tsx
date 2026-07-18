/**
 * C3 - Family Glance panel.
 *
 * Compact cross-child orientation for 2+ child households. This is a switcher,
 * not an assessment surface: it shows identity, age, and active profile state.
 */
import React from "react";
import { Users } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useProfile } from "../../context/ProfileContext";
import { useFamilyGlance } from "../../hooks/useFamilyGlance";
import { Avatar } from "../ui/Avatar";

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const RULE = "var(--arbor-rule)";
const GREEN = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";

export default function FamilyGlanceCard() {
  const { t } = useLanguage();
  const { setActiveChild } = useProfile();
  const rows = useFamilyGlance();

  if (rows.length === 0) return null;

  return (
    <section
      className="rounded-2xl overflow-hidden mt-2"
      style={{ border: `1px solid ${RULE}`, background: "var(--arbor-paper-elevated)" }}
      aria-label={t("family.glance.eyebrow")}
    >
      <div
        className="flex items-center gap-1.5 px-3.5 py-2.5"
        style={{ borderBottom: `1px solid ${RULE}`, background: GREEN_SOFT }}
      >
        <Users className="w-3.5 h-3.5 flex-shrink-0" style={{ color: GREEN }} aria-hidden="true" />
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: GREEN }}>
          {t("family.glance.eyebrow")}
        </span>
      </div>

      <ul className="divide-y" style={{ borderColor: RULE }}>
        {rows.map((row) => (
          <li key={row.id}>
            <button
              onClick={() => setActiveChild(row.id)}
              className="w-full flex items-center gap-3 px-3.5 py-3 text-start transition active:scale-[0.99]"
              style={{ background: row.isActive ? "var(--arbor-paper-deep)" : "transparent" }}
              aria-label={t("family.glance.switch", { name: row.name })}
              aria-current={row.isActive ? "true" : undefined}
            >
              <span className="flex-shrink-0">
                <Avatar name={row.name} photoURL={row.photoUrl} size={32} ring={row.isActive} />
              </span>

              <span className="flex-1 min-w-0">
                <span className="text-[13px] font-bold truncate block" dir="auto" style={{ color: INK }}>
                  {row.name}
                </span>
                <span className="text-[11px] whitespace-nowrap" dir="auto" style={{ color: MUTED }}>
                  {t("profile.ageLine", { age: row.age })}
                </span>
              </span>

              <span
                className="flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold"
                style={
                  row.isActive
                    ? { background: GREEN_SOFT, color: GREEN }
                    : { background: "var(--arbor-paper-deep)", color: MUTED }
                }
              >
                {row.isActive ? t("family.glance.active") : t("family.glance.ready")}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
