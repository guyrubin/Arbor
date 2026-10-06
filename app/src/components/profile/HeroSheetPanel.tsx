/**
 * HeroSheetPanel — B-GAME-13c: the parent's view of the hero's pose sheet, on
 * the child profile. One calm line while the sheet is drawn ("{name}'s hero is
 * learning to move — ready in a few minutes"); no progress bar, nothing in Kid
 * Mode. Opening the profile also resumes a build this parent started for the
 * same hero (a reload continues from the poses already stored).
 */
import React, { useEffect } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { heroAvatarHash } from "../../lib/heroSheetContract";
import { resumeHeroSheet } from "../kidmode/hero/buildHeroSheet";
import { useHeroSheetDocs } from "../kidmode/hero/useHeroSheet";
import type { ChildProfile } from "../../types";

/** The parent-register key for this child's grammatical form (HE). */
export const formKeyFor = (base: string, gender?: ChildProfile["gender"]) =>
  gender === "boy" || gender === "girl" ? `${base}.${gender}` : base;

export default function HeroSheetPanel({ child }: { child: Pick<ChildProfile, "id" | "name" | "gender" | "photoUrl" | "avatar"> }) {
  const { t } = useLanguage();
  const docs = useHeroSheetDocs(child.id);
  const status = docs?.meta?.status;
  const metaHash = docs?.meta?.avatarHash;
  useEffect(() => {
    if (docs === undefined) return;
    void resumeHeroSheet(child, docs);
    // Resume once per (child, hero, status) — not on every pose written.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child.id, child.photoUrl, status, metaHash, docs === undefined]);

  const hash = typeof child.photoUrl === "string" && child.photoUrl.startsWith("data:image/") ? heroAvatarHash(child.photoUrl) : null;
  const meta = docs?.meta && hash && docs.meta.avatarHash === hash ? docs.meta : null;
  if (!meta) return null;
  if (meta.status === "building") {
    return (
      <p data-hero-sheet="building" role="status" className="text-xs" style={{ color: "var(--arbor-muted)" }}>
        {t(formKeyFor("elev.hero.sheet.building", child.gender), { name: child.name })}
      </p>
    );
  }
  if (meta.status === "stopped" && meta.poses.length > 0) {
    return (
      <p data-hero-sheet="stopped" className="text-xs" style={{ color: "var(--arbor-muted)" }}>
        {t(formKeyFor("elev.hero.sheet.stopped", child.gender), { name: child.name })}
      </p>
    );
  }
  return null;
}
