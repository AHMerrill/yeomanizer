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

  // CUI on a MULTI-PAGE letter: the designation block stays on page 1 (lower-right) and must NOT
  // overlap the body; the banner repeats top+bottom on every page.
  const cuiLong: LetterState = {
    ...base,
    cui: { ...base.cui, enabled: true, controlledBy1: 'Department of the Navy', category: 'PRVCY', poc: 'CDR J. Doe, 703-555-5555' },
    body: Array.from({ length: 16 }, (_, i) => ({
      id: `cl${i}`,
      text:
        `Paragraph ${i + 1}. ` +
        'Filler text to push the CUI letter onto a second page so the designation-block placement can be verified against the body. '.repeat(3),
      children: [],
    })),
  };
  writeFileSync(`${OUT}/cui-multipage.pdf`, await buildSignablePdf(cuiLong, today));

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
    // Per-enclosure CUI: the letter is CUI//PRVCY; enclosure 1 OVERRIDES to CUI//SP-PROPIN; enclosure 2
    // inherits the letter banner. Verifies the banner is applied per-page (PDF) / per-section (docx),
    // so a package of mixed-category enclosures is marked correctly (§6 + DoDI 5200.48).
    cui: { ...base.cui, enabled: true, banner: 'CUI//PRVCY', transmittalNote: 'When separated from its enclosures, this document is UNCONTROLLED.' },
    encls: [
      { id: 'en1', text: 'Photograph of the event', inDocument: true, cuiBanner: 'CUI//SP-PROPIN', file: { name: 'photo.png', type: 'image/png', dataUrl: onePx } },
      { id: 'en2', text: 'Supporting documentation', inDocument: true, file: { name: 'doc.pdf', type: 'application/pdf', dataUrl: enclPdfUrl } },
    ],
  };
  writeFileSync(`${OUT}/enclosures.pdf`, await buildSignablePdf(encls, today));
  // Round-trip the CUI package (.json export → import → re-render) — proves per-enclosure banners survive.
  const enclsRT = parseProject(serializeProject(encls));
  if (enclsRT) writeFileSync(`${OUT}/enclosures-roundtrip.pdf`, await buildSignablePdf(enclsRT, today));

  // Memorandum for the Record (MFR): plain paper, date-only ident, "MEMORANDUM FOR THE RECORD" title,
  // NO From/To/Via, signature = name + org code. Verifies the MFR branch (must match preview + docx + Fig 10-1).
  const mfr: LetterState = {
    ...defaultFor('mfr'),
    subj: 'TELEPHONE CONVERSATION WITH NAVSEA REGARDING CONTRACT N00024',
    signature: { name: 'E. S. HOWARD', title: 'N11', authority: 'none' },
  };
  writeFileSync(`${OUT}/mfr.pdf`, await buildSignablePdf(mfr, today));

  // Memorandum (Ch 10, From-To): plain bond, date-only ident (right, ~6th line), "MEMORANDUM" at the
  // left margin, then From/To/Subj and numbered paragraphs; signature centered. Verifies the memo branch.
  const memo: LetterState = {
    ...defaultFor('memo-from-to'),
    from: 'Director, Logistics (N4)',
    to: 'All Department Heads',
    subj: 'PARKING DURING THE PIER REPAIR',
    signature: { name: 'R. T. KEEL', title: 'N4', authority: 'none' },
  };
  writeFileSync(`${OUT}/memo.pdf`, await buildSignablePdf(memo, today));

  // Business letter (Ch 11): letterhead, LEFT identification block, inside address + salutation,
  // civilian date, unnumbered main paragraphs, centered "Sincerely," + signature, end-of-letter
  // Enclosures + Separate Mailing. Verifies the business branch (must match preview + docx + Fig 11-2).
  const business: LetterState = {
    ...defaultFor('business-letter'),
    letterhead: {
      line1: 'DEPARTMENT OF THE NAVY',
      activityName: 'USS NEW HAMPSHIRE (SSN 778)',
      addressLine: '',
      cityStateZip: 'FPO AE 09579-2305',
      seal: 'dod',
      replyRefPrinted: false,
      mode: 'on',
      preprintedLines: 4,
    },
    signature: { name: 'E. SCOTT HOWARD', title: 'Executive Officer', authority: 'by-direction' },
    encls: [
      { id: 'be1', text: 'Sample Business Letter' },
      { id: 'be2', text: 'SECNAV M-5216.5' },
    ],
    business: { ...defaultFor('business-letter').business, separateMailing: 'Secretarial Handbook' },
  };
  writeFileSync(`${OUT}/business.pdf`, await buildSignablePdf(business, today));

  // Multiple-address letter (Ch 8): To: line with three addressees (Fig 8-1) and, separately, a
  // Distribution: block with copy counts and no To: line (Fig 8-2). Verifies stacked To: addressees
  // and the Distribution: block (after the signature, above Copy to:) across PDF + docx + preview.
  const multiTo: LetterState = {
    ...base,
    from: 'Commander, Submarine Group TWO',
    to: 'Commander, Submarine Squadron TWO',
    toAddrs: [
      { id: 'ta1', text: 'Commander, Submarine Squadron FOUR' },
      { id: 'ta2', text: 'Commander, Submarine Squadron TWELVE' },
    ],
    via: [],
    subj: 'MULTIPLE-ADDRESS LETTER USING A TO: LINE',
    copyTo: ['COMNAVSEASYSCOM (SEA-06)'],
  };
  writeFileSync(`${OUT}/multi-address-to.pdf`, await buildSignablePdf(multiTo, today));

  const multiDist: LetterState = {
    ...base,
    from: 'Commander, Submarine Group TWO',
    to: '',
    toAddrs: [],
    via: [],
    subj: 'MULTIPLE-ADDRESS LETTER USING A DISTRIBUTION: LINE',
    distribution: [
      { id: 'd1', text: 'COMSUBFOR NORFOLK (4 copies)' },
      { id: 'd2', text: 'USS ENTERPRISE' },
      { id: 'd3', text: 'USS SCRANTON' },
      { id: 'd4', text: 'USS FRANK CABLE' },
    ],
    copyTo: ['COMNAVSEASYSCOM (SEA-06)'],
  };
  writeFileSync(`${OUT}/multi-address-dist.pdf`, await buildSignablePdf(multiDist, today));

  // Memorandum of Agreement (Ch 10, fig 10-5): plain bond, date-only ident, centered title + BETWEEN
  // the two activities (senior first), dual signatures with the senior (party A) at the RIGHT.
  const moa: LetterState = {
    ...defaultFor('moa'),
    signature: { name: 'K. O. ALLISON', title: 'Deputy', authority: 'none' },
    moa: {
      ...defaultFor('moa').moa, // keeps the dual-ident fields (short titles, party B SSIC/serial/date)
      partyA: 'COMMANDER, NAVAL AIR SYSTEMS COMMAND',
      partyB: 'COMMANDER, NAVAL INTELLIGENCE COMMAND',
      signerB: { name: 'M. L. SIMPSON', title: 'Acting', authority: 'none' },
    },
  };
  writeFileSync(`${OUT}/moa.pdf`, await buildSignablePdf(moa, today));

  // Joint letter (Ch 7, fig 7-4): multi-command letterhead, per-command identification columns (senior
  // right), JOINT LETTER title, a From per command, dual signatures (senior right).
  const joint: LetterState = { ...defaultFor('joint-letter') };
  writeFileSync(`${OUT}/joint.pdf`, await buildSignablePdf(joint, today));

  // Deep paragraph nesting (fig 7-8): 6 levels so the underline-at-level-5 markers are exercised
  // (levels 5-8 underline the digit/letter to distinguish the second 1./a./(1)/(a) cycle).
  const deepnest: LetterState = {
    ...base,
    subj: 'DEEP PARAGRAPH NESTING',
    body: [
      { id: 'd0', text: 'Level one (depth 0): marker "1." — not underlined.', children: [
        { id: 'd1', text: 'Level two (depth 1): marker "a.".', children: [
          { id: 'd2', text: 'Level three (depth 2): marker "(1)".', children: [
            { id: 'd3', text: 'Level four (depth 3): marker "(a)".', children: [
              { id: 'd4', text: 'Level five (depth 4): marker "1." with the digit UNDERLINED.', children: [
                { id: 'd5', text: 'Level six (depth 5): marker "a." with the letter underlined.', children: [] },
              ] },
            ] },
          ] },
        ] },
      ] },
    ],
  };
  writeFileSync(`${OUT}/deepnest.pdf`, await buildSignablePdf(deepnest, today));

  // Executive memorandum (Ch 12, fig 12-9 Action Memo): ACTION MEMO title, FOR:/FROM:/SUBJECT:,
  // bulleted body, RECOMMENDATION + Approve/Disapprove, COORDINATION, Attachments, Prepared by.
  const execMemo: LetterState = { ...defaultFor('exec-memo') };
  writeFileSync(`${OUT}/exec-memo.pdf`, await buildSignablePdf(execMemo, today));
  const execInfo: LetterState = {
    ...defaultFor('exec-memo'),
    subj: 'Info Memo Format',
    execMemo: { ...defaultFor('exec-memo').execMemo, kind: 'INFORMATION' },
  };
  writeFileSync(`${OUT}/exec-info.pdf`, await buildSignablePdf(execInfo, today));
  // Plain "Memorandum For" (fig 12-14): MEMORANDUM FOR addressing, indented paragraphs, centered signature.
  const execMemoFor: LetterState = {
    ...defaultFor('exec-memo'),
    to: 'SECRETARY OF DEFENSE',
    subj: 'Preparing a Memorandum for the Office of the Secretary of Defense',
    signature: { name: 'Richard V. Spencer', title: '', authority: 'none' },
    execMemo: { ...defaultFor('exec-memo').execMemo, kind: 'MEMORANDUM-FOR', cc: 'General Counsel' },
    body: [
      {
        id: 'mf1',
        text: 'Use memoranda for correspondence within the Department of Defense, to the President and White House staff, and to send routine correspondence to other Federal Agencies.',
        children: [],
      },
      {
        id: 'mf2',
        text: 'Prepare memos on letterhead appropriate to the signing official. Indent paragraphs a half-inch and double-space between them.',
        children: [],
      },
    ],
  };
  writeFileSync(`${OUT}/exec-memofor.pdf`, await buildSignablePdf(execMemoFor, today));
  // Coordination page (fig 12-13): plain bond, a centered title over a concurrence table.
  const coordPage: LetterState = { ...defaultFor('coordination-page') };
  writeFileSync(`${OUT}/coord-page.pdf`, await buildSignablePdf(coordPage, today));

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
  await writeDocx('memo', memo);
  await writeDocx('enclosures', encls);
  await writeDocx('business', business);
  await writeDocx('multipage', longBody); // multi-page: verifies the repeated Subj header + page numbers
  await writeDocx('exec-memo', execMemo); // Ch 12 Action Memo — title, FOR/FROM/SUBJECT, bullets, decision
  await writeDocx('exec-memofor', execMemoFor); // Ch 12 Memorandum For — addressing, indented, centered sig
  await writeDocx('coord-page', coordPage); // Ch 12 Coordination Page — title + concurrence table
  await writeDocx('multi-address-to', multiTo);
  await writeDocx('multi-address-dist', multiDist);
  await writeDocx('moa', moa);
  await writeDocx('joint', joint);
});
