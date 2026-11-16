import type { ReactNode } from "react";
import { useMemo } from "react";
import { useArbor } from "../../../context/ArborContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useObservationRecord } from "../../../hooks/useObservationRecord";
import { goToRoute } from "../../../hooks/useHashQuery";
import { DsRoot, Scene } from "../../../design/primitives";
import { useComposition } from "../../../design/useComposition";
import { isMomentRecord, kindCounts, monthBuckets, MOMENTS_KINDS, MOMENTS_VIEWS, type MomentsKind } from "../momentsModel";
import { STAGE_ORBS } from "./stageOrbs";
import "../mychild.css";

/**
 * Design system v10.1 — the Moments frame on a folded kind's own page:
 * #/behaviors (Hard moments) and #/language (Things <name> said) open Moments
 * with their kind selected. The header is the same as Moments' stage head:
 * kicker, the page's one h1, the three views and the four kinds. A view or
 * another kind opens Moments with it (`#/timeline?view=…&kind=…`); the
 * current kind is marked, so the page reads as Moments, not a second screen.
 * Counts are Moments' own kind counts (three months, the kept record only).
 */
const VIEW_KEYS = {
  time: "companion.moments.view.time",
  places: "companion.moments.view.places",
  areas: "companion.moments.view.areas",
} as const;
const KIND_KEYS = { all: "companion.moments.kind.all", kept: "companion.moments.kind.kept", hard: "companion.moments.kind.hard" } as const;

export default function MomentsKindHeader({ kind, title, sub, action, children }: {
  kind: Exclude<MomentsKind, "all" | "kept">;
  /** The page's own h1 (production's words). */
  title: ReactNode;
  sub?: ReactNode;
  /** One action beside the title (e.g. Sound practice). */
  action?: ReactNode;
  children?: ReactNode;
}) {
  const { childProfile, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const composition = useComposition();
  const record = useObservationRecord();
  const firstName = (childProfile.name || "").trim().split(/\s+/)[0] || t("companion.together-view.your-child");
  const counts = useMemo(() => {
    const mine = record.observations.filter(o => o.childId === childProfile.id && isMomentRecord(o));
    return kindCounts(monthBuckets(mine, childProfile.id, new Date(), 3).flatMap(bucket => bucket.observations));
  }, [record.observations, childProfile.id]);
  const kindLabel = (key: MomentsKind) => (key === "said" ? t("companion.moments.kind.said", { name: firstName }) : t(KIND_KEYS[key]));
  const openKind = (key: MomentsKind) => {
    if (key === kind) return;
    if (key === "hard") setActiveTab("behaviors");
    else if (key === "said") setActiveTab("language");
    else goToRoute("timeline", { kind: key === "all" ? undefined : key });
  };

  return (
    <DsRoot composition={composition} className="ds-mychild moments-kind-head" dir={he ? "rtl" : "ltr"} data-testid="moments-kind-header" data-moments-kind-page={kind}>
      <Scene field="child" className="mstage" orbs={STAGE_ORBS[composition]}>
        <div className="mstack mtools">
          <div className={composition === "desk" ? "line between mtop" : "mstack mtop"}>
            <div className="mstack" style={{ gap: 6 }}>
              <span className="gsec"><span className="kicker">{t("companion.moments.title")} · {kindLabel(kind)}</span></span>
              <h1 className="hero">{title}</h1>
              {sub && <p className="ksub" dir="auto">{sub}</p>}
            </div>
            {action}
          </div>
          <div className="mscroll">
            <nav className="vseg" aria-label={t("companion.moments.tabs")}>
              {MOMENTS_VIEWS.map(key => (
                <button key={key} type="button" className="min-h-11" onClick={() => goToRoute("timeline", { view: key, kind })}>{t(VIEW_KEYS[key])}</button>
              ))}
            </nav>
          </div>
          <div className="mscroll">
            <div role="group" data-moments-kinds aria-label={t("companion.moments.kinds")} className="kchips">
              {MOMENTS_KINDS.map(key => (
                <button key={key} type="button" className={key === kind ? "kchip on" : "kchip"} data-moments-kind={key} aria-current={key === kind ? "page" : undefined} onClick={() => openKind(key)}>
                  <span dir="auto">{kindLabel(key)}</span>
                  {counts[key] > 0 && <b className="arbor-num">{counts[key]}</b>}
                </button>
              ))}
            </div>
          </div>
        </div>
        {children}
      </Scene>
    </DsRoot>
  );
}
