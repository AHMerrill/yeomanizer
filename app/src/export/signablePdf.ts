// "CAC-signable PDF" — generates the letter with pdf-lib (the browser print path makes a flat
// PDF with no form field) so we can embed a real AcroForm digital-signature field (/FT /Sig).
// Open in Adobe, click the field, CAC/certificate-sign — no "Prepare a Form" step. The field has
// no visible border, so it's invisible when printed on paper.
//
// Layout is driven off the SAME numbers as the on-screen CSS (preview.css / paragraphs.ts) so it
// matches by construction. Renders the FULL document: CUI banners + designation block (with
// per-enclosure banner overrides), endorsements (each with its own /Sig field), in-document
// enclosures (images embedded, PDFs copied as real vector pages), and continuation-page numbering.
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
const NAVY: [number, number, number] = [0, 0x2d / 0xff, 0x72 / 0xff]; // PMS 288 (M-5216.5 letterhead ink)

// Times metrics: ~0.891 ascent, ~1.107 total height. Baseline distance from the top of a line box.
const baselineDrop = (size: number, lh: number) => (size * lh - size * 1.107) / 2 + size * 0.891;

type PdfFont = Awaited<ReturnType<Awaited<ReturnType<typeof import('pdf-lib').PDFDocument.create>>['embedFont']>>;
type Ctx = Awaited<ReturnType<typeof import('pdf-lib').PDFDocument.create>>;

