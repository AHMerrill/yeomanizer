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
import { parseInline } from '../format/inline';
import { anyCui } from '../format/tree';
import { documentFilename } from '../format/filename';
import { loadSealBytes } from './docx';
import { stripPdfMetadata } from './pdfMeta';

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
  const italicFont = await doc.embedFont(StandardFonts.TimesRomanItalic);
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
    [...lh.activityName.split('\n'), lh.addressLine, lh.cityStateZip]
      .filter((l) => l.trim())
      .forEach((l) => putCenter(l.toUpperCase(), bold, 7.5, 1.04, navy));
    top = Math.max(top, M_TOP + 0.86 * PT); // .letterhead min-height
    gap(0.16 * PT); // .ident margin-top
  } else if (lh.mode === 'preprinted') {
    // Reserve the same space a rendered N-line letterhead would (~0.11in/line) with the same 0.86in
    // floor + 0.16in ident gap as 'on' mode, so both modes shift the ident at the same threshold —
    // a short letterhead leaves the ident at its normal spot; only a tall one drops it (.lh-spacer).
    top = M_TOP + (Math.max(0.86, lh.preprintedLines * 0.11) + 0.16) * PT;
  } else {
    top = M_TOP + 0.5 * PT; // plain paper: .ident.no-letterhead margin-top
  }

  // ---- Identification block: lines left-aligned within a right-positioned block ----
  const ident = buildIdent(state, today);
  const isBusiness = state.type === 'business-letter';
  // A KEPT but blank SSIC / code line reserves a blank line (a space) so an admin can fill it in by
  // hand later; an un-kept line is dropped entirely.
  const idLines = [
    state.includeSsic ? state.ssic || ' ' : null,
    state.includeCode ? ident.codeLine || ' ' : null,
    ident.date || null,
  ].filter((l): l is string => l !== null);
  if (idLines.length) {
    const blockW = Math.max(...idLines.map((l) => font.widthOfTextAtSize(l, SIZE)));
    // Business letter: identification symbols at the upper LEFT (11-2.1); all else right-aligned (7-2.3).
    const idX = isBusiness ? LEFT : RIGHT - blockW;
    idLines.forEach((l) => put(l, idX));
  }

  // ---- Memo / MFR title at the left margin, one blank line above + below (.memo-title) ----
  const isMemo = state.type === 'memo-from-to';
  const isMfr = state.type === 'mfr';
  const memoTitle = isMfr ? 'MEMORANDUM FOR THE RECORD' : isMemo ? 'MEMORANDUM' : '';

  // ---- Heading block (From/To/Via/Subj/Ref/Encl — or, for a business letter, the inside address) ----
  if (isBusiness) {
    // Inside address (a few lines below the date), optional attention line, then salutation or subject.
    const biz = state.business;
    gap(PARA_GAP * 2);
    biz.insideAddress.split('\n').forEach((l) => put(l, LEFT));
    if (biz.attention.trim()) {
      gap(PARA_GAP);
      put(`Attention:  ${biz.attention.trim()}`, LEFT);
    }
    gap(PARA_GAP);
    if (biz.subjectReplacesSalutation) {
      if (state.subj.trim()) put(`SUBJECT:  ${state.subj.toUpperCase()}`, LEFT);
    } else {
      if (biz.salutation.trim()) put(biz.salutation.trim(), LEFT);
      if (state.subj.trim()) {
        gap(PARA_GAP);
        put(`SUBJECT:  ${state.subj.toUpperCase()}`, LEFT);
      }
    }
  } else if (memoTitle) {
    gap(PARA_GAP);
    room(SIZE * BODY_LH);
    put(memoTitle, LEFT);
    gap(PARA_GAP);
  } else {
    gap(0.3 * PT - PARA_GAP < 0 ? 0.14 * PT : 0.3 * PT); // .headings margin-top (~0.3in from ident)
  }
  // A long heading entry hangs its continuation under the entry's FIRST WORD (7-2.6–11): under the
  // content for From/To/Via/Subj, and under the text — past the marker — for the numbered Via/Ref/Encl
  // lists. The optional `marker` (e.g. "(a)  ") sits in the content column; the wrapped text and every
  // continuation line start just after it. (Was wrongly returning continuations to the left margin.)
  const headRow = (label: string, value: string, marker = '') => {
    const vx = LEFT + LABEL_COL;
    const textX = marker ? vx + font.widthOfTextAtSize(marker, SIZE) : vx;
    const lines = wrap(value, font, SIZE, RIGHT - textX);
    room(SIZE * BODY_LH);
    const baseY = PAGE_H - top - baselineDrop(SIZE, BODY_LH);
    if (label) page.drawText(label, { x: LEFT, y: baseY, font, size: SIZE });
    if (marker) page.drawText(marker, { x: vx, y: baseY, font, size: SIZE });
    put(lines[0] ?? '', textX);
    lines.slice(1).forEach((ln) => put(ln, textX));
  };
  // The business letter is addressed by the inside address above — no From/To/Via/Subj/Ref/Encl heading.
  if (!isBusiness) {
  // MFR is "for the record" — no addressee, so no From/To/Via.
  if (!isMfr) {
    if (state.from) headRow('From:', state.from);
    if (state.to) headRow('To:', state.to);
    const vias = state.via.filter((v) => v.text.trim());
    vias.forEach((v, i) => headRow(i === 0 ? 'Via:' : '', v.text, vias.length > 1 ? `(${i + 1}) ` : ''));
  }
  if (state.subj) {
    gap(PARA_GAP);
    headRow('Subj:', state.subj.toUpperCase());
  }
  const refs = state.refs.filter((r) => r.text.trim());
  refs.forEach((r, i) => {
    if (i === 0) gap(PARA_GAP);
    headRow(i === 0 ? 'Ref:' : '', r.text, `(${String.fromCharCode(97 + i)})  `);
  });
  const encls = state.encls.filter((e) => e.text.trim());
  encls.forEach((e, i) => {
    if (i === 0) gap(PARA_GAP);
    headRow(i === 0 ? 'Encl:' : '', e.text, `(${i + 1})  `);
  });
  } // end of the non-business heading block

  // ---- Body (numbered paragraphs; first line indented, continuation at the left margin) ----
  gap(PARA_GAP);
  const drawBody = (list: Paragraph[], depth: number, portionActive: boolean, business = false) => {
    list.forEach((p, i) => {
      // Business letter: main paragraphs are unnumbered; the ladder shifts one level deeper (11-2.6).
      const marker = business && depth === 0 ? '' : markerText(paragraphMarker(depth, i));
      const indent = (business ? depthIndentIn(depth + 1) : depthIndentIn(depth)) * PT;
      const markerX = LEFT + indent;
      const textX = markerX + (marker ? font.widthOfTextAtSize(marker, SIZE) + PGAP : 0);
      // Portion marking when active: "(CUI)" on a marked paragraph, else "(U)" — sits before the title.
      const portion = portionActive ? (p.cui ? '(CUI) ' : '(U) ') : '';
      const portionW = portion ? font.widthOfTextAtSize(portion, SIZE) : 0;
      // Optional underlined section title, inline after the marker (+ portion): "N.  (CUI) Title.  body…"
      const titleX = textX + portionW;
      const titleW = p.title ? font.widthOfTextAtSize(p.title + '.  ', SIZE) : 0;
      const firstX = titleX + titleW; // body begins after the portion mark + title on the first line
      // Split into whitespace-delimited words; each word is one or more inline-markup segments
      // (**bold** *italic* __underline__), so attached punctuation keeps no spurious space.
      const spaceW = font.widthOfTextAtSize(' ', SIZE);
      type Seg = { text: string; f: PdfFont; ul: boolean; w: number };
      type Word = { segs: Seg[]; w: number };
      const words: Word[] = [];
      let acc: Seg[] = [];
      const flush = () => {
        if (acc.length) {
          words.push({ segs: acc, w: acc.reduce((s, g) => s + g.w, 0) });
          acc = [];
        }
      };
      for (const r of parseInline(p.text)) {
        const f = r.bold ? bold : r.italic ? italicFont : font;
        for (const part of r.text.split(/(\s+)/)) {
          if (part === '') continue;
          if (/^\s+$/.test(part)) flush();
          else acc.push({ text: part, f, ul: !!r.underline, w: f.widthOfTextAtSize(part, SIZE) });
        }
      }
      flush();
      // Wrap words into rows: row 0 begins after the title; continuation returns to LEFT (7-2.13).
      const rows: { words: Word[]; startX: number }[] = [];
      {
        let cur: Word[] = [];
        let startX = firstX;
        let x = firstX;
        for (const wd of words) {
          const sp = cur.length ? spaceW : 0;
          if (cur.length && x + sp + wd.w > RIGHT) {
            rows.push({ words: cur, startX });
            cur = [wd];
            startX = LEFT;
            x = LEFT + wd.w;
          } else {
            cur.push(wd);
            x += sp + wd.w;
          }
        }
        if (cur.length || !rows.length) rows.push({ words: cur, startX });
      }
      rows.forEach((row, li) => {
        room(SIZE * BODY_LH);
        const baseY = PAGE_H - top - baselineDrop(SIZE, BODY_LH);
        if (li === 0) {
          if (marker) page.drawText(marker, { x: markerX, y: baseY, font, size: SIZE });
          if (portion) page.drawText(portion, { x: textX, y: baseY, font, size: SIZE });
          if (p.title) {
            page.drawText(p.title + '.', { x: titleX, y: baseY, font, size: SIZE });
            const tW = font.widthOfTextAtSize(p.title, SIZE);
            page.drawLine({
              start: { x: titleX, y: baseY - 1.6 },
              end: { x: titleX + tW, y: baseY - 1.6 },
              thickness: 0.6,
              color: black,
            });
          }
        }
        let wx = row.startX;
        row.words.forEach((wd, wi) => {
          if (wi > 0) wx += spaceW;
          for (const seg of wd.segs) {
            page.drawText(seg.text, { x: wx, y: baseY, font: seg.f, size: SIZE });
            if (seg.ul) {
              page.drawLine({
                start: { x: wx, y: baseY - 1.6 },
                end: { x: wx + seg.w, y: baseY - 1.6 },
                thickness: 0.6,
                color: black,
              });
            }
            wx += seg.w;
          }
        });
        top += SIZE * BODY_LH;
      });
      gap(PARA_GAP);
      if (p.children.length) drawBody(p.children, depth + 1, portionActive, business);
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

  // Business letter closing: centered "Sincerely," + signature (with CAC field), then the
  // left-margin Enclosures + Separate-Mailing notations (11-2.8 through 2.11).
  const drawBizClose = () => {
    const biz = state.business;
    gap(PARA_GAP * 0.4); // "Sincerely," sits just below the last body line
    put(biz.complimentaryClose.trim() || 'Sincerely,', sigX);
    gap(PARA_GAP * 2.6); // the signer's name begins ~4 lines below the close
    room(SIZE * BODY_LH * 4);
    const fieldTopY = PAGE_H - top - 2;
    const fieldH = 30;
    top += fieldH;
    if (state.signature.name) put(state.signature.name, sigX);
    if (state.signature.title) put(state.signature.title, sigX);
    if (state.signature.authority === 'by-direction') put('By direction', sigX);
    if (state.signature.authority === 'acting') put('Acting', sigX);
    sigRefs.push(
      addSignatureField(doc, page, [sigX, fieldTopY - fieldH, sigX + 3 * PT, fieldTopY], 'Signature1', PDFName, PDFString),
    );
    const bizEncls = state.encls.filter((e) => e.text.trim());
    if (bizEncls.length === 1) {
      gap(PARA_GAP);
      put(`Enclosure:  ${bizEncls[0].text}`, LEFT);
    } else if (bizEncls.length > 1) {
      gap(PARA_GAP);
      put('Enclosures:', LEFT);
      bizEncls.forEach((e, i) => put(`${i + 1}.  ${e.text}`, LEFT));
    }
    if (biz.separateMailing.trim()) {
      gap(PARA_GAP);
      put(`Separate Mailing:  ${biz.separateMailing.trim()}`, LEFT);
    }
  };

  drawBody(state.body, 0, state.cui.enabled && anyCui(state.body), isBusiness);
  if (isBusiness) {
    drawBizClose();
  } else {
    signatureBlock(state.signature.name, state.signature.title, state.signature.authority, 'Signature1');
  }

  // ---- Copy to ----
  const copyTo = state.copyTo.filter((c) => c.trim());
  if (copyTo.length) {
    gap(PARA_GAP);
    put('Copy to:', LEFT);
    // wrap each addressee (a long SNDL title must not run off the page); continuation at the left
    // margin, matching the preview's block lines and the docx.
    copyTo.forEach((c) => wrap(c, font, SIZE, RIGHT - LEFT).forEach((ln) => put(ln, LEFT)));
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
      evias.forEach((v, k) => headRow(k === 0 ? 'Via:' : '', v.text, `(${k + 1}) `));
    if (state.subj) {
      gap(PARA_GAP);
      headRow('Subj:', state.subj.toUpperCase());
    }
    gap(PARA_GAP);
    drawBody(e.body, 0, state.cui.enabled && anyCui(e.body));
    signatureBlock(e.sigName, e.sigTitle, e.authority, `Signature${i + 2}`);
  });

  // ---- In-document enclosures — appended as their own page(s), marked "Enclosure (n)" (§7).
  // Images embed directly; PDFs copy their real pages (vector, not rasterized). ----
  const enclStart = doc.getPageCount(); // enclosure pages get the mark, not a letter page number
  for (let n = 0; n < state.encls.length; n++) {
    const e = state.encls[n];
    if (!e.inDocument || !e.file) continue;
    const mark = `Enclosure (${n + 1})`;
    const stamp = (pg: ReturnType<Ctx['addPage']>) => {
      const pw = pg.getSize().width;
      pg.drawText(mark, { x: pw - M_SIDE - font.widthOfTextAtSize(mark, SIZE), y: M_BOT, size: SIZE, font });
    };
    if (e.file.type === 'application/pdf') {
      const src = await PDFDocument.load(dataUrlToBytes(e.file.dataUrl), { ignoreEncryption: true });
      const copied = await doc.copyPages(src, src.getPageIndices());
      copied.forEach((pg) => {
        doc.addPage(pg);
        stamp(pg);
      });
    } else {
      const img = await embedImageFile(doc, e.file);
      const pg = doc.addPage([PAGE_W, PAGE_H]);
      if (img) {
        const bw = RIGHT - LEFT;
        const bh = PAGE_H - M_TOP - M_BOT;
        const s = Math.min(bw / img.width, bh / img.height);
        pg.drawImage(img, {
          x: LEFT + (bw - img.width * s) / 2,
          y: M_BOT + (bh - img.height * s) / 2,
          width: img.width * s,
          height: img.height * s,
        });
      }
      stamp(pg);
    }
  }

  // ---- CUI banners (every page, top + bottom) + designation block (page 1, lower-right) ----
  const cui = state.cui;
  const pages = doc.getPages();
  if (cui.enabled) {
    const banner = (cui.banner || 'CUI').toUpperCase();
    const bw = bold.widthOfTextAtSize(banner, 12);
    pages.forEach((pg) => {
      const { width: pw, height: ph } = pg.getSize();
      pg.drawText(banner, { x: (pw - bw) / 2, y: ph - 0.22 * PT - 10.7, size: 12, font: bold });
      pg.drawText(banner, { x: (pw - bw) / 2, y: 0.22 * PT + 2.6, size: 12, font: bold });
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

  // ---- Page numbers — centered, 0.5in from the bottom, page 2 onward; enclosure pages are
  // excluded (they carry the "Enclosure (n)" mark instead) (7-2.17) ----
  if (enclStart > 1) {
    pages.forEach((pg, i) => {
      if (i === 0 || i >= enclStart) return;
      const num = String(i + 1);
      pg.drawText(num, { x: (PAGE_W - font.widthOfTextAtSize(num, SIZE)) / 2, y: 0.5 * PT, size: SIZE, font });
    });
  }

  // ---- One AcroForm holding every signature field (basic letter + each endorsement) ----
  if (sigRefs.length) {
    const acroForm = doc.context.obj({ Fields: sigRefs, SigFlags: 3 });
    doc.catalog.set(PDFName.of('AcroForm'), doc.context.register(acroForm));
  }

  // Clear ALL identifying metadata as the very LAST step before serializing. pdf-lib stamps its own
  // Producer + a fresh ModDate when the document is created (updateInfoDict), so wiping must happen
  // after every build step for the empty values to survive. save() itself never re-stamps.
  stripPdfMetadata(doc);
  return await doc.save();
}

export async function exportSignablePdf(state: LetterState, today: Date = new Date()): Promise<void> {
  download(await buildSignablePdf(state, today), documentFilename(state, 'pdf'));
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

// data: URL → raw bytes (works in the browser and in the jsdom test env).
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1] ?? '';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Embed an attached image. png/jpg embed directly; any other format is rasterized to PNG via a
// canvas (browser only — exotic formats just won't appear in the headless test harness).
async function embedImageFile(doc: Ctx, file: { type: string; dataUrl: string }) {
  const t = file.type.toLowerCase();
  if (t.includes('png')) return doc.embedPng(dataUrlToBytes(file.dataUrl));
  if (t.includes('jpeg') || t.includes('jpg')) return doc.embedJpg(dataUrlToBytes(file.dataUrl));
  if (typeof document === 'undefined') return null;
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('image load failed'));
      img.src = file.dataUrl;
    });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || 1;
    c.height = img.naturalHeight || 1;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return doc.embedPng(dataUrlToBytes(c.toDataURL('image/png')));
  } catch {
    return null;
  }
}

function download(bytes: Uint8Array, name: string): void {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
