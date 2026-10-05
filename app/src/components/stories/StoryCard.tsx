/**
 * StoryCard — B-KID-87 (KB-29) + B-KID-81 (KB-14): the ONE parent-register
 * card for a library book. The parent Stories catalogue ("More stories") and
 * #/comics "Our books" both draw it, so a book looks the same wherever a
 * grown-up meets it, and the kid register keeps its own KidBookCover.
 *
 * - The cover is the book's own cover in the child's ONE kid theme (the
 *   manifest, `kidArt`), portrait 3:4. A book with no cover in that theme gets
 *   a quiet title card in the pack's soft tint (tokens only). Never a runtime-drawn
 *   scene, never an emoji motif, never another theme's file: zero model calls.
 * - The title is printed under the cover and names the button.
 * - `ribbon` (top inline-start corner) and `children` (under the title) are the
 *   caller's: the catalogue puts "Your aim" and Play there, Our books nothing.
 */
import type { ReactNode } from "react";
import type { HeroPackId, HeroStorySpec } from "../../types";
import { kidArt, kidArtSrcSet, storyCoverKey, type KidThemeId } from "../../lib/kidThemeManifest";

/** The pack's soft tint (the parent register's art band). */
export const STORY_PACK_SOFT: Record<HeroPackId, string> = {
  courage: "var(--arbor-peach-soft)",
  responsibility: "var(--arbor-yellow-soft)",
  growth: "var(--arbor-clay-soft)",
  wisdom: "var(--arbor-sky-soft)",
  truth: "var(--arbor-lav-soft)",
};

/** The pack's ink + bilingual label (parent chips). */
export const STORY_PACK_LABEL: Record<HeroPackId, { ink: string; en: string; he: string }> = {
  courage: { ink: "var(--arbor-peach-ink)", en: "Courage", he: "אומץ" },
  responsibility: { ink: "var(--arbor-yellow-ink)", en: "Responsibility", he: "אחריות" },
  growth: { ink: "var(--arbor-clay-deep)", en: "Growth", he: "צמיחה" },
  wisdom: { ink: "var(--arbor-sky-ink)", en: "Wisdom", he: "חוכמה" },
  truth: { ink: "var(--arbor-pack-truth)", en: "Truth", he: "אמת" },
};

export const storyCardTitle = (story: HeroStorySpec, lang: "en" | "he"): string => (lang === "he" ? story.titleHe : story.title);

export interface StoryCardProps {
  story: HeroStorySpec;
  /** UI language (title + pack label). */
  lang: "en" | "he";
  /** The child's ONE kid theme: the cover comes from it, or the title card. */
  theme: KidThemeId;
  onOpen: () => void;
  /** Another book is opening: this one ignores taps (aria-disabled). */
  disabled?: boolean;
  /** A small label pinned to the cover's top inline-start corner. */
  ribbon?: ReactNode;
  /** Rows under the title (chips, the Play affordance). */
  children?: ReactNode;
  testId?: string;
}

export function StoryCard({ story, lang, theme, onOpen, disabled, ribbon, children, testId }: StoryCardProps) {
  const art = kidArt(theme, storyCoverKey(story.id));
  const title = storyCardTitle(story, lang);
  return (
    <button
      type="button"
      onClick={() => { if (!disabled) onOpen(); }}
      aria-disabled={disabled || undefined}
      aria-label={`${title} — ${STORY_PACK_LABEL[story.pack][lang]}`}
      data-story-card={story.id}
      data-testid={testId}
      className="group text-start flex flex-col gap-2 rounded-2xl p-0 focus:outline-none focus-visible:ring-2"
      style={{ background: "transparent", border: "none", cursor: disabled ? "default" : "pointer" }}
    >
      <span
        className="relative block w-full overflow-hidden rounded-xl"
        style={{ aspectRatio: "3 / 4", background: STORY_PACK_SOFT[story.pack], border: "1px solid var(--arbor-rule)" }}
      >
        {art ? (
          <img
            src={art.src480}
            srcSet={kidArtSrcSet(art)}
            sizes="(max-width: 639px) 45vw, 200px"
            width={art.width}
            height={Math.round((art.width * 4) / 3)}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            data-story-card-cover=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: art.objectPosition }}
          />
        ) : (
          <span aria-hidden="true" data-story-card-titlecard="" className="absolute inset-0 grid place-items-center p-3 text-center">
            <span className="line-clamp-4 font-extrabold" style={{ fontFamily: "var(--font-display)", fontSize: 16, lineHeight: 1.2, color: "var(--arbor-ink)" }}>
              {title}
            </span>
          </span>
        )}
        {ribbon && (
          <span className="absolute top-0 z-[2]" style={{ insetInlineStart: 0 }}>
            {ribbon}
          </span>
        )}
      </span>
      <span className="block px-0.5">
        <span className="block font-extrabold text-[14.5px] leading-tight line-clamp-2" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }} dir="auto">
          {title}
        </span>
        {children}
      </span>
    </button>
  );
}

export default StoryCard;
