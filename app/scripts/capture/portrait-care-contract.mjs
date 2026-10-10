/** Bounded current-route evidence only. Importing launches no app or browser. */
export const PORTRAIT_CARE_STATES = Object.freeze([
  { route: 'development', state: 'portrait-care-cta' },
  { route: 'care-team', state: 'care-arrival' },
  { route: 'care-team', state: 'care-primary' },
  { route: 'development', state: 'care-back-portrait' },
  { route: 'sharing', state: 'sharing-direct-control' },
]);
export const PORTRAIT_CARE_LIMITATIONS = Object.freeze([
  'Twenty cells only: five states in mobile/desktop EN/HE; no replacement for the accepted full release matrix.',
  'Actual current portrait care CTA targets care-team. Direct sharing is a separately labeled control, never substitute destination proof.',
  'Existing invented family, mock/local APIs, source fonts, native animation clocks. No share is granted, recipient entered, email sent or care provider contacted.',
  'The real secondary-place-back control returns to My child. Browser-history Back is not covered. Shell does not implement route-opener focus restoration; record actual focus without moving it.',
  'Parent shell automatic narration for exactly the current invented child receives a labeled local 409 refusal. It never reaches a provider or records successful generation; other mutations remain denied.',
  'Eight-second passive settlement deadline; no style/state repair, forced click, route rewrite or animation completion. Failed pixels and sanitized diagnostics remain failures.',
]);
export function portraitCareApiDisposition(method, pathname, childId) {
  if (method === 'POST' && typeof childId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(childId)
    && pathname === `/api/children/${encodeURIComponent(childId)}/book-narration`) return 'synthetic-narration-refusal';
  return method === 'GET' || (method === 'POST' && ['/api/todays-focus', '/api/digest'].includes(pathname)) ? 'read' : 'deny';
}

