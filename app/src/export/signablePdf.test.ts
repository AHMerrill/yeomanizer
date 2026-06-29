import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
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

// The headless harness can't fetch() the Vite-bundled seal asset, so loadSealBytes() silently returns
// nothing in node — meaning the seal never embedded in any automated check. We read the real PNG from
// disk and hand it to buildSignablePdf (the same embed path the browser uses), so a regression that
// drops the seal now fails CI instead of slipping through.
describe('signable PDF — letterhead seal embedding', () => {
  const SEAL = readFileSync(new URL('../assets/dow-seal.png', import.meta.url));
  const today = new Date(2006, 8, 7);

  it('embeds the seal when the letterhead is on and a seal is selected', async () => {
    const withSeal = await buildSignablePdf(defaultState, today, SEAL);
    const noSeal = await buildSignablePdf(
      { ...defaultState, letterhead: { ...defaultState.letterhead, seal: 'none' } },
      today,
    );
    // The detailed 1000x1000 seal adds well over 50 KB to the PDF once embedded.
    expect(withSeal.length).toBeGreaterThan(noSeal.length + 50_000);
  });

  it('does not embed the seal when the letterhead is off, even if bytes are supplied', async () => {
    const off = await buildSignablePdf(
      { ...defaultState, letterhead: { ...defaultState.letterhead, mode: 'off' } },
      today,
      SEAL,
    );
    const offNoSeal = await buildSignablePdf(
      { ...defaultState, letterhead: { ...defaultState.letterhead, mode: 'off', seal: 'none' } },
      today,
    );
    expect(off.length).toBeLessThan(offNoSeal.length + 1000);
  });
});
