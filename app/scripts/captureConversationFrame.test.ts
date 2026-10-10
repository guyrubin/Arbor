import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { scrollConversationTranscript, observeConversationFrame, conversationAncestorsUnchanged, checkConversationFrame } from './capture/conversation-frame.mjs';

const rect = (left: number, top: number, width: number, height: number) => ({ left, top, right: left + width, bottom: top + height, width, height });
function fixture() {
  const view: any = { innerWidth: 375, innerHeight: 812, scrollX: 0, scrollY: 0, getComputedStyle: () => ({ overflowY: 'auto', visibility: 'visible', display: 'block', opacity: '1' }) };
  const doc: any = { defaultView: view };
  const node = (box: any, parentElement: any = null): any => ({ ownerDocument: doc, parentElement, scrollTop: 0, scrollLeft: 0, getBoundingClientRect: () => box, contains(hit: any) { for (let n = hit; n; n = n.parentElement) if (n === this) return true; return false; } });
  const root = node(rect(0, 0, 375, 812));
  const panel = node(rect(0, 0, 375, 812), root);
  const header = node(rect(0, 0, 375, 76), panel);
  const title = node(rect(64, 14, 150, 28), header);
  const close = node(rect(304, 12, 54, 52), header);
  const body = node(rect(0, 76, 375, 736), panel);
  const pane = Object.assign(node(rect(0, 76, 375, 504), body), { clientTop: 0, clientHeight: 504, scrollHeight: 4000, scrollTop: 500 });
  pane.scrollTo = vi.fn(({ top }) => { pane.scrollTop = top; });
  const target = node(rect(17, 1500, 341, 60), pane);
  target.closest = vi.fn(() => pane);
  target.scrollIntoView = vi.fn(() => { pane.scrollTop = 1900; panel.scrollTop = 76; });
  panel.querySelector = (selector: string) => ({ '[data-companion-scroll="true"]': pane, '.companion-conversation-heading': header, '#companion-conversation-title': title, '.companion-conversation-heading > button:last-child': close })[selector];
  doc.elementFromPoint = vi.fn((x, y) => [close, title, header, body, panel].find(el => { const b = el.getBoundingClientRect(); return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom; }));
  return { view, doc, panel, header, title, close, root, body, pane, target };
}

