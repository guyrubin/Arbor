import { describe, expect, it, vi } from 'vitest';
import { verifyHosting } from '../../scripts/verify-live-release.mjs';
const SHA = 'a'.repeat(40);
const WORKER = 'const CACHE = "arbor-shell-test-release";';
function fixture(stamp = `${SHA}-123-1\n`, worker = WORKER, status = 200) {
  return vi.fn<typeof fetch>(async input => {
    const url = input instanceof Request ? input.url : String(input);
    return new Response(url.includes('timestamp.txt') ? stamp : worker, { status });
  });
}
describe('post-promotion release identity', () => {
  it('requires the exact stamp and exact stamped worker', async () => {
    const fetcher = fixture();
    await expect(verifyHosting('https://arbor.test', SHA, WORKER, fetcher)).resolves.toBe(SHA);
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const call of fetcher.mock.calls as unknown as [string, {cache: string; redirect: string}][]) {
      expect(call[0]).toContain(`?release=${SHA}`);
      expect(call[1].cache).toBe('no-store'); expect(call[1].redirect).toBe('error');
    }
  });
  it.each(['b'.repeat(40) + '-123-1', `${SHA}-123-1-stale`, '<html>fallback</html>', `${SHA}-no-run`])('rejects an invalid stamp %s', async stamp => {
    await expect(verifyHosting('https://arbor.test', SHA, WORKER, fixture(stamp))).rejects.toThrow('stamp');
  });
  it('rejects stale artwork-worker policy even when the stamp matches', async () => {
    await expect(verifyHosting('https://arbor.test', SHA, WORKER, fixture(undefined, 'old worker'))).rejects.toThrow('worker differs');
  });
  it('never accepts HTTP errors as a valid artifact', async () => {
    await expect(verifyHosting('https://arbor.test', SHA, WORKER, fixture(undefined, WORKER, 503))).rejects.toThrow('503');
  });
  it('rejects invalid release inputs before network access', async () => {
    const fetcher = fixture();
    await expect(verifyHosting('https://arbor.test', 'short', WORKER, fetcher)).rejects.toThrow('40-character');
    await expect(verifyHosting('https://arbor.test', SHA, '__BUILD_ID__', fetcher)).rejects.toThrow('stamped');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
