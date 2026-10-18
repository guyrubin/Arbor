import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useArbor } from "../context/ArborContext";
import { useProfile } from "../context/ProfileContext";
import { auth, db, firebaseEnabled } from "../lib/firebase";
import type { BehaviorLog, Milestone } from "../types";
import type { KeepsakeDoc } from "../lib/firstsKeepsake";
import type { NoticeTarget } from "../lib/noticeNavigation";
import { resolveNoticeSources } from "../lib/noticeSources";
import { milestoneText } from "../lib/milestoneData";
import { translate } from "../lib/i18n";

// @icon-font-ignore — this read hook renders no icons; "storage" is a browser event.

type SourceCollection = "milestones" | "keepsakes" | "behaviorLogs";
interface RecordRead<T> { value: T | null; confirmed: boolean; error: boolean; loading: boolean; receipt: object; isCurrent: () => boolean }
type SavedRead<T> = { scope: string; value: T | null; confirmed: boolean; error: boolean; fingerprint: string; receipt: object };
const usableId = (id: string | undefined): id is string => !!id && id.length <= 200 && !/[\/\u0000-\u001f]/.test(id);

/** A read-only, exact-document subscription. No catalogue seeding, cache
 * fallback, collection pagination, or local mirror can certify a source. */
function useNoticeDocument<T extends { id: string }>(childId: string, name: SourceCollection, recordId?: string, retry = 0): RecordRead<T> {
  const { user } = useAuth();
  const enabled = !!user && usableId(childId) && usableId(recordId);
  const scope = JSON.stringify([user?.uid, childId, name, recordId]);
  const latest = useRef<{ scope: string; receipt: object }>({ scope, receipt: {} });
  if (latest.current.scope !== scope) latest.current = { scope, receipt: {} };
  const [read, setRead] = useState<SavedRead<T> | null>(null);
  const [, refresh] = useState(0);
  const localKey = `arbor.${name}.${childId}`;
  const localRead = (): { value: T | null; error: boolean; fingerprint: string } => {
    try {
      const rows: unknown = JSON.parse(localStorage.getItem(localKey) || "[]");
      if (!Array.isArray(rows)) throw new Error("Invalid source collection");
      const matches = rows.filter(row => row && typeof row === "object" && row.id === recordId);
      if (matches.length > 1) throw new Error("Ambiguous source identity");
      return { value: matches[0] ?? null, error: false, fingerprint: JSON.stringify(matches[0] ?? null) };
    } catch { return { value: null, error: true, fingerprint: "unavailable" }; }
  };
  const local = !firebaseEnabled && enabled ? localRead() : null;
  const localReceipt = useRef<{ scope: string; fingerprint: string; receipt: object } | null>(null);
  if (local && (localReceipt.current?.scope !== scope || localReceipt.current.fingerprint !== local.fingerprint)) {
    localReceipt.current = { scope, fingerprint: local.fingerprint, receipt: {} };
  }

  useEffect(() => {
    if (!enabled) return;
    if (!firebaseEnabled) {
      const update = (event: StorageEvent) => { if (event.key === localKey || event.key === null) refresh(value => value + 1); };
      if (typeof window === "undefined") return;
      window.addEventListener("storage", update);
      return () => { window.removeEventListener("storage", update); latest.current.receipt = {}; };
    }
    if (!db || !user) return;
    let active = true;
    const accept = (value: T | null, confirmed: boolean, error: boolean) => {
      if (!active || latest.current.scope !== scope) return;
      // The old guard retires before React paints the new snapshot.
      const receipt = {};
      latest.current.receipt = receipt;
      setRead({ scope, value, confirmed, error, receipt, fingerprint: JSON.stringify(value) });
    };
    const stop = onSnapshot(doc(db, `users/${user.uid}/children/${childId}/${name}/${recordId}`), { includeMetadataChanges: true }, snapshot => {
      accept(snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as T : null,
        !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites, false);
    }, () => accept(null, false, true));
    return () => { active = false; latest.current.receipt = {}; stop(); };
  }, [enabled, scope, user?.uid, childId, name, recordId, localKey, retry]);

  const current = read?.scope === scope ? read : null;
  const receipt = local ? localReceipt.current!.receipt : current?.receipt ?? latest.current.receipt;
  const ready = enabled && (local ? !local.error : !!current?.confirmed && !current.error);
  const isCurrent = () => {
    if (!enabled || latest.current.scope !== scope || !ready) return false;
    if (firebaseEnabled) return !!user && auth?.currentUser?.uid === user.uid && latest.current.receipt === receipt;
    const now = localRead();
    return localReceipt.current?.receipt === receipt && !now.error && now.fingerprint === local!.fingerprint;
  };
  return {
    value: enabled ? local?.value ?? current?.value ?? null : null,
    confirmed: !!ready, error: !!(local?.error || current?.error || enabled && firebaseEnabled && !db),
    loading: enabled && !local && !current, receipt, isCurrent,
  };
}

