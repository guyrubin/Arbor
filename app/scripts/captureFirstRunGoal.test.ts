import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { releaseCell, releaseEnvironment, releaseMatrix, RELEASE_MATRIX, RELEASE_VIEWPORTS } from './capture/release-config.mjs';
import { expectedReleaseInteractionStates } from './capture/release-interactions.mjs';
import { summarizeRelease } from './capture/release-summary.mjs';
import { FIRST_RUN_PREVIEW_BOUNDARY, FIRST_RUN_PREVIEW_STATES, firstRunPreviewPrimaryShot, firstRunPreviewRequiredAssertions } from './capture/first-run-preview-contract.mjs';
import { SINGLE_GOAL_STATES, singleGoalRequiredAssertions, singleGoalShot } from './capture/single-goal-contract.mjs';
import { SINGLE_GOAL_NETWORK_VERSION, singleGoalNetworkReceipt } from './capture/single-goal-network.mjs';
import { ROUTE_IDS } from '../src/lib/routes';
import { SURFACE_CONTRACTS } from '../src/lib/surfaceContract';

const identity = { sourceSha: 'a'.repeat(40), sourceTreeSha: 'b'.repeat(40) };
const scope = 'first-run-goal-only';
const goalApi = () => ({ singleGoalGuardVersion: SINGLE_GOAL_NETWORK_VERSION, deniedActions: 0, deniedExternal: 0, singleGoalDeniedMutations: 0, singleGoalDeniedRequests: 0 });
function records(): any[] {
  return releaseMatrix(scope).map((spec: any) => {
    const cell = releaseCell(spec), preview = cell.group === 'first-run-preview';
    const rows = preview ? FIRST_RUN_PREVIEW_STATES : SINGLE_GOAL_STATES;
    const cells = rows.map((row: any) => {
      const common = { ...row, group: cell.group, lang: cell.viewport.lang, viewport: `${cell.viewport.w}x${cell.viewport.h}`, ...identity,
        reached: true, failures: [], frames: [{ ready: true }] };
      return preview ? { ...common, fixture: 'existing-dev-onboarding-preview', firstRunPreview: FIRST_RUN_PREVIEW_BOUNDARY,
        shot: firstRunPreviewPrimaryShot(common), assertions: firstRunPreviewRequiredAssertions(row.state).map((id: string) => ({ id, passed: true })),
        networkEvidence: { firstRunDeniedWrites: 0, firstRunNarrationRefusals: 0, firstRunRequestDiagnostics: { counts: {}, recent: [] }, mockRequests: 0, deniedExternal: 0, deniedActions: 0 } }
        : { ...common, fixture: 'synthetic-single-goal-actual-controls-local-only', shot: singleGoalShot(common),
          assertions: singleGoalRequiredAssertions(row.state).map((id: string) => ({ id, passed: true })), networkEvidence: singleGoalNetworkReceipt(goalApi(), 'after-cell-awaits') };
    });
    return { capture: { ...identity, cell, completed: true, fontMode: 'exact', runtimeNetwork: 'none', fixture: { browserConnectivity: 'synthetic-online' },
      ...(preview ? { clientMode: 'existing-dev-onboarding-preview', serverMode: 'existing-local-vite-handler' } : {}) },
      inventory: { ...identity, routeIds: ROUTE_IDS, contracts: SURFACE_CONTRACTS },
      evidence: { ...identity, completed: true, cells, ...(preview ? { firstRunPreview: FIRST_RUN_PREVIEW_BOUNDARY }
        : { singleGoalFinalNetwork: singleGoalNetworkReceipt(goalApi(), 'after-context-browser-close', { contextClosed: true, browserClosed: true }) }) },
      shotNames: cells.map((row: any) => row.shot.split('/').pop()),
      fonts: { mode: 'exact', deniedFontRequests: 0, shots: cells.map((row: any) => ({ shot: row.shot.split('/').pop(), passed: true, rendered: [{ custom: true }] })) } };
  });
}

