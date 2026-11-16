import React from "react";
import type { Composition } from "../../design/useComposition";
import { Fig, MoreLink, PencilChip, Tile, Token } from "../../design/primitives";
import { Icon } from "../ui/Icon";
import { stateOf, type FamilyPlanDate } from "../../lib/familyPlan/model";
import { standing } from "../../lib/familyPlan/week";
import type { FamilyPlanApi } from "../../hooks/useFamilyPlan";
import type { FamilyPlanCopy } from "./familyPlanCopy";
import { ThreadLine } from "./ReviewSheet";
import { adultLabel, dayNum, daysFrom, momentLabel, whenLabel, type Lang } from "./format";

type Common = { plan: FamilyPlanApi; lang: Lang; c: FamilyPlanCopy; onOpen: (id: string) => void };

const tokState = (d: FamilyPlanDate) => (stateOf(d) === "has" ? "solid" : stateOf(d) === "asked" ? "open" : "none") as "solid" | "open" | "none";

/* ── 2 · The dates ─────────────────────────────────────────────────────────── */

export function DateCards({ plan, lang, c, onOpen }: Common) {
  const upcoming = plan.dates.filter((d) => d.status === "open" && d.date >= plan.window.today);
  const list = (upcoming.length ? upcoming : plan.dates).slice(0, 6);
  const reminderFor = new Map(plan.reminders.map((r) => [r.dateId, r] as const));
  if (!list.length) return <p className="small" style={{ padding: "4px 2px" }}>{c.stopSub.dates(0)}</p>;
  return (
    <>
      {list.map((d) => {
        const s = stateOf(d);
        const who = s === "has" ? (d.holder?.uid === plan.me.uid ? c.stateHasYou : c.stateHas(adultLabel(d.holder, plan.me.uid, c))) : s === "asked" && d.request ? c.stateAsked(adultLabel({ uid: d.request.toUid, email: d.request.toEmail }, plan.me.uid, c)) : c.stateNone;
        const days = daysFrom(plan.window.today, d.date);
        const rel = d.status === "done" ? c.done : days === 0 ? c.today : days === 1 ? c.tomorrow : days > 1 ? c.inDays(days) : "";
        const r = reminderFor.get(d.id);
        const last = d.previous?.[d.previous.length - 1];
        return (
          <button key={d.id} type="button" className={`nx-co${s === "asked" ? " pencil" : ""}`} onClick={() => onOpen(d.id)} data-testid="family-plan-date">
            <span className="cp"><Token kind="date" state={tokState(d)} size="xl" label={c.tokenLabel(d.title, who)}>{dayNum(d.date)}</Token></span>
            <span className="ct">
              <b dir="auto">{d.title} · {who}</b>
              <span>
                {d.kind === "deadline" ? c.dueOn(whenLabel(d, lang)) : whenLabel(d, lang)}
                {last ? ` (${c.wasTime(whenLabel(last, lang))})` : ""}
                {rel ? `. ${rel}.` : "."}
                {r && r.status === "queued" ? ` ${c.reminderQueued(momentLabel(r.atMs, lang))}` : ""}
              </span>
              {s === "asked" && d.request && <span className="small">{c.askedAt(adultLabel({ uid: d.request.toUid, email: d.request.toEmail }, plan.me.uid, c), momentLabel(d.request.askedAt, lang))} {c.noAnswer}</span>}
            </span>
            <span className="cc" aria-hidden="true"><Icon name="chevron_right" size={18} className="rtl:-scale-x-100" /></span>
          </button>
        );
      })}
    </>
  );
}

/* ── 3 · What came in ──────────────────────────────────────────────────────── */

function latestMessage(all: FamilyPlanDate[]) {
  const fromMessages = all.filter((d) => d.origin === "message" && d.messageId && d.status !== "cancelled");
  const groups = new Map<string, FamilyPlanDate[]>();
  for (const d of fromMessages) groups.set(d.messageId!, [...(groups.get(d.messageId!) ?? []), d]);
  const latest = [...groups.values()].sort((a, b) => b[0].createdAt.localeCompare(a[0].createdAt))[0] ?? [];
  return { messages: groups.size, dates: fromMessages.length, latest };
}

