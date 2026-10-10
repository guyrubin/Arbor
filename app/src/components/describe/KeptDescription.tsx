/**
 * B-SHELL-39 — "What you told me": the items the parent kept from the
 * describe readback (and the lines they typed elsewhere), in their words, on
 * My child and on What Arbor knows. Each can be edited or removed here; a
 * removal shows one receipt line with Undo. The "Tell Arbor more" door opens
 * the same surface with these items loaded. Never a verdict or a count about
 * the child — the parent's own words, grouped by what they are.
 */
import React, { useState } from "react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useProfile } from "../../context/ProfileContext";
import { useLanguage } from "../../context/LanguageContext";
import { PROFILE_KINDS, keptItemsFromProfile, planKeptEdit, planKeptRemove, type DescribePatch, type KeptDescribeItem, type ProfileKind } from "../../lib/describeChild";
import TellArborMore from "./TellArborMore";
import "./describe.css";

const KIND_KEY: Record<ProfileKind, string> = {
  strength: "elev.describe.kind.strength",
  interest: "elev.describe.kind.interest",
  worry: "elev.describe.kind.worry",
  focus: "elev.describe.kind.focus",
  preference: "elev.describe.kind.preference",
};

function KeptRow({ item, onEdit, onRemove, busy }: { item: KeptDescribeItem; onEdit: (words: string) => void; onRemove: () => void; busy: boolean }) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.words);
  return <li className="describe-item" data-testid="describe-kept-item" data-kind={item.kind}>
    {!editing && <p className="describe-words" dir="auto">{item.words}</p>}
    {editing && <div className="describe-edit">
      <input value={draft} maxLength={120} dir="auto" aria-label={t("elev.describe.edit")} onChange={(event) => setDraft(event.target.value)} autoFocus />
      <div className="describe-actions">
        <button type="button" className="describe-link" disabled={busy || !draft.trim()} onClick={() => { onEdit(draft.trim()); setEditing(false); }}>{t("elev.describe.save")}</button>
        <button type="button" className="describe-link" onClick={() => { setDraft(item.words); setEditing(false); }}>{t("elev.describe.cancel")}</button>
      </div>
    </div>}
    {!editing && <div className="describe-actions">
      <button type="button" className="describe-link" disabled={busy} onClick={() => { setDraft(item.words); setEditing(true); }}>{t("elev.describe.edit")}</button>
      <button type="button" className="describe-link" disabled={busy} onClick={onRemove} data-testid="describe-kept-remove">{t("elev.describe.remove")}</button>
    </div>}
  </li>;
}

export default function KeptDescription({ testId = "describe-kept-list" }: { testId?: string }) {
  const { childProfile } = useArbor();
  const { updateChild } = useProfile();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState<{ childId: string; previous: DescribePatch } | null>(null);
  const [failed, setFailed] = useState(false);
  const name = (childProfile.name || "").trim().split(/\s+/)[0] || childProfile.name;
  const items = keptItemsFromProfile(childProfile);
  const write = async (patch: DescribePatch): Promise<boolean> => {
    setBusy(true); setFailed(false);
    try {
      const ok = await updateChild(childProfile.id, patch);
      if (!ok) setFailed(true);
      return ok;
    } finally { setBusy(false); }
  };
  const edit = async (id: string, words: string) => {
    const plan = planKeptEdit(childProfile, id, words, new Date());
    if (plan && Object.keys(plan.patch).length) { setRemoved(null); await write(plan.patch); }
  };
  const remove = async (id: string) => {
    const plan = planKeptRemove(childProfile, id, new Date());
    if (!plan || !Object.keys(plan.patch).length) return;
    if (await write(plan.patch)) setRemoved({ childId: childProfile.id, previous: plan.previous });
  };
  const undo = async () => {
    if (!removed || removed.childId !== childProfile.id) return;
    if (await write(removed.previous)) setRemoved(null);
  };
  const receipt = removed?.childId === childProfile.id;
  return <section className="describe-kept-card" data-testid={testId} dir="auto">
    <div className="describe-kept-head">
      <div>
        <h2 className="describe-title">{t("elev.describe.kept.title")}</h2>
        <p className="describe-sub">{items.length ? t("elev.describe.kept.sub") : t("elev.describe.kept.empty", { name })}</p>
      </div>
      <button type="button" className="describe-secondary" onClick={() => setOpen(true)} data-testid="describe-door">
        <Icon name="edit_note" size={20} /><span>{t("elev.describe.door")}</span>
      </button>
    </div>
    {PROFILE_KINDS.map((kind) => {
      const group = items.filter((item) => item.kind === kind);
      if (!group.length) return null;
      return <div className="describe-group" key={kind} data-group={kind}>
        <h3>{t(KIND_KEY[kind], { name })}</h3>
        <ul>{group.map((item) => <KeptRow key={item.id} item={item} busy={busy} onEdit={(words) => void edit(item.id, words)} onRemove={() => void remove(item.id)} />)}</ul>
      </div>;
    })}
    {receipt && <p className="describe-kept-line" role="status"><span>{t("elev.describe.kept.removed")}</span>
      <button type="button" className="describe-link" disabled={busy} onClick={() => void undo()} data-testid="describe-kept-undo">{t("elev.describe.undo")}</button>
    </p>}
    {failed && <p className="describe-note" role="alert">{t("elev.describe.commitFailed")}</p>}
    {open && <TellArborMore onClose={() => setOpen(false)} />}
  </section>;
}
