/**
 * AP-046: In-app notification centre hook.
 *
 * Derives notification items PURELY from existing in-memory signals:
 *   - Monitoring watch-areas: reads DomainSignal.note VERBATIM from
 *     deriveMonitoring (monitoring.ts). The note string is passed through
 *     unchanged — no slice, substring, template-rewrite or replace on the copy.
 *   - JITAI nudge: the current nudge from nextNudge (jitai.ts), translated via
 *     i18n keys at the render site (same mechanism the inline Today nudge uses).
 *
 * AC-6 safety constraints:
 *  - No new child-data egress, no FCM/push, no new consent surface.
 *  - Badge count = total unread items. Neutral framing only — never "N alerts /
 *    N problems / N issues". The aria-label must say "N unread notifications".
 *  - Monitoring note text is character-for-character from DomainSignal.note.
 *  - Read state is local (localStorage), not synced — no backend call.
 */
import { useEffect, useMemo, useState } from "react";
import { useMonitoring } from "./useMonitoring";
import { nextNudge } from "../lib/jitai";
import { ageMonthsFromProfile } from "../lib/childAge";
import { useArbor } from "../context/ArborContext";
import { predictRhythm } from "../rhythm/predict";
import type { ActiveTab } from "../context/ArborContext";
import { loadPrefs, isInQuietHours, shownNudgesToday, recordNudgeShown } from "../growth/jitaiPrefs";

export type NotificationKind = "monitoring" | "nudge";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  /** For monitoring items: the VERBATIM DomainSignal.note string.
   *  For nudge items: a resolved i18n key-set (headlineKey, bodyKey, vars). */
  note: string;
  /** For nudge items: headline i18n key (resolved at render site). */
  headlineKey?: string;
  /** For nudge items: body i18n key (resolved at render site). */
  bodyKey?: string;
  /** For nudge items: i18n interpolation vars. */
  vars?: Record<string, string | number>;
  /** The tab to navigate to when the item is tapped. */
  action: ActiveTab;
  /** ENG-01: the LOG nudge asks the landing surface (Today) to open text
   *  capture — the consumer calls requestCapture(capture) before navigating. */
  capture?: "text";
}

const LS_READ_KEY = "arbor.bell.read";

function readReadSet(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_READ_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function writeReadSet(ids: string[]): void {
  try {
    localStorage.setItem(LS_READ_KEY, JSON.stringify(ids));
  } catch {
    /* storage blocked — silent */
  }
}

/**
 * Derive the current notification list from in-context state.
 * Pure (no network, no FCM, no new child-data egress).
 */
export function useNotifications(): {
  items: AppNotification[];
  unreadCount: number;
  markAllRead: () => void;
} {
  const { childProfile, milestones, behaviorLogs } = useArbor();

  const firstName = (childProfile.name || "your child").split(" ")[0];

  // TJB-03 / ENG-02: the parent's Smart Reminders preferences gate this ONE
  // choke point. Read once per mount (the panel saves to localStorage and the
  // bell re-mounts on open), plus today's shown-kinds list for the max-2
  // contract.
  const prefs = useMemo(() => loadPrefs(), []);
  const [shownToday, setShownToday] = useState<string[]>(() => shownNudgesToday());
  const quiet = isInQuietHours(prefs, Date.now());

  // Derive monitoring signals via the ONE shared derivation (hooks/useMonitoring),
  // which owns the months-precise age conversion this hook used to duplicate.
  const monitoring = useMonitoring();

  // Derive JITAI nudge (pure).
  const rhythm = useMemo(
    () =>
      predictRhythm(
        behaviorLogs.map((l) => ({ timestamp: l.timestamp, intensity: l.intensity })),
        Date.now(),
        { ageYears: childProfile.age },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [behaviorLogs.length, childProfile.age],
  );

  const loggedTodayCount = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return behaviorLogs.filter(
      (l) => new Date(l.timestamp).getTime() >= start.getTime(),
    ).length;
  }, [behaviorLogs]);

  const recent7d = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    return behaviorLogs.filter((l) => new Date(l.timestamp).getTime() >= cutoff)
      .length;
  }, [behaviorLogs]);

  const nudge = useMemo(
    () =>
      quiet
        ? null
        : nextNudge(
            {
              nowMs: Date.now(),
              rhythm,
              loggedToday: loggedTodayCount,
              recent7d,
              childName: firstName,
              shownToday,
            },
            prefs,
          ),
    [rhythm, loggedTodayCount, recent7d, firstName, prefs, quiet, shownToday],
  );

  // Count the surfaced nudge against today's ceiling (idempotent per kind).
  useEffect(() => {
    if (!nudge) return;
    const next = recordNudgeShown(nudge.kind);
    if (next.length !== shownToday.length) setShownToday(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudge?.kind]);

  // Build the notification list.
  const items: AppNotification[] = useMemo(() => {
    const list: AppNotification[] = [];

    // 1) Monitoring watch-areas — verbatim note text from DomainSignal.note.
    //    Only emit items for domains in the "monitor" watch level.
    //    TJB-03: the parent's "Milestone moments" toggle governs these items.
    for (const signal of prefs.types.milestone ? monitoring.watchAreas : []) {
      list.push({
        id: `monitoring:${signal.domain}`,
        kind: "monitoring",
        // AC-6 LOAD-BEARING: signal.note is the VERBATIM string from
        // DomainSignal.note, built by buildNote() in monitoring.ts and exposed
        // as DomainSignal.note. It is assigned directly with no string
        // operations applied (no slice, substring, replace, or template
        // interpolation on the copy itself).
        note: signal.note,
        action: "development",
      });
    }

    // 2) JITAI nudge — surfaced via its i18n keys (same as the inline nudge on
    //    the Today tab). The resolved text is rendered at the render site using t().
    if (nudge) {
      list.push({
        id: `nudge:${nudge.kind}`,
        kind: "nudge",
        // note is left as empty string for nudge items; render site uses headlineKey.
        note: "",
        headlineKey: nudge.headlineKey,
        bodyKey: nudge.bodyKey,
        vars: nudge.vars,
        action: nudge.action,
        capture: nudge.capture,
      });
    }

    return list;
  }, [monitoring.watchAreas, nudge, prefs.types.milestone]);

  const readSet = useMemo(() => readReadSet(), []);

  const unreadCount = useMemo(
    () => items.filter((n) => !readSet.has(n.id)).length,
    [items, readSet],
  );

  const markAllRead = () => {
    writeReadSet(items.map((n) => n.id));
    // Trigger a re-render by writing to localStorage. The component re-mounts
    // via key change on open, so this is sufficient for within-session clearing.
  };

  return { items, unreadCount, markAllRead };
}
