import React from "react";
import { Icon } from "../ui/Icon";
import { cardCls } from "../ui/kit";
import { tGCare } from "../../lib/growthCareText";
import type { HardMomentAgeVerdict } from "../../content/hardMomentAgeFit";

/**
 * WAVE-G · THE AGE GAP — the surface explains itself instead of vanishing.
 *
 * The hard-moment guides are age-banded and the age gate is fail-closed, so a
 * child under the youngest band (or past the oldest) matches NOTHING. Until
 * now `HardMomentsSection` returned `null` in that case: a permanently blank
 * feature, with no way for a parent to tell "nothing written for this age"
 * from "broken" or — worse — "nothing for MY child".
 *
 * Design rules held here:
 *  - The numbers are DERIVED (`hardMomentAgeCoverage`) from the guides that
 *    would actually publish, so the sentence cannot outlive the pack.
 *  - The gap is attributed to Arbor's writing, never to the child. No colour
 *    means good or bad; the tone is the neutral paper/rule pair used by every
 *    other empty state (CLINICAL FIREWALL).
 *  - It renders ONLY when the emptiness is about age. If nothing would publish
 *    at any age (release withdrawn or expired, unsupported locale) the caller
 *    still renders nothing at all — a withdrawal must never leave a promise on
 *    screen.
 */
export default function HardMomentAgeNotice({
  verdict, uiLang, childName,
}: {
  verdict: HardMomentAgeVerdict;
  uiLang: string;
  /** First name when known; otherwise a neutral localized subject is used. */
  childName?: string;
}) {
  const { fit, coverage } = verdict;
  if (!coverage || fit === "covered" || fit === "none") return null;

  const locale = uiLang === "he" ? "he" : "en";
  const who = childName?.trim() || tGCare(locale, "elev.gcare.hm.age.child");
  const to = coverage.endYears === null ? "" : String(coverage.endYears);
  const vars = { from: coverage.startYears, to, who };
  const range = coverage.endYears === null
    ? tGCare(locale, "elev.gcare.hm.age.rangeOpen", vars)
    : tGCare(locale, "elev.gcare.hm.age.range", vars);

  return (
    <section
      lang={locale}
      dir={locale === "he" ? "rtl" : "ltr"}
      className={`${cardCls} min-w-0 space-y-2 p-5 text-start`}
      data-testid="hard-moments-age-notice"
      data-age-fit={fit}
      aria-labelledby="hard-moments-age-title"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}
        >
          <Icon name="menu_book" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3
            id="hard-moments-age-title"
            className="break-words text-base font-semibold leading-snug"
            style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
          >
            {tGCare(locale, "elev.gcare.hm.age.title")}
          </h3>
          <p className="mt-1.5 break-words text-sm leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>
            {tGCare(locale, `elev.gcare.hm.age.body.${fit}`, vars)}
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--arbor-muted)" }}>
            <bdi>{range}</bdi>
          </p>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
            {tGCare(locale, "elev.gcare.hm.age.elsewhere")}
          </p>
        </div>
      </div>
    </section>
  );
}
