/**
 * HeroSheetPanel — the parent's view of the hero's pose sheet, on the child
 * profile (parent side only; nothing here renders in Kid Mode).
 *  - B-GAME-13c: one calm line while the sheet is drawn ("{name}'s hero is
 *    learning to move — ready in a few minutes"); no progress bar. Opening the
 *    profile also resumes a build this parent started for the same hero (a
 *    reload continues from the poses already stored).
 *  - B-GAME-14: once drawn, a strip of the poses with "Looks like {name}?" —
 *    Yes / Redraw. Redraw removes the pose from the record at once (the game
 *    falls back to another pose; the child never sees a rejected one) and draws
 *    it once more for the same hero (counted, not re-charged). One per pose.
 */
import React, { useEffect, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { HERO_SHEET_POSE_IDS, heroAvatarHash, type HeroSheetPoseId } from "../../lib/heroSheetContract";
import { browserBuilderDeps, markHeroPoseOk, redrawHeroPose, resumeHeroSheet } from "../kidmode/hero/buildHeroSheet";
import { heroSheetStoreFor } from "../../lib/heroSheetStore";
import { useHeroSheetDocs } from "../kidmode/hero/useHeroSheet";
import type { ChildProfile } from "../../types";

/** The parent-register key for this child's grammatical form (HE). */
export const formKeyFor = (base: string, gender?: ChildProfile["gender"]) =>
  gender === "boy" || gender === "girl" ? `${base}.${gender}` : base;

const muted: React.CSSProperties = { color: "var(--arbor-muted)" };

export default function HeroSheetPanel({ child }: { child: Pick<ChildProfile, "id" | "name" | "gender" | "photoUrl" | "avatar"> }) {
  const { t } = useLanguage();
  const docs = useHeroSheetDocs(child.id);
  const status = docs?.meta?.status;
  const metaHash = docs?.meta?.avatarHash;
  const [busy, setBusy] = useState<Partial<Record<HeroSheetPoseId, "redraw">>>({});
  const [failed, setFailed] = useState<Partial<Record<HeroSheetPoseId, boolean>>>({});
  useEffect(() => {
    if (docs === undefined) return;
    void resumeHeroSheet(child, docs);
    // Resume once per (child, hero, status) — not on every pose written.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child.id, child.photoUrl, status, metaHash, docs === undefined]);

  const hash = typeof child.photoUrl === "string" && child.photoUrl.startsWith("data:image/") ? heroAvatarHash(child.photoUrl) : null;
  const meta = docs?.meta && hash && docs.meta.avatarHash === hash ? docs.meta : null;
  if (!meta || !docs || !hash) return null;
  const name = { name: child.name };
  if (meta.status === "building") {
    return (
      <p data-hero-sheet="building" role="status" className="text-xs" style={muted}>
        {t(formKeyFor("elev.hero.sheet.building", child.gender), name)}
      </p>
    );
  }
  const shown = HERO_SHEET_POSE_IDS.filter((p) => docs.poses[p]?.avatarHash === hash || busy[p] || failed[p]);
  if (!shown.length) return null;

  const ok = async (pose: HeroSheetPoseId) => { await markHeroPoseOk(heroSheetStoreFor(child.id), pose).catch(() => false); };
  const redraw = async (pose: HeroSheetPoseId) => {
    setBusy((b) => ({ ...b, [pose]: "redraw" }));
    const r = await redrawHeroPose({ childId: child.id, avatarHash: hash, pose }, browserBuilderDeps(child.id)).catch(() => ({ ok: false }));
    setBusy((b) => { const n = { ...b }; delete n[pose]; return n; });
    if (!r.ok) setFailed((f) => ({ ...f, [pose]: true }));
  };

  return (
    <section data-hero-sheet="review" className="space-y-2">
      {meta.status === "stopped" && (
        <p data-hero-sheet="stopped" className="text-xs" style={muted}>
          {t(formKeyFor("elev.hero.sheet.stopped", child.gender), name)}
        </p>
      )}
      <p className="text-xs font-bold" style={{ color: "var(--arbor-ink)" }}>{t(formKeyFor("elev.hero.sheet.review.title", child.gender), name)}</p>
      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {shown.map((pose) => {
          const d = docs.poses[pose];
          const label = t(`elev.hero.sheet.pose.${pose}`);
          return (
            <li key={pose} data-hero-pose={pose} className="rounded-xl p-2 flex flex-col items-center gap-1.5" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
              {d && !busy[pose] ? (
                <img src={d.dataUrl} alt={label} className="h-24 w-auto object-contain" draggable={false} />
              ) : (
                <div className="h-24 flex items-center text-[11px] text-center" style={muted}>
                  {busy[pose] ? t("elev.hero.sheet.review.redrawing") : t("elev.hero.sheet.review.failed")}
                </div>
              )}
              {d && !busy[pose] && (
                <>
                  <span className="text-[11px] text-center" style={muted}>{t("elev.hero.sheet.review.ask", name)}</span>
                  <div className="flex gap-1.5">
                    {d.review === "ok" ? (
                      <span className="inline-flex min-h-11 items-center gap-1 text-[11px] font-bold" style={{ color: "var(--arbor-green-ink)" }}>
                        <Check className="w-3.5 h-3.5" aria-hidden="true" /> {t("elev.hero.sheet.review.kept")}
                      </span>
                    ) : (
                      <button type="button" onClick={() => { void ok(pose); }} className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-bold" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule)" }}>
                        <Check className="w-3.5 h-3.5" aria-hidden="true" /> {t("elev.hero.sheet.review.yes")}
                      </button>
                    )}
                    {d.redrawn ? (
                      <span className="inline-flex min-h-11 items-center text-[11px]" style={muted}>{t("elev.hero.sheet.review.redrawn")}</span>
                    ) : d.review !== "ok" && (
                      <button type="button" onClick={() => { void redraw(pose); }} className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-bold" style={{ background: "var(--arbor-paper)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}>
                        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> {t("elev.hero.sheet.review.redraw")}
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
