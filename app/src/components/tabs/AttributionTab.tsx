import React, { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { BarChart3, RefreshCw, Lock } from "lucide-react";
import { db, firebaseEnabled } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { useEntitlement } from "../../hooks/useEntitlement";
import { useLanguage } from "../../context/LanguageContext";
import { UTM_KEYS } from "../../lib/attribution";
import { aggregateFunnel, campaignsOf, ratePct, type FunnelEventDoc, type FunnelRow } from "../../lib/attributionFunnel";
import { PageHeader } from "../ui/kit";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { Skeleton } from "../ui/Skeleton";

/**
 * P0-5 — Attribution + UTM funnel dashboard (internal / admin-only).
 *
 * A read-only view over the signed-in operator's own `users/{uid}/events`
 * collection (the same path lib/analytics writes to). It aggregates the growth
 * funnel — install → activation (first_plan) → paid — sliced by acquisition
 * `source` and by `market`, with an optional `utm_campaign` filter. No capture
 * logic lives here; it reuses the canonical UTM_KEYS export from lib/attribution.
 *
 * Privacy: reads ONLY the operator's own event collection (no cross-user reads,
 * no child data). Gating reuses the existing `entitlement.isAdmin` signal — no
 * new auth path. Never surfaced in the parent-facing nav.
 */

// The funnel stages we measure, in order. Names must match lib/loopEvents.
const FUNNEL = [
  { event: "install", labelKey: "attr.stage.install", fallback: "Install" },
  { event: "first_plan", labelKey: "attr.stage.activation", fallback: "Activation" },
  { event: "paid", labelKey: "attr.stage.paid", fallback: "Paid" },
] as const;

const CANONICAL_EXAMPLE =
  "https://arborprd-westeu.web.app/?utm_source=instagram&utm_medium=social&utm_campaign=launch_il&utm_content=bio_link";

function emptyCounts() {
  return { install: 0, first_plan: 0, paid: 0 };
}

export default function AttributionTab() {
  const { user } = useAuth();
  const { entitlement } = useEntitlement();
  const { t } = useLanguage();
  const isAdmin = Boolean(entitlement.isAdmin);

  const [events, setEvents] = useState<FunnelEventDoc[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<"source" | "market">("source");
  const [campaign, setCampaign] = useState("__all__");

  const uid = user?.uid;

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      if (!firebaseEnabled || !db || !uid || uid === "local-sandbox") {
        setEvents([]); // sandbox / no backend → legitimate empty state, not an error
        return;
      }
      const snap = await getDocs(collection(db, `users/${uid}/events`));
      setEvents(snap.docs.map((d) => d.data() as FunnelEventDoc));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, uid]);

  useEffect(() => {
    void load();
  }, [load]);

  // Campaign options derived from the loaded events (so the filter only shows
  // campaigns that actually have data).
  const campaigns = useMemo(() => campaignsOf(events ?? []), [events]);

  const rows: FunnelRow[] = useMemo(
    () => (events ? aggregateFunnel(events, groupBy, campaign) : []),
    [events, groupBy, campaign],
  );

  const totals = useMemo(
    () => rows.reduce(
      (acc, r) => ({ install: acc.install + r.install, first_plan: acc.first_plan + r.first_plan, paid: acc.paid + r.paid }),
      emptyCounts(),
    ),
    [rows],
  );

  // --- Gating: non-admins never see this view (defence in depth; the entry
  // point is also admin-gated). Render a quiet, honest guard. ---
  if (!isAdmin) {
    return (
      <div>
        <PageHeader title={t("attr.title") || "Attribution"} />
        <EmptyState
          icon={<Lock className="w-8 h-8" />}
          headline={t("attr.locked.title") || "Internal dashboard"}
          body={t("attr.locked.body") || "This funnel dashboard is available to Arbor operators only."}
        />
      </div>
    );
  }

  const groupLabel = (key: string) =>
    groupBy === "source" ? key : (t("attr.market." + key) || key);

  return (
    <div>
      <PageHeader
        title={t("attr.title") || "Attribution & funnel"}
        subtitle={t("attr.subtitle") || "Install → activation → paid, by acquisition channel and market. First-party data from your own event stream."}
        action={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 font-bold text-xs rounded-2xl px-4 min-h-[44px] transition disabled:opacity-60"
            style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> {t("attr.refresh") || "Refresh"}
          </button>
        }
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <label className="inline-flex items-center gap-2 text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>
          {t("attr.groupBy") || "Group by"}
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as "source" | "market")}
            className="rounded-xl px-3 min-h-[44px] text-xs font-bold bg-white"
            style={{ color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
          >
            <option value="source">{t("attr.group.source") || "Source / channel"}</option>
            <option value="market">{t("attr.group.market") || "Market"}</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>
          {t("attr.campaign") || "Campaign"}
          <select
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            className="rounded-xl px-3 min-h-[44px] text-xs font-bold bg-white"
            style={{ color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
          >
            <option value="__all__">{t("attr.campaign.all") || "All campaigns"}</option>
            {campaigns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      {/* States */}
      {loading && events === null && (
        <div className="space-y-2" aria-busy="true" aria-label={t("attr.loading") || "Loading analytics"}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-2xl" />)}
        </div>
      )}

      {error && (
        <ErrorState
          headline={t("attr.error.title") || "Couldn't load analytics"}
          body={t("attr.error.body") || "We couldn't read your event stream. Your data is safe — try again."}
          onRetry={() => void load()}
          retrying={loading}
        />
      )}

      {!loading && !error && rows.length === 0 && (
        <EmptyState
          icon={<BarChart3 className="w-8 h-8" />}
          headline={t("attr.empty.title") || "No events yet"}
          body={t("attr.empty.body") || "Share a tagged link to start measuring. Tag outbound links with the UTM scheme, e.g."}
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

      {!error && rows.length > 0 && (
        <div className="rounded-2xl overflow-x-auto" style={{ border: "1px solid var(--arbor-rule)" }}>
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">{t("attr.title") || "Attribution funnel"}</caption>
            <thead>
              <tr style={{ background: "var(--arbor-paper-deep)" }}>
                <th scope="col" className="text-start font-extrabold px-4 py-3 text-xs" style={{ color: "var(--arbor-muted)" }}>
                  {groupBy === "source" ? (t("attr.col.source") || "Source") : (t("attr.col.market") || "Market")}
                </th>
                {FUNNEL.map((f) => (
                  <th key={f.event} scope="col" className="text-end font-extrabold px-4 py-3 text-xs" style={{ color: "var(--arbor-muted)" }}>
                    {t(f.labelKey) || f.fallback}
                  </th>
                ))}
                <th scope="col" className="text-end font-extrabold px-4 py-3 text-xs" style={{ color: "var(--arbor-muted)" }}>
                  {t("attr.col.actRate") || "Inst→Act"}
                </th>
                <th scope="col" className="text-end font-extrabold px-4 py-3 text-xs" style={{ color: "var(--arbor-muted)" }}>
                  {t("attr.col.payRate") || "Act→Paid"}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} style={{ borderTop: "1px solid var(--arbor-rule)" }}>
                  <th scope="row" className="text-start font-bold px-4 py-3" style={{ color: "var(--arbor-ink)" }}>
                    {groupLabel(r.key)}
                  </th>
                  <td className="text-end px-4 py-3 font-mono tabular-nums" dir="ltr" style={{ color: "var(--arbor-ink)" }}>{r.install}</td>
                  <td className="text-end px-4 py-3 font-mono tabular-nums" dir="ltr" style={{ color: "var(--arbor-ink)" }}>{r.first_plan}</td>
                  <td className="text-end px-4 py-3 font-mono tabular-nums" dir="ltr" style={{ color: "var(--arbor-ink)" }}>{r.paid}</td>
                  <td className="text-end px-4 py-3 font-mono tabular-nums" dir="ltr" style={{ color: "var(--arbor-muted)" }}>{ratePct(r.first_plan, r.install)}</td>
                  <td className="text-end px-4 py-3 font-mono tabular-nums" dir="ltr" style={{ color: "var(--arbor-muted)" }}>{ratePct(r.paid, r.first_plan)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--arbor-rule)", background: "var(--arbor-paper-deep)" }}>
                <th scope="row" className="text-start font-extrabold px-4 py-3" style={{ color: "var(--arbor-ink)" }}>
                  {t("attr.total") || "Total"}
                </th>
                <td className="text-end px-4 py-3 font-mono tabular-nums font-bold" dir="ltr" style={{ color: "var(--arbor-ink)" }}>{totals.install}</td>
                <td className="text-end px-4 py-3 font-mono tabular-nums font-bold" dir="ltr" style={{ color: "var(--arbor-ink)" }}>{totals.first_plan}</td>
                <td className="text-end px-4 py-3 font-mono tabular-nums font-bold" dir="ltr" style={{ color: "var(--arbor-ink)" }}>{totals.paid}</td>
                <td className="text-end px-4 py-3 font-mono tabular-nums" dir="ltr" style={{ color: "var(--arbor-muted)" }}>{ratePct(totals.first_plan, totals.install)}</td>
                <td className="text-end px-4 py-3 font-mono tabular-nums" dir="ltr" style={{ color: "var(--arbor-muted)" }}>{ratePct(totals.paid, totals.first_plan)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-[11px] mt-4" style={{ color: "var(--arbor-muted)" }}>
        {t("attr.footnote") || "First-party counts from your own event stream. UTM keys:"}{" "}
        <span dir="ltr" className="font-mono">{UTM_KEYS.join(", ")}</span>.
      </p>
    </div>
  );
}