/** Current source receipt shared by Talk and Care. The existing profile
 * lifetime also fences account/child transitions before React commits them. */
export function useNoticeSource(target: NoticeTarget | null, he: boolean) {
  const { user } = useAuth();
  const { childProfile, milestones } = useArbor();
  const { captureOnboardingLifetime } = useProfile();
  const [retry, setRetry] = useState(0);
  const scope = JSON.stringify([user?.uid, childProfile.id, target?.childId, target?.milestoneId]);
  const ownerCurrent = useMemo(() => captureOnboardingLifetime(childProfile.id), [captureOnboardingLifetime, scope]);
  const validTarget = target && target.childId === childProfile.id && usableId(target.childId) && usableId(target.milestoneId) ? target : null;
  const saved = useNoticeDocument<Milestone>(validTarget?.childId ?? "", "milestones", validTarget?.milestoneId, retry);
  const kept = useNoticeDocument<KeepsakeDoc>(validTarget?.childId ?? "", "keepsakes", validTarget?.milestoneId, retry);
  const provenance = saved.value?.observationProvenance;
  const linked = useNoticeDocument<BehaviorLog>(validTarget?.childId ?? "", "behaviorLogs", provenance, retry);
  const currentMilestone = milestones.find(item => item.id === validTarget?.milestoneId) ?? null;
  const titleRecord = saved.value?.custom === true ? saved.value : currentMilestone;
  const milestone = currentMilestone ? { ...currentMilestone,
    title: milestoneText(titleRecord!, "title", (key, vars) => translate(he ? "he" : "en", key, vars), { gender: childProfile.gender ?? null }),
  } : null;
  const sources = provenance ? [saved, kept, linked] : [saved, kept];
  const ready = !!validTarget && !!user && ownerCurrent() && sources.every(source => source.confirmed && !source.error);
  const projection = resolveNoticeSources({ target: target ?? { childId: "", milestoneId: "" }, activeChildId: childProfile.id,
    milestone, savedMilestone: saved.value, keepsake: kept.value, linkedMoment: linked.value }, he);
  const metadata = JSON.stringify([scope, milestone?.title, he, ready, projection.state, retry]);
  const version = useMemo(() => ({}), [metadata, saved.receipt, kept.receipt, linked.receipt]);
  const latestVersion = useRef(version);
  latestVersion.current = version;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // Retry also rereads a same-tab edit that emits no storage event.
  const reload = useCallback(() => { setRetry(value => value + 1); }, []);
  const isCurrent = useCallback(() => mounted.current && latestVersion.current === version && ownerCurrent() && ready && projection.state === "ready"
    && sources.every(source => source.isCurrent()), [version, ownerCurrent]);
  return { ...projection, state: ready ? projection.state : sources.some(source => source.loading) ? "loading" as const : "unavailable" as const,
    sources: ready && projection.state === "ready" ? projection.sources : [], version, isCurrent, reload, retry };
}
