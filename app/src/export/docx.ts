import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Tab,
  TabStopType,
  UnderlineType,
  Header,
  Footer,
  PageNumber,
  Table,
  TableRow,
  TableCell,
  TableLayoutType,
  WidthType,
  BorderStyle,
  ImageRun,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
  TextWrappingType,
  type ISectionOptions,
} from 'docx';
import type { LetterState, Paragraph as P } from '../types';
import type { RasterPage } from './rasterizePdf';
import { documentFilename } from '../format/filename';
import { SEAL_URL } from '../format/seals';
import {
  buildIdent,
  refLetter,
  ENDORSE_ORD,
  basicLetterId,
  remainingVias,
} from '../format/identification';
import { anyCui } from '../format/tree';
import { paragraphMarker, depthIndentIn } from '../format/paragraphs';
import { parseInline } from '../format/inline';

const IN = 1440; // twips per inch
const FONT = 'Times New Roman';
const SZ = 24; // 12pt in half-points
const NAVY = '002D72'; // PMS 288 — letterhead ink (M-5216.5 App. C); was '11337A', off-spec + mismatched the PDF/preview
const BLANK = 240; // ~one 12pt blank line

interface RunOpts {
  bold?: boolean;
  italics?: boolean;
  size?: number;
  color?: string;
  underline?: boolean;
}
function R(text: string, opts: RunOpts = {}): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: opts.size ?? SZ,
    bold: opts.bold,
    italics: opts.italics,
    color: opts.color,
    underline: opts.underline ? { type: UnderlineType.SINGLE } : undefined,
  });
}

const center = (text: string, size: number) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [R(text, { bold: true, size, color: NAVY })],
    spacing: { after: 0 },
  });

const spacer = (after = 120) => new Paragraph({ children: [R('')], spacing: { after } });

// US Letter. The docx library defaults to A4 (w:pgSz 11906×16838) when a section sets no size —
// which mis-sized every exported page (metric width, shifted margins and wrap points). Naval
// correspondence is 8.5 × 11 (2-12), so every section sets this explicitly.
const LETTER = { width: 12240, height: 15840 } as const;
// Three blank 12-pt lines before the typed signature name — the name lands on the FOURTH line
// below the last text line (7-2.14; the figures show exactly three blanks).
const SIG_GAP = 828;
const NB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
const NO_BORDERS = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };
// Approximate Times New Roman advance widths (points at 12pt). Word files carry no text measurer,
// so this sizes the ident column; ±3% is plenty — the block just has to hug the right margin.
const approxPt = (s: string) => {
  let w = 0;
  for (const ch of s) {
    if (/[0-9]/.test(ch)) w += 6;
    else if (/[A-Z]/.test(ch)) w += ch === 'I' ? 4 : ch === 'M' || ch === 'W' ? 10.6 : 8.1;
    else if (/[a-z]/.test(ch)) w += /[ijlft]/.test(ch) ? 3.6 : /[mw]/.test(ch) ? 9 : 5.6;
    else if (ch === ' ') w += 3;
    else w += 4; // punctuation
  }
  return w;
};
// An identification-style block: an internally LEFT-aligned column of lines placed as a unit at
// the right margin. The figures (7-1 / 10-5 / 11-2 / 11-6) show a left-aligned stack whose longest
// line touches the right margin — NOT per-line right justification (which yields a ragged left
// edge, the defect this replaces). A right-aligned fixed-width borderless table reproduces it (an
// auto-width table collapses to nothing in LibreOffice, so the width is estimated from the text).
const identColumn = (lines: string[], size?: number) => {
  const wTw = Math.round(Math.max(...lines.map(approxPt)) * ((size ?? SZ) / SZ) * 20) + 120;
  return new Table({
    alignment: AlignmentType.RIGHT,
    width: { size: wTw, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [wTw],
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: NO_BORDERS,
            width: { size: wTw, type: WidthType.DXA },
            // Zero cell margins: Word's default ~0.075in side margins would eat the estimated
            // width (wrapping the longest line) and shift the stack's left edge.
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: lines.map(
              (l) => new Paragraph({ children: [size ? R(l, { size }) : R(l)], spacing: { after: 0 } }),
            ),
          }),
        ],
      }),
    ],
  });
};
// Empty 12-pt lines that pad a page-2+ header down from the 0.25in header offset toward the
// 1-inch line the manual puts the repeated Subj on (7-2.16).
const headerPad = (n: number) =>
  Array.from({ length: n }, () => new Paragraph({ children: [R('')], spacing: { after: 0 } }));

const EMU = 914400; // EMUs per inch (floating-image offsets)

// data: URL → bytes (sync; works in the browser and the jsdom test env).
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1] ?? '';
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Intrinsic pixel size from a PNG/JPEG header (no image decode needed); falls back to 4:3.
function imageSize(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  if (bytes.length >= 10 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let o = 2;
    while (o + 9 < bytes.length) {
      if (bytes[o] !== 0xff) {
        o++;
        continue;
      }
      const m = bytes[o + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
        return { width: (bytes[o + 7] << 8) | bytes[o + 8], height: (bytes[o + 5] << 8) | bytes[o + 6] };
      o += 2 + ((bytes[o + 2] << 8) | bytes[o + 3]);
    }
  }
  return { width: 800, height: 600 };
}

function imageKind(mime: string): 'png' | 'jpg' | 'gif' | 'bmp' {
  const m = mime.toLowerCase();
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('gif')) return 'gif';
  if (m.includes('bmp')) return 'bmp';
  return 'png';
}

// Floating seal at the top-left — matches the preview's 1-inch seal at 0.62in / 0.5in.
function sealRun(bytes: ArrayBuffer | Uint8Array): ImageRun {
  return new ImageRun({
    type: 'png',
    data: bytes,
    transformation: { width: 96, height: 96 }, // 1 inch @ 96 DPI
    floating: {
      horizontalPosition: {
        relative: HorizontalPositionRelativeFrom.PAGE,
        offset: Math.round(0.62 * EMU),
      },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: Math.round(0.5 * EMU) },
      wrap: { type: TextWrappingType.NONE },
      allowOverlap: true,
    },
  });
}

