import React from "react";
import { createPortal } from "react-dom";
import { useDialog } from "../../hooks/useDialog";
import Icon from "../ui/Icon";
import MicrophoneNotice from "../ui/MicrophoneNotice";
import { translate, type UiLang } from "../../lib/i18n";

/**
 * VoiceOverlay (AI-V7, 2026-07-25 AI-excellence Wave 1) — the calm voice
 * surface. A bottom sheet over the coach thread, owned by voicePhase !== "off"
 * in CoachTab (the composer voice chip stays the SOLE entry point — this
 * overlay opens no new capture path and sends nothing itself).
 *
 * What it shows, per phase (all four visually distinct WITHOUT reading text):
 *  - listening: soft-pulsing orb, a phase halo plus the real live transcript;
 *  - thinking:  slow shimmer;
 *  - speaking:  waveform bars;
 *  - off:       the sheet is unmounted by the owner.
 *
 * Captions are dir="auto" + aria-live and render ONLY the parent's own words
 * (interim transcript) and the already-screened /voice / Live-guard output —
 * never unscreened model text (SAFE-V1 / VC-1 provenance holds upstream).
 *
 * Register: calm parent, GREEN primary, tokens only. Full RTL mirroring via
 * dir + logical utilities. prefers-reduced-motion (passed by the owner from
 * usePrefersReducedMotion) renders static phase states — no keyframes, no
 * mic-driven motion — while keeping the phases distinct by shape.
 *
 * Tap-orb = barge-in (AI-V2(a), browser fallback loop only), X = end voice.
 */

// S5: "connecting" joins the phase set — the sheet opens the instant the
// parent taps Talk, BEFORE the token mint / mic prompt / socket connect, so
// the start window is a visible (and cancellable via X) state, never silence.
export type VoiceOverlayPhase = "connecting" | "listening" | "thinking" | "speaking";

export type OrbMode = "pulse" | "shimmer" | "wave" | "static";

/** Pure phase → orb visual mapping (unit-tested; reduced motion = static).
 *  connecting shares the shimmer animation with thinking but keeps its own
 *  icon + label, so the phases stay distinguishable without reading text. */
export function orbMode(phase: VoiceOverlayPhase, reducedMotion: boolean): OrbMode {
  if (reducedMotion) return "static";
  if (phase === "listening") return "pulse";
  if (phase === "thinking" || phase === "connecting") return "shimmer";
  return "wave";
}

// The recording owner alone opens the microphone. Opening another stream here
// can contend with Chrome's speech service and makes presentation own capture.
// The phase pulse and real transcript provide feedback without another grant.

// Static bar heights (px) for the speaking waveform — motion comes from the
// vo-wave keyframes; under reduced motion these exact heights render frozen,
// which still reads as "sound" next to the plain listening/thinking orbs.
const WAVE_BARS = [10, 22, 30, 22, 10];

export default function VoiceOverlay({
  phase,
  notice,
  lang,
  interimText,
  answerText,
  canInterrupt,
  reducedMotion,
  onOrbTap,
  onClose,
}: {
  phase: VoiceOverlayPhase;
  notice?: string | null;
  lang: UiLang;
  /** The parent's own words, live while they speak (dir="auto"). */
  interimText: string;
  /** The already-screened streaming answer (same text that is spoken). */
  answerText: string;
  /** True only on the browser fallback loop while speaking (AI-V2(a)). */
  canInterrupt: boolean;
  reducedMotion: boolean;
  onOrbTap: () => void;
  onClose: () => void;
}) {
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const mode = orbMode(phase, reducedMotion);
  const { ref: dialogRef, requestClose } = useDialog<HTMLElement>({ open: true, onClose });
  const phaseLabel = t(`coach.voice.${phase}`);

  const overlay = (
    <section
      ref={dialogRef}
      tabIndex={-1}
      data-arbor-dialog-layer
      aria-modal="true"
      role="dialog"
      aria-label={t("coach.voice.overlay.aria")}
      dir={lang === "he" ? "rtl" : "ltr"}
      data-phase={phase}
      data-orb-mode={mode}
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[640px] rounded-t-[28px] border border-b-0 px-5 pb-6 pt-4"
      style={{ background: "var(--arbor-paper-elevated)", borderColor: "var(--arbor-rule)", boxShadow: "var(--shadow-lg)" }}
    >
      {!reducedMotion && (
        <style>{`
          @media (prefers-reduced-motion: no-preference) {
            @keyframes vo-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
            @keyframes vo-shimmer { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
            @keyframes vo-wave { 0%, 100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }
          }
        `}</style>
      )}

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--arbor-green-ink)" }}>
          {phaseLabel}
        </span>
        <button
          type="button"
          onClick={requestClose}
          aria-label={t("coach.voice.end")}
          className="touch-target ms-auto flex h-11 w-11 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{ minWidth: "var(--touch-min)", minHeight: "var(--touch-min)", background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="mt-2 flex flex-col items-center">
        {/* Listening halo follows the phase without opening another microphone. */}
        <div className="relative flex items-center justify-center" style={{ width: 112, height: 112 }}>
          {mode === "pulse" && (
            <div
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                background: "var(--arbor-green-soft)",
                transform: "scale(1.08)",
                transition: "transform 90ms linear",
              }}
            />
          )}
          <button
            type="button"
            onClick={onOrbTap}
            disabled={!canInterrupt}
            aria-label={canInterrupt ? t("coach.voice.interrupt") : phaseLabel}
            className="relative flex h-24 w-24 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-default"
            style={{
              background: "var(--arbor-green-soft)",
              color: "var(--arbor-green-ink)",
              border: "1px solid var(--arbor-rule-strong)",
              animation:
                mode === "pulse"
                  ? "vo-pulse 1.8s ease-in-out infinite"
                  : mode === "shimmer"
                    ? "vo-shimmer 2.4s ease-in-out infinite"
                    : undefined,
            }}
          >
            {phase === "speaking" ? (
              <span className="flex items-end gap-1" aria-hidden>
                {WAVE_BARS.map((h, i) => (
                  <span
                    key={i}
                    className="w-1.5 rounded-full"
                    style={{
                      height: h,
                      background: "var(--arbor-sage)",
                      ...(mode === "wave"
                        ? { animation: `vo-wave 1.1s ease-in-out ${i * 0.12}s infinite`, transformOrigin: "center bottom" }
                        : {}),
                    }}
                  />
                ))}
              </span>
            ) : (
              <Icon name={phase === "listening" ? "mic" : phase === "connecting" ? "progress_activity" : "more_horiz"} size={34} fill={1} />
            )}
          </button>
        </div>
        {canInterrupt && (
          <p className="mt-2 text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>
            {t("coach.voice.interrupt")}
          </p>
        )}
      </div>

      {notice && <MicrophoneNotice message={notice} lang={lang} />}

      {/* Live captions — always mounted so aria-live announces reliably.
          Interim = the parent's own words; answer = screened voice output. */}
      <div className="mt-3 max-h-28 space-y-1.5 overflow-y-auto text-center">
        <p dir="auto" aria-live="polite" className="min-h-[1.25rem] text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
          {interimText}
        </p>
        <p dir="auto" aria-live="polite" className="min-h-[1.25rem] text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
          {answerText}
        </p>
      </div>
    </section>
  );
  // Keep static markup tests/server rendering free of DOM and media effects.
  return typeof document === "undefined" ? overlay : createPortal(
    <div className="arbor-app arbor-parent" style={{ display: "contents" }}>{overlay}</div>, document.body,
  );
}
