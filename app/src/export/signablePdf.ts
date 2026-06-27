// "CAC-signable PDF" — generates the letter with pdf-lib (the browser print path makes a flat
// PDF with no form field) so we can embed a real AcroForm digital-signature field (/FT /Sig).
// Open in Adobe, click the field, CAC/certificate-sign — no "Prepare a Form" step. The field has
// no visible border, so it's invisible when printed on paper.
//
// Layout is driven off the SAME numbers as the on-screen CSS (preview.css / paragraphs.ts) so it
// matches by construction. Vertical typography (baseline within each line box) is an approximation
// that may need fine-tuning against the live preview. Deferred (rendered as TODO, tracked):
// CUI banners/designation, endorsements, in-document enclosures, continuation-page Subj repeat.
import type { LetterState, Paragraph } from '../types';
import {
  buildIdent,
  ENDORSE_ORD,
  basicLetterId,
  remainingVias,
} from '../format/identification';
import { paragraphMarker, markerText, depthIndentIn } from '../format/paragraphs';
import { loadSealBytes } from './docx';

const PT = 72;
const PAGE_W = 8.5 * PT;
const PAGE_H = 11 * PT;
const M_TOP = 0.5 * PT; // .page padding-top
const M_SIDE = 1 * PT;
const M_BOT = 1 * PT;
const LEFT = M_SIDE;
const RIGHT = PAGE_W - M_SIDE;
const SIZE = 12; // body pt
const BODY_LH = 1.14; // .page line-height
const PARA_GAP = 11.5; // --para-gap
const LABEL_COL = 0.52 * PT; // --label-col
const MARKER_COL = 0.34 * PT; // --marker-col
const PGAP = 0.09 * PT; // .pgap (gap after a body marker)
const NAVY: [number, number, number] = [0, 0x2c / 0xff, 0x77 / 0xff];

// Times metrics: ~0.891 ascent, ~1.107 total height. Baseline distance from the top of a line box.
const baselineDrop = (size: number, lh: number) => (size * lh - size * 1.107) / 2 + size * 0.891;

type PdfFont = Awaited<ReturnType<Awaited<ReturnType<typeof import('pdf-lib').PDFDocument.create>>['embedFont']>>;
type Ctx = Awaited<ReturnType<typeof import('pdf-lib').PDFDocument.create>>;

