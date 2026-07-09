import React, { useEffect, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { prefersReducedMotion } from "../../lib/devscore";
import { PASTEL } from "../../lib/tokens";
import { HeroAvatar, useHeroAvatar } from "./HeroAvatar";
import { ShareButton } from "./ShareButton";
import { Icon } from "./Icon";
import type { ShareCardOpts } from "../../lib/shareCard";

/* ════════════════════════════════════════════════════════════════════════════
   CelebrationMoment — the E7 celebration grammar, once, for parent surfaces.

   A calm parent-side card for a newly noticed milestone: the child's hero
   (the ONE shared HeroAvatar engine, neutral presentation — no comic ring,
   no bob), ONE warm sentence, and ONE parent-mediated share affordance wired
   to the EXISTING share pipeline (ShareButton → lib/share.ts → shareCard.ts,
   growth_card artifact — never a new pipeline).

   Motion: a single one-shot rise-fade entrance (the HubHero CSS grammar),
   collapsed to an instant render under prefers-reduced-motion. Never loops.
   KID DARK-PATTERN BAN: no streaks/countdowns/urgency; renders AT MOST ONCE
   per browser session (sessionStorage guard), so the celebration — and its
   share prompt — can never nag.
   CLINICAL FIREWALL: presentation only; the copy is factual noticing (no %,
   score, verdict, or delta) and callers must keep it that way.
   CHILD DATA: zero capture here. The avatar comes from the existing
   consent-gated /generate-avatar output via useHeroAvatar; a real photo is
   NEVER embedded in the share card (generated hero only); Sprout fallback
   keeps the card warm when no hero exists yet.
   RTL: logical properties only. Dismiss + share targets ≥44px.
   ════════════════════════════════════════════════════════════════════════════ */

const SESSION_KEY = "arbor.elev.celebrate.shown";

export function CelebrationMoment({
  firstName,
  onDismiss,
  testId,
}: {
  /** Child first name (no surname). Optional — copy degrades gracefully. */
  firstName?: string;
  /** Persists/clears the data trigger upstream (e.g. usePrideMoment.dismiss). */
  onDismiss: () => void;
  testId?: string;
}) {
  const { t } = useLanguage();
  const { url, isGenerated } = useHeroAvatar();

  // ≤1 render per session: read-only in the initializer (pure), claim the
  // slot in the mount effect (idempotent under StrictMode double-invoke).
  // The instance that claimed the slot keeps rendering while mounted.
  const [allowed] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === null;
    } catch {
      return true; // storage unavailable — show rather than dead-end
    }
  });
  useEffect(() => {
    if (!allowed) return;
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* storage unavailable — worst case it shows again next session */
    }
  }, [allowed]);

  // One-shot rise-fade entrance (HubHero grammar): `entered` starts true under
  // prefers-reduced-motion, so no transition ever fires; otherwise one rAF tick.
  const [entered, setEntered] = useState(() => prefersReducedMotion());
  useEffect(() => {
    if (entered) return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [entered]);

  if (!allowed) return null;

  const p = PASTEL.mint; // parent register tone
  const title = firstName
    ? t("elev.celebrate.title", { name: firstName })
    : t("elev.celebrate.titleGeneric");
  const sub = t("elev.celebrate.sub");

  // Share-card data at tap time. Face-safety: only the generated (descriptor)
  // hero may be embedded in a shareable image — a real photo never is.
  const getCardOpts = (): ShareCardOpts => ({
    headline: title,
    sub,
    imageUrl: isGenerated && url ? url : undefined,
    name: firstName,
  });

  return (
    <section
      data-testid={testId}
      role="status"
      className="relative overflow-hidden rounded-[22px] p-5 text-start"
      style={{
        background: p.soft,
        border: "1px solid var(--arbor-rule)",
        opacity: entered ? 1 : 0,
        transform: entered ? "none" : "translateY(10px)",
        transition: "opacity 0.45s ease, transform 0.45s ease",
      }}
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("pride.dismiss")}
        className="absolute grid place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={{ insetInlineEnd: 4, top: 4, width: 44, height: 44, color: p.ink }}
      >
        <Icon name="close" size={18} />
      </button>

      <div className="flex items-center gap-3 pe-11">
        {/* The ONE shared hero engine — neutral parent presentation (no comic
            ring, no bob loop); Sprout fallback when no hero exists yet. */}
        <HeroAvatar size={48} animate={false} ring={false} decorative />
        <div className="min-w-0">
          <p
            className="text-[15px] font-extrabold leading-tight"
            style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
          >
            {title}
          </p>
          <p className="text-[12.5px] mt-0.5" style={{ color: p.ink }}>
            {sub}
          </p>
        </div>
      </div>

      {/* ONE parent-mediated share affordance — existing pipeline, existing
          growth_card artifact + pride.shareCaption copy. ≤1/session by the
          card's own session guard above. */}
      <div className="mt-3">
        <ShareButton
          artifact="growth_card"
          surface="today"
          childName={firstName}
          getCardOpts={getCardOpts}
          captionKey="pride.shareCaption"
          label={t("pride.shareCard")}
          variant="ghost"
        />
      </div>
    </section>
  );
}

export default CelebrationMoment;