// Fetch the chosen seal as PNG bytes (rasterizing the SVG seals via canvas) for embedding.
export async function loadSealBytes(state: LetterState): Promise<ArrayBuffer | undefined> {
  const lh = state.letterhead;
  if (lh.mode !== 'on') return undefined;
  const src = SEAL_URL[lh.seal];
  if (!src) return undefined;
  try {
    // Both seals are PNG now — fetch the (content-hashed) asset bytes directly.
    return await (await fetch(src)).arrayBuffer();
  } catch {
    return undefined;
  }
}

function flattenBody(
  list: P[],
  depth: number,
  out: (Paragraph | Table)[],
  portionActive: boolean,
  business = false,
  execBullet = false,
  topIndentIn?: number, // depth-0 first-line indent override (Memo-For's half inch, fig 12-14)
): void {
  list.forEach((p, i) => {
    const m = paragraphMarker(depth, i);
    // Business main paras are unnumbered; exec-memo main paras are bulleted ("•"). Both shift the
    // ladder one level deeper for subparagraphs (11-2.6 / Ch 12).
    const noMark = business && depth === 0;
    const bulletTop = execBullet && depth === 0;
    const mark = portionActive ? (p.cui ? '(CUI) ' : '(U) ') : '';
    const indentIn =
      depth === 0 && topIndentIn
        ? topIndentIn
        : business || execBullet
          ? depthIndentIn(depth + 1)
          : depthIndentIn(depth);
    // Fig 12-9 (measured): the exec bullet sits FLUSH at the left margin; text and wrapped lines
    // hang at 0.25in. A tab carries the first line to the hanging edge.
    const HANG = 0.25;
    out.push(
      new Paragraph({
        children: [
          ...(noMark
            ? [R(mark)]
            : bulletTop
              ? [new TextRun({ children: ['•', new Tab()] }), ...(mark ? [R(mark)] : [])]
              : [R(m.prefix), R(m.core, { underline: m.underline }), R(m.suffix), R('  ' + mark)]),
          ...(p.title ? [R(p.title, { underline: true }), R('.  ')] : []),
          ...parseInline(p.text).map((r) =>
            R(r.text, { bold: r.bold, italics: r.italic, underline: r.underline }),
          ),
        ],
        indent: bulletTop
          ? { left: Math.round(HANG * IN), hanging: Math.round(HANG * IN) } // bullet at the margin

          : { firstLine: Math.round(indentIn * IN) },
        spacing: { after: BLANK },
      }),
    );
    if (p.children.length) flattenBody(p.children, depth + 1, out, portionActive, business, execBullet);
  });
}

