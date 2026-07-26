import React, { useEffect, useRef } from "react";
import Icon from "../ui/Icon";
import { translate, type UiLang } from "../../lib/i18n";

/**
 * VoiceOverlay (AI-V7, 2026-07-25 AI-excellence Wave 1) — the calm voice
 * surface. A bottom sheet over the coach thread, owned by voicePhase !== "off"
 * in CoachTab (the composer voice chip stays the SOLE entry point — this
 * overlay opens no new capture path and sends nothing itself).
 *
 * What it shows, per phase (all four visually distinct WITHOUT reading text):
 *  - listening: soft-pulsing orb, halo driven by the REAL mic level (an
 *    AnalyserNode on one shared getUserMedia stream for the whole session);
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

export type VoiceOverlayPhase = "listening" | "thinking" | "speaking";

export type OrbMode = "pulse" | "shimmer" | "wave" | "static";

/** Pure phase → orb visual mapping (unit-tested; reduced motion = static). */
export function orbMode(phase: VoiceOverlayPhase, reducedMotion: boolean): OrbMode {
  if (reducedMotion) return "static";
  if (phase === "listening") return "pulse";
  if (phase === "thinking") return "shimmer";
  return "wave";
}

/**
 * Real mic level → a CSS custom property on the halo element (no React state:
 * a 60fps setState would re-render the whole sheet every frame). One
 * getUserMedia stream is opened per overlay mount and shared across phase
 * changes; it is fully released on unmount/deactivation.
 */
function useMicLevel(active: boolean, haloRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    if (typeof AudioContext === "undefined") return;
    let raf = 0;
    let ctx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(s);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const level = Math.min(1, Math.sqrt(sum / buf.length) * 3);
          haloRef.current?.style.setProperty("--vo-level", level.toFixed(3));
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch(() => {
        /* mic denied/unavailable — the orb still pulses via CSS, captions still work */
      });
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close().catch(() => {});
      haloRef.current?.style.removeProperty("--vo-level");
    };
  }, [active, haloRef]);
}

// Static bar heights (px) for the speaking waveform — motion comes from the
// vo-wave keyframes; under reduced motion these exact heights render frozen,
// which still reads as "sound" next to the plain listening/thinking orbs.
const WAVE_BARS = [10, 22, 30, 22, 10];

export default function VoiceOverlay({
  phase,
  lang,
  interimText,
  answerText,
  canInterrupt,
  reducedMotion,
  onOrbTap,
  onClose,
}: {
  phase: VoiceOverlayPhase;
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
  const haloRef = useRef<HTMLDivElement | null>(null);
  useMicLevel(phase === "listening" && !reducedMotion, haloRef);
  const phaseLabel = t(`coach.voice.${phase}`);

  return (
    <section
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
          onClick={onClose}
          aria-label={t("coach.voice.end")}
          className="ms-auto flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="mt-2 flex flex-col items-center">
        {/* Mic-level halo (listening only): scales with --vo-level set by the
            AnalyserNode loop — pure CSS var, zero re-renders. */}
        <div className="relative flex items-center justify-center" style={{ width: 112, height: 112 }}>
          {mode === "pulse" && (
            <div
              ref={haloRef}
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                background: "var(--arbor-green-soft)",
                transform: "scale(calc(1 + var(--vo-level, 0) * 0.35))",
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
              <Icon name={phase === "listening" ? "mic" : "more_horiz"} size={34} fill={1} />
            )}
          </button>
        </div>
        {canInterrupt && (
          <p className="mt-2 text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>
            {t("coach.voice.interrupt")}
          </p>
        )}
      </div>

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
}
