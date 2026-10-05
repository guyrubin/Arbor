/**
 * B-KID-48 (KA-25) — the sentinel useHeroAvatar returns for a child with no
 * first name. It is NEVER rendered to the child: callers compare against it and
 * show a keyed no-name line instead (elev.kid.greeting.noName,
 * elev.kid.hero.altUnnamed). Lives in lib so a test that mocks HeroAvatar does
 * not hide it.
 */
export const HERO_NAME_FALLBACK = "your child";
