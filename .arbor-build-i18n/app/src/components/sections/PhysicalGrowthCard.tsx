import React, { useState, useMemo } from "react";
import { Ruler, Plus, X, Trash2 } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import type { GrowthEntry } from "../../types";
import {
  isValidEntry,
  sortEntriesAsc,
  latestEntry,
  heightTrajectory,
  weightTrajectory,
} from "../../growth/growthEntries";

/* C4 — Physical growth tracking.
 *
 * An optional parent-logged measurement log: timestamped entries of height,
 * weight, and/or head circumference. The record is append-only (via
 * useChildCollection). No percentile is shown — Arbor does not embed a
 * WHO/CDC reference table; the raw longitudinal trajectory goes to the
 * pediatrician who does have the reference charts.
 *
 * Framing: calm, non-diagnostic, parent-initiated. */

// Literal hex values — SVG polyline stroke must use literals, not CSS vars.
const HEX_GREEN = "#34b277";
const HEX_CLAY_DEEP = "#2a9c66";
const HEX_PEACH = "#d9763f";

// CSS var tokens (fine for non-chart SVG text / rect / fill)
const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const FAINT = "var(--arbor-faint)";
const GREEN = "var(--arbor-green-ink)";
const RULE = "var(--arbor-rule)";
const PAPER_ELEVATED = "var(--arbor-paper-elevated)";
const PAPER_SUNK = "var(--arbor-paper-sunk)";
const GREEN_SOFT = "var(--arbor-green-soft)";

// ---- Mini SVG trajectory chart ------------------------------------------

interface TrajectoryPoint {
  date: string;
  value: number;
}

function TrajectoryChart({
  data,
  color,
  label,
  unit,
}: {
  data: TrajectoryPoint[];
  color: string; // must be literal hex
  label: string;
  unit: string;
}) {
  const { uiLang } = useLanguage();
  if (data.length < 2) {
    return null;
  }

  const W = 280;
  const H = 80;
  const PAD_X = 4;
  const PAD_Y = 8;

  const values = data.map((d) => d.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const rangeV = maxV - minV || 1; // avoid div/0 when all values equal

  const points = data.map((d, i) => {
    const x = PAD_X + (i / (data.length - 1)) * (W - PAD_X * 2);
    const y = H - PAD_Y - ((d.value - minV) / rangeV) * (H - PAD_Y * 2);
    return { x, y, ...d };
  });

  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  // Format a date string "YYYY-MM-DD" into a short human label "Jun '26".
  const shortDate = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(uiLang === "he" ? "he-IL" : "en-US", { month: "short", year: "2-digit" });
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div
        className="text-[11px] font-bold uppercase tracking-wide mb-1"
        style={{ color: MUTED }}
      >
        {label}
      </div>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        aria-label={label}
        role="img"
        style={{ overflow: "visible", display: "block" }}
      >
        {/* Track */}
        <rect x={0} y={0} width={W} height={H} rx={8} fill={PAPER_SUNK} />
        {/* Trajectory line */}
        <polyline
          points={polyline}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
        ))}
        {/* First and last date labels */}
        {data.length >= 2 && (
          <>
            <text
              x={points[0].x}
              y={H - 1}
              textAnchor="start"
              fontSize={9}
              fill={FAINT}
            >
              {shortDate(data[0].date)}
            </text>
            <text
              x={points[points.length - 1].x}
              y={H - 1}
              textAnchor="end"
              fontSize={9}
              fill={FAINT}
            >
              {shortDate(data[data.length - 1].date)}
            </text>
          </>
        )}
        {/* Latest value label at last dot */}
        {(() => {
          const last = points[points.length - 1];
          return (
            <text
              x={last.x}
              y={last.y - 6}
              textAnchor="middle"
              fontSize={9}
              fontWeight={700}
              fill={color}
            >
              {last.value}
              {unit}
            </text>
          );
        })()}
      </svg>
    </div>
  );
}

// ---- Add measurement form -----------------------------------------------

