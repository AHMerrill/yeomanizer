// Locked ("secured"/encrypted) PDFs — the shape every official government form ships in, including
// every NAVPERS form on MyNavy HR — cannot be read by pdf-lib: it carries no decryption code at all,
// and `ignoreEncryption` only suppresses the error rather than decrypting anything. Copying pages out
// of one SUCCEEDS and yields pages whose content streams are still ciphertext, so the export looks
// fine and those pages come out blank, with nothing reported.
//
// pdf.js (already bundled for the .docx enclosure path) *can* read them, so we render those pages to
// images and embed those instead. This is the one place the app gives up vector output, and only
// where vector output is impossible — see CHECKLIST Part A #4. Everything stays in the browser:
// pdf.js's worker is bundled same-origin, so `connect-src 'self'` is untouched and nothing is sent out.
import { PDFDocument } from 'pdf-lib';
import type { RasterPage } from './rasterizePdf';

// ~216 dpi. Higher than the .docx path's 2x because this is the final, printed, signable artifact
// and the source is usually a dense form whose hairlines and 7pt labels have to survive printing.
export const LOCKED_PDF_SCALE = 3;

// Is this a PDF that pdf-lib can parse but not actually read? `updateMetadata: false` because a
// plain load re-stamps Producer/ModDate (CHECKLIST bug #12) — harmless here since we discard the
// document, but the habit is what keeps that bug dead.
export async function isLockedPdf(bytes: Uint8Array): Promise<boolean> {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    return doc.isEncrypted;
  } catch {
    return false; // unparseable is a different failure — the caller reports it as skipped
  }
}

// How long to wait for pdf.js before giving up on a locked enclosure. Rendering runs in a Web
// Worker, and a worker that never starts (blocked, still compiling, out of memory) leaves the
// promise pending forever — which would hang the whole export with no download and no error, the
// worst possible failure. Generous, because a cold worker start plus a 3x render of a dense form
// legitimately takes many seconds — this is a deadlock guard, not a performance budget. A render
// that loses the race means the enclosure is left OUT of the export (never emitted blank).
const RENDER_TIMEOUT_MS = 60_000;

// Render a locked PDF's pages to images. Lazy-imports pdf.js so it loads only when one turns up.
export async function renderLockedPdf(bytes: Uint8Array): Promise<RasterPage[]> {
  const { rasterizePdf } = await import('./rasterizePdf');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      rasterizePdf(bytes, LOCKED_PDF_SCALE),
      new Promise<RasterPage[]>((_, reject) => {
        timer = setTimeout(() => reject(new Error('locked-PDF render timed out')), RENDER_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// Embed ONE pre-rendered locked-PDF page into `doc` at its true page size, so a locked enclosure
// occupies exactly the geometry it would have had as a vector page.
//
// Deliberately one page per call: the caller must be able to record the page's index straight after
// adding it (`doc.getPageCount() - 1`), the way the vector enclosure path does. Identity lookup
// (`getPages().indexOf(pg)`) does NOT work — pdf-lib invalidates its page cache on addPage and
// rebuilds fresh PDFPage wrappers, so indexOf returns -1 and any per-page bookkeeping keyed off it
// (the per-enclosure CUI banner, for one) silently lands on nothing.
export async function addRasterPage(
  doc: PDFDocument,
  page: RasterPage,
  scale = LOCKED_PDF_SCALE,
): Promise<ReturnType<PDFDocument['addPage']>> {
  const png = await doc.embedPng(page.bytes);
  const w = page.width / scale;
  const h = page.height / scale;
  const pg = doc.addPage([w, h]);
  pg.drawImage(png, { x: 0, y: 0, width: w, height: h });
  return pg;
}
