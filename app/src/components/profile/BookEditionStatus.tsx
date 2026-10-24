/** Parent-only edition status, requiring a confirmed owner-scoped book record. */
import { useEffect, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import type { BookAssetsDoc } from "../../lib/library/bookAssetPaths";
import { bookSheetId } from "../../lib/library/bookSheet";
import { bookSheetRunning, DEFAULT_SHEET_BOOK } from "../kidmode/hero/buildBookSheet";

export default function BookEditionStatus({ childId, avatarHash }: { childId: string; avatarHash: string }) {
  const { t } = useLanguage();
  const assets = useChildCollection<BookAssetsDoc>(childId, "bookAssets", { trackConfirmation: true });
  const currentSheet = bookSheetId(avatarHash);
  const previous = Boolean(childId && avatarHash && assets.remote && assets.confirmed && !assets.error
    && !assets.items.some((item) => item.bookId === DEFAULT_SHEET_BOOK && item.sheetId === currentSheet)
    && assets.items.some((item) =>
      item.bookId === DEFAULT_SHEET_BOOK && typeof item.sheetId === "string" && item.sheetId !== currentSheet));
  const [preparing, setPreparing] = useState(() => bookSheetRunning(childId));

  useEffect(() => {
    if (!previous) return;
    const refresh = () => setPreparing(bookSheetRunning(childId));
    refresh();
    // Local-only status, with no extra requests or third-party child processor.
    const timer = window.setInterval(refresh, 1500);
    return () => window.clearInterval(timer);
  }, [childId, previous]);

  if (!previous) return null;
  return <p role="status" data-book-edition={preparing ? "preparing" : "prior-saved"}
    className="text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
    {t(preparing ? "elev.hero.sheet.book.oldPreparing" : "elev.hero.sheet.book.oldWaiting")}
  </p>;
}
