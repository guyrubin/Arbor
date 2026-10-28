import React, { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { api, type AdminKidPlay, type AdminOverview } from "../../lib/api";

/**
 * ADM-1: founder-only single-pane dashboard. Reads /api/admin/overview (users,
 * paying-by-plan, today's token spend). Shown from Settings only when the
 * signed-in user is an admin. Numbers are operational, not billing-grade —
 * RevenueCat remains the source of truth for revenue.
 */
export default function AdminDashboard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // B-GAME-18 / B-BOOK-51: the last four weeks of Kid Mode play (counts; small cells hidden server-side).
  const [kidPlay, setKidPlay] = useState<AdminKidPlay | null | "unavailable">(null);
  const load = () => {
    setLoading(true);
    setError(null);
    api.adminOverview()
      .then(setData)
      .catch((e) => setError(e?.message || "Failed to load"))
      .finally(() => setLoading(false));
    api.adminKidPlay(new Date(Date.now() - 28 * 86_400_000).toISOString())
      .then((r) => setKidPlay(r.kidPlay ?? "unavailable"))
      .catch(() => setKidPlay("unavailable"));
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Founder dashboard">
      <div className="space-y-4 text-sm">
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>
            {data ? `As of ${new Date(data.generatedAt).toLocaleString()}` : "Live operational metrics"}
          </p>
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-1.5 disabled:opacity-50" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
            <Icon name="refresh" size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-xl p-3 text-xs" style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}>{error}</div>
        )}

        {/* Users + paying */}
        <div className="grid grid-cols-2 gap-3">
          <Stat icon={<Icon name="group" size={16} />} label="User profiles" value={data?.users ?? "—"} />
          <Stat icon={<Icon name="credit_card" size={16} />} label="Paying" value={data?.paying.total ?? "—"} sub={data ? `${data.paying.plus} Plus · ${data.paying.family} Family · ${data.paying.trialing} trial` : undefined} />
        </div>

        {/* Token spend today */}
        <div className="rounded-2xl p-4" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: "#fff", color: "var(--arbor-green-ink)" }}><Icon name="memory" size={16} /></span>
            <p className="font-bold" style={{ color: "var(--arbor-ink)" }}>AI usage today {data ? `(${data.usageToday.date})` : ""}</p>
          </div>
          <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs" style={{ color: "var(--arbor-muted)" }}>
            <span>Calls</span><span className="text-end font-mono" style={{ color: "var(--arbor-ink)" }}>{data?.usageToday.calls ?? "—"}</span>
            <span>Live session minutes · observed</span><span className="text-end font-mono">{data?.usageToday.live ? (data.usageToday.live.observedSessionMs / 60_000).toFixed(1) : "Not measured"}</span>
            <span>Total tokens</span><span className="text-end font-mono" style={{ color: "var(--arbor-ink)" }}>{data ? data.usageToday.totalTokens.toLocaleString() : "—"}</span>
            <span>Estimated cost · last 30 days</span><span className="text-end font-mono font-bold" style={{ color: "var(--arbor-ink)" }}>{data?.cost30d?.estimatedCostUsd != null ? `≈ $${data.cost30d.estimatedCostUsd.toFixed(4)} USD` : "Not measured"}</span>
            <span>Priced calls · last 30 days</span><span className="text-end font-mono">{data?.cost30d ? `${data.cost30d.pricedCalls} / ${data.cost30d.calls}` : "—"}</span>
            <span>Per active family · last 30 days</span><span className="text-end font-mono">{data?.cost30d?.perActiveFamilyUsd != null ? `≈ $${data.cost30d.perActiveFamilyUsd.toFixed(4)} USD` : "Not measured"}</span>
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--arbor-muted)" }}>Live minutes are observed connection time, not billed audio. Live costs and missing session reports are not included in the cost estimate.</p>
          {data && Object.keys(data.usageToday.byProvider).length > 0 && (
            <div className="mt-3 pt-3 text-xs" style={{ borderTop: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}>
              {Object.entries(data.usageToday.byProvider).map(([prov, t]) => (
                <div key={prov} className="flex justify-between">
                  <span>{prov}</span>
                  <span className="font-mono">{((t.promptTokens ?? 0) + (t.outputTokens ?? 0)).toLocaleString()} tok</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] mt-3" style={{ color: "var(--arbor-muted)" }}>
            List-price estimate for priced calls only, not the full bill. Unmetered voice and unknown models are not free. No currency conversion or free allowance is assumed. GCP Billing remains the source of truth for actual spend.
          </p>
        </div>

        <KidPlayPanel data={kidPlay} />
      </div>
    </Modal>
  );
}

/** B-GAME-18 / B-BOOK-51: weekly Kid Mode play, per game and per book. Counts of
 *  play across families, never a statement about a child; a cell about fewer
 *  than `minFamilies` families is hidden. */
export function KidPlayPanel({ data }: { data: AdminKidPlay | null | "unavailable" }) {
  const muted = { color: "var(--arbor-muted)" };
  const games = data && data !== "unavailable" ? data.games : [];
  const books = data && data !== "unavailable" ? data.books : [];
  const of = (n: number | null, m: number | null) => (n == null || m == null ? "Hidden" : `${n} of ${m}`);
  return (
    // The founder dashboard is English-only: the panel is set left to right so
    // "3 of 10" never reorders inside a Hebrew page.
    <div data-admin-kid-play="" dir="ltr" lang="en" className="rounded-2xl p-4" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: "var(--arbor-paper)", color: "var(--arbor-green-ink)" }}><Icon name="sports_esports" size={16} /></span>
        <p className="font-bold" style={{ color: "var(--arbor-ink)" }}>Kid Mode play · last 4 weeks</p>
      </div>
      {data === null ? <p className="text-xs" style={muted}>Loading…</p> : data === "unavailable" ? <p className="text-xs" style={muted}>Not available</p> : (
        <>
          <table className="w-full text-xs" data-admin-kid-games="">
            <thead><tr style={muted}><th className="text-start font-normal">Week · game</th><th className="text-end font-normal">Sittings</th><th className="text-end font-normal">Replays</th><th className="text-end font-normal">Back within 7 days</th></tr></thead>
            <tbody>
              {games.length === 0 && <tr><td colSpan={4} style={muted}>No sittings yet</td></tr>}
              {games.map((g) => (
                <tr key={`${g.week}:${g.game}`} data-hidden={g.hidden ? "" : undefined} style={{ color: "var(--arbor-ink)" }}>
                  <td>{g.week} · {g.game}</td>
                  <td className="text-end font-mono">{g.hidden ? "Hidden" : g.sittings}</td>
                  <td className="text-end font-mono">{of(g.replays, g.sittings)}</td>
                  <td className="text-end font-mono">{of(g.returned7d, g.families)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="w-full text-xs mt-3" data-admin-kid-books="">
            <thead><tr style={muted}><th className="text-start font-normal">Week · book</th><th className="text-end font-normal">Opened</th><th className="text-end font-normal">Finished</th></tr></thead>
            <tbody>
              {books.length === 0 && <tr><td colSpan={3} style={muted}>No books opened yet</td></tr>}
              {books.map((b) => (
                <tr key={`${b.week}:${b.book}`} data-hidden={b.hidden ? "" : undefined} style={{ color: "var(--arbor-ink)" }}>
                  <td>{b.week} · {b.book}</td>
                  <td className="text-end font-mono">{b.hidden ? "Hidden" : b.opened}</td>
                  <td className="text-end font-mono">{b.hidden ? "Hidden" : b.finished}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs mt-3" style={muted}>Cells about fewer than {data.minFamilies} families are hidden. Kid Mode sends no push into a game, so a return is unprompted. Play is never read as a sign about a child.</p>
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: "#fff", color: "var(--arbor-green-ink)" }}>{icon}</span>
        <p className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{label}</p>
      </div>
      <p className="text-2xl font-bold" style={{ color: "var(--arbor-ink)" }}>{value}</p>
      {sub && <p className="text-[11px] mt-0.5" style={{ color: "var(--arbor-muted)" }}>{sub}</p>}
    </div>
  );
}
