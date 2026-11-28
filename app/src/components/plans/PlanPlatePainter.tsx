/**
 * PlanPlatePainter — B-BOOK-75 (plates painted in-product): the owner-only
 * control under the parent's "Everyday plans" section. Renders ONLY when the
 * server's visibility table says `admin: true` (PlansSection; a family's
 * table never carries it). One row per pattern: each plate's state
 * (painted / failed / not painted) from GET /api/admin/plan-plates and a
 * "Paint plates" button that calls POST /api/admin/plan-plates for that
 * pattern (painted plates skipped; "Repaint all" repaints). Parent register,
 * about plates, never about a child; both languages.
 *
 * B-BOOK-27 — the review step. Families are served a painted plate only once
 * a person has viewed it full size and recorded that it shows no child or
 * person and no words (server/planPlates: the read route fails closed). Each
 * painted plate shows its review: "not reviewed — families do not see it",
 * "reviewed by <email> on <time>", or what the reviewer found (a child or
 * person, words). "Mark reviewed" opens the painted master full size (the
 * painter-only image route) with two boxes to tick ONLY for what was seen,
 * then "Save review" (POST /api/admin/plan-plates/review). Both ticked = the
 * plate reaches families on their next read; anything else is recorded and
 * the plate stays hidden. A repaint clears the review. A refusal is shown as
 * it is (lib/plans/plateReview).
 */
