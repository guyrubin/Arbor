import React, { useRef, useState } from "react";
import { useDialog } from "../../hooks/useDialog";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, Sparkles, Camera, Wand2, ShieldCheck, Crown, Shield, Compass, Pencil, Eraser } from "lucide-react";
import { api, type AvatarStyle, type AvatarDescriptors, type AvatarCharacterIntent } from "../../lib/api";
import { fileToThumbnail, shrinkDataUrlToBudget } from "../../lib/image";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { useArborOptional } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { Avatar } from "../ui/Avatar";
import { ProvenanceBadge } from "../ui/ProvenanceBadge";
import { ShareButton } from "../ui/ShareButton";
import { TrustPanel } from "../ui/TrustPanel";
import {
  isAvatarDraftCurrent,
  runAvatarGeneration,
  type AvatarDraftResult,
  type AvatarResult,
} from "./avatarGate";
import {
  CHARACTER_CHOICES,
  isCharacterSelected,
  nextChoiceIndex,
  selectCharacter,
  type CharacterChoice,
} from "./characterIntent";

/**
 * AVA-1 / AVA-2 — the Avatar Creator. Turns descriptors (default, no face) or an
 * optional, consent-gated reference photo into a STYLIZED character via
 * /api/generate-avatar. The reference photo is used only for the single generation
 * call and is never stored. Returns the generated image to the caller.
 */

const STYLES: { id: AvatarStyle; labelKey: string }[] = [
  { id: "comichero", labelKey: "elev.hero.style.comichero" },
  { id: "storybook", labelKey: "elev.hero.style.storybook" },
  { id: "soft3d", labelKey: "elev.hero.style.soft3d" },
  { id: "watercolor", labelKey: "elev.hero.style.watercolor" },
  { id: "flat", labelKey: "elev.hero.style.flat" }
];

/** The picker, in reading order. `none` is the visible clear (UX26-29). */
const CHARACTERS: { id: CharacterChoice; labelKey: string; Icon: typeof Crown; imageSrc?: string }[] = [
  { id: "princess", labelKey: "elev.hero.character.princess", Icon: Crown, imageSrc: "/visuals/characters/v1/princess-v1-160.webp" },
  { id: "superhero", labelKey: "elev.hero.character.superhero", Icon: Shield, imageSrc: "/visuals/characters/v1/superhero-v1-160.webp" },
  { id: "explorer", labelKey: "elev.hero.character.explorer", Icon: Compass, imageSrc: "/visuals/characters/v1/explorer-v1-160.webp" },
  { id: "custom", labelKey: "elev.hero.character.custom", Icon: Pencil },
  { id: "none", labelKey: "elev.hero.character.none", Icon: Eraser },
];

