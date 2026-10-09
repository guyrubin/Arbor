import React from "react";
import { Icon } from "../ui/Icon";
import { useKidModeEntry } from "../kidmode/useKidModeEntry";

/**
 * B-PROG-13 — the program week's ONE door to the child's side. It calls the
 * existing Kid Mode entry seam (hero-first once, then Kid Mode on the named
 * world) and renders the seam's step beside itself, like every other parent
 * door. Mounted only when programKidWorldDoor() found a world Kid Mode can
 * open for this child, so the hook never runs for a page without a door.
 * A quiet secondary control: the week band's one gradient stays the primary move.
 */
export default function ProgramKidWorldDoor({ worldId, label }: { worldId: string; label: string }) {
  const { request, step } = useKidModeEntry();
  return (
    <>
      <button
        type="button"
        data-testid="program-kid-world"
        data-world={worldId}
        onClick={() => request({ view: "arcade", worldId })}
        className="mt-2 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-5 t-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
      >
        <Icon name="sports_esports" size={18} aria-hidden />
        {label}
      </button>
      {step}
    </>
  );
}
