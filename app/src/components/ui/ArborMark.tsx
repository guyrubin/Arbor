import React from "react";
import { useLanguage } from "../../context/LanguageContext";

/**
 * Arbor brand mark — the brand master (Guy, 9 Oct 2026: the brand PNG is the
 * one mark for the app, the app icon and the splash; B-DESIGN-07). Rendered
 * from /brand/arbor-mark-{128,256}.webp (transparent, from
 * public/brand/arbor-mark-transparent.png); the store/launcher icon is built
 * from the same drawing (assets/icon-only.png). Same API as the old inline SVG.
 */
export function ArborMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  const { t } = useLanguage();
  return (
    <img
      src="/brand/arbor-mark-128.webp"
      srcSet="/brand/arbor-mark-128.webp 1x, /brand/arbor-mark-256.webp 2x"
      width={size}
      height={size}
      alt={t("aria.arborMark")}
      className={className}
      decoding="async"
      draggable={false}
      style={{ display: "inline-block", flexShrink: 0, objectFit: "contain" }}
    />
  );
}

export default ArborMark;