export default function AvatarCreator({
  open,
  childId,
  childName,
  onClose,
  onCreated,
  parentDialogRef,
}: {
  open: boolean;
  childId: string;
  childName: string;
  onClose: () => void;
  onCreated: (result: AvatarResult) => void;
  parentDialogRef?: React.RefObject<HTMLElement | null>;
}) {
  const [mode, setMode] = useState<"describe" | "photo">("describe");
  const [style, setStyle] = useState<AvatarStyle>("comichero");
  const [descriptors, setDescriptors] = useState<AvatarDescriptors>({});
  const [character, setCharacter] = useState<AvatarCharacterIntent | undefined>();
  const [consent, setConsent] = useState(false);
  const [refPhoto, setRefPhoto] = useState<string | undefined>();
  const [result, setResult] = useState<AvatarDraftResult | undefined>();
  const [photoError, setPhotoError] = useState<string | undefined>();
  const draftRequestRef = useRef(0);
  /** Roving-tabindex focus targets for the character radiogroup. */
  const characterRefs = useRef<Array<HTMLButtonElement | null>>([]);
  /** True when the last character choice came from the keyboard: the custom
   *  field must not steal focus mid-arrow-navigation (it does autofocus for a
   *  pointer choice, where the parent has already committed to typing). */
  const keyboardChoiceRef = useRef(false);
  const contextRef = useRef({ childId, open });
  if (contextRef.current.childId !== childId || contextRef.current.open !== open) {
    draftRequestRef.current += 1;
    contextRef.current = { childId, open };
  }
  // ONBOARDING-SAFE (the flow renders outside ArborProvider): useArbor() here
  // crashed the whole onboarding at the avatar step with a blank screen. The
  // optional hook returns null there; without a paywall to open, a 402 falls
  // through to useAsyncAction's normal inline-error path instead.
  const arbor = useArborOptional();
  const { t, uiLang } = useLanguage();

  // M4: loading + error + start/success/error analytics for the generation call.
  // A 402 opens the paywall (conversion moment) instead of an inline error.
  // COPPA gate (F-NEW): consent-before-capture is enforced inside runAvatarGeneration.
  const avatar = useAsyncAction(
    "avatar_create",
    async (input: { style: AvatarStyle; mode: "describe" | "photo"; refPhoto?: string; descriptors: AvatarDescriptors; character?: AvatarCharacterIntent }) => {
      return runAvatarGeneration(childId, input, {
        grantConsent: api.grantConsent,
        generateAvatar: api.generateAvatar,
      });
    },
    {
      fallbackError: t("gen.avatar.fail"),
      onPaywall: arbor ? (err) => arbor.openPaywall(err.feature || "avatarGenerate", err.plan) : undefined,
    },
  );
  const generating = avatar.loading;
  const error = photoError ?? avatar.error ?? undefined;

  const reset = () => {
    draftRequestRef.current += 1;
    setMode("describe"); setStyle("comichero"); setDescriptors({}); setCharacter(undefined); setConsent(false);
    setRefPhoto(undefined); setResult(undefined); setPhotoError(undefined); avatar.clearError();
  };
  const close = () => { reset(); onClose(); };
  const { ref: dialogRef, requestClose, onBackdropClick } = useDialog({ open, onClose: close, parentRef: parentDialogRef });

  const onPickPhoto = async (file?: File) => {
    if (!file) return;
    const request = ++draftRequestRef.current;
    setPhotoError(undefined);
    try {
      // Downscale on-device before it ever leaves the browser.
      const nextPhoto = await fileToThumbnail(file, 512, 0.85);
      if (request === draftRequestRef.current) setRefPhoto(nextPhoto);
    } catch {
      if (request === draftRequestRef.current) setPhotoError(t("elev.hero.photo.unreadable"));
    }
  };

  const generate = async () => {
    const request = ++draftRequestRef.current;
    const startedChildId = childId;
    const startedStyle = style;
    const startedSource = mode === "photo" && refPhoto ? "photo" as const : "descriptor" as const;
    setPhotoError(undefined);
    setResult(undefined);
    const res = await avatar.run({ style, mode, refPhoto, descriptors, character });
    if (
      res
      && request === draftRequestRef.current
      && contextRef.current.open
      && contextRef.current.childId === startedChildId
    ) {
      setResult({ dataUrl: res.dataUrl, style: startedStyle, source: startedSource, childId: startedChildId, requestId: request });
    }
  };

  /** ONE transition for click and keyboard; clears the stale preview, never the
   *  saved avatar (only `use()` emits onCreated). */
  const chooseCharacter = (choice: CharacterChoice) => {
    draftRequestRef.current += 1;
    setCharacter((current) => selectCharacter(current, choice));
    setResult(undefined);
  };

  const use = async () => {
    if (!isAvatarDraftCurrent(result, { childId, requestId: draftRequestRef.current, open })) return;
    const draft = result;
    // M4 persistence honesty: the hero is stored inline in the child document,
    // so it leaves here inside a byte budget. Bounding happens BEFORE onCreated
    // so every caller (profile drawer, onboarding, the Kid Mode step) inherits
    // it without repeating the rule.
    const dataUrl = await shrinkDataUrlToBudget(draft.dataUrl);
    // The await is a seam: a child switch or a new generation during it must
    // still invalidate this draft (AV-05 request-snapshot binding).
    if (!isAvatarDraftCurrent(draft, { childId, requestId: draftRequestRef.current, open })) return;
    onCreated({ dataUrl, style: draft.style, source: draft.source });
    close();
  };
  const visibleResult = isAvatarDraftCurrent(result, { childId, requestId: draftRequestRef.current, open }) ? result : undefined;

  const characterReady = character?.preset !== "custom" || Boolean(character.customIdea?.trim());
  const canGenerate = characterReady && (mode === "describe" || (mode === "photo" && consent && !!refPhoto));
  const currentAvatarUrl = (arbor?.childProfile as unknown as { photoUrl?: string } | undefined)?.photoUrl;

  const inputStyle: React.CSSProperties = { background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" };
  const field = (label: string, key: keyof AvatarDescriptors, placeholder: string) => (
    <div className="space-y-1.5">
      <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{label}</label>
      <input
        value={descriptors[key] || ""}
        onChange={(e) => {
          draftRequestRef.current += 1;
          setResult(undefined);
          setDescriptors((d) => ({ ...d, [key]: e.target.value }));
        }}
        placeholder={placeholder}
        className="w-full rounded-xl px-4 py-2.5 text-xs focus:outline-none"
        style={inputStyle}
      />
    </div>
  );

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="arbor-app fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(41,51,63,0.45)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onBackdropClick} data-arbor-dialog-layer>
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={t("aria.createAvatar")}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-6"
            style={{ border: "1px solid var(--arbor-rule)", boxShadow: "0 24px 64px rgba(41,51,63,0.18)" }}
            initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-extrabold tracking-tight flex items-center gap-2" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                <Sparkles className="w-4 h-4" style={{ color: "var(--arbor-clay)" }} /> {t("elev.hero.creator.title", { name: childName })}
              </h3>
              <button onClick={requestClose} className="touch-target p-1.5 rounded-lg transition" style={{ minWidth: "var(--touch-min)", minHeight: "var(--touch-min)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }} aria-label={t("aria.close")}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs mb-4" style={{ color: "var(--arbor-muted)" }}>{t("trust.avatar.notRealPhoto")}</p>

            {currentAvatarUrl && !visibleResult && (
              <div className="mb-4 flex items-center gap-3 rounded-2xl p-3" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
                <Avatar name={childName} photoURL={currentAvatarUrl} size={56} ring />
                <p className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("elev.hero.creator.current")}</p>
              </div>
            )}

            <fieldset className="mb-4">
              <legend className="text-xs font-bold mb-2" style={{ color: "var(--arbor-muted)" }}>{t("elev.hero.character.legend")}</legend>
              {/* UX26-29: a real radiogroup — one option is always checked (the
                  clear is the "none" radio), arrows move the selection, and the
                  checked option is the only tab stop (roving tabindex). */}
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("elev.hero.character.group")}>
                {CHARACTERS.map(({ id, labelKey, Icon, imageSrc }, index) => {
                  const selected = isCharacterSelected(character, id);
                  return (
                    <button
                      key={id}
                      ref={(node) => { characterRefs.current[index] = node; }}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      tabIndex={selected ? 0 : -1}
                      data-testid={`avatar-character-${id}`}
                      onClick={() => { keyboardChoiceRef.current = false; chooseCharacter(id); }}
                      onKeyDown={(event) => {
                        const next = nextChoiceIndex(index, event.key, CHARACTER_CHOICES.length, uiLang === "he");
                        if (next === null) return;
                        event.preventDefault();
                        keyboardChoiceRef.current = true;
                        chooseCharacter(CHARACTERS[next].id);
                        characterRefs.current[next]?.focus();
                      }}
                      className={`min-h-[56px] rounded-xl px-3 py-2 text-start text-xs font-bold flex items-center gap-2 ${id === "none" ? "col-span-2" : ""}`}
                      style={selected
                        ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "2px solid var(--arbor-green-ink)" }
                        : { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
                    >
                      {imageSrc ? (
                        <img src={imageSrc} alt="" aria-hidden="true" className="h-12 w-12 shrink-0 object-contain" />
                      ) : (
                        <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                      )}
                      {t(labelKey)}
                    </button>
                  );
                })}
              </div>
              {character?.preset === "custom" && (
                <input
                  autoFocus={!keyboardChoiceRef.current}
                  value={character.customIdea ?? ""}
                  onChange={(event) => { draftRequestRef.current += 1; setCharacter({ preset: "custom", customIdea: event.target.value }); setResult(undefined); }}
                  maxLength={160}
                  placeholder={t("elev.hero.character.customPlaceholder")}
                  aria-label={t("elev.hero.character.customLabel")}
                  className="mt-2 w-full rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                  style={inputStyle}
                />
              )}
            </fieldset>

            {/* Mode toggle */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {([["describe", "elev.hero.mode.describe", Wand2], ["photo", "elev.hero.mode.photo", Camera]] as const).map(([id, labelKey, Icon]) => (
                <button
                  key={id}
                  onClick={() => { draftRequestRef.current += 1; setMode(id); setResult(undefined); }}
                  className="flex items-center justify-center gap-2 py-2.5 min-h-11 rounded-xl text-xs font-bold transition"
                  style={mode === id
                    ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.40)" }
                    : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                >
                  <Icon className="w-3.5 h-3.5" /> {t(labelKey)}
                </button>
              ))}
            </div>

            {/* Style picker */}
            <div className="space-y-1.5 mb-4">
              <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("elev.hero.style.legend")}</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { draftRequestRef.current += 1; setStyle(s.id); setResult(undefined); }}
                    className="py-2 min-h-11 rounded-xl text-[11px] font-bold transition"
                    style={style === s.id
                      ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.40)" }
                      : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                  >
                    {t(s.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode body */}
            {mode === "describe" ? (
              <div className="space-y-3 mb-4">
                {field(t("elev.hero.field.hair"), "hair", t("elev.hero.field.hair.ph"))}
                {field(t("elev.hero.field.skin"), "skin", t("elev.hero.field.skin.ph"))}
                {field(t("elev.hero.field.eyes"), "eyes", t("elev.hero.field.eyes.ph"))}
                {field(t("elev.hero.field.vibe"), "vibe", t("elev.hero.field.vibe.ph"))}
              </div>
            ) : (
              <div className="space-y-3 mb-4">
                <label className="flex items-start gap-2 p-3 rounded-xl cursor-pointer" style={{ background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.30)" }}>
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => {
                      draftRequestRef.current += 1;
                      setResult(undefined);
                      setConsent(e.target.checked);
                    }}
                    className="mt-0.5"
                    style={{ accentColor: "var(--arbor-clay)" }}
                  />
                  <span className="text-[11px] leading-snug" style={{ color: "var(--arbor-green-ink)" }}>
                    <ShieldCheck className="w-3.5 h-3.5 inline me-1" />
                    {t("trust.avatar.consent.pre")} <strong>{t("trust.avatar.consent.claim")}</strong>
                  </span>
                </label>
                {/* P0.5 — reusable trust pattern: uses / stores / you control (localized HE+EN) */}
                <TrustPanel
                  tone="panel"
                  uses={[t("trust.avatar.uses.1")]}
                  stores={[t("trust.avatar.stores.1")]}
                  controls={[t("trust.avatar.controls.1")]}
                />
                <label className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition ${consent ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`} style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}>
                  <Camera className="w-3.5 h-3.5" /> {refPhoto ? t("elev.hero.photo.change") : t("elev.hero.photo.choose")}
                  <input type="file" accept="image/*" className="hidden" disabled={!consent} onChange={(e) => onPickPhoto(e.target.files?.[0])} />
                </label>
                {refPhoto && <img src={refPhoto} alt={t("elev.hero.photo.alt")} className="w-16 h-16 rounded-xl object-cover" style={{ border: "1px solid var(--arbor-rule)" }} />}
              </div>
            )}

            {/* Result / preview */}
            {visibleResult && (
              <div className="flex items-center gap-4 p-3 mb-4 rounded-2xl" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
                <Avatar name={childName} photoURL={visibleResult.dataUrl} size={72} ring />
                <div className="text-xs" style={{ color: "var(--arbor-muted)" }}>
                  {t("elev.hero.preview.say")}
                  <span className="block mt-1.5"><ProvenanceBadge lang={uiLang === "he" ? "he" : "en"} /></span>
                </div>
              </div>
            )}

            {error && <p className="text-xs mb-3" style={{ color: "var(--arbor-pink-ink)" }}>{error}</p>}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={generate}
                disabled={!canGenerate || generating}
                className="flex-1 py-3 font-extrabold text-sm rounded-2xl transition active:scale-[0.98] disabled:opacity-50"
                style={{ background: "var(--arbor-gradient-primary)", color: "#fff" }}
              >
                {generating ? t("elev.hero.cta.creating") : visibleResult ? t("elev.hero.cta.again") : t("elev.hero.cta.create")}
              </button>
              {visibleResult && (
                <button onClick={() => { void use(); }} className="flex-1 py-3 font-extrabold text-sm rounded-2xl transition active:scale-[0.98]" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.40)" }}>
                  {t("elev.hero.cta.use")}
                </button>
              )}
            </div>
            {visibleResult && (
              <div className="mt-2 flex justify-center">
                <ShareButton
                  artifact="avatar"
                  surface="avatar"
                  childName={childName}
                  getCardOpts={() => ({ imageUrl: visibleResult.dataUrl, name: childName })}
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
