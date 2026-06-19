/**
 * ShareButton (mk-p0-3) — the calm/premium parent-register primitive that drives
 * the 1-tap branded share for every loop artifact. Renders the card on-device,
 * opens the native/web share sheet (download fallback), and fires the loop
 * events — all via lib/share.ts. NOT a playkit component.
 *
 * States: default · loading ("Preparing…", spinner after 150ms, aria-busy) ·
 * empty (hidden when there's nothing to share) · error (inline, aria-live).
 * Cancel of the OS sheet is silent. a11y: real <button>, descriptive aria-label,
 * focus-visible ring; motion (scale + spinner) is auto-gated by the global
 * reduced-motion guard in index.css.
 */
import React, { useEffect, useRef, useState } from "react";
import { Share2, RefreshCw } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { shareCard } from "../../lib/share";
import { api } from "../../lib/api";
import { loadAttribution } from "../../lib/attribution";
import type { LoopArtifact } from "../../lib/loopEvents";
import type { ShareCardOpts } from "../../lib/shareCard";

let cachedRefCode: string | null | undefined; // module cache: fetch the code at most once

async function resolveRefCode(): Promise<string | undefined> {
  if (cachedRefCode !== undefined) return cachedRefCode ?? undefined;
  try {
    const info = await api.referralCode();
    cachedRefCode = info.code;
  } catch {
    cachedRefCode = null; // don't block the share; ship UTM-only
  }
  return cachedRefCode ?? undefined;
}

export function ShareButton({
  artifact,
  surface,
  getCardOpts,
  captionKey,
  label,
  variant = "ghost",
  childName,
}: {
  artifact: LoopArtifact;
  surface: string;
  /** Lazily supplies the card data at tap time (avoids rendering work on mount). */
  getCardOpts: () => ShareCardOpts;
  /** i18n caption key; defaults to share.caption.<artifact-ish>. */
  captionKey?: string;
  label?: string;
  variant?: "solid" | "ghost";
  /** Child name for the aria-label ("Share Maya's hero card"). */
  childName?: string;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const [error, setError] = useState(false);
  const [announce, setAnnounce] = useState("");
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; if (spinTimer.current) clearTimeout(spinTimer.current); }, []);

  const defaultLabel = label ?? t(`share.cta.${ctaKey(artifact)}`);
  const caption = captionKey ?? `share.caption.${captionFor(artifact)}`;

  const onShare = async () => {
    if (busy) return;
    setError(false);
    setAnnounce("");
    setBusy(true);
    // Show the spinner only after 150ms to avoid flicker on fast renders.
    spinTimer.current = setTimeout(() => { if (mounted.current) setShowSpinner(true); }, 150);

    const opts = getCardOpts();
    const refCode = await resolveRefCode();
    const market = loadAttribution()?.market;
    const res = await shareCard({
      artifact,
      surface,
      opts,
      captionTemplate: t(caption), // raw "{name}…{url}" — share.ts fills both
      refCode,
      market,
    });

    if (spinTimer.current) clearTimeout(spinTimer.current);
    if (!mounted.current) return;
    setBusy(false);
    setShowSpinner(false);
    if (res.ok) {
      setAnnounce(defaultLabel);
    } else if ("error" in res) {
      setError(true);
      setAnnounce(t("share.error"));
    }
    // cancelled → silent, no announce, no error
  };

  const solid = variant === "solid";
  const aria = childName ? `${defaultLabel} — ${childName}` : defaultLabel;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => { void onShare(); }}
        disabled={busy}
        aria-label={aria}
        aria-busy={busy}
        className="inline-flex items-center justify-center gap-1.5 font-bold text-[13px] rounded-full px-4 min-h-[44px] transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--arbor-clay)] focus-visible:ring-offset-1 disabled:opacity-60"
        style={
          solid
            ? { background: "var(--arbor-clay)", color: "#fff" }
            : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule)" }
        }
      >
        {showSpinner ? <RefreshCw className="w-4 h-4 animate-spin" aria-hidden /> : <Share2 className="w-4 h-4" aria-hidden />}
        {busy ? t("share.preparing") : defaultLabel}
      </button>
      {error && (
        <span className="text-[11px] font-semibold" style={{ color: "var(--arbor-pink-ink)" }}>
          {t("share.error")}
        </span>
      )}
      <span className="sr-only" aria-live="polite">{announce}</span>
    </div>
  );
}

/** share.cta.<key> — map the artifact union to the copy keys in i18n. */
function ctaKey(a: LoopArtifact): string {
  return a === "answer_card" ? "answer" : a === "growth_card" ? "growth" : a; // avatar | story
}

/** share.caption.<key> — map the artifact union to the caption keys. */
function captionFor(a: LoopArtifact): string {
  return a === "answer_card" ? "answer" : a === "growth_card" ? "growth" : a; // avatar | story
}

export default ShareButton;
