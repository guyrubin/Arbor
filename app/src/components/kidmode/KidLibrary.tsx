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
import { useState, useSyncExternalStore } from "react";
import type { ChildProfile, HeroStorySpec } from "../../types";
import type { KidThemeId } from "../../lib/kidThemeManifest";
import { kidsStoriesText } from "../../lib/i18nElevation/kidsStories";
import { HeroAvatar, resolveHeroUrl } from "../ui/HeroAvatar";
import { KID_BOOK_EAGER_COUNT, KidBookCover } from "./KidBookCover";
import KidComicsShelf from "./KidComicsShelf";
import { kidIsolate } from "./kidText";
import { heroSheetOwnerKey, subscribeHeroSheetOwner } from "../../lib/heroSheetStore";
import { scopedKidLibraryKey } from "./kidLibraryScope";
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

export default function KidLibrary(props: KidLibraryProps) {
  // Remount the reading surface on every owner/child change. Merely keying
  // the nested shelf is insufficient: its "reading" callback can leave the
  // outer library grid hidden when a parent switches children or accounts.
  // A -> B -> A must also start with a closed reader, never reused old state.
  const owner = useSyncExternalStore(subscribeHeroSheetOwner, heroSheetOwnerKey, heroSheetOwnerKey);
  const scope = scopedKidLibraryKey(owner, props.childProfile.id);
  return <ScopedKidLibrary key={scope} {...props} owner={owner} scope={scope} />;
}

function ScopedKidLibrary({ books, theme, lang, childProfile, loadingId, onOpen, owner, scope }: KidLibraryProps & { owner: string; scope: string }) {
  // This state belongs to exactly one owner/child lifetime, not just a child id.
  // A saved comic open in the reader takes the whole surface.
  const [readingComic, setReadingComic] = useState(false);
  // B-BOOK-26: the child's own approved portrait on every title-card cover (never a shared likeness).
  const ownHero = resolveHeroUrl(childProfile) ? <HeroAvatar size={40} mood="wave" animate={false} ring={false} badge={false} decorative /> : undefined;
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
                hero={ownHero}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="comic-panel flex flex-col items-center gap-3 p-6 text-center" data-testid="kid-library-empty">
          <HeroAvatar size={88} mood="think" animate={false} decorative />
          <p className="kid-type-label" dir="auto" style={{ color: "var(--arbor-ink)" }}>{kidsStoriesText("kidBooks.empty", lang)}</p>
        </div>
      ))}
      {/* "Made before": the saved comics, after the books, only those that open on this device. */}
      {owner !== "signed-out" && <KidComicsShelf key={scope} authKey={owner} childProfile={childProfile} variant="madeBefore" onReadingChange={setReadingComic} />}
    </div>
  );
}
