import { useLanguage } from "../../context/LanguageContext";
import { useSheetHistory } from "../../hooks/useSheetHistory";
import { learnCardById } from "../../learn/learnCards";
import { Sheet, useCompactSurface } from "../ui/Sheet";
import { Modal } from "../ui/Modal";
import { SheetBreadcrumb } from "../layout/Breadcrumb";
import { LearnReadHost } from "./LearnLibrary";

/**
 * v3 F-FORYOU-1 — a read opened on For you, the parent, opens over that page:
 * a bottom sheet on a phone, a dialog on a wide screen. The same read the
 * #/learn route shows (LearnReadHost: save, share, listen, Ask Arbor, Add to
 * today), without leaving the page the parent chose it from.
 *
 * The sheet owns one history entry (Back closes it) and names where it sits in
 * a crumb under its title. It carries no module and no primary move: those
 * belong to the page beneath. Mounted only while open (createPortal has no
 * server render), so the page loads it lazily.
 */
export default function ForYouReadSheet({ cardId, onClose }: { cardId: string; onClose: () => void }) {
  const { aiLang } = useLanguage();
  const close = useSheetHistory(true, onClose);
  const Surface = useCompactSurface() ? Sheet : Modal;
  const card = learnCardById(cardId);
  if (!card) return null;
  const title = aiLang === "he" ? card.title.he : card.title.en;
  return (
    <Surface open onClose={() => close()} title={title} maxWidth="max-w-2xl">
      <SheetBreadcrumb label={title} close={close} />
      <LearnReadHost cardId={cardId} />
    </Surface>
  );
}
