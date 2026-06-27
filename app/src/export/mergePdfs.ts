import { PDFDocument } from 'pdf-lib';
import { stripPdfMetadata } from './pdfMeta';

export interface MergeResult {
  bytes: Uint8Array; // the combined PDF (empty if nothing merged)
  pageCount: number;
  skipped: number[]; // indices of inputs that could not be parsed as PDFs
}

// Merge PDFs (as bytes) into one, in the given order — used to build a combined packet
// (the saved letter followed by its enclosures). Entirely client-side: nothing is uploaded.
// Inputs that fail to parse are skipped and reported rather than aborting the whole merge.
export async function mergePdfs(parts: Uint8Array[]): Promise<MergeResult> {
  const out = await PDFDocument.create();
  const skipped: number[] = [];

  for (let i = 0; i < parts.length; i++) {
    try {
      const src = await PDFDocument.load(parts[i], { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    } catch {
      skipped.push(i);
    }
  }

  // pdf-lib cannot save a page-less document; report an empty result instead of throwing.
  if (out.getPageCount() === 0) return { bytes: new Uint8Array(), pageCount: 0, skipped };

  stripPdfMetadata(out); // no identifying metadata in the combined packet (last step before save)
  const bytes = await out.save();
  return { bytes, pageCount: out.getPageCount(), skipped };
}
