import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { ShareButton } from "../ui/ShareButton";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { ageLabelForMonths } from "../../lib/childAge";
import { track } from "../../lib/analytics";
import { isIncidentType } from "../../content/behaviorTaxonomy";
import type { ShareCardOpts } from "../../lib/shareCard";
import type { LifecycleMoment, LifecycleMomentKind } from "../../lib/lifecycle";
import { buildFirstMonthKeepsake } from "../../lib/firstMonthKeepsake";
import {
  FIRST_MOMENT_STEPS,
  dismissFirstMomentChain,
  markFirstMomentStep,
  readFirstMomentChain,
  resolveFirstMomentChain,
  type FirstMomentMarks,
  type FirstMomentStepId,
} from "../../lib/firstMomentChain";

/**
 * LifecycleMomentCard — Wave E (ENG-09/L0/L1/L2/L3/L4/L5, ENG-20): the ONE
 * lifecycle module on Today.
 *
 * Today used to be byte-identical on day 1 and day 40 except for data volume.
 * This card is the single slot where the account's own age gets to say
 * something: the first captured moment and tonight's story (ENG-L0), day one
 * framed forward (ENG-L1), the "one thing they love" ask (ENG-L2), the
 * first-week keepsake (ENG-L3), the first-month keepsake (ENG-L4), a birthday
 * or a new age band (ENG-20), and the warm re-entry after a lapse (ENG-L5).
 *
 * ENG-L4 SHIPS HALF AN ITEM ON PURPOSE. The backlog item is "first-month
 * keepsake + honest Plus value moment". The keepsake is built here; the Plus
 * value moment needs a benefit statement and a price position that are the
 * owner's to make, so this file carries a named empty seam rather than an
 * invented claim. See the block comment in the first-month branch below.
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
  "first-month": { icon: "calendar_month", soft: "var(--arbor-lav-soft)", ink: "var(--arbor-lav-ink)" },
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
  "first-month": "month",
  "first-week": "week",
  "first-moment": "first",
  "interest-ask": "loves",
  "day-one": "d1",
};

/* ── ENG-L0: the day-0 chain ───────────────────────────────────────────────
   "first-moment" used to be a one-line announcement whose single CTA jumped
   straight to the bedtime story, so a parent's first session ended holding
   nothing. It now walks the three pieces that ALREADY exist — the captured
   moment, a keepsake card off the existing ShareButton/renderShareCard
   pipeline, and tonight's story — with lib/firstMomentChain.ts as its memory.
   Reached the same way as before: at most one lifecycle module on Today.

   The step is a walk, not a gate: any unfinished step is actionable, in any
   order, and leaving mid-way loses nothing (the marks are device-local and the
   card is sticky until the parent finishes it or waves it away — see
   LIFECYCLE_STICKY_KINDS in useLifecycleMoment.ts). */
