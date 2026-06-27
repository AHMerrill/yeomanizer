// Rasterize a PDF's pages to PNG images, entirely in the browser and entirely in memory. Used to
// embed a PDF *enclosure* into the .docx — Word can't hold vector PDF pages, so we render them to
// images. Privacy: the worker is bundled same-origin by Vite (no CDN, keeps connect-src 'self'),
// the bytes come from the in-memory dataURL the user dropped in, and nothing is written to disk or
// sent out. This whole module is lazy-imported, so pdf.js loads only when a PDF enclosure exists.
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

export interface RasterPage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

let wired = false;

export async function rasterizePdf(pdfBytes: Uint8Array, scale = 2): Promise<RasterPage[]> {
  if (!wired) {
    pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();
    wired = true;
  }
  const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
  const pages: RasterPage[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        page.cleanup();
        continue;
      }
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const b64 = canvas.toDataURL('image/png').split(',')[1] ?? '';
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
      pages.push({ bytes, width: canvas.width, height: canvas.height });
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return pages;
}