export async function buildSignablePdf(
  state: LetterState,
  today: Date = new Date(),
  // Optional pre-loaded seal bytes. The browser fetches the seal from its bundled URL; the headless
  // test harness can't fetch a Vite asset, so it passes the PNG read from disk — letting automated
  // checks actually verify seal embedding (otherwise the seal silently never embeds in tests).
  sealBytes?: Uint8Array | ArrayBuffer,
): Promise<Uint8Array> {
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
  // Drawn at the top of each BODY continuation page: the Subj line (7-2.16) — or, for a business
  // letter, the identification symbols (11-2.14). Null on page 1 (it carries the full heading) and
  // cleared before endorsement/enclosure pages, which bring their own headers. Mirrors the preview.
  let contHeader: (() => void) | null = null;
  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    top = M_BOT; // continuation/subsequent pages use the 1-inch top margin (7-2.16)
    if (contHeader) {
      const h = contHeader;
      contHeader = null; // re-entrancy guard: the header draws on a fresh page with room to spare
      h();
      contHeader = h;
    }
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
    const bytes = sealBytes ?? (await loadSealBytes(state));
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
    // Joint letter: list each command (senior first) + the shared city/state; else the single activity.
    const lhLines =
      state.type === 'joint-letter'
        ? [...state.joint.parties.map((p) => p.command), lh.cityStateZip]
        : [...lh.activityName.split('\n'), lh.addressLine, lh.cityStateZip];
    lhLines.filter((l) => l.trim()).forEach((l) => putCenter(l.toUpperCase(), bold, 7.5, 1.04, navy));
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
  const isMoa = state.type === 'moa';
  const isJoint = state.type === 'joint-letter';
  const isExec = state.type === 'exec-memo';
  const isMemoFor = isExec && state.execMemo.kind === 'MEMORANDUM-FOR';
  if (isJoint) {
    // Joint letter: each command its own identification column (shortTitle/SSIC/Ser/date); the columns
    // sit at the right, senior command (parties[0]) rightmost (fig 7-4).
    const colLines = (p: (typeof state.joint.parties)[number]) =>
      [p.shortTitle, p.ssic, p.serial, p.date].map((s) => s.trim()).filter(Boolean);
    const order = [...state.joint.parties].reverse(); // draw left→right: junior … senior
    const widths = order.map((p) => Math.max(0, ...colLines(p).map((l) => font.widthOfTextAtSize(l, SIZE))));
    const GAPC = 0.3 * PT;
    const totalW = widths.reduce((a, b) => a + b, 0) + GAPC * Math.max(0, order.length - 1);
    let x = RIGHT - totalW;
    const startTop = top;
    let maxTop = top;
    order.forEach((p, idx) => {
      top = startTop;
      colLines(p).forEach((l) => put(l, x));
      maxTop = Math.max(maxTop, top);
      x += widths[idx] + GAPC;
    });
    top = maxTop;
  } else if (isMoa) {
    // Dual identification blocks (fig 10-5): party A at the LEFT margin (short title + the shared
    // SSIC/code/date), party B right-aligned at the RIGHT (its own short title + SSIC/serial/date).
    const m = state.moa;
    const colA = [
      m.shortTitleA.trim() || null,
      state.includeSsic ? state.ssic || ' ' : null,
      state.includeCode ? ident.codeLine || ' ' : null,
      ident.date || null,
    ].filter((l): l is string => l !== null);
    const colB = [
      m.shortTitleB.trim() || null,
      m.ssicB.trim() || null,
      m.serialB.trim() ? `Ser ${m.serialB.trim()}` : null,
      m.dateB.trim() || null,
    ].filter((l): l is string => l !== null);
    const moaStartTop = top;
    let moaMaxTop = top;
    colA.forEach((l) => put(l, LEFT));
    moaMaxTop = Math.max(moaMaxTop, top);
    top = moaStartTop;
    const colBW = colB.length ? Math.max(...colB.map((l) => font.widthOfTextAtSize(l, SIZE))) : 0;
    colB.forEach((l) => put(l, RIGHT - colBW));
    top = Math.max(moaMaxTop, top);
  } else if (isExec) {
    // Executive memo (Ch 12): a right-aligned date + control symbol ("UNSECNAV ____"). A principal's
    // memo is dated when signed, so the date may be blank.
    const em = state.execMemo;
    const idLines = [ident.date || null, isMemoFor ? null : em.controlLine.trim() || null].filter(
      (l): l is string => l !== null,
    );
    if (idLines.length) {
      const blockW = Math.max(...idLines.map((l) => font.widthOfTextAtSize(l, SIZE)));
      idLines.forEach((l) => put(l, RIGHT - blockW));
    }
  } else {
    // A KEPT but blank SSIC / code line reserves a blank line (a space) so an admin can fill it in by
    // hand later; an un-kept line is dropped entirely.
    const idLines = [
      state.includeSsic ? state.ssic || ' ' : null,
      state.includeCode ? ident.codeLine || ' ' : null,
      ident.date || null,
    ].filter((l): l is string => l !== null);
    if (idLines.length) {
      const blockW = Math.max(...idLines.map((l) => font.widthOfTextAtSize(l, SIZE)));
      // Identification symbols are right-aligned for every letter type. NB: SECNAV M-5216.5 ¶11-2.1
      // *says* the business letter's go "upper left", but the manual's own canonical figures (11-2
      // BUSINESS LETTER – FIRST PAGE and 11-6 SHORT BUSINESS LETTER) show them upper RIGHT, with a
      // serial, exactly like the standard letter — so we follow the figures (and real practice).
      idLines.forEach((l) => put(l, RIGHT - blockW));
    }
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
  } else if (isMoa) {
    // Centered title block: "MEMORANDUM OF AGREEMENT/UNDERSTANDING" / BETWEEN / party A / AND / party B.
    gap(PARA_GAP);
    const m = state.moa;
    const titleLines = [
      `MEMORANDUM OF ${m.kind === 'UNDERSTANDING' ? 'UNDERSTANDING' : 'AGREEMENT'}`,
      'BETWEEN',
      m.partyA.trim(),
      'AND',
      m.partyB.trim(),
    ].filter(Boolean);
    titleLines.forEach((l) => {
      room(SIZE * BODY_LH);
      const w = font.widthOfTextAtSize(l, SIZE);
      put(l, LEFT + (RIGHT - LEFT - w) / 2); // centered within the (equal) margins = page center
    });
    gap(PARA_GAP);
  } else if (isJoint) {
    gap(PARA_GAP);
    room(SIZE * BODY_LH);
    put(`JOINT ${state.joint.kind === 'MEMORANDUM' ? 'MEMORANDUM' : 'LETTER'}`, LEFT);
    gap(PARA_GAP);
  } else if (isExec) {
    // Centered "ACTION MEMO" / "INFO MEMO" title (fig 12-9 / 12-11) — or, for a plain "Memorandum For"
    // (fig 12-14), the left-aligned "MEMORANDUM FOR <recipient>" addressing line.
    gap(PARA_GAP);
    room(SIZE * BODY_LH);
    if (isMemoFor) {
      put(`MEMORANDUM FOR ${state.to || 'SECRETARY OF DEFENSE'}`, LEFT);
    } else {
      const t = state.execMemo.kind === 'INFORMATION' ? 'INFO MEMO' : 'ACTION MEMO';
      put(t, LEFT + (RIGHT - LEFT - bold.widthOfTextAtSize(t, SIZE)) / 2, bold);
    }
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
  // Executive memo (Ch 12): FOR:/FROM:/SUBJECT: (Title Case) / Reference(s):, with a wider label column
  // than a naval letter ("SUBJECT:"/"Reference:" don't fit LABEL_COL).
  if (isExec) {
    const em = state.execMemo;
    const EXEC_LBL = 0.92 * PT;
    const erow = (label: string, value: string) => {
      const textX = LEFT + EXEC_LBL;
      const lines = wrap(value, font, SIZE, RIGHT - textX);
      room(SIZE * BODY_LH);
      const baseY = PAGE_H - top - baselineDrop(SIZE, BODY_LH);
      if (label) page.drawText(label, { x: LEFT, y: baseY, font, size: SIZE });
      put(lines[0] ?? '', textX);
      lines.slice(1).forEach((ln) => put(ln, textX));
    };
    if (!isMemoFor && state.to) erow('FOR:', state.to);
    if (!isMemoFor && em.from.trim()) erow('FROM:', em.from.trim());
    if (state.subj.trim()) erow('SUBJECT:', state.subj.trim());
    const erefs = state.refs.filter((r) => r.text.trim());
    if (erefs.length === 1) erow('Reference:', erefs[0].text);
    else erefs.forEach((r, i) => erow(i === 0 ? 'References:' : '', `(${String.fromCharCode(97 + i)}) ${r.text}`));
  }
  // The business letter is addressed by the inside address above — no From/To/Via/Subj/Ref/Encl heading.
  else if (!isBusiness) {
  // MFR is "for the record"; MOA uses its BETWEEN block — neither has a From/To/Via.
  if (isJoint) {
    // Joint letter: a From line per command (senior first), then the single To.
    state.joint.parties.forEach((p, i) => {
      if (p.from.trim()) headRow(i === 0 ? 'From:' : '', p.from);
    });
    if (state.to) headRow('To:', state.to);
  } else if (!isMfr && !isMoa) {
    if (state.from) headRow('From:', state.from);
    if (state.to) headRow('To:', state.to);
    // Multiple-address letter (Ch 8): additional action addressees stack under the To: line.
    state.toAddrs.filter((a) => a.text.trim()).forEach((a) => headRow('', a.text));
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

  // Arm the continuation header now that the heading is laid out: every body page break from here on
  // repeats the Subj line at the 1-inch margin (or the identification symbols for a business letter),
  // matching the preview's continuation heads. Page 1 already shows the full heading.
  if (isBusiness) {
    const cont = [
      state.includeSsic ? state.ssic || ' ' : null,
      state.includeCode ? ident.codeLine || ' ' : null,
      ident.date || null,
    ].filter((l): l is string => l !== null);
    if (cont.length) {
      const blockW = Math.max(...cont.map((l) => font.widthOfTextAtSize(l, SIZE)));
      contHeader = () => {
        cont.forEach((l) => put(l, RIGHT - blockW));
        gap(PARA_GAP);
      };
    }
  } else if (state.subj.trim() && !isExec) {
    contHeader = () => {
      headRow('Subj:', state.subj.toUpperCase());
      gap(PARA_GAP);
    };
  }

  // ---- Body (numbered paragraphs; first line indented, continuation at the left margin) ----
  gap(PARA_GAP);
  const drawBody = (
    list: Paragraph[],
    depth: number,
    portionActive: boolean,
    business = false,
    execBullet = false,
  ) => {
    list.forEach((p, i) => {
      // Business main paras are unnumbered; exec-memo main paras are bulleted ("•"). Both shift the
      // ladder one level deeper for subparagraphs (11-2.6 / Ch 12).
      const mk = (business || execBullet) && depth === 0 ? null : paragraphMarker(depth, i);
      const marker = mk ? markerText(mk) : execBullet && depth === 0 ? '•' : '';
      const indent = (business || execBullet ? depthIndentIn(depth + 1) : depthIndentIn(depth)) * PT;
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
          if (marker) {
            page.drawText(marker, { x: markerX, y: baseY, font, size: SIZE });
            // Levels 5-8 (fig 7-8) underline the marker's digit/letter to mark the second cycle —
            // matching the preview (<u>) and the .docx (R(core, {underline})).
            if (mk?.underline) {
              const preW = font.widthOfTextAtSize(mk.prefix, SIZE);
              const coreW = font.widthOfTextAtSize(mk.core, SIZE);
              page.drawLine({
                start: { x: markerX + preW, y: baseY - 1.6 },
                end: { x: markerX + preW + coreW, y: baseY - 1.6 },
                thickness: 0.6,
                color: black,
              });
            }
          }
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
      if (p.children.length) drawBody(p.children, depth + 1, portionActive, business, execBullet);
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

  // MOA/MOU closing: dual signatures over signature lines — senior (party A) at the right (sigX),
  // party B at the left margin (10-2, fig 10-5).
  const drawMoaClose = () => {
    gap(PARA_GAP * 3); // leave room to wet-sign above the lines
    room(SIZE * BODY_LH * 4);
    const SIG_LINE = '________________________';
    const startTop = top;
    const drawCol = (x: number, s: { name: string; title: string; authority?: string }) => {
      top = startTop;
      put(SIG_LINE, x);
      if (s.name) put(s.name, x);
      if (s.title) put(s.title, x);
      if (s.authority === 'by-direction') put('By direction', x);
      if (s.authority === 'acting') put('Acting', x);
    };
    drawCol(LEFT, state.moa.signerB); // party B (left)
    const leftEnd = top;
    drawCol(sigX, state.signature); // party A — senior (right)
    top = Math.max(leftEnd, top);
  };

  // Joint letter closing: one signature per command, spread across the page with the senior (party
  // listed first) at the RIGHT and a third cosigner in the middle (7-4).
  const drawJointClose = () => {
    gap(PARA_GAP * 3);
    room(SIZE * BODY_LH * 4);
    const SIG_LINE = '____________________';
    const sigW = font.widthOfTextAtSize(SIG_LINE, SIZE);
    const order = [...state.joint.parties].reverse(); // left→right: junior … senior (right)
    const n = order.length;
    const startTop = top;
    let maxTop = top;
    order.forEach((p, idx) => {
      top = startTop;
      const x = n > 1 ? LEFT + ((RIGHT - sigW - LEFT) * idx) / (n - 1) : sigX;
      put(SIG_LINE, x);
      if (p.signer.name) put(p.signer.name, x);
      if (p.signer.title) put(p.signer.title, x);
      if (p.signer.authority === 'by-direction') put('By direction', x);
      if (p.signer.authority === 'acting') put('Acting', x);
      maxTop = Math.max(maxTop, top);
    });
    top = maxTop;
  };

  // Executive-memo close (Ch 12): RECOMMENDATION + Approve/Disapprove decision block (ACTION only),
  // then COORDINATION, Attachments, and "Prepared by". No traditional signature block — the principal
  // acts by initialing the decision line (figs 12-9 / 12-11).
  const drawExecClose = () => {
    const em = state.execMemo;
    if (isMemoFor) {
      // Plain "Memorandum For" (fig 12-14): a CAC-signable centered signature, then Attachments + cc.
      gap(3 * PARA_GAP);
      const fieldTopY = PAGE_H - top - 2;
      const fieldH = 30;
      top += fieldH;
      const center = (t: string) => put(t, LEFT + (RIGHT - LEFT - font.widthOfTextAtSize(t, SIZE)) / 2);
      if (state.signature.name.trim()) center(state.signature.name.trim());
      if (state.signature.title.trim()) center(state.signature.title.trim());
      const fx = (PAGE_W - 3 * PT) / 2;
      sigRefs.push(
        addSignatureField(doc, page, [fx, fieldTopY - fieldH, fx + 3 * PT, fieldTopY], 'Signature1', PDFName, PDFString),
      );
      gap(PARA_GAP);
      put('Attachments:', LEFT);
      put(em.attachments.trim() || 'As stated', LEFT);
      if (em.cc?.trim()) {
        gap(PARA_GAP);
        put(`cc:  ${em.cc.trim()}`, LEFT);
      }
      return;
    }
    gap(PARA_GAP);
    if (em.kind === 'ACTION') {
      const recLabel = 'RECOMMENDATION:  ';
      const recX = LEFT + font.widthOfTextAtSize(recLabel, SIZE);
      const recLines = wrap(
        em.recommendation.trim() || 'That SECNAV sign the action at TAB A.',
        font,
        SIZE,
        RIGHT - recX,
      );
      room(SIZE * BODY_LH);
      page.drawText(recLabel, { x: LEFT, y: PAGE_H - top - baselineDrop(SIZE, BODY_LH), font, size: SIZE });
      put(recLines[0] ?? '', recX);
      recLines.slice(1).forEach((ln) => put(ln, LEFT));
      if (em.decisionLines) {
        gap(PARA_GAP);
        const fieldTopY = PAGE_H - top - 2;
        put(`Approve  ${'_'.repeat(18)}      Disapprove  ${'_'.repeat(18)}`, LEFT);
        // A CAC field over the "Approve" blank so the principal can sign the approval.
        const approveX = LEFT + font.widthOfTextAtSize('Approve  ', SIZE);
        sigRefs.push(
          addSignatureField(doc, page, [approveX, fieldTopY - 22, approveX + 1.6 * PT, fieldTopY], 'Signature1', PDFName, PDFString),
        );
      }
    }
    gap(PARA_GAP);
    put(`COORDINATION:  ${em.coordination.trim() || 'None'}`, LEFT);
    gap(PARA_GAP);
    put('Attachments:', LEFT);
    put(em.attachments.trim() || 'As stated', LEFT);
    if (em.preparedBy.trim()) {
      gap(PARA_GAP);
      put(`Prepared by:  ${em.preparedBy.trim()}`, LEFT);
    }
  };

  drawBody(state.body, 0, state.cui.enabled && anyCui(state.body), isBusiness || isMemoFor, isExec && !isMemoFor);
  if (isBusiness) {
    drawBizClose();
  } else if (isMoa) {
    drawMoaClose();
  } else if (isJoint) {
    drawJointClose();
  } else if (isExec) {
    drawExecClose();
  } else {
    signatureBlock(state.signature.name, state.signature.title, state.signature.authority, 'Signature1');
  }

  // ---- Distribution (Ch 8-2): action addressees, after the signature and above Copy to ----
  const distribution = state.distribution.filter((d) => d.text.trim());
  if (distribution.length) {
    gap(PARA_GAP);
    put('Distribution:', LEFT);
    distribution.forEach((d) => wrap(d.text, font, SIZE, RIGHT - LEFT).forEach((ln) => put(ln, LEFT)));
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
  contHeader = null; // basic-letter Subj must not bleed onto endorsement/enclosure pages
  const onBasic = `ENDORSEMENT on ${basicLetterId(state, today)}`;
  state.endorsements.forEach((e, i) => {
    newPage();
    // New-page endorsement identification block (9-2.2: repeat the basic letter's SSIC; the endorser
    // adds its own serial + date). Right-aligned, matching the preview's endorsement ident.
    const eIdent = buildIdent({ ...state, type: 'endorsement', serial: e.serial }, today);
    const eIdLines = [
      eIdent.ssic || ' ',
      e.serial.trim() ? eIdent.codeLine : null,
      eIdent.date || null,
    ].filter((l): l is string => l !== null);
    if (eIdLines.length) {
      const blockW = Math.max(...eIdLines.map((l) => font.widthOfTextAtSize(l, SIZE)));
      eIdLines.forEach((l) => put(l, RIGHT - blockW));
      gap(PARA_GAP);
    }
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
  // Per-enclosure CUI banner: an enclosure's appended page(s) can carry their OWN banner (top/bottom)
  // instead of the letter's, so a package assembled from mixed-category enclosures is marked correctly
  // on a per-page basis. Recorded here, applied in the CUI banner pass below.
  const pageBannerOverride = new Map<number, string>();
  for (let n = 0; n < state.encls.length; n++) {
    const e = state.encls[n];
    if (!e.inDocument || !e.file) continue;
    const mark = `Enclosure (${n + 1})`;
    const enclBanner = (e.cuiBanner?.trim() || state.cui.banner || 'CUI').toUpperCase();
    const stamp = (pg: ReturnType<Ctx['addPage']>) => {
      const pw = pg.getSize().width;
      pg.drawText(mark, { x: pw - M_SIDE - font.widthOfTextAtSize(mark, SIZE), y: M_BOT, size: SIZE, font });
    };
    if (e.file.type === 'application/pdf') {
      const src = await PDFDocument.load(dataUrlToBytes(e.file.dataUrl), { ignoreEncryption: true });
      const copied = await doc.copyPages(src, src.getPageIndices());
      copied.forEach((pg) => {
        doc.addPage(pg);
        pageBannerOverride.set(doc.getPageCount() - 1, enclBanner);
        stamp(pg);
      });
    } else {
      const img = await embedImageFile(doc, e.file);
      const pg = doc.addPage([PAGE_W, PAGE_H]);
      pageBannerOverride.set(doc.getPageCount() - 1, enclBanner);
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
    const letterBanner = (cui.banner || 'CUI').toUpperCase();
    pages.forEach((pg, i) => {
      const banner = pageBannerOverride.get(i) || letterBanner; // enclosure pages may carry their own
      const bw = bold.widthOfTextAtSize(banner, 12);
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
      cui.transmittalNote.trim(), // transmittal-document status note (e.g. "…UNCONTROLLED when separated")
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
