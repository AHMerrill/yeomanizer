import { describe, it, expect, vi, afterEach } from 'vitest';
import { getCounts, recordVisit, recordDownload } from './counter';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(impl: (...a: unknown[]) => unknown) {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}

const ok = (downloads: number, visits: number) => async () => ({
  ok: true,
  json: async () => ({ downloads, visits }),
});

describe('visit + download counter client — resilient and content-free', () => {
  it('getCounts returns both totals on success', async () => {
    stubFetch(ok(42, 100));
    expect(await getCounts()).toEqual({ downloads: 42, visits: 100 });
  });

  it('getCounts returns null on a non-ok response', async () => {
    stubFetch(async () => ({ ok: false, json: async () => ({}) }));
    expect(await getCounts()).toBeNull();
  });

  it('getCounts returns null when fetch throws (offline / no endpoint)', async () => {
    stubFetch(async () => {
      throw new Error('network down');
    });
    await expect(getCounts()).resolves.toBeNull();
  });

  it('getCounts returns null on malformed JSON (missing fields)', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ count: 5 }) }));
    expect(await getCounts()).toBeNull();
  });

  it('recordDownload / recordVisit return both totals on success', async () => {
    stubFetch(ok(7, 9));
    expect(await recordDownload()).toEqual({ downloads: 7, visits: 9 });
    expect(await recordVisit()).toEqual({ downloads: 7, visits: 9 });
  });

  it('recordDownload / recordVisit never throw — resolve to null on error', async () => {
    stubFetch(async () => {
      throw new Error('boom');
    });
    await expect(recordDownload()).resolves.toBeNull();
    await expect(recordVisit()).resolves.toBeNull();
  });

  it('PRIVACY: recordDownload sends a content-free POST (no body) to /api/count', async () => {
    const fn = stubFetch(ok(1, 1));
    await recordDownload();
    const [url, opts] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/count');
    expect(opts.method).toBe('POST');
    expect('body' in opts).toBe(false); // never carries content, IP, or region
  });

  it('PRIVACY: recordVisit sends a content-free POST (no body) to /api/visit', async () => {
    const fn = stubFetch(ok(1, 1));
    await recordVisit();
    const [url, opts] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/visit');
    expect(opts.method).toBe('POST');
    expect('body' in opts).toBe(false); // never carries content, IP, or region
  });
});
