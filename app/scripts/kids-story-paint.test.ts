import { describe, expect, it } from 'vitest';
import { canonicalBookPaintReady } from './kids-story-paint.mjs';

const SOURCE = 'http://fixture/visuals/books/five-smooth-stones/PL4.webp';
const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height });
class Element {
  tagName = 'DIV'; textContent = 'A visible label'; disabled = false;
  complete = true; naturalWidth = 2528; naturalHeight = 1696; currentSrc = SOURCE; src = SOURCE;
  style = { opacity: '1', visibility: 'visible', backgroundImage: 'none', backgroundPosition: '0px 0px', backgroundSize: 'auto' };
  attrs: Record<string, string> = {};
  single: Record<string, Element | null> = {};
  many: Record<string, Element[]> = {};
  constructor(public bounds = box(0, 0, 100, 100)) {}
  getBoundingClientRect() { return this.bounds; }
  getAttribute(key: string) { return this.attrs[key] ?? null; }
  hasAttribute(key: string) { return Object.hasOwn(this.attrs, key); }
  querySelector(key: string) { return this.single[key] ?? null; }
  querySelectorAll(key: string) { return this.many[key] ?? []; }
}
function fixture(choice = false) {
  const reader = new Element(box(0, 0, 844, 390)), stage = new Element(box(0, 56, 844, 334));
  const current = new Element(stage.bounds), book = new Element(box(18, 77, 809, 293));
  const art = new Element(choice ? box(18, 77, 0, 0) : box(26, 85, 414, 276));
  const text = new Element(choice ? book.bounds : box(448, 77, 379, 293));
  const base = new Element(art.bounds); base.tagName = 'IMG';
  const group = new Element(box(171, 89, 502, 172));
  reader.attrs = { 'data-mode': 'wide', 'data-page-type': 'facing' };
  reader.single = { '.bk-turn[data-book-page]': current, '.bk-stage': stage };
  current.single = { '[data-book-plate] > img': base, '[data-book-art]': art, '[data-book-text]': text, '.bk-book': book };
  current.many = {
    '[data-book-plate] > img, [data-book-state-plate] > img': [base],
    '.bk-art, .bk-text, .bk-cover-title, .bk-state-plate': [art, text],
  };
  const cards = ['a', 'b', 'c'].map((id, index) => {
    const x = 171 + index * 171, card = new Element(box(x, 89, 160, 172));
    card.attrs = { 'data-choice-card': id };
    const picture = new Element(box(x + 4, 93, 152, 116));
    picture.style = { ...picture.style, backgroundImage: `url("${SOURCE}")`, backgroundPosition: `${-index * 150}px 0px`, backgroundSize: '900px 600px' };
    card.single = { '.bk-card-pic': picture, '.bk-card-label': new Element(box(x + 8, 215, 144, 40)) };
    return card;
  });
  if (choice) { text.attrs['data-choosing'] = ''; text.single['.bk-choices[data-plan="second"]'] = group; }
  group.many['[data-choice-card]'] = cards;
  const back = new Element(box(30, 301, 64, 64)), go = new Element(box(590, 281, 225, 80));
  go.disabled = true; go.style.opacity = '.45';
  current.single['[data-book-back]'] = back; current.single['[data-book-go]'] = go;
  const root = {
    querySelector: (key: string) => key === '[data-book-reader]' ? reader : null,
    defaultView: { getComputedStyle: (element: Element) => element.style },
    createRange: () => { let selected: Element; return { selectNodeContents: (element: Element) => { selected = element; }, getClientRects: () => [selected.bounds] }; },
  };
  const ready = () => canonicalBookPaintReady({ expectedChoiceIds: ['a', 'b', 'c'] }, root as unknown as Document);
  return { ready, reader, stage, current, book, art, text, base, group, cards, back, go };
}

describe('actual canonical book paint predicate', () => {
  it('accepts an opaque decoded ordinary page and the actual full-choice spread', () => {
    expect(fixture().ready()).toBe(true);
    expect(fixture(true).ready()).toBe(true);
  });
  it('never accepts a blank or transparent ordinary base, art, text or turn', () => {
    for (const key of ['base', 'art', 'text', 'current'] as const) {
      const f = fixture(); f[key].style.opacity = '0'; expect(f.ready(), key).toBe(false);
    }
    const absent = fixture(); absent.current.single['[data-book-plate] > img'] = null; expect(absent.ready()).toBe(false);
    const empty = fixture(); empty.art.bounds = box(18, 77, 0, 0); empty.base.bounds = empty.art.bounds; expect(empty.ready()).toBe(false);
  });
  it('does not turn any zero rectangle into a choice exception', () => {
    for (const change of [
      (f: ReturnType<typeof fixture>) => { delete f.text.attrs['data-choosing']; },
      (f: ReturnType<typeof fixture>) => { f.reader.attrs['data-mode'] = 'stacked'; },
      (f: ReturnType<typeof fixture>) => { f.stage.bounds = box(0, 56, 900, 334); },
      (f: ReturnType<typeof fixture>) => { f.stage.bounds = box(0, 56, 559, 334); },
      (f: ReturnType<typeof fixture>) => { f.stage.bounds = box(0, 56, 667, 700); },
      (f: ReturnType<typeof fixture>) => { f.text.bounds = box(448, 77, 379, 293); },
    ]) { const f = fixture(true); change(f); expect(f.ready()).toBe(false); }
  });
  it('requires three ordered distinct authored cards with decoded correct crops', () => {
    for (const change of [
      (f: ReturnType<typeof fixture>) => { f.group.many['[data-choice-card]'] = f.cards.slice(0, 2); },
      (f: ReturnType<typeof fixture>) => { f.cards[1].attrs['data-choice-card'] = 'a'; },
      (f: ReturnType<typeof fixture>) => { f.base.complete = false; },
      (f: ReturnType<typeof fixture>) => { f.base.naturalWidth = 0; },
      (f: ReturnType<typeof fixture>) => { f.cards[1].single['.bk-card-pic']!.style.backgroundImage = 'none'; },
      (f: ReturnType<typeof fixture>) => { f.cards[1].single['.bk-card-pic']!.style.backgroundImage = 'url("http://fixture/wrong.webp")'; },
      (f: ReturnType<typeof fixture>) => { f.cards[1].single['.bk-card-pic']!.style.backgroundPosition = '0px 0px'; },
      (f: ReturnType<typeof fixture>) => { f.cards[1].single['.bk-card-pic']!.style.visibility = 'hidden'; },
      (f: ReturnType<typeof fixture>) => { f.cards[1].single['.bk-card-pic']!.style.opacity = '0'; },
      (f: ReturnType<typeof fixture>) => { f.cards[1].single['.bk-card-label']!.textContent = ''; },
      (f: ReturnType<typeof fixture>) => { f.cards[1].single['.bk-card-label']!.bounds = box(342, 500, 144, 40); },
      (f: ReturnType<typeof fixture>) => { f.go.bounds = box(590, 500, 225, 80); },
    ]) { const f = fixture(true); change(f); expect(f.ready()).toBe(false); }
  });
  it('retains the mandatory decoded and painted art-state plate guard', () => {
    const f = fixture(), state = new Element(box(26, 85, 414, 276)); state.tagName = 'IMG';
    f.current.many['[data-book-plate] > img, [data-book-state-plate] > img'].push(state);
    state.complete = false; expect(f.ready()).toBe(false);
    state.complete = true; state.style.opacity = '0'; expect(f.ready()).toBe(false);
    state.style.opacity = '1'; expect(f.ready()).toBe(true);
  });
});
