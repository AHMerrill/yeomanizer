// Anonymous page-load + download-click tallies.
//
// PRIVACY: these send NO document content — ever — and carry no IP, region, or cookie. A GET reads
// the running totals; a POST is an empty, content-free "a page was loaded" / "a download button was
// clicked" signal to the app's OWN origin. The server stores only two integers. If the endpoints
// aren't deployed (e.g. local dev), every call fails silently and the UI simply hides the counts.
// These are the only network calls the app makes beyond loading itself.
//
// These are RAW, aggregate counters — deliberately NOT unique visitors. Deduplicating people would
// require a cookie, a stored ID, or their IP, which the tool refuses to use. So:
//   visits    = page loads (a refresh counts again) — shown as "Page Loads"
//   downloads = download-button clicks (counts even if the save is cancelled) — shown as "Download Clicks"
export interface Counts {
  downloads: number;
  visits: number;
}

function parse(j: unknown): Counts | null {
  const o = j as { downloads?: unknown; visits?: unknown };
  return typeof o?.downloads === 'number' && typeof o?.visits === 'number'
    ? { downloads: o.downloads, visits: o.visits }
    : null;
}

// Read both totals without recording anything.
export async function getCounts(): Promise<Counts | null> {
  try {
    const r = await fetch('/api/count', { method: 'GET' });
    return r.ok ? parse(await r.json()) : null;
  } catch {
    return null;
  }
}

// Record one page view (empty POST — nothing to send) and return the updated totals.
export async function recordVisit(): Promise<Counts | null> {
  try {
    const r = await fetch('/api/visit', { method: 'POST' });
    return r.ok ? parse(await r.json()) : null;
  } catch {
    return null;
  }
}

// Record one download (empty POST — nothing to send) and return the updated totals.
export async function recordDownload(): Promise<Counts | null> {
  try {
    const r = await fetch('/api/count', { method: 'POST' });
    return r.ok ? parse(await r.json()) : null;
  } catch {
    return null;
  }
}
