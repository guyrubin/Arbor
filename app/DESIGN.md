# Design

Captured from the live code (src/index.css "Arbor 2035 Sapphire", src/lib/tokens.ts). The active app-wide palette is the flat clinical override on `.arbor-app, .arbor-parent`; build against token names, not hex.

## Theme

Light only. No dark mode. Flat clinical surfaces; depth via hairline borders + neutral shadows, not glass.

## Color

- Canvas `--arbor-paper` #fbfaf7 · cards `--arbor-paper-elevated` #fff · recessed wells `--arbor-paper-deep` #eef3fb
- Ink `--arbor-ink` #14225a (navy) · `--arbor-ink-soft` · `--arbor-muted` #475569 (AA on paper and tinted wells) · `--arbor-faint` / `--arbor-muted-alt` alias muted for existing captions
- Hairlines `--arbor-rule` #e8eee9 · `--arbor-rule-strong`
- Primary sapphire `--arbor-clay` #1558c0 (normal text + solid CTA) · hover/ink `--arbor-clay-deep` #124da8 · `--arbor-clay-ink` aliases deep · tint `--arbor-clay-dim` · `--accent` aliases clay
- Jewel accents, each `-soft` (tint bg) + `-ink` (AA text): green (success), peach, lav, yellow, pink, sky. CR-01 text inks: green #066446, peach/yellow #92400e, pink #9d174d, sky #075985; lavender #6d28d9 unchanged. Solid jewel accents remain decorative.
- Primary gradients `--gradient-cta` / `--arbor-gradient-primary`: sapphire #1a6be8 → #1558c0 → #124da8, with `--arbor-on-accent` labels. `--arbor-green-cta-start` retains its legacy name. Hero/coach washes and decorative progress retain their existing values.
- Shell chrome: active pill `--arbor-subtab-active` #14225a with `--arbor-subtab-on-ink` #fff

### CR-01 contrast contract (authorized 2026-09-03)

Normal-size text uses a minimum 4.5:1 contrast in root, theme and flat parent cascades. Muted/faint captions share a readable ink; use type size/weight and spacing for hierarchy, never reduced opacity. Primary CTA labels use `--arbor-on-accent`; every declared primary gradient stop must meet the same floor. The recommended #1a6be8 is safe behind white labels (4.87:1), but fails as small text on the deep well (4.37:1); the darker sapphire text/fill resolves that case without a parallel palette.

`src/lib/tokens.contrast.test.ts` calculates declared foreground/background pairs, alpha tints over paper/deep/sunk wells, and samples through primary gradient segments. It resolves aliases at their declaring scope and includes pre-fix negative controls. Missing/unsupported colours and unmodelled colour scopes fail. `tokens.test.ts` retains the unrelated hex, rgba, font, layout and literal freezes; only authorized text/CTA expectations change. Decorative progress is pinned to its pre-CR-01 appearance in both scopes.

Parent benefit: the main action and its small supporting caption remain readable together on recessed/tinted cards. Source arithmetic found a 4.705:1 minimum across covered normal-text pairs; this is not a rendered accessibility verdict.

G0 types/tests/floors/framework, 390px containment, 44px targets, console and Hebrew RTL remain the parent orchestrator's gates. G1 must compare current production overview/settings with the built routes before G2 is judged. No G0/G1/G2 pass is claimed from source inspection.

Consumer handoff outside this module: `src/components/practice/PracticeStudioTab.tsx` uses the saturated `--arbor-hero-grad` behind small `--arbor-ink` / `--arbor-ink-soft` text. Change that section background to the existing `--arbor-coach-grad` (retain the primary CTA gradient), then verify the rendered heading and caption. The guard covers paper/tinted surfaces and primary CTAs; arbitrary consumer backgrounds, opacity/filter effects, artwork and other gradient families require rendered review.

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
- Shared Button: primary uses clay/on-accent and clay-deep hover; ghost uses muted. Both sizes use the existing `touch-target` floor, whose app-scoped selector wins over the shell's min-width reset.
- Icons: Material Symbols Rounded via `<Icon name>` inside surfaces; lucide-react only for NavItem/HubHero props. Never mix within one surface.

## Motion

- `motion/react`, app-wide `MotionConfig reducedMotion="user"`
- Tab crossfade 0.16s handled by Shell (never add an outer wrapper transition)
- Card entrance: `initial={{opacity:0, y:10}} animate={{opacity:1, y:0}}`; list stagger via `arbor-fade-up` on main children
- Hover lift `motion-safe:hover:-translate-y-0.5`; press `active:scale-[0.98]`; 150–250ms state transitions
- Confetti (`canvas-confetti` + BRAND_CONFETTI) reserved for completion moments, reduced-motion gated

## RTL

`html[lang="he"]` swaps fonts and mirrors the shell; card roots set `dir`, content text `dir="auto"`; use logical properties (ms-/ps-/text-start); directional icons `rtl:-scale-x-100`.