import React, { useCallback, useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { fetchPlanPlateStatus, paintPlanPlates, PlanApiError, type PlanPlateReview, type PlanPlateState, type PlanPlateStatus } from "../../lib/plans/planApi";
import { loadAdminPlateImage, reviewLabel, submitPlateReview } from "../../lib/plans/plateReview";
import { planString } from "../../lib/plans/planStrings";
import type { PatternDef } from "../../lib/library/plans/patterns";
import { planPlateTable } from "../../lib/library/plans/planPlates";
import type { PatternId } from "../../lib/library/types";

const CARD: React.CSSProperties = { background: "var(--arbor-paper-elevated)", borderRadius: "var(--r-lg)", boxShadow: "var(--arbor-shadow-card)" };
const QUIET: React.CSSProperties = { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" };
const BTN = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 t-sm font-semibold focus:outline-none focus-visible:ring-2 disabled:opacity-60";

const STATE_KEY: Record<PlanPlateState, "plates.painted" | "plates.failed" | "plates.unpainted"> = { painted: "plates.painted", failed: "plates.failed", unpainted: "plates.unpainted" };

export interface PlateConfirm {
  pattern: PatternId;
  plate: string;
  childFree: boolean;
  textFree: boolean;
  image: string | null;
}

export default function PlanPlatePainter({ lang, patterns, initialStatus = null, initialConfirm = null }: { lang: "en" | "he"; patterns: readonly PatternDef[]; initialStatus?: PlanPlateStatus | null; initialConfirm?: PlateConfirm | null }) {
  const s = (key: Parameters<typeof planString>[0], vars?: Record<string, string | number>) => planString(key, lang, vars);
  const [status, setStatus] = useState<PlanPlateStatus | null>(initialStatus);
  const [busy, setBusy] = useState<PatternId | null>(null);
  const [note, setNote] = useState<{ pattern: PatternId; text: string } | null>(null);
  const [confirm, setConfirm] = useState<PlateConfirm | null>(initialConfirm);
  const [saving, setSaving] = useState(false);
  const [reviewNote, setReviewNote] = useState<{ key: string; text: string } | null>(null);
  const reload = useCallback(() => fetchPlanPlateStatus().then(setStatus).catch(() => setStatus(null)), []);
  useEffect(() => { void reload(); }, [reload]);

  const openReview = (pattern: PatternId, plate: string) => {
    setReviewNote(null);
    setConfirm({ pattern, plate, childFree: false, textFree: false, image: null });
    void loadAdminPlateImage(pattern, plate).then((image) => setConfirm((c) => (c && c.pattern === pattern && c.plate === plate ? { ...c, image } : c)));
  };
  const closeReview = () => {
    if (confirm?.image) URL.revokeObjectURL(confirm.image);
    setConfirm(null);
  };
  const saveReview = async () => {
    if (!confirm) return;
    const { pattern, plate, childFree, textFree } = confirm;
    setSaving(true);
    const out = await submitPlateReview({ pattern, plate, childFree, textFree });
    setSaving(false);
    if ("note" in out) { setReviewNote({ key: `${pattern}/${plate}`, text: s(out.note) }); return; }
    closeReview();
    // show the saved review at once, then read the server's record
    setStatus((st) => (st ? { ...st, reviews: { ...(st.reviews ?? {}), [pattern]: { ...(st.reviews?.[pattern] ?? {}), [plate]: { ...out.review, reviewedAt: new Date().toISOString() } } } } : st));
    void reload();
  };

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
          const reviews: Record<string, PlanPlateReview> = status?.reviews?.[def.id] ?? {};
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
              {plates.some((id) => states[id] === "painted") && (
                <ul className="mt-2 flex flex-col gap-1" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {plates.filter((id) => states[id] === "painted").map((id) => {
                    const review = reviews[id];
                    const label = reviewLabel(review);
                    const key = `${def.id}/${id}`;
                    const open = confirm?.pattern === def.id && confirm.plate === id;
                    return (
                      <li key={id} data-plan-plate-review={key} data-review-state={review?.state ?? "unreviewed"}>
                        <div className="flex flex-wrap items-center gap-2 t-sm" style={{ color: "var(--arbor-ink-soft)" }}>
                          <span className="arbor-num" style={{ color: "var(--arbor-ink)" }}>{id}</span>
                          <span dir="auto">{s(label.key, label.vars)}</span>
                          {!open && (
                            <button type="button" className={BTN} style={QUIET} disabled={busy !== null || saving || confirm !== null} data-plan-plate-review-open={key} onClick={() => openReview(def.id, id)}>{s("plates.review.open")}</button>
                          )}
                        </div>
                        {open && confirm && (
                          <div className="mt-2 p-3" style={{ ...QUIET, borderRadius: "var(--r-md)" }} data-plan-plate-review-panel={key}>
                            <p className="t-sm">{s("plates.review.title", { plate: id })}</p>
                            {confirm.image && <img src={confirm.image} alt={id} className="mt-2" style={{ width: "100%", height: "auto", borderRadius: "var(--r-md)" }} data-plan-plate-review-image="" />}
                            <label className="mt-2 flex items-start gap-2 t-sm">
                              <input type="checkbox" checked={confirm.childFree} data-plan-plate-review-childfree="" onChange={(e) => setConfirm({ ...confirm, childFree: e.currentTarget.checked })} />
                              <span>{s("plates.review.childFree")}</span>
                            </label>
                            <label className="mt-1 flex items-start gap-2 t-sm">
                              <input type="checkbox" checked={confirm.textFree} data-plan-plate-review-textfree="" onChange={(e) => setConfirm({ ...confirm, textFree: e.currentTarget.checked })} />
                              <span>{s("plates.review.textFree")}</span>
                            </label>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button type="button" className={BTN} style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }} disabled={saving || !confirm.image} data-plan-plate-review-save={key} onClick={() => void saveReview()}>{saving ? s("plates.review.saving") : s("plates.review.save")}</button>
                              <button type="button" className={BTN} style={QUIET} disabled={saving} data-plan-plate-review-cancel={key} onClick={closeReview}>{s("plates.review.cancel")}</button>
                            </div>
                            {reviewNote?.key === key && <p className="mt-2 t-sm" style={{ color: "var(--arbor-muted)" }} data-plan-plate-review-note="">{reviewNote.text}</p>}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
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
