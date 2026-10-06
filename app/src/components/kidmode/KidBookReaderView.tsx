/**
 * B-BOOK release — a library book open inside Kid Mode: the child's own hero
 * sheet and narration (lib/bookAssets: the private files through the
 * owner-checked proxy, kept on the device), the book in the child's story
 * language, the Hebrew forms by the profile's gender. Full screen over the
 * kid shell: the reader's own close toy is the ONE way back (to the kid
 * home); no DEV query parameters, no DEV files (dev={false}).
 */
import { useEffect, useMemo, useState } from "react";
import { BookReader } from "../library/BookReader";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { storyLanguage } from "../../lib/heroJourneys";
import { resolveBookAssets, type ResolvedBookAssets } from "../../lib/bookAssets";
import { heGender } from "../../lib/library/bookText";
import { KidStageFallback } from "./KidStageFallback";
import { useChildLibraryBooks } from "./useChildLibraryBooks";

export default function KidBookReaderView({ bookId, onClose }: { bookId: string; onClose: () => void }) {
  const { childProfile } = useArbor();
  const { uiLang, aiLang } = useLanguage();
  const lang = storyLanguage(uiLang, aiLang) === "he" ? "he" : "en";
  const entries = useChildLibraryBooks(childProfile.id);
  const entry = entries.find((e) => e.book.id === bookId) ?? null;
  const folder = lang === "he" ? (heGender(childProfile.gender) === "f" ? "he-f" : "he-m") : "en";
  const [resolved, setResolved] = useState<ResolvedBookAssets | null>(null);
  const [failed, setFailed] = useState(false);
  const doc = entry?.doc ?? null;
  useEffect(() => {
    if (!doc) return;
    let live = true;
    let got: ResolvedBookAssets | null = null;
    setResolved(null);
    resolveBookAssets(childProfile.id, doc, folder)
      .then((r) => {
        got = r;
        if (live) setResolved(r);
        else r.revoke();
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
      got?.revoke();
    };
  }, [childProfile.id, doc, folder]);
  // A book that cannot open goes back home rather than showing a broken page.
  useEffect(() => {
    if (failed) onClose();
  }, [failed, onClose]);
  const child = useMemo(
    () => ({ id: childProfile.id, name: childProfile.name, gender: childProfile.gender, heroSheetId: doc?.sheetId ?? null }),
    [childProfile.id, childProfile.name, childProfile.gender, doc?.sheetId],
  );
  return (
    <div className="arbor-play" data-kid-library-book={bookId} style={{ position: "fixed", inset: 0, zIndex: 80 }}>
      {entry && resolved ? (
        <BookReader book={entry.book} lang={lang} child={child} onClose={onClose} dev={false} sheet={resolved.sheet} assets={resolved.narration} voiceSet={entry.doc.setId} />
      ) : (
        <KidStageFallback />
      )}
    </div>
  );
}
