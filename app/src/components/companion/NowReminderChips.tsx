import React from "react";
import { loadPrefs, savePrefs, type JitaiPrefs, type NudgeTypeKey } from "../../growth/jitaiPrefs";
import Icon from "../ui/Icon";
import { NOW_COPY } from "./nowViewCopy";

type ChipId = keyof (typeof NOW_COPY)["en"]["reminderChips"];

/** Each chip is one Smart Reminders switch: the same JitaiPrefs store, so the two never disagree. */
export const REMINDER_CHIPS: readonly { id: ChipId; pref: NudgeTypeKey; icon: string }[] = [
  { id: "morning", pref: "guidance", icon: "wb_sunny" },
  { id: "story", pref: "story", icon: "bedtime" },
  { id: "moment", pref: "moments", icon: "edit_note" },
  { id: "weekly", pref: "recap", icon: "bar_chart" },
];

/**
 * v3 F-NOW-2 — Now's reminders, in the "Today at a glance" card: a hint, four
 * switches that turn a reminder kind on or off in place, and "All reminders"
 * (#/smart-reminders, the full settings leaf). No counts, no clock times (no
 * schedule leaves the app, B-TODAY-02), never the page's primary move.
 */
export default function NowReminderChips({ lang, prefs, onChange, onAll }: {
  lang: "en" | "he";
  prefs: JitaiPrefs;
  onChange: (prefs: JitaiPrefs) => void;
  onAll: () => void;
}) {
  const copy = NOW_COPY[lang];
  const toggle = (key: NudgeTypeKey) => {
    // Read the store fresh, so a change made on #/smart-reminders is never overwritten.
    const stored = loadPrefs();
    savePrefs({ ...stored, types: { ...stored.types, [key]: !prefs.types[key] } });
    onChange(loadPrefs());
  };
  return <div className="now-reminders" data-testid="now-reminders">
    <p className="now-reminders-hint">{copy.remHint}</p>
    <div className="now-reminder-chips">
      {REMINDER_CHIPS.map(chip => {
        const on = prefs.types[chip.pref] !== false;
        return <button key={chip.id} type="button" role="switch" aria-checked={on} className="now-reminder-chip" data-testid={`now-reminder-${chip.id}`} onClick={() => toggle(chip.pref)}>
          <Icon name={chip.icon} size={18} />
          <span>{copy.reminderChips[chip.id]}</span>
        </button>;
      })}
    </div>
    <button type="button" className="companion-text-button now-reminders-all" data-testid="now-reminders-all" onClick={onAll}>
      {copy.remindersAll}<Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" />
    </button>
  </div>;
}
