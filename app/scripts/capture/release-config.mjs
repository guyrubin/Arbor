/** Pure release matrix and verdict contracts. No app, browser or network imports. */
import { BASE, captureRevision } from './config.mjs';
import { smallCaptureEnvironment } from './small-state.mjs';

export const RELEASE_ROUTE_COUNT = 43;
export const RELEASE_SHARDS = 1;
export const RELEASE_VIEWPORTS = Object.freeze([
  { id: 'mobile-en', w: 375, h: 812, lang: 'en' },
  { id: 'mobile-he', w: 375, h: 812, lang: 'he' },
  { id: 'desktop-en', w: 1280, h: 800, lang: 'en' },
  { id: 'desktop-he', w: 1280, h: 800, lang: 'he' },
]);
export const RELEASE_GROUPS = Object.freeze(['base', 'navigation', 'ask', 'ask-diagnostic', 'report-close-only', 'focused', 'record', 'confirmed-actions', 'kept-search', 'kid-entry', 'single-goal', 'first-run-preview', 'private-export', 'copilot-retirement']);
export const RELEASE_MATRIX = Object.freeze(RELEASE_VIEWPORTS.flatMap((viewport) => [
  { viewport: viewport.id, group: 'base', shard: 0 },
  { viewport: viewport.id, group: 'focused', shard: 0 },
]));
export function releaseMatrix(scope = 'all') {
  if (scope === 'all') return RELEASE_MATRIX;
  if (scope === 'copilot-retirement-only') return RELEASE_VIEWPORTS.map(viewport => ({ viewport: viewport.id, group: 'copilot-retirement', shard: 0 }));
  if (scope === 'first-run-goal-only') return [...releaseMatrix('first-run-preview-only'), ...releaseMatrix('single-goal-only')];
  if (scope === 'single-goal-only') return RELEASE_VIEWPORTS.map(viewport => ({ viewport: viewport.id, group: 'single-goal', shard: 0 }));
  if (scope === 'first-run-preview-only') return RELEASE_VIEWPORTS.map(viewport => ({ viewport: viewport.id, group: 'first-run-preview', shard: 0 }));
  if (scope === 'parent-kid-release') return [...releaseMatrix('kept-search-only'), ...releaseMatrix('kid-entry-only'), ...releaseMatrix('confirmed-actions-release')];
  if (scope === 'kept-search-only') return RELEASE_VIEWPORTS.map(viewport => ({ viewport: viewport.id, group: 'kept-search', shard: 0 }));
  if (scope === 'kept-search-release') return [...releaseMatrix('kept-search-only'), ...releaseMatrix('confirmed-actions-release')];
  if (scope === 'private-export-only') return RELEASE_VIEWPORTS.map(viewport => ({ viewport: viewport.id, group: 'private-export', shard: 0 }));
  if (scope === 'kid-entry-diagnostic') return [{ viewport: 'desktop-en', group: 'kid-entry', shard: 0 }];
  if (scope === 'kid-entry-only') return RELEASE_VIEWPORTS.map(viewport => ({ viewport: viewport.id, group: 'kid-entry', shard: 0 }));
  if (scope === 'kid-entry-release') return [...releaseMatrix('kid-entry-only'), ...releaseMatrix('confirmed-actions-release')];
  if (scope === 'confirmed-actions-only') return RELEASE_VIEWPORTS.map(viewport => ({ viewport: viewport.id, group: 'confirmed-actions', shard: 0 }));
  if (scope === 'confirmed-actions-release') return [...releaseMatrix('confirmed-actions-only'), ...releaseMatrix('record-release')];
  if (scope === 'record-only') return RELEASE_VIEWPORTS.map(viewport => ({ viewport: viewport.id, group: 'record', shard: 0 }));
  if (scope === 'record-release') return [...releaseMatrix('record-only'), ...RELEASE_MATRIX];
  if (scope === 'report-close-only') return RELEASE_VIEWPORTS.map(viewport => ({ viewport: viewport.id, group: 'report-close-only', shard: 0 }));
  if (scope === 'ask-diagnostic') return [{ viewport: 'mobile-en', group: 'ask-diagnostic', shard: 0 }];
  throw new Error('RELEASE_SCOPE_INVALID');
}
export function captureDeadlineMs(cell) {
  return (cell.group === 'base' ? 12 : ['ask', 'ask-diagnostic', 'report-close-only'].includes(cell.group) ? 4 : 10) * 60_000;
}

