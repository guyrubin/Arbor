import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, Sparkles, Camera, Wand2, ShieldCheck } from "lucide-react";
import { api, type AvatarStyle, type AvatarDescriptors } from "../../lib/api";
import { fileToThumbnail } from "../../lib/image";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { Avatar } from "../ui/Avatar";
import { ShareButton } from "../ui/ShareButton";

/**
 * AVA-1 / AVA-2 — the Avatar Creator. Turns descriptors (default, no face) or an
 * optional, consent-gated reference photo into a STYLIZED character via
 * /api/generate-avatar. The reference photo is used only for the single generation
 * call and is never stored. Returns the generated image to the caller.
 */

const STYLES: { id: AvatarStyle; label: string }[] = [
  { id: "comichero", label: "Comic hero" },
  { id: "storybook", label: "Storybook" },
  { id: "soft3d", label: "Soft 3D" },
  { id: "watercolor", label: "Watercolor" },
  { id: "flat", label: "Flat & cute" }
];

type Result = { dataUrl: string; style: AvatarStyle; source: "descriptor" | "photo" };

export default function AvatarCreator({
  open,
  childId,
  childName,
  onClose,
  onCreated
}: {
  open: boolean;
  childId: string;
  childName: string;
  onClose: () => void;
  onCreated: (result: Result) => void;
}) {
  const [mode, setMode] = useState<"describe" | "photo">("describe");
  const [style, setStyle] = useState<AvatarStyle>("comichero");
  const [descriptors, setDescriptors] = useState<AvatarDescriptors>({});
  const [consent, setConsent] = useState(false);
  const [refPhoto, setRefPhoto] = useState<string | undefined>();
  const [result, setResult] = useState<string | undefined>();
  const [photoError, setPhotoError] = useState<string | undefined>();
  const { openPaywall } = useArbor();
  const { t } = useLanguage();

  // M4: loading + error + start/success/error analytics for the generation call.
  // A 402 opens the paywall (conversion moment) instead of an inline error.
  const avatar = useAsyncAction(
    "avatar_create",
    async (input: { style: AvatarStyle; mode: "describe" | "photo"; refPhoto?: string; descriptors: AvatarDescriptors }) => {
      // COPPA: the photo path processes a face, so record the parent's
      // face_processing consent BEFORE the server runs the gated generation.
      if (input.mode === "photo" && input.refPhoto) {
        await api.grantConsent({ childId, purpose: "face_processing" });
      }
      return api.generateAvatar({
        childId,
        style: input.style,
        ...(input.mode === "photo" && input.refPhoto ? { photo: { dataUrl: input.refPhoto } } : { descriptors: input.descriptors }),
      });
    },
    {
      fallbackError: t("gen.avatar.fail"),
      onPaywall: (err) => openPaywall(err.feature || "avatarGenerate", err.plan),
    },
  );
  const generating = avatar.loading;
  const error = photoError ?? avatar.error ?? undefined;

  const reset = () => {
    setMode("describe"); setStyle("comichero"); setDescriptors({}); setConsent(false);
    setRefPhoto(undefined); setResult(undefined); setPhotoError(undefined); avatar.clearError();
  };
  const close = () => { reset(); onClose(); };

  const onPickPhoto = async (file?: File) => {
    if (!file) return;
    setPhotoError(undefined);
    try {
      // Downscale on-device before it ever leaves the browser.
      setRefPhoto(await fileToThumbnail(file, 512, 0.85));
    } catch {
      setPhotoError("Couldn't read that image.");
    }
  };

  const generate = async () => {
    setPhotoError(undefined);
    setResult(undefined);
    const res = await avatar.run({ style, mode, refPhoto, descriptors });
    if (res) setResult(res.dataUrl);
  };

  const use = () => {
    if (!result) return;
    onCreated({ dataUrl: result, style, source: mode === "photo" && refPhoto ? "photo" : "descriptor" });
    close();
  };

  const canGenerate = mode === "describe" || (mode === "photo" && consent && !!refPhoto);

  const inputStyle: React.CSSProperties = { background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" };
  const field = (label: string, key: keyof AvatarDescriptors, placeholder: string) => (
    <div className="space-y-1.5">
      <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{label}</label>
      <input
        value={descriptors[key] || ""}
        onChange={(e) => setDescriptors((d) => ({ ...d, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full rounded-xl px-4 py-2.5 text-xs focus:outline-none"
        style={inputStyle}
      />
    </div>
  );

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="arbor-app fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(41,51,63,0.45)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Create an avatar"
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-6"
            style={{ border: "1px solid var(--arbor-rule)", boxShadow: "0 24px 64px rgba(41,51,63,0.18)" }}
            initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-extrabold tracking-tight flex items-center gap-2" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                <Sparkles className="w-4 h-4" style={{ color: "var(--arbor-clay)" }} /> Create {childName}&apos;s avatar
              </h3>
              <button onClick={close} className="p-1.5 rounded-lg transition" style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }} aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs mb-4" style={{ color: "var(--arbor-muted)" }}>A friendly, hand-illustrated character — not a real photo.</p>

            {/* Mode toggle */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {([["describe", "Describe", Wand2], ["photo", "From a photo", Camera]] as const).map(([id, label, Icon]) => (
                <button
                  key={id}
                  onClick={() => { setMode(id); setResult(undefined); }}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition"
                  style={mode === id
                    ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.40)" }
                    : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            {/* Style picker */}
            <div className="space-y-1.5 mb-4">
              <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>Style</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setStyle(s.id); setResult(undefined); }}
                    className="py-2 rounded-xl text-[11px] font-bold transition"
                    style={style === s.id
                      ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.40)" }
                      : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode body */}
            {mode === "describe" ? (
              <div className="space-y-3 mb-4">
                {field("Hair", "hair", "e.g. short curly brown")}
                {field("Skin tone", "skin", "e.g. warm tan")}
                {field("Eyes", "eyes", "e.g. big brown")}
                {field("Personality / vibe", "vibe", "e.g. curious and cheerful")}
              </div>
            ) : (
              <div className="space-y-3 mb-4">
                <label className="flex items-start gap-2 p-3 rounded-xl cursor-pointer" style={{ background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.30)" }}>
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" style={{ accentColor: "var(--arbor-clay)" }} />
                  <span className="text-[11px] leading-snug" style={{ color: "var(--arbor-green-ink)" }}>
                    <ShieldCheck className="w-3.5 h-3.5 inline mr-1" />
                    I consent to Arbor using this photo to create a cartoon character. The original is used once, then <strong>immediately discarded — never stored and never used to train AI.</strong>
                  </span>
                </label>
                <label className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition ${consent ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`} style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}>
                  <Camera className="w-3.5 h-3.5" /> {refPhoto ? "Choose a different photo" : "Choose a photo"}
                  <input type="file" accept="image/*" className="hidden" disabled={!consent} onChange={(e) => onPickPhoto(e.target.files?.[0])} />
                </label>
                {refPhoto && <img src={refPhoto} alt="Reference" className="w-16 h-16 rounded-xl object-cover" style={{ border: "1px solid var(--arbor-rule)" }} />}
              </div>
            )}

            {/* Result / preview */}
            {result && (
              <div className="flex items-center gap-4 p-3 mb-4 rounded-2xl" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
                <Avatar name={childName} photoURL={result} size={72} ring />
                <div className="text-xs" style={{ color: "var(--arbor-muted)" }}>Here&apos;s a character. Use it, or generate another.</div>
              </div>
            )}

            {error && <p className="text-xs mb-3" style={{ color: "var(--arbor-pink-ink)" }}>{error}</p>}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={generate}
                disabled={!canGenerate || generating}
                className="flex-1 py-3 font-extrabold text-sm rounded-2xl transition active:scale-[0.98] disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#3cc081,var(--arbor-clay) 60%,var(--arbor-clay-deep))", color: "#fff" }}
              >
                {generating ? "Creating…" : result ? "Try again" : "Create avatar"}
              </button>
              {result && (
                <button onClick={use} className="flex-1 py-3 font-extrabold text-sm rounded-2xl transition active:scale-[0.98]" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.40)" }}>
                  Use this avatar
                </button>
              )}
            </div>
            {result && (
              <div className="mt-2 flex justify-center">
                <ShareButton
                  artifact="avatar"
                  surface="avatar"
                  childName={childName}
                  getCardOpts={() => ({ imageUrl: result, name: childName })}
                  label={t("share.cta.avatar")}
                />
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
