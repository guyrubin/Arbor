import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { requiresConversationReadiness, RELEASE_MATRIX, RELEASE_ROUTE_COUNT, RELEASE_SHARDS, RELEASE_VIEWPORTS, expectedSeedMarker, missingBaseEvidence, captureDeadlineMs, releaseCell, releaseMatrix, releaseEnvironment, releaseIdentity, releaseInventory, releaseSweepArguments, shardRoutes } from './capture/release-config.mjs';
import { expectedReleaseInteractionStates } from './capture/release-interactions.mjs';
import { summarizeRelease } from './capture/release-summary.mjs';
import { ROUTE_IDS } from '../src/lib/routes';
import { SURFACE_CONTRACTS } from '../src/lib/surfaceContract';
import { loadConfig } from '../src/config/env';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const identity = { sourceSha: 'a'.repeat(40), sourceTreeSha: 'b'.repeat(40) };
const routes = releaseInventory(ROUTE_IDS, SURFACE_CONTRACTS);
const baseCell = (route: string, vp: any) => ({ route, state: 'base', viewport: `${vp.w}x${vp.h}`, lang: vp.lang, mounted: true, conversationReadiness: requiresConversationReadiness(route) ? 'composer' : undefined, shot: `shots/${route}.${vp.id}.png`, readyTimedOut: false, seedHydrated: true, navigatorOnline: true, browserFixture: { connectivity: 'synthetic-online' } });
const records = (matrix = RELEASE_MATRIX) => matrix.map((spec: any) => {
  const cell = releaseCell(spec);
  const cells = spec.group === 'base' ? shardRoutes(routes, spec.shard).map((route: string) => baseCell(route, cell.viewport)) : expectedReleaseInteractionStates(spec.group, cell.viewport).map((state: any) => ({ ...state, ...identity, lang: cell.viewport.lang, viewport: `${cell.viewport.w}x${cell.viewport.h}`, reached: true, assertions: [{ id: 'REAL_INTERACTION_VERIFIED', passed: true }], failures: [], shot: `shots/${state.state}.png` }));
  const print = spec.group === 'record' ? { ...identity, passed: true, delivery: 'download-html', media: 'print', fontMode: 'source-platform-serif', paper: 'A4', exactAppPayload: true,
    htmlSha256: 'c'.repeat(64), htmlBytes: 4000, expectedRows: 4, renderedRows: 4, textMatches: true, viewport: { width: 794, height: 1123 },
    fonts: [{ familyName: 'Liberation Serif', glyphCount: 10 }], html: `print/kept-month.${spec.viewport}.html`, shot: `print/kept-month.${spec.viewport}.png` } : null;
  if (print) Object.assign(cells.find((item: any) => item.state === 'month-print'), { printPreview: print });
  return { printFiles: print ? [print.html, print.shot] : [], printHashes: print ? { [print.html]: print.htmlSha256 } : {}, capture: { ...identity, cell, completed: true, fontMode: 'exact', runtimeNetwork: 'none', fixture: { browserConnectivity: 'synthetic-online' } }, inventory: { ...identity, routeIds: routes, contracts: SURFACE_CONTRACTS }, evidence: { ...identity, sha: identity.sourceSha, completed: true, missingEvidence: [], cells }, fonts: { mode: 'exact', deniedFontRequests: 0, shots: cells.map((c: any) => ({ shot: c.shot.split('/').pop(), passed: true, rendered: [{ custom: true }] })) }, shotNames: cells.map((c: any) => c.shot.split('/').pop()) };
});