/** @param {{ viewport: string, group: string, shard?: string | number }} input */
export function releaseCell({ viewport, group, shard = '0' }) {
  const size = RELEASE_VIEWPORTS.find((item) => item.id === viewport);
  if (!size || !RELEASE_GROUPS.includes(group) || !/^0$/.test(String(shard)) || (group !== 'base' && Number(shard) !== 0)) throw new Error('RELEASE_CELL_INVALID');
  return { viewport: size, group, shard: Number(shard), id: `${viewport}-${group}-${shard}` };
}
export function releaseInventory(routeIds, contracts) {
  const ids = [...routeIds];
  const surfaces = contracts.map(({ route }) => route);
  if (ids.length !== RELEASE_ROUTE_COUNT || new Set(ids).size !== ids.length || surfaces.length !== ids.length || new Set(surfaces).size !== ids.length || ids.some((route) => !surfaces.includes(route))) throw new Error('RELEASE_ROUTE_INVENTORY_CHANGED');
  return ids;
}
export function shardRoutes(routeIds, shard) {
  if (!Number.isInteger(shard) || shard < 0 || shard >= RELEASE_SHARDS) throw new Error('RELEASE_SHARD_INVALID');
  return routeIds.filter((_, index) => index % RELEASE_SHARDS === shard);
}
export function releaseSweepArguments(output, routeIds, cell) {
  if (cell.group !== 'base') throw new Error('RELEASE_BASE_CELL_REQUIRED');
  return ['scripts/rendered-sweep.mjs', '--base', BASE, '--out', output, '--seed', 'demo', '--no-states', '--routes', shardRoutes(routeIds, cell.shard).join(','), '--viewport', cell.viewport.id];
}
export function requiresConversationReadiness(route) {
  return ['coach', 'scholar'].includes(String(route).split('?')[0]);
}
export function missingBaseEvidence(cells, routeIds, viewport) {
  return routeIds.flatMap((route) => {
    const item = cells.find((cell) => cell.route === route && (cell.state ?? 'base') === 'base' && cell.viewport === `${viewport.w}x${viewport.h}` && cell.lang === viewport.lang);
    const actualSurface = !requiresConversationReadiness(route) || item?.conversationReadiness === 'composer';
    return actualSurface && item?.mounted && item.shot && !item.readyTimedOut && item.seedHydrated && item.browserFixture?.connectivity === 'synthetic-online' && item.navigatorOnline === true
      ? [] : [{ route, viewport: viewport.id, failure: item?.fontFailure ?? (item ? 'BASE_EVIDENCE_INCOMPLETE' : 'NOT_ATTEMPTED') }];
  });
}

export function releaseIdentity(sourceSha, sourceTreeSha) {
  return { sourceSha: captureRevision(sourceSha), sourceTreeSha: captureRevision(sourceTreeSha) };
}

/** Built client + existing static server; all provider/auth/data gates stay local. */
export function releaseEnvironment(sourceSha, group) {
  // Only this additive scope uses App.tsx's existing DEV-only ?onboarding seam.
  return { ...smallCaptureEnvironment(), NODE_ENV: group === 'first-run-preview' ? 'development' : 'production', GITHUB_SHA: captureRevision(sourceSha) };
}

export function expectedSeedMarker(bundle, lang) {
  const base = `${String(bundle.version)}@${String(bundle.seededAt)}`;
  return bundle.locales?.[lang] ? `${base}@${lang}` : base;
}
