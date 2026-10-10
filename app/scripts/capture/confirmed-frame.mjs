/** Passive rendered readiness. Never finishes/cancels animations or changes app state. */
export function observeConfirmedFrame({ element = null, outgoing = null, childId = null, routeName = null, waitUntilReady = false }) {
  const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const animations = node => node.getAnimations().map(animation => {
    const timing = animation.effect?.getComputedTiming?.();
    return { playState: animation.playState, pending: animation.pending === true,
      currentTime: number(animation.currentTime), startTime: number(animation.startTime), playbackRate: number(animation.playbackRate),
      timelineCurrentTime: number(animation.timeline?.currentTime),
      effect: timing ? { delay: number(timing.delay), duration: number(timing.duration), iterations: number(timing.iterations),
        endTime: number(timing.endTime), localTime: number(timing.localTime), progress: number(timing.progress) } : null };
  });
  const domFrame = node => {
    if (!node) return null;
    const box = node.getBoundingClientRect(), style = getComputedStyle(node);
    return { connected: node.isConnected, tag: node.tagName, route: node.getAttribute('data-route'),
      childElementCount: node.childElementCount, width: box.width, height: box.height,
      opacity: Number(style.opacity), transform: style.transform, display: style.display, visibility: style.visibility,
      animations: animations(node) };
  };
  const routes = [...document.querySelectorAll('#main [data-route]')];
  const route = routeName ? routes.find(node => node.getAttribute('data-route') === routeName) : null;
  const target = element ?? [...(route?.querySelectorAll('h1, [data-module], button, p') ?? [])].find(node => {
    const box = node.getBoundingClientRect(); return box.width > 0 && box.height > 0 && !node.closest('[hidden]');
  });
  const box = target?.getBoundingClientRect();
  const ancestors = [];
  for (let node = target; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    const observedAnimations = animations(node);
    ancestors.push({ opacity: Number(style.opacity), transform: style.transform, visibility: style.visibility, display: style.display,
      runningAnimations: observedAnimations.filter(animation => animation.playState === 'running' || animation.pending).length,
      animations: observedAnimations });
  }
  const skeletons = [...document.querySelectorAll('#main .arbor-skeleton')];
  const skeletonVisible = skeletons.filter(node => { const box = node.getBoundingClientRect(); return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== 'hidden'; });
  const performanceNow = number(performance.now()), documentTimelineCurrentTime = number(document.timeline?.currentTime);
  const frame = {
    clock: { dateNow: Date.now(), performanceNow, performanceTimeOrigin: number(performance.timeOrigin), documentTimelineCurrentTime,
      performanceMinusDocumentTimelineMs: performanceNow !== null && documentTimelineCurrentTime !== null ? performanceNow - documentTimelineCurrentTime : null,
      fixture: window.__arborConfirmedDateClock?.snapshot() ?? null },
    boundarySourceContract: { owner: 'Shell', suspenseFallback: 'TabSkeleton', animatePresenceMode: 'wait', keyRule: 'route@child',
      derivedExpectedKey: routeName ? `${routeName}@${childId ?? localStorage.getItem('arbor.activeChildId')}` : null,
      evidence: 'source-contract-plus-DOM-observation-not-React-metadata' },
    outgoingFrame: domFrame(outgoing), outgoingMotionParent: domFrame(outgoing?.parentElement),
    replacementFrame: domFrame(route), replacementMotionParent: domFrame(route?.parentElement),
    tabSkeletonCandidates: { count: skeletons.length, visible: skeletonVisible.length },
    mainAlertCount: document.querySelectorAll('#main [role="alert"]').length,
    hash: location.hash, activeChildId: localStorage.getItem('arbor.activeChildId'), expectedChildId: childId, expectedRoute: routeName,
    routeCount: routes.length, actualRoutes: routes.map(node => node.getAttribute('data-route')),
    outgoingRetired: !outgoing || !outgoing.isConnected, replacementMounted: !!route && (!outgoing || route !== outgoing),
    connected: !!target?.isConnected, rendered: !!box && box.width > 0 && box.height > 0,
    width: box?.width ?? null, height: box?.height ?? null, ancestors };
  const identity = transform => ['none', 'matrix(1, 0, 0, 1, 0, 0)', 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)'].includes(transform);
  frame.ready = frame.connected && frame.rendered && ancestors.length > 0 && ancestors.every(style => style.opacity >= 0.999
    && identity(style.transform) && style.visibility !== 'hidden' && style.display !== 'none' && style.runningAnimations === 0)
    && frame.clock.fixture?.nativeTimingPreserved === true
    && (!childId || frame.activeChildId === childId)
    && (!routeName || (frame.routeCount === 1 && frame.replacementMounted && frame.outgoingRetired));
  return waitUntilReady && !frame.ready ? false : frame;
}

export async function waitConfirmedFrame(page, cell, args, label, diagnostics = () => null) {
  const trace = { label, before: await page.evaluate(observeConfirmedFrame, args), diagnosticsBefore: diagnostics() };
  if (cell) (cell.renderReadiness ??= []).push(trace);
  try {
    const settled = await page.waitForFunction(observeConfirmedFrame, { ...args, waitUntilReady: true }, { timeout: 8_000 });
    try { trace.after = await settled.jsonValue(); } finally { await settled.dispose(); }
    trace.diagnosticsAfter = diagnostics();
    return trace.after;
  } catch (error) {
    trace.diagnosticsAtFailure = diagnostics();
    trace.lastObserved = await page.evaluate(observeConfirmedFrame, args).catch(() => ({ unavailable: true }));
    throw error;
  }
}
