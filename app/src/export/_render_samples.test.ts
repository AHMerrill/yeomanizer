// Dev-only visual harness. `buildSignablePdf` runs in this (jsdom) test env, so we render real
// sample PDFs to disk and inspect them with the Read tool (which rasterizes PDF pages) — that's
// how we verify the vector layout without a human in the loop. Gated so normal test runs skip it:
//   GEN_PDF=1 npx vitest run src/export/_render_samples.test.ts
import { it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildSignablePdf } from './signablePdf';
import { defaultState, defaultFor } from '../defaultState';
import type { LetterState } from '../types';

const RUN = process.env.GEN_PDF === '1';
const today = new Date(2006, 8, 7);
const OUT = '/tmp/ynpdf';

const base: LetterState = {
  ...defaultState,
  ssic: '5216',
  serial: '0123',
  includeSsic: true,
  includeCode: true,
  originatorCode: 'N1',
  from: 'Commanding Officer, USS Yeoman (DDG 1000)',
  to: 'Chief of Naval Operations (N1)',
  via: [{ id: 'v1', text: 'Commander, Naval Surface Force, U.S. Pacific Fleet' }],
  subj: 'EXAMPLE NAVAL LETTER FORMAT FOR LAYOUT VERIFICATION',
  signature: { name: 'I. M. SAILOR', title: '', authority: 'none' },
  body: [
    { id: 'b1', title: 'Purpose', text: 'This letter demonstrates the underlined section-title lead-in — the title renders underlined and inline, then a period and the body wrap after it.', children: [] },
    { id: 'b2', title: 'Background', text: 'This paragraph also has a title; the body should continue past it and wrap to the left margin on the second line, per 7-2.13.', children: [] },
    { id: 'b3', text: 'This paragraph has **bold words**, *italic words*, and __underlined words__ mixed into the text to verify inline emphasis renders and wraps correctly with mixed fonts.', children: [] },
  ],
};

