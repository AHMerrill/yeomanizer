import { PDFDocument } from 'pdf-lib';
import { stripPdfMetadata } from './pdfMeta';

export interface MergeResult {
  bytes: Uint8Array; // the combined PDF (empty if nothing merged)
  pageCount: number;
  skipped: number[]; // indices of inputs that contributed no pages (unparseable OR encrypted)
  encrypted: number[]; // subset of `skipped`: real PDFs refused because they are encrypted/secured
}

// Merge PDFs (as bytes) into one, in the given order — used to build a combined packet
// (the saved letter followed by its enclosures). Entirely client-side: nothing is uploaded.
// Inputs that fail to parse are skipped and reported rather than aborting the whole merge.
export async function mergePdfs(parts: Uint8Array[]): Promise<MergeResult> {
  const out = await PDFDocument.create();
  const skipped: number[] = [];
  const encrypted: number[] = [];

  for (let i = 0; i < parts.length; i++) {
    try {
      const src = await PDFDocument.load(parts[i], { ignoreEncryption: true });
      // pdf-lib has NO decryption code at all — `ignoreEncryption` only suppresses
      // EncryptedPDFError, it does not decrypt. Copying pages out of an encrypted document
      // "succeeds" and yields pages whose content streams are still ciphertext: the merged PDF
      // opens without complaint and those pages render BLANK. Refuse them loudly instead.
      // (Real case: the official NAVPERS forms are AES-128 encrypted, so a user combining a
      // downloaded form with their letter would otherwise get a packet with silently blank pages.)
      if (src.isEncrypted) {
        skipped.push(i);
        encrypted.push(i);
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
    return { bytes: new Uint8Array(), pageCount: 0, skipped, encrypted };
  }

  stripPdfMetadata(out); // no identifying metadata in the combined packet (last step before save)
  const bytes = await out.save();
  return { bytes, pageCount: out.getPageCount(), skipped, encrypted };
}
