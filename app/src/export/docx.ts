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
} from 'docx';
import type { LetterState, Paragraph as P } from '../types';
import { buildIdent, refLetter } from '../format/identification';
import { paragraphMarker, depthIndentIn } from '../format/paragraphs';

const IN = 1440; // twips per inch
const FONT = 'Times New Roman';
const SZ = 24; // 12pt in half-points
const NAVY = '11337A';
const BLANK = 240; // ~one 12pt blank line

interface RunOpts {
  bold?: boolean;
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

function flattenBody(list: P[], depth: number, out: Paragraph[], portion: boolean): void {
  list.forEach((p, i) => {
    const m = paragraphMarker(depth, i);
    out.push(
      new Paragraph({
        children: [
          R(m.prefix),
          R(m.core, { underline: m.underline }),
          R(m.suffix),
          R('  ' + (portion ? '(CUI) ' : '') + p.text),
        ],
        indent: { firstLine: Math.round(depthIndentIn(depth) * IN) },
        spacing: { after: BLANK },
      }),
    );
    if (p.children.length) flattenBody(p.children, depth + 1, out, portion);
  });
}

export async function exportDocx(state: LetterState, today: Date = new Date()): Promise<void> {
  const ident = buildIdent(state, today);
  const lh = state.letterhead;
  const cui = state.cui;
  const isMemo = state.type === 'memo-from-to';
  const children: Paragraph[] = [];

  // Letterhead: on = print it (text only in v1); preprinted = reserve blank lines; off = none.
  if (lh.mode === 'on') {
    children.push(center(lh.line1, 22));
    if (lh.activityName) children.push(center(lh.activityName, 15));
    if (lh.addressLine) children.push(center(lh.addressLine, 15));
    if (lh.cityStateZip) children.push(center(lh.cityStateZip, 15));
    children.push(spacer());
  } else if (lh.mode === 'preprinted') {
    for (let i = 0; i < 5; i++) children.push(new Paragraph({ children: [R('')], spacing: { after: 0 } }));
  }

  // Identification: memo = date (flush right) + "MEMORANDUM"; letter = SSIC block.
  if (isMemo) {
    if (ident.date)
      children.push(
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [R(ident.date)], spacing: { after: 0 } }),
      );
    children.push(
      new Paragraph({ children: [R('MEMORANDUM')], spacing: { before: BLANK, after: BLANK } }),
    );
  } else {
    const identIndent = Math.round(3.55 * IN);
    [ident.ssic, ident.codeLine, ident.date]
      .filter(Boolean)
      .forEach((line) =>
        children.push(
          new Paragraph({ children: [R(line)], indent: { left: identIndent }, spacing: { after: 0 } }),
        ),
      );
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

  children.push(heading('From:', state.from));
  children.push(heading('To:', state.to));
  const via = state.via.filter((v) => v.text.trim());
  if (via.length === 1) children.push(heading('Via:', via[0].text));
  else if (via.length >= 2)
    via.forEach((v, i) => children.push(heading(i === 0 ? 'Via:' : '', `(${i + 1}) ${v.text}`)));

  children.push(heading('Subj:', state.subj.toUpperCase(), true));

  const refs = state.refs.filter((r) => r.text.trim());
  refs.forEach((r, i) =>
    children.push(heading(i === 0 ? 'Ref:' : '', `(${refLetter(i)}) ${r.text}`, i === 0)),
  );

  const encls = state.encls.filter((e) => e.text.trim());
  encls.forEach((e, i) =>
    children.push(heading(i === 0 ? 'Encl:' : '', `(${i + 1}) ${e.text}`, i === 0)),
  );

  children.push(spacer());
  flattenBody(state.body, 0, children, cui.enabled && cui.portionMarkings);

  // Signature — left edge at page center
  const sigIndent = Math.round(3.25 * IN);
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

  const copyTo = state.copyTo.filter((c) => c.trim());
  if (copyTo.length) {
    children.push(new Paragraph({ children: [R('Copy to:')], spacing: { before: BLANK, after: 0 } }));
    copyTo.forEach((c) => children.push(new Paragraph({ children: [R(c)], spacing: { after: 0 } })));
  }

  // CUI banner (header + footer, repeats on every page via Word's native headers/footers)
  // and the designation indicator block in the first-page footer (lower-right).
  const cuiBanner = () =>
    new Paragraph({ alignment: AlignmentType.CENTER, children: [R(cui.banner || 'CUI', { bold: true })] });
  const designationParas = () =>
    [
      `Controlled by: ${cui.controlledBy1}`,
      cui.controlledBy2 ? `Controlled by: ${cui.controlledBy2}` : '',
      `CUI Category: ${cui.category}`,
      `Distribution/Dissemination Control: ${cui.dissemination}`,
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

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: IN, right: IN, bottom: IN, left: IN } },
          titlePage: cui.enabled,
        },
        headers,
        footers,
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(state.subj || 'naval-letter')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
