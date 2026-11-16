import React, { useCallback, useEffect, useRef, useState } from "react";
import { coParentApi, CoParentError } from "../../lib/coParentApi";
import type { CoParentFamilyPlan as Plan, CoParentPlanDate } from "../../lib/familyPlan/coParentView";
import type { FamilyPlanDate } from "../../lib/familyPlan/model";
import { familyPlanToIcs } from "../../lib/familyPlan/ics";
import { defaultIcsEgressDeps, saveIcsFile } from "../../lib/careTrack";
import { track } from "../../lib/analytics";
import { DsRoot, Token } from "../../design/primitives";
import { familyPlanCopy } from "./familyPlanCopy";
import { ThreadLine } from "./ReviewSheet";
import { dayNum, momentLabel, weekdayShort, whenLabel, type Lang } from "./format";
import "./familyPlan.css";

/** A calendar file from the co-parent's view of one date (name and time only). */
const asIcsRow = (d: CoParentPlanDate): FamilyPlanDate => ({
  id: d.id, kind: d.kind, title: d.title, date: d.date, ...(d.time ? { time: d.time } : {}), origin: "manual", version: d.version,
  status: "open", history: [], createdBy: "", createdAt: "", updatedAt: "",
});

/**
 * Family plan v1 — what a co-parent who joined the family sees in their
 * workspace (sharing/CoParentGate): the requests addressed to them, each with
 * the asker's note and the message line, answered yes / not this one for the
 * version asked; the dates they have, which they mark done; and the rest of
 * the week's dates. Everything goes through the server on the live grant.
 */
