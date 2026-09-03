import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import { isNativePlatform } from "../../lib/runtime";
import { LEGAL_LINKS, LEGAL_LINK_ORDER, legalLabelKey, openLegalLink } from "../../lib/legalLinks";

/**
 * MOB-01 — one Privacy · Terms · Support row, mounted in exactly three
 * places: the onboarding consent block, the Settings footer and the paywall
 * footer (legalLinks.test.ts pins the mounts). URLs come from ONE constant
 * (lib/legalLinks.ts). Web renders real anchors (`target=_blank`,
 * `rel=noopener`); native opens the in-app browser via the dynamic-import
 * pattern — a plain `<a target=_blank>` is a dead tap inside a WKWebView.
 */
export function LegalLinks({ className = "", align = "start" }: { className?: string; align?: "start" | "center" }) {
  const { t } = useLanguage();
  const justify = align === "center" ? "justify-center" : "justify-start";

  return (
    <nav
      aria-label={t("elev.storeshell.legal.aria")}
      className={`flex flex-wrap items-center gap-x-1 gap-y-1 text-[11px] font-semibold ${justify} ${className}`}
      style={{ color: "var(--arbor-muted)" }}
    >
      {LEGAL_LINK_ORDER.map((key, i) => (
        <React.Fragment key={key}>
          {i > 0 && <span aria-hidden="true">·</span>}
          {isNativePlatform ? (
            <button
              type="button"
              onClick={() => void openLegalLink(key, { isNative: true })}
              className="inline-flex items-center min-h-[44px] px-1.5 underline-offset-2 hover:underline"
              style={{ color: "inherit" }}
            >
              {t(legalLabelKey(key))}
            </button>
          ) : (
            <a
              href={LEGAL_LINKS[key]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center min-h-[44px] px-1.5 underline-offset-2 hover:underline"
              style={{ color: "inherit" }}
            >
              {t(legalLabelKey(key))}
            </a>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

export default LegalLinks;
