/** Pure contracts for the synthetic capture runner. No server/browser side effects. */
export const BASE = 'http://127.0.0.1:4805';
export const PARENT_ROUTES = Object.freeze([
  'overview', 'coach', 'profile', 'development', 'practice', 'daily-play', 'plans',
  'weekly', 'journal', 'consult', 'appointments', 'reports', 'shell',
]);
export const FONT_LIMITATION = 'Google-hosted text fonts are unreachable in this offline capture. Existing bundled icon fonts remain available. These screenshots are not font-exact production evidence; no new font files are included.';

export function captureScope(value = 'all') {
  if (!['priorities', 'all'].includes(value)) throw new Error('Capture scope must be priorities or all.');
  return value;
}

export function captureRevision(value) {
  if (!/^[a-f0-9]{40}$/.test(value ?? '')) throw new Error('A full checked-out commit SHA is required.');
  return value;
}

export function assertLoopbackOnly(interfaces) {
  const addresses = Object.values(interfaces).flatMap((entries) => entries ?? []);
  if (!addresses.length || addresses.some((entry) => !entry.internal || !['127.0.0.1', '::1'].includes(entry.address))) {
    throw new Error('Capture requires the dedicated Docker --network none runtime.');
  }
}

/** Do not forward the host/CI environment, tokens, project IDs, proxies or ADC. */
export function sandboxEnvironment(path = '/usr/local/bin:/usr/bin:/bin') {
  return {
    PATH: path,
    HOME: '/tmp/arbor-capture-home',
    PLAYWRIGHT_BROWSERS_PATH: '/ms-playwright',
    NODE_ENV: 'development',
    ARBOR_ENV: 'local',
    MODEL_PROVIDER: 'mock',
    MEMORY_ADAPTER: 'local',
    ENABLE_LOCAL_MEMORY_ADAPTER: 'true',
    REQUIRE_AUTH: 'false',
    LIVE_ENABLED: 'false',
    TTS_PROVIDER: 'none',
    TTS_DISABLED: 'true',
    CHILD_ASR_PROVIDER: 'none',
    DISABLE_HMR: 'true',
    PORT: '4805',
    APP_URL: BASE,
    CORS_ORIGINS: BASE,
    ARBOR_KNOWLEDGE_PATH: '/capture/knowledge',
    VITE_FIREBASE_API_KEY: '',
    VITE_FIREBASE_AUTH_DOMAIN: '',
    VITE_FIREBASE_PROJECT_ID: '',
    VITE_FIREBASE_STORAGE_BUCKET: '',
    VITE_FIREBASE_APP_ID: '',
    VITE_FIREBASE_MESSAGING_SENDER_ID: '',
    VITE_FIREBASE_VAPID_KEY: '',
  };
}

export function sweepArguments(scope, output) {
  captureScope(scope);
  return ['scripts/rendered-sweep.mjs', '--base', BASE, '--out', output,
    '--seed', 'demo', '--states', ...(scope === 'priorities' ? ['--routes', PARENT_ROUTES.join(',')] : [])];
}

export function unreachableCells(doc) {
  return doc.cells.filter((cell) => cell.reached === false || cell.mounted === false || cell.readyTimedOut)
    .map(({ route, viewport, lang, state, reason, reached, mounted, readyTimedOut, firstAttempt }) =>
      ({ route, viewport, lang, state: state ?? 'base', reason, reached, mounted, readyTimedOut, firstAttempt }));
}

export function missingCriticalEvidence(diagnostics) {
  const missing = [];
  for (const [viewport, lang] of [['375x812', 'en'], ['375x812', 'he'], ['1280x800', 'en'], ['1280x800', 'he']]) {
    if (!diagnostics.cells.some((c) => c.state === 'launcher-answered' && c.viewport === viewport && c.lang === lang && c.reached && c.shot)) {
      missing.push({ route: 'shell', state: 'launcher-answered', viewport, lang });
    }
  }
  return missing;
}
