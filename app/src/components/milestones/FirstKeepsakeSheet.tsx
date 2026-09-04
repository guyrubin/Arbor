import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { ShareButton } from "../ui/ShareButton";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToastOptional } from "../../context/ToastContext";
import { fileToThumbnail } from "../../lib/image";
import { uploadChildPhoto } from "../../lib/storage";
import {
  FIRSTS_KEEPSAKE_CAPTION_KEY,
  FIRSTS_KEEPSAKE_SURFACE,
  KEEPSAKE_ERROR_KEYS,
  KEEPSAKE_NOTE_MAX,
  localDayKey,
  validateKeepsake,
  type FirstKeepsake,
  type KeepsakeDraft,
} from "../../lib/firstsKeepsake";
import type { ShareCardOpts } from "../../lib/shareCard";

/**
 * GP-31 — the keepsake editor for one first.
 *
 * A NOTE AND A DATE ARE THE FEATURE. The photo is optional and this sheet is
 * fully usable, savable and shareable without one — the Save button is gated
 * on the note and the date, never on an image.
 *
 * THE PHOTO, IF THERE IS ONE, IS SWEPT WITH THE CHILD.
 * `uploadChildPhoto(uid, childId, …)` is the ONLY upload route here, and it
 * writes `users/{uid}/children/{childId}/photos/…`. `/privacy/erase` deletes
 * the prefix `users/{uid}/children/{childId}/` and `/account/delete` deletes
 * `users/{uid}/`, so the file is inside both swept subtrees by construction.
 * A stored child photo that outlives the child is the worst outcome this
 * feature could produce, so the containment is proved by test against the real
 * source of all three paths rather than asserted in a comment.
 * When Storage is unavailable the photo is simply not added (never inlined as
 * a data URL into device-local state, which would put an image of a child in a
 * store the erase path can only reach on this one device).
 *
 * CLINICAL FIREWALL: a keepsake is a sentence, a day, and maybe a picture.
 * Nothing here scores, ranks, or compares. The share caption is declared
 * explicitly (FIRSTS_KEEPSAKE_CAPTION_KEY) because the growth_card fallback
 * reads "{name}'s progress this month" — a month-of-progress claim published
 * in the parent's name off a single first, on the day it happened.
 */