/** No text, form values, app props, raw errors or data payloads leave this probe. */
export function observePortraitCareSurface({ routeName, childId }) {
  const main = document.querySelector('#main');
  const routes = [...document.querySelectorAll('#main [data-route]')];
  const route = routes.find(node => node.getAttribute('data-route') === routeName);
  const count = selector => route?.querySelectorAll(selector).length ?? 0;
  const heading = route?.querySelector('h1');
  const box = heading?.getBoundingClientRect();
  const clip = main?.getBoundingClientRect();
  const primary = route?.querySelector('[data-testid="share-week-confirm"]');
  const active = document.activeElement;
  const focus = !active ? 'missing' : active === document.body ? 'document-body'
    : active.matches('.portrait-care button') ? 'portrait-care-cta'
    : route?.contains(active) ? 'current-route' : main === active ? 'main' : 'shell-or-other';
  const result = {
    expectedRoute: routeName, hash: location.hash, routeCount: routes.length,
    activeChildId: localStorage.getItem('arbor.activeChildId'), expectedChildId: childId,
    portraitCount: count('[data-testid="child-portrait"]'), careCtaCount: count('.portrait-care button'),
    grantModuleCount: count('[data-module="sharing-grant"]'), weekCardCount: count('[data-testid="share-week-card"]'),
    primaryCount: count('[data-testid="share-week-confirm"]'), primaryMove: primary?.getAttribute('data-primary-move') ?? null,
    headingCount: count('h1'), headingHasText: !!heading?.textContent?.trim(),
    headingBounds: box ? { width: box.width, height: box.height, top: box.top, bottom: box.bottom } : null,
    headingInMain: !!box && !!clip && box.width > 0 && box.height > 0 && box.top >= clip.top && box.bottom <= clip.bottom,
    mainScrollTop: main?.scrollTop ?? null,
    direction: document.documentElement.dir,
    focus: { location: focus, connected: active?.isConnected === true, insideInertOrHidden: !!active?.closest('[inert], [hidden], [aria-hidden="true"]') },
  };
  result.identityReady = result.hash === `#/${routeName}` && result.routeCount === 1 && result.activeChildId === childId
    && result.headingCount === 1 && result.headingHasText && !!box && box.width > 0 && box.height > 0
    && (routeName === 'development' ? result.portraitCount === 1 && result.careCtaCount === 1
      : ['care-team', 'sharing'].includes(routeName) && result.portraitCount === 0 && result.grantModuleCount === 1 && result.weekCardCount === 1
        && result.primaryCount === 1 && result.primaryMove === (routeName === 'care-team' ? 'open-care-roster' : 'grant-share'));
  return result;
}
export function validPortraitCareClick(click, control, from) {
  return click?.sampledAt === 'captured-click' && click.trusted === true && click.control === control
    && click.hash === `#/${from}` && click.insideMain === true && click.targetConnected === true;
}
const common = ['SCREENSHOT_CURRENT_ROUTE_UNCHANGED', 'CURRENT_ROUTE_IDENTITY', 'SETTLED_CURRENT_BODY', 'SOURCE_LANGUAGE_DIRECTION', 'NO_SHARE_OR_MUTATION_DISPATCH'];
const required = Object.freeze({
  'portrait-care-cta': ['CARE_CTA_VISIBLE_AND_HITTABLE'],
  'care-arrival': ['TRUSTED_CURRENT_CARE_CTA_CLICK', 'OUTGOING_PORTRAIT_RETIRED', 'CARE_FIRST_FOLD_AT_TOP'],
  'care-primary': ['CURRENT_CARE_PRIMARY_VISIBLE_AND_HITTABLE', 'SAME_ACTUAL_CARE_NAVIGATION'],
  'care-back-portrait': ['TRUSTED_MY_CHILD_BACK_CLICK', 'OUTGOING_CARE_RETIRED', 'PORTRAIT_BACK_FIRST_FOLD', 'BACK_FOCUS_OBSERVED_WITHOUT_REPAIR'],
  'sharing-direct-control': ['DIRECT_SHARING_CONTROL_ONLY', 'SHARING_FIRST_FOLD_AT_TOP'],
});
export function portraitCareRequiredAssertions(state) {
  return Object.hasOwn(required, state) ? [...common, ...required[state]] : [];
}
export function validPortraitCareCell(cell) {
  const spec = PORTRAIT_CARE_STATES.find(item => item.state === cell?.state);
  const ids = portraitCareRequiredAssertions(cell?.state);
  if (!spec || cell.route !== spec.route || ids.some(id => !cell.assertions?.some(a => a.id === id && a.passed === true))
    || cell.surface?.identityReady !== true || cell.surface.hash !== `#/${spec.route}` || cell.surface.expectedRoute !== spec.route
    || !cell.renderReadiness?.length || cell.renderReadiness.some(trace => trace.after?.ready !== true)
    || cell.networkEvidence?.portraitCareDeniedMutations !== 0 || cell.networkEvidence?.deniedActions !== 0 || cell.networkEvidence?.deniedExternal !== 0
    || !Number.isInteger(cell.networkEvidence?.portraitCareNarrationRefusals) || cell.networkEvidence.portraitCareNarrationRefusals < 0 || cell.screenshotAnimations !== 'allow'
    || cell.screenshotSurface?.identityReady !== true || cell.screenshotSurface.hash !== cell.surface.hash) return false;
  if (cell.state === 'care-arrival' && !validPortraitCareClick(cell.navigationClick, 'portrait-care-cta', 'development')) return false;
  if (cell.state === 'care-primary' && (!validPortraitCareClick(cell.navigationClick, 'portrait-care-cta', 'development') || cell.primaryPixels?.ready !== true)) return false;
  if (cell.state === 'portrait-care-cta' && cell.ctaPixels?.ready !== true) return false;
  if (cell.state === 'care-back-portrait' && !validPortraitCareClick(cell.navigationClick, 'my-child-back', 'care-team')) return false;
  return true;
}