export async function buildSignablePdf(state: LetterState, today: Date = new Date()): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb, PDFName, PDFString } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const black = rgb(0, 0, 0);
  const navy = rgb(...NAVY);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let top = M_TOP; // distance from the page's top edge to the next content
  const sigRefs: ReturnType<typeof doc.context.register>[] = []; // collected into one AcroForm at the end
  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    top = M_BOT; // continuation/subsequent pages use the 1-inch top margin (7-2.16)
  };
  const room = (need: number) => {
    if (PAGE_H - top - need < M_BOT) newPage();
  };
  const wrap = (text: string, f: PdfFont, size: number, maxW: number): string[] => {
    const out: string[] = [];
    let line = '';
    for (const w of text.split(/\s+/)) {
      const trial = line ? line + ' ' + w : w;
      if (line && f.widthOfTextAtSize(trial, size) > maxW) {
        out.push(line);
        line = w;
      } else line = trial;
    }
    if (line) out.push(line);
    return out.length ? out : [''];
  };
  // draw one line of text at x; advance the cursor by the line's height
  const put = (text: string, x: number, f = font, size = SIZE, lh = BODY_LH, color = black) => {
    room(size * lh);
    page.drawText(text, { x, y: PAGE_H - top - baselineDrop(size, lh), font: f, size, color });
    top += size * lh;
  };
  const putCenter = (text: string, f: PdfFont, size: number, lh: number, color = black) => {
    const x = (PAGE_W - f.widthOfTextAtSize(text, size)) / 2;
    put(text, x, f, size, lh, color);
  };
  const gap = (h: number) => {
    top += h;
  };

  const lh = state.letterhead;

  // ---- Seal (1in, at left 0.62in / top 0.5in), aspect-fit like object-fit: contain ----
  if (lh.mode === 'on' && lh.seal !== 'none') {
    const bytes = await loadSealBytes(state);
    if (bytes) {
      const img = await doc.embedPng(bytes);
      const s = PT / Math.max(img.width, img.height);
      const w = img.width * s;
      const h = img.height * s;
      page.drawImage(img, {
        x: 0.62 * PT + (PT - w) / 2,
        y: PAGE_H - 0.5 * PT - PT + (PT - h) / 2,
        width: w,
        height: h,
      });
    }
  }

  // ---- Letterhead (centered, navy). Reserve the .letterhead min-height (0.86in) so the ident +
  // headings start at the right spot regardless of how many letterhead/ident lines there are. ----
  if (lh.mode === 'on') {
    putCenter(lh.line1 || 'DEPARTMENT OF THE NAVY', bold, 11, 1.04, navy);
    [lh.activityName, lh.addressLine, lh.cityStateZip]
      .filter(Boolean)
      .forEach((l) => putCenter(l.toUpperCase(), bold, 7.5, 1.04, navy));
    top = Math.max(top, M_TOP + 0.86 * PT); // .letterhead min-height
    gap(0.16 * PT); // .ident margin-top
  } else if (lh.mode === 'preprinted') {
    top = M_TOP + 0.9 * PT; // reserve the physical letterhead's space (.lh-spacer)
  } else {
    top = M_TOP + 0.5 * PT; // plain paper: .ident.no-letterhead margin-top
  }

  // ---- Identification block: lines left-aligned within a right-positioned block ----
  const ident = buildIdent(state, today);
  const idLines = [
    state.includeSsic ? state.ssic : '',
    state.includeCode ? ident.codeLine : '',
    ident.date,
  ].filter(Boolean);
  if (idLines.length) {
    const blockW = Math.max(...idLines.map((l) => font.widthOfTextAtSize(l, SIZE)));
    const idX = RIGHT - blockW;
    idLines.forEach((l) => put(l, idX));
  }

  // ---- Heading block (From/To/Via/Subj/Ref/Encl) ----
  gap(0.3 * PT - PARA_GAP < 0 ? 0.14 * PT : 0.3 * PT); // .headings margin-top (~0.3in from ident)
  const headRow = (label: string, value: string, valIndent = 0) => {
    const vx = LEFT + LABEL_COL + valIndent;
    const lines = wrap(value, font, SIZE, RIGHT - vx);
    room(SIZE * BODY_LH);
    const yTop = top;
    if (label) page.drawText(label, { x: LEFT, y: PAGE_H - yTop - baselineDrop(SIZE, BODY_LH), font, size: SIZE });
    put(lines[0] ?? '', vx);
    lines.slice(1).forEach((ln) => put(ln, LEFT)); // continuation returns to the left margin
  };
  if (state.from) headRow('From:', state.from);
  if (state.to) headRow('To:', state.to);
  const vias = state.via.filter((v) => v.text.trim());
  vias.forEach((v, i) =>
    headRow(i === 0 ? 'Via:' : '', vias.length > 1 ? `(${i + 1}) ${v.text}` : v.text),
  );
  if (state.subj) {
    gap(PARA_GAP);
    headRow('Subj:', state.subj.toUpperCase());
  }
  const refs = state.refs.filter((r) => r.text.trim());
  refs.forEach((r, i) => {
    if (i === 0) gap(PARA_GAP);
    headRow(i === 0 ? 'Ref:' : '', `(${String.fromCharCode(97 + i)})  ${r.text}`, MARKER_COL - 0.34 * PT);
  });
  const encls = state.encls.filter((e) => e.text.trim());
  encls.forEach((e, i) => {
    if (i === 0) gap(PARA_GAP);
    headRow(i === 0 ? 'Encl:' : '', `(${i + 1})  ${e.text}`);
  });

  // ---- Body (numbered paragraphs; first line indented, continuation at the left margin) ----
  gap(PARA_GAP);
  const drawBody = (list: Paragraph[], depth: number) => {
    list.forEach((p, i) => {
      const marker = markerText(paragraphMarker(depth, i));
      const indent = depthIndentIn(depth) * PT;
      const markerX = LEFT + indent;
      const textX = markerX + font.widthOfTextAtSize(marker, SIZE) + PGAP;
      const lines = wrap(p.text, font, SIZE, RIGHT - textX);
      lines.forEach((ln, li) => {
        room(SIZE * BODY_LH);
        const yTop = top;
        if (li === 0)
          page.drawText(marker, { x: markerX, y: PAGE_H - yTop - baselineDrop(SIZE, BODY_LH), font, size: SIZE });
        // continuation lines return to the left margin (7-2.13)
        put(ln, li === 0 ? textX : LEFT);
      });
      gap(PARA_GAP);
      if (p.children.length) drawBody(p.children, depth + 1);
    });
  };
  // ---- Signature block (page center, left edge 3.25in past the margin). Reusable so each
  // endorsement gets its own block + CAC field; all fields share one AcroForm built at the end. ----
  const sigX = LEFT + 3.25 * PT;
  const signatureBlock = (name: string, title: string, authority: string | undefined, fieldName: string) => {
    gap(PARA_GAP * 2.6 - PARA_GAP);
    room(SIZE * BODY_LH * 4);
    const fieldTopY = PAGE_H - top - 2; // the clickable field sits just above the typed name
    const fieldH = 30;
    top += fieldH;
    if (name) put(name, sigX);
    if (title) put(title, sigX);
    if (authority === 'by-direction') put('By direction', sigX);
    if (authority === 'acting') put('Acting', sigX);
    sigRefs.push(
      addSignatureField(doc, page, [sigX, fieldTopY - fieldH, sigX + 3 * PT, fieldTopY], fieldName, PDFName, PDFString),
    );
  };

  drawBody(state.body, 0);
  signatureBlock(state.signature.name, state.signature.title, state.signature.authority, 'Signature1');

  // ---- Copy to ----
  const copyTo = state.copyTo.filter((c) => c.trim());
  if (copyTo.length) {
    gap(PARA_GAP);
    put('Copy to:', LEFT);
    copyTo.forEach((c) => put(c, LEFT));
  }

  // ---- Endorsements — each on its own page with its own signature block + CAC field (Ch 9) ----
  const onBasic = `ENDORSEMENT on ${basicLetterId(state, today)}`;
  state.endorsements.forEach((e, i) => {
    newPage();
    wrap(`${ENDORSE_ORD[i] ?? String(i + 1)} ${onBasic}`, font, SIZE, RIGHT - LEFT).forEach((ln) =>
      put(ln, LEFT),
    );
    gap(PARA_GAP);
    if (e.endorser) headRow('From:', e.endorser);
    if (state.to) headRow('To:', state.to);
    const evias = remainingVias(state, e.viaId); // Ch 9-2.2: remaining Via addressees
    if (evias.length === 1) headRow('Via:', evias[0].text);
    else if (evias.length >= 2)
      evias.forEach((v, k) => headRow(k === 0 ? 'Via:' : '', `(${k + 1}) ${v.text}`));
    if (state.subj) {
      gap(PARA_GAP);
      headRow('Subj:', state.subj.toUpperCase());
    }
    gap(PARA_GAP);
    drawBody(e.body, 0);
    signatureBlock(e.sigName, e.sigTitle, e.authority, `Signature${i + 2}`);
  });

  // ---- CUI banners (every page, top + bottom) + designation block (page 1, lower-right) ----
  const cui = state.cui;
  const pages = doc.getPages();
  if (cui.enabled) {
    const banner = (cui.banner || 'CUI').toUpperCase();
    const bw = bold.widthOfTextAtSize(banner, 12);
    pages.forEach((pg) => {
      pg.drawText(banner, { x: (PAGE_W - bw) / 2, y: PAGE_H - 0.22 * PT - 10.7, size: 12, font: bold });
      pg.drawText(banner, { x: (PAGE_W - bw) / 2, y: 0.22 * PT + 2.6, size: 12, font: bold });
    });
    const desig = [
      `Controlled by: ${cui.controlledBy1}`,
      cui.controlledBy2 ? `Controlled by: ${cui.controlledBy2}` : '',
      `CUI Category: ${cui.category}`,
      `Limited Dissemination Control: ${cui.dissemination}`,
      cui.poc ? `POC: ${cui.poc}` : '',
    ].filter(Boolean);
    const dW = Math.max(...desig.map((l) => font.widthOfTextAtSize(l, 8)));
    desig.forEach((l, i) =>
      pages[0].drawText(l, { x: RIGHT - dW, y: 0.46 * PT + (desig.length - 1 - i) * 10, size: 8, font }),
    );
  }

  // ---- Page numbers — centered, 0.5in from the bottom, page 2 onward (7-2.17) ----
  if (pages.length > 1) {
    pages.forEach((pg, i) => {
      if (i === 0) return;
      const num = String(i + 1);
      pg.drawText(num, { x: (PAGE_W - font.widthOfTextAtSize(num, SIZE)) / 2, y: 0.5 * PT, size: SIZE, font });
    });
  }

  // ---- One AcroForm holding every signature field (basic letter + each endorsement) ----
  if (sigRefs.length) {
    const acroForm = doc.context.obj({ Fields: sigRefs, SigFlags: 3 });
    doc.catalog.set(PDFName.of('AcroForm'), doc.context.register(acroForm));
  }

  return await doc.save();
}

