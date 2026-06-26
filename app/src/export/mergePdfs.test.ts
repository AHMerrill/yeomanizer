import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { mergePdfs } from './mergePdfs';

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([300, 400]);
  return doc.save();
}

describe('mergePdfs — combine PDFs client-side', () => {
  it('merges in order, summing the page counts', async () => {
    const r = await mergePdfs([await makePdf(2), await makePdf(1)]);
    expect(r.pageCount).toBe(3);
    expect(r.skipped).toEqual([]);
  });

  it('returns a valid PDF (%PDF- header)', async () => {
    const r = await mergePdfs([await makePdf(1)]);
    expect(new TextDecoder().decode(r.bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('skips unparseable inputs, reports their indices, keeps the rest', async () => {
    const good = await makePdf(1);
    const bad = new TextEncoder().encode('this is not a pdf');
    const r = await mergePdfs([good, bad, good]);
    expect(r.skipped).toEqual([1]);
    expect(r.pageCount).toBe(2);
  });

  it('all-invalid / empty input yields an empty result without throwing', async () => {
    const empty = await mergePdfs([]);
    expect(empty.pageCount).toBe(0);
    expect(empty.bytes.length).toBe(0);

    const allBad = await mergePdfs([new TextEncoder().encode('nope')]);
    expect(allBad.pageCount).toBe(0);
    expect(allBad.skipped).toEqual([0]);
  });
});
