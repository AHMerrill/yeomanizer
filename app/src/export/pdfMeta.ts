import type { PDFDocument } from 'pdf-lib';

// Strip ALL identifying metadata from a pdf-lib document so the exported PDF is "silent".
//
// pdf-lib stamps every document it creates with a default Producer + Creator
// ("pdf-lib (https://github.com/Hopding/pdf-lib)") and a real creation/modification timestamp. We
// clear every Info field: no tool/library name, no author, no echo of the subject, and no real
// timestamp (set to a fixed epoch so the file never reveals when it was made). The result carries
// nothing about the tool or the user.
//
// Note: a CAC/digital signature the user applies later embeds their identity BY DESIGN — that is
// separate, intended, and outside what this export writes.
export function stripPdfMetadata(doc: PDFDocument): void {
  doc.setTitle('');
  doc.setAuthor('');
  doc.setSubject('');
  doc.setKeywords([]);
  doc.setProducer('');
  doc.setCreator('');
  const epoch = new Date(0); // fixed sentinel — never the real creation time
  doc.setCreationDate(epoch);
  doc.setModificationDate(epoch);
}
