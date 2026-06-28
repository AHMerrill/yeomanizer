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
  ImageRun,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
  TextWrappingType,
} from 'docx';
import type { LetterState, Paragraph as P } from '../types';
import type { RasterPage } from './rasterizePdf';
import { documentFilename } from '../format/filename';
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
  if (lh.mode !== 'on' || lh.seal === 'none') return undefined;
  const src =
    lh.seal === 'dow'
      ? '/dow-seal.png'
      : lh.seal === 'dod'
        ? '/dod-seal.png'
        : lh.seal === 'dod-color'
          ? '/dod-seal.svg'
          : '/don-seal.svg';
  try {
    if (src.endsWith('.png')) return await (await fetch(src)).arrayBuffer();
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('seal load failed'));
      img.src = src;
    });
    const c = document.createElement('canvas');
    c.width = 300;
    c.height = 300;
    c.getContext('2d')?.drawImage(img, 0, 0, 300, 300);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
    return blob ? await blob.arrayBuffer() : undefined;
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
): void {
  list.forEach((p, i) => {
    const m = paragraphMarker(depth, i);
    // Business letter: main paragraphs are unnumbered; the ladder shifts one level deeper (11-2.6).
    const noMark = business && depth === 0;
    const mark = portionActive ? (p.cui ? '(CUI) ' : '(U) ') : '';
    const indentIn = business ? depthIndentIn(depth + 1) : depthIndentIn(depth);
    out.push(
      new Paragraph({
        children: [
          ...(noMark
            ? [R(mark)]
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
    if (p.children.length) flattenBody(p.children, depth + 1, out, portionActive, business);
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
    if (lh.activityName)
      lh.activityName
        .split('\n')
        .filter((l) => l.trim())
        .forEach((l) => children.push(center(l, 15)));
    if (lh.addressLine) children.push(center(lh.addressLine, 15));
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
  const leftLine = (line: string) =>
    new Paragraph({ alignment: AlignmentType.LEFT, children: [R(line)], spacing: { after: 0 } });
  if (isMemo) {
    if (ident.date) children.push(rightLine(ident.date));
    children.push(new Paragraph({ children: [R('MEMORANDUM')], spacing: { before: BLANK, after: BLANK } }));
  } else if (isMfr) {
    identLines.forEach((line) => children.push(rightLine(line)));
    children.push(
      new Paragraph({ children: [R('MEMORANDUM FOR THE RECORD')], spacing: { before: BLANK, after: BLANK } }),
    );
  } else if (isBusiness) {
    // Business letter: identification symbols at the upper LEFT (11-2.1).
    identLines.forEach((line) => children.push(leftLine(line)));
    children.push(spacer());
  } else {
    identLines.forEach((line) => children.push(rightLine(line)));
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
  if (!isMfr) {
    children.push(heading('From:', state.from));
    children.push(heading('To:', state.to));
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
  flattenBody(state.body, 0, children, cui.enabled && anyCui(state.body), isBusiness);

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

  const copyTo = state.copyTo.filter((c) => c.trim());
  if (copyTo.length) {
    children.push(new Paragraph({ children: [R('Copy to:')], spacing: { before: BLANK, after: 0 } }));
    copyTo.forEach((c) => children.push(new Paragraph({ children: [R(c)], spacing: { after: 0 } })));
  }

  // Appended endorsements (Ch 9): each starts a new page and mirrors the preview — endorsement
  // line, From/To/Subj, body, signature — so the Word export includes them just like the PDF.
  if (!isEndorsement && state.endorsements.length) {
    const endoSigIndent = Math.round(3.25 * IN);
    const onBasic = `ENDORSEMENT on ${basicLetterId(state, today)}`; // same for every endorsement
    state.endorsements.forEach((e, i) => {
      const ord = ENDORSE_ORD[i] ?? String(i + 1);
      children.push(
        new Paragraph({
          pageBreakBefore: true,
          children: [R(`${ord} ${onBasic}`)],
          spacing: { after: BLANK },
        }),
      );
      children.push(heading('From:', e.endorser));
      children.push(heading('To:', state.to));
      const evias = remainingVias(state, e.viaId); // Ch 9-2.2: remaining Via addressees
      if (evias.length === 1) children.push(heading('Via:', evias[0].text));
      else if (evias.length >= 2)
        evias.forEach((v, k) =>
          children.push(heading(k === 0 ? 'Via:' : '', `(${k + 1}) ${v.text}`)),
        );
      children.push(heading('Subj:', state.subj.toUpperCase(), true));
      children.push(spacer());
      flattenBody(e.body, 0, children, cui.enabled && anyCui(e.body));
      const eSigLines = [e.sigName, e.sigTitle].filter(Boolean);
      if (e.authority === 'by-direction') eSigLines.push('By direction');
      if (e.authority === 'acting') eSigLines.push('Acting');
      eSigLines.forEach((line, j) =>
        children.push(
          new Paragraph({
            children: [R(line)],
            indent: { left: endoSigIndent },
            spacing: { before: j === 0 ? 3 * BLANK : 0, after: 0 },
          }),
        ),
      );
    });
  }

  // In-document enclosures (§7) — appended after the body/endorsements, each on its own page,
  // marked "Enclosure (n)". Images embed (full fidelity); PDFs are referenced, since a .docx
  // can't carry vector PDF pages (matches the preview's note — the signable PDF copies them).
  state.encls.forEach((e, n) => {
    if (!e.inDocument || !e.file) return;
    // "Enclosure (n)" lands at the lower-right (§7): right-aligned, with spacing-before sized so it
    // sits near the bottom margin regardless of image height (a docx frame won't render reliably).
    const CONTENT_TWIPS = Math.round(9.5 * IN); // 11in page − 0.5in top − 1in bottom
    const mark = (imgTwips: number) =>
      children.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [R(`Enclosure (${n + 1})`)],
          spacing: { before: Math.max(BLANK, CONTENT_TWIPS - imgTwips - 300) },
        }),
      );
    const pageImage = (data: Uint8Array, w: number, h: number, kind: 'png' | 'jpg' | 'gif' | 'bmp') => {
      const s = Math.min((6.5 * 96) / w, (8.7 * 96) / h); // fit within the 1-inch margins
      const dispH = Math.round(h * s); // displayed height in px @ 96 DPI
      children.push(
        new Paragraph({
          pageBreakBefore: true,
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
      children.push(
        new Paragraph({ pageBreakBefore: true, children: [R(e.text || 'Enclosure')], spacing: { after: BLANK } }),
      );
      children.push(new Paragraph({ children: [R(`${e.file.name} — PDF attached separately.`)] }));
      mark(0);
    }
  });

  // CUI banner (header + footer, repeats on every page via Word's native headers/footers)
  // and the designation indicator block in the first-page footer (lower-right).
  const cuiBanner = () =>
    new Paragraph({ alignment: AlignmentType.CENTER, children: [R(cui.banner || 'CUI', { bold: true })] });
  const designationParas = () =>
    [
      `Controlled by: ${cui.controlledBy1}`,
      cui.controlledBy2 ? `Controlled by: ${cui.controlledBy2}` : '',
      `CUI Category: ${cui.category}`,
      `Limited Dissemination Control: ${cui.dissemination}`,
      cui.poc ? `POC: ${cui.poc}` : '',
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

  const headers = cui.enabled
    ? { default: new Header({ children: [cuiBanner()] }), first: new Header({ children: [cuiBanner()] }) }
    : undefined;
  const footers = cui.enabled
    ? {
        default: new Footer({ children: [cuiBanner()] }),
        first: new Footer({ children: [...designationParas(), cuiBanner()] }),
      }
    : undefined;

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
          titlePage: cui.enabled,
        },
        headers,
        footers,
        children,
      },
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
