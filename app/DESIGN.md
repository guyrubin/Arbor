# Design

Captured from the live code (src/index.css "Arbor 2035 Sapphire", src/lib/tokens.ts). The active app-wide palette is the flat clinical override on `.arbor-app, .arbor-parent`; build against token names, not hex.

## Theme

Light only. No dark mode. Flat clinical surfaces; depth via hairline borders + neutral shadows, not glass.

## Color

- Canvas `--arbor-paper` #fbfaf7 · cards `--arbor-paper-elevated` #fff · recessed wells `--arbor-paper-deep` #eef3fb
- Ink `--arbor-ink` #14225a (navy, AAA) · `--arbor-ink-soft` · `--arbor-muted` #6b7a6e (AA) · `--arbor-faint` (captions only)
- Hairlines `--arbor-rule` #e8eee9 · `--arbor-rule-strong`
- Primary sapphire `--arbor-clay` #2b7fff · hover `--arbor-clay-deep` · tint `--arbor-clay-dim` · `--accent`
- Jewel accents, each `-soft` (tint bg) + `-ink` (AA text): green (success), peach, lav, yellow, pink, sky
- Gradients: `--gradient-cta` (primary CTA), `--arbor-hero-grad`, `--arbor-coach-grad`
- Shell chrome: active pill `--arbor-subtab-active` #14225a with `--arbor-subtab-on-ink` #fff

## Typography

- Display `--font-display` Fraunces (HE: Frank Ruhl Libre) — h1–h3 automatic
- Body `--font-sans` Nunito (HE: Heebo)
- Editorial accent `--font-editorial` Instrument Serif (sparing)
- Rem scale `--t-xs`…`--t-2xl` + utilities `.t-xs`…`.t-2xl`; fixed scale, no clamp

## Shape & Space

- Radii `--r-sm` 10px, `--r` 14px, `--r-lg` 18px, `--r-xl` 22px (Tailwind rounded-xl/2xl/3xl remapped to these)
- Standard card chrome: `cardCls` from tokens.ts = white bg, 18px radius, `--arbor-rule` border, `--shadow-xs`
- Shadows `--shadow-xs`…`--shadow-xl` (neutral) · focus `--ring` · touch floor `--touch-min` 44px

## Components

- Cards: `cardCls` + `p-5`; header = 40×40 rounded-2xl icon chip in a `-soft` tint with `-ink` icon
- Chips/pills: `rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase` in tint pairs
- Kit primitives (src/components/ui/kit.tsx): PageHeader, SectionCard, Chip, IconBadge, ProgressBar (count-based only), HubHero pattern in section files
- Icons: Material Symbols Rounded via `<Icon name>` inside surfaces; lucide-react only for NavItem/HubHero props. Never mix within one surface.

## Motion

- `motion/react`, app-wide `MotionConfig reducedMotion="user"`
- Tab crossfade 0.16s handled by Shell (never add an outer wrapper transition)
- Card entrance: `initial={{opacity:0, y:10}} animate={{opacity:1, y:0}}`; list stagger via `arbor-fade-up` on main children
- Hover lift `motion-safe:hover:-translate-y-0.5`; press `active:scale-[0.98]`; 150–250ms state transitions
- Confetti (`canvas-confetti` + BRAND_CONFETTI) reserved for completion moments, reduced-motion gated

## RTL

`html[lang="he"]` swaps fonts and mirrors the shell; card roots set `dir`, content text `dir="auto"`; use logical properties (ms-/ps-/text-start); directional icons `rtl:-scale-x-100`.
