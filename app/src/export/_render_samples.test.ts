// Dev-only visual harness. `buildSignablePdf` runs in this (jsdom) test env, so we render real
// sample PDFs to disk and inspect them with the Read tool (which rasterizes PDF pages) — that's
// how we verify the vector layout without a human in the loop. Gated so normal test runs skip it:
//   GEN_PDF=1 npx vitest run src/export/_render_samples.test.ts
import { it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildSignablePdf } from './signablePdf';
import { defaultState } from '../defaultState';
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
};

(RUN ? it : it.skip)('render sample PDFs to disk', async () => {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/basic.pdf`, await buildSignablePdf(base, today));

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
  await writeDocx('endorsement', endo);
  await writeDocx('cui', cui);
  await writeDocx('enclosures', encls);
});