export default function CoParentFamilyPlan({ grantId, lang }: { grantId: string; lang: Lang }) {
  const c = familyPlanCopy[lang];
  const [plan, setPlan] = useState<Plan | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: string; text: string; error?: boolean } | null>(null);
  const [calendar, setCalendar] = useState(true);
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  const load = useCallback(async () => {
    try {
      const next = await coParentApi.familyPlan(grantId);
      if (live.current) { setPlan(next); setState("ready"); }
    } catch {
      if (live.current) setState("unavailable");
    }
  }, [grantId]);
  useEffect(() => { void load(); }, [load]);

  const replace = (row: CoParentPlanDate) => setPlan((p) => p && { ...p, dates: p.dates.map((d) => (d.id === row.id ? row : d)) });

  const answer = async (d: CoParentPlanDate, a: "yes" | "no") => {
    setBusy(d.id); setNotice(null);
    try {
      const row = await coParentApi.answerFamilyPlan(grantId, d.id, a, d.version);
      replace(row);
      track("family_plan_answered", { answer: a });
      setNotice({ id: d.id, text: a === "yes" ? c.coYouHaveIt : c.coCant });
      if (a === "yes" && calendar) {
        const file = familyPlanToIcs([asIcsRow(row)], Date.now());
        if (file) await saveIcsFile(file, defaultIcsEgressDeps());
      }
    } catch (e) {
      if (e instanceof CoParentError && e.code === "date_changed") { setNotice({ id: d.id, text: c.coChanged }); await load(); }
      else setNotice({ id: d.id, text: c.coError, error: true });
    } finally { setBusy(null); }
  };

  const done = async (d: CoParentPlanDate) => {
    setBusy(d.id); setNotice(null);
    try {
      replace(await coParentApi.doneFamilyPlan(grantId, d.id));
      track("family_plan_done", { by_role: "co_parent" });
      setNotice({ id: d.id, text: c.coDoneSaved });
    } catch { setNotice({ id: d.id, text: c.coError, error: true }); }
    finally { setBusy(null); }
  };

  if (state === "loading") return <p role="status" className="text-sm">{c.loading}</p>;
  if (state === "unavailable" || !plan) return <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>{c.coUnavailable}</p>;
  const forYou = plan.dates.filter((d) => d.status === "open" && d.request?.forYou && d.request.status === "asked");
  const yours = plan.dates.filter((d) => d.holderIsYou && d.status !== "cancelled");
  const others = plan.dates.filter((d) => !forYou.includes(d) && !yours.includes(d));
  const who = plan.ownerEmail ? plan.ownerEmail.split("@")[0] : c.coParent;

  return (
    <DsRoot className="fp" data-testid="coparent-family-plan">
      <section className="fp-col" style={{ gap: 12 }} aria-labelledby="cp-fp-h">
        <h2 className="title" id="cp-fp-h">{c.coTitle}</h2>
        {forYou.length === 0 && <p className="small">{c.coNoRequests}</p>}
        {forYou.map((d) => (
          <article key={d.id} className="scene plan" style={{ padding: 16, gap: 12 }} aria-labelledby={`cp-${d.id}`}>
            <span className="kicker"><bdi>{c.coAsksYou(who)}</bdi></span>
            <div className="line" style={{ gap: 14, alignItems: "center" }}>
              <div className="fp-big" aria-hidden="true"><small>{weekdayShort(d.date, lang)}</small><b>{dayNum(d.date)}</b>{d.time && <span>{d.time}</span>}</div>
              <div className="fp-col" style={{ gap: 4, minWidth: 0 }}>
                <b id={`cp-${d.id}`} dir="auto" style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 19, lineHeight: 1.2 }}>{d.title}</b>
                <span className="small">{c.kinds[d.kind]} · {whenLabel(d, lang)}</span>
                {d.previous.length > 0 && <span className="small">{c.wasTime(whenLabel(d.previous[d.previous.length - 1], lang))}</span>}
              </div>
            </div>
            {d.request?.note && (
              <div className="fp-thread" style={{ boxShadow: "inset 0 0 0 2px var(--ink)" }}>
                <span className="av sm" aria-hidden="true">{who[0]?.toUpperCase()}</span>
                <span><span className="small"><bdi>{who}</bdi> · {momentLabel(d.request.askedAt, lang)}</span><q dir="auto" style={{ display: "block" }}>{d.request.note}</q></span>
              </div>
            )}
            {d.sourceLine && <ThreadLine line={d.sourceLine} quote={d.sourceLine} />}
            <div className="fp-actions">
              <button type="button" className="btn primary grow" disabled={busy === d.id} onClick={() => void answer(d, "yes")}>{c.coTakeIt}</button>
              <button type="button" className="btn ghost" disabled={busy === d.id} onClick={() => void answer(d, "no")}>{c.coCant}</button>
            </div>
            <label className="fp-check"><input type="checkbox" checked={calendar} onChange={(e) => setCalendar(e.target.checked)} />{c.coAddCalendar}</label>
            <p className="small">{c.coYesFor(d.version)} {c.coYesMeans}</p>
            {notice?.id === d.id && <p role={notice.error ? "alert" : "status"} className={notice.error ? "fp-err" : "small"}>{notice.text}</p>}
          </article>
        ))}
        {(yours.length > 0 || others.length > 0) && <h3 className="h3">{c.coPlanTitle}</h3>}
        {[...yours, ...others].map((d) => (
          <div key={d.id} className="nx-co" style={{ cursor: "default" }}>
            <span className="cp"><Token kind="date" state={d.state === "has" ? "solid" : d.state === "asked" ? "open" : "none"} size="lg" label={`${d.title}, ${whenLabel(d, lang)}`}>{dayNum(d.date)}</Token></span>
            <span className="ct">
              <b dir="auto">{d.title}</b>
              <span>{whenLabel(d, lang)} · {d.status === "done" ? c.done : d.holderIsYou ? c.coYouHaveIt : d.state === "has" ? c.stateHas(d.holderEmail?.split("@")[0] ?? c.coParent) : c.stateNone}</span>
              {notice?.id === d.id && <span role={notice.error ? "alert" : "status"} className={notice.error ? "fp-err" : "small"}>{notice.text}</span>}
            </span>
            {d.holderIsYou && d.status === "open" ? (
              <button type="button" className="btn ghost sm" disabled={busy === d.id} onClick={() => void done(d)}>{c.coMarkDone}</button>
            ) : <span />}
          </div>
        ))}
      </section>
    </DsRoot>
  );
}
