import { describe, it, expect, vi, afterEach } from 'vitest';
import { getDownloadCount, recordDownload } from './counter';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(impl: (...a: unknown[]) => unknown) {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('download counter client — resilient and content-free', () => {
  it('getDownloadCount returns the server count on success', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ count: 42 }) }));
    expect(await getDownloadCount()).toBe(42);
  });

  it('getDownloadCount returns null on a non-ok response', async () => {
    stubFetch(async () => ({ ok: false, json: async () => ({}) }));
    expect(await getDownloadCount()).toBeNull();
  });

  it('getDownloadCount returns null when fetch throws (offline / no endpoint)', async () => {
    stubFetch(async () => {
      throw new Error('network down');
    });
    await expect(getDownloadCount()).resolves.toBeNull();
  });

  it('getDownloadCount returns null on malformed JSON (no count field)', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ nope: true }) }));
    expect(await getDownloadCount()).toBeNull();
  });

  it('recordDownload returns the new count on success', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ count: 7 }) }));
    expect(await recordDownload()).toBe(7);
  });

  it('recordDownload never throws — resolves to null on error', async () => {
    stubFetch(async () => {
      throw new Error('boom');
    });
    await expect(recordDownload()).resolves.toBeNull();
  });

  it('PRIVACY: recordDownload sends a content-free POST to its own origin (no body)', async () => {
    const fn = stubFetch(async () => ({ ok: true, json: async () => ({ count: 1 }) }));
    await recordDownload();
    expect(fn).toHaveBeenCalledTimes(1);
    const [url, opts] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/count');
    expect(opts.method).toBe('POST');
    expect('body' in opts).toBe(false); // never carries document content
  });
});
