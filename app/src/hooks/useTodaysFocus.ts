import { useCallback, useEffect, useRef, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, firebaseEnabled } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useLanguage, type AiLang } from "../context/LanguageContext";
import { authHeaders } from "../lib/api";
import { ChildProfile } from "../types";
import type { FocusInputsUsed } from "../lib/todayFocus";

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

/** `lang` is part of the cache IDENTITY — a Hebrew sentence must never render
 *  inside an English Today (and vice versa). Absent on pre-fix records, which
 *  therefore read as stale and regenerate once in the active language. */
/** TJB-02: the structured server payload is kept whole — `focus` (the
 *  observation) and `tryToday` (the ONE doable step) beside the joined
 *  `text` — so the hero can render the step as the headline and persist the
 *  step, not the observation. Pre-split cached records carry only `text` and
 *  keep rendering through the legacy first-sentence rule. `inputsUsed` (AI-19)
 *  rides along when the server reports it. */
export type Focus = {
  text: string;
  focus?: string;
  tryToday?: string;
  inputsUsed?: FocusInputsUsed;
  generatedAt: string;
  dateKey: string;
  lang?: AiLang;
};

const todayKey = () => new Date().toISOString().slice(0, 10);

/**
 * Cache-validity decision (pure, unit-tested): a cached focus survives only
 * while BOTH the day and the language still match the live session.
 */
export function isFocusStale(
  cached: { dateKey?: string; lang?: string } | null | undefined,
  day: string,
  lang: string
): boolean {
  return !cached || cached.dateKey !== day || cached.lang !== lang;
}

/**
 * AI "Today's Focus" for the Overview tab. Generates a short, warm,
 * non-diagnostic focus for the day from recent signals, and caches it for 24h
 * (Firestore doc when authenticated, localStorage in sandbox). Auto-generates
 * once per day when the cache is stale and there is data to summarize.
 *
 * LANGUAGE (P1 fix 2026-08-12): the AI language is read from LanguageContext —
 * the same value the render uses — not from lib/api's module-level
 * getAiLanguage(), which a cold load can read before LanguageProvider's sync
 * effect has run. The language is stored on the record AND carried in the
 * localStorage key, so a language switch can never surface stale
 * cross-language text.
 */
