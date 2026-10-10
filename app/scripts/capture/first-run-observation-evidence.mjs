/** Pure record comparison and browser DOM observations; never installs runtime hooks. */
export function firstRunObservationRecordMatches(rows, accepted, words) {
  if (!Array.isArray(rows) || rows.length !== 1 || !accepted?.id || !accepted.observation || accepted.status !== 'accepted') return false;
  const row = rows[0];
  if (row.status !== 'completed' || row.whatHappened !== words || !words?.trim() || words.length > 240
    || typeof row.completedAt !== 'string' || !Number.isFinite(Date.parse(row.completedAt))) return false;
  const expected = { ...accepted, status: 'completed', whatHappened: words, completedAt: row.completedAt };
  return !Object.hasOwn(row, 'outcome') && !Object.hasOwn(row, 'outcomeAt')
    && Object.keys(row).length === Object.keys(expected).length
    && Object.keys(expected).every(key => JSON.stringify(row[key]) === JSON.stringify(expected[key]));
}

/** Serializable read-only function for page.evaluate. Require painted, unclipped
 * content and a hit-tested control. Sticky docks, overflow ancestors and inert
 * or transparent background layers cannot count as visible evidence. */
export function observeFirstRunElement({ selector, waitUntilReady = false }) {
  const el = document.querySelector(selector);
  if (!el) return waitUntilReady ? false : { visible: false, reachable: false, text: '' };
  const b = el.getBoundingClientRect();
  let visible = el.isConnected && b.width > 0 && b.height > 0 && b.left >= 0 && b.top >= 0 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
  for (let node = el; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (node.hidden || node.inert || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.99) visible = false;
    if (node !== el) {
      const clip = node.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX) && (b.left < clip.left - 1 || b.right > clip.right + 1)) visible = false;
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY) && (b.top < clip.top - 1 || b.bottom > clip.bottom + 1)) visible = false;
    }
  }
  if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) visible = false;
  const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
  const reachable = visible && !!hit && (hit === el || el.contains(hit));
  const text = el.textContent?.trim() ?? '';
  const frame = { visible, reachable, text, rawText: el.textContent ?? '', whiteSpace: getComputedStyle(el).whiteSpace, focused: document.activeElement === el,
    pressed: el.getAttribute('aria-pressed'), glyph: el.querySelector('[data-selection-check] .msr')?.textContent?.trim() ?? '',
    checkVisible: !!el.querySelector('[data-selection-check]') && [...el.querySelectorAll('[data-selection-check]')].every(mark => {
      const r = mark.getBoundingClientRect();
      const style = getComputedStyle(mark);
      return r.width > 0 && r.height > 0 && r.left >= b.left && r.right <= b.right && r.top >= b.top && r.bottom <= b.bottom
        && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) >= 0.99;
    }) };
  return waitUntilReady ? frame.visible && frame.reachable : frame;
}
