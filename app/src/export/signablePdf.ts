// "Signable PDF" export — generates the letter with pdf-lib (NOT the browser print path, which
// produces a flat PDF) so we can embed a real AcroForm digital-signature field (/FT /Sig). The
// recipient opens it in Adobe and clicks the field to CAC/certificate-sign — no "Prepare a Form"
// step needed. Layout here is clean/functional, not pixel-identical to Print/Save PDF; use that
// for the exact-format record copy. pdf-lib is dynamic-imported so it stays out of the initial bundle.
import type { LetterState, Paragraph } from '../types';
import { buildIdent } from '../format/identification';
import { paragraphMarker, markerText } from '../format/paragraphs';

const PT = 72; // points per inch
const PAGE_W = 8.5 * PT;
const PAGE_H = 11 * PT;
const MARGIN = 1 * PT;
const SIZE = 12; // body font size (pt)
const LEAD = SIZE * 1.15; // line leading

type Ctx = Awaited<ReturnType<typeof import('pdf-lib').PDFDocument.create>>;

export async function buildSignablePdf(state: LetterState): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb, PDFName, PDFString } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN; // cursor from the top
  const left = MARGIN;
  const right = PAGE_W - MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };
  const ensure = (need: number) => {
    if (y - need < MARGIN) newPage();
  };
  const wrap = (text: string, f: typeof font, size: number, maxW: number): string[] => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const trial = line ? line + ' ' + w : w;
      if (f.widthOfTextAtSize(trial, size) > maxW && line) {
        lines.push(line);
        line = w;
      } else line = trial;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  };
  const draw = (
    text: string,
    x: number,
    f: typeof font = font,
    size = SIZE,
    color = rgb(0, 0, 0),
  ) => {
    ensure(LEAD);
    y -= size;
    page.drawText(text, { x, y, font: f, size, color });
    y -= LEAD - size;
  };
  const gap = (h = LEAD) => {
    y -= h;
  };

  // ---- Letterhead (centered) ----
  const navy = rgb(0, 0.17, 0.47);
  const lh = state.letterhead;
  if (lh.mode === 'on') {
    const center = (text: string, f: typeof font, size: number) => {
      ensure(size + 2);
      y -= size;
      const w = f.widthOfTextAtSize(text, size);
      page.drawText(text, { x: (PAGE_W - w) / 2, y, font: f, size, color: navy });
      y -= 2;
    };
    center(lh.line1 || 'DEPARTMENT OF THE NAVY', bold, 11);
    [lh.activityName, lh.addressLine, lh.cityStateZip].filter(Boolean).forEach((l) =>
      center(l.toUpperCase(), bold, 8),
    );
    gap(LEAD);
  }

  // ---- Identification block (right-aligned: SSIC / code / date) ----
  const ident = buildIdent(state);
  const idLines = [
    state.includeSsic ? state.ssic : '',
    state.includeCode ? ident.codeLine : '',
    ident.date,
  ].filter(Boolean);
  if (idLines.length) {
    idLines.forEach((l) => {
      ensure(LEAD);
      y -= SIZE;
      const w = font.widthOfTextAtSize(l, SIZE);
      page.drawText(l, { x: right - w, y, font, size: SIZE });
      y -= LEAD - SIZE;
    });
    gap(LEAD);
  }

  // ---- Heading block (From/To/Via/Subj/Ref/Encl) ----
  const labelX = left;
  const valX = left + 0.6 * PT * 1.0 + 36; // a tab stop for values
  const headRow = (label: string, value: string) => {
    ensure(LEAD);
    y -= SIZE;
    page.drawText(label, { x: labelX, y, font, size: SIZE });
    const lines = wrap(value, font, SIZE, right - valX);
    page.drawText(lines[0] ?? '', { x: valX, y, font, size: SIZE });
    y -= LEAD - SIZE;
    lines.slice(1).forEach((ln) => draw(ln, valX));
  };
  if (state.from) headRow('From:', state.from);
  if (state.to) headRow('To:', state.to);
  state.via.filter((v) => v.text.trim()).forEach((v, i, arr) =>
    headRow(i === 0 ? 'Via:' : '', arr.length > 1 ? `(${i + 1}) ${v.text}` : v.text),
  );
  gap(LEAD);
  if (state.subj) headRow('Subj:', state.subj.toUpperCase());
  state.refs.filter((r) => r.text.trim()).forEach((r, i) =>
    headRow(i === 0 ? 'Ref:' : '', `(${String.fromCharCode(97 + i)}) ${r.text}`),
  );
  state.encls.filter((e) => e.text.trim()).forEach((e, i) =>
    headRow(i === 0 ? 'Encl:' : '', `(${i + 1}) ${e.text}`),
  );
  gap(LEAD);

  // ---- Body (numbered paragraphs) ----
  const drawBody = (list: Paragraph[], depth: number) => {
    list.forEach((p, i) => {
      const marker = markerText(paragraphMarker(depth, i));
      const indent = depth * 0.25 * PT * 1.0;
      const x = left + indent;
      const prefix = marker + '  ';
      const prefixW = font.widthOfTextAtSize(prefix, SIZE);
      const lines = wrap(p.text, font, SIZE, right - x - prefixW);
      lines.forEach((ln, li) => {
        ensure(LEAD);
        y -= SIZE;
        if (li === 0) page.drawText(prefix, { x, y, font, size: SIZE });
        page.drawText(ln, { x: x + prefixW, y, font, size: SIZE });
        y -= LEAD - SIZE;
      });
      gap(LEAD * 0.6);
      if (p.children.length) drawBody(p.children, depth + 1);
    });
  };
  drawBody(state.body, 0);

  // ---- Signature block + the digital signature field ----
  gap(LEAD * 2);
  const sigX = left + 3.25 * PT;
  ensure(LEAD * 3);
  // place the clickable signature field just ABOVE the typed name
  const fieldH = 28;
  const fieldW = 216;
  const fieldBottom = y - 4;
  const fieldTop = fieldBottom + fieldH;
  // typed name under the field
  y = fieldBottom - 4;
  if (state.signature.name) draw(state.signature.name, sigX, font);
  if (state.signature.title) draw(state.signature.title, sigX, font);
  if (state.signature.authority === 'by-direction') draw('By direction', sigX, font);
  if (state.signature.authority === 'acting') draw('Acting', sigX, font);

  addSignatureField(doc, page, [sigX, fieldBottom, sigX + fieldW, fieldTop], PDFName, PDFString);

  return await doc.save();
}

export async function exportSignablePdf(state: LetterState): Promise<void> {
  download(await buildSignablePdf(state), 'naval-letter-signable.pdf');
}

// Construct an AcroForm digital-signature field (/FT /Sig) + its widget annotation, so Adobe
// shows a clickable "click to sign" box that hands off to the CAC/certificate signing flow.
function addSignatureField(
  doc: Ctx,
  page: ReturnType<Ctx['addPage']>,
  rect: [number, number, number, number],
  PDFName: typeof import('pdf-lib').PDFName,
  PDFString: typeof import('pdf-lib').PDFString,
): void {
  const widget = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    T: PDFString.of('Signature1'),
    F: 4, // Print
    Rect: rect,
    P: page.ref,
  });
  const widgetRef = doc.context.register(widget);
  page.node.set(PDFName.of('Annots'), doc.context.obj([widgetRef]));
  const acroForm = doc.context.obj({
    Fields: [widgetRef],
    SigFlags: 3, // SignaturesExist (1) + AppendOnly (2)
  });
  doc.catalog.set(PDFName.of('AcroForm'), doc.context.register(acroForm));
}

function download(bytes: Uint8Array, name: string): void {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
