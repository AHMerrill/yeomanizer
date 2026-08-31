import { PDFDocument } from 'pdf-lib';
import { stripPdfMetadata } from './pdfMeta';
import { addRasterPage, renderLockedPdf } from './lockedPdf';
import type { RasterPage } from './rasterizePdf';

export interface MergeResult {
  bytes: Uint8Array; // the combined PDF (empty if nothing merged)
  pageCount: number;
  skipped: number[]; // indices of inputs that contributed no pages at all
  rasterized: number[]; // indices of locked PDFs that came in as page images rather than vector
}

// Merge PDFs (as bytes) into one, in the given order — used to build a combined packet
// (the saved letter followed by its enclosures). Entirely client-side: nothing is uploaded.
// Inputs that fail to parse are skipped and reported rather than aborting the whole merge.
//
// A LOCKED (encrypted) input — every official government form is one — cannot be read by pdf-lib
// at all; copying its pages would silently produce blank ones. Those are rendered to page images
// with pdf.js instead, so the packet still contains the real document. `renderLocked` is injectable
// so tests can drive that path without a canvas or a pdf.js worker.
export async function mergePdfs(
  parts: Uint8Array[],
  renderLocked: (bytes: Uint8Array) => Promise<RasterPage[]> = renderLockedPdf,
): Promise<MergeResult> {
  const out = await PDFDocument.create();
  const skipped: number[] = [];
  const rasterized: number[] = [];

  for (let i = 0; i < parts.length; i++) {
    try {
      const src = await PDFDocument.load(parts[i], { ignoreEncryption: true });
      if (src.isEncrypted) {
        const pages = await renderLocked(parts[i]);
        if (!pages.length) throw new Error('locked PDF produced no pages');
        for (const rp of pages) await addRasterPage(out, rp);
        rasterized.push(i);
        continue;
      }
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    } catch {
      skipped.push(i);
    }
  }

  // pdf-lib cannot save a page-less document; report an empty result instead of throwing.
  if (out.getPageCount() === 0) {
    return { bytes: new Uint8Array(), pageCount: 0, skipped, rasterized };
  }

  stripPdfMetadata(out); // no identifying metadata in the combined packet (last step before save)
  const bytes = await out.save();
  return { bytes, pageCount: out.getPageCount(), skipped, rasterized };
}
