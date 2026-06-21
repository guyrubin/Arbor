import { Sparkles } from "lucide-react";

/**
 * S4 — visible provenance badge for AI-generated art.
 *
 * Arbor's image model (Gemini 2.5 Flash Image) embeds Google **SynthID** plus
 * **C2PA Content Credentials** on every generated image, so each one is always
 * identifiable as AI-made. That provenance was invisible to parents; this makes
 * it a first-class trust signal (the trust-as-product wedge) on the surfaces
 * where generated art appears. Claims only what the pipeline actually applies.
 */
export function ProvenanceBadge({
  lang = "en",
  className = "",
}: {
  lang?: "en" | "he";
  className?: string;
}) {
  const label = lang === "he" ? "נוצר ב‑AI" : "AI-made";
  const title =
    lang === "he"
      ? "נוצר על‑ידי ה‑AI של Arbor ומסומן בחותם בלתי נראה (Google SynthID + C2PA) כדי שתמיד אפשר יהיה לזהות שזו יצירת AI."
      : "Created by Arbor's AI and invisibly watermarked (Google SynthID + C2PA Content Credentials) so it's always identifiable as AI-made.";
  return (
    <span
      title={title}
      dir="auto"
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${className}`}
      style={{ background: "rgba(15,23,20,0.55)", color: "#fff", backdropFilter: "blur(4px)" }}
    >
      <Sparkles className="w-3 h-3" aria-hidden />
      {label}
    </span>
  );
}

export default ProvenanceBadge;