(RUN ? it : it.skip)('render sample PDFs to disk', async () => {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/basic.pdf`, await buildSignablePdf(base, today));

  // Long From/To/Via/Subj/Ref/Encl that must wrap — verifies hang-indent alignment per part (7-2.6–11).
  const headwrap: LetterState = {
    ...base,
    from: 'Commanding Officer, United States Ship Yeoman (DDG 1000), Naval Surface Force, U.S. Pacific Fleet, San Diego, California 92136',
    to: 'Deputy Chief of Naval Operations for Information Warfare (N2/N6), Office of the Chief of Naval Operations, 2000 Navy Pentagon, Washington DC 20350',
    via: [
      { id: 'v1', text: 'Commander, Naval Surface Force, U.S. Pacific Fleet, San Diego, California, via the established administrative chain of command' },
      { id: 'v2', text: 'Commander, U.S. Pacific Fleet' },
    ],
    subj: 'REQUEST FOR APPROVAL OF A SUBJECT LINE LONG ENOUGH TO EXCEED ONE LINE AND WRAP TO A SECOND LINE FOR ALIGNMENT VERIFICATION',
    refs: [
      { id: 'r1', text: 'SECNAV M-5216.5, Department of the Navy Correspondence Manual, of June 2015, Chapter 7, paragraphs 7-2.6 through 7-2.11' },
      { id: 'r2', text: 'OPNAVINST 5400.45A' },
    ],
    encls: [
      { id: 'en1', text: 'A supporting document whose title is long enough to wrap onto a second line for enclosure-alignment verification', inDocument: false },
    ],
    copyTo: [
      'Commander, Naval Surface Force, U.S. Pacific Fleet, San Diego, California, Attention Administrative Officer Code N01',
      'Chief of Naval Personnel',
    ],
  };
  writeFileSync(`${OUT}/headwrap.pdf`, await buildSignablePdf(headwrap, today));

  // Round-trip the long-headings sample through .json export → import, then re-render — the
  // generate → export → re-import → view-again pipeline; proves the import preserves every heading.
  const { serializeProject, parseProject } = await import('./roundtrip');
  const headwrapRT = parseProject(serializeProject(headwrap));
  if (headwrapRT) writeFileSync(`${OUT}/headwrap-roundtrip.pdf`, await buildSignablePdf(headwrapRT, today));

  const endo: LetterState = {
    ...base,
    endorsements: [
      {
        id: 'e1',
        endorser: 'Commander, Naval Surface Force, U.S. Pacific Fleet',
        serial: '',
        body: [
          { id: 'eb1', text: 'Forwarded, recommending approval.', children: [] },
          { id: 'eb2', text: 'The requested action is fully supported by this command.', children: [] },
        ],
        sigName: 'A. B. SEADOG',
        sigTitle: '',
        authority: 'by-direction',
      },
    ],
  };
  writeFileSync(`${OUT}/endorsement.pdf`, await buildSignablePdf(endo, today));

  const cui: LetterState = { ...base, cui: { ...base.cui, enabled: true } };
  writeFileSync(`${OUT}/cui.pdf`, await buildSignablePdf(cui, today));

  // CUI portion markings: paras 1 & 3 marked CUI → "(CUI)", para 2 unmarked → "(U)". Tests the mark
  // sitting before a section title and ahead of inline emphasis (must match preview + docx).
  const portions: LetterState = {
    ...base,
    cui: { ...base.cui, enabled: true },
    body: base.body.map((p, i) => (i !== 1 ? { ...p, cui: true } : p)),
  };
  writeFileSync(`${OUT}/portions.pdf`, await buildSignablePdf(portions, today));

  const longBody: LetterState = {
    ...base,
    body: Array.from({ length: 16 }, (_, i) => ({
      id: `b${i}`,
      text:
        `Paragraph ${i + 1}. ` +
        'This is filler text used to push the letter onto a second page so continuation spacing and the centered page number can be verified. '.repeat(
          3,
        ),
      children: [],
    })),
  };
  writeFileSync(`${OUT}/multipage.pdf`, await buildSignablePdf(longBody, today));

  // Enclosures: an image (embedded) and a PDF (real pages copied), each marked "Enclosure (n)".
  const pdfLib = await import('pdf-lib');
  const enclPdf = await pdfLib.PDFDocument.create();
  const ep = enclPdf.addPage([612, 792]);
  const ef = await enclPdf.embedFont(pdfLib.StandardFonts.Helvetica);
  ep.drawText('ENCLOSED PDF DOCUMENT — page 1 (copied as real vector pages)', {
    x: 72,
    y: 700,
    size: 14,
    font: ef,
  });
  const enclPdfUrl = 'data:application/pdf;base64,' + Buffer.from(await enclPdf.save()).toString('base64');
  const onePx =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';
  const encls: LetterState = {
    ...base,
    cui: { ...base.cui, enabled: true }, // verify the CUI banner reaches enclosure pages too (§6)
    encls: [
      { id: 'en1', text: 'Photograph of the event', inDocument: true, file: { name: 'photo.png', type: 'image/png', dataUrl: onePx } },
      { id: 'en2', text: 'Supporting documentation', inDocument: true, file: { name: 'doc.pdf', type: 'application/pdf', dataUrl: enclPdfUrl } },
    ],
  };
  writeFileSync(`${OUT}/enclosures.pdf`, await buildSignablePdf(encls, today));

  // Memorandum for the Record (MFR): plain paper, date-only ident, "MEMORANDUM FOR THE RECORD" title,
  // NO From/To/Via, signature = name + org code. Verifies the MFR branch (must match preview + docx + Fig 10-1).
  const mfr: LetterState = {
    ...defaultFor('mfr'),
    subj: 'TELEPHONE CONVERSATION WITH NAVSEA REGARDING CONTRACT N00024',
    signature: { name: 'E. S. HOWARD', title: 'N11', authority: 'none' },
  };
  writeFileSync(`${OUT}/mfr.pdf`, await buildSignablePdf(mfr, today));

  // ---- Word (.docx) renders of the same samples — converted to PDF via LibreOffice and read,
  // so the docx layout (seal, ident, headings, endorsements, enclosures, CUI) is verified too ----
  const { Packer } = await import('docx');
  const { buildDocxDocument } = await import('./docx');
  const seal = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC',
    'base64',
  );
  const writeDocx = async (name: string, st: LetterState) =>
    writeFileSync(`${OUT}/${name}.docx`, await Packer.toBuffer(buildDocxDocument(st, today, seal)));
  await writeDocx('basic', base);
  await writeDocx('headwrap', headwrap);
  await writeDocx('endorsement', endo);
  await writeDocx('cui', cui);
  await writeDocx('portions', portions);
  await writeDocx('mfr', mfr);
  await writeDocx('enclosures', encls);
});
