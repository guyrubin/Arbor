/** Capture-only scrolling. Never ask the browser to scroll every ancestor of an
 * answer: overflow:hidden panels are programmatically scrollable too. */
export function scrollConversationTranscript(el) {
  const pane = el.closest('[data-companion-scroll="true"]');
  const view = el.ownerDocument.defaultView;
  if (!pane || !view || !/^(auto|scroll)$/.test(view.getComputedStyle(pane).overflowY)) throw new Error('CONVERSATION_TRANSCRIPT_REQUIRED');
  const top = el.getBoundingClientRect().top - pane.getBoundingClientRect().top - pane.clientTop + pane.scrollTop - 12;
  const max = Math.max(0, pane.scrollHeight - pane.clientHeight);
  if (![top, max].every(Number.isFinite)) throw new Error('CONVERSATION_TRANSCRIPT_GEOMETRY_INVALID');
  pane.scrollTo({ top: Math.max(0, Math.min(max, top)), behavior: 'instant' });
}

/** Browser-serializable observer. Only bounded geometry/offsets and booleans
 * leave the page; neither transcript text nor child identity is collected. */
export function observeConversationFrame(panel) {
  const doc = panel.ownerDocument;
  const view = doc.defaultView;
  const measure = el => {
    if (!el || !view) return { found: false, fullyWithinViewport: false, unoccluded: false, probeCount: 0 };
    const b = el.getBoundingClientRect();
    const rect = { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height };
    const style = view.getComputedStyle(el);
    const fullyWithinViewport = Object.values(rect).every(Number.isFinite) && rect.width > 0 && rect.height > 0
      && rect.left >= 0 && rect.top >= 0 && rect.right <= view.innerWidth && rect.bottom <= view.innerHeight
      && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) !== 0;
    const x = Math.min(8, rect.width / 4), y = Math.min(8, rect.height / 4);
    const probes = fullyWithinViewport ? [
      [rect.left + rect.width / 2, rect.top + rect.height / 2],
      [rect.left + x, rect.top + y], [rect.right - x, rect.top + y],
      [rect.left + x, rect.bottom - y], [rect.right - x, rect.bottom - y],
    ] : [];
    const hits = probes.map(([x, y]) => { const hit = doc.elementFromPoint(x, y); return !!hit && (el === hit || el.contains(hit)); });
    return { found: true, rect, fullyWithinViewport, unoccluded: hits.length === 5 && hits.every(Boolean), probeCount: probes.length };
  };
  const transcript = panel.querySelector('[data-companion-scroll="true"]');
  const ancestors = [];
  for (let el = transcript?.parentElement; el; el = el.parentElement) ancestors.push({ depth: ancestors.length, scrollTop: el.scrollTop, scrollLeft: el.scrollLeft });
  const offsets = { ancestors, window: view ? { x: view.scrollX, y: view.scrollY } : null };
  return {
    panel: measure(panel), header: measure(panel.querySelector('.companion-conversation-heading')),
    title: measure(panel.querySelector('#companion-conversation-title')),
    close: measure(panel.querySelector('.companion-conversation-heading > button:last-child')),
    transcriptFound: !!transcript, offsets,
  };
}

export function conversationAncestorsUnchanged(before, after) {
  const valid = frame => frame?.transcriptFound === true && frame.offsets?.ancestors?.length > 0
    && frame.offsets.ancestors.every((item, index) => item.depth === index && [item.scrollTop, item.scrollLeft].every(Number.isFinite))
    && [frame.offsets.window?.x, frame.offsets.window?.y].every(Number.isFinite);
  if (!valid(before) || !valid(after) || before.offsets.ancestors.length !== after.offsets.ancestors.length) return false;
  return before.offsets.window.x === after.offsets.window.x && before.offsets.window.y === after.offsets.window.y
    && before.offsets.ancestors.every((item, index) => item.scrollTop === after.offsets.ancestors[index].scrollTop && item.scrollLeft === after.offsets.ancestors[index].scrollLeft);
}

/** Observe before capture scrolling and after every interaction. A failed app
 * auto-scroll remains evidence even when the transcript is later repositioned. */
export async function checkConversationFrame(panel, cell, { check, baseline, phase }) {
  const missing = { found: false, fullyWithinViewport: false, unoccluded: false, probeCount: 0 };
  // Missing panels fail immediately instead of adding a fresh locator wait to
  // each dependent failure. Existing capture deadlines are unchanged.
  const frame = await panel.count() === 1 ? await panel.evaluate(observeConversationFrame)
    : { panel: missing, header: missing, title: missing, close: missing, transcriptFound: false, offsets: { ancestors: [], window: null } };
  (cell.conversationFrames ??= []).push({ phase, ...frame });
  for (const part of ['panel', 'header', 'title', 'close']) {
    check(cell, `CONVERSATION_${phase}_${part.toUpperCase()}_IN_VIEWPORT`, frame[part].fullyWithinViewport === true);
    check(cell, `CONVERSATION_${phase}_${part.toUpperCase()}_NOT_OCCLUDED`, frame[part].unoccluded === true);
  }
  check(cell, `CONVERSATION_${phase}_ANCESTORS_STILL`, conversationAncestorsUnchanged(baseline ?? frame, frame));
  return frame;
}