export default function FirstKeepsakeSheet({
  open,
  milestoneId,
  milestoneTitle,
  childId,
  childName,
  keepsake,
  onSave,
  onRemove,
  onClose,
}: {
  open: boolean;
  milestoneId: string;
  milestoneTitle: string;
  childId: string;
  childName: string;
  /** The keepsake already kept for this milestone, or null for a new one. */
  keepsake: FirstKeepsake | null;
  onSave: (draft: KeepsakeDraft) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const toastCtx = useToastOptional();
  const toast = (message: string, type?: "success" | "error" | "info") => toastCtx?.toast(message, type);

  const [note, setNote] = useState("");
  const [noticedOn, setNoticedOn] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Re-seed whenever a different milestone's sheet opens, so one first's note
  // can never be saved onto another first.
  useEffect(() => {
    if (!open) return;
    setNote(keepsake?.note ?? "");
    setNoticedOn(keepsake?.noticedOn ?? localDayKey());
    setPhotoUrl(keepsake?.photoUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, milestoneId]);

  const today = localDayKey();
  const draft: KeepsakeDraft = { milestoneId, note, noticedOn, photoUrl };
  const problem = validateKeepsake(draft, today);

  const save = () => {
    if (problem) {
      toast(t(KEEPSAKE_ERROR_KEYS[problem]), "error");
      return;
    }
    onSave(draft);
    toast(t("elev.waveR.keepsake.saved"), "success");
    onClose();
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const thumb = await fileToThumbnail(file, 800, 0.82);
      if (!user?.uid || user.uid === "local-sandbox") throw new Error("no-remote-storage");
      // The ONE upload route — per-child prefix, already swept on erase.
      setPhotoUrl(await uploadChildPhoto(user.uid, childId, thumb));
    } catch {
      toast(t("elev.waveR.keepsake.photoFailed"), "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("elev.waveR.keepsake.title")}>
      <div className="space-y-4" data-testid="first-keepsake-sheet">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--arbor-lav-ink)" }}>
            {t("elev.waveR.keepsake.eyebrow")}
          </p>
          <p className="mt-1 text-[15px] font-extrabold leading-snug" dir="auto" style={{ color: "var(--arbor-ink)" }}>
            {milestoneTitle}
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.waveR.keepsake.intro")}
          </p>
        </div>

        <label className="block">
          <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.waveR.keepsake.noteLabel")}
          </span>
          <textarea
            value={note}
            rows={3}
            dir="auto"
            maxLength={KEEPSAKE_NOTE_MAX}
            placeholder={t("elev.waveR.keepsake.notePlaceholder")}
            onChange={(e) => setNote(e.target.value)}
            data-testid="first-keepsake-note"
            className="mt-1.5 w-full resize-none rounded-xl px-3 py-2 text-[13.5px] leading-relaxed focus:outline-none focus-visible:ring-2"
            style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.waveR.keepsake.dateLabel")}
          </span>
          <input
            type="date"
            value={noticedOn}
            max={today}
            onChange={(e) => setNoticedOn(e.target.value)}
            data-testid="first-keepsake-date"
            className="mt-1.5 w-full rounded-xl px-3 py-2 text-[13.5px] font-bold focus:outline-none focus-visible:ring-2"
            style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
          />
        </label>

        {/* OPTIONAL. Everything above is enough for a complete keepsake. */}
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.waveR.keepsake.photoLabel")}
          </span>
          {photoUrl ? (
            <div className="mt-1.5 space-y-2">
              <img
                src={photoUrl}
                alt=""
                className="w-full rounded-2xl border object-cover"
                style={{ borderColor: "var(--arbor-rule)", maxHeight: 220 }}
              />
              <button
                type="button"
                onClick={() => setPhotoUrl(undefined)}
                className="min-h-[44px] rounded-xl px-3 text-[12px] font-bold"
                style={{ color: "var(--arbor-muted)" }}
              >
                {t("elev.waveR.keepsake.photoRemove")}
              </button>
            </div>
          ) : (
            <div className="mt-1.5">
              <button
                type="button"
                disabled={uploading}
                onClick={() => photoInputRef.current?.click()}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-[12px] font-bold disabled:opacity-50"
                style={{ color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
              >
                <Icon name="photo_camera" size={16} fill={1} /> {t("elev.waveR.keepsake.photoAdd")}
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void pickPhoto(e.target.files?.[0])}
              />
            </div>
          )}
          <p className="mt-1.5 text-[11.5px] leading-snug" style={{ color: "var(--arbor-faint)" }}>
            {t("elev.waveR.keepsake.photoNote")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={Boolean(problem)}
            data-testid="first-keepsake-save"
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-extrabold text-white transition active:scale-[0.98] disabled:opacity-50"
            style={{ background: "var(--arbor-gradient-primary)" }}
          >
            <Icon name="bookmark_added" size={17} fill={1} /> {t("elev.waveR.keepsake.save")}
          </button>
          {keepsake && (
            <button
              type="button"
              onClick={() => { onRemove(); toast(t("elev.waveR.keepsake.removed"), "info"); onClose(); }}
              data-testid="first-keepsake-remove"
              className="min-h-[44px] rounded-xl px-3 text-[12px] font-bold"
              style={{ color: "var(--arbor-muted)" }}
            >
              {t("elev.waveR.keepsake.remove")}
            </button>
          )}
        </div>

        {/* The keepsake is shareable ONLY once it exists. The caption is
            declared, never inherited: the growth_card fallback would publish
            "{name}'s progress this month" from one first. The card carries the
            milestone and the parent's own words — no photo of the child, no
            date maths, nothing Arbor derived. */}
        {keepsake && (
          <ShareButton
            artifact="growth_card"
            surface={FIRSTS_KEEPSAKE_SURFACE}
            childName={childName}
            captionKey={FIRSTS_KEEPSAKE_CAPTION_KEY}
            label={t("elev.waveR.keepsake.share")}
            getCardOpts={(): ShareCardOpts => ({ name: childName, headline: milestoneTitle, sub: keepsake.note })}
            variant="ghost"
          />
        )}
      </div>
    </Modal>
  );
}
