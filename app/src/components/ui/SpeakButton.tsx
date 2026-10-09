import { Icon } from "./Icon";
import { useArborVoice } from "../../hooks/useArborVoice";
import { useToastOptional } from "../../context/ToastContext";
import { translate, type UiLang } from "../../lib/i18n";

/**
 * The one read-aloud control. Wraps `useArborVoice` so every spoken-output button
 * across the app shares one engine, one interrupt model, and one honest voice
 * indicator. Renders nothing when the device has no speech support (no dead
 * control). The neural-TTS upgrade flips the engine label to "Natural" with no
 * change here. Localized via an explicit `lang` prop (no context dependency, so
 * it is safe to render anywhere, including tests — the toast context is
 * consumed optionally for the same reason).
 *
 * F-03: playback failures (e.g. autoplay-blocked audio after both engines
 * fail) surface as an error toast — never a silent no-op button.
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
  const toastCtx = useToastOptional();
  if (!supported || !text.trim()) return null;

  const he = lang === "he";
  const uiLang: UiLang = he ? "he" : "en";
  const idle = label ?? (he ? "הקראה" : "Read aloud");
  const stopLabel = he ? "עצירה" : "Stop";
  const engineNote = engine === "natural" ? (he ? "קול טבעי" : "Natural voice") : he ? "קול בסיסי" : "Basic voice";
  const dim = size === "md" ? 16 : 14;

  const onError = () => {
    const message = translate(uiLang, "voice.toast.blocked");
    if (toastCtx) toastCtx.toast(message, "error");
    else console.warn(`[voice] ${message}`);
  };

  return (
    <button
      type="button"
      onClick={() => toggle(text, { onError })}
      aria-pressed={speaking}
      aria-label={speaking ? stopLabel : `${idle} — ${engineNote}`}
      title={engineNote}
      // The control opens with an <Icon> ligature (Latin text), so dir="auto"
      // would resolve a Hebrew label LTR; the label's language is `lang`.
      dir={he ? "rtl" : "ltr"}
      className={`inline-flex items-center gap-1 font-bold transition ${className}`}
      style={{ color: speaking ? "var(--arbor-green-ink)" : "var(--arbor-muted)" }}
    >
      {speaking ? (
        <Icon name="volume_off" size={dim} className="motion-safe:animate-pulse" />
      ) : (
        <Icon name="volume_up" size={dim} />
      )}
      <span>{speaking ? stopLabel : idle}</span>
    </button>
  );
}

export default SpeakButton;
