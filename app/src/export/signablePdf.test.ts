import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFDict, PDFArray } from 'pdf-lib';
import { buildSignablePdf } from './signablePdf';
import { defaultState } from '../defaultState';

describe('signable PDF export', () => {
  it('generates a valid PDF carrying an AcroForm digital-signature field (/FT /Sig)', async () => {
    const bytes = await buildSignablePdf({
      ...defaultState,
      from: 'Commanding Officer, USS Test',
      to: 'Chief of Naval Operations',
      subj: 'TEST LETTER',
      signature: { ...defaultState.signature, name: 'I. M. LASTNAME' },
    });

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);

    // The catalog must carry an AcroForm with a single field...
    const acro = doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
    expect(acro).toBeDefined();
    const fields = acro!.lookup(PDFName.of('Fields'), PDFArray);
    expect(fields.size()).toBe(1);

    // ...and that field is a signature field (FT = Sig), the Adobe "click to sign" widget.
    const field = fields.lookup(0, PDFDict);
    expect(field.get(PDFName.of('FT'))?.toString()).toBe('/Sig');
    expect(field.get(PDFName.of('Subtype'))?.toString()).toBe('/Widget');
  });
});
