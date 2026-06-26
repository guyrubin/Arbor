import React, { useEffect, useState } from "react";
import { Users, CreditCard, Cpu, RefreshCw } from "lucide-react";
import { Modal } from "../ui/Modal";
import { api, type AdminOverview } from "../../lib/api";

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

  const load = () => {
    setLoading(true);
    setError(null);
    api.adminOverview()
      .then(setData)
      .catch((e) => setError(e?.message || "Failed to load"))
      .finally(() => setLoading(false));
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
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-xl p-3 text-xs" style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}>{error}</div>
        )}

        {/* Users + paying */}
        <div className="grid grid-cols-2 gap-3">
          <Stat icon={<Users className="w-4 h-4" />} label="User profiles" value={data?.users ?? "—"} />
          <Stat icon={<CreditCard className="w-4 h-4" />} label="Paying" value={data?.paying.total ?? "—"} sub={data ? `${data.paying.plus} Plus · ${data.paying.family} Family · ${data.paying.trialing} trial` : undefined} />
        </div>

        {/* Token spend today */}
        <div className="rounded-2xl p-4" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: "#fff", color: "var(--arbor-green-ink)" }}><Cpu className="w-4 h-4" /></span>
            <p className="font-bold" style={{ color: "var(--arbor-ink)" }}>AI usage today {data ? `(${data.usageToday.date})` : ""}</p>
          </div>
          <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs" style={{ color: "var(--arbor-muted)" }}>
            <span>Calls</span><span className="text-end font-mono" style={{ color: "var(--arbor-ink)" }}>{data?.usageToday.calls ?? "—"}</span>
            <span>Total tokens</span><span className="text-end font-mono" style={{ color: "var(--arbor-ink)" }}>{data ? data.usageToday.totalTokens.toLocaleString() : "—"}</span>
            <span>Approx. cost</span><span className="text-end font-mono font-bold" style={{ color: "var(--arbor-ink)" }}>{data ? `≈ €${data.usageToday.approxCostEur.toFixed(2)}` : "—"}</span>
          </div>
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
            Cost is an approximation from token counts — RevenueCat is the source of truth for revenue, GCP Billing for actual model spend.
          </p>
        </div>
      </div>
    </Modal>
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