export async function exportSignablePdf(state: LetterState, today: Date = new Date()): Promise<void> {
  download(await buildSignablePdf(state, today), 'naval-letter-signable.pdf');
}

// Construct an AcroForm digital-signature field (/FT /Sig) + a borderless widget annotation, so
// Adobe shows a clickable "click to sign" box that hands off to the CAC/certificate signing flow.
// Build one borderless /FT /Sig widget, attach it to the page's Annots, and return its ref so the
// caller can collect every field into a single AcroForm (one AcroForm per call clobbers the others).
function addSignatureField(
  doc: Ctx,
  page: ReturnType<Ctx['addPage']>,
  rect: [number, number, number, number],
  name: string,
  PDFName: typeof import('pdf-lib').PDFName,
  PDFString: typeof import('pdf-lib').PDFString,
): ReturnType<Ctx['context']['register']> {
  const widget = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    T: PDFString.of(name),
    F: 4, // Print
    Rect: rect,
    P: page.ref,
  });
  const widgetRef = doc.context.register(widget);
  const annots = page.node.Annots();
  if (annots) annots.push(widgetRef);
  else page.node.set(PDFName.of('Annots'), doc.context.obj([widgetRef]));
  return widgetRef;
}

function download(bytes: Uint8Array, name: string): void {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