describe('final release evidence contracts, no sockets or browser', () => {
  it('covers all 43 canonical routes in EN/HE at both widths without duplicates', () => {
    expect(RELEASE_ROUTE_COUNT).toBe(43);
    expect(routes).toHaveLength(43);
    expect(RELEASE_VIEWPORTS.map((vp: any) => vp.id)).toEqual(['mobile-en', 'mobile-he', 'desktop-en', 'desktop-he']);
    expect(RELEASE_MATRIX).toHaveLength(8);
    for (const viewport of RELEASE_VIEWPORTS) {
      const specs = RELEASE_MATRIX.filter((cell: any) => cell.viewport === viewport.id && cell.group === 'base');
      expect(specs).toHaveLength(RELEASE_SHARDS);
      const covered = specs.flatMap((spec: any) => shardRoutes(routes, spec.shard));
      expect(new Set(covered)).toEqual(new Set(routes));
      expect(covered).toHaveLength(43);
      expect(specs.every((spec: any) => shardRoutes(routes, spec.shard).length === 43)).toBe(true);
    }
    expect(() => releaseInventory(routes.slice(1), SURFACE_CONTRACTS)).toThrow('RELEASE_ROUTE_INVENTORY_CHANGED');
    expect(() => releaseInventory(routes, [...SURFACE_CONTRACTS.slice(1), SURFACE_CONTRACTS[1]])).toThrow();
  });
  it('fails closed on matrix or source identity drift and supplies base-only canonical sweep args', () => {
    const cell = releaseCell({ viewport: 'desktop-he', group: 'base', shard: '0' });
    expect(releaseSweepArguments('/capture-output', routes, cell)).toEqual(['scripts/rendered-sweep.mjs', '--base', 'http://127.0.0.1:4805', '--out', '/capture-output', '--seed', 'demo', '--no-states', '--routes', shardRoutes(routes, 0).join(','), '--viewport', 'desktop-he']);
    for (const value of ['../../', 'mobile', 'desktop-fr']) expect(() => releaseCell({ viewport: value, group: 'base' })).toThrow();
    expect(() => releaseCell({ viewport: 'mobile-en', group: 'ask', shard: 1 })).toThrow();
    expect(() => releaseCell({ viewport: 'mobile-en', group: 'base', shard: '1.0' })).toThrow();
    expect(() => releaseIdentity('main', identity.sourceTreeSha)).toThrow();
    expect(() => releaseIdentity(identity.sourceSha, '')).toThrow();
    expect(() => shardRoutes(routes, 1)).toThrow();
    expect(releaseMatrix('ask-diagnostic')).toEqual([{ viewport: 'mobile-en', group: 'ask-diagnostic', shard: 0 }]);
    expect(captureDeadlineMs(releaseCell(releaseMatrix('ask-diagnostic')[0]))).toBe(240_000);
    expect(() => releaseMatrix('invalid')).toThrow();
  });
  it('uses the language-specific real hydrator marker, never accepts fallback or unmounted pixels', () => {
    const bundle = { version: 'v1', seededAt: 'time', locales: { en: {}, he: {} } };
    expect(expectedSeedMarker(bundle, 'he')).toBe('v1@time@he');
    expect(expectedSeedMarker({ version: 'v1', seededAt: 'time' }, 'he')).toBe('v1@time');
    const vp = RELEASE_VIEWPORTS[3];
    const cell = baseCell('overview', vp);
    expect(missingBaseEvidence([cell], ['overview'], vp)).toEqual([]);
    for (const patch of [{ mounted: false }, { shot: null }, { seedHydrated: false }, { readyTimedOut: true }, { navigatorOnline: false }, { browserFixture: {} }]) expect(missingBaseEvidence([{ ...cell, ...patch }], ['overview'], vp)).toHaveLength(1);
    expect(missingBaseEvidence([], ['overview'], vp)[0].failure).toBe('NOT_ATTEMPTED');
  });
  it('rejects a background Today shell and pending/error Coach readiness', () => {
    const vp = RELEASE_VIEWPORTS[0];
    for (const route of ['coach', 'scholar']) {
      const cell = baseCell(route, vp);
      expect(missingBaseEvidence([cell], [route], vp)).toEqual([]);
      for (const conversationReadiness of [undefined, 'pending', 'error-boundary']) {
        expect(missingBaseEvidence([{ ...cell, conversationReadiness }], [route], vp)).toHaveLength(1);
      }
    }
    expect(requiresConversationReadiness('overview')).toBe(false);
    const sweep = read('app/scripts/rendered-sweep.mjs');
    expect(sweep).toContain('const conversationRoute = requiresConversationReadiness(loadRoute)');
    expect(sweep).toContain("rec.mounted = composer");
  });
  it('builds a production client while preserving the no-provider local server gates', () => {
    const previous = { ...process.env };
    try {
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, releaseEnvironment(identity.sourceSha));
      expect(loadConfig()).toMatchObject({ nodeEnv: 'production', arborEnv: 'local', modelProvider: 'mock', memoryAdapter: 'local', liveEnabled: false, ttsDisabled: true, ttsProvider: 'none', childAsrProvider: 'none' });
      expect(process.env.REQUIRE_AUTH).toBe('false');
      expect(process.env.VITE_FIREBASE_API_KEY).toBe('');
      expect(process.env.VITE_HAS_GEMINI_API).toBe('true');
      expect(process.env.GITHUB_SHA).toBe(identity.sourceSha);
      expect(Object.keys(process.env).some((key) => /TOKEN|SECRET|PROXY|GOOGLE_APPLICATION_CREDENTIALS/.test(key))).toBe(false);
    } finally {
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, previous);
    }
    const runner = read('app/scripts/capture/run-release.mjs');
    expect(runner.indexOf('assertLoopbackOnly(networkInterfaces())')).toBeLessThan(runner.indexOf("await import('tsx/esm/api')"));
    expect(runner).toContain("['node_modules/vite/bin/vite.js', 'build']");
    expect(runner).not.toMatch(/npm|npx|--require.*env|process\.env\.PATH/);
    expect(read('app/src/server/start.ts')).toContain('config.nodeEnv !== "production"');
    expect(read('app/src/lib/firebase.ts')).toContain('["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)');
    expect(read('app/src/main.tsx')).toContain('else void hydrateDemoFamily()');
  });
  it('wires the exact font and synthetic online hooks into both canonical contexts and screenshot paths', () => {
    const sweep = read('app/scripts/rendered-sweep.mjs');
    expect(sweep.match(/browser\.newContext\(/g)).toHaveLength(2);
    expect(sweep.match(/\.\.\.captureFontContextOptions\(\)/g)).toHaveLength(2);
    expect(sweep.match(/await initializeCaptureContext\(context/g)).toHaveLength(2);
    expect(sweep.match(/await installOfflineFonts\(context\)/g)).toHaveLength(2);
    expect(sweep.match(/await captureScreenshot\(page/g)).toHaveLength(2);
    expect(sweep).not.toContain('await page.screenshot(');
    expect(sweep).toContain('document-extent-only-not-full-main-content');
    expect(sweep).toContain('rec.mainScrollport =');
    expect(sweep).toContain('const VIEWPORTS = RELEASE_VIEWPORTS');
    expect(sweep).not.toContain('EXTRA_VIEWPORTS');
    expect(sweep).toContain('expectedSeedMarker(seedFields.bundle, vp.lang)');
    expect(sweep).toContain('cells.push(cell);\n        checkpoint();');
  });
  it('keeps publication, providers, real data and font binaries out of the branch-specific workflow', () => {
    const workflow = read('.github/workflows/arbor-parent-release-capture.yml');
    expect(workflow).toContain("branches: ['codex/parent-final-capture', 'codex/parent-final-ask-diagnostic', 'codex/parent-close-return-diagnostic', 'codex/parent-record-clarity']");
    expect(workflow).toContain('contents: read');
    expect(workflow).toContain('fail-fast: false');
    expect(workflow).toContain('max-parallel: 4');
    expect(workflow).toContain('docker create --network none');
    expect(workflow).toContain('CAPTURE_DISPOSABLE_CI=true');
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).toContain("trap preserve EXIT");
    expect(workflow).not.toMatch(/secrets\.|id-token:|pull_request_target|--privileged|--network host|--volume|--mount|docker push|firebase deploy/);
    for (const paths of workflow.split('          path: |').slice(1)) expect(paths.split('          if-no-files-found:')[0]).not.toMatch(/\.log|\.env|\.data|\.woff2|\.css|\*\*|node_modules|\.tar/);
  });
  it('requires the additive record matrix and actual delivered print artifacts without reducing the baseline', () => {
    const extended = records(releaseMatrix('record-release'));
    expect(summarizeRelease(extended, identity, 'record-release')).toMatchObject({ completed: true, baseCells: 172, interactionCells: 474, screenshots: 646, printPreviews: 4, expectedShards: 12, returnedShards: 12 });
    expect(summarizeRelease(records(releaseMatrix('record-only')), identity, 'record-only')).toMatchObject({ completed: true, baseCells: 0, interactionCells: 180, printPreviews: 4 });
    extended[0].printHashes = {};
    expect(summarizeRelease(extended, identity, 'record-release').failures[0].reasons).toContain('ACTUAL_PRINT_DELIVERY_EVIDENCE_MISSING');
    expect(summarizeRelease(records(), identity, 'record-release').completed).toBe(false);
    const absent = records(releaseMatrix('record-only')); absent[0].printFiles.pop();
    expect(summarizeRelease(absent, identity, 'record-only').completed).toBe(false);
  });
  it('aggregates only the exact final-source complete four-way base matrix and font-proven PNGs', () => {
    const full = summarizeRelease(records(), identity);
    expect(summarizeRelease(records(releaseMatrix('ask-diagnostic')), identity, 'ask-diagnostic')).toMatchObject({ completed: true, expectedBaseCells: 0, baseCells: 0, returnedShards: 1, interactionCells: 4 });
    expect(summarizeRelease(records(releaseMatrix('report-close-only')), identity, 'report-close-only')).toMatchObject({ completed: true, expectedBaseCells: 0, baseCells: 0, returnedShards: 4, interactionCells: 8 });
    expect(full).toMatchObject({ completed: true, baseCells: 172, interactionCells: 294, screenshots: 466, expectedShards: 8, returnedShards: 8 });
    for (const viewport of RELEASE_VIEWPORTS) {
      const missingClose = records();
      const focused = missingClose.find(record => record.capture.cell.viewport.id === viewport.id && record.capture.cell.group === 'focused');
      expect(focused.evidence.cells.filter(cell => cell.state === 'report-close-return')).toHaveLength(1);
      focused.evidence.cells = focused.evidence.cells.filter(cell => cell.state !== 'report-close-return');
      const result = summarizeRelease(missingClose, identity);
      expect(result.completed).toBe(false);
      expect(result.failures.find(failure => failure.id === focused.capture.cell.id)?.reasons).toContain('INTERACTION_EVIDENCE_MISSING');
    }
    expect(summarizeRelease(records().slice(1), identity).completed).toBe(false);
    expect(summarizeRelease([...records(), records()[0]], identity).completed).toBe(false);
    const stale = records(); stale[0].capture.sourceSha = 'c'.repeat(40);
    expect(summarizeRelease(stale, identity).failures[0].reasons).toContain('SOURCE_IDENTITY_MISMATCH');
    const fallback = records(); fallback[0].fonts.shots[0].rendered[0].custom = false;
    expect(summarizeRelease(fallback, identity).completed).toBe(false);
    const missing = records(); missing[0].shotNames = [];
    expect(summarizeRelease(missing, identity).completed).toBe(false);
    const absentInteraction = records(); absentInteraction[1].evidence.cells.pop();
    expect(summarizeRelease(absentInteraction, identity).completed).toBe(false);
    const interrupted = records(); interrupted[0].evidence.completed = false;
    expect(summarizeRelease(interrupted, identity).completed).toBe(false);
  });
});
