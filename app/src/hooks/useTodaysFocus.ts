import { useCallback, useEffect, useRef, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, firebaseEnabled } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { authHeaders, getAiLanguage } from "../lib/api";
import { ChildProfile } from "../types";

export type FocusSignals = {
  count: number;
  avg: number;
  topTrigger: string;
  milestonesPercent: number;
  /**
   * Wave-3 clinical subtraction (2026-06-26): the coach prompt no longer passes
   * `milestonesPercent` or `avg` (intensity) to the model — both are verdict
   * primitives that could be re-emitted as a child verdict. The prompt now uses
   * flat parent-log counts + the top pattern only. The fields stay on the type
   * for back-compat with callers; they are ignored below.
   */
  milestonesChecked?: number;
  milestonesTotal?: number;
  lastActionRecommendation?: string;
  lastActionOutcome?: "helped" | "somewhat" | "not_today";
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
      // AIR-5: dedicated lightweight endpoint (analysis route, 2-field schema,
      // server-side output screen + daily cache). The old path POSTed /api/chat —
      // the heaviest route in the app — and silently burned the free plan's
      // daily coach meter on an ambient card. /api/todays-focus sits inside the
      // hourly AI quota but NEVER touches the coach meter.
      //
      // Wave-3 clinical subtraction (2026-06-26) stays pinned: the payload
      // carries only flat parent-log counts + the top pattern (a parent-tagged
      // category) — never the intensity average nor the milestone percentage,
      // both verdict primitives (pinned by lib/todayFocus.test.ts).
      const res = await fetch("/api/todays-focus", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          childProfile: child,
          signals: {
            count: signals.count,
            topTrigger: signals.topTrigger,
            lastActionRecommendation: signals.lastActionRecommendation,
            lastActionOutcome: signals.lastActionOutcome,
          },
          language: getAiLanguage(),
        }),
      });
      if (!res.ok) throw new Error("focus generation failed");
      const data = await res.json();
      // The server already returns a short, screened focus; the clamp stays as
      // a safety net for any cached long text.
      const cleaned = String(data.text || "").replace(/[#*]/g, "").replace(/\s+/g, " ").trim();
      const short = cleaned.split(/(?<=[.!?])\s+/).slice(0, 3).join(" ");
      const text = short.length > 360 ? `${short.slice(0, 357).trimEnd()}…` : short || cleaned.slice(0, 240);
      const next: Focus = {
        text,
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
