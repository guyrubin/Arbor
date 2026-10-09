import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { SMALL_FIXTURE, SMALL_STATES, initializeSyntheticOnline, missingSmallEvidence, smallCaptureEnvironment } from './capture/small-state.mjs';
import { sandboxEnvironment } from './capture/config.mjs';
const root = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const runner = read('app/scripts/capture/run-evidence.mjs');
const probe = read('app/scripts/capture/collect-evidence.mjs');
const workflow = read('.github/workflows/arbor-parent-evidence.yml');

describe('bounded mobile evidence source contracts, without browser or sockets', () => {
  it('uses a different branch and concurrency group from the still-running full sweep', () => {
    expect(workflow).toContain("branches: ['codex/parent-ui-evidence']");
    expect(workflow).toContain('group: arbor-parent-evidence-${{ github.ref }}');
    expect(workflow).not.toContain('arbor-parent-capture-${{ github.ref }}');
    expect(runner + probe + workflow).not.toContain('rendered-sweep.mjs');
  });
  it('keeps the existing network-none mock/local environment and fresh synthetic seed', () => {
    expect(workflow).toContain('docker create --network none');
    expect(workflow).toContain('contents: read');
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).not.toMatch(/secrets\.|--volume|--mount|--network host|id-token:|firebase deploy/);
    expect(runner).toContain('assertLoopbackOnly(networkInterfaces())');
    expect(probe).toContain('assertLoopbackOnly(networkInterfaces())');
    expect(runner).toContain('const env = smallCaptureEnvironment()');
    expect(runner).toContain("'--target', 'sandbox', '--apply'");
    expect(runner).toContain('family.parent?.demo !== true');
    expect(runner).toContain("name.startsWith('.env') || name === '.data'");
  });
  it('models online browser state without opening transport or changing any provider gate', () => {
    const storage = new Map();
    const navigator = { onLine: false };
    const window = {} as any;
    runInNewContext(`(${initializeSyntheticOnline.toString()})({ lang: 'he' })`, {
      navigator, window, localStorage: { setItem: (key: string, value: string) => storage.set(key, value) },
    });
    expect(navigator.onLine).toBe(true);
    expect(window.__arborCaptureFixture).toMatchObject({ originalNavigatorOnline: false, connectivity: 'synthetic-online' });
    expect(storage.get('arbor.uiLang')).toBe('he');
    expect(storage.get('arbor.aiLang')).toBe('he');
    expect(Object.getOwnPropertyDescriptor(navigator, 'onLine')?.configurable).toBe(false);
    expect(smallCaptureEnvironment()).toEqual({ ...sandboxEnvironment(), VITE_HAS_GEMINI_API: 'true' });
    expect(smallCaptureEnvironment().MODEL_PROVIDER).toBe('mock');
    expect(SMALL_FIXTURE.runtimeNetwork).toBe('none');
    expect(probe).toContain('context.addInitScript(initializeSyntheticOnline, { lang })');
    expect(probe).toContain('navigatorOnline: navigator.onLine');
    expect(probe).not.toMatch(/\.addStyleTag|\.setOffline|\.route.*fulfill.*coach/);
    expect(read('app/src/context/ArborContext.tsx')).toContain('const showSandboxBanner = import.meta.env.VITE_HAS_GEMINI_API !== "true"');
  });
  it('keeps absent, interrupted and failed states missing even when diagnostic pixels exist', () => {
    expect(missingSmallEvidence([])).toHaveLength(20);
    const cells = ['en', 'he'].flatMap((lang) => SMALL_STATES.map(([route, state]) => ({ route, state, lang, reached: true, shot: 'shots/a.png' })));
    expect(missingSmallEvidence(cells)).toEqual([]);
    expect(missingSmallEvidence([{ ...cells[0], reached: false, shot: null, failureShot: 'shots/failure.png' }])).toHaveLength(20);
    expect(probe).toContain('doc.completed = missingSmallEvidence(doc.cells).length === 0');
    expect(probe).toContain('cell.failureShot = failureShot');
    expect(runner).toContain('metadata.missingEvidence = missingSmallEvidence(evidence.cells)');
    expect(probe.indexOf('doc.cells.push(cell); save()')).toBeLessThan(probe.indexOf('await action(cell)'));
  });
  it('bounds the child before the outer deadline and keeps honest partial files', () => {
    expect(runner).toContain('8 * 60_000');
    expect(runner).toContain("process.kill(-child.pid, 'SIGTERM')");
    expect(runner).toContain("process.kill(-child.pid, 'SIGKILL')");
    expect(workflow).toContain('timeout-minutes: 12');
    expect(workflow).toContain('if: always()');
    expect(workflow).toContain('docker cp "$container:/capture-output/."');
    expect(runner).toContain('deadlineExpired: expired');
    expect(probe).toContain('doc.cells.push(cell); save()');
    expect(probe).toContain('if (doc.missingEvidence.length) process.exitCode = 1');
  });
  it('captures current mobile EN/HE selectors for every requested small-pass surface', () => {
    expect(probe).toContain("for (const lang of ['en', 'he'])");
    expect(probe).toContain('width: 375, height: 812');
    for (const selector of ['companion-launch-main', 'companion-composer', 'coach-send', 'coach-answer-cards', 'together-invitation', 'nav button[aria-expanded]']) expect(probe).toContain(selector);
    for (const state of ['now', 'launcher-open', 'structured-answer', 'understanding', 'next', 'together-first-ready', 'together-after-3s', 'timeline', 'mobile-more']) expect(probe).toContain(state);
    expect(probe).toContain("await load('journal')");
    expect(probe).toContain("screen('journal', 'journal'");
    expect(probe).toContain("screen('timeline', 'timeline'");
    expect(probe).toContain("await load('timeline')");
    expect(probe).not.toContain('coach-answer-more');
    expect(probe).toContain('DEPENDENT_STATE_UNREACHED');
  });
  it('labels requested source-font evidence without media grants or file upload', () => {
    expect(probe).toContain('permissions: []');
    expect(probe).not.toMatch(/grantPermissions|getUserMedia|setInputFiles|companion-live-button.*click/);
    expect(probe).toContain('fontMode: mode');
    expect(probe).toContain('.${mode}.png');
    expect(probe).toContain('.failure.fonts-unverified.png');
    expect(probe).toContain('document.fonts.status');
    expect(workflow).toContain('arbor-parent-small-source-fonts-${{ github.sha }}');
  });
  it('reports static screen/stage/count only, never raw child logs', () => {
    expect(runner).toContain('Evidence screen: [a-z-]+');
    expect(runner).toContain('screenshots=${metadata.screenshots}');
    expect(runner).not.toContain('console.log(chunk');
    const artifactPaths = workflow.split('          path: |')[1].split('          if-no-files-found:')[0];
    expect(artifactPaths).not.toMatch(/\.log|\.env|\.data|\*\*/);
    expect(artifactPaths).toContain('evidence.json');
    expect(artifactPaths).toContain('shots/*.png');
  });
  it('keeps the original slow-loader evidence before its bounded readiness wait', () => {
    expect(probe).toContain('cell.pendingAt8s = diagnostics()');
    expect(probe).toContain('lazy-pending-8s.fonts-unverified.png');
    expect(probe).toContain('timeout: 45_000');
    expect(probe).toContain('cell.slowLazyReadiness = cell.composerReadyMs > 8_000');
    expect(probe).toContain("if (!opened) throw new Error('DEPENDENT_STATE_UNREACHED')");
    expect(probe).toContain('moduleFailures: moduleFailures.slice(-100)');
    expect(probe).not.toMatch(/message\.text\(\)|error\.stack|request\.headers\(\)/);
  });
});
