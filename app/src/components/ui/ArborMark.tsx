import React, { useId } from "react";
import { useLanguage } from "../../context/LanguageContext";

/**
 * Arbor brand mark — the original layered gradient leaf/figure. Gradient IDs are
 * made unique per instance (useId) so multiple marks on one page (e.g. sidebar +
 * mobile header) don't share/clobber each other's <defs>.
 */
export function ArborMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  const { t } = useLanguage();
  const uid = useId().replace(/:/g, "");
  const teal = `arb-teal-${uid}`;
  const purple = `arb-purple-${uid}`;
  const orange = `arb-orange-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      role="img"
      aria-label={t("aria.arborMark")}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={teal} x1="54" y1="6" x2="28" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#18F0D2" />
          <stop offset="50%" stopColor="#38C8F0" />
          <stop offset="100%" stopColor="#68B4FF" />
        </linearGradient>
        <linearGradient id={purple} x1="12" y1="90" x2="46" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#CCA8FF" />
          <stop offset="100%" stopColor="#A07AF8" />
        </linearGradient>
        <radialGradient id={orange} cx="36%" cy="28%" r="62%">
          <stop offset="0%" stopColor="#FFC07A" />
          <stop offset="100%" stopColor="#FF5822" />
        </radialGradient>
      </defs>
      <path d="M40 88 C40 50 52 22 65 16 C78 22 90 50 90 88 L76 88 C76 56 70 32 65 32 C60 32 54 56 54 88Z" fill="#1B2898" />
      <path d="M14 88 C12 72 16 54 28 42 C34 36 42 34 46 40 C44 52 40 66 38 76 C36 82 28 88 20 88Z" fill={`url(#${purple})`} />
      <path d="M52 6 C62 14 66 32 62 50 C60 62 54 74 44 80 C36 84 28 80 22 72 C18 64 18 50 22 38 C28 24 38 8 52 6Z" fill={`url(#${teal})`} />
      <circle cx="78" cy="15" r="12" fill={`url(#${orange})`} />
    </svg>
  );
}

export default ArborMark;