// Assemble the Word document (pure — no DOM), so it can be unit-tested without a browser.
export function buildDocxDocument(
  state: LetterState,
  today: Date = new Date(),
  sealBytes?: ArrayBuffer | Uint8Array,
  enclImages: Record<string, RasterPage[]> = {},
): Document {
  // Coordination page (Ch 12, fig 12-13): a standalone plain-bond concurrence table, not a letter.
  if (state.type === 'coordination-page') {
    const NB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
    const noBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };
    const cell = (runs: TextRun[]) =>
      new TableCell({ children: [new Paragraph({ children: runs, spacing: { after: 40 } })], borders: noBorders });
    const headerRow = new TableRow({
      tableHeader: true, // Word repeats the column headers atop each page the table spills onto
      cantSplit: true,
      children: ['Office/Dept', 'Point of Contact/Title', 'Phone', 'Date', 'Remarks'].map((h) =>
        cell([R(h, { underline: true })]),
      ),
    });
    const rows = state.coordPage.entries.map(
      (e) =>
        new TableRow({
          cantSplit: true, // keep each office's row intact across a page break (matches the PDF)
          children: [e.office, e.poc, e.phone, e.date, e.remarks].map((c) => cell([R(c)])),
        }),
    );
    // CUI marking, if enabled: a banner top + bottom of every page (the CUI card is offered for the
    // coordination page too, so it must actually mark), and the designation block in the page-1
    // footer. titlePage routes page 1 to the `first` header/footer, pages 2+ to `default`.
    const ccui = state.cui;
    const ccBanner = (ccui.banner || 'CUI').toUpperCase();
    const ccBannerPara = () =>
      new Paragraph({ alignment: AlignmentType.CENTER, children: [R(ccBanner, { bold: true })], spacing: { after: 0 } });
    const ccDesig = [
      `Controlled by: ${ccui.controlledBy1}`,
      ccui.controlledBy2 ? `Controlled by: ${ccui.controlledBy2}` : '',
      `CUI Category: ${ccui.category}`,
      `Limited Dissemination Control: ${ccui.dissemination}`,
      ccui.poc ? `POC: ${ccui.poc}` : '',
      ccui.transmittalNote.trim(),
    ]
      .filter(Boolean)
      .map(
        (line) =>
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: line, font: FONT, size: 16 })],
            spacing: { after: 0 },
          }),
      );
    return new Document({
      creator: '',
      title: '',
      subject: '',
      description: '',
      keywords: '',
      lastModifiedBy: '',
      sections: [
        {
          properties: {
            page: { size: LETTER, margin: { top: IN, right: IN, bottom: IN, left: IN } },
            ...(ccui.enabled ? { titlePage: true } : {}),
          },
          headers: ccui.enabled
            ? { default: new Header({ children: [ccBannerPara()] }), first: new Header({ children: [ccBannerPara()] }) }
            : undefined,
          footers: ccui.enabled
            ? {
                default: new Footer({ children: [ccBannerPara()] }),
                first: new Footer({ children: [ccBannerPara(), ...ccDesig] }),
              }
            : undefined,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [R('COORDINATION PAGE')],
              spacing: { after: 2 * BLANK },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              // Fixed columns sized like the PDF (1.2 / 2.1 / 1.2 / 1.1 / 0.9 in over 6.5in) so the
              // Point-of-Contact column fits names on one line instead of wrapping.
              layout: TableLayoutType.FIXED,
              columnWidths: [1728, 3024, 1728, 1584, 1296],
              borders: noBorders,
              rows: [headerRow, ...rows],
            }),
          ],
        },
      ],
    });
  }
  const ident = buildIdent(state, today);
  const lh = state.letterhead;
  const cui = state.cui;
  const isMemo = state.type === 'memo-from-to';
  const isMfr = state.type === 'mfr';
  const isEndorsement = state.type === 'endorsement';
  const isBusiness = state.type === 'business-letter';
  const isMoa = state.type === 'moa';
  const isJoint = state.type === 'joint-letter';
  const isExec = state.type === 'exec-memo';
  const isMemoFor = isExec && state.execMemo.kind === 'MEMORANDUM-FOR';
  const children: (Paragraph | Table)[] = [];

  // Letterhead: on = print it (text only in v1); preprinted = reserve blank lines; off = none.
  if (lh.mode === 'on') {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          ...(sealBytes ? [sealRun(sealBytes)] : []),
          R(lh.line1, { bold: true, size: 22, color: NAVY }),
        ],
        spacing: { after: 0 },
      }),
    );
    if (lh.titleOnly) {
      // Flag/personal stationery: the centered title only (figs 12-7/12-8) — no activity/address.
    } else if (isJoint) {
      // Joint letter: each command on its own line (senior first).
      // Command titles print in caps like every letterhead line (the PDF already uppercases).
      state.joint.parties.forEach((p) => p.command.trim() && children.push(center(p.command.toUpperCase(), 15)));
    } else if (lh.activityName) {
      lh.activityName
        .split('\n')
        .filter((l) => l.trim())
        .forEach((l) => children.push(center(l, 15)));
    }
    if (!lh.titleOnly && !isJoint && lh.addressLine) children.push(center(lh.addressLine, 15));
    if (!lh.titleOnly && lh.cityStateZip) children.push(center(lh.cityStateZip, 15));
    // Reserve the letterhead's minimum height (the PDF holds a 0.86in floor) so a short letterhead
    // — e.g. a title-only flag heading or a bare DoN line — keeps the body clear of the floating
    // seal's lower corner instead of climbing up into it.
    const lhSubLines = isJoint
      ? state.joint.parties.filter((p) => p.command.trim()).length + (lh.cityStateZip ? 1 : 0)
      : (lh.activityName ? lh.activityName.split('\n').filter((l) => l.trim()).length : 0) +
        (lh.addressLine ? 1 : 0) +
        (lh.cityStateZip ? 1 : 0);
    for (let k = lhSubLines; k < 3; k++) children.push(center(' ', 15));
    children.push(spacer());
  } else if (lh.mode === 'preprinted') {
    // Reserve blank body lines ≈ the rendered N-line letterhead height (small lines ≈ 0.7 of a body
    // line), floored to a standard letterhead — matching the preview/PDF shift threshold.
    for (let i = 0; i < Math.max(5, Math.round(lh.preprintedLines * 0.7)); i++)
      children.push(new Paragraph({ children: [R('')], spacing: { after: 0 } }));
  }

  // Identification block, right-aligned. Gated by includeSsic/includeCode so the PDF, preview, and
  // .docx stay in parity (buildIdent.ssic is ungated, so we gate here). memo = date only + "MEMORANDUM";
  // MFR = the OPTIONAL ssic/code/date block (date-only by default) + "MEMORANDUM FOR THE RECORD";
  // letter = the ssic/code/date block.
  // A kept-but-blank SSIC / code line reserves a blank line (for an admin to fill in); off = dropped.
  const identLines = [
    state.includeSsic ? ident.ssic || ' ' : null,
    state.includeCode ? ident.codeLine || ' ' : null,
    ident.date || null,
  ].filter((l): l is string => l !== null);
  const rightLine = (line: string) =>
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [R(line)], spacing: { after: 0 } });
  // Identification symbols are right-aligned for EVERY type — including the business letter. (¶11-2.1
  // says "upper left", but the manual's own canonical figures 11-2/11-6 show them upper-right with a
  // serial, like a standard letter; we follow the figures + real practice. See signablePdf for the note.)
  if (isJoint) {
    // Fig 7-4: per-command columns spread the FULL width — junior at the LEFT margin, the senior's
    // column left-aligned against the RIGHT margin (width estimated), a third party centered.
    const order = [...state.joint.parties].reverse(); // junior … senior (right)
    const n = order.length;
    const colW = (p: (typeof order)[number]) =>
      Math.max(0, ...[p.shortTitle, p.ssic, p.serial, p.date].map((v) => approxPt(v.trim()))) * 20;
    const CONTENT = Math.round(6.5 * IN);
    // Tab stops for parties 2..n only — the junior column starts at the margin with no tab.
    const pos = (i: number) =>
      i === n - 1
        ? Math.max(0, Math.round(CONTENT - colW(order[i]) - 120))
        : Math.max(0, Math.round((CONTENT - colW(order[i])) / 2));
    const stops = order.slice(1).map((_, k) => ({ type: TabStopType.LEFT, position: pos(k + 1) }));
    const fieldRow = (getter: (p: (typeof order)[number]) => string) =>
      new Paragraph({
        tabStops: stops,
        children: order.flatMap((p, i) =>
          i === 0
            ? [R(getter(p) || ' ')]
            : [new TextRun({ text: '\t', font: FONT, size: SZ }), R(getter(p) || ' ')],
        ),
        spacing: { after: 0 },
      });
    const anyVal = (g: (p: (typeof order)[number]) => string) => order.some((p) => g(p).trim());
    if (anyVal((p) => p.shortTitle)) children.push(fieldRow((p) => p.shortTitle));
    if (anyVal((p) => p.ssic)) children.push(fieldRow((p) => p.ssic));
    if (anyVal((p) => p.serial)) children.push(fieldRow((p) => p.serial));
    if (anyVal((p) => p.date)) children.push(fieldRow((p) => p.date));
  } else if (isMoa) {
    // Dual identification blocks (fig 10-5): party A's column at the left margin, party B's as an
    // internally LEFT-aligned column on the right (the figure shows a left-aligned stack starting
    // ~5.6in, not per-line right justification). One borderless row keeps the columns line-aligned.
    const m = state.moa;
    const moaRows = (
      [
        [m.shortTitleA, m.shortTitleB],
        [state.includeSsic ? ident.ssic || ' ' : '', m.ssicB],
        [state.includeCode ? ident.codeLine || ' ' : '', m.serialB.trim() ? `Ser ${m.serialB.trim()}` : ''],
        [ident.date, m.dateB],
      ] as [string, string][]
    ).filter(([a, b]) => a !== '' || b !== '');
    if (moaRows.length)
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          columnWidths: [Math.round(4.55 * IN), Math.round(1.95 * IN)],
          borders: NO_BORDERS,
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  borders: NO_BORDERS,
                  children: moaRows.map(([a]) => new Paragraph({ children: [R(a || ' ')], spacing: { after: 0 } })),
                }),
                new TableCell({
                  borders: NO_BORDERS,
                  children: moaRows.map(([, b]) => new Paragraph({ children: [R(b || ' ')], spacing: { after: 0 } })),
                }),
              ],
            }),
          ],
        }),
      );
  } else if (isExec) {
    // Executive memo: the date/control block renders BELOW the centered title (figs 12-9/12-11) —
    // drawn in the title phase below. Memo-For keeps its date here (fig 12-14: date, then addressing).
    if (isMemoFor && ident.date) children.push(rightLine(ident.date));
  } else if (identLines.length) {
    children.push(identColumn(identLines));
  }
  if (isMemo) {
    children.push(new Paragraph({ children: [R('MEMORANDUM')], spacing: { before: BLANK, after: BLANK } }));
  } else if (isMfr) {
    children.push(
      new Paragraph({ children: [R('MEMORANDUM FOR THE RECORD')], spacing: { before: BLANK, after: BLANK } }),
    );
  } else if (isMoa) {
    // Centered title block (fig 10-5): title / BETWEEN / party A (senior) / AND / party B.
    const m = state.moa;
    const titleLines = [
      `MEMORANDUM OF ${m.kind === 'UNDERSTANDING' ? 'UNDERSTANDING' : 'AGREEMENT'}`,
      'BETWEEN',
      m.partyA.trim(),
      'AND',
      m.partyB.trim(),
    ].filter(Boolean);
    children.push(spacer());
    titleLines.forEach((l) =>
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [R(l)], spacing: { after: 0 } })),
    );
    children.push(spacer());
  } else if (isJoint) {
    children.push(
      new Paragraph({
        children: [R(`JOINT ${state.joint.kind === 'MEMORANDUM' ? 'MEMORANDUM' : 'LETTER'}`)],
        spacing: { before: BLANK, after: BLANK },
      }),
    );
  } else if (isExec && isMemoFor) {
    // Plain "Memorandum For" (fig 12-14): left-aligned addressing. Exports print only user content
    // (the preview's gray recipient hint is screen-only) — no fabricated recipient.
    if (state.to.trim())
      children.push(
        new Paragraph({
          children: [R(`MEMORANDUM FOR ${state.to.trim()}`)],
          spacing: { before: BLANK, after: BLANK },
        }),
      );
  } else if (isExec) {
    // Figs 12-9/12-11: centered "ACTION MEMO"/"INFO MEMO" title FIRST, then the right-aligned
    // date + control symbol beneath it.
    const em = state.execMemo;
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [R(em.kind === 'INFORMATION' ? 'INFO MEMO' : 'ACTION MEMO', { bold: true })],
        spacing: { before: BLANK, after: BLANK },
      }),
    );
    [ident.date, em.controlLine.trim()].filter((l) => l).forEach((l) => children.push(rightLine(l)));
    children.push(spacer());
  } else {
    children.push(spacer());
  }

  const LBL = Math.round(0.52 * IN);
  const heading = (label: string, content: string, gapBefore = false) =>
    new Paragraph({
      children: [R(label), new TextRun({ text: '\t', font: FONT, size: SZ }), R(content)],
      tabStops: [{ type: TabStopType.LEFT, position: LBL }],
      indent: { left: LBL, hanging: LBL },
      spacing: { before: gapBefore ? BLANK : 0, after: 0 },
    });

  if (isBusiness) {
    // Inside address (a few lines below the date), optional attention line, then salutation or subject.
    const biz = state.business;
    children.push(spacer());
    biz.insideAddress.split('\n').forEach((l) =>
      children.push(new Paragraph({ children: [R(l)], spacing: { after: 0 } })),
    );
    if (biz.attention.trim())
      children.push(
        new Paragraph({
          children: [R(`Attention:  ${biz.attention.trim()}`)],
          spacing: { before: BLANK, after: 0 },
        }),
      );
    if (biz.subjectReplacesSalutation) {
      if (state.subj.trim())
        children.push(
          new Paragraph({
            children: [R(`SUBJECT:  ${state.subj.toUpperCase()}`)],
            spacing: { before: BLANK, after: 0 },
          }),
        );
    } else {
      if (biz.salutation.trim())
        children.push(
          new Paragraph({ children: [R(biz.salutation.trim())], spacing: { before: BLANK, after: 0 } }),
        );
      if (state.subj.trim())
        children.push(
          new Paragraph({
            children: [R(`SUBJECT:  ${state.subj.toUpperCase()}`)],
            spacing: { before: BLANK, after: 0 },
          }),
        );
    }
  } else if (isExec) {
    // Executive memo (Ch 12): FOR:/FROM:/SUBJECT: (Title Case) / Reference(s):, with a wider label
    // column than a naval letter ("SUBJECT:"/"Reference:" don't fit the narrow one).
    const em = state.execMemo;
    const EXEC_LBL = Math.round(0.92 * IN);
    const erow = (label: string, content: string) =>
      new Paragraph({
        children: [R(label), new TextRun({ text: '\t', font: FONT, size: SZ }), R(content)],
        tabStops: [{ type: TabStopType.LEFT, position: EXEC_LBL }],
        indent: { left: EXEC_LBL, hanging: EXEC_LBL },
        spacing: { after: 0 },
      });
    // Figs 12-9/12-11 double-space the FOR:/FROM:/SUBJECT: block — one blank line between entries.
    const entries: [string, string][] = [];
    if (!isMemoFor && state.to.trim()) entries.push(['FOR:', state.to.trim()]);
    if (!isMemoFor && em.from.trim()) entries.push(['FROM:', em.from.trim()]);
    if (state.subj.trim()) entries.push(['SUBJECT:', state.subj.trim()]);
    entries.forEach(([l, v], i) => {
      if (i) children.push(spacer(0));
      children.push(erow(l, v));
    });
    const erefs = state.refs.filter((r) => r.text.trim());
    if (erefs.length) children.push(spacer(0));
    if (erefs.length === 1) children.push(erow('Reference:', erefs[0].text));
    else erefs.forEach((r, i) => children.push(erow(i === 0 ? 'References:' : '', `(${refLetter(i)}) ${r.text}`)));
  } else {
  if (isEndorsement) {
    children.push(
      new Paragraph({
        children: [R(`${state.endorsementNumber} ENDORSEMENT on ${state.endorsementOf}`)],
        spacing: { after: BLANK },
      }),
    );
  }
  // MFR is "for the record" — no addressee, so no From/To/Via.
  if (isJoint) {
    // Joint letter: a From line per command (senior first), then the single To.
    state.joint.parties.forEach((p, i) => {
      if (p.from.trim()) children.push(heading(i === 0 ? 'From:' : '', p.from));
    });
    children.push(spacer(0)); // fig 7-4 marks a blank line between the From: block and To:
    if (state.to) children.push(heading('To:', state.to));
  } else if (!isMfr && !isMoa) {
    // Omit an empty From:/To: line (matches the PDF) — a Distribution-only multiple-address letter
    // (Ch 8-2, Fig 8-2) drops the To: line entirely and lists addressees after the signature.
    // (The MFR has no addressee; the MOA uses its BETWEEN block instead.)
    if (state.from) children.push(heading('From:', state.from));
    if (state.to) children.push(heading('To:', state.to));
    // Multiple-address letter (Ch 8): additional action addressees stack under the To: line.
    state.toAddrs.filter((a) => a.text.trim()).forEach((a) => children.push(heading('', a.text)));
    const via = state.via.filter((v) => v.text.trim());
    if (via.length === 1) children.push(heading('Via:', via[0].text));
    else if (via.length >= 2)
      via.forEach((v, i) => children.push(heading(i === 0 ? 'Via:' : '', `(${i + 1}) ${v.text}`)));
  }

  if (state.subj) children.push(heading('Subj:', state.subj.toUpperCase(), true));

  const refs = state.refs.filter((r) => r.text.trim());
  refs.forEach((r, i) =>
    children.push(heading(i === 0 ? 'Ref:' : '', `(${refLetter(i)}) ${r.text}`, i === 0)),
  );

  const encls = state.encls.filter((e) => e.text.trim());
  encls.forEach((e, i) =>
    children.push(heading(i === 0 ? 'Encl:' : '', `(${i + 1}) ${e.text}`, i === 0)),
  );
  } // end of the non-business heading block

  children.push(spacer());
  flattenBody(state.body, 0, children, cui.enabled && anyCui(state.body), isBusiness || isMemoFor, isExec && !isMemoFor, isMemoFor ? 0.5 : undefined);

  // Signature — left edge at page center. The export leaves the signature space blank so the
  // signer can wet-sign or CAC-sign the PDF in Adobe (no script-font placeholder).
  const sigIndent = Math.round(3.25 * IN);
  // Business letter: a centered "Sincerely," precedes the signature (11-2.8).
  if (isBusiness)
    children.push(
      new Paragraph({
        children: [R(state.business.complimentaryClose.trim() || 'Sincerely,')],
        indent: { left: sigIndent },
        spacing: { before: BLANK, after: 0 },
      }),
    );
  if (isMoa) {
    // Dual signatures (fig 10-5): senior (party A) at the RIGHT column, party B at the left, each over a
    // signature line. Two columns via a left tab stop at the page center.
    const a = state.signature;
    const b = state.moa.signerB;
    const authOf = (s: { authority?: string }) =>
      s.authority === 'by-direction' ? 'By direction' : s.authority === 'acting' ? 'Acting' : '';
    const row = (left: string, right: string, before = 0) =>
      new Paragraph({
        tabStops: [{ type: TabStopType.LEFT, position: sigIndent }],
        children: [R(left), new TextRun({ text: '\t', font: FONT, size: SZ }), R(right)],
        spacing: { before, after: 0 },
      });
    const SIG_LINE = '____________________';
    children.push(row(SIG_LINE, SIG_LINE, SIG_GAP)); // sign above the lines
    children.push(row(b.name, a.name));
    if (b.title || a.title) children.push(row(b.title, a.title));
    if (authOf(b) || authOf(a)) children.push(row(authOf(b), authOf(a)));
  } else if (isJoint) {
    // One signature per command, spread left→right with the senior (party listed first) at the right.
    const order = [...state.joint.parties].reverse(); // junior … senior(right)
    const n = order.length;
    const stops = order
      .slice(1)
      .map((_, i) => ({ type: TabStopType.LEFT, position: Math.round((sigIndent * (i + 1)) / Math.max(1, n - 1)) }));
    const authOf = (s: { authority?: string }) =>
      s.authority === 'by-direction' ? 'By direction' : s.authority === 'acting' ? 'Acting' : '';
    const sigRow = (getter: (p: (typeof order)[number]) => string, before = 0) =>
      new Paragraph({
        tabStops: stops,
        children: order.flatMap((p, i) =>
          i === 0 ? [R(getter(p))] : [new TextRun({ text: '\t', font: FONT, size: SZ }), R(getter(p))],
        ),
        spacing: { before, after: 0 },
      });
    // Fig 7-4: typed names only — no signature rules; junior at the left margin, senior at the
    // naval signature position (page center), a third cosigner between them.
    children.push(sigRow((p) => p.signer.name, SIG_GAP));
    if (order.some((p) => p.signer.title.trim())) children.push(sigRow((p) => p.signer.title));
    if (order.some((p) => authOf(p.signer))) children.push(sigRow((p) => authOf(p.signer)));
  } else if (isExec) {
    // Executive-memo close (Ch 12): RECOMMENDATION + Approve/Disapprove (ACTION only), then
    // COORDINATION, Attachments, and "Prepared by". No signature block — the principal initials.
    const em = state.execMemo;
    const line = (text: string, before = 0) =>
      new Paragraph({ children: [R(text)], spacing: { before, after: 0 } });
    // Exports print ONLY user content — the preview's gray sample hints are screen-only; no
    // fabricated recommendation/attachment strings in a signable document.
    if (isMemoFor) {
      // Fig 12-14: the name-only signature STARTS at page center (naval signature position).
      const sig = (text: string, before = 0) =>
        new Paragraph({ children: [R(text)], indent: { left: sigIndent }, spacing: { before, after: 0 } });
      if (state.signature.name.trim()) children.push(sig(state.signature.name.trim(), SIG_GAP));
      if (state.signature.title.trim()) children.push(sig(state.signature.title.trim()));
      if (em.attachments.trim()) {
        children.push(line('Attachments:', BLANK));
        children.push(line(em.attachments.trim()));
      }
      if (em.cc?.trim()) {
        // Fig 12-15: "cc:" on its own line, each recipient on the line below.
        children.push(line('cc:', BLANK));
        em.cc
          .split(/[\n;]/)
          .map((c) => c.trim())
          .filter(Boolean)
          .forEach((c) => children.push(line(c)));
      }
    } else {
      if (em.kind === 'ACTION' && em.recommendation.trim())
        children.push(line(`RECOMMENDATION:  ${em.recommendation.trim()}`, BLANK));
      // Fig 12-9: the decision line follows the RECOMMENDATION directly (no blank line).
      if (em.kind === 'ACTION' && em.decisionLines)
        children.push(line(`Approve  ${'_'.repeat(18)}      Disapprove  ${'_'.repeat(18)}`));
      if (em.coordination.trim()) children.push(line(`COORDINATION:  ${em.coordination.trim()}`, BLANK));
      if (em.attachments.trim()) {
        children.push(line('Attachments:', BLANK));
        children.push(line(em.attachments.trim()));
      }
      if (em.preparedBy.trim()) children.push(line(`Prepared by:  ${em.preparedBy.trim()}`, BLANK));
    }
  } else {
    const sigLines = [state.signature.name];
    if (state.signature.title) sigLines.push(state.signature.title);
    if (state.signature.authority === 'by-direction') sigLines.push('By direction');
    if (state.signature.authority === 'acting') sigLines.push('Acting');
    sigLines.forEach((line, i) =>
      children.push(
        new Paragraph({
          children: [R(line)],
          indent: { left: sigIndent },
          spacing: { before: i === 0 ? SIG_GAP : 0, after: 0 },
        }),
      ),
    );
  }

  // Business letter: Enclosures + Separate-Mailing notations at the left margin (11-2.10/2.11).
  if (isBusiness) {
    const bizEncls = state.encls.filter((e) => e.text.trim());
    if (bizEncls.length === 1)
      children.push(
        new Paragraph({
          children: [R(`Enclosure:  ${bizEncls[0].text}`)],
          spacing: { before: BLANK, after: 0 },
        }),
      );
    else if (bizEncls.length > 1) {
      // Fig 11-3: the first item rides the label line; later items align under its number.
      children.push(
        new Paragraph({
          children: [R(`Enclosures:  1.  ${bizEncls[0].text}`)],
          spacing: { before: BLANK, after: 0 },
        }),
      );
      bizEncls.slice(1).forEach((e, i) =>
        children.push(
          new Paragraph({ children: [R(`${i + 2}.  ${e.text}`)], indent: { left: 1240 }, spacing: { after: 0 } }),
        ),
      );
    }
    if (state.business.separateMailing.trim())
      children.push(
        new Paragraph({
          children: [R(`Separate Mailing:  ${state.business.separateMailing.trim()}`)],
          spacing: { before: BLANK, after: 0 },
        }),
      );
  }

  // Distribution (Ch 8-2): action addressees, after the signature and above Copy to.
  const distribution = state.distribution.filter((d) => d.text.trim());
  if (distribution.length) {
    children.push(new Paragraph({ children: [R('Distribution:')], spacing: { before: BLANK, after: 0 } }));
    distribution.forEach((d) => children.push(new Paragraph({ children: [R(d.text)], spacing: { after: 0 } })));
  }

  const copyTo = state.copyTo.filter((c) => c.trim());
  if (copyTo.length) {
    children.push(new Paragraph({ children: [R('Copy to:')], spacing: { before: BLANK, after: 0 } }));
    copyTo.forEach((c) => children.push(new Paragraph({ children: [R(c)], spacing: { after: 0 } })));
  }

  // Appended endorsements (Ch 9): collected into their OWN section (added below) so the basic letter's
  // continuation Subj header never bleeds onto an endorsement page. Mirrors the preview + PDF: the
  // endorsement ident block, "Nth ENDORSEMENT on …" line, From/To/Via/Subj, body, signature.
  const endoChildren: (Paragraph | Table)[] = [];
  if (!isEndorsement && state.endorsements.length) {
    const endoSigIndent = Math.round(3.25 * IN);
    const onBasic = `ENDORSEMENT on ${basicLetterId(state, today)}`; // same for every endorsement
    state.endorsements.forEach((e, i) => {
      const ord = ENDORSE_ORD[i] ?? String(i + 1);
      // New-page endorsement identification block (9-2.2: repeat the basic letter's SSIC; the endorser
      // adds its own serial + date). Right-aligned, matching the preview + PDF. The section break starts
      // the first endorsement on a fresh page; later endorsements break the page themselves.
      const eIdent = buildIdent({ ...state, type: 'endorsement', serial: e.serial }, today);
      const eIdLines = [
        eIdent.ssic || ' ',
        e.serial.trim() ? eIdent.codeLine : null,
        eIdent.date || null,
      ].filter((l): l is string => l !== null);
      // 2nd+ endorsements start their own page (the first rides the endorsement section's break).
      if (i > 0) endoChildren.push(new Paragraph({ children: [R('')], pageBreakBefore: true, spacing: { after: 0 } }));
      if (eIdLines.length) endoChildren.push(identColumn(eIdLines));
      endoChildren.push(
        new Paragraph({
          children: [R(`${ord} ${onBasic}`)],
          spacing: { before: eIdLines.length ? BLANK : 0, after: BLANK },
        }),
      );
      // Gate each heading on content, like the PDF — no orphan "To:" labels for empty fields.
      if (e.endorser.trim()) endoChildren.push(heading('From:', e.endorser));
      if (state.to.trim()) endoChildren.push(heading('To:', state.to));
      const evias = remainingVias(state, e.viaId); // Ch 9-2.2: remaining Via addressees
      if (evias.length === 1) endoChildren.push(heading('Via:', evias[0].text));
      else if (evias.length >= 2)
        evias.forEach((v, k) =>
          endoChildren.push(heading(k === 0 ? 'Via:' : '', `(${k + 1}) ${v.text}`)),
        );
      if (state.subj.trim()) endoChildren.push(heading('Subj:', state.subj.toUpperCase(), true));
      endoChildren.push(spacer());
      flattenBody(e.body, 0, endoChildren, cui.enabled && anyCui(e.body));
      const eSigLines = [e.sigName, e.sigTitle].filter(Boolean);
      if (e.authority === 'by-direction') eSigLines.push('By direction');
      if (e.authority === 'acting') eSigLines.push('Acting');
      eSigLines.forEach((line, j) =>
        endoChildren.push(
          new Paragraph({
            children: [R(line)],
            indent: { left: endoSigIndent },
            spacing: { before: j === 0 ? SIG_GAP : 0, after: 0 },
          }),
        ),
      );
    });
  }

  // CUI banner paragraph (centered, bold) — shared by the letter section and each enclosure section.
  // Banner is rendered UPPERCASE to match the preview (CSS text-transform) and the PDF (.toUpperCase()).
  const bannerPara = (text: string) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [R(((text || '').trim() || 'CUI').toUpperCase(), { bold: true })],
    });

  // In-document enclosures (§7) — each appended as its OWN section so it can carry its OWN CUI banner
  // (header/footer) when a package mixes categories; a section break starts each on a new page, marked
  // "Enclosure (n)". Images embed (full fidelity); a multi-page PDF rasterizes to one image per page; a
  // PDF we can't rasterize is noted (a .docx can't carry vector PDF pages — the signable PDF copies them).
  const enclSections: ISectionOptions[] = [];
  state.encls.forEach((e, n) => {
    if (!e.inDocument || !e.file) return;
    const enclKids: Paragraph[] = [];
    const CONTENT_TWIPS = Math.round(9.5 * IN); // 11in page − 0.5in top − 1in bottom
    // "Enclosure (n)" lands lower-right (§7): right-aligned, spacing-before sized so it sits near the
    // bottom margin regardless of image height (a docx frame won't render reliably).
    const mark = (imgTwips: number) =>
      enclKids.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [R(`Enclosure (${n + 1})`)],
          // Reserve ~0.5in below the mark so the spacer never pushes it (and its own line) past the
          // bottom margin onto a near-blank page when the image fills the height.
          spacing: { before: Math.max(BLANK, CONTENT_TWIPS - imgTwips - 720) },
        }),
      );
    const pageImage = (data: Uint8Array, w: number, h: number, kind: 'png' | 'jpg' | 'gif' | 'bmp') => {
      const s = Math.min((6.5 * 96) / w, (8.7 * 96) / h); // fit within the 1-inch margins
      const dispH = Math.round(h * s); // displayed height in px @ 96 DPI
      enclKids.push(
        new Paragraph({
          // the section break already starts page 1 of the enclosure; only break BEFORE later pages
          pageBreakBefore: enclKids.length > 0,
          alignment: AlignmentType.CENTER,
          children: [new ImageRun({ type: kind, data, transformation: { width: Math.round(w * s), height: dispH } })],
          spacing: { after: 0 },
        }),
      );
      return Math.round((dispH / 96) * IN); // displayed height in twips
    };
    if (e.file.type.startsWith('image/')) {
      const bytes = dataUrlToBytes(e.file.dataUrl);
      const sz = imageSize(bytes);
      mark(pageImage(bytes, sz.width, sz.height, imageKind(e.file.type)));
    } else if (enclImages[e.id]?.length) {
      // PDF rasterized to page images in-memory (export/rasterizePdf.ts) — one image per page
      enclImages[e.id].forEach((pg) => mark(pageImage(pg.bytes, pg.width, pg.height, 'png')));
    } else {
      enclKids.push(new Paragraph({ children: [R(e.text || 'Enclosure')], spacing: { after: BLANK } }));
      enclKids.push(new Paragraph({ children: [R(`${e.file.name} — PDF attached separately.`)] }));
      mark(0);
    }
    const banner = e.cuiBanner?.trim() || cui.banner || 'CUI';
    enclSections.push({
      properties: {
        page: {
          size: LETTER,
          margin: { top: Math.round(0.5 * IN), right: IN, bottom: IN, left: IN, header: Math.round(0.25 * IN) },
        },
      },
      headers: cui.enabled ? { default: new Header({ children: [bannerPara(banner)] }) } : undefined,
      // Explicit footer even with CUI off — an undefined footer INHERITS the letter section's
      // page-number footer onto enclosure pages (the PDF excludes enclosure pages from numbering).
      footers: { default: new Footer({ children: cui.enabled ? [bannerPara(banner)] : [spacer(0)] }) },
      children: enclKids,
    });
  });

  // The letter section's CUI header/footer + the designation indicator block in its first-page
  // footer — an internally left-aligned 8-pt column at the right, like the PDF draws it.
  const designationBlock = () =>
    identColumn(
      [
        `Controlled by: ${cui.controlledBy1}`,
        cui.controlledBy2 ? `Controlled by: ${cui.controlledBy2}` : '',
        `CUI Category: ${cui.category}`,
        `Limited Dissemination Control: ${cui.dissemination}`,
        cui.poc ? `POC: ${cui.poc}` : '',
        cui.transmittalNote.trim(), // transmittal-document status note (e.g. "…UNCONTROLLED when separated")
      ].filter(Boolean),
      16,
    );

  const letterBanner = cui.banner || 'CUI';

  // Continuation header (pages 2+): repeat the Subj line (7-2.16) — or, for a business letter, the
  // identification symbols (11-2.14) — to match the preview and the PDF. It rides in the section's
  // DEFAULT header; titlePage gives page 1 its own (Subj-free) header so the repeat never shows there.
  const contIdent = [
    state.includeSsic ? ident.ssic : '',
    state.includeCode ? ident.codeLine : '',
    ident.date,
  ].filter((l) => l.trim());
  const contHeaderParas: (Paragraph | Table)[] = isBusiness
    ? contIdent.length
      ? [identColumn(contIdent)] // fig 11-3 p2: the repeated symbols are a left-aligned stack too
      : []
    : state.subj.trim()
      ? isExec
        ? [
            // Fig 12-15 footnote: exec continuation pages repeat "SUBJECT:" (Title Case, exec label).
            new Paragraph({
              children: [R('SUBJECT:'), new TextRun({ text: '\t', font: FONT, size: SZ }), R(state.subj.trim())],
              tabStops: [{ type: TabStopType.LEFT, position: Math.round(0.92 * IN) }],
              indent: { left: Math.round(0.92 * IN), hanging: Math.round(0.92 * IN) },
              spacing: { after: 0 },
            }),
          ]
        : [heading('Subj:', state.subj.toUpperCase())]
      : [];
  const hasCont = contHeaderParas.length > 0;

  const headers =
    cui.enabled || hasCont
      ? {
          default: new Header({
            children: [
              ...(cui.enabled ? [bannerPara(letterBanner)] : []),
              // Pad the repeated Subj/ident down toward the 1-inch line (7-2.16), then one blank
              // line so the body resumes on the second line below it (fig 7-2).
              ...(hasCont ? [...headerPad(cui.enabled ? 3 : 4), ...contHeaderParas, ...headerPad(1)] : []),
            ],
          }),
          // Page 1 carries the full heading already; show only the CUI banner there (if any).
          ...(cui.enabled ? { first: new Header({ children: [bannerPara(letterBanner)] }) } : {}),
        }
      : undefined;
  // Centered page number on continuation pages only (7-2.16 / 11-2.4: page 1 is unnumbered; numbers
  // start at 2, centered near the bottom). It rides in the DEFAULT footer; the FIRST footer omits it,
  // so titlePage must stay on. Matches the PDF, which numbers from page 2.
  const pageNumberPara = () =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SZ })],
      spacing: { after: 0 },
    });
  const footers = {
    default: new Footer({
      children: [pageNumberPara(), ...(cui.enabled ? [bannerPara(letterBanner)] : [])],
    }),
    first: new Footer({
      children: cui.enabled ? [designationBlock(), bannerPara(letterBanner)] : [spacer(0)],
    }),
  };

  return new Document({
    // No identifying metadata in the exported file: override the docx library's default core
    // properties so the .docx is "silent" — no creator/author, title, subject, description,
    // keywords, or last-modified-by name. (The created/modified TIMESTAMPS are stamped by the
    // library no matter what we pass here, so they're neutralized after packing — see silenceDocx.
    // A signature the user adds later is separate + intended.)
    creator: '',
    title: '',
    subject: '',
    description: '',
    keywords: '',
    lastModifiedBy: '',
    sections: [
      {
        properties: {
          page: {
            size: LETTER,
            // Printed letterhead occupies the 0.5–1in band; plain bond starts at the 1in margin.
            margin: {
              top: lh.mode === 'on' ? Math.round(0.5 * IN) : IN,
              right: IN,
              bottom: IN,
              left: IN,
              header: Math.round(0.25 * IN), // CUI banner rides at ~0.25in like the PDF
            },
          },
          // Always on: page 1 needs a distinct (Subj-free, unnumbered) header/footer from pages 2+.
          titlePage: true,
        },
        headers,
        footers,
        children,
      },
      // Endorsements in their own section so the letter's continuation Subj header doesn't apply to
      // them. No continuation header here; page numbers continue from the letter, centered in the footer.
      ...(endoChildren.length
        ? [
            {
              properties: {
                page: {
                  size: LETTER,
                  margin: { top: IN, right: IN, bottom: IN, left: IN, header: Math.round(0.25 * IN) },
                },
              },
              // Explicit header (empty when no CUI) — an undefined header would INHERIT the letter
              // section's Subj continuation header, bleeding it onto the endorsement pages.
              headers: {
                default: new Header({
                  children: cui.enabled ? [bannerPara(letterBanner)] : [spacer(0)],
                }),
              },
              footers: {
                default: new Footer({
                  children: [pageNumberPara(), ...(cui.enabled ? [bannerPara(letterBanner)] : [])],
                }),
              },
              children: endoChildren,
            },
          ]
        : []),
      ...enclSections,
    ],
  });
}

