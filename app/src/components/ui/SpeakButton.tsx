import { Volume2, VolumeX } from "lucide-react";
import { useArborVoice } from "../../hooks/useArborVoice";

/**
 * The one read-aloud control. Wraps `useArborVoice` so every spoken-output button
 * across the app shares one engine, one interrupt model, and one honest voice
 * indicator. Renders nothing when the device has no speech support (no dead
 * control). The neural-TTS upgrade flips the engine label to "Natural" with no
 * change here. Localized via an explicit `lang` prop (no context dependency, so
 * it is safe to render anywhere, including tests).
 */
export function SpeakButton({
  text,
  lang = "en",
  label,
  size = "sm",
  className = "",
}: {
  text: string;
  /** UI locale; only Hebrew is special-cased, everything else reads as English. */
  lang?: string;
  /** Idle label override (e.g. "Say it aloud"). */
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const { supported, speaking, engine, toggle } = useArborVoice();
  if (!supported || !text.trim()) return null;

  const he = lang === "he";
  const idle = label ?? (he ? "הקראה" : "Read aloud");
  const stopLabel = he ? "עצירה" : "Stop";
  const engineNote = engine === "natural" ? (he ? "קול טבעי" : "Natural voice") : he ? "קול בסיסי" : "Basic voice";
  const dim = size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";

  return (
    <button
      type="button"
      onClick={() => toggle(text)}
      aria-pressed={speaking}
      aria-label={speaking ? stopLabel : `${idle} — ${engineNote}`}
      title={engineNote}
      dir="auto"
      className={`inline-flex items-center gap-1 font-bold transition ${className}`}
      style={{ color: speaking ? "var(--arbor-green-ink)" : "var(--arbor-muted)" }}
    >
      {speaking ? (
        <VolumeX className={`${dim} motion-safe:animate-pulse`} aria-hidden />
      ) : (
        <Volume2 className={dim} aria-hidden />
      )}
      <span>{speaking ? stopLabel : idle}</span>
    </button>
  );
}

export default SpeakButton;
