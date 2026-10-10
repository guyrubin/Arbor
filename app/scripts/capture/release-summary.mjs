/** Pure aggregate verdict. Filesystem adapter lives in summarize-release.mjs. */
import { expectedReleaseInteractionStates, missingReleaseInteractionEvidence } from './release-interactions.mjs';
import { releaseMatrix, RELEASE_VIEWPORTS, releaseIdentity, releaseInventory, missingBaseEvidence, shardRoutes } from './release-config.mjs';
import { SINGLE_GOAL_STATES } from './single-goal-contract.mjs';
import { validSingleGoalNetwork } from './single-goal-network.mjs';
import { validRecordPrintReceipt } from './record-print.mjs';
import { FIRST_RUN_PREVIEW_STATES, firstRunPreviewPrimaryShot } from './first-run-preview-contract.mjs';

export function summarizeRelease(records, identity, scope = 'all') {
  releaseIdentity(identity.sourceSha, identity.sourceTreeSha);
  const failures = [];
  const seen = new Set();
  const firstRunPrimaryShots = new Set();
  let baseCells = 0;
  let interactionCells = 0;
  let screenshots = 0;
  let printPreviews = 0;
  let routeIds;
  const shards = [];
  const matrix = releaseMatrix(scope);
  const expected = new Set(matrix.map((cell) => `${cell.viewport}-${cell.group}-${cell.shard}`));
  for (const record of records) {
    const { capture, inventory, evidence, fonts, shotNames = [] } = record;
    const id = capture?.cell?.id;
    const reasons = [];
    if (!expected.has(id) || seen.has(id)) reasons.push('UNKNOWN_OR_DUPLICATE_SHARD');
    seen.add(id);
    if (capture?.sourceSha !== identity.sourceSha || capture?.sourceTreeSha !== identity.sourceTreeSha || inventory?.sourceSha !== identity.sourceSha || inventory?.sourceTreeSha !== identity.sourceTreeSha) reasons.push('SOURCE_IDENTITY_MISMATCH');
    if (capture?.fontMode !== 'exact' || capture?.runtimeNetwork !== 'none' || capture?.fixture?.browserConnectivity !== 'synthetic-online') reasons.push('CAPTURE_FIXTURE_MISMATCH');
    let ids = [];
    try { ids = releaseInventory(inventory.routeIds, inventory.contracts); } catch { reasons.push('ROUTE_INVENTORY_INVALID'); }
    if (routeIds && JSON.stringify(routeIds) !== JSON.stringify(ids)) reasons.push('ROUTE_INVENTORY_MISMATCH');
    if (ids.length) routeIds ??= ids;
    if (!capture?.completed || !evidence?.completed) reasons.push('SHARD_INCOMPLETE');
    const viewport = RELEASE_VIEWPORTS.find((vp) => vp.id === capture?.cell?.viewport?.id);
    const group = capture?.cell?.group;
    const cells = evidence?.cells ?? [];
    if (group === 'first-run-preview' && (capture?.clientMode !== 'existing-dev-onboarding-preview' || capture?.serverMode !== 'existing-local-vite-handler' || evidence?.firstRunPreview?.productionGateVerified !== false || evidence?.firstRunPreview?.remoteAcknowledgementVerified !== false)) reasons.push('FIRST_RUN_PREVIEW_BOUNDARY_MISSING');
    if (group === 'copilot-retirement' && viewport && (cells.length !== expectedReleaseInteractionStates(group, viewport).length || new Set(cells.map(cell => cell.state)).size !== cells.length || new Set(cells.map(cell => cell.shot)).size !== cells.length)) reasons.push('COPILOT_STATE_OR_SHOT_SET_INVALID');
    if (group === 'first-run-preview' && viewport && (cells.length !== expectedReleaseInteractionStates(group, viewport).length || new Set(cells.map(cell => cell.state)).size !== cells.length)) reasons.push('FIRST_RUN_PREVIEW_STATE_SET_INVALID');
    if (group === 'base' && viewport) {
      if (evidence?.sha !== identity.sourceSha || evidence?.sourceTreeSha !== identity.sourceTreeSha) reasons.push('SWEEP_IDENTITY_MISMATCH');
      const routes = shardRoutes(ids, capture.cell.shard);
      if (cells.length !== routes.length || missingBaseEvidence(cells, routes, viewport).length) reasons.push('BASE_EVIDENCE_MISSING');
      baseCells += cells.filter((cell) => cell.mounted && cell.shot).length;
    } else if (['navigation', 'ask', 'ask-diagnostic', 'report-close-only', 'focused', 'record', 'confirmed-actions', 'kept-search', 'kid-entry', 'single-goal', 'first-run-preview', 'private-export', 'copilot-retirement'].includes(group) && viewport) {
      if (evidence?.sourceSha !== identity.sourceSha || evidence?.sourceTreeSha !== identity.sourceTreeSha) reasons.push('INTERACTION_IDENTITY_MISMATCH');
      if (missingReleaseInteractionEvidence(cells, { group, viewport, ...identity }).length || !cells.length || cells.some((cell) => !cell.reached || !cell.shot)) reasons.push('INTERACTION_EVIDENCE_MISSING');
      if (group === 'single-goal' && (cells.length !== SINGLE_GOAL_STATES.length || new Set(cells.map(cell => cell.state)).size !== SINGLE_GOAL_STATES.length)) reasons.push('SINGLE_GOAL_STATE_INVENTORY_INVALID');
      interactionCells += cells.filter((cell) => cell.reached && cell.shot).length;
    } else reasons.push('SHARD_SCOPE_INVALID');
    if (group === 'single-goal' && !validSingleGoalNetwork(evidence?.singleGoalFinalNetwork, 'after-context-browser-close')) reasons.push('SINGLE_GOAL_FINAL_NETWORK_INVALID');
    if (group === 'first-run-preview' && viewport) {
      const requiredShots = new Set(FIRST_RUN_PREVIEW_STATES.map(({ state }) => firstRunPreviewPrimaryShot({ state, viewport: `${viewport.w}x${viewport.h}`, lang: viewport.lang })));
      if (new Set(cells.map(cell => cell.shot)).size !== requiredShots.size) reasons.push('FIRST_RUN_PRIMARY_SHOTS_NOT_DISTINCT');
      for (const shot of requiredShots) {
        const name = shot.split('/').pop();
        const matches = fonts?.shots?.filter(item => item.shot === name) ?? [];
        const present = cells.filter(cell => cell.shot === shot).length === 1 && shotNames.filter(file => file === name).length === 1;
        const fontProof = matches.length === 1 && matches[0].passed === true && matches[0].rendered?.length > 0 && matches[0].rendered.every(sample => sample.custom === true);
        if (!present || !fontProof) reasons.push('FIRST_RUN_PRIMARY_EVIDENCE_MISSING');
        else if (firstRunPrimaryShots.has(shot)) reasons.push('FIRST_RUN_PRIMARY_SHOT_REUSED');
        else firstRunPrimaryShots.add(shot);
      }
      if (cells.some(cell => [cell.fullShot, ...(Array.isArray(cell.supplementalShots) ? cell.supplementalShots : []).map(item => item?.shot)].some(shot => requiredShots.has(shot)))) reasons.push('FIRST_RUN_DIAGNOSTIC_REUSES_PRIMARY');
    }
    for (const cell of cells) {
      const supplements = Array.isArray(cell.supplementalShots) ? cell.supplementalShots : [];
      if (group === 'kept-search' && cell.state === 'search-prepare-arrival' && viewport) {
        const expectedShot = `shots/release.kept-search.${viewport.w}x${viewport.h}.${viewport.lang}.search-prepare-arrival.scrolled.exact.png`;
        const extra = supplements[0];
        if (supplements.length !== 1 || extra?.stage !== 'actual-consult-build-summary-after-scroll'
          || extra?.initialShot !== cell.shot || extra?.shot !== expectedShot || extra.shot === cell.shot) reasons.push('CONSULT_SCROLLED_EVIDENCE_INVALID');
      }
      for (const file of [cell.shot, cell.fullShot, ...supplements.map(item => item?.shot)].filter(Boolean)) {
        if (typeof file !== 'string') { reasons.push('SCREENSHOT_PATH_INVALID'); continue; }
        const name = file.split('/').pop();
        if (!shotNames.includes(name)) reasons.push(`PNG_MISSING:${name}`);
        if (!fonts?.shots?.some((shot) => shot.shot === name && shot.passed === true && shot.rendered?.length && shot.rendered.every((sample) => sample.custom === true))) reasons.push(`FONT_EVIDENCE_MISSING:${name}`);
      }
    }
    if (fonts?.mode !== 'exact' || fonts?.deniedFontRequests !== 0) reasons.push('FONT_CACHE_REQUEST_FAILED');
    if (group === 'record') {
      const prints = cells.filter(cell => cell.state === 'month-print');
      if (prints.length !== 1 || !validRecordPrintReceipt(prints[0]?.printPreview, identity, record.printFiles, record.printHashes)) reasons.push('ACTUAL_PRINT_DELIVERY_EVIDENCE_MISSING');
      else printPreviews++;
    }
    screenshots += shotNames.length;
    const unique = [...new Set(reasons)];
    shards.push({ id: id ?? 'unknown', completed: unique.length === 0, cells: cells.length, screenshots: shotNames.length, failures: unique });
    if (unique.length) failures.push({ id: id ?? 'unknown', reasons: unique });
  }
  for (const id of expected) if (!seen.has(id)) failures.push({ id, reasons: ['SHARD_NOT_RETURNED'] });
  const expectedBaseCells = ['all', 'record-release', 'confirmed-actions-release', 'kept-search-release', 'kid-entry-release', 'parent-kid-release'].includes(scope) ? 172 : 0;
  if (baseCells !== expectedBaseCells) failures.push({ id: 'base-matrix', reasons: ['BASE_MATRIX_INCOMPLETE'] });
  const expectedFirstRunPrimaryShots = matrix.filter(cell => cell.group === 'first-run-preview').length * FIRST_RUN_PREVIEW_STATES.length;
  if (expectedFirstRunPrimaryShots > 0 && firstRunPrimaryShots.size !== expectedFirstRunPrimaryShots) failures.push({ id: 'first-run-primary-matrix', reasons: ['FIRST_RUN_PRIMARY_MATRIX_INCOMPLETE'] });
  return { schema: 1, scope, ...(expectedFirstRunPrimaryShots > 0 ? { expectedPrimaryScreenshots: expectedFirstRunPrimaryShots, primaryScreenshots: firstRunPrimaryShots.size } : {}), ...identity, completed: failures.length === 0, expectedShards: expected.size, returnedShards: records.length,
    expectedBaseCells, baseCells, interactionCells, screenshots, printPreviews, routeIds: routeIds ?? [], shards, failures,
    note: (scope === 'copilot-retirement-only' ? 'Bounded Copilot retirement only. Remote receipt/error/auth and pre-render held-callback races remain source-only evidence; history remote loading/cache/error are unmodelled. ' : '') + (expectedFirstRunPrimaryShots > 0 ? (scope === 'first-run-goal-only' ? 'First-run cells are DEV preview only. ' : 'DEV preview only. ') + 'Production ProfileGate, remote empty-account entry and server acknowledgement remain BLOCKED. ' : '') + (scope === 'private-export-only' ? 'This bounded scope covers only the sandbox partial JSON flow. Complete authenticated private-file export and native-device download remain unverified. ' : '') + 'Coverage is rendered evidence, not a visual-quality sign-off. Review PNGs and interaction assertions. Synthetic records/mock replies do not establish production/provider behavior.' };
}
