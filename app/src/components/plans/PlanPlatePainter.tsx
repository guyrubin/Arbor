/**
 * PlanPlatePainter — B-BOOK-75 (plates painted in-product): the owner-only
 * control under the parent's "Everyday plans" section. Renders ONLY when the
 * server's visibility table says `admin: true` (PlansSection; a family's
 * table never carries it). One row per pattern: each plate's state
 * (painted / failed / not painted) from GET /api/admin/plan-plates and a
 * "Paint plates" button that calls POST /api/admin/plan-plates for that
 * pattern (painted plates skipped; "Repaint all" repaints). Parent register,
 * about plates, never about a child; both languages.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { fetchPlanPlateStatus, paintPlanPlates, PlanApiError, type PlanPlateState, type PlanPlateStatus } from "../../lib/plans/planApi";
import { planString } from "../../lib/plans/planStrings";
import type { PatternDef } from "../../lib/library/plans/patterns";
import { planPlateTable } from "../../lib/library/plans/planPlates";
import type { PatternId } from "../../lib/library/types";

const CARD: React.CSSProperties = { background: "var(--arbor-paper-elevated)", borderRadius: "var(--r-lg)", boxShadow: "var(--arbor-shadow-card)" };
const QUIET: React.CSSProperties = { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" };
const BTN = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 t-sm font-semibold focus:outline-none focus-visible:ring-2 disabled:opacity-60";

const STATE_KEY: Record<PlanPlateState, "plates.painted" | "plates.failed" | "plates.unpainted"> = { painted: "plates.painted", failed: "plates.failed", unpainted: "plates.unpainted" };

export default function PlanPlatePainter({ lang, patterns }: { lang: "en" | "he"; patterns: readonly PatternDef[] }) {
  const s = (key: Parameters<typeof planString>[0], vars?: Record<string, string | number>) => planString(key, lang, vars);
  const [status, setStatus] = useState<PlanPlateStatus | null>(null);
  const [busy, setBusy] = useState<PatternId | null>(null);
  const [note, setNote] = useState<{ pattern: PatternId; text: string } | null>(null);
  const reload = useCallback(() => fetchPlanPlateStatus().then(setStatus).catch(() => setStatus(null)), []);
  useEffect(() => { void reload(); }, [reload]);

  const paint = async (pattern: PatternId, repaint: boolean) => {
    setBusy(pattern);
    setNote(null);
    try {
      const out = await paintPlanPlates({ pattern, repaint });
      if (out.run.stopped) setNote({ pattern, text: s("plates.stopped") });
      else if (out.run.failed > 0) setNote({ pattern, text: s("plates.error") });
    } catch (err) {
      setNote({ pattern, text: err instanceof PlanApiError && err.code === "plan_plates_cap" ? s("plates.cap") : s("plates.error") });
    } finally {
      setBusy(null);
      void reload();
    }
  };

  return (
    <div className="mt-5 p-4" style={CARD} data-plan-plates="" dir={lang === "he" ? "rtl" : "ltr"}>
      <p className="arbor-type-kicker" style={{ color: "var(--arbor-muted)" }}>{s("plates.title")}</p>
      <p className="mt-1 t-sm" style={{ color: "var(--arbor-ink-soft)" }}>{s("plates.body")}</p>
      {status === null && <p className="mt-2 t-sm" style={{ color: "var(--arbor-muted)" }}>{s("plates.loading")}</p>}
      {status && !status.storage && <p className="mt-2 t-sm" style={{ color: "var(--arbor-muted)" }}>{s("plates.noStorage")}</p>}
      <ul className="mt-3 flex flex-col gap-3" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {patterns.map((def) => {
          const plates = Object.keys(planPlateTable(def.id));
          const states = status?.patterns?.[def.id] ?? {};
          const painting = busy === def.id;
          return (
            <li key={def.id} data-plan-plates-pattern={def.id}>
              <b className="block t-base" style={{ color: "var(--arbor-ink)" }} dir="auto">{def.parentWords[lang]}</b>
              <ul className="mt-1 flex flex-wrap gap-1" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {plates.map((id) => {
                  const st: PlanPlateState = states[id] ?? "unpainted";
                  return (
                    <li key={id} className="rounded-full px-2 py-0.5 t-xs" style={{ background: st === "painted" ? "var(--arbor-sky-soft)" : "var(--arbor-paper-deep)", color: st === "painted" ? "var(--arbor-sky-ink)" : "var(--arbor-ink)" }} data-plan-plate={`${def.id}/${id}`} data-plate-state={st}>
                      <span className="arbor-num">{id}</span> · {s(STATE_KEY[st])}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={BTN} style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }} disabled={busy !== null || !status?.storage} data-plan-plates-paint={def.id} onClick={() => void paint(def.id, false)}>
                  <Icon name="brush" size={18} />{painting ? s("plates.painting") : s("plates.paint")}
                </button>
                <button type="button" className={BTN} style={QUIET} disabled={busy !== null || !status?.storage} data-plan-plates-repaint={def.id} onClick={() => void paint(def.id, true)}>{s("plates.repaint")}</button>
              </div>
              {note?.pattern === def.id && <p className="mt-2 t-sm" style={{ color: "var(--arbor-muted)" }} data-plan-plates-note="">{note.text}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
