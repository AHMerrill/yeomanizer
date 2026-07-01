import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  TabStopType,
  UnderlineType,
  Header,
  Footer,
  PageNumber,
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
  out: Paragraph[],
  portionActive: boolean,
  business = false,
  execBullet = false,
): void {
  list.forEach((p, i) => {
    const m = paragraphMarker(depth, i);
    // Business main paras are unnumbered; exec-memo main paras are bulleted ("•"). Both shift the
    // ladder one level deeper for subparagraphs (11-2.6 / Ch 12).
    const noMark = business && depth === 0;
    const bulletTop = execBullet && depth === 0;
    const mark = portionActive ? (p.cui ? '(CUI) ' : '(U) ') : '';
    const indentIn = business || execBullet ? depthIndentIn(depth + 1) : depthIndentIn(depth);
    out.push(
      new Paragraph({
        children: [
          ...(noMark
            ? [R(mark)]
            : bulletTop
              ? [R('•  ' + mark)]
              : [R(m.prefix), R(m.core, { underline: m.underline }), R(m.suffix), R('  ' + mark)]),
          ...(p.title ? [R(p.title, { underline: true }), R('.  ')] : []),
          ...parseInline(p.text).map((r) =>
            R(r.text, { bold: r.bold, italics: r.italic, underline: r.underline }),
          ),
        ],
        indent: { firstLine: Math.round(indentIn * IN) },
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
  const children: Paragraph[] = [];

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
    if (isJoint) {
      // Joint letter: each command on its own line (senior first).
      state.joint.parties.forEach((p) => p.command.trim() && children.push(center(p.command, 15)));
    } else if (lh.activityName) {
      lh.activityName
        .split('\n')
        .filter((l) => l.trim())
        .forEach((l) => children.push(center(l, 15)));
    }
    if (!isJoint && lh.addressLine) children.push(center(lh.addressLine, 15));
    if (lh.cityStateZip) children.push(center(lh.cityStateZip, 15));
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
    // Per-command identification columns at the right (senior rightmost), via tab stops (fig 7-4).
    const order = [...state.joint.parties].reverse(); // junior … senior (right)
    const n = order.length;
    // A TIGHT block of columns near the right margin (~1.1in apart), senior rightmost — not spread
    // across the page (a wide spread overflows the margin and wraps the right column).
    const pos = (i: number) => Math.round((5.5 - (n - 1 - i) * 1.1) * IN);
    const stops = order.map((_, i) => ({ type: TabStopType.LEFT, position: pos(i) }));
    const fieldRow = (getter: (p: (typeof order)[number]) => string) =>
      new Paragraph({
        tabStops: stops,
        children: order.flatMap((p) => [new TextRun({ text: '\t', font: FONT, size: SZ }), R(getter(p) || ' ')]),
        spacing: { after: 0 },
      });
    const anyVal = (g: (p: (typeof order)[number]) => string) => order.some((p) => g(p).trim());
    if (anyVal((p) => p.shortTitle)) children.push(fieldRow((p) => p.shortTitle));
    if (anyVal((p) => p.ssic)) children.push(fieldRow((p) => p.ssic));
    if (anyVal((p) => p.serial)) children.push(fieldRow((p) => p.serial));
    if (anyVal((p) => p.date)) children.push(fieldRow((p) => p.date));
  } else if (isMoa) {
    // Dual identification blocks (fig 10-5): party A at the left, party B right-aligned at the right
    // margin (via a RIGHT tab stop). Rows pair the two parties so their short title / SSIC / serial /
    // date line up; party A reuses the shared identification, party B keeps its own.
    const m = state.moa;
    const moaStop = { type: TabStopType.RIGHT, position: Math.round(6.5 * IN) };
    const row = (a: string, b: string) =>
      new Paragraph({
        tabStops: [moaStop],
        children: [R(a), new TextRun({ text: '\t', font: FONT, size: SZ }), R(b)],
        spacing: { after: 0 },
      });
    const rows: [string, string][] = [
      [m.shortTitleA, m.shortTitleB],
      [state.includeSsic ? ident.ssic || ' ' : '', m.ssicB],
      [state.includeCode ? ident.codeLine || ' ' : '', m.serialB.trim() ? `Ser ${m.serialB.trim()}` : ''],
      [ident.date, m.dateB],
    ];
    rows.forEach(([a, b]) => {
      if (a !== '' || b !== '') children.push(row(a, b));
    });
  } else if (isExec) {
    // Executive memo (Ch 12): a right-aligned date + control symbol ("UNSECNAV ____").
    const em = state.execMemo;
    [ident.date, em.controlLine.trim()].filter((l) => l).forEach((l) => children.push(rightLine(l)));
  } else {
    identLines.forEach((line) => children.push(rightLine(line)));
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
  } else if (isExec) {
    // Centered "ACTION MEMO" / "INFO MEMO" title (fig 12-9 / 12-11).
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [R(state.execMemo.kind === 'INFORMATION' ? 'INFO MEMO' : 'ACTION MEMO', { bold: true })],
        spacing: { before: BLANK, after: BLANK },
      }),
    );
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
    if (state.to) children.push(erow('FOR:', state.to));
    if (em.from.trim()) children.push(erow('FROM:', em.from.trim()));
    if (state.subj.trim()) children.push(erow('SUBJECT:', state.subj.trim()));
    const erefs = state.refs.filter((r) => r.text.trim());
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
  flattenBody(state.body, 0, children, cui.enabled && anyCui(state.body), isBusiness, isExec);

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
    children.push(row(SIG_LINE, SIG_LINE, 3 * BLANK)); // sign above the lines
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
    const SIG_LINE = '____________________';
    children.push(sigRow(() => SIG_LINE, 3 * BLANK));
    children.push(sigRow((p) => p.signer.name));
    if (order.some((p) => p.signer.title.trim())) children.push(sigRow((p) => p.signer.title));
    if (order.some((p) => authOf(p.signer))) children.push(sigRow((p) => authOf(p.signer)));
  } else if (isExec) {
    // Executive-memo close (Ch 12): RECOMMENDATION + Approve/Disapprove (ACTION only), then
    // COORDINATION, Attachments, and "Prepared by". No signature block — the principal initials.
    const em = state.execMemo;
    const line = (text: string, before = 0) =>
      new Paragraph({ children: [R(text)], spacing: { before, after: 0 } });
    if (em.kind === 'ACTION') {
      children.push(
        line(`RECOMMENDATION:  ${em.recommendation.trim() || 'That SECNAV sign the action at TAB A.'}`, BLANK),
      );
      if (em.decisionLines)
        children.push(line(`Approve  ${'_'.repeat(18)}      Disapprove  ${'_'.repeat(18)}`, BLANK));
    }
    children.push(line(`COORDINATION:  ${em.coordination.trim() || 'None'}`, BLANK));
    children.push(line('Attachments:', BLANK));
    children.push(line(em.attachments.trim() || 'As stated'));
    if (em.preparedBy.trim()) children.push(line(`Prepared by:  ${em.preparedBy.trim()}`, BLANK));
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
          spacing: { before: i === 0 ? 3 * BLANK : 0, after: 0 },
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
      children.push(new Paragraph({ children: [R('Enclosures:')], spacing: { before: BLANK, after: 0 } }));
      bizEncls.forEach((e, i) =>
        children.push(new Paragraph({ children: [R(`${i + 1}.  ${e.text}`)], spacing: { after: 0 } })),
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
  const endoChildren: Paragraph[] = [];
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
      eIdLines.forEach((line, k) =>
        endoChildren.push(
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            pageBreakBefore: k === 0 && i > 0,
            children: [R(line)],
            spacing: { after: 0 },
          }),
        ),
      );
      endoChildren.push(
        new Paragraph({
          pageBreakBefore: eIdLines.length === 0 && i > 0,
          children: [R(`${ord} ${onBasic}`)],
          spacing: { before: eIdLines.length ? BLANK : 0, after: BLANK },
        }),
      );
      endoChildren.push(heading('From:', e.endorser));
      endoChildren.push(heading('To:', state.to));
      const evias = remainingVias(state, e.viaId); // Ch 9-2.2: remaining Via addressees
      if (evias.length === 1) endoChildren.push(heading('Via:', evias[0].text));
      else if (evias.length >= 2)
        evias.forEach((v, k) =>
          endoChildren.push(heading(k === 0 ? 'Via:' : '', `(${k + 1}) ${v.text}`)),
        );
      endoChildren.push(heading('Subj:', state.subj.toUpperCase(), true));
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
            spacing: { before: j === 0 ? 3 * BLANK : 0, after: 0 },
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
      properties: { page: { margin: { top: Math.round(0.5 * IN), right: IN, bottom: IN, left: IN } } },
      headers: cui.enabled ? { default: new Header({ children: [bannerPara(banner)] }) } : undefined,
      footers: cui.enabled ? { default: new Footer({ children: [bannerPara(banner)] }) } : undefined,
      children: enclKids,
    });
  });

  // The letter section's CUI header/footer + the designation indicator block in its first-page footer.
  const designationParas = () =>
    [
      `Controlled by: ${cui.controlledBy1}`,
      cui.controlledBy2 ? `Controlled by: ${cui.controlledBy2}` : '',
      `CUI Category: ${cui.category}`,
      `Limited Dissemination Control: ${cui.dissemination}`,
      cui.poc ? `POC: ${cui.poc}` : '',
      cui.transmittalNote.trim(), // transmittal-document status note (e.g. "…UNCONTROLLED when separated")
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

  const letterBanner = cui.banner || 'CUI';

  // Continuation header (pages 2+): repeat the Subj line (7-2.16) — or, for a business letter, the
  // identification symbols (11-2.14) — to match the preview and the PDF. It rides in the section's
  // DEFAULT header; titlePage gives page 1 its own (Subj-free) header so the repeat never shows there.
  const contIdent = [
    state.includeSsic ? ident.ssic : '',
    state.includeCode ? ident.codeLine : '',
    ident.date,
  ].filter((l) => l.trim());
  const contHeaderParas: Paragraph[] = isBusiness
    ? contIdent.map(
        (l) => new Paragraph({ alignment: AlignmentType.RIGHT, children: [R(l)], spacing: { after: 0 } }),
      )
    : state.subj.trim()
      ? [heading('Subj:', state.subj.toUpperCase())]
      : [];
  const hasCont = contHeaderParas.length > 0;

  const headers =
    cui.enabled || hasCont
      ? {
          default: new Header({
            children: [...(cui.enabled ? [bannerPara(letterBanner)] : []), ...contHeaderParas],
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
      children: cui.enabled ? [...designationParas(), bannerPara(letterBanner)] : [spacer(0)],
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
          page: { margin: { top: Math.round(0.5 * IN), right: IN, bottom: IN, left: IN } },
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
                page: { margin: { top: Math.round(0.5 * IN), right: IN, bottom: IN, left: IN } },
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

async function silenceDocx(blob: Blob): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const core = zip.file('docProps/core.xml');
  if (core) zip.file('docProps/core.xml', neutralizeCoreXml(await core.async('string')));
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
