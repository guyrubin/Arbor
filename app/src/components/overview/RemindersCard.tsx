import React, { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { cardCls } from "../ui/kit";

type Prefs = { dailyLog: boolean; dailyTime: string; monthlySafety: boolean; lastDaily?: string };

const DEFAULTS: Prefs = { dailyLog: false, dailyTime: "19:00", monthlySafety: false };

const todayKey = () => new Date().toISOString().slice(0, 10);

function notify(title: string, body: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icon.svg" });
    }
  } catch {
    /* ignore */
  }
}

/**
 * In-app reminders. Fires a daily "log a moment" nudge and a monthly safety
 * review nudge while Arbor is open (browser Notification when permitted, plus an
 * in-app toast). Background push would require FCM + a server worker.
 */
export default function RemindersCard() {
  const { childProfile, behaviorLogs } = useArbor();
  const { toast } = useToast();
  const key = `arbor.reminders.${childProfile.id}`;
  const safetyReviewedKey = `arbor.safetyReviewed.${childProfile.id}`;

  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      setPrefs(raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS);
    } catch {
      setPrefs(DEFAULTS);
    }
  }, [key]);

  const save = (next: Prefs) => {
    setPrefs(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const enable = async (patch: Partial<Prefs>) => {
    if ((patch.dailyLog || patch.monthlySafety) && "Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        /* ignore */
      }
    }
    save({ ...prefs, ...patch });
  };

  // Check due reminders when the card mounts / prefs load.
  useEffect(() => {
    if (prefs.dailyLog) {
      const now = new Date();
      const [h, m] = prefs.dailyTime.split(":").map(Number);
      const due = now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
      if (due && prefs.lastDaily !== todayKey()) {
        const msg = `A gentle nudge: capture a moment with ${childProfile.name} today.`;
        notify("Arbor — daily check-in", msg);
        toast(msg, "info");
        save({ ...prefs, lastDaily: todayKey() });
      }
    }
    if (prefs.monthlySafety) {
      const last = localStorage.getItem(safetyReviewedKey);
      const stale = !last || Date.now() - new Date(last).getTime() > 30 * 86_400_000;
      if (stale) {
        toast(`It's time for ${childProfile.name}'s monthly safety review.`, "info");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.dailyLog, prefs.dailyTime, prefs.monthlySafety]);

  const anyOn = prefs.dailyLog || prefs.monthlySafety;

  return (
    <div className={`${cardCls} p-6 space-y-4`}>
      <div className="flex items-center gap-2">
        {anyOn ? <Bell className="w-4 h-4" style={{ color: "var(--arbor-green-ink)" }} /> : <BellOff className="w-4 h-4" style={{ color: "var(--arbor-muted)" }} />}
        <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-green-ink)" }}>Reminders</span>
      </div>

      <label className="flex items-center justify-between gap-3 text-sm">
        <span style={{ color: "var(--arbor-ink)" }}>Daily log reminder</span>
        <div className="flex items-center gap-2">
          {prefs.dailyLog && (
            <input
              type="time"
              aria-label="Daily reminder time"
              value={prefs.dailyTime}
              onChange={(e) => save({ ...prefs, dailyTime: e.target.value })}
              className="rounded-lg px-2 py-1 text-xs"
              style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
            />
          )}
          <button
            onClick={() => void enable({ dailyLog: !prefs.dailyLog })}
            role="switch"
            aria-checked={prefs.dailyLog}
            aria-label="Daily log reminder"
            className="w-10 h-5 rounded-full transition relative"
            style={{ background: prefs.dailyLog ? "var(--arbor-clay)" : "var(--arbor-rule-strong)" }}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${prefs.dailyLog ? "left-5" : "left-0.5"}`} />
          </button>
        </div>
      </label>

      <label className="flex items-center justify-between gap-3 text-sm">
        <span style={{ color: "var(--arbor-ink)" }}>Monthly safety review</span>
        <button
          onClick={() => void enable({ monthlySafety: !prefs.monthlySafety })}
          role="switch"
          aria-checked={prefs.monthlySafety}
          aria-label="Monthly safety review"
          className="w-10 h-5 rounded-full transition relative"
          style={{ background: prefs.monthlySafety ? "var(--arbor-clay)" : "var(--arbor-rule-strong)" }}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${prefs.monthlySafety ? "left-5" : "left-0.5"}`} />
        </button>
      </label>

      <p className="text-[10px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
        Reminders notify you while Arbor is open. {behaviorLogs.length === 0 && "Start logging to make daily nudges meaningful."}
      </p>
    </div>
  );
}
