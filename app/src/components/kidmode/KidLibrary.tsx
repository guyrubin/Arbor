/**
 * KidLibrary — B-KID-85 (KB-28 + KA-04): the kid "My books" screen. It
 * replaces the kid story catalogue (crest, Sprout bubble, pack filter chips,
 * age switch, ribbons, virtue chips, the separate Library shelf) with ONE
 * cover grid: 2 columns at phone width, the title under each cover, the books
 * from the one list (kidBooks — the home row reads the same), then the saved
 * comics ("Made before") from this device. The overlay title names the
 * screen ("My books"); this component prints no second title and no back.
 *
 * - No filters, no ages, no "ORIGINAL" ribbon, no virtue tags, no counts.
 * - A finished book carries the small read mark (KidBookCover).
 * - A child with nothing to read gets an honest line with the hero, never a
 *   grid of content written for someone else.
 * - Zero model calls: covers are static art or token title cards.
 */
import { useState } from "react";
import type { ChildProfile, HeroStorySpec } from "../../types";
import type { KidThemeId } from "../../lib/kidThemeManifest";
import { kidsStoriesText } from "../../lib/i18nElevation/kidsStories";
import { HeroAvatar } from "../ui/HeroAvatar";
import { KID_BOOK_EAGER_COUNT, KidBookCover } from "./KidBookCover";
import KidComicsShelf from "./KidComicsShelf";
import { kidIsolate } from "./kidText";
import type { KidBook } from "./kidBooks";

export interface KidLibraryProps {
  books: readonly KidBook[];
  theme: KidThemeId;
  lang: "en" | "he";
  childProfile: ChildProfile;
  /** The story whose book is opening (its cover is busy; the grid is inert). */
  loadingId: string | null;
  onOpen: (story: HeroStorySpec) => void;
}

export default function KidLibrary({ books, theme, lang, childProfile, loadingId, onOpen }: KidLibraryProps) {
  // A saved comic open in the reader takes the whole surface.
  const [readingComic, setReadingComic] = useState(false);
  return (
    <div className="space-y-6" data-testid="kid-library">
      {!readingComic && (books.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(150px,220px))] sm:justify-center" data-kid-library-grid="" style={{ listStyle: "none", margin: 0, padding: 0 }} aria-busy={loadingId ? true : undefined}>
          {books.map((b, i) => (
            <li key={b.story.id} style={{ opacity: loadingId && loadingId !== b.story.id ? 0.6 : 1 }}>
              <KidBookCover
                layout="grid"
                eager={i < KID_BOOK_EAGER_COUNT}
                storyId={b.story.id}
                title={kidIsolate(lang === "he" ? b.story.titleHe : b.story.title)}
                pack={b.story.pack}
                theme={theme}
                read={b.state === "finished"}
                readLabel={kidsStoriesText("kidBooks.readMark", lang)}
                onOpen={() => { if (!loadingId) onOpen(b.story); }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="comic-panel flex flex-col items-center gap-3 p-6 text-center" data-testid="kid-library-empty">
          <HeroAvatar size={88} mood="think" animate={false} decorative />
          <p className="font-black" dir="auto" style={{ fontSize: 18, color: "var(--arbor-ink)" }}>{kidsStoriesText("kidBooks.empty", lang)}</p>
        </div>
      ))}
      {/* "Made before": the saved comics, after the books, only those that open on this device. */}
      <KidComicsShelf key={childProfile.id} childProfile={childProfile} variant="madeBefore" onReadingChange={setReadingComic} />
    </div>
  );
}
