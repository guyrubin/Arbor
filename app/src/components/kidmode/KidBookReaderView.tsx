/**
 * B-BOOK release — a library book open inside Kid Mode: the child's own hero
 * sheet and narration (lib/bookAssets: the private files through the
 * owner-checked proxy, kept on the device), the book in the child's story
 * language, the Hebrew forms by the profile's gender. Full screen over the
 * kid shell: the reader's own close toy is the ONE way back (to the kid
 * home); no DEV query parameters, no DEV files (dev={false}).
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BookReader } from "../library/BookReader";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { storyLanguage } from "../../lib/heroJourneys";
import { resolveBookAssets, type LibraryBookEntry, type ResolvedBookAssets } from "../../lib/bookAssets";
import { heGender } from "../../lib/library/bookText";
import { storyName } from "../../lib/storyName";
import { KidStageFallback } from "./KidStageFallback";
import { useChildLibraryBooks } from "./useChildLibraryBooks";
import { bookEdition } from "../../lib/library/bookBookmarks";
import { heroSheetOwnerKey, subscribeHeroSheetOwner } from "../../lib/heroSheetStore";
import { useBookBookmark } from "../library/useBookBookmark";
import { useKidSouvenirs } from "./rewards/useKidSouvenirs";
import { useChildCollection } from "../../hooks/useChildCollection";
import { BOOK_READS, bookReadRow, catalogueBookId, type BookRead } from "../../lib/bookReads";
import { trackBookFinished, trackBookOpened } from "../../lib/kpiEvents";

export default function KidBookReaderView({ bookId, onClose }: { bookId: string; onClose: () => void }) {
  const { childProfile } = useArbor();
  const { uiLang, aiLang } = useLanguage();
  const { user, firebaseEnabled } = useAuth();
  const lang = storyLanguage(uiLang, aiLang) === "he" ? "he" : "en";
  const entries = useChildLibraryBooks(childProfile.id);
  const entry = entries.find((e) => e.book.id === bookId) ?? null;
  const owner = useSyncExternalStore(subscribeHeroSheetOwner, heroSheetOwnerKey, heroSheetOwnerKey);
  const edition = useMemo(() => entry ? bookEdition(entry.book, entry.doc) : "", [entry]);
  const recordOwner = firebaseEnabled ? user?.uid ?? "signed-out" : "local-sandbox";
  if (!entry || owner !== recordOwner || owner === "signed-out") return <KidStageFallback />;
  return <OwnedBookReader key={JSON.stringify([owner, childProfile.id, bookId, edition])} entry={entry} edition={edition} owner={owner} lang={lang} onClose={onClose} />;
}

function OwnedBookReader({ entry, edition, owner, lang, onClose }: { entry: LibraryBookEntry; edition: string; owner: string; lang: "en" | "he"; onClose: () => void }) {
  const { childProfile } = useArbor();
  const progress = useBookBookmark(childProfile.id, entry.book, edition, owner);
  const souvenirs = useKidSouvenirs(childProfile.id);
  // B-BOOK-51: one open event per opening, one finish per true ending (the
  // reader's last-page -> END transition; a resumed END never counts), and the
  // one read ledger. Catalogue ids only: never the child, never the path chosen.
  const reads = useChildCollection<BookRead>(childProfile.id, BOOK_READS);
  const readsRef = useRef(reads);
  readsRef.current = reads;
  const bookEvent = useMemo(() => ({ bookId: catalogueBookId(entry.book), lang, hero: "own" as const }), [entry.book, lang]);
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    trackBookOpened(bookEvent);
  }, [bookEvent]);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const folder = lang === "he" ? (heGender(childProfile.gender) === "f" ? "he-f" : "he-m") : "en";
  const [resolved, setResolved] = useState<ResolvedBookAssets | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const doc = entry.doc;
  useEffect(() => {
    let live = true;
    let got: ResolvedBookAssets | null = null;
    setResolved(null);
    setUnavailable(false);
    // K2: a file that arrives late (a passing failure, retried) re-renders the page with it
    resolveBookAssets(childProfile.id, doc, folder, { isCurrent: () => live && progressRef.current.current(), onLate: (next) => { if (live && progressRef.current.current()) setResolved(next); } })
      .then((r) => {
        got = r;
        if (live && progressRef.current.current()) setResolved(r);
        else r.revoke();
      })
      .catch(() => live && progressRef.current.current() && setUnavailable(true));
    return () => {
      live = false;
      got?.revoke();
    };
  }, [childProfile.id, doc, folder]);
  // A book that cannot open goes back home rather than showing a broken page.
  useEffect(() => {
    if (unavailable) onClose();
  }, [unavailable, onClose]);
  const child = useMemo(
    // B-KID-168: an English book names the child in English letters when the parent saved them.
    () => ({ id: childProfile.id, name: storyName(childProfile, lang), gender: childProfile.gender, heroSheetId: doc?.sheetId ?? null }),
    [childProfile.id, childProfile.name, childProfile.nameLatin, lang, childProfile.gender, doc?.sheetId],
  );
  return (
    <div className="arbor-play" data-kid-library-book={entry.book.id} style={{ position: "fixed", inset: 0, zIndex: 80 }}>
      {resolved && progress.initialState ? (
        <BookReader book={entry.book} lang={lang} child={child} onClose={onClose} dev={false} sheet={resolved.sheet} assets={resolved.narration} voiceSet={entry.doc.setId} initialState={progress.initialState} onProgress={progress.save} onComplete={() => {
          if (progress.current() && souvenirs.loaded && souvenirs.isCurrent()) void souvenirs.awardOnce("book", entry.book.id).catch(() => undefined);
          if (progress.current()) {
            trackBookFinished(bookEvent);
            const row = bookReadRow(bookEvent.bookId, lang, new Date());
            if (row) void readsRef.current.upsert(row).catch(() => undefined);
          }
        }} progressNotice={progress.status === "error" ? <button type="button" onClick={progress.retry} aria-label={lang === "he" ? "הסימנייה לא נשמרה. נסו שוב" : "Bookmark not saved. Retry"} style={{ minHeight: 44, maxWidth: "100%", padding: "4px 8px", borderRadius: 12, background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", fontSize: 16 }}>
          {lang === "he" ? "סימנייה · נסו שוב" : "Bookmark · Retry"}
        </button> : null} />
      ) : (
        <KidStageFallback />
      )}
    </div>
  );
}
