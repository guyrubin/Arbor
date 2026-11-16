/** Clay Theatre colour: every value is a maker-palette or Studio token,
 * mixed with color-mix(). No literals (the kid colour guard). */
export const mix = (a: string, pct: number, b: string) => `color-mix(in srgb, ${a} ${pct}%, ${b})`;
export const fade = (a: string, pct: number) => mix(a, pct, 'transparent');
export const INK = {
  white: 'var(--mk-white)', chalk: 'var(--mk-chalk)', paper: 'var(--mk-paper)', paperShade: 'var(--mk-paper-shade)', cream: 'var(--mk-cream)',
  ink: 'var(--mk-ink)', shadow: 'var(--mk-shadow)', linen: 'var(--mk-linen)', linenShade: 'var(--mk-linen-shade)',
  wood: 'var(--mk-wood)', woodLight: 'var(--mk-wood-light)', woodDark: 'var(--mk-wood-dark)', sand: 'var(--mk-sand)', umber: 'var(--mk-umber)',
  gold: 'var(--mk-gold)', goldLight: 'var(--mk-gold-light)', goldDeep: 'var(--mk-gold-deep)', brass: 'var(--mk-brass)', steel: 'var(--mk-steel)', steelLight: 'var(--mk-steel-light)', steelDark: 'var(--mk-steel-dark)',
  celadon: 'var(--mk-celadon)', celadonDeep: 'var(--mk-celadon-deep)', sage: 'var(--mk-sage)', spring: 'var(--mk-spring)', leaf: 'var(--mk-leaf)', leafDeep: 'var(--mk-leaf-deep)', moss: 'var(--mk-moss)',
  teal: 'var(--mk-teal)', tealDeep: 'var(--mk-teal-deep)', sea: 'var(--mk-sea)', water: 'var(--mk-water)', sky: 'var(--mk-sky)', skyPale: 'var(--mk-sky-pale)',
  indigo: 'var(--mk-indigo)', indigoDeep: 'var(--mk-indigo-deep)', night: 'var(--mk-night)', slate: 'var(--mk-slate)', snow: 'var(--mk-snow)', snowShade: 'var(--mk-snow-shade)',
  blossom: 'var(--mk-blossom)', rose: 'var(--mk-rose)', roseDeep: 'var(--mk-rose-deep)', poppy: 'var(--mk-poppy)', red: 'var(--mk-red)', orange: 'var(--mk-orange)', amber: 'var(--mk-amber)', sun: 'var(--mk-sun)', butter: 'var(--mk-butter)',
  lilac: 'var(--mk-lilac)', bluebell: 'var(--mk-bluebell)', violet: 'var(--mk-violet)', plum: 'var(--mk-plum)',
} as const;

/** The six lumps of plasticine the whale can be made from. */
export const CLAYS = { red: INK.poppy, orange: INK.orange, yellow: INK.amber, green: INK.leaf, blue: INK.water, purple: INK.violet } as const;
export type ClayId = keyof typeof CLAYS;
export const CLAY_IDS = Object.keys(CLAYS) as ClayId[];
/** Plasticine is saturated but chalky: a little chalk in every lump. */
export const chalky = (c: string) => mix(c, 86, INK.chalk);
