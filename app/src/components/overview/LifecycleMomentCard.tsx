import React, { useState } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { ageLabelForMonths } from "../../lib/childAge";
import { track } from "../../lib/analytics";
import type { LifecycleMoment, LifecycleMomentKind } from "../../lib/lifecycle";

/**
 * LifecycleMomentCard — Wave E (ENG-09/L0/L1/L2/L3/L5, ENG-20): the ONE
 * lifecycle module on Today.
 *
 * Today used to be byte-identical on day 1 and day 40 except for data volume.
 * This card is the single slot where the account's own age gets to say
 * something: the first captured moment and tonight's story (ENG-L0), day one
 * framed forward (ENG-L1), the "one thing they love" ask (ENG-L2), the
 * first-week keepsake (ENG-L3), a birthday or a new age band (ENG-20), and the
 * warm re-entry after a lapse (ENG-L5).
 *
 * Which one renders is decided upstream by the pure resolver (lib/lifecycle.ts)
 * and the ledger (lib/lifecycleState.ts). This file only draws it, so a copy or
 * layout change here can never alter the lifecycle logic.
 *
 * NEVER A LOSS FRAME. The return card is anchored on the child's age — a number
 * that only goes up — never on the gap. There is no streak, no "you missed", no
 * counter that can fall. The days-away figure exists upstream to CHOOSE this
 * card and is deliberately not rendered.
 *
 * NOTHING WAS SENT. There is no push, email or local-notification path in this
 * app. This is an in-app surface on the next open, and no copy here implies
 * Arbor reached out.
 *
 * CLINICAL FIREWALL: the only numbers are COUNTS of what the parent captured or
 * noticed, and the child's age. No score, no percentage, no verdict tag, no
 * weakest-domain pointer, and never a colour that means good or bad about the
 * child — the accent is chosen by moment KIND, so every value paints the same.
 *
 * Styling: `var(--arbor-*)` tokens only, logical properties for RTL, 44px
 * touch targets, every string through `t()` (EN + HE in
 * lib/i18nElevation/lifecycle.ts).
 */

/** Icon + accent per moment kind. Chosen by KIND, never by a value. */
const KIND_STYLE: Record<LifecycleMomentKind, { icon: string; soft: string; ink: string }> = {
  "welcome-back": { icon: "favorite", soft: "var(--arbor-green-soft)", ink: "var(--arbor-green-ink)" },
  birthday: { icon: "cake", soft: "var(--arbor-pink-soft)", ink: "var(--arbor-pink-ink)" },
  "age-band": { icon: "child_care", soft: "var(--arbor-sky-soft)", ink: "var(--arbor-sky-ink)" },
  "first-week": { icon: "celebration", soft: "var(--arbor-lav-soft)", ink: "var(--arbor-lav-ink)" },
  "first-moment": { icon: "auto_stories", soft: "var(--arbor-peach-soft)", ink: "var(--arbor-peach-ink)" },
  "interest-ask": { icon: "interests", soft: "var(--arbor-yellow-soft)", ink: "var(--arbor-yellow-ink)" },
  "day-one": { icon: "edit_note", soft: "var(--arbor-green-soft)", ink: "var(--arbor-green-ink)" },
};

/** Copy prefix per kind, so one card body serves every moment. */
const KIND_KEY: Record<LifecycleMomentKind, string> = {
  "welcome-back": "back",
  birthday: "birthday",
  "age-band": "band",
  "first-week": "week",
  "first-moment": "first",
  "interest-ask": "loves",
  "day-one": "d1",
};

/** Six of the twelve curated CI-29 suggestions — the existing shared keys. */
const SUGGESTION_KEYS = [
  "interest.trains",
  "interest.animals",
  "interest.music",
  "interest.water",
  "interest.building",
  "interest.nature",
] as const;

