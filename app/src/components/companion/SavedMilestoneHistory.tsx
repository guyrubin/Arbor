import React from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { savedMilestoneHistory } from "../../lib/record/savedMilestoneHistory";
import { domainLabel } from "../../lib/domains/registry";
import { fmtDay } from "../../lib/formatDate";
import type { BandSnapshot } from "../../types";

/** B-GROWTH-22: saved count history kept in the supported Record disclosure.
 * No snapshot writer, current-count fallback, derived fraction or grade. */
export default function SavedMilestoneHistory() {
  const { childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const snapshots = useChildCollection<BandSnapshot>(childProfile.id, "bandSnapshots", { orderByField: "date", orderDir: "desc", max: 60, trackConfirmation: true });
  const ready = snapshots.loaded && snapshots.confirmed && !snapshots.error;
  if (!ready) return <p role="status">{t(snapshots.error || (snapshots.loaded && !snapshots.confirmed) ? "share.error" : "aria.loading")}</p>;
  const history = savedMilestoneHistory(snapshots.items);
  return <section data-testid="saved-milestone-history" className="space-y-3">
    <p className="t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.growthTruth.copilot.history.savedNote")}</p>
    {history.length === 0 ? <p className="t-sm">{t("elev.growthTruth.copilot.history.noSnapshots")}</p> : <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {history.map(snapshot => <article key={snapshot.id} className="rounded-xl border p-4" style={{ borderColor: "var(--arbor-rule)" }}>
        <h3 className="t-sm font-semibold" dir="auto">{snapshot.id}</h3>
        <time className="t-sm" dateTime={snapshot.date}>{fmtDay(snapshot.date, uiLang)}</time>
        {snapshot.counts.length === 0 ? <p className="t-sm">{t("elev.growthTruth.copilot.history.noSavedCounts")}</p> : <ul className="mt-3 space-y-2">
          {snapshot.counts.map((row, index) => <li key={`${row.domain}-${index}`} className="t-sm">
            <span className="font-semibold">{domainLabel("practice", row.domain, t)}</span>{" · "}
            {row.reached === null ? t("elev.growthTruth.copilot.history.noSavedCounts") : t(row.reached === 1 ? "elev.reports.lead.milestones.one" : "elev.reports.lead.milestones.other", { n: row.reached })}
          </li>)}
        </ul>}
      </article>)}
    </div>}
  </section>;
}
