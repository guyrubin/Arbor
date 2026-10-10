import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import type { Milestone } from "../types";
import { keepsakeMapFromDocs, type KeepsakeDoc } from "../lib/firstsKeepsake";
import { retrySync } from "../lib/syncStore";
import { sameLocalHistoryRows } from "../lib/historyWindow";
import { keptThings, type KeptThing } from "../lib/kept/keptThings";
import type { ChildCollection } from "./useChildCollection";
import { useChildHistory } from "./useChildHistory";

/** The writer stays responsible for editing/photos. The two read-only,
 * confirmed histories own eligibility and export, once per Milestones page.
 * A note missing from history stays editable without gaining attribution or
 * Send; cached history disables export. No source is written or inferred. */
export function useMilestoneKeptNotes(childId: string, milestones: Milestone[], editor: Pick<ChildCollection<KeepsakeDoc>, "items" | "loaded" | "error" | "remote">) {
  const { user } = useAuth();
  const scope = `${user?.uid ?? "local"}:${childId}`;
  // The writer may update before either independent history listener does.
  // Bind export to the exact editor context that was paired with these rows,
  // while allowing unchanged React rerenders and repeated reviewed Send.
  const editorReceipt = JSON.stringify([scope, editor.loaded, editor.error, editor.remote, milestones, editor.items]);
  const latestEditorReceipt = useRef(editorReceipt);
  latestEditorReceipt.current = editorReceipt;
  const noticed = useChildHistory<Milestone>(childId, "milestones");
  const notes = useChildHistory<KeepsakeDoc>(childId, "keepsakes");
  // Same-tab writes do not emit storage events. Re-read the local snapshot
  // after the existing writer changes; never mark its fallback as confirmed.
  useEffect(() => {
    if (!editor.remote) { noticed.reload(); notes.reload(); }
  }, [childId, editor.remote, milestones, editor.items, noticed.reload, notes.reload]);
  const sources = [noticed, notes];
  const [changedScope, setChangedScope] = useState<string | null>(null);
  const loading = !editor.loaded || sources.some(source => source.loading);
  const error = editor.error || sources.some(source => source.error);
  const confirmed = sources.every(source => source.confirmed);
  const disabled = loading || error || !confirmed;
  const more = sources.some(source => source.more);
  const rows = new Map<string, KeptThing>();
  const liveMilestones = new Map(milestones.map(row => [row.id, row]));
  // Match the editor's last-valid-document-per-milestone rule exactly.
  // Duplicate/imported documents may disagree in provenance, text or photo;
  // an earlier eligible note must not supply Send for a different editor row.
  const editorNotes = new Map<string, KeepsakeDoc>();
  for (const note of editor.items) {
    if (keepsakeMapFromDocs([note])[note.milestoneId]) editorNotes.set(note.milestoneId, note);
  }
  const readMilestones = new Map(noticed.items.map(row => [row.id, row]));
  const same = (left: unknown, right: unknown) => !!left && !!right && sameLocalHistoryRows([left], JSON.stringify([right]));
  const matchingNotes = notes.items.filter(note => same(note, editorNotes.get(note.milestoneId)));
  const readNotes = new Map(matchingNotes.map(row => [row.id, row]));
  for (const item of keptThings({ milestones: noticed.items, keepsakes: matchingNotes }, { id: childId })) {
    // The selector identifies the eligible saved note itself. A fallback
    // milestone title must never masquerade as an excluded AI/quote note,
    // even when its words and date happen to be identical.
    if (item.kind !== "first" || !item.keepsakeId) continue;
    const note = readNotes.get(item.keepsakeId);
    if (!note || !same(readMilestones.get(note.milestoneId), liveMilestones.get(note.milestoneId))) continue;
    rows.set(note.milestoneId, item);
  }
  const reload = () => {
    if (editor.error) retrySync(); // the existing writer-listener retry seam
    sources.forEach(source => source.reload());
  };
  const beforeExport = () => {
    if (latestEditorReceipt.current === editorReceipt && !disabled && sources.every(source => source.isCurrent())) { setChangedScope(null); return true; }
    setChangedScope(scope);
    reload();
    return false;
  };
  return { scope, rows, loading, error, confirmed, disabled, more, changed: changedScope === scope, beforeExport, reload,
    loadMore: () => sources.forEach(source => source.loadMore()),
  };
}

export type MilestoneKeptHistory = ReturnType<typeof useMilestoneKeptNotes>;
