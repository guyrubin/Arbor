import { useEffect, useRef, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { answeredToday, fromRecordRowId, selectFromRecord, type FromRecordAnswer, type FromRecordOpener } from "../../lib/today/fromRecord";
import type { ActionLoopEntry } from "../../actionLoop/model";

type Attempt = { scope: object; opener: FromRecordOpener; saving: boolean; error: boolean; receipt: ActionLoopEntry | null };

/** Reads only saved record text. A write holds its opener until acknowledged
 * or retried; child/day changes retire all stale callbacks synchronously. */
export function useNowRecord(now: Date) {
  const { childProfile, actionPlans, behaviorLogs, approvedMemoryItems, actionLoop, recordFromRecordAnswer, recordAnswerWrites, recordAnswersConfirmed } = useArbor();
  const scope = fromRecordRowId(childProfile.id, now);
  const current = useRef({ key: scope });
  if (current.current.key !== scope) current.current = { key: scope };
  const lease = current.current;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const lock = useRef<object | null>(null);
  const settled = useRef<object | null>(null);
  const ownAttempt = attempt?.scope === lease ? attempt : null;
  const dailyWrite = recordAnswerWrites?.[scope];
  const saidOwnsRow = dailyWrite?.opener.kind === "said";
  const shared = saidOwnsRow ? undefined : dailyWrite;
  const pending = shared?.status === "saving" || shared?.status === "failed";
  const saved = answeredToday(actionLoop, childProfile.id, now);
  // Say-back owns its existing disclosure, including pending/error states.
  const selected = !saved && !saidOwnsRow ? selectFromRecord({ now, plans: actionPlans, logs: behaviorLogs, facts: approvedMemoryItems, loop: actionLoop }) : null;
  const confirming = !saidOwnsRow && !!(selected || saved?.reflection) && recordAnswersConfirmed === false && !shared;
  const receipt = saidOwnsRow || pending || confirming ? null : ownAttempt ? ownAttempt.receipt : shared?.entry?.reflection ? shared.entry : saved?.reflection ? saved : null;
  const opener = saidOwnsRow ? null : ownAttempt?.opener ?? (pending ? shared.opener : selected);
  const saving = !saidOwnsRow && (confirming || (ownAttempt?.saving ?? false) || shared?.status === "saving");
  const error = !saidOwnsRow && ((ownAttempt?.error ?? false) || shared?.status === "failed");
  const answer = async (value: FromRecordAnswer) => {
    if (!opener || receipt || saving || lock.current === lease || settled.current === lease || current.current !== lease || !mounted.current) return;
    lock.current = lease;
    const original = opener;
    const at = new Date(now.getTime());
    setAttempt({ scope: lease, opener: original, saving: true, error: false, receipt: null });
    try {
      const saved = await recordFromRecordAnswer(original, value, at);
      if (!mounted.current || current.current !== lease) return;
      settled.current = lease;
      setAttempt({ scope: lease, opener: original, saving: false, error: false, receipt: saved });
    } catch {
      if (mounted.current && current.current === lease) setAttempt({ scope: lease, opener: original, saving: false, error: true, receipt: null });
    } finally {
      if (lock.current === lease) lock.current = null;
    }
  };
  return { opener, receipt, saving, confirming, error, answer };
}