describe('capture transcript scrolling and preserved panel chrome, no browser', () => {
  it('scrolls only the nearest real transcript, even under overflow-hidden ancestors', () => {
    const f = fixture(); const before = observeConversationFrame(f.panel);
    scrollConversationTranscript(f.target);
    expect(f.pane.scrollTo).toHaveBeenCalledWith({ top: 1912, behavior: 'instant' });
    expect(f.target.scrollIntoView).not.toHaveBeenCalled();
    expect(conversationAncestorsUnchanged(before, observeConversationFrame(f.panel))).toBe(true);
  });

  it('clamps transcript scrolling at both ends and never falls back to ancestor scrolling', () => {
    for (const [top, expected] of [[-1000, 0], [9000, 3496]]) {
      const f = fixture(); f.target.getBoundingClientRect = () => rect(17, top, 341, 60);
      scrollConversationTranscript(f.target);
      expect(f.pane.scrollTo).toHaveBeenCalledWith({ top: expected, behavior: 'instant' });
    }
    const f = fixture(); f.target.closest.mockReturnValue(null);
    expect(() => scrollConversationTranscript(f.target)).toThrow('CONVERSATION_TRANSCRIPT_REQUIRED');
    expect(f.target.scrollIntoView).not.toHaveBeenCalled();
    const wrong = fixture(); wrong.view.getComputedStyle = () => ({ overflowY: 'hidden' });
    expect(() => scrollConversationTranscript(wrong.target)).toThrow('CONVERSATION_TRANSCRIPT_REQUIRED');
  });

  it('rejects the exact native-scroll regression even though the panel itself remains in viewport', () => {
    const f = fixture(); const before = observeConversationFrame(f.panel);
    f.target.scrollIntoView();
    f.header.getBoundingClientRect = () => rect(0, -76, 375, 76);
    f.title.getBoundingClientRect = () => rect(64, -62, 150, 28);
    f.close.getBoundingClientRect = () => rect(304, -64, 54, 52);
    const after = observeConversationFrame(f.panel);
    expect(after.panel.fullyWithinViewport).toBe(true);
    for (const part of ['header', 'title', 'close']) expect(after[part].fullyWithinViewport).toBe(false);
    expect(conversationAncestorsUnchanged(before, after)).toBe(false);
  });

  it('requires every piece of chrome wholly visible and hit-testable at center and edges', () => {
    const f = fixture(); const good = observeConversationFrame(f.panel);
    for (const part of ['panel', 'header', 'title', 'close']) expect(good[part]).toMatchObject({ fullyWithinViewport: true, unoccluded: true, probeCount: 5 });
    for (const part of ['panel', 'header', 'title', 'close']) for (const box of [rect(0, -1, 100, 40), rect(350, 0, 100, 40), rect(0, 800, 100, 40), rect(0, 0, 0, 40), rect(0, NaN, 100, 40)]) {
      const bad = fixture(); bad[part].getBoundingClientRect = () => box;
      expect(observeConversationFrame(bad.panel)[part].fullyWithinViewport).toBe(false);
    }
    for (const index of [0, 4, 5, 9, 10, 14, 15, 19]) {
      const occluded = fixture(); const real = occluded.doc.elementFromPoint; let calls = 0;
      occluded.doc.elementFromPoint = (x, y) => calls++ === index ? {} : real(x, y);
      const result = observeConversationFrame(occluded.panel);
      expect(result[['panel', 'header', 'title', 'close'][Math.floor(index / 5)]].unoccluded).toBe(false);
    }
  });

  it('detects any ancestor or window scroll and rejects incomplete observations', () => {
    const f = fixture(); const baseline = observeConversationFrame(f.panel);
    f.pane.scrollTop += 300;
    expect(conversationAncestorsUnchanged(baseline, observeConversationFrame(f.panel))).toBe(true);
    for (const ancestor of [f.body, f.panel, f.root]) for (const axis of ['scrollTop', 'scrollLeft']) {
      ancestor[axis] = 1; expect(conversationAncestorsUnchanged(baseline, observeConversationFrame(f.panel))).toBe(false); ancestor[axis] = 0;
    }
    f.view.scrollY = 1; expect(conversationAncestorsUnchanged(baseline, observeConversationFrame(f.panel))).toBe(false);
    for (const bad of [null, {}, { ...baseline, transcriptFound: false }, { ...baseline, offsets: { ancestors: [], window: { x: 0, y: 0 } } }]) expect(conversationAncestorsUnchanged(baseline, bad)).toBe(false);
  });

  it('records absent chrome without starting another locator wait', async () => {
    const panel = { count: async () => 0, evaluate: vi.fn() };
    const cell: any = {};
    const check = vi.fn((_cell, _id, passed) => expect(passed).toBe(false));
    await checkConversationFrame(panel, cell, { check, baseline: null, phase: 'AFTER_INTERACTION' });
    expect(panel.evaluate).not.toHaveBeenCalled();
    expect(check).toHaveBeenCalledTimes(9);
  });

  it('retains failed pre-capture app behavior rather than repairing ancestor offsets', async () => {
    const f = fixture(); const baseline = observeConversationFrame(f.panel); f.panel.scrollTop = 76;
    const cell: any = { failures: [] };
    const check = (_cell, id, passed) => { if (!passed) cell.failures.push(id); };
    await checkConversationFrame({ count: async () => 1, evaluate: async read => read(f.panel) }, cell, { check, baseline, phase: 'AFTER_RESPONSE' });
    expect(cell.failures).toContain('CONVERSATION_AFTER_RESPONSE_ANCESTORS_STILL');
    expect(f.panel.scrollTop).toBe(76);
    expect(cell.conversationFrames[0].offsets.ancestors[1].scrollTop).toBe(76);
    const source = readFileSync(new URL('./capture/conversation-frame.mjs', import.meta.url), 'utf8');
    expect(source).not.toMatch(/(?:panel|ancestor|view|window)\.(?:scrollTo|scrollTop\s*=|scrollLeft\s*=)/);
  });
});
