/** Clay Theatre's first frame and its words, without a browser: the game
 * opens on its stage in both languages (the HUD follows the language, the
 * scene never mirrors), and every line exists in English and Hebrew. Play
 * itself is walked in the rules tests and driven in a real browser. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ lang: 'en' }));
vi.mock('../../../../../../context/LanguageContext', () => ({ useLanguage: () => ({ uiLang: h.lang }) }));
vi.mock('../../../../../../lib/native', () => ({ selectionHaptic: async () => {} }));
vi.mock('../../../../game/GameShell', () => ({ GameShell: ({ children }: { children: unknown }) => children, GameFinish: () => null }));
vi.mock('../../../../audio/kidAudio', () => ({ kidSfx: () => {}, kidAudioAllowed: () => false, kidAudioContext: () => null, onKidHush: () => () => {} }));
import ClayTheatre from './ClayTheatre';
import { CLAY_THEATRE_COPY } from './clayTheatreCopy';
import { KIT_SOURCES } from './clayKit';

const render = (lang: 'en' | 'he') => { h.lang = lang; return renderToStaticMarkup(<ClayTheatre />); };
const leaves = (node: unknown, path = ''): [string, string][] => typeof node === 'string' ? [[path, node]] : Object.entries(node as Record<string, unknown>).flatMap(([key, value]) => leaves(value, path ? `${path}.${key}` : key));

describe('Clay Theatre opens on its stage', () => {
  it('English: the opening shot, the host’s line, the three chapters', () => {
    const html = render('en'), w = CLAY_THEATRE_COPY.en;
    expect(html).toContain('data-adventure="clay-theatre"'); expect(html).toContain('data-phase="opening"'); expect(html).toContain('data-chapter="cans"');
    expect(html).toContain('data-play-stage="clay-theatre"'); expect(html).toContain('data-play-opening');
    expect(html).toContain(w.title); expect(html).toContain(w.place); expect(html).toContain(w.coach.welcome.replace('’', '’'));
    for (const label of [w.quest.shape, w.quest.animate, w.quest.direct]) expect(html).toContain(label);
    expect(html).toMatch(/<section[^>]*dir="ltr"/);
    // The stage is the section's direct child (the play kit's sizing depends on it), and no old boxed layout is left.
    expect(html).toMatch(/<section[^>]*data-adventure="clay-theatre"[^>]*><div class="play-stage/);
    expect(html).not.toMatch(/class="(adventure|ct-pick|ct-desk|ct-box)/);
  });
  it('Hebrew: the HUD reads right to left, the scene does not mirror', () => {
    const html = render('he'), w = CLAY_THEATRE_COPY.he;
    expect(html).toMatch(/<section[^>]*dir="rtl"/);
    expect(html).toMatch(/class="ct-world" dir="ltr"/);
    expect(html).toContain(w.title); expect(html).toContain(w.place); expect(html).toContain(w.coach.welcome);
    expect(html).not.toContain(CLAY_THEATRE_COPY.en.coach.welcome);
  });
  it('nothing on the first frame is a score, a timer or a list of films', () => {
    const html = render('en');
    expect(html).not.toMatch(/role="(radiogroup|listbox|progressbar|timer)"/);
    expect(html).not.toMatch(/>\s*\d+\s*\/\s*\d+\s*</);
  });
});

describe('the words', () => {
  const en = leaves(CLAY_THEATRE_COPY.en), he = leaves(CLAY_THEATRE_COPY.he);
  it('every line exists in both languages', () => { expect(he.map(([path]) => path)).toEqual(en.map(([path]) => path)); });
  it('Hebrew lines are Hebrew: no Latin letters, and no line left in English', () => {
    for (const [path, text] of he) { expect(text, path).toMatch(/[א-ת]/); expect(text.replace(/\{\d\}/g, ''), path).not.toMatch(/[A-Za-z]/); }
  });
  it('the host never says more than eight words at a time', () => {
    for (const lang of ['en', 'he'] as const) for (const [key, line] of Object.entries(CLAY_THEATRE_COPY[lang].coach)) if (key !== 'pokeLabel') expect(line.trim().split(/\s+/).length, `${lang}.${key}`).toBeLessThanOrEqual(8);
  });
  it('blanks match between the languages', () => {
    en.forEach(([path, text], i) => expect((he[i][1].match(/\{\d\}/g) ?? []).sort(), path).toEqual((text.match(/\{\d\}/g) ?? []).sort()));
  });
});

describe('the kit pictures', () => {
  it('each names the kit source it was cut from, and any that shows Bebe or GobGob says so in its name', () => {
    for (const picture of KIT_SOURCES) {
      expect(picture.from.length).toBeGreaterThan(8); expect(picture.src480).toBe(picture.src.replace('.webp', '-480.webp'));
      if (/bebe|gobgob/.test(picture.from)) expect(picture.src).toMatch(/bebe|gobgob|crew/);
    }
  });
});
