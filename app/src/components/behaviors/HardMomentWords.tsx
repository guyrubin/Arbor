import React, { useState } from "react";
import { Icon } from "../ui/Icon";
import { renderSayThis, type HardMomentCard } from "../../content/hardMomentCards";
import { locText } from "../../content/hardMomentSurface";
import { buildWordsText } from "../../lib/share";
import { SendSheet } from "../share/SendSheet";
import { recordDate } from "../overview/FromRecordCard";

type T = (key: string, vars?: Record<string, string | number>) => string;

/**
 * B-ASKJB-33 — the lead block: "Last time, this helped with {name}:" + the
 * card's Say-this sentence in the editorial serif (the largest text on the
 * card), dated. Renders only when the parent answered "held the plan" for
 * this card (lastHeldFor). Provider-less so the guard renders it bare.
 */
export function LastTimeLead({ card, childName, at, locale, t }: {
  card: HardMomentCard;
  childName: string;
  at: string;
  locale: "en" | "he";
  t: T;
}) {
  const sentence = locText(renderSayThis(card, childName), locale);
  return (
    <section data-testid="hm-last-time" lang={locale} dir={locale === "he" ? "rtl" : "ltr"} className="min-w-0 text-start">
      {/* P1-NEXTLEVEL critic r2: no dir="auto" on the lead or the quote — their
          only child is a <bdi>, which the first-strong scan skips, so they fell
          back to ltr in Hebrew (bar on the left). They inherit the section's
          locale direction; the <bdi> keeps the words isolated. */}
      <p className="text-[13px] font-semibold" style={{ color: "var(--arbor-muted)" }}>
        <bdi>{t("hm.lastTime.lead", { name: childName })}</bdi>
      </p>
      <blockquote
        data-testid="hm-last-time-words"
        className="mt-1.5 border-s-2 ps-3 text-[20px] leading-snug sm:text-[22px]"
        style={{ borderColor: "var(--arbor-rule-strong)", color: "var(--arbor-ink)", fontFamily: "var(--font-editorial)" }}
      >
        <bdi>{sentence}</bdi>
      </blockquote>
      <p className="mt-1 ps-3 text-[12px]" style={{ color: "var(--arbor-muted)" }}>{recordDate(at, locale)}</p>
    </section>
  );
}

/** Pure: the text a "Send these words to…" tap shares (EN or HE). */
export function hardMomentWordsText(card: HardMomentCard, opts: {
  locale: "en" | "he";
  parentName: string;
  /** The child's first name, only when the parent turned it on (default off). */
  childName?: string;
  t: T;
}): string {
  const { locale, t } = opts;
  return buildWordsText({
    sentence: locText(renderSayThis(card, opts.childName), locale),
    whenLine: t("hm.send.when", { when: locText(card.title, locale) }),
    withLine: t("hm.send.with", { doNow: locText(card.doNow, locale) }),
    closing: t("hm.send.closing", { parent: opts.parentName }),
  });
}

/**
 * "Send these words to…" — B-SHELL-29: opens the ONE send sheet (editable
 * plain text; no link, no referral code, no image; share sheet else copy). The child's first name is included
 * only when the parent ticks it (default off).
 */
export function SendWordsButton({ card, locale, parentName, childName, t }: {
  card: HardMomentCard;
  locale: "en" | "he";
  parentName: string;
  childName: string;
  t: T;
}) {
  const [withName, setWithName] = useState(false);
  // B-SHELL-29: the tap opens the ONE send sheet with these words, editable.
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const send = () => {
    setText(hardMomentWordsText(card, { locale, parentName, childName: withName ? childName : undefined, t }));
    setOpen(true);
  };
  return (
    <div className="min-w-0 space-y-1">
      <button
        type="button"
        data-testid="hm-send-words"
        onClick={send}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition"
        style={{ color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule-strong)", background: "var(--arbor-paper-elevated)" }}
      >
        <Icon name="ios_share" size={16} /> {t("hm.send.cta")}
      </button>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 px-1 text-[13px]" style={{ color: "var(--arbor-muted)" }}>
        <input type="checkbox" data-testid="hm-send-name" checked={withName} onChange={(e) => setWithName(e.target.checked)} className="h-4 w-4" />
        <bdi>{t("hm.send.includeName", { name: childName })}</bdi>
      </label>
      {open && <SendSheet open={open} onClose={() => setOpen(false)} text={text} artifact="answer_card" surface="hard_moment_words" />}
    </div>
  );
}
