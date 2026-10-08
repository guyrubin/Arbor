# Design

Captured from the live code (src/index.css "Arbor 2035 Sapphire", src/lib/tokens.ts). The active app-wide palette is the flat clinical override on `.arbor-app, .arbor-parent`; build against token names, not hex.

## Theme

Light only. No dark mode. Flat clinical surfaces; depth via a hairline ring + one neutral 2 px lift, never glass on content. **Glass on sticky chrome only** (B-DESIGN-02, framer decision 7 Oct): the sticky top bar and the dock may take `.arbor-chrome-glass` (`--arbor-chrome-glass` = paper at 80 % + `--arbor-chrome-blur` 14 px); every card, sheet and row under it stays opaque.

## Color

- Canvas `--arbor-paper` #fbfaf7 · cards `--arbor-paper-elevated` #fff · recessed wells `--arbor-paper-deep` #eef3fb
- Ink `--arbor-ink` #14225a (navy) · `--arbor-ink-soft` · `--arbor-muted` #475569 (AA on paper and tinted wells) · `--arbor-faint` / `--arbor-muted-alt` alias muted for existing captions
- Hairlines `--arbor-rule` #e8eee9 · `--arbor-rule-strong`
- Primary sapphire `--arbor-clay` #1558c0 (normal text + solid CTA) · hover/ink `--arbor-clay-deep` #124da8 · `--arbor-clay-ink` aliases deep · tint `--arbor-clay-dim` · `--accent` aliases clay
- Jewel accents, each `-soft` (tint bg) + `-ink` (AA text): green (success), peach, lav, yellow, pink, sky. CR-01 text inks: green #066446, peach/yellow #92400e, pink #9d174d, sky #075985; lavender #6d28d9 unchanged. Solid jewel accents remain decorative.
- Primary gradients `--gradient-cta` / `--arbor-gradient-primary`: sapphire #1a6be8 → #1558c0 → #124da8, with `--arbor-on-accent` labels. `--arbor-green-cta-start` retains its legacy name. Hero/coach washes and decorative progress retain their existing values.
- Shell chrome: active pill `--arbor-subtab-active` #14225a with `--arbor-subtab-on-ink` #fff
- Shelf washes (fixed strength, flat): `--arbor-sky-wash` · `--arbor-green-wash` · `--arbor-peach-wash` · `--arbor-lav-wash` · `--arbor-pink-wash` = the jewel 9 % into `--arbor-paper-elevated`, `--arbor-yellow-wash` 11 %; hands (tint deep) uses `--arbor-paper-deep`. Used on the Journal grid tiles and the shelf-page header ONLY: never on Milestones rows, never a strength chosen by count, answers or state. A glyph chip on a wash is a white chip. Contrast-pinned with muted / ink-soft / every -ink.

### CR-01 contrast contract (authorized 2026-09-03)

Normal-size text uses a minimum 4.5:1 contrast in root, theme and flat parent cascades. Muted/faint captions share a readable ink; use type size/weight and spacing for hierarchy, never reduced opacity. Primary CTA labels use `--arbor-on-accent`; every declared primary gradient stop must meet the same floor. The recommended #1a6be8 is safe behind white labels (4.87:1), but fails as small text on the deep well (4.37:1); the darker sapphire text/fill resolves that case without a parallel palette.

`src/lib/tokens.contrast.test.ts` calculates declared foreground/background pairs, alpha tints over paper/deep/sunk wells, and samples through primary gradient segments. It resolves aliases at their declaring scope and includes pre-fix negative controls. Missing/unsupported colours and unmodelled colour scopes fail. `tokens.test.ts` retains the unrelated hex, rgba, font, layout and literal freezes; only authorized text/CTA expectations change. Decorative progress is pinned to its pre-CR-01 appearance in both scopes.

Parent benefit: the main action and its small supporting caption remain readable together on recessed/tinted cards. Source arithmetic found a 4.705:1 minimum across covered normal-text pairs; this is not a rendered accessibility verdict.

Rendered checks complement the source guard: compare the same Overview, Settings and Practice routes in English and Hebrew at 390px, measure actual control targets and inspect the console. Synthetic development data and CSS benchmarks must be identified as such in the release evidence.

Practice Studio uses `--arbor-coach-grad` behind its small heading/caption and retains the primary CTA gradient. Timeline filter counts inherit their opaque label ink; reducing count opacity can fail contrast even when the underlying tokens pass. The guard covers paper/tinted surfaces and primary CTAs; arbitrary consumer backgrounds, opacity/filter effects, artwork and other gradient families require rendered review.

`src/lib/whiteLabelContrast.test.ts` scans production source for white-label consumers. Direct opaque approved fills with audited neutral ancestry pass for the enabled, settled state. Actual wrapper imports/props, motion targets and reviewed CSS rules are checked; unknown presentation, token overrides and opacity effects fail. Initial/exit transitions and genuinely disabled controls are outside this settled-state claim; dynamic/inherited/alpha legacy cases remain an explicit sealed inventory. New or changed unresolved cases fail. The current inventory is 86 sites: 67 approved direct fills and 19 unverified legacy cases. This ratchet prevents regression; it does not certify the remaining cases. Sandbox help uses peach ink (7.09:1 against white); Original story badges use pink ink (7.88:1). Story badge positions and corner radii follow logical directions so Hebrew age pills do not cover them.

## Typography

Chosen 7 Oct (P7-DESIGN, Option A + three B elements; `execution/2026-10-07--design-direction/option-ab-blend.html` is the design of record).

