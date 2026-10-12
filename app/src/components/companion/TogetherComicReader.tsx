import React, { useEffect, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { adventureTitle, isStrictComicImageDataUrl, rehydrateSavedMetaPagesFromStore, type ShelfBook } from "../../lib/heroComics";
import SavedComicReader from "../stories/SavedComicReader";
import { useHeroAvatar } from "../ui/HeroAvatar";

/* v3 F-TOG-2 — a saved comic book, read from the Stories pill's sheet.

   Read-only: the pages are the ones the book was saved with, read back from
   this device's store (all or nothing, the same key token the comic maker
   wrote them under). With every page present the parent's comic reader shows
   them — the reader ComicsTab already uses, embedded: the sheet names the
   book and closes it, so the reader shows no Back and no title row. A book
   whose pages live on another device says so; nothing here builds, generates
   or saves a page. */

type Loaded = { key: string; pages: string[] } | null;

export default function TogetherComicReader({ book, title, onClose }: { book: ShelfBook; title: string; onClose: () => void }) {
  const { childProfile } = useArbor();
  const { t } = useLanguage();
  const { url: heroUrl } = useHeroAvatar();
  const avatarKeyToken = heroUrl && heroUrl.startsWith("data:") ? heroUrl : "no-hero";
  const meta = book.meta;
  const key = `${childProfile.id}|${book.id}|${meta?.createdAt ?? ""}`;
  const [loaded, setLoaded] = useState<Loaded>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!meta) return;
    let live = true;
    rehydrateSavedMetaPagesFromStore(childProfile.id, meta, avatarKeyToken)
      .then((pages) => { if (live) setLoaded({ key, pages: pages.length > 0 && pages.every(isStrictComicImageDataUrl) ? pages : [] }); })
      .catch(() => { if (live) setLoaded({ key, pages: [] }); });
    return () => { live = false; };
  }, [childProfile.id, meta, avatarKeyToken, key]);

  const current = loaded && loaded.key === key ? loaded : null;
  if (!meta || unavailable || (current && current.pages.length === 0)) {
    return <p role="status" className="companion-caption" data-testid="together-book-off-device">{t("companion.together-view.book-off-device")}</p>;
  }
  if (!current) return <p role="status" className="companion-caption" data-testid="together-book-opening">{t("companion.together-view.book-opening")}</p>;
  const pages = current.pages.map((dataUrl, index) => ({ dataUrl, title: index === 0 ? title : `${adventureTitle(book, meta.lang)} · ${index}` }));
  return <SavedComicReader key={key} embedded title={title} lang={meta.lang} pages={pages} onBack={onClose} onUnavailable={() => setUnavailable(true)} />;
}
