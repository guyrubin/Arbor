import React, { useState } from "react";
import { Icon } from "../ui/Icon";
import type { HardMomentCard } from "../../content/hardMomentCards";
import type { ContentLocale } from "../../content/governance";
import { hardMomentPublication } from "../../content/pilotRelease";
import { publicGuideContext, publicGuideShareUrl } from "../../content/publicHardMoments";
import { locText } from "../../content/hardMomentSurface";
import { translate } from "../../lib/i18n";
import { PUBLIC_WEB_ORIGIN } from "../../lib/publicWebOrigin";

/** The share payload is generic by construction; no child-related prop exists. */
export function PublicGuideShare({ card, locale }: { card: HardMomentCard; locale: ContentLocale }) {
  const [state, setState] = useState<"idle" | "shared" | "copied" | "error">("idle");
  const [busy, setBusy] = useState(false);
  const t = (key: string) => translate(locale, `elev.guides.${key}`);
  const url = publicGuideShareUrl(card.id, locale, PUBLIC_WEB_ORIGIN);
  if (!url || !hardMomentPublication(card, publicGuideContext(card, { locale, age: null }))) return null;

  const share = async () => {
    if (busy || !hardMomentPublication(card, publicGuideContext(card, { locale, age: null }))) return;
    setBusy(true);
    setState("idle");
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: `${locText(card.title, locale)} · Arbor`, url });
          setState("shared");
          return;
        } catch (error) {
          if ((error as { name?: string })?.name === "AbortError") return;
        }
      }
      if (!navigator.clipboard?.writeText) { setState("error"); return; }
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch { setState("error"); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-w-0 space-y-2" data-testid="public-guide-share">
      <button type="button" disabled={busy} onClick={() => void share()}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
        style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}>
        <Icon name="share" size={18} /> {t("share")}
      </button>
      <p className="text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("shareHint")}</p>
      <p role="status" aria-live="polite" className="text-sm" style={{ color: "var(--arbor-ink-soft)" }}>
        {state === "shared" ? t("shared") : state === "copied" ? t("copied") : state === "error" ? t("copyFailed") : ""}
      </p>
      {state === "error" && <div>
        <label htmlFor={`guide-link-${card.id}`} className="sr-only">{t("link")}</label>
        <input id={`guide-link-${card.id}`} value={url} readOnly dir="ltr" onFocus={(event) => event.currentTarget.select()}
          className="min-h-11 w-full min-w-0 rounded-xl px-3 text-sm" style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule-strong)" }} />
      </div>}
    </div>
  );
}
