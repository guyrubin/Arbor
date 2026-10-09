import React, { useState } from "react";
import { Icon } from "../ui/Icon";
import { useProfile } from "../../context/ProfileContext";
import { useLanguage } from "../../context/LanguageContext";
import ProfileEditDrawer from "./ProfileEditDrawer";
import TopbarKidSwitcher from "../layout/TopbarKidSwitcher";
// B-INF-10: the ONE child-age formatter (months under 3, years from 3).
import { formatChildAge } from "../../lib/age/format";
import { genderedKey } from "../../lib/today/fromRecord";

/**
 * B-SHELL-38 — the active child is unmistakable: on desktop the child
 * appears ONCE, here, as the identity line (picture · name · "22 months")
 * that IS the switcher. Its dropdown is the family list (the old "All
 * children" glance card), so the top-right duplicate chip and the glance card
 * are gone; one control switches child at every width (the phone strip
 * mounts the same component). Editing the profile keeps its own button.
 *
 * Under it, one quiet caption names whose app this is: "Showing Leni's app ·
 * 22 months" — never the generic "content for children 5 years old". Hebrew
 * carries .girl / .boy forms when the gender is known.
 */
export default function ProfileSwitcher() {
  const { activeChild } = useProfile();
  const { t } = useLanguage();
  const [showEdit, setShowEdit] = useState(false);
  const first = (activeChild.name || "").split(" ")[0];

  return (
    <div className="relative">
      <div className="flex items-center gap-2" data-testid="sidebar-identity">
        <div className="flex-1 min-w-0">
          <TopbarKidSwitcher maxWidth="100%" fullWidth />
        </div>
        {/* VIS-2/VIS-3: icon-only → min 44×44 hit area + explicit aria-label */}
        <button
          onClick={() => setShowEdit(true)}
          title={t("aria.editChildProfile")}
          aria-label={t("aria.editChildProfile")}
          className="inline-flex flex-shrink-0 items-center justify-center min-h-[44px] min-w-[44px] rounded-lg transition"
          style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}
        >
          <Icon name="edit" size={14} />
        </button>
      </div>

      {/* B-SHELL-38: whose app this is — her name and her own age, never an age group. */}
      <p data-testid="sidebar-showing" className="mt-1.5 ps-1 text-[12px] text-start" dir="auto" style={{ color: "var(--arbor-muted)" }}>
        {t(genderedKey("elev.ages.shell.showing", activeChild.gender), { name: first, age: formatChildAge(activeChild, t) })}
      </p>

      <ProfileEditDrawer open={showEdit} onClose={() => setShowEdit(false)} />
    </div>
  );
}
