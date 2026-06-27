// Round-trip: bundle the full editing state INTO an exported file, and pull it back out on import,
// so a saved .docx/.pdf can be dropped back in to keep editing. The bundle is gzipped JSON that
// rides ALONG INSIDE the user's own file — nothing is stored in the app, server, or browser.
//
// docx: a .docx is a zip, so we add one file to it (yeomanizer/state.json.gz). Word ignores the
// extra part; we read it back on import. (PDF embedding lives in signablePdf.ts — same bundle.)
import JSZip from 'jszip';
import type { LetterState } from '../types';

export const STATE_PATH = 'yeomanizer/state.json.gz'; // path inside the docx zip
const VERSION = 1;

interface Bundle {
  v: number;
  state: LetterState;
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  void writer.write(bytes as BufferSource);
  void writer.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  void writer.write(bytes as BufferSource);
  void writer.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

// When enclosure files aren't included, keep their titles + flags but drop the (large) bytes.
function prepare(state: LetterState, includeEnclosureFiles: boolean): LetterState {
  if (includeEnclosureFiles) return state;
  return { ...state, encls: state.encls.map((e) => ({ ...e, file: undefined })) };
}

export async function serializeState(state: LetterState, includeEnclosureFiles = true): Promise<Uint8Array> {
  const bundle: Bundle = { v: VERSION, state: prepare(state, includeEnclosureFiles) };
  return gzip(new TextEncoder().encode(JSON.stringify(bundle)));
}

export async function deserializeState(bytes: Uint8Array): Promise<LetterState | null> {
  try {
    const bundle = JSON.parse(new TextDecoder().decode(await gunzip(bytes))) as Bundle;
    if (!bundle || typeof bundle !== 'object' || !bundle.state || typeof bundle.state !== 'object') return null;
    // It's our own format; future schema changes migrate off bundle.v here.
    return bundle.state;
  } catch {
    return null;
  }
}

// ---- docx (the file IS a zip) ----
export async function embedStateInDocx(
  docxBytes: Uint8Array,
  state: LetterState,
  includeEnclosureFiles = true,
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(docxBytes);
  zip.file(STATE_PATH, await serializeState(state, includeEnclosureFiles));
  return zip.generateAsync({ type: 'uint8array' });
}

export async function extractStateFromDocx(bytes: Uint8Array): Promise<LetterState | null> {
  try {
    const zip = await JSZip.loadAsync(bytes);
    const f = zip.file(STATE_PATH);
    if (!f) return null;
    return deserializeState(await f.async('uint8array'));
  } catch {
    return null;
  }
}
