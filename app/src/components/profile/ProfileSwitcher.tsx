import React, { useState } from "react";
import { Pencil } from "lucide-react";
import { useProfile } from "../../context/ProfileContext";
import { useLanguage } from "../../context/LanguageContext";
import ProfileEditDrawer from "./ProfileEditDrawer";
import { Avatar } from "../ui/Avatar";
import FamilyGlanceCard from "./FamilyGlanceCard";
// GP-01: the months-precise age label is THE parent-facing age render.
import { ageLabel } from "../../lib/childAge";

/**
 * IA-04 / IA-17 — the sidebar card is IDENTITY, not a second switcher.
 *
 * At 1280 the app offered two child switchers eight centimetres apart: this
 * card and the Topbar chip (TopbarKidSwitcher), each with its own popover,
 * its own "Add child" row and its own open state, over the same
 * ProfileContext. Two controls for one job is the defect; the chip wins
 * because it is the one the mobile strip mounts too, so ONE component is
 * the switcher at every width.
 *
 * Nothing is lost. Switching and "Add child" both live in the chip, one row
 * up and always visible; editing the profile is a different capability and
 * keeps its button here; the family glance is unchanged. What goes away is
 * the duplicate popover, not a door.
 */
export default function ProfileSwitcher() {
  const { activeChild } = useProfile();
  const { t } = useLanguage();
  const [showEdit, setShowEdit] = useState(false);

  return (
    <div className="relative">
      <div className="rounded-2xl p-3 flex items-center justify-between gap-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
        <div className="flex items-center gap-3 flex-1 min-w-0 text-start">
          <span className="flex-shrink-0"><Avatar name={activeChild.name} photoURL={activeChild.photoUrl} size={36} ring /></span>
          <div className="min-w-0">
            <h4 className="text-sm font-bold leading-tight truncate" dir="auto" style={{ color: "var(--arbor-ink)" }}>{activeChild.name}</h4>
            <p className="text-[11px] whitespace-nowrap" dir="auto" style={{ color: "var(--arbor-muted)" }}>{t("profile.ageLine", { age: ageLabel(activeChild, t) })}</p>
          </div>
        </div>
        {/* VIS-2/VIS-3: icon-only → min 44×44 hit area + explicit aria-label */}
        <button
          onClick={() => setShowEdit(true)}
          title="Edit profile"
          aria-label={t("aria.editChildProfile")}
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg transition"
          style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* E6 (age-tuning visibility): quiet factual line — everything shown is
          selected for this child's age. A fact, never a clinical claim. */}
      <p className="mt-1.5 ps-1 text-[11px] text-start" style={{ color: "var(--arbor-muted)" }}>
        {t("elev.growthTruth.agechip.switcher", { age: ageLabel(activeChild, t) })}
      </p>

      {/* C3 — Family glance: shown below the switcher for 2+ child households.
          Reads only the existing DevScore snapshot per child — no new data. */}
      <FamilyGlanceCard />

      <ProfileEditDrawer open={showEdit} onClose={() => setShowEdit(false)} />
    </div>
  );
}
