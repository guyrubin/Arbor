/**
 * B-SHELL-39 — "What you told Arbor": the items the parent kept from the
 * describe readback (and the lines they typed elsewhere), in their words, on
 * My child and on What Arbor knows. Each can be edited or removed here; a
 * removal shows one receipt line with Undo. The "Tell Arbor more" door opens
 * the same surface with these items loaded. Never a verdict or a count about
 * the child — the parent's own words, grouped by what they are.
 */
import React, { useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useProfile } from "../../context/ProfileContext";
import { useLanguage } from "../../context/LanguageContext";
import { PROFILE_KINDS, keptItemsFromProfile, planKeptEdit, planKeptRemove, type DescribePatch, type KeptDescribeItem, type ProfileKind } from "../../lib/describeChild";
import TellArborMore from "./TellArborMore";
import { MoreLink, Tile } from "../../design/primitives";
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
  // v10: one hairline row — the words, then Edit / Remove; Edit opens the field in place.
  if (!editing) return <li className="it" data-testid="describe-kept-item" data-kind={item.kind}>
    <span dir="auto">{item.words}</span>
    <button type="button" className="ed touch-target" disabled={busy} onClick={() => { setDraft(item.words); setEditing(true); }}>{t("elev.describe.edit")}</button>
    <button type="button" className="ed rm touch-target" disabled={busy} onClick={onRemove} data-testid="describe-kept-remove">{t("elev.describe.remove")}</button>
  </li>;
  return <li className="it describe-item" data-testid="describe-kept-item" data-kind={item.kind}>
    <div className="describe-edit">
      <input value={draft} maxLength={120} dir="auto" aria-label={t("elev.describe.edit")} onChange={(event) => setDraft(event.target.value)} autoFocus />
      <div className="describe-actions">
        <button type="button" className="describe-link touch-target" disabled={busy || !draft.trim()} onClick={() => { onEdit(draft.trim()); setEditing(false); }}>{t("elev.describe.save")}</button>
        <button type="button" className="describe-link touch-target" onClick={() => { setDraft(item.words); setEditing(false); }}>{t("elev.describe.cancel")}</button>
      </div>
    </div>
  </li>;
}

/** "What you told Arbor" as a v10 tile (My child › About, section 3). */
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
  return <Tile icon="edit" title={t("elev.describe.kept.title")} titleId={`${testId}-title`} className="about-told"
    link={<MoreLink onClick={() => setOpen(true)}><span data-testid="describe-door">{t("elev.describe.door")}</span></MoreLink>}>
    <div data-testid={testId} className="about-told-body">
      <p className="line1">{items.length ? t("elev.describe.kept.sub") : t("elev.describe.kept.empty", { name })}</p>
      {PROFILE_KINDS.map((kind) => {
        const group = items.filter((item) => item.kind === kind);
        if (!group.length) return null;
        return <div className="tl" key={kind} data-group={kind}>
          <h4 className="sub">{t(KIND_KEY[kind], { name })}</h4>
          <ul role="list">{group.map((item) => <KeptRow key={item.id} item={item} busy={busy} onEdit={(words) => void edit(item.id, words)} onRemove={() => void remove(item.id)} />)}</ul>
        </div>;
      })}
      {receipt && <p className="describe-kept-line" role="status"><span>{t("elev.describe.kept.removed")}</span>
        <button type="button" className="describe-link touch-target" disabled={busy} onClick={() => void undo()} data-testid="describe-kept-undo">{t("elev.describe.undo")}</button>
      </p>}
      {failed && <p className="describe-note" role="alert">{t("elev.describe.commitFailed")}</p>}
      {open && <TellArborMore onClose={() => setOpen(false)} />}
    </div>
  </Tile>;
}
