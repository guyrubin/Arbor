/** Read-only readiness for Shell's child-keyed wait-mode route transition. */
export function observeRecordChildFrame({ outgoing, childId, waitUntilReady = false }) {
  const main = document.querySelector('#main');
  const routes = [...document.querySelectorAll('#main [data-route="development"]')];
  const route = routes[0];
  const heading = route?.querySelector('h1');
  const box = heading?.getBoundingClientRect();
  const clip = main?.getBoundingClientRect();
  const bounds = value => value ? { top: value.top, bottom: value.bottom, width: value.width, height: value.height } : null;
  const ancestors = [];
  for (let node = route; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    ancestors.push({ opacity: Number(style.opacity), transform: style.transform, visibility: style.visibility, display: style.display });
  }
  const frame = {
    expectedChildId: childId, activeChildId: localStorage.getItem('arbor.activeChildId'),
    outgoingRetired: !!outgoing && !outgoing.isConnected, replacementMounted: !!route && route !== outgoing,
    routeCount: routes.length, ancestors, mainScrollTop: main?.scrollTop ?? null,
    headingRendered: !!box && box.width > 0 && box.height > 0,
    headingBounds: bounds(box), mainBounds: bounds(clip),
    headingWithinMain: !!box && !!clip && box.top >= clip.top && box.bottom <= clip.bottom,
  };
  frame.ready = frame.activeChildId === childId && frame.outgoingRetired && frame.replacementMounted && frame.routeCount === 1
    && frame.headingRendered && frame.ancestors.length > 0 && frame.ancestors.every(style => style.opacity >= 0.999
      && ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(style.transform) && style.visibility !== 'hidden' && style.display !== 'none');
  return waitUntilReady && !frame.ready ? false : frame;
}

/** Real search navigation: Shell's hash changes before its wait-mode body does.
 * Read actual destination content and its full ancestor chain, including any
 * nested entrance animation. No scrolling, retry, replacement navigation or
 * app state mutation is used to make this observation pass. */
export function observeRecordDestinationFrame({ outgoing, childId, routeName, contentSelector, waitUntilReady = false }) {
  const routes = [...document.querySelectorAll('#main [data-route]')];
  const route = routes.find(node => node.getAttribute('data-route') === routeName);
  const contents = route ? [...route.querySelectorAll(contentSelector)] : [];
  const content = contents[0];
  const box = content?.getBoundingClientRect();
  const clip = document.querySelector('#main')?.getBoundingClientRect();
  const bounds = value => value ? { top: value.top, bottom: value.bottom, left: value.left, right: value.right, width: value.width, height: value.height } : null;
  const ancestors = [];
  for (let node = content; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    ancestors.push({ opacity: Number(style.opacity), transform: style.transform, visibility: style.visibility, display: style.display });
  }
  const frame = {
    expectedRoute: routeName, hash: location.hash, expectedChildId: childId, activeChildId: localStorage.getItem('arbor.activeChildId'),
    outgoingRetired: !!outgoing && !outgoing.isConnected, replacementMounted: !!route && route !== outgoing,
    routeCount: routes.length, contentSelector, contentCount: contents.length, contentText: content?.textContent?.trim() ?? '',
    contentBounds: bounds(box), mainBounds: bounds(clip), mainScrollTop: document.querySelector('#main')?.scrollTop ?? null, ancestors,
    contentRendered: !!box && box.width > 0 && box.height > 0,
    contentIntersectsMain: !!box && !!clip && box.bottom > Math.max(0, clip.top) && box.top < Math.min(innerHeight, clip.bottom)
      && box.right > Math.max(0, clip.left) && box.left < Math.min(innerWidth, clip.right),
  };
  frame.ready = frame.hash === `#/${routeName}` && frame.activeChildId === childId && frame.outgoingRetired && frame.replacementMounted
    && frame.routeCount === 1 && frame.contentCount === 1 && frame.contentRendered && frame.contentIntersectsMain && frame.contentText.length > 0
    && frame.ancestors.length > 0 && frame.ancestors.every(style => style.opacity >= 0.999
      && ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(style.transform) && style.visibility !== 'hidden' && style.display !== 'none');
  return waitUntilReady && !frame.ready ? false : frame;
}
