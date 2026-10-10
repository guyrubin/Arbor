/**
 * B-SHELL-39 — the readback: "Here's what you told me about {name}".
 *
 * Every row is the parent's words with the span they said ("You said: …").
 * Keep is on by default; Edit and Remove act on the row; a replace reads
 * "Replace '…' with '…'?". It follows the conversation (DescribeThread) and
 * holds the items drafted from every answer. The EU AI Act Art. 50 line says
 * the AI drafted it. ONE "Keep these" writes only the kept rows — nothing is
 * written before it — and Undo stays for 10 s. No row, label or chip renders
 * a verdict, a score or Arbor's reading of the child.
 */
import React, { useEffect, useState, useSyncExternalStore } from "react";
import Icon from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import {
  MAX_FOCUS_AREAS,
  MAX_PARENT_PREFERENCES,
  READBACK_GROUPS,
  groupOf,
  keptItemsFromProfile,
  readbackWords,
  type DescribeSession,
  type ReadbackGroup,
  type ReadbackItem,
} from "../../lib/describeChild";
import type { ChildProfile } from "../../types";
import "./describe.css";

const GROUP_KEY: Record<ReadbackGroup, string> = {
  about: "elev.describe.group.about",
  hard: "elev.describe.group.hard",
  focus: "elev.describe.group.focus",
  help: "elev.describe.group.help",
  milestones: "elev.describe.group.milestones",
};

function ItemRow({ item, session, kept, milestoneTitle, disabled }: {
  item: ReadbackItem; session: DescribeSession; kept: ReturnType<typeof keptItemsFromProfile>;
  milestoneTitle?: (id: string) => string | undefined; disabled: boolean;
}) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(readbackWords(item));
  const words = readbackWords(item);
  const target = item.itemId ? kept.find((k) => k.id === item.itemId) : undefined;
  const label = item.op === "replace" && target ? t("elev.describe.replace", { old: target.words, new: words })
    : item.op === "remove" && target ? t("elev.describe.removeKept", { old: target.words })
    : words;
  const title = item.milestoneId && !item.milestoneDeclined ? milestoneTitle?.(item.milestoneId) ?? item.milestoneTitle : undefined;
  return <li className="describe-item" data-kind={item.kind} data-op={item.op} data-testid="describe-item">
    {!editing && <label className="describe-keep">
      <input type="checkbox" checked={item.keep} disabled={disabled} onChange={() => session.toggle(item.id)} aria-describedby={`${item.id}-said`} />
      <span className="describe-words" dir="auto">{label}</span>
    </label>}
    {editing && <div className="describe-edit">
      <input value={draft} maxLength={120} dir="auto" aria-label={t("elev.describe.edit")} onChange={(event) => setDraft(event.target.value)} autoFocus />
      <div className="describe-actions">
        <button type="button" className="describe-link" onClick={() => { if (draft.trim()) session.edit(item.id, draft.trim()); setEditing(false); }}>{t("elev.describe.save")}</button>
        <button type="button" className="describe-link" onClick={() => { setDraft(words); setEditing(false); }}>{t("elev.describe.cancel")}</button>
      </div>
    </div>}
    <p id={`${item.id}-said`} className="describe-said" dir="auto">
      {item.parentReported && <span className="describe-tag">{t("elev.describe.yourWords")}</span>}
      {t("elev.describe.youSaid", { quote: item.quote })}
    </p>
    {title && <p className="describe-milestone">
      <Icon name="flag" size={16} /><span dir="auto">{t("elev.describe.milestone", { title })}</span>
      <button type="button" className="describe-link" disabled={disabled} onClick={() => session.declineMilestone(item.id)}>{t("elev.describe.notThis")}</button>
    </p>}
    {!editing && item.op !== "remove" && <div className="describe-actions">
      <button type="button" className="describe-link" disabled={disabled} onClick={() => { setDraft(words); setEditing(true); }}>{t("elev.describe.edit")}</button>
      <button type="button" className="describe-link" disabled={disabled} onClick={() => session.remove(item.id)}>{t("elev.describe.remove")}</button>
    </div>}
  </li>;
}

export interface DescribeReadbackProps {
  name: string;
  lang?: "en" | "he";
  session: DescribeSession;
  /** The child doc now (for "Replace '…'" and the Focus / preference caps). */
  profile: Partial<ChildProfile> | null;
  milestoneTitle?: (id: string) => string | undefined;
}

export default function DescribeReadback({ name, session, profile, milestoneTitle }: DescribeReadbackProps) {
  const { t } = useLanguage();
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (state.status !== "kept" || !state.undoUntil) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state.status, state.undoUntil]);
  const kept = keptItemsFromProfile(profile);
  const busy = state.status === "committing";
  const done = state.status === "kept";
  const plan = state.status === "ready" ? session.preview() : null;
  const keepCount = plan?.kept ?? 0;
  const focusKept = kept.filter((k) => k.kind === "focus").length;
  const wishesKept = kept.filter((k) => k.kind === "preference").length;
  const keptFocus = state.items.filter((i) => i.keep && i.kind === "focus" && i.op !== "remove").length;
  const keptWishes = state.items.filter((i) => i.keep && i.kind === "preference" && i.op !== "remove").length;
  if (done) {
    const canUndo = now < state.undoUntil;
    return <section className="describe-readback" data-testid="describe-kept" aria-live="polite">
      <p className="describe-kept-line" role="status"><Icon name="check_circle" size={20} /><span>{t("elev.describe.keptLine", { name })}</span>
        {canUndo && <button type="button" className="describe-link" onClick={() => void session.undo()} data-testid="describe-undo">{t("elev.describe.undo")}</button>}
      </p>
    </section>;
  }
  return <section className="describe-readback" data-testid="describe-readback" aria-labelledby="describe-readback-title">
    <h2 id="describe-readback-title" className="describe-title">{t("elev.describe.readback.title", { name })}</h2>
    <p className="describe-sub">{t("elev.describe.readback.sub")}</p>
    {READBACK_GROUPS.map((group) => {
      const items = state.items.filter((item) => groupOf(item.kind) === group);
      if (!items.length) return null;
      return <div className="describe-group" key={group} data-group={group}>
        <h3>{t(GROUP_KEY[group], { name })}</h3>
        <ul>{items.map((item) => <ItemRow key={item.id} item={item} session={session} kept={kept} milestoneTitle={milestoneTitle} disabled={busy} />)}</ul>
        {group === "focus" && focusKept + keptFocus > MAX_FOCUS_AREAS && <p className="describe-note">{t("elev.describe.focusFull")}</p>}
        {group === "help" && wishesKept + keptWishes > MAX_PARENT_PREFERENCES && <p className="describe-note">{t("elev.describe.wishesFull")}</p>}
      </div>;
    })}
    {!state.items.length && <p className="describe-note" role="status">{t("elev.describe.nothingToKeep")}</p>}
    {state.error === "keepFailed" && <p className="describe-note" role="alert">{t("elev.describe.commitFailed")}</p>}
    <p className="describe-ai-line" data-testid="describe-ai-line"><Icon name="info" size={16} /><span>{t("elev.describe.aiLine")}</span></p>
    <button type="button" className="describe-keep-these" disabled={busy || keepCount === 0} onClick={() => void session.keep()} data-testid="describe-keep-these">
      {busy ? t("elev.describe.saving") : keepCount ? t("elev.describe.keepCount", { n: keepCount }) : t("elev.describe.keepThese")}
    </button>
  </section>;
}