export function useTodaysFocus(child: ChildProfile, signals: FocusSignals) {
  const { user } = useAuth();
  // OBJ-TODAY-02: the focus language is the language the parent is READING.
  // Gating the cache on `aiLang` let a `.he` record survive a session whose
  // document is `lang=en` — the audit found a Hebrew hero inside the English
  // Today. `setUiLang` already drives `setAiLang` (LanguageContext, the one
  // language canon of OBJ-SHELL-02), so this only repairs a legacy divergence;
  // it also keeps write and read on ONE key, so no regeneration loop is
  // possible (generate stamps the same language the reader tests).
  const { uiLang } = useLanguage();
  const focusLang = uiLang as AiLang;
  const remote = firebaseEnabled && !!user && user.uid !== "local-sandbox" && !!db;
  const uid = user?.uid;
  const lsKey = `arbor.todaysFocus.${child.id}.${focusLang}`;

  const [focus, setFocus] = useState<Focus | null>(null);
  const [loading, setLoading] = useState(false);
  // N2-errfocus: a failed generation used to be swallowed silently — the Today
  // overview then showed only the guaranteed-action fallback with no signal
  // that the AI focus was ever attempted. The flag lets the surface render an
  // inline error + retry ALONGSIDE the fallback (never instead of it).
  const [error, setError] = useState(false);
  const triedAuto = useRef(false);

  const ref = () => (remote && db && uid ? doc(db, `users/${uid}/children/${child.id}/insights/todaysFocus`) : null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(false);
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
          language: focusLang,
        }),
      });
      if (!res.ok) throw new Error("focus generation failed");
      const data = await res.json();
      // The server already returns a short, screened focus; the clamp stays as
      // a safety net for any cached long text.
      const cleaned = String(data.text || "").replace(/[#*]/g, "").replace(/\s+/g, " ").trim();
      const short = cleaned.split(/(?<=[.!?])\s+/).slice(0, 3).join(" ");
      const text = short.length > 360 ? `${short.slice(0, 357).trimEnd()}…` : short || cleaned.slice(0, 240);
      const tidy = (v: unknown, max: number) => {
        const s = String(v ?? "").replace(/[#*]/g, "").replace(/\s+/g, " ").trim();
        return s ? (s.length > max ? `${s.slice(0, max - 3).trimEnd()}…` : s) : undefined;
      };
      const focusObservation = tidy(data.focus, 400);
      const tryToday = tidy(data.tryToday, 300);
      const inputsUsed: FocusInputsUsed | undefined =
        data.inputsUsed && typeof data.inputsUsed === "object"
          ? {
              momentCount: Number.isFinite(Number(data.inputsUsed.momentCount)) ? Number(data.inputsUsed.momentCount) : undefined,
              topTrigger: data.inputsUsed.topTrigger ? String(data.inputsUsed.topTrigger).slice(0, 80) : undefined,
              lastActionOutcome: data.inputsUsed.lastActionOutcome ? String(data.inputsUsed.lastActionOutcome) : undefined,
            }
          : undefined;
      // Firestore rejects `undefined` fields — only present keys are written.
      const next: Focus = {
        text,
        ...(focusObservation ? { focus: focusObservation } : {}),
        ...(tryToday ? { tryToday } : {}),
        ...(inputsUsed ? { inputsUsed: JSON.parse(JSON.stringify(inputsUsed)) as FocusInputsUsed } : {}),
        generatedAt: new Date().toISOString(),
        dateKey: todayKey(),
        lang: focusLang,
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
      // Keep any prior focus, but surface the failure — the Today surface
      // renders an inline retry next to the guaranteed-action fallback.
      setError(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child, signals, remote, uid, focusLang]);

  // Load cache when the active child — or the language — changes.
  useEffect(() => {
    let cancelled = false;
    triedAuto.current = false;
    // A child/language switch is a fresh context: drop any stale error banner.
    setError(false);
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
      // A cached record from another language is NOT a cache hit: drop it so
      // the card never renders cross-language text while the rewrite runs.
      if (!cancelled) setFocus(isFocusStale(cached, todayKey(), focusLang) ? null : cached);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child.id, remote, uid, focusLang]);

  // Auto-generate once per child/day/language when stale and there is data.
  useEffect(() => {
    if (triedAuto.current || loading) return;
    const stale = isFocusStale(focus, todayKey(), focusLang);
    if (stale && signals.count > 0) {
      triedAuto.current = true;
      void generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, signals.count, loading, focusLang]);

  // OBJ-TODAY-02: `inputsUsed` is a PROVENANCE report, and provenance is only
  // worth printing while it still matches the ledger the parent can see. The
  // stored `momentCount` is what the model was handed at generation time; the
  // live count is what Today is showing right now. Reconcile on the way out —
  // `liveInputsUsed` is what every consumer (the why-line) reads, so no caller
  // can accidentally print a count the ledger contradicts.
  const liveFocus = focus
    ? { ...focus, inputsUsed: liveInputsUsed(focus.inputsUsed, signals.count) }
    : focus;

  return { focus: liveFocus, loading, error, regenerate: generate };
}

/**
 * Reconcile a stored provenance report against the live moment count (pure,
 * unit-tested). The live ledger is authoritative about whether there are any
 * moments at all: at 0 the report is dropped entirely, so the why-line falls
 * to its day-0 variant instead of naming "recent moments" over an empty feed.
 * Above 0 the reported count is capped by the live one — a report may describe
 * fewer moments than exist (the model saw a window), never more.
 */
export function liveInputsUsed(
  stored: FocusInputsUsed | undefined,
  liveCount: number,
): FocusInputsUsed | undefined {
  if (!(liveCount > 0)) return undefined;
  if (!stored) return undefined;
  const reported = stored.momentCount;
  return {
    ...stored,
    momentCount: Number.isFinite(Number(reported)) ? Math.min(Number(reported), liveCount) : undefined,
  };
}
