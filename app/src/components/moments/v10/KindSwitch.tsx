import { useMemo } from "react";
import { useArbor } from "../../../context/ArborContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useObservationRecord } from "../../../hooks/useObservationRecord";
import { goToRoute } from "../../../hooks/useHashQuery";
import { isMomentRecord, kindCounts, monthBuckets, MOMENTS_KINDS, type MomentsKind } from "../momentsModel";

/** Moments' own kind counts (three months, the parent's kept record only). */
export function useMomentsKindCounts(): Record<MomentsKind, number> {
  const { childProfile } = useArbor();
  const record = useObservationRecord();
  return useMemo(() => {
    const mine = record.observations.filter(o => o.childId === childProfile.id && isMomentRecord(o));
    return kindCounts(monthBuckets(mine, childProfile.id, new Date(), 3).flatMap(bucket => bucket.observations));
  }, [record.observations, childProfile.id]);
}

const KIND_KEYS = { all: "companion.moments.kind.all", kept: "companion.moments.kind.kept", hard: "companion.moments.kind.hard" } as const;

/**
 * Design system v10.3 — the band's switch on a folded kind's own page
 * (#/behaviors, #/language): All · Kept · Hard moments · Things <name> said,
 * the page's own kind marked. All and Kept open Moments; the other kind opens
 * its page. Counts are Moments' kind counts; a kind without one shows none.
 */
export default function KindSwitch({ kind }: { kind: Exclude<MomentsKind, "all" | "kept"> }) {
  const { childProfile, setActiveTab } = useArbor();
  const { t } = useLanguage();
  const counts = useMomentsKindCounts();
  const firstName = (childProfile.name || "").trim().split(/\s+/)[0] || t("companion.together-view.your-child");
  const label = (key: MomentsKind) => (key === "said" ? t("companion.moments.kind.said", { name: firstName }) : t(KIND_KEYS[key]));
  const open = (key: MomentsKind) => {
    if (key === kind) return;
    if (key === "hard") setActiveTab("behaviors");
    else if (key === "said") setActiveTab("language");
    else goToRoute("timeline", { kind: key === "all" ? undefined : key });
  };
  return (
    <nav className="vseg kinds-sw" aria-label={t("companion.moments.kinds")} data-moments-kinds data-moments-kind-page={kind}>
      {MOMENTS_KINDS.map(key => (
        <button key={key} type="button" className={key === kind ? "on" : undefined} data-moments-kind={key} aria-current={key === kind ? "page" : undefined} onClick={() => open(key)}>
          <span dir="auto">{label(key)}</span>
          {counts[key] > 0 && (key === "hard" || key === "said") && <b className="arbor-num">{counts[key]}</b>}
        </button>
      ))}
    </nav>
  );
}
