import { Sprout } from "lucide-react";

/**
 * V4 — the gentle "days of moments" chip on Today.
 *
 * AADC-hardened by construction: it only appears once a calm rhythm exists
 * (>= 2 days), never shows a "broken"/at-risk state, and frames the count as
 * moments *logged* — there is no streak-loss UI anywhere. Purely presentational.
 */
export function StreakChip({ days, lang }: { days: number; lang: "en" | "he" }) {
  if (days < 2) return null;
  const label = lang === "he" ? `${days} ימים של רגעים` : `${days} days of moments`;
  const title =
    lang === "he"
      ? "קצב עדין — בלי לחץ, תמיד אפשר להמשיך מתי שמתאים"
      : "A gentle rhythm — no pressure, pick it back up whenever";
  return (
    <span
      dir="auto"
      title={title}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold mt-2"
      style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
    >
      <Sprout className="w-3.5 h-3.5" aria-hidden />
      {label}
    </span>
  );
}

export default StreakChip;
