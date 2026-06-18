/**
 * Pure aggregation for the internal Attribution dashboard (P0-5).
 *
 * Kept out of the React component so it is unit-testable in isolation. Reads the
 * operator's own event docs and rolls them up into per-group funnel counts
 * (install → activation → paid), filterable by campaign. No I/O, no React.
 */

/** Funnel stages we measure, in order. Names must match lib/loopEvents. */
export const FUNNEL_EVENTS = ["install", "first_plan", "paid"] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

export type FunnelEventDoc = { event: string; props?: Record<string, unknown> };

export type FunnelRow = { key: string } & Record<FunnelEvent, number>;

const isFunnelEvent = (e: string): e is FunnelEvent =>
  (FUNNEL_EVENTS as readonly string[]).includes(e);

function emptyCounts(): Record<FunnelEvent, number> {
  return { install: 0, first_plan: 0, paid: 0 };
}

/** Group → funnel counts, grouped by `source` or `market`, filtered by campaign. */
export function aggregateFunnel(
  events: FunnelEventDoc[],
  groupBy: "source" | "market",
  campaign: string,
): FunnelRow[] {
  const groups = new Map<string, Record<FunnelEvent, number>>();
  for (const e of events) {
    if (!isFunnelEvent(e.event)) continue;
    const props = e.props || {};
    if (campaign !== "__all__" && String(props.utm_campaign ?? "") !== campaign) continue;
    const key = String(props[groupBy] ?? "unknown");
    const row = groups.get(key) ?? emptyCounts();
    row[e.event] += 1;
    groups.set(key, row);
  }
  return Array.from(groups.entries())
    .map(([key, c]) => ({ key, ...c }))
    .sort((a, b) => b.install - a.install || b.first_plan - a.first_plan);
}

/** Distinct campaigns present in the data (for the filter dropdown). */
export function campaignsOf(events: FunnelEventDoc[]): string[] {
  const set = new Set<string>();
  for (const e of events) {
    const c = e.props?.utm_campaign;
    if (c) set.add(String(c));
  }
  return Array.from(set).sort();
}

/** Whole-percentage conversion string; "—" when the denominator is 0. */
export function ratePct(numerator: number, denominator: number): string {
  if (!denominator) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
}
