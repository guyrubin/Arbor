/**
 * PushPrimingCard — ENG-23. The Growth reminders card, replacing the unprimed
 * switch that used to sit below the screening sheet at the very bottom of the
 * page and render nothing at all in every shipped build.
 *
 * The card states the truth of the build it is running in (lib/pushPriming):
 * with no delivery path it says Arbor does not send phone alerts and that
 * things wait in-app — and it shows NO switch, because a switch that cannot
 * deliver is a promise Arbor cannot keep. Where the capability is genuinely
 * present it primes first (what arrives, how often, what is NOT in it, how to
 * stop) and only then offers the switch.
 *
 * Register: parent. Tokens only, logical CSS for RTL, 44px targets, EN + HE
 * through t(). Nothing here says anything about the child.
 */
import React from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { pushPrimingCopy, type PushPrimingInputs } from "../../lib/pushPriming";

export interface PushPrimingCardProps extends PushPrimingInputs {
  /** A permission request is in flight. */
  pending?: boolean;
  /** Only ever called when the card is allowed to show a switch. */
  onToggle?: () => void;
}

export default function PushPrimingCard({
  capable,
  permission,
  registered,
  pending = false,
  onToggle,
}: PushPrimingCardProps) {
  const { t } = useLanguage();
  const copy = pushPrimingCopy({ capable, permission, registered });

  return (
    <section
      data-testid="push-priming-card"
      data-push-state={copy.state}
      aria-labelledby="push-priming-title"
      className="rounded-[24px] p-4 sm:p-5"
      style={{
        background: "var(--arbor-paper-elevated)",
        border: "1px solid var(--arbor-rule)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--arbor-paper-deep)" }}
        >
          <Icon name="schedule" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="push-priming-title"
            className="text-[15px] font-extrabold"
            style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
          >
            {t(copy.titleKey)}
          </h2>
          <p
            className="mt-1 text-[13px] leading-relaxed"
            dir="auto"
            style={{ color: "var(--arbor-muted)" }}
            data-testid="push-priming-body"
          >
            {t(copy.bodyKey)}
          </p>

          {copy.pointKeys.length > 0 && (
            <ul className="mt-3 space-y-1.5" data-testid="push-priming-points">
              {copy.pointKeys.map((k) => (
                <li
                  key={k}
                  className="flex items-start gap-2 text-[12.5px] leading-snug"
                  dir="auto"
                  style={{ color: "var(--arbor-ink-soft)" }}
                >
                  <Icon name="check_circle" size={14} className="mt-0.5 flex-shrink-0" />
                  <span>{t(k)}</span>
                </li>
              ))}
            </ul>
          )}

          {copy.noteKey !== "" && (
            <p
              className="mt-3 text-[11.5px] leading-snug"
              dir="auto"
              style={{ color: "var(--arbor-muted)" }}
              data-testid="push-priming-note"
            >
              {t(copy.noteKey)}
            </p>
          )}
        </div>
      </div>

      {copy.showToggle && (
        <div
          className="mt-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
          style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)", minHeight: 44 }}
          data-testid="push-priming-toggle-row"
        >
          <div className="min-w-0">
            <p className="text-[13px] font-bold" dir="auto" style={{ color: "var(--arbor-green-ink)" }}>
              {t("elev.rh.push.toggle.label")}
            </p>
            <p className="mt-0.5 text-[11.5px]" dir="auto" style={{ color: "var(--arbor-muted)" }}>
              {t("elev.rh.push.toggle.sub")}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={copy.state === "on"}
            aria-label={t("elev.rh.push.toggle.label")}
            disabled={pending}
            onClick={onToggle}
            className="relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2"
            style={{
              background: copy.state === "on" ? "var(--arbor-clay)" : "var(--arbor-rule-strong)",
              opacity: pending ? 0.6 : 1,
              cursor: pending ? "wait" : "pointer",
            }}
          >
            {/* Logical inset, not translateX: the knob has to travel toward the
                end of the track in Hebrew too. */}
            <span
              className="absolute inline-block h-5 w-5 rounded-full shadow transition-all"
              style={{
                background: "var(--arbor-paper)",
                insetInlineStart: copy.state === "on" ? 22 : 2,
              }}
            />
          </button>
        </div>
      )}
    </section>
  );
}
