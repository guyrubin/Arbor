import React, { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "../ui/Icon";
import { useEntitlement } from "../../hooks/useEntitlement";
import { useLanguage } from "../../context/LanguageContext";
import { authHeaders } from "../../lib/api";
import { UTM_KEYS } from "../../lib/attribution";
import { cohortRowsToFunnel, type CohortFunnelRow, type FunnelRow } from "../../lib/attributionFunnel";
import { PageHeader } from "../ui/kit";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { Skeleton } from "../ui/Skeleton";

/**
 * P0-5 — Attribution funnel dashboard (internal / admin-only).
 *
 * B-CAREPRO-30: the job is "see which channels bring families in", and the
 * view used to read only the signed-in operator's own `users/{uid}/events` —
 * one account's funnel. It now reads the cross-family reader that already
 * exists, `GET /api/admin/cohorts` (admin-gated on the server, internal
 * accounts excluded by default, counts only: no per-family row, no child data,
 * no name ever leaves the server — server/cohortMetrics.ts). Grouped by
 * acquisition `source` or by `market`, over a chosen window.
 *
 * Counts only: the table shows how many families reached each stage, never a
 * rate. Gating reuses `entitlement.isAdmin` (the entry is admin-only in
 * Settings and the server refuses non-admins with 403). Never in parent nav,
 * and it renders with no hub pill row (lib/navigation NO_PILL_ROW_TABS).
 */

// The funnel stages we show, in order. Names must match lib/loopEvents.
// B-MEAS-06: `first_plan` is the FIRST PLAN (it can happen inside the
// onboarding session); "Activation" is `activated` (kpiEvents.ts: a loop
// completed on a later day), the stage the cohort report reads.
export const FUNNEL = [
  { event: "install", labelKey: "attr.stage.install" },
  { event: "first_plan", labelKey: "attr.stage.firstPlan" },
  { event: "activated", labelKey: "attr.stage.activation" },
  { event: "paid", labelKey: "attr.stage.paid" },
] as const;

/** The window the cohort reader counts from. */
export const PERIOD_DAYS = [7, 30, 90] as const;
type PeriodDays = (typeof PERIOD_DAYS)[number];

const CANONICAL_EXAMPLE =
  "https://arborparentingapp.com/?utm_source=instagram&utm_medium=social&utm_campaign=launch_il&utm_content=bio_link";

type CohortResponse = {
  funnels?: { acquisition?: CohortFunnelRow[] };
  internal?: { excluded?: number };
};

export default function AttributionTab() {
  const { entitlement } = useEntitlement();
  const { t } = useLanguage();
  const isAdmin = Boolean(entitlement.isAdmin);

  const [rows, setRows] = useState<FunnelRow[] | null>(null);
  const [internalExcluded, setInternalExcluded] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [groupBy, setGroupBy] = useState<"source" | "market">("source");
  const [period, setPeriod] = useState<PeriodDays>(30);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setFailed(false);
    try {
      const since = new Date(Date.now() - period * 86_400_000).toISOString();
      const res = await fetch(
        `/api/admin/cohorts?groupBy=${groupBy}&since=${encodeURIComponent(since)}`,
        { headers: await authHeaders() },
      );
      if (!res.ok) throw new Error(`cohorts ${res.status}`);
      const report = (await res.json()) as CohortResponse;
      setRows(cohortRowsToFunnel(report.funnels?.acquisition ?? []));
      setInternalExcluded(Number(report.internal?.excluded) || 0);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, groupBy, period]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () => (rows ?? []).reduce(
      (acc, r) => ({ install: acc.install + r.install, first_plan: acc.first_plan + r.first_plan, activated: acc.activated + r.activated, paid: acc.paid + r.paid }),
      { install: 0, first_plan: 0, activated: 0, paid: 0 },
    ),
    [rows],
  );

  // --- Gating: non-admins never see this view (defence in depth; the entry
  // point is also admin-gated and the server answers 403). ---
  if (!isAdmin) {
    return (
      <div>
        <PageHeader title={t("attr.title")} />
        <EmptyState
          icon={<Icon name="lock" size={32} />}
          headline={t("attr.locked.title")}
          body={t("attr.locked.body")}
        />
      </div>
    );
  }

  const groupLabel = (key: string) => {
    if (groupBy === "source") return key;
    const marketKey = `attr.market.${key}`;
    const label = t(marketKey);
    return label === marketKey ? key : label;
  };
  const selectCls = "rounded-xl px-3 min-h-[44px] text-xs font-bold";
  const selectStyle: React.CSSProperties = { color: "var(--arbor-ink)", background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" };
  const shown = rows ?? [];

  return (
    <div>
      <PageHeader
        title={t("attr.title")}
        subtitle={t("attr.subtitle")}
        action={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 font-bold text-xs rounded-2xl px-4 min-h-[44px] transition disabled:opacity-60"
            style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
          >
            <Icon name="refresh" size={16} className={loading ? "animate-spin" : ""} /> {t("attr.refresh")}
          </button>
        }
      />

      {/* Item 11 (IA-02): `data-module` marks a top-level sibling module (what
          moduleBudget counts); `data-primary-move` marks the ONE control that
          performs the move surfaceContract.ts declares for this route. */}
      <div data-module="attribution-controls" className="flex flex-wrap items-center gap-3 mb-6">
        <label className="inline-flex items-center gap-2 text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>
          {t("attr.groupBy")}
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as "source" | "market")} className={selectCls} style={selectStyle}>
            <option value="source">{t("attr.group.source")}</option>
            <option value="market">{t("attr.group.market")}</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>
          {t("attr.period")}
          <select value={period} onChange={(e) => setPeriod(Number(e.target.value) as PeriodDays)} className={selectCls} style={selectStyle}>
            {PERIOD_DAYS.map((d) => (
              <option key={d} value={d}>{t("attr.period.days", { n: d })}</option>
            ))}
          </select>
        </label>
      </div>

      {loading && rows === null && (
        <div className="space-y-2" aria-busy="true" aria-label={t("attr.loading")}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-2xl" />)}
        </div>
      )}

      {failed && (
        <ErrorState
          surface="attribution"
          headline={t("attr.error.title")}
          body={t("attr.error.body")}
          onRetry={() => void load()}
          retrying={loading}
        />
      )}

      {!loading && !failed && rows !== null && shown.length === 0 && (
        <EmptyState
          icon={<Icon name="bar_chart" size={32} />}
          headline={t("attr.empty.title")}
          body={t("attr.empty.body")}
          action={
            <code
              className="block text-[11px] leading-relaxed rounded-xl px-3 py-2 break-all max-w-md"
              dir="ltr"
              style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
            >
              {CANONICAL_EXAMPLE}
            </code>
          }
        />
      )}

      {!failed && shown.length > 0 && (
        <div data-module="attribution-funnel" data-primary-move="view-attribution" className="rounded-2xl overflow-x-auto" style={{ border: "1px solid var(--arbor-rule)" }}>
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">{t("attr.title")}</caption>
            <thead>
              <tr style={{ background: "var(--arbor-paper-deep)" }}>
                <th scope="col" className="text-start font-extrabold px-4 py-3 text-xs" style={{ color: "var(--arbor-muted)" }}>
                  {groupBy === "source" ? t("attr.col.source") : t("attr.col.market")}
                </th>
                {FUNNEL.map((f) => (
                  <th key={f.event} scope="col" className="text-end font-extrabold px-4 py-3 text-xs" style={{ color: "var(--arbor-muted)" }}>
                    {t(f.labelKey)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.key} style={{ borderTop: "1px solid var(--arbor-rule)" }}>
                  <th scope="row" className="text-start font-bold px-4 py-3" dir="auto" style={{ color: "var(--arbor-ink)" }}>
                    {groupLabel(r.key)}
                  </th>
                  {FUNNEL.map((f) => (
                    <td key={f.event} className="text-end px-4 py-3 font-mono tabular-nums" dir="ltr" style={{ color: "var(--arbor-ink)" }}>{r[f.event]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--arbor-rule)", background: "var(--arbor-paper-deep)" }}>
                <th scope="row" className="text-start font-extrabold px-4 py-3" style={{ color: "var(--arbor-ink)" }}>
                  {t("attr.total")}
                </th>
                {FUNNEL.map((f) => (
                  <td key={f.event} className="text-end px-4 py-3 font-mono tabular-nums font-bold" dir="ltr" style={{ color: "var(--arbor-ink)" }}>{totals[f.event]}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-[11px] mt-4" style={{ color: "var(--arbor-muted)" }}>
        {t("attr.footnote")}{" "}
        <span dir="ltr" className="font-mono">{UTM_KEYS.join(", ")}</span>.
        {internalExcluded > 0 && <> {t("attr.internalExcluded", { n: internalExcluded })}</>}
      </p>
    </div>
  );
}