describe('combined first-run and goal exact-source scope', () => {
  it('selects precisely both existing state sets in all four existing language/viewport variants', () => {
    expect(releaseMatrix(scope)).toEqual([...releaseMatrix('first-run-preview-only'), ...releaseMatrix('single-goal-only')]);
    expect(releaseMatrix(scope)).toHaveLength(8);
    expect(FIRST_RUN_PREVIEW_STATES).toHaveLength(26); expect(SINGLE_GOAL_STATES).toHaveLength(49);
    let count = 0;
    for (const viewport of RELEASE_VIEWPORTS) for (const group of ['first-run-preview', 'single-goal']) {
      expect(releaseMatrix(scope).filter((row: any) => row.viewport === viewport.id && row.group === group)).toHaveLength(1);
      count += expectedReleaseInteractionStates(group, viewport).length;
    }
    expect(count).toBe(300);
  });
  it('retains all previous scopes, dev-only preview, and production goal isolation', () => {
    expect(releaseMatrix('all')).toEqual(RELEASE_MATRIX); expect(RELEASE_MATRIX).toHaveLength(8);
    expect(releaseMatrix('parent-kid-release')).toHaveLength(24);
    expect(releaseMatrix('first-run-preview-only')).toHaveLength(4); expect(releaseMatrix('single-goal-only')).toHaveLength(4);
    expect(releaseMatrix('private-export-only')).toHaveLength(4);
    expect(releaseMatrix(scope).every((row: any) => ['first-run-preview', 'single-goal'].includes(row.group))).toBe(true);
    const preview = releaseEnvironment(identity.sourceSha, 'first-run-preview');
    const goal = releaseEnvironment(identity.sourceSha, 'single-goal');
    expect(preview.NODE_ENV).toBe('development'); expect(goal.NODE_ENV).toBe('production');
    const { NODE_ENV: _preview, ...previewRest } = preview, { NODE_ENV: _goal, ...goalRest } = goal;
    expect(previewRest).toEqual(goalRest);
  });
  it('requires 300 exact-source cells, including all 104 canonical first-run primary PNGs', () => {
    const result = summarizeRelease(records(), identity, scope);
    expect(result).toMatchObject({ completed: true, expectedShards: 8, returnedShards: 8, interactionCells: 300, screenshots: 300,
      baseCells: 0, expectedBaseCells: 0, primaryScreenshots: 104, expectedPrimaryScreenshots: 104 });
    expect(result.note).toContain('remain BLOCKED');
  });
  for (const index of [0, 4]) it(`fails closed for missing or invalid evidence in lane ${index === 0 ? 'first-run' : 'goal'}`, () => {
    for (const corrupt of [
      (r: any[]) => { r.splice(index, 1); },
      (r: any[]) => { r[index].capture.sourceSha = 'c'.repeat(40); },
      (r: any[]) => { r[index].evidence.sourceTreeSha = 'c'.repeat(40); },
      (r: any[]) => { r[index].evidence.cells.pop(); },
      (r: any[]) => { r[index].evidence.cells[0].assertions.pop(); },
      (r: any[]) => { r[index].evidence.cells[0].networkEvidence.deniedActions = 1; },
      (r: any[]) => { r[index].shotNames.pop(); },
      (r: any[]) => { r[index].fonts.shots[0].rendered[0].custom = false; },
      (r: any[]) => { r[index].capture.runtimeNetwork = 'bridge'; },
    ]) { const input = records(); corrupt(input); expect(summarizeRelease(input, identity, scope).completed).toBe(false); }
  });
  it('retains final shutdown counters and first-run preview and distinct-primary protections in the union', () => {
    for (const corrupt of [
      (r: any[]) => { r[4].evidence.singleGoalFinalNetwork.deniedActions = 1; },
      (r: any[]) => { r[4].evidence.singleGoalFinalNetwork.shutdown.browserClosed = false; },
      (r: any[]) => { delete r[4].evidence.singleGoalFinalNetwork; },
      (r: any[]) => { r[0].evidence.firstRunPreview = { ...FIRST_RUN_PREVIEW_BOUNDARY, remoteAcknowledgementVerified: true }; },
      (r: any[]) => { r[0].evidence.cells[0].shot = r[0].evidence.cells[1].shot; },
      (r: any[]) => { r[0].fonts.shots.push(r[0].fonts.shots[0]); },
    ]) { const input = records(); corrupt(input); expect(summarizeRelease(input, identity, scope).completed).toBe(false); }
    expect(summarizeRelease(records().slice(0, 4), identity, scope).completed).toBe(false);
    expect(summarizeRelease(records().slice(4), identity, scope).completed).toBe(false);
  });
  it('uses only the existing bounded capture workflow, network-none runtime and exact font preparation', () => {
    const workflow = readFileSync(new URL('../../.github/workflows/arbor-parent-release-capture.yml', import.meta.url), 'utf8');
    expect(workflow).toContain('"codex/single-goal-capture" ]]; then scope=first-run-goal-only;');
    expect(workflow).toContain('docker create --network none');
    expect(workflow).toContain('CAPTURE_FONT_MODE=exact');
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).toContain('CAPTURE_SCOPE: ${{ needs.matrix.outputs.scope }}');
  });
});
