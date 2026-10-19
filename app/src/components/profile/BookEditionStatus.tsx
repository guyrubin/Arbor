/**
 * Parent-only status while a child's new illustrated book edition is prepared.
 * The previously committed book remains the source of truth until a new
 * approved edition is committed. Never show a stale cached read as confirmed.
 */
import { useEffect, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import type { BookAssetsDoc } from "../../lib/library/bookAssetPaths";
import { bookSheetId } from "../../lib/library/bookSheet";
import { BOOK_SHEET_ACTIVITY_EVENT, bookSheetRunning, DEFAULT_SHEET_BOOK } from "../kidmode/hero/buildBookSheet";

export default function BookEditionStatus({ childId, avatarHash }: { childId: string; avatarHash: string }) {
  const { t } = useLanguage();
  const assets = useChildCollection<BookAssetsDoc>(childId, "bookAssets", { trackConfirmation: true });
  const [preparing, setPreparing] = useState(() => bookSheetRunning(childId));

  useEffect(() => {
    const update = () => setPreparing(bookSheetRunning(childId));
    update();
    const onActivity = (event: Event) => {
      if ((event as CustomEvent<{ childId?: string }>).detail?.childId === childId) update();
    };
    window.addEventListener(BOOK_SHEET_ACTIVITY_EVENT, onActivity);
    return () => window.removeEventListener(BOOK_SHEET_ACTIVITY_EVENT, onActivity);
  }, [childId]);

  if (!avatarHash || !assets.confirmed || assets.error) return null;
  const currentSheet = bookSheetId(avatarHash);
  const currentCommitted = assets.items.some((item) => item.bookId === DEFAULT_SHEET_BOOK && item.sheetId === currentSheet);
  if (currentCommitted) return null;
  const earlierCommitted = assets.items.some((item) =>
    item.bookId === DEFAULT_SHEET_BOOK && typeof item.sheetId === "string" && item.sheetId !== currentSheet);
  if (!earlierCommitted) return null;

  return (
    <p data-book-edition={preparing ? "preparing" : "prior-saved"} role="status"
       className="text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
      {t(preparing ? "elev.hero.sheet.book.oldPreparing" : "elev.hero.sheet.book.oldWaiting")}
    </p>
  );
}
