/**
 * OwnerTools — S1 (surfacing) 4(a): the owner-only Everyday Plans tooling,
 * mounted under Settings › "Owner tools" ONLY when the server's visibility
 * table says `admin: true` (the same gate and routes as before; a family's
 * table never carries it). Holds the plate painter that used to sit on the
 * parent's journal grid.
 */
import React from "react";
import PlanPlatePainter from "./PlanPlatePainter";
import { authoredPatterns } from "../../lib/library/plans/planBooks";

export default function OwnerTools({ lang }: { lang: "en" | "he" }) {
  return (
    <div data-testid="settings-owner-tools">
      <PlanPlatePainter lang={lang} patterns={authoredPatterns()} />
    </div>
  );
}
