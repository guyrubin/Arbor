import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { BASE, PARENT_ROUTES, assertLoopbackOnly, captureRevision, captureScope, missingCriticalEvidence, sandboxEnvironment, sweepArguments, unreachableCells } from './capture/config.mjs';
import { ROUTE_IDS } from '../src/lib/routes';
import { SURFACE_CONTRACTS } from '../src/lib/surfaceContract';
import { loadConfig } from '../src/config/env';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('offline synthetic capture contracts (no browser or sockets)', () => {
  it('fails closed on every non-loopback interface, even when a loopback exists', () => {
    const loop = { lo: [{ address: '127.0.0.1', internal: true }, { address: '::1', internal: true }] };
    expect(() => assertLoopbackOnly(loop)).not.toThrow();
    expect(() => assertLoopbackOnly({})).toThrow();
    expect(() => assertLoopbackOnly({ ...loop, eth0: [{ address: '172.17.0.2', internal: false }] })).toThrow();
    expect(() => assertLoopbackOnly({ lo: [{ address: '8.8.8.8', internal: true }] })).toThrow();
    expect(() => assertLoopbackOnly({ tun0: [{ address: '10.0.0.1', internal: false }] })).toThrow();
  });

  it('has no env passthrough and resolves all app provider gates to mock/local', () => {
    const previous = { ...process.env };
    try {
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, sandboxEnvironment());
      const config = loadConfig();
      expect(config).toMatchObject({ arborEnv: 'local', modelProvider: 'mock', memoryAdapter: 'local', liveEnabled: false, ttsDisabled: true, ttsProvider: 'none', childAsrProvider: 'none' });
      for (const key of ['gcpProjectId', 'firebaseProjectId', 'geminiApiKey', 'revenuecatSecretApiKey']) expect(config[key as keyof typeof config]).toBeUndefined();
      expect(Object.keys(sandboxEnvironment()).some((key) => /TOKEN|SECRET|GOOGLE_APPLICATION_CREDENTIALS|PROXY/.test(key))).toBe(false);
      expect(sandboxEnvironment().VITE_FIREBASE_API_KEY).toBe('');
    } finally {
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, previous);
    }
  });

  it('defaults to every source route and all named states, including shell', () => {
    expect(captureScope()).toBe('all');
    expect(new Set(SURFACE_CONTRACTS.map((c) => c.route))).toEqual(new Set(ROUTE_IDS));
    expect(sweepArguments('all', '/capture-output')).toEqual(['scripts/rendered-sweep.mjs', '--base', BASE, '--out', '/capture-output', '--seed', 'demo', '--states']);
    expect(sweepArguments('priorities', '/capture-output')).toContain(PARENT_ROUTES.join(','));
    expect(PARENT_ROUTES).toContain('practice');
    expect(PARENT_ROUTES.every((route) => route === 'shell' || (ROUTE_IDS as readonly string[]).includes(route))).toBe(true);
    expect(() => captureScope('https://production.example')).toThrow();
    expect(() => captureRevision('main')).toThrow();
    expect(captureRevision('a'.repeat(40))).toBe('a'.repeat(40));
  });

  it('retains unreachable/failed route evidence and never equates a mock request with an answer', () => {
    expect(unreachableCells({ cells: [{ route: 'coach', state: 'answered', reached: false, reason: 'old selector' }, { route: 'overview', mounted: false }, { route: 'practice', mounted: true }] })).toHaveLength(2);
    const valid = ['375x812', '1280x800'].flatMap((viewport) => ['en', 'he'].map((lang) => ({ viewport, lang, state: 'launcher-answered', reached: true, shot: 'shots/a.png' })));
    expect(missingCriticalEvidence({ cells: valid })).toEqual([]);
    expect(missingCriticalEvidence({ cells: [{ ...valid[0], reached: false }] })).toHaveLength(4);
    expect(missingCriticalEvidence({ cells: valid.map((cell) => ({ ...cell, shot: null })) })).toHaveLength(4);
  });

  it('isolates runtime without tokens, a host mount, published ports or deploy permission', () => {
    const workflow = read('.github/workflows/arbor-parent-capture.yml');
    expect(workflow).toContain('docker create --network none');
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).toContain('contents: read');
    expect(workflow).not.toMatch(/secrets\.|id-token:|pull_request_target|--privileged|--network host|--volume|--mount|environment: production|firebase deploy/);
    expect(workflow).toContain("inputs.scope || 'all'");
    expect(workflow).toContain('branches: [\'codex/parent-ui-capture\']');
    const paths = workflow.split('          path: |')[1].split('          if-no-files-found:')[0];
    expect(paths).not.toMatch(/\.log|\.env|\.data|\*\*|node_modules/);
    expect(paths).toContain('unreachables.json');
    expect(paths).toContain('shots/*.png');
  });

  it('keeps app execution out of the networked image build and excludes local state', () => {
    const docker = read('app/scripts/capture/Dockerfile');
    expect(docker.indexOf('npm ci')).toBeLessThan(docker.indexOf('COPY app/src'));
    expect(docker).not.toMatch(/RUN.*(?:seed:demo|server\.ts|rendered-sweep|run\.mjs)/);
    const ignore = read('app/scripts/capture/Dockerfile.dockerignore');
    for (const pattern of ['**/.env*', '**/.data/**', '**/node_modules/**', 'app/public/_dev/**']) expect(ignore).toContain(pattern);
    const runner = read('app/scripts/capture/run.mjs');
    expect(runner.indexOf('assertLoopbackOnly(networkInterfaces())')).toBeLessThan(runner.indexOf("setStage('local-synthetic-seed')"));
    expect(runner).toContain("'--target', 'sandbox', '--apply'");
    expect(runner).toContain("family.child?.demo !== true");
    expect(runner).toContain("family.parent?.demo !== true");
    expect(read('app/src/demo/demoFamily.ts')).toContain('parent: { demo: true, displayName: DEMO_FAMILY_LABEL[lang] }');
    expect(runner).toContain('exitCode: code');
    expect(runner).toContain('categories');
    expect(runner).toContain("name.startsWith('.env') || name === '.data'");
  });

  it('covers the current companion report and Together dock without media permission', () => {
    const diagnostics = read('app/scripts/capture/diagnostics.mjs');
    expect(diagnostics).toContain('permissions: []');
    expect(diagnostics).not.toMatch(/grantPermissions|getUserMedia|\.companion-live-button.*click|coach-go-deeper.*click/);
    expect(diagnostics).toContain("['development', 'practice']");
    expect(diagnostics).toContain("['baseline', 'dock-open', 'dock-closed']");
    expect(diagnostics).toContain('[data-testid=coach-answer-cards]');
    expect(diagnostics).not.toContain('coach-answer-more');
    expect(diagnostics).toContain('document.fonts.status');
    expect(diagnostics).toContain('historical template was not rendered');
  });
});