export default function LifecycleMomentCard({
  moment,
  childName,
  onDismiss,
  onSaveInterests,
  onCapture,
}: {
  moment: LifecycleMoment;
  childName: string;
  onDismiss: () => void;
  onSaveInterests: (values: readonly string[]) => Promise<void>;
  /** Opens the existing quick-log capture (no new capture path). */
  onCapture: () => void;
}) {
  const { t } = useLanguage();
  const { setActiveTab } = useArbor();
  const [picked, setPicked] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [saving, setSaving] = useState(false);

  const style = KIND_STYLE[moment.kind];
  const k = KIND_KEY[moment.kind];
  const age = moment.ageMonths === null ? "" : ageLabelForMonths(moment.ageMonths, t);
  const vars = { name: childName, age };

  const isAsk = moment.kind === "interest-ask";

  const go = (tab: Parameters<typeof setActiveTab>[0]) => {
    track("lifecycle_moment_action", { kind: moment.kind });
    onDismiss();
    setActiveTab(tab);
  };

  const primary = () => {
    switch (moment.kind) {
      case "welcome-back":
        return () => go("journal");
      case "birthday":
        return () => go("development");
      case "age-band":
        return () => go("daily-play");
      case "first-week":
        return () => go("weekly");
      case "first-moment":
        return () => go("bedtime-stories");
      case "day-one":
        return () => {
          track("lifecycle_moment_action", { kind: moment.kind });
          onDismiss();
          onCapture();
        };
      case "interest-ask":
        return undefined;
    }
  };

  const onPrimary = primary();

  const toggle = (label: string) =>
    setPicked((prev) => (prev.includes(label) ? prev.filter((v) => v !== label) : [...prev, label]));

  const addTyped = () => {
    const value = typed.trim().slice(0, 40);
    if (!value) return;
    setPicked((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setTyped("");
  };

  const save = async () => {
    if (picked.length === 0 || saving) return;
    setSaving(true);
    try {
      await onSaveInterests(picked);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="rounded-[22px] p-5"
      style={{ background: "var(--arbor-paper-elevated)", boxShadow: "var(--shadow-sm)" }}
      aria-label={t("elev.lifecycle.aria", { name: childName })}
      data-testid="lifecycle-moment"
      data-lifecycle-kind={moment.kind}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full"
          style={{ background: style.soft, color: style.ink }}
        >
          <Icon name={style.icon} size={20} fill={1} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: style.ink }}>
            {t(`elev.lifecycle.${k}.eyebrow`)}
          </p>
          <h2
            className="mt-1 text-[19px] font-extrabold leading-[1.2]"
            style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}
            dir="auto"
          >
            {t(`elev.lifecycle.${k}.title`, vars)}
          </h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "var(--arbor-muted)" }} dir="auto">
            {t(`elev.lifecycle.${k}.body`, vars)}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("elev.lifecycle.dismiss")}
          className="-m-2 flex h-11 w-11 flex-none items-center justify-center rounded-full"
          style={{ color: "var(--arbor-faint)" }}
          data-testid="lifecycle-dismiss"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      {/* ENG-L2: the ask. Chips + one free-text line, written straight to
          `interests[]` on the profile (the same field ProfileEditDrawer owns),
          so play selection picks it up on the very next pick. */}
      {isAsk ? (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("elev.lifecycle.loves.aria", { name: childName })}>
            {SUGGESTION_KEYS.map((key) => {
              const label = t(key);
              const on = picked.includes(label);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(label)}
                  aria-pressed={on}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[12.5px] font-bold transition active:scale-[0.98]"
                  style={
                    on
                      ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-clay-border)" }
                      : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }
                  }
                >
                  {on && <Icon name="check" size={15} />}
                  {label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value.slice(0, 40))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTyped();
                }
              }}
              maxLength={40}
              placeholder={t("elev.lifecycle.loves.placeholder")}
              aria-label={t("elev.lifecycle.loves.aria", { name: childName })}
              dir="auto"
              className="min-h-[44px] flex-1 rounded-xl px-3.5 text-[13px] focus:outline-none"
              style={{
                background: "var(--arbor-paper-deep)",
                color: "var(--arbor-ink)",
                border: "1px solid var(--arbor-rule)",
              }}
            />
            <button
              type="button"
              onClick={addTyped}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 text-[12.5px] font-extrabold"
              style={{ color: "var(--arbor-green-ink)" }}
            >
              <Icon name="add" size={16} />
              {t("elev.lifecycle.loves.add")}
            </button>
          </div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={picked.length === 0 || saving}
            data-testid="lifecycle-loves-save"
            className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 text-[13px] font-extrabold text-white transition active:scale-[0.98] disabled:opacity-50"
            style={{ background: "var(--arbor-gradient-primary)" }}
          >
            {t("elev.lifecycle.loves.save")}
            <Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" />
          </button>
        </div>
      ) : (
        <>
          {/* COUNTS ONLY — what the parent captured and noticed. Never a score,
              a percentage, or a comparison between two periods. */}
          {/* A parent returning after a fortnight has week === 0 BY
              CONSTRUCTION. A bold 0 under "this week" is a counter of their
              absence — the same fact the days-away figure was deliberately
              withheld to avoid, leaking through the back door. The welcome-back
              card shows what they have, never what the gap cost.
              "Milestones noticed" is windowed to the child's CDC band plus one
              earlier, so it FALLS when the child ages into a new band — and the
              age-band card is exactly the moment that happens. A count that can
              go down is not a count of what you noticed; it is a verdict. */}
          <div className="mt-4 flex gap-2">
            {(
              [
                { v: moment.counts.total, label: t("elev.lifecycle.stat.total") },
                ...(moment.kind === "welcome-back"
                  ? []
                  : [{ v: moment.counts.week, label: t("elev.lifecycle.stat.week") }]),
                ...(moment.kind === "age-band"
                  ? []
                  : [{ v: moment.counts.noticed, label: t("elev.lifecycle.stat.noticed") }]),
              ] as const
            ).map((s) => (
              <div key={s.label} className="flex-1 rounded-xl py-2.5 text-center" style={{ background: "var(--arbor-paper-deep)" }}>
                <div className="text-[17px] font-extrabold leading-none" style={{ color: style.ink }}>
                  {s.v}
                </div>
                <div className="mt-1.5 text-[9.5px] font-bold" style={{ color: "var(--arbor-faint)" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          {onPrimary && (
            <button
              type="button"
              onClick={onPrimary}
              data-testid="lifecycle-cta"
              className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 px-1 text-[12.5px] font-extrabold"
              style={{ color: "var(--arbor-clay)" }}
            >
              {t(`elev.lifecycle.${k}.cta`)}
              <Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" />
            </button>
          )}
        </>
      )}
    </section>
  );
}
