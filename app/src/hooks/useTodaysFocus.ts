import { useCallback, useEffect, useRef, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, firebaseEnabled } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { authHeaders } from "../lib/api";
import { ChildProfile } from "../types";

export type FocusSignals = {
  count: number;
  avg: number;
  topTrigger: string;
  milestonesPercent: number;
};

type Focus = { text: string; generatedAt: string; dateKey: string };

const todayKey = () => new Date().toISOString().slice(0, 10);

/**
 * AI "Today's Focus" for the Overview tab. Generates a short, warm,
 * non-diagnostic focus for the day from recent signals, and caches it for 24h
 * (Firestore doc when authenticated, localStorage in sandbox). Auto-generates
 * once per day when the cache is stale and there is data to summarize.
 */
export function useTodaysFocus(child: ChildProfile, signals: FocusSignals) {
  const { user } = useAuth();
  const remote = firebaseEnabled && !!user && user.uid !== "local-sandbox" && !!db;
  const uid = user?.uid;
  const lsKey = `arbor.todaysFocus.${child.id}`;

  const [focus, setFocus] = useState<Focus | null>(null);
  const [loading, setLoading] = useState(false);
  const triedAuto = useRef(false);

  const ref = () => (remote && db && uid ? doc(db, `users/${uid}/children/${child.id}/insights/todaysFocus`) : null);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          message: `In 2 short sentences, give me today's single most useful parenting focus for ${child.name} (age ${child.age}). Signals this week: ${signals.count} behavior events, average intensity ${signals.avg.toFixed(1)}/5, most frequent pattern "${signals.topTrigger || "transitions"}", milestone readiness ${signals.milestonesPercent}%. Warm, concrete, non-diagnostic, no headings or markdown.`,
          childProfile: child,
          scholarLens: "Integrated Balanced",
        }),
      });
      if (!res.ok) throw new Error("focus generation failed");
      const data = await res.json();
      const next: Focus = {
        text: String(data.text || "").replace(/[#*]/g, "").trim(),
        generatedAt: new Date().toISOString(),
        dateKey: todayKey(),
      };
      setFocus(next);
      const r = ref();
      if (r) await setDoc(r, next);
      else {
        try {
          localStorage.setItem(lsKey, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* keep prior focus */
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child, signals, remote, uid]);

  // Load cache when the active child changes.
  useEffect(() => {
    let cancelled = false;
    triedAuto.current = false;
    (async () => {
      let cached: Focus | null = null;
      const r = ref();
      if (r) {
        try {
          const s = await getDoc(r);
          if (s.exists()) cached = s.data() as Focus;
        } catch {
          /* ignore */
        }
      } else {
        try {
          const raw = localStorage.getItem(lsKey);
          if (raw) cached = JSON.parse(raw) as Focus;
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setFocus(cached);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child.id, remote, uid]);

  // Auto-generate once per child/day when stale and there is data.
  useEffect(() => {
    if (triedAuto.current || loading) return;
    const stale = !focus || focus.dateKey !== todayKey();
    if (stale && signals.count > 0) {
      triedAuto.current = true;
      void generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, signals.count, loading]);

  return { focus, loading, regenerate: generate };
}