const CHAIN_ICON: Record<FirstMomentStepId, string> = {
  moment: "edit_note",
  keepsake: "auto_awesome",
  story: "auto_stories",
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
  const { setActiveTab, childProfile, behaviorLogs, playLogs } = useArbor();
  const [picked, setPicked] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [saving, setSaving] = useState(false);

  const style = KIND_STYLE[moment.kind];
  const k = KIND_KEY[moment.kind];
  const age = moment.ageMonths === null ? "" : ageLabelForMonths(moment.ageMonths, t);
  const vars = { name: childName, age };

  const isAsk = moment.kind === "interest-ask";
  const isChain = moment.kind === "first-moment";
  const isMonth = moment.kind === "first-month";

  // ── ENG-L4: the first month's OWN numbers, derived from its OWN window ──
  // The three resolver counts are not usable here. `counts.week` is a rolling
  // seven-day figure that falls in a quiet week; `counts.noticed` is windowed
  // to the child's CDC band and falls when the child ages into a new one; and
  // `counts.total` keeps growing after day 30, so on a late render it would
  // count weeks that were never part of the first month. lib/firstMonthKeepsake
  // counts inside a closed window instead, so neither number can fall and
  // neither can drift.
  const monthKeepsake = useMemo(
    () =>
      buildFirstMonthKeepsake({
        onboardingCompletedAt: childProfile.onboardingCompletedAt,
        timestamps: isMonth
          ? [...behaviorLogs.map((l) => l.timestamp), ...playLogs.map((p) => p.timestamp)]
          : [],
      }),
    [isMonth, childProfile.onboardingCompletedAt, behaviorLogs, playLogs],
  );

  // A parent who kept almost nothing gets a line that is warm and TRUE, not a
  // manufactured achievement and not a note about what is missing. Which line
  // renders is decided by the window, never by a threshold on the child.
  const monthLines: ReadonlyArray<{ id: string; icon: string; text: string }> =
    monthKeepsake.tone === "kept"
      ? [
          {
            id: "moments",
            icon: "edit_note",
            text:
              monthKeepsake.momentsKept === 1
                ? t("elev.l4.moments.one")
                : t("elev.l4.moments.many", { n: monthKeepsake.momentsKept }),
          },
          {
            id: "days",
            icon: "calendar_month",
            text:
              monthKeepsake.daysWritten === 1
                ? t("elev.l4.days.one")
                : t("elev.l4.days.many", { n: monthKeepsake.daysWritten }),
          },
        ]
      : [{ id: "quiet", icon: "favorite", text: t("elev.l4.quiet") }];

  // ── ENG-L0 chain state. Seeded from the device record so a parent who did
  //    one step yesterday resumes where they stopped; writes go straight back
  //    so closing the app mid-chain never loses a step. ──
  const childId = childProfile.id;
  const [marks, setMarks] = useState<FirstMomentMarks>(() =>
    isChain ? readFirstMomentChain(childId) : {},
  );
  useEffect(() => {
    if (isChain) setMarks(readFirstMomentChain(childId));
  }, [isChain, childId]);
  const chain = resolveFirstMomentChain({ momentCount: moment.counts.total, marks });

  // The parent's own words from their first PLAIN moment. Incident rows are
  // excluded deliberately: their trigger text describes a hard moment, and a
  // shareable card is the last place that belongs. With no plain moment the
  // keepsake still renders — it simply carries the title and nothing else.
  const firstMomentWords = useMemo(() => {
    if (!isChain) return "";
    const plain = behaviorLogs
      .filter((l) => !isIncidentType(l.behaviorType))
      .slice()
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];
    return (plain?.trigger || plain?.notes || "").trim().slice(0, 180);
  }, [isChain, behaviorLogs]);

  const markStep = (step: "keepsake" | "story") => {
    setMarks(markFirstMomentStep(childId, step));
    track("d0_chain_step", { step });
  };

  // Finishing the third step retires the card for good — the chain has nothing
  // left to say, and a completed checklist that keeps reappearing is a nag.
  useEffect(() => {
    if (isChain && chain.complete) onDismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChain, chain.complete]);

  // The X on a chain card also retires the chain itself, so clearing the
  // lifecycle ledger can never resurrect a walk the parent waved away.
  const dismissCard = () => {
    if (isChain) dismissFirstMomentChain(childId);
    onDismiss();
  };

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
      case "first-month":
        // What they kept, not what a period "showed" — the journal is the
        // record itself, and it is the only place this card points.
        return () => go("journal");
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
          onClick={dismissCard}
          aria-label={t("elev.lifecycle.dismiss")}
          className="-m-2 flex h-11 w-11 flex-none items-center justify-center rounded-full"
          style={{ color: "var(--arbor-faint)" }}
          data-testid="lifecycle-dismiss"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      {/* ENG-L0: the day-0 chain. Three steps over three EXISTING mechanisms —
          the moment they already captured, a keepsake through the shared
          ShareButton pipeline, and the bedtime-stories route. Counts only:
          "{n} of 3" is how many steps the PARENT took, and there is
          deliberately no bar, ring or percentage drawn from it. */}
      {isChain ? (
        <div className="mt-4">
          <ol className="space-y-2" aria-label={t("elev.d0.aria")} data-testid="d0-chain">
            {FIRST_MOMENT_STEPS.map((step) => {
              const done = chain.done[step];
              const label = t(`elev.d0.step.${step}`);
              return (
                <li
                  key={step}
                  data-testid={`d0-step-${step}`}
                  data-done={done ? "true" : "false"}
                  className="flex flex-wrap items-center gap-2.5 rounded-xl px-3 py-2"
                  style={{ background: "var(--arbor-paper-deep)" }}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 flex-none items-center justify-center rounded-full"
                    style={
                      done
                        ? { background: style.ink, color: "var(--arbor-on-accent)" }
                        : { background: style.soft, color: style.ink }
                    }
                  >
                    <Icon name={done ? "check" : CHAIN_ICON[step]} size={15} />
                  </span>
                  <span
                    className="min-w-0 flex-1 text-[12.5px] font-bold leading-tight"
                    style={{ color: "var(--arbor-ink)" }}
                    dir="auto"
                  >
                    {label}
                  </span>
                  {done && (
                    <span className="text-[10.5px] font-bold" style={{ color: "var(--arbor-faint)" }}>
                      {t("elev.d0.step.done")}
                    </span>
                  )}
                  {/* The keepsake IS the existing share pipeline — one tap
                      renders the card on device. `captionKey` is explicit so
                      the artifact fallback ("{name}'s story, made with Arbor")
                      can never claim Arbor wrote the parent's words. */}
                  {!done && step === "keepsake" && (
                    <span
                      data-testid="d0-keepsake-share"
                      onClickCapture={() => markStep("keepsake")}
                    >
                      <ShareButton
                        artifact="story"
                        surface="d0_first_moment"
                        childName={childName}
                        captionKey="elev.d0.share.caption"
                        label={t("elev.d0.keepsake.cta")}
                        getCardOpts={(): ShareCardOpts => ({
                          name: childName,
                          title: t("elev.d0.keepsake.title", { name: childName }),
                          ...(firstMomentWords ? { takeaway: firstMomentWords } : {}),
                        })}
                      />
                    </span>
                  )}
                  {!done && step === "story" && (
                    <button
                      type="button"
                      data-testid="d0-story-cta"
                      onClick={() => {
                        markStep("story");
                        track("lifecycle_moment_action", { kind: moment.kind });
                        setActiveTab("bedtime-stories");
                      }}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-[12px] font-extrabold"
                      style={{ color: "var(--arbor-clay)" }}
                    >
                      {t("elev.d0.story.cta")}
                      <Icon name="arrow_forward" size={15} className="rtl:-scale-x-100" />
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="mt-2.5 px-1 text-[11px] font-bold tabular-nums" style={{ color: "var(--arbor-faint)" }}>
            {t("elev.d0.progress", { count: chain.doneCount, total: chain.total })}
          </p>
        </div>
      ) : /* ENG-L2: the ask. Chips + one free-text line, written straight to
          `interests[]` on the profile (the same field ProfileEditDrawer owns),
          so play selection picks it up on the very next pick. */
      isAsk ? (
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
      ) : /* ENG-L4: the day-30 keepsake. The card hands over the first month
          the parent actually had — counts of what they kept and how many days
          they wrote on, both from lib/firstMonthKeepsake's closed window — and
          the keepsake itself through the SAME ShareButton/renderShareCard
          pipeline ENG-L0 and the month keepsake already use. No new share
          path, no new store: being offered once is the lifecycle ledger's job
          (lib/lifecycleState.ts), which is why this card mints no key of its
          own.

          It is NOT components/growth/MonthInReview (GP-32) and not
          components/weekly/MonthKeepsake (ENG-14b): both are keyed to a
          CALENDAR month on their own hub, and a parent who joined on the 20th
          has a first month that no calendar month describes. */
      isMonth ? (
        <div className="mt-4">
          <ul
            className="space-y-2"
            aria-label={t("elev.l4.aria", { name: childName })}
            data-testid="l4-month-lines"
          >
            {monthLines.map((line) => (
              <li
                key={line.id}
                data-testid={`l4-line-${line.id}`}
                className="flex items-start gap-2.5 rounded-xl px-3 py-2.5"
                style={{ background: "var(--arbor-paper-deep)" }}
              >
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-full"
                  style={{ background: style.soft, color: style.ink }}
                >
                  <Icon name={line.icon} size={15} />
                </span>
                <span
                  className="min-w-0 flex-1 text-[12.5px] font-bold leading-snug"
                  style={{ color: "var(--arbor-ink)" }}
                  dir="auto"
                >
                  {line.text}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* A keepsake needs something to be a keepsake OF — the same rule
                ENG-L3 applies at the resolver. When the window is empty there
                is no card to hand over, so none is offered; the parent still
                gets the warm line and the way in to what they kept.

                `captionKey` is declared, never inherited: the growth_card
                fallback is `share.caption.growth` — "{name}'s progress this
                month" — and a first month is an elapsed month, not a measured
                one. That mislabel is exactly what lib/shareCaption.ts (ENG-16)
                exists to stop. */}
            {monthKeepsake.tone === "kept" && (
            <span data-testid="l4-keepsake-share">
              <ShareButton
                artifact="growth_card"
                surface="l4_first_month"
                childName={childName}
                captionKey="elev.l4.share.caption"
                label={t("elev.l4.keepsake.cta")}
                getCardOpts={(): ShareCardOpts => ({
                  name: childName,
                  headline: t("elev.l4.keepsake.title", { name: childName }),
                  sub: monthLines[0].text,
                })}
              />
            </span>
            )}
            {onPrimary && (
              <button
                type="button"
                onClick={onPrimary}
                data-testid="l4-cta"
                className="inline-flex min-h-[44px] items-center gap-1.5 px-1 text-[12.5px] font-extrabold"
                style={{ color: "var(--arbor-clay)" }}
              >
                {t(`elev.lifecycle.${k}.cta`)}
                <Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" />
              </button>
            )}
          </div>

          {/* ══ DELIBERATELY UNBUILT — the other half of ENG-L4 ══════════════
              ENG-L4 is "first-month keepsake + honest Plus value moment". The
              keepsake above is built. The Plus value moment is NOT, and the
              gap is left open rather than filled with a guess.

              WHAT IS MISSING, precisely:
                · the value statement — what a paying month actually gives this
                  parent, in their words, stated so it is true for a parent who
                  kept one thing as well as for one who kept twenty;
                · the price position for that statement (amount, currency,
                  trial or no trial, and whether day 30 is where Arbor asks at
                  all).
              Both are commercial positions, not engineering choices. Inventing
              them here would put a claim about what Arbor is worth into the
              product in the owner's name, which is worse than shipping nothing.

              WHERE IT ATTACHES when the owner has settled it: this slot, below
              the keepsake row and inside the same card — one appearance, still
              dismissible by the same X, still marked seen by the same ledger,
              so it can never become a recurring ask. Its copy belongs in
              lib/i18nElevation/firstMonth.ts under an `elev.l4.plus.*` prefix,
              which deliberately does not exist yet.

              Until then this card carries NO upsell, no placeholder, no
              price-shaped empty state, and no teaser. The guard in
              firstMonthKeepsake.wiring.test.ts fails if commercial copy
              appears here without that decision. ══════════════════════════ */}
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
