// Anonymous download tally.
//
// PRIVACY: this sends NO document content — ever. A GET reads the running total; a POST is
// an empty, content-free "a download happened" signal to the app's OWN origin. It stores
// only an integer server-side. If the endpoint isn't deployed (e.g. local dev), every call
// fails silently and the UI simply hides the count. This is the only network call the app
// makes beyond loading itself.
const ENDPOINT = '/api/count';

export async function getDownloadCount(): Promise<number | null> {
  try {
    const r = await fetch(ENDPOINT, { method: 'GET' });
    if (!r.ok) return null;
    const j = (await r.json()) as { count?: number };
    return typeof j.count === 'number' ? j.count : null;
  } catch {
    return null;
  }
}

export async function recordDownload(): Promise<number | null> {
  try {
    const r = await fetch(ENDPOINT, { method: 'POST' }); // no body — nothing to send
    if (!r.ok) return null;
    const j = (await r.json()) as { count?: number };
    return typeof j.count === 'number' ? j.count : null;
  } catch {
    return null;
  }
}