// The docx library stamps real created/modified timestamps into docProps/core.xml regardless of the
// core-properties options. Blank them to a fixed epoch so the file reveals no creation time. Pure +
// exported for testing; silenceDocx applies it to the packed zip.
export function neutralizeCoreXml(xml: string): string {
  const EPOCH = '1970-01-01T00:00:00Z';
  return xml
    .replace(/(<dcterms:created[^>]*>)[^<]*(<\/dcterms:created>)/, `$1${EPOCH}$2`)
    .replace(/(<dcterms:modified[^>]*>)[^<]*(<\/dcterms:modified>)/, `$1${EPOCH}$2`);
}

// exported for testing — this is the real export's final privacy pass over the packed zip.
export async function silenceDocx(blob: Blob): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const core = zip.file('docProps/core.xml');
  if (core) zip.file('docProps/core.xml', neutralizeCoreXml(await core.async('string')));
  // JSZip preserves each entry's mod-time from the packed zip — the real generation time — so the ZIP
  // local-file-header dates would leak it even though core.xml is neutralized. Pin every entry to the
  // DOS epoch (1980-01-01, the earliest a ZIP date can encode) so nothing carries the build time.
  const fixedDate = new Date('1980-01-01T00:00:00Z');
  Object.values(zip.files).forEach((f) => {
    f.date = fixedDate;
  });
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

// Build the .docx and trigger a browser download.
export async function exportDocx(state: LetterState, today: Date = new Date()): Promise<void> {
  const sealBytes = await loadSealBytes(state);
  // Rasterize any in-document PDF enclosures to page images (in-memory) so Word shows the actual
  // pages, not just a reference. pdf.js lazy-loads only when there's a PDF enclosure to render.
  const enclImages: Record<string, RasterPage[]> = {};
  for (const e of state.encls) {
    if (e.inDocument && e.file && e.file.type === 'application/pdf') {
      try {
        const { rasterizePdf } = await import('./rasterizePdf');
        enclImages[e.id] = await rasterizePdf(dataUrlToBytes(e.file.dataUrl));
      } catch {
        /* leave it out → buildDocxDocument falls back to a reference note */
      }
    }
  }
  const blob = await silenceDocx(await Packer.toBlob(buildDocxDocument(state, today, sealBytes, enclImages)));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = documentFilename(state, 'docx');
  a.click();
  URL.revokeObjectURL(url);
}