interface AddFormValues {
  date: string;
  heightCm: string;
  weightKg: string;
  headCircumferenceCm: string;
  note: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

function AddForm({
  childId,
  onSave,
  onCancel,
}: {
  childId: string;
  onSave: (entry: GrowthEntry) => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [values, setValues] = useState<AddFormValues>({
    date: todayIso(),
    heightCm: "",
    weightKg: "",
    headCircumferenceCm: "",
    note: "",
  });
  const [error, setError] = useState(false);

  const set = (key: keyof AddFormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setError(false);
  };

  const handleSave = () => {
    const heightCm = values.heightCm ? parseFloat(values.heightCm) : undefined;
    const weightKg = values.weightKg ? parseFloat(values.weightKg) : undefined;
    const headCircumferenceCm = values.headCircumferenceCm
      ? parseFloat(values.headCircumferenceCm)
      : undefined;

    if (!isValidEntry({ heightCm, weightKg, headCircumferenceCm })) {
      setError(true);
      return;
    }

    const entry: GrowthEntry = {
      id: `${childId}-${values.date}-${Date.now()}`,
      childId,
      date: values.date,
      ...(heightCm !== undefined && { heightCm }),
      ...(weightKg !== undefined && { weightKg }),
      ...(headCircumferenceCm !== undefined && { headCircumferenceCm }),
      ...(values.note.trim() && { note: values.note.trim() }),
    };
    onSave(entry);
  };

  const inputCls =
    "w-full rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#34b277]";
  const inputStyle: React.CSSProperties = {
    background: PAPER_SUNK,
    color: INK,
    border: `1px solid ${RULE}`,
    minHeight: 40,
  };
  const labelCls = "text-[12px] font-bold mb-1 block";

  return (
    <div
      className="rounded-2xl p-4 space-y-3 mt-4"
      style={{ background: PAPER_ELEVATED, border: `1px solid ${RULE}` }}
    >
      <div className="text-[14px] font-extrabold" style={{ color: INK }}>
        {t("growth.add.title")}
      </div>

      {/* Date */}
      <div>
        <label className={labelCls} style={{ color: MUTED }}>
          {t("growth.add.date")}
        </label>
        <input
          type="date"
          value={values.date}
          onChange={set("date")}
          className={inputCls}
          style={inputStyle}
          max={todayIso()}
        />
      </div>

      {/* Measurements row */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={labelCls} style={{ color: MUTED }}>
            {t("growth.add.height")}
          </label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            value={values.heightCm}
            onChange={set("heightCm")}
            placeholder="—"
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label className={labelCls} style={{ color: MUTED }}>
            {t("growth.add.weight")}
          </label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.05}
            value={values.weightKg}
            onChange={set("weightKg")}
            placeholder="—"
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label className={labelCls} style={{ color: MUTED }}>
            {t("growth.add.head")}
          </label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            value={values.headCircumferenceCm}
            onChange={set("headCircumferenceCm")}
            placeholder="—"
            className={inputCls}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Note */}
      <div>
        <label className={labelCls} style={{ color: MUTED }}>
          {t("growth.add.note")}
        </label>
        <input
          type="text"
          value={values.note}
          onChange={set("note")}
          placeholder={t("growth.add.notePlaceholder")}
          className={inputCls}
          style={inputStyle}
          maxLength={120}
        />
      </div>

      {error && (
        <p className="text-[12px]" style={{ color: "var(--arbor-peach-ink)" }}>
          {t("growth.add.error")}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          className="touch-target flex-1 rounded-xl text-[13px] font-bold transition active:scale-[0.98]"
          style={{
            background: HEX_GREEN,
            color: "#fff",
            border: "none",
            minHeight: 44,
          }}
        >
          {t("growth.add.save")}
        </button>
        <button
          onClick={onCancel}
          className="touch-target rounded-xl px-5 text-[13px] font-bold"
          style={{
            background: PAPER_SUNK,
            color: MUTED,
            border: `1px solid ${RULE}`,
            minHeight: 44,
          }}
        >
          {t("growth.add.cancel")}
        </button>
      </div>
    </div>
  );
}

// ---- Latest measurement summary -----------------------------------------

function LatestSummary({ entry }: { entry: GrowthEntry }) {
  const { t, uiLang } = useLanguage();
  const shortDate = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString(uiLang === "he" ? "he-IL" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const items: { label: string; value: string }[] = [];
  if (entry.heightCm !== undefined)
    items.push({ label: t("growth.latest.height"), value: t("growth.latest.cm", { v: entry.heightCm }) });
  if (entry.weightKg !== undefined)
    items.push({ label: t("growth.latest.weight"), value: t("growth.latest.kg", { v: entry.weightKg }) });
  if (entry.headCircumferenceCm !== undefined)
    items.push({ label: t("growth.latest.head"), value: t("growth.latest.cm", { v: entry.headCircumferenceCm }) });

  return (
    <div className="flex flex-wrap gap-3 mt-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl px-3 py-2 text-center"
          style={{ background: PAPER_SUNK, minWidth: 72 }}
        >
          <div className="text-[11px]" style={{ color: MUTED }}>
            {item.label}
          </div>
          <div className="text-[15px] font-extrabold" style={{ color: INK }}>
            {item.value}
          </div>
        </div>
      ))}
      <div className="self-end text-[11px]" style={{ color: FAINT }}>
        {t("growth.latest.as_of", { date: shortDate(entry.date) })}
      </div>
    </div>
  );
}

// ---- Main card ----------------------------------------------------------

export default function PhysicalGrowthCard() {
  const { childProfile } = useArbor();
  const { t } = useLanguage();
  const firstName = (childProfile.name || "your child").split(" ")[0];
  const [adding, setAdding] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const collection = useChildCollection<GrowthEntry>(childProfile.id, "growthEntries", {
    orderByField: "date",
    orderDir: "desc",
  });

  const sorted = useMemo(() => sortEntriesAsc(collection.items), [collection.items]);
  const latest = useMemo(() => latestEntry(collection.items), [collection.items]);
  const heightData = useMemo(() => heightTrajectory(collection.items), [collection.items]);
  const weightData = useMemo(() => weightTrajectory(collection.items), [collection.items]);

  const handleSave = async (entry: GrowthEntry) => {
    await collection.upsert(entry);
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    await collection.remove(id);
    setConfirmDeleteId(null);
  };

  const isEmpty = collection.loaded && collection.items.length === 0;

  return (
    <section
      className="rounded-[22px] overflow-hidden"
      style={{
        background: PAPER_ELEVATED,
        border: `1px solid ${RULE}`,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span
            className="inline-flex items-center gap-1.5 text-[13px] font-bold"
            style={{ color: GREEN }}
          >
            <Ruler className="w-3.5 h-3.5" />
            {t("growth.eyebrow")}
          </span>
          {!isEmpty && !adding && (
            <button
              className="touch-target inline-flex items-center gap-1 text-[12px] font-bold rounded-xl px-3"
              style={{
                background: "var(--arbor-clay-dim)",
                color: GREEN,
                border: "none",
                minHeight: 32,
              }}
              onClick={() => setAdding(true)}
              aria-label={t("growth.add.cta")}
            >
              <Plus className="w-3.5 h-3.5" /> {t("growth.add.cta")}
            </button>
          )}
        </div>

        {/* Empty state */}
        {isEmpty && !adding && (
          <div className="mt-4 text-center py-4">
            <p
              className="text-[13.5px] font-bold"
              style={{ color: INK }}
            >
              {t("growth.empty.title")}
            </p>
            <p
              className="text-[12.5px] mt-1 leading-relaxed"
              style={{ color: MUTED, textWrap: "pretty" } as React.CSSProperties}
            >
              {t("growth.empty.body", { name: firstName })}
            </p>
            <button
              className="touch-target mt-4 inline-flex items-center gap-1.5 rounded-2xl px-5 text-[13px] font-bold transition active:scale-[0.98]"
              style={{
                background: HEX_GREEN,
                color: "#fff",
                border: "none",
                minHeight: 44,
              }}
              onClick={() => setAdding(true)}
            >
              <Plus className="w-4 h-4" /> {t("growth.empty.cta")}
            </button>
          </div>
        )}

        {/* Add form */}
        {adding && (
          <AddForm
            childId={childProfile.id}
            onSave={handleSave}
            onCancel={() => setAdding(false)}
          />
        )}

        {/* Latest snapshot + trajectory charts */}
        {!isEmpty && latest && (
          <>
            <LatestSummary entry={latest} />

            {/* Height trajectory */}
            {heightData.length >= 2 && (
              <TrajectoryChart
                data={heightData}
                color={HEX_GREEN}
                label={t("growth.chart.height")}
                unit="cm"
              />
            )}

            {/* Weight trajectory */}
            {weightData.length >= 2 && (
              <TrajectoryChart
                data={weightData}
                color={HEX_CLAY_DEEP}
                label={t("growth.chart.weight")}
                unit="kg"
              />
            )}

            {/* Single-entry chart nudge */}
            {heightData.length < 2 && weightData.length < 2 && (
              <p
                className="text-[11.5px] mt-3"
                style={{ color: FAINT }}
              >
                {t("growth.chart.nodata")}
              </p>
            )}

            {/* Non-diagnostic framing — always visible once there are entries */}
            <p
              className="text-[11.5px] mt-3.5"
              style={{ color: FAINT }}
            >
              {t("growth.note")}
            </p>

            {/* Entry log (compact) */}
            {sorted.length > 0 && (
              <div className="mt-4 space-y-1">
                {[...sorted].reverse().map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px]"
                    style={{ background: PAPER_SUNK, color: MUTED }}
                  >
                    <span className="flex-shrink-0 font-bold" style={{ color: INK }}>
                      {e.date}
                    </span>
                    {e.heightCm !== undefined && (
                      <span>{e.heightCm} cm</span>
                    )}
                    {e.weightKg !== undefined && (
                      <span>{e.weightKg} kg</span>
                    )}
                    {e.headCircumferenceCm !== undefined && (
                      <span>HC {e.headCircumferenceCm} cm</span>
                    )}
                    {e.note && (
                      <span className="truncate flex-1 text-[11px]">{e.note}</span>
                    )}
                    <button
                      className="touch-target ml-auto flex-shrink-0"
                      style={{ color: FAINT, background: "none", border: "none", minHeight: 32, minWidth: 32 }}
                      onClick={() => setConfirmDeleteId(e.id)}
                      aria-label={t("growth.delete.confirm")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Delete confirmation inline */}
            {confirmDeleteId && (
              <div
                className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2"
                style={{ background: "var(--arbor-peach-soft)", border: `1px solid var(--arbor-peach)` }}
              >
                <span className="text-[12px] flex-1" style={{ color: "var(--arbor-peach-ink)" }}>
                  {t("growth.delete.confirm")}
                </span>
                <button
                  className="text-[12px] font-bold px-3 py-1 rounded-lg"
                  style={{ background: HEX_PEACH, color: "#fff", border: "none" }}
                  onClick={() => handleDelete(confirmDeleteId)}
                >
                  {t("growth.add.save")}
                </button>
                <button
                  className="text-[12px] font-bold"
                  style={{ color: MUTED, background: "none", border: "none" }}
                  onClick={() => setConfirmDeleteId(null)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
