/** Browser predicate used by the catalogue's bounded paint wait. The root
 * argument lets the same predicate be exercised with synthetic DOM fixtures.
 * The only zero-art exception is the authored short-landscape cards spread. */
export function canonicalBookPaintReady({ expectedChoiceIds = [] } = {}, root = document) {
  const reader = root.querySelector('[data-book-reader]');
  if (!reader) return true;
  const current = reader.querySelector('.bk-turn[data-book-page]');
  if (!current) return false;
  const view = root.defaultView;
  const rect = element => element?.getBoundingClientRect();
  const inside = (a, b) => a && b && a.left >= b.left - 1 && a.top >= b.top - 1 && a.right <= b.right + 1 && a.bottom <= b.bottom + 1;
  const same = (a, b) => a && b && ['left', 'top', 'width', 'height'].every(key => Math.abs(a[key] - b[key]) <= 1);
  const painted = (element, opacity = 1) => {
    if (!element) return false;
    const style = view.getComputedStyle(element), box = rect(element);
    return style.visibility === 'visible' && Number(style.opacity) === opacity && box.width > 0 && box.height > 0;
  };
  const decoded = img => img?.tagName === 'IMG' && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
  const base = current.querySelector('[data-book-plate] > img');
  const images = [...current.querySelectorAll('[data-book-plate] > img, [data-book-state-plate] > img')];
  if (!decoded(base) || !images.every(decoded)) return false;
  const art = current.querySelector('[data-book-art]');
  const text = current.querySelector('[data-book-text]');
  const stage = rect(reader.querySelector('.bk-stage'));
  const artBox = rect(art), paper = rect(text), book = rect(current.querySelector('.bk-book'));
  const group = text?.querySelector('.bk-choices[data-plan="second"]');
  // Matches isSidewaysPhone + sidewaysCards in bookPageLayout.ts. Neither
  // an arbitrary zero rectangle nor a missing picture enables this branch.
  const fullChoice = reader.getAttribute('data-mode') === 'wide'
    && reader.getAttribute('data-page-type') === 'facing'
    && stage && stage.width >= 560 && stage.width < 900 && stage.width >= stage.height * 1.25
    && text?.hasAttribute('data-choosing') && group
    && artBox?.width === 0 && artBox?.height === 0 && same(paper, book)
    && expectedChoiceIds.length === 3 && new Set(expectedChoiceIds).size === 3;
  const surfaces = [current, ...current.querySelectorAll('.bk-art, .bk-text, .bk-cover-title, .bk-state-plate')];
  if (!surfaces.filter(element => !fullChoice || element !== art).every(element => painted(element))) return false;
  if (!fullChoice) return images.every(img => painted(img));

  if (current.querySelector('[data-book-state-plate]') || !painted(group)) return false;
  const cards = [...group.querySelectorAll('[data-choice-card]')];
  if (cards.length !== 3 || cards.some((card, index) => card.getAttribute('data-choice-card') !== expectedChoiceIds[index])) return false;
  const positions = new Set();
  for (const card of cards) {
    const box = rect(card), picture = card.querySelector('.bk-card-pic'), label = card.querySelector('.bk-card-label');
    if (!painted(card, card.hasAttribute('data-dimmed') ? .6 : 1) || box.width < 44 || box.height < 44 || !inside(box, paper)) return false;
    if (!painted(picture) || !inside(rect(picture), box) || !painted(label) || !label.textContent.trim()) return false;
    const range = root.createRange(); range.selectNodeContents(label);
    const lines = [...range.getClientRects()].filter(line => line.width && line.height);
    if (!lines.length || !lines.every(line => inside(line, box) && inside(line, paper))) return false;
    // These authored cards use three distinct focus crops of the SAME
    // already decoded PL4 resource, rather than separate <img> elements.
    // Verify that actual CSS image source, not merely a colored card box.
    const style = view.getComputedStyle(picture);
    const urls = [...style.backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(match => match[1]);
    if (!urls.includes(base.currentSrc || base.src) || !style.backgroundPosition || !style.backgroundSize) return false;
    positions.add(style.backgroundPosition);
  }
  if (positions.size !== 3) return false;
  const back = current.querySelector('[data-book-back]'), go = current.querySelector('[data-book-go]');
  return [back, go].every(button => painted(button, button?.disabled ? .45 : 1)
    && rect(button).width >= 44 && rect(button).height >= 44 && inside(rect(button), paper));
}
