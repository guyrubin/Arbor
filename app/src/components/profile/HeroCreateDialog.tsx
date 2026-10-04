import AvatarCreator from "./AvatarCreator";
import { persistHero } from "./heroPersistence";
import { useProfile } from "../../context/ProfileContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import type { AvatarResult } from "./avatarGate";

/**
 * HeroCreateDialog — B-PLAY-15: the ONE "create {name}'s hero" dialog.
 *
 * The AvatarCreator + persistHero body that HeroFirstStep composed, extracted
 * so every hero-first gate creates the hero IN PLACE: Stories (HeroJourneyTab)
 * and Comics used to switch the parent to the Profile hub, losing the page
 * they were on. Now the gate opens
 * this dialog; on a saved hero the profile updates, the gate's `!avatar`
 * branch falls away and the page re-renders with the hero — no hub switch.
 *
 * Contract (unchanged from HeroFirstStep):
 *  - The consent gate lives inside AvatarCreator and is not touched here.
 *  - The hero is written with the SAME patch shape the profile drawer uses
 *    (heroPersistence); a failed write is announced, never swallowed, and
 *    `onSaved` is reached only past that guard.
 *  - PARENT register: mounted only on parent surfaces, never inside Kid Mode.
 */
export default function HeroCreateDialog({
  open,
  childId,
  childName,
  onClose,
  onSaved,
  onResting,
  onSavingChange,
}: {
  open: boolean;
  childId: string;
  childName: string;
  /** The creator closed — cancelled, or a hero was produced (save follows). */
  onClose: () => void;
  /** The hero was persisted to the child profile. */
  onSaved?: () => void;
  /** Today's drawing quota is spent (B-KID-05). */
  onResting?: () => void;
  onSavingChange?: (saving: boolean) => void;
}) {
  const { updateChild } = useProfile();
  const { toast } = useToast();
  const { t } = useLanguage();

  const saveHero = async (result: AvatarResult) => {
    onSavingChange?.(true);
    try {
      const persisted = await persistHero(childId, result, { updateChild });
      if (!persisted) {
        toast(t("elev.hero.save.failed"), "error");
        return;
      }
      onSaved?.();
    } finally {
      onSavingChange?.(false);
    }
  };

  return (
    <AvatarCreator
      open={open}
      childId={childId}
      childName={childName}
      onClose={onClose}
      onResting={onResting}
      onCreated={(result) => {
        onClose();
        void saveHero(result);
      }}
    />
  );
}
