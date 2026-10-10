/** Read-only browser probe. Wait-mode route exits can briefly expose the
 * launcher while Now is absent or transparent. Never navigate or repair it. */
export function observeReportCloseDestination(waitUntilReady = false) {
  const main = document.querySelector('#main');
  const route = main?.querySelector('[data-route="overview"]');
  const page = route?.querySelector('.now-page');
  const heading = page?.querySelector('.now-heading h1');
  const lead = page?.querySelector('.now-main-column > [data-module]');
  const measure = el => {
    if (!main || !el) return { visible: false, settled: false, unoccluded: false };
    const b = el.getBoundingClientRect(), clip = main.getBoundingClientRect();
    const left = Math.max(0, b.left, clip.left), right = Math.min(innerWidth, b.right, clip.right);
    const top = Math.max(0, b.top, clip.top), bottom = Math.min(innerHeight, b.bottom, clip.bottom);
    let settled = true;
    for (let node = el; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.999) settled = false;
    }
    const visible = [left, right, top, bottom].every(Number.isFinite) && right > left && bottom > top;
    const hit = visible ? document.elementFromPoint((left + right) / 2, (top + bottom) / 2) : null;
    return { visible, settled, unoccluded: !!hit && (el === hit || el.contains(hit)) };
  };
  const frame = {
    routeIsNow: location.hash === '#/overview', routeMounted: !!route, nowMounted: !!page,
    heading: measure(heading), lead: measure(lead), mainScrollTop: main?.scrollTop ?? null,
    panelClosed: !document.querySelector('.companion-conversation:not([hidden])'),
    focusOnLauncher: document.activeElement?.matches('.companion-launch-main') === true,
  };
  frame.ready = frame.routeIsNow && frame.routeMounted && frame.nowMounted && frame.panelClosed
    && [frame.heading, frame.lead].every(part => part.visible && part.settled && part.unoccluded);
  return waitUntilReady && !frame.ready ? false : frame;
}

export async function waitForReportCloseDestination(page, cell, { check }) {
  const handle = await page.waitForFunction(observeReportCloseDestination, true, { timeout: 10000 });
  try { cell.closeDestination = await handle.jsonValue(); }
  finally { await handle.dispose(); }
  const frame = cell.closeDestination;
  check(cell, 'REPORT_CLOSE_NOW_DESTINATION_SETTLED', frame.ready === true);
  check(cell, 'REPORT_CLOSE_NOW_HEADING_VISIBLE', frame.heading.visible && frame.heading.settled && frame.heading.unoccluded);
  check(cell, 'REPORT_CLOSE_NOW_LEAD_VISIBLE', frame.lead.visible && frame.lead.settled && frame.lead.unoccluded);
  check(cell, 'REPORT_CLOSE_NOW_SCROLL_RESET', frame.mainScrollTop === 0);
  check(cell, 'REPORT_CLOSE_SETTLED_FOCUS_REMAINS_ON_LAUNCHER', frame.focusOnLauncher === true);
}
