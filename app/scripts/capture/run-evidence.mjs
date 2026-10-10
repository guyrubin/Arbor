/** Small-pass container runner. Eight-minute internal deadline retains partial evidence. */
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { BASE, FONT_LIMITATION, assertLoopbackOnly, captureRevision } from './config.mjs';
import { SMALL_FIXTURE, smallCaptureEnvironment, missingSmallEvidence } from './small-state.mjs';
import { fontMode } from './font-cache.mjs';
import { SOURCE_FONT_NOTE, validateFontCache } from './font-runtime.mjs';

const output = '/capture-output';
const scratch = '/tmp/arbor-evidence';
const CAPTURE_DEADLINE_MS = 8 * 60_000;
let server;
let metadata;
const write = () => writeFileSync(`${output}/capture.json`, JSON.stringify(metadata, null, 2));
function progress(stage) {
  metadata.stage = stage;
  metadata.screenshots = readdirSync(`${output}/shots`).filter((name) => name.endsWith('.png')).length;
  if (existsSync(`${output}/evidence.json`)) {
    try { const evidence = JSON.parse(readFileSync(`${output}/evidence.json`, 'utf8')); metadata.missingEvidence = missingSmallEvidence(evidence.cells); metadata.completed = evidence.completed === true && metadata.missingEvidence.length === 0; } catch { /* preserve last complete progress snapshot */ }
  }
  write();
  console.log(`Small synthetic evidence: ${stage}; screenshots=${metadata.screenshots}.`);
}
async function run(args, env, name, deadlineMs) {
  const log = openSync(`${scratch}/${name}.log`, 'w');
  const child = spawn(process.execPath, args, { env, stdio: ['ignore', 'pipe', log], detached: true });
  let pending = '';
  child.stdout.on('data', (chunk) => {
    pending += chunk.toString();
    const lines = pending.split('\n'); pending = lines.pop().slice(-4096);
    for (const line of lines) if (/^Evidence screen: [a-z-]+\/[a-z0-9-]+\/(en|he); screenshots=\d+\.$/.test(line)) console.log(line);
  });
  let expired = false;
  let hardKill;
  const deadline = setTimeout(() => {
    expired = true;
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ }
    hardKill = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ } }, 2000);
  }, deadlineMs);
  const pulse = setInterval(() => progress(name), 15_000);
  try {
    const exitCode = await new Promise((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); });
    metadata.lastProcess = { name, exitCode, deadlineExpired: expired };
    if (exitCode !== 0 || expired) throw new Error(expired ? 'CAPTURE_DEADLINE' : 'CHILD_PROCESS_FAILED');
  } finally { clearTimeout(deadline); clearTimeout(hardKill); clearInterval(pulse); }
}

async function main() {
  assertLoopbackOnly(networkInterfaces());
  if (process.platform !== 'linux' || !existsSync('/.dockerenv')) throw new Error('OFFLINE_CONTAINER_REQUIRED');
  const sourceSha = captureRevision(process.env.ARBOR_CAPTURE_SHA);
  const mode = fontMode(process.env.ARBOR_CAPTURE_FONT_MODE);
  if (readdirSync('.').some((name) => name.startsWith('.env') || name === '.data')) throw new Error('INHERITED_DATA_REFUSED');
  const env = smallCaptureEnvironment();
  Object.assign(env, { ARBOR_CAPTURE_FONT_MODE: mode, ARBOR_CAPTURE_FONT_PHASE: 'small' });
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  for (const dir of [output, `${output}/shots`, scratch, env.HOME]) mkdirSync(dir, { recursive: true });
  metadata = { sourceSha, scope: 'small-mobile-current-selectors', fixture: SMALL_FIXTURE, runtimeNetwork: 'none', syntheticOnly: true, fontMode: mode, fontLimitation: mode === 'exact' ? SOURCE_FONT_NOTE : FONT_LIMITATION, completed: false, missingEvidence: missingSmallEvidence([]), deadlineMs: CAPTURE_DEADLINE_MS };
  progress('font-cache');
  if (mode === 'exact') writeFileSync(`${output}/font-provenance.json`, JSON.stringify(validateFontCache().manifest, null, 2));
  progress('seed');
  await run(['--import', 'tsx', 'scripts/seed-demo-family.mjs', '--target', 'sandbox', '--apply'], env, 'seed', 30_000);
  const family = JSON.parse(readFileSync('.data/demo-family.json', 'utf8'));
  if (family.child?.demo !== true || family.parent?.demo !== true) throw new Error('SYNTHETIC_FIXTURE_REQUIRED');
  progress('sandbox-start');
  const log = openSync(`${scratch}/server.log`, 'w');
  server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], { env, stdio: ['ignore', log, log] });
  let ready = false;
  let spawnError = false;
  server.on('error', () => { spawnError = true; });
  for (let n = 0; n < 90; n++) {
    if (server.exitCode !== null || spawnError) throw new Error('SANDBOX_EXITED');
    try { ready = (await fetch(`${BASE}/sandbox/demo-family.json`, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* warming */ }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error('SANDBOX_READINESS_TIMEOUT');
  progress('screens');
  await run(['scripts/capture/collect-evidence.mjs'], env, 'screens', CAPTURE_DEADLINE_MS);
  const evidence = JSON.parse(readFileSync(`${output}/evidence.json`, 'utf8'));
  metadata.completed = evidence.completed;
  metadata.missingEvidence = evidence.missingEvidence;
  progress('captured');
}
main().catch((error) => {
  if (metadata) {
    metadata.failure = ['CAPTURE_DEADLINE', 'CHILD_PROCESS_FAILED', 'SYNTHETIC_FIXTURE_REQUIRED', 'SANDBOX_EXITED', 'SANDBOX_READINESS_TIMEOUT'].includes(error.message) ? error.message : 'CAPTURE_FAILED';
    progress('incomplete');
  }
  console.error('Small synthetic capture incomplete; retain available PNG/JSON evidence.');
  process.exitCode = 1;
}).finally(() => { if (server) server.kill('SIGTERM'); });
