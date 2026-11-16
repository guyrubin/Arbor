import React from "react";
import TopbarKidSwitcher from "../layout/TopbarKidSwitcher";

/**
 * B-SHELL-38 — the active child is unmistakable: on desktop the child
 * appears ONCE, here, as the identity line (picture · name · "3 years")
 * that IS the switcher. Its dropdown is the family list (the old "All
 * children" glance card), so the top-right duplicate chip and the glance card
 * are gone; one control switches child at every width (the phone strip
 * mounts the same component).
 *
 * v10 (canvas V77, N-*-D boards): the card is the switcher alone, full width.
 * The caption under it ("Showing Leni's app · 22 months") repeated the name and
 * age the switcher already shows, so it is gone (each fact once). Editing the
 * profile is a row in the switcher's own menu, beside Add child, so the
 * function stays on every width without a second control here.
 */
export default function ProfileSwitcher() {
  return (
    <div className="relative" data-testid="sidebar-identity">
      <TopbarKidSwitcher maxWidth="100%" fullWidth />
    </div>
  );
}
