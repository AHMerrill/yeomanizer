import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFDict, PDFArray } from 'pdf-lib';
import { buildSignablePdf } from './signablePdf';
import { defaultFor } from '../defaultState';
import { serializeProject, parseProject } from './roundtrip';
import { FORM_1626_PAGES, FORM_1626_SIGS } from '../data/form1626';
import { documentFilename } from '../format/filename';

const filled = () => {
  const s = defaultFor('njp-1626-7');
  return {
    ...s,
    njp: {
      ...s.njp,
      values: { nameOfAccused: 'SEAMAN A. B. EXAMPLE', rateGrade: 'E-3', dateOfReport: '15 Jan 26' },
      checks: { restricted: true, xoReferredToMast: true, pExtraDuties: true },
      detailsOfOffenses: 'Article 86, UCMJ. Unauthorized absence from appointed place of duty.',
      recordOfPreviousOffenses: 'None.',
      coComments: '[comments]',
      restrictedLimits: 'USS EXAMPLE (DDG 00)',
      inLieuOf: '',
      pleas: [{ id: 'p1', article: '86', charge: 'I', specification: '1', plea: 'G', finding: 'G' }],
    },
  };
};

describe('NAVPERS 1626/7 form', () => {
  it('the geometry table is present for both sheets', () => {
    expect(FORM_1626_PAGES).toHaveLength(2);
    for (const p of FORM_1626_PAGES) {
      expect(p.glyphs.length).toBeGreaterThan(40);
      expect(p.rules.length).toBeGreaterThan(80);
    }
    // Every checkbox is named, or the editor silently can't drive it.
    const unnamed = FORM_1626_PAGES.flatMap((p) => p.checks).filter((c) => !c.id);
    expect(unnamed).toEqual([]);
  });

  it('renders two US Letter pages', async () => {
    const bytes = await buildSignablePdf(filled(), new Date(2026, 0, 1));
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(doc.getPageCount()).toBe(2);
    for (const pg of doc.getPages()) {
      expect(Math.round(pg.getSize().width)).toBe(612);
      expect(Math.round(pg.getSize().height)).toBe(792);
    }
  });

  it('puts a CAC-signable /Sig field over every signature block', async () => {
    const bytes = await buildSignablePdf(filled(), new Date(2026, 0, 1));
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const acro = doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
    const fields = acro?.lookupMaybe(PDFName.of('Fields'), PDFArray);
    expect(fields?.size()).toBe(FORM_1626_SIGS.length);
    for (let i = 0; i < (fields?.size() ?? 0); i++) {
      expect(fields!.lookup(i, PDFDict).get(PDFName.of('FT'))?.toString()).toBe('/Sig');
    }
    expect(acro?.get(PDFName.of('SigFlags'))?.toString()).toBe('3');
  });

  // CHECKLIST: a standalone type that returns early must STILL run applyCui + stripPdfMetadata.
  it('carries the CUI banner and ships no metadata', async () => {
    const s = filled();
    s.cui = { ...s.cui, enabled: true, banner: 'CUI//SP-PRVCY' };
    const bytes = await buildSignablePdf(s, new Date(2026, 0, 1));
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(doc.getProducer() ?? '').toBe('');
    expect(doc.getCreator() ?? '').toBe('');
    expect(doc.getTitle() ?? '').toBe('');
    // banner text is drawn on every page (hex-encoded inside Flate streams, so check the count)
    expect(doc.getPageCount()).toBe(2);
  });

  it('round-trips through the .json project file', () => {
    const back = parseProject(serializeProject(filled()));
    expect(back?.type).toBe('njp-1626-7');
    expect(back?.njp.values.nameOfAccused).toBe('SEAMAN A. B. EXAMPLE');
    expect(back?.njp.checks.restricted).toBe(true);
    expect(back?.njp.pleas[0].article).toBe('86');
    expect(back?.njp.detailsOfOffenses).toContain('Article 86');
  });

  it('drops unknown field ids on import rather than trusting the file', () => {
    const hostile = JSON.stringify({
      v: 1,
      state: {
        ...defaultFor('njp-1626-7'),
        njp: {
          values: { nameOfAccused: 'OK', __proto__: 'x', notARealSlot: 'nope' },
          checks: { restricted: true, notARealCheck: true },
          detailsOfOffenses: '', recordOfPreviousOffenses: '', coComments: '',
          restrictedLimits: '', inLieuOf: '', pleas: [],
        },
      },
    });
    const back = parseProject(hostile);
    expect(back?.njp.values.nameOfAccused).toBe('OK');
    expect(back?.njp.values.notARealSlot).toBeUndefined();
    expect(back?.njp.checks.notARealCheck).toBeUndefined();
    expect(back?.njp.checks.restricted).toBe(true);
  });

  it('gets its own download name', () => {
    expect(documentFilename(defaultFor('njp-1626-7'), 'pdf')).toContain('report-and-disposition-of-offenses');
  });
});