- Display `--font-display` Fraunces variable, optical size auto + `"SOFT" 40` (HE: Frank Ruhl Libre variable 300–900) — h1–h3 automatic; H1 weight `--arbor-w-hero` 500, titles `--arbor-w-title` 600, quotes 400
- Body `--font-sans` **Instrument Sans / IBM Plex Sans Hebrew** — ONE Latin-first stack for both locales (a Latin name on a Hebrew page keeps the Latin face). The kid register (`.arbor-play`) keeps Nunito / Heebo; never cross them
- Editorial accent `--font-editorial` Instrument Serif with `font-size-adjust` `--arbor-editorial-adjust` .5 (none in HE)
- Scale: the bottom is unchanged (`--t-xs`…`--t-2xl`, utilities `.t-xs`…`.t-2xl`); the top opens to one loud step per screen: H1 `--t-hero` 34 px (44 px at ≥ 1280) · title `--t-title` 22 · the family's words `--t-say` 24 (HE 22) · kicker `--t-kicker` 12 uppercase tracked (HE 13, no uppercase). Utilities `.arbor-type-hero` / `-title` / `-say` / `-kicker` bundle face, weight and size
- Numerals `tabular-nums lining-nums` on `time`, `table` and `.arbor-num` (times and counts align). A count is never a big numeral
- **Accent rule: one warm accent per screen** — the family's words in the editorial face on a 2 px ink rule (`.arbor-accent-rule`), shelf and day on their own line. A second accent (a chip, a coloured date) competes and is removed. On a shelf page the 96 px shelf glyph at 12 % is the accent instead

## Shape & Space

- Radii `--r-sm` 10px, `--r` 14px, `--r-lg` 18px, `--r-xl` 22px (Tailwind rounded-xl/2xl/3xl remapped to these)
- Standard card chrome: `cardCls` from tokens.ts = white bg, 18px radius, `--arbor-rule` border, `--shadow-xs` (legacy; new cards take the depth below)
- Depth: `--arbor-shadow-card` = hairline ring + one 2 px lift on every card (`.arbor-depth-card`); `--arbor-shadow-primary` (deep, `0 22 40 -28` ink at 34 %) on the screen's ONE primary card (`.arbor-depth-primary`), never two. Use the classes or an inline `boxShadow`: a Tailwind `shadow-*` class is remapped to `--shadow-sm` by index.css
- Shadows `--shadow-xs`…`--shadow-xl` (neutral) · focus `--ring` · touch floor `--touch-min` 44px
- Rhythm (8-pt): sections 32 · between cards 12 · card padding 20

## Components

- Cards: `cardCls` + `p-5`; header = 40×40 rounded-2xl icon chip in a `-soft` tint with `-ink` icon
- `ShelfGlyph` (components/ui): a shelf's mark at 44 px (`--arbor-glyph-chip`), duotone — the registry glyph FILL 1 in the jewel at 30 % under a 500-weight `-ink` outline, on the `-soft` chip (white chip when on a wash). The tint names the shelf, never the child: same chip for every count and answer
- `SectionHead` (components/ui): kicker row = glyph + title + hairline rule to the end edge; logical, EN + HE. Each section starts with one
- `SegmentedAnswers` (components/ui): the three answers Seen it / Not yet / Not sure as ONE segmented control — deep-well track, three 44 px cells, resting NEUTRAL (three equal plain cells, none reads pre-selected); the stored answer is the pressed cell (`--arbor-clay` fill, on-accent label, a leading check glyph, the same for all three); `aria-pressed`, arrow keys move between cells. Used wherever the three answers appear (Notice card, Milestones rows, shelf-page Notice)
- Chips/pills: `rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase` in tint pairs
- Kit primitives (src/components/ui/kit.tsx): PageHeader, SectionCard, Chip, IconBadge, ProgressBar (count-based only), HubHero pattern in section files
- Shared Button: primary uses clay/on-accent and clay-deep hover; ghost uses muted. Both sizes use the existing `touch-target` floor, whose app-scoped selector wins over the shell's min-width reset.
- Icons: Material Symbols Rounded via `<Icon name>` inside surfaces; lucide-react only for NavItem/HubHero props. Never mix within one surface. Chrome icons (top bar, dock, nav) are weight 300 outline and filled when active: `<Icon name chrome active={on}>`. Content glyphs are the duotone `ShelfGlyph`. A glyph outside the subset needs `npm run build:icon-font` (networked)

## Motion

- `motion/react`, app-wide `MotionConfig reducedMotion="user"`
- Tab crossfade 0.16s handled by Shell (never add an outer wrapper transition)
- Card entrance: `initial={{opacity:0, y:10}} animate={{opacity:1, y:0}}`; list stagger via `arbor-fade-up` on main children
- Hover lift `motion-safe:hover:-translate-y-0.5`; press `active:scale-[0.98]`; 150–250ms state transitions
- Confetti (`canvas-confetti` + BRAND_CONFETTI) reserved for completion moments, reduced-motion gated

## RTL

`html[lang="he"]` swaps the display face (the body stack is shared) and mirrors the shell; card roots set `dir`, content text `dir="auto"`; use logical properties (ms-/ps-/text-start); directional icons `rtl:-scale-x-100`. The icon class `.msr` sets `direction: ltr`: a glyph positioned with `inset-inline-*` (the shelf-page bleed glyph) needs `direction: inherit`.
