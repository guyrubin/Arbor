/** Capture-only state contracts. No browser, app, socket or provider side effects. */
import { sandboxEnvironment } from './config.mjs';

export const SMALL_FIXTURE = Object.freeze({
  browserConnectivity: 'synthetic-online',
  connectivityOverride: 'navigator.onLine=true before application scripts',
  runtimeNetwork: 'none',
  modelProvider: 'mock',
  memoryAdapter: 'local',
  sandboxNotice: 'suppressed with existing VITE_HAS_GEMINI_API display flag; no API key configured',
  asyncComparison: 'first observed ready frame versus three seconds later; not a guaranteed pre-hydration frame',
});

export function smallCaptureEnvironment() {
  // This flag has only one app use: showSandboxBanner. It neither supplies a
  // credential nor changes MODEL_PROVIDER, transport isolation or auth gates.
  return { ...sandboxEnvironment(), VITE_HAS_GEMINI_API: 'true' };
}

/** Serialized by Playwright and run before app startup in each fresh document. */
export function initializeSyntheticOnline({ lang }) {
  const originalNavigatorOnline = navigator.onLine;
  Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: false });
  Object.defineProperty(window, '__arborCaptureFixture', {
    value: Object.freeze({ originalNavigatorOnline, connectivity: 'synthetic-online' }),
    configurable: false,
  });
  localStorage.setItem('arbor.uiLang', lang);
  localStorage.setItem('arbor.aiLang', lang);
  localStorage.setItem('arbor.kidmode.active', JSON.stringify({ open: false }));
}

export const SMALL_STATES = Object.freeze([
  ['overview', 'now'], ['shell', 'launcher-open'], ['shell', 'structured-answer'],
  ['shell', 'report-understanding'], ['shell', 'report-next'],
  ['practice', 'together-first-ready'], ['practice', 'together-after-3s'],
  ['journal', 'journal'], ['timeline', 'timeline'], ['shell', 'mobile-more'],
]);

export function missingSmallEvidence(cells) {
  return ['en', 'he'].flatMap((lang) => SMALL_STATES.flatMap(([route, state]) => {
    const cell = cells.find((item) => item.lang === lang && item.route === route && item.state === state);
    return cell?.reached && cell.shot ? [] : [{ route, state, lang, failure: cell?.failure ?? (cell ? 'INTERRUPTED' : 'NOT_ATTEMPTED') }];
  }));
}