export function MessageTile({ plan, lang, c, onOpen }: Common) {
  const m = latestMessage(plan.all);
  return (
    <Tile icon="description" kind="date" title={c.theMessage} titleId="fp-msg-h">
      {m.messages ? (
        <>
          <div className="line" style={{ gap: 22, alignItems: "center", padding: "6px 0 2px 6px" }}>
            <span className="nx-paper" aria-hidden="true">
              <i className="s" /><i />
              {m.latest.slice(0, 3).map((_, i) => <i key={i} className="hi"><b>{i + 1}</b></i>)}
              <i />
            </span>
            <Fig size="md" n={m.dates} unit={c.figDates(m.dates)} sub={c.messagesKept(m.dates, m.messages)} />
          </div>
          <ol className="fp-lines" aria-label={c.theMessage}>
            {m.latest.map((d, i) => (
              <li key={d.id}>
                <button type="button" className="nx-found" style={{ width: "100%", textAlign: "start", font: "inherit", cursor: "pointer", minHeight: 44 }} onClick={() => onOpen(d.id)}>
                  <span className="nx-n" aria-hidden="true">{i + 1}</span>
                  <span><b dir="auto">{d.title}</b>{whenLabel(d, lang)}</span>
                </button>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="small">{c.noMessage}</p>
      )}
    </Tile>
  );
}

/** The latest applied change this week: old day/time struck through, the new one, the line it came from. */
export function ChangeTile({ plan, lang, c, onOpen }: Common) {
  const changed = plan.dates.filter((d) => d.previous && d.previous.length).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!changed) return null;
  const last = changed.previous![changed.previous!.length - 1];
  const sameDay = last.date === changed.date;
  return (
    <Tile icon="history" kind="date" title={c.reviewChange} titleId="fp-chg-h">
      <div className="draft" style={{ gap: 8 }}>
        <PencilChip>{c.versionLabel(changed.version)}</PencilChip>
        <span className="nx-chg">
          <s>{sameDay && last.time ? last.time : whenLabel(last, lang)}</s>
          <Icon name="arrow_forward" size={22} className="rtl:-scale-x-100" />
          <b>{sameDay && changed.time ? changed.time : whenLabel(changed, lang)}</b>
        </span>
        <b dir="auto" style={{ fontSize: 14, fontWeight: 600 }}>{changed.title}, {whenLabel(changed, lang)}</b>
        {changed.sourceLine && <ThreadLine line={changed.sourceLine} quote={changed.sourceLine} />}
      </div>
      <MoreLink onClick={() => onOpen(changed.id)}>{c.openDate}</MoreLink>
    </Tile>
  );
}

export function RequestsTile({ plan, lang, c, onOpen }: Common) {
  const requests = plan.openRequests;
  const queued = plan.reminders;
  const forWhom = (uid: string | null) => (uid ? (uid === plan.me.uid ? c.forYou : c.forAdult(adultLabel(plan.roster.adults.find((a) => a.uid === uid) ?? { uid, email: null }, plan.me.uid, c))) : c.forYou);
  return (
    <Tile icon="notifications" kind="date" title={c.requestsReminders} titleId="fp-req-h">
      {(requests.length > 0 || queued.length > 0) && (
        <div className="line" style={{ gap: 24, alignItems: "flex-end", flexWrap: "wrap" }}>
          {requests.length > 0 && <Fig size="md" n={requests.length} unit={c.figRequests(requests.length)} />}
          {queued.length > 0 && <Fig size="md" n={queued.length} unit={c.figReminders(queued.length)} />}
        </div>
      )}
      {requests.length === 0 && queued.length === 0 ? (
        <p className="small">{c.noReminders}</p>
      ) : (
        <ul className="nx-arows">
          {requests.map((d) => (
            <li key={`r-${d.id}`}>
              <b>{c.asked}</b>
              <button type="button" className="ds-link" style={{ justifyContent: "flex-start", minHeight: 44, padding: 0, textAlign: "start" }} onClick={() => onOpen(d.id)}>
                <bdi>{c.requestSent(adultLabel({ uid: d.request!.toUid, email: d.request!.toEmail }, plan.me.uid, c), momentLabel(d.request!.askedAt, lang))} · {d.title}</bdi>
              </button>
            </li>
          ))}
          {queued.slice(0, 6).map((r) => (
            <li key={r.id}>
              <b>{r.status === "due" ? c.today : momentLabel(r.atMs, lang).split(",")[0]}</b>
              <button type="button" className="ds-link" style={{ justifyContent: "flex-start", minHeight: 44, padding: 0, textAlign: "start" }} onClick={() => onOpen(r.dateId)}>
                <bdi>{r.status === "due" ? c.reminderDue(r.item.title) : c.reminderLine(r.item.title, momentLabel(r.atMs, lang))} · {forWhom(r.forUid)}</bdi>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="small">{c.inAppOnly}</p>
    </Tile>
  );
}

/* ── 4 · Where each thing stands ───────────────────────────────────────────── */

export function StandingTile({ plan, lang, c, onOpen, composition }: Common & { composition: Composition }) {
  const s = standing(plan.dates);
  const col = (items: FamilyPlanDate[], none: string, words: (d: FamilyPlanDate) => string) => (
    <>
      <span className="here">
        {items.slice(0, 6).map((d) => (
          <button key={d.id} type="button" className="fp-tok" style={{ background: "none", border: 0, padding: 2, minWidth: 44, minHeight: 44, cursor: "pointer" }} onClick={() => onOpen(d.id)} aria-label={c.tokenLabel(d.title, words(d))}>
            <Token kind="date" state={tokState(d)} label={c.tokenLabel(d.title, whenLabel(d, lang))}>{dayNum(d.date)}</Token>
          </button>
        ))}
      </span>
      <span>{items.length ? items.map((d) => d.title).slice(0, 3).join(", ") : none}</span>
    </>
  );
  return (
    <Tile icon="task_alt" kind="date" title={c.standingTile} titleId="fp-yes-h" style={{ gridColumn: composition === "desk" ? "span 12" : undefined }}>
      <div className={`nx-yes ${s.done.length ? "s2" : s.accepted.length ? "" : "s0"}`} style={{ marginTop: 6 }}>
        <div className="stp">
          <span className={`nd${s.asked.length ? " on" : " off"}`} aria-hidden="true"><Icon name="upload" size={22} /></span>
          <b>{c.asked}</b>
          {col(s.asked, c.askedNone, (d) => c.stateAsked(adultLabel({ uid: d.request!.toUid, email: d.request!.toEmail }, plan.me.uid, c)))}
        </div>
        <div className="stp">
          <span className={`nd${s.accepted.length ? " on" : " off"}`} aria-hidden="true"><Icon name="check" size={22} /></span>
          <b>{c.accepted}</b>
          {col(s.accepted, c.acceptedNone, (d) => (d.holder?.uid === plan.me.uid ? c.stateHasYou : c.stateHas(adultLabel(d.holder, plan.me.uid, c))))}
        </div>
        <div className="stp">
          <span className={`nd${s.done.length ? " on" : " off"}`} aria-hidden="true"><Icon name="flag" size={22} /></span>
          <b>{c.done}</b>
          {col(s.done, c.doneNone, () => c.done)}
        </div>
      </div>
    </Tile>
  );
}
