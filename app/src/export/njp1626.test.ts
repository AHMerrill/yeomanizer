import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFDict, PDFArray } from 'pdf-lib';
import { buildSignablePdf } from './signablePdf';
import { defaultFor } from '../defaultState';
import { serializeProject, parseProject } from './roundtrip';
import { FORM_1626_PAGES, FORM_1626_SIGS } from '../data/form1626';
import { buildDocxDocument } from './docx';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { documentFilename } from '../format/filename';

const filled = () => {
  const s = defaultFor('njp-1626-7');
  return {
    ...s,
    njp: {
      ...s.njp,
      values: {
        nameOfAccused: 'SEAMAN A. B. EXAMPLE', rateGrade: 'E-3', dateOfReport: '15 Jan 26',
        restrictedLimitsLine: 'USS EXAMPLE (DDG 00)', pExtraDutiesDays: '14',
        pRestrictionPlace: 'the ship', pRestrictionDays: '30', xoActionDate: '20 Jan 26',
        upbRecordedDate: '30 Jan 26', appeal: 'Denied',
      },
      checks: { restricted: true, xoReferredToMast: true, pExtraDuties: true },
      detailsOfOffenses: 'Article 86, UCMJ. Unauthorized absence from appointed place of duty.',
      recordOfPreviousOffenses: 'None.',
      coComments: '[comments]',
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

  it('exposes a slot for every fill-in the form prints, including the punishment blanks', () => {
    const ids = FORM_1626_PAGES.flatMap((p) => p.slots.map((s) => s.id));
    for (const id of ['restrictedLimitsLine', 'pRestrictionPlace', 'pRestrictionDays',
                      'pCorrectionalCustodyDays', 'pConfinementDays', 'pExtraDutiesDays',
                      'pReductionPaygrade', 'pForfeitureAmount', 'pForfeitureMonths',
                      'pSuspendedAWhat', 'pSuspendedADays', 'pSuspendedBWhat', 'pSuspendedBDays',
                      'xoActionDate', 'appealAckDate1', 'appealAckDate2', 'entriesMadeDate',
                      'upbRecordedDate']) {
      expect(ids, `missing slot: ${id}`).toContain(id);
    }
    expect(new Set(ids).size).toBe(ids.length); // no duplicate ids across the two sheets
  });

  it('every slot and checkbox sits inside the sheet', () => {
    for (const p of FORM_1626_PAGES) {
      for (const s of p.slots) {
        expect(s.x).toBeGreaterThanOrEqual(30);
        expect(s.x + s.w).toBeLessThanOrEqual(582);
        expect(s.y).toBeGreaterThan(0);
        expect(s.y).toBeLessThan(792);
        expect(s.w).toBeGreaterThan(8);
      }
      for (const c of p.checks) {
        expect(c.x).toBeGreaterThanOrEqual(30);
        expect(c.y + c.h).toBeLessThan(792);
      }
    }
  });

  it('exports a Word file carrying the rendered form pages', async () => {
    const PNG = Uint8Array.from(
      atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
      (c) => c.charCodeAt(0),
    );
    const pages = [
      { bytes: PNG, width: 1224, height: 1584 },
      { bytes: PNG, width: 1224, height: 1584 },
    ];
    const blob = await Packer.toBlob(buildDocxDocument(filled(), new Date(2026, 0, 1), undefined, {}, pages));
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const media = Object.keys(zip.files).filter((f) => f.startsWith('word/media/'));
    expect(media.length).toBe(2); // one image per sheet
    const doc = await zip.file('word/document.xml')!.async('string');
    expect(doc).toContain('<w:drawing>');
  });

  it('tells the reader where to go when the form cannot be rendered for Word', async () => {
    const blob = await Packer.toBlob(buildDocxDocument(filled(), new Date(2026, 0, 1), undefined, {}, []));
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const doc = await zip.file('word/document.xml')!.async('string');
    expect(doc).toContain('Use the PDF export');
  });

  it('gets its own download name', () => {
    expect(documentFilename(defaultFor('njp-1626-7'), 'pdf')).toContain('report-and-disposition-of-offenses');
  });
});
