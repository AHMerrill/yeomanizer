// Body tables through every output: the .json round-trip (lossless, and hostile input sanitized),
// the PDF (cells drawn, header repeated on a page break, metadata still silent), the .docx (a real
// fixed-layout Word table with the resolved widths, indent, repeating header and row heights), and
// the local PII / proofread passes (which must see text inside cells).
import { describe, it, expect } from 'vitest';
import { inflateSync } from 'node:zlib';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { buildSignablePdf } from './signablePdf';
import { buildDocxDocument } from './docx';
import { serializeProject, parseProject } from './roundtrip';
import { defaultState } from '../defaultState';
import { newTable, setCell, insertRow, resolveWidths, setRowHeight } from '../format/table';
import { detectPii } from '../format/pii';
import { proofread } from '../format/proofread';
import type { LetterState, ParaTable } from '../types';

const today = new Date(2006, 8, 7);

function table(rows: string[][], over: Partial<ParaTable> = {}): ParaTable {
  let t = newTable(0);
  while (t.rows.length < rows.length) t = insertRow(t, t.rows.length);
  rows.forEach((cells, r) => cells.forEach((text, c) => (t = setCell(t, t.rows[r].id, c, text))));
  return { ...t, ...over };
}

const roster = table([
  ['NAME:', 'TITLE:', 'PHONE:'],
  ['Doe, Jordan A', 'Commanding Officer', '555-555-0101'],
  ['Roe, Casey B', 'Operations Officer', '555-555-0102'],
]);

const letter = (t: ParaTable, over: Partial<LetterState> = {}): LetterState => ({
  ...defaultState,
  from: 'Commanding Officer, USS Test',
  to: 'Chief of Naval Operations',
  subj: 'TABLE TEST',
  body: [
    { id: 'p1', text: 'Request access for the following members.', children: [], table: t },
    { id: 'p2', text: 'Closing paragraph.', children: [] },
  ],
  ...over,
});

// Drawn text out of the Flate-compressed, hex-encoded pdf-lib content streams (see signablePdf.test.ts).
function pdfText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString('latin1');
  let all = '';
  const re = /(?<!end)stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const start = m.index + m[0].length;
    let e = raw.indexOf('endstream', start);
    if (e < 0) continue;
    while (e > start && (raw[e - 1] === '\n' || raw[e - 1] === '\r')) e--;
    try {
      all += inflateSync(Buffer.from(raw.slice(start, e), 'latin1')).toString('latin1');
    } catch {
      /* not a flate stream */
    }
  }
  return all.replace(/<([0-9A-Fa-f]{2,})>/g, (_, h: string) =>
    (h.match(/../g) ?? []).map((b) => String.fromCharCode(parseInt(b, 16))).join(''),
  );
}

async function docXml(state: LetterState): Promise<string> {
  const buf = await Packer.toBuffer(buildDocxDocument(state, today));
  return (await (await JSZip.loadAsync(buf)).file('word/document.xml')?.async('string')) ?? '';
}

describe('tables — .json round-trip', () => {
  it('serialize → parse keeps the table exactly', () => {
    const s = letter({ ...setRowHeight(roster, roster.rows[1].id, 0.4), fit: 'fixed', borders: 'grid', wrap: false, fontSize: 10 });
    expect(parseProject(serializeProject(s))).toEqual(s);
  });

  it('a table in an endorsement body round-trips too', () => {
    const s: LetterState = {
      ...letter(roster),
      endorsements: [
        {
          id: 'e1',
          endorser: 'CO',
          serial: '',
          body: [{ id: 'eb', text: 'Forwarded.', children: [], table: roster }],
          sigName: '',
          sigTitle: '',
          authority: 'none',
        },
      ],
    };
    expect(parseProject(serializeProject(s))?.endorsements[0].body[0].table).toEqual(roster);
  });

  it('a hostile table is coerced, and a file past the cell cap is rejected', () => {
    const junk = JSON.parse(serializeProject(letter(roster)));
    junk.state.body[0].table.rows[0].cells = [{ evil: true }, 7];
    junk.state.body[0].table.cols[0].width = 'NaN';
    junk.state.body[0].table.borders = '<script>';
    const t = parseProject(JSON.stringify(junk))!.body[0].table!;
    expect(t.rows[0].cells).toEqual(['', '', '']);
    expect(t.borders).toBe('columns');
    expect(typeof t.cols[0].width).toBe('number');

    const huge = JSON.parse(serializeProject(letter(roster)));
    const cols = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, width: 1, align: 'left' }));
    const rows = Array.from({ length: 200 }, (_, i) => ({ id: `r${i}`, cells: Array(10).fill('x'), height: 0 }));
    huge.state.body = Array.from({ length: 11 }, (_, i) => ({ id: `p${i}`, text: '', children: [], table: { cols, rows } }));
    expect(parseProject(JSON.stringify(huge))).toBeNull();
  });
});

describe('tables — PDF', () => {
  it('a letter re-imported from its .json renders a byte-identical PDF', async () => {
    const s = letter({ ...roster, borders: 'grid' });
    const direct = await buildSignablePdf(s, today);
    const again = await buildSignablePdf(parseProject(serializeProject(s))!, today);
    expect(Buffer.from(again).equals(Buffer.from(direct))).toBe(true);
  });


  it('draws every cell, and the paragraph after the table still follows it', async () => {
    const text = pdfText(await buildSignablePdf(letter(roster), today));
    // pdf-lib draws each word as its own text run, so check words, not whole phrases.
    for (const word of ['NAME:', 'Jordan', 'Operations', '555-555-0102', 'Closing']) expect(text).toContain(word);
  });

  it('a table that spills onto the next page repeats its header row there, and the export stays silent', async () => {
    const rows = [['UNIQUEHEADER', 'Name']];
    for (let i = 0; i < 70; i++) rows.push([`R${i}`, `Person ${i}`]);
    const bytes = await buildSignablePdf(letter(table(rows)), today);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const pages = doc.getPageCount();
    expect(pages).toBeGreaterThan(1);
    const headers = pdfText(bytes).split('UNIQUEHEADER').length - 1;
    expect(headers).toBeGreaterThanOrEqual(2); // drawn on the first page AND repeated on the next
    expect(headers).toBeLessThanOrEqual(pages);
    expect(doc.getProducer() ?? '').toBe('');
  });
});

describe('tables — .docx', () => {
  it('is a fixed-layout Word table with the resolved widths, indent, and a repeating header row', async () => {
    const xml = await docXml(letter(roster));
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('<w:tblLayout w:type="fixed"/>');
    expect(xml).toContain(`<w:tblInd w:type="dxa" w:w="${Math.round(roster.indent * 1440)}"/>`);
    for (const w of resolveWidths(roster)) expect(xml).toContain(`<w:gridCol w:w="${Math.round(w * 1440)}"/>`);
    expect(xml).toContain('<w:tblHeader/>');
    expect(xml).toContain('<w:cantSplit/>');
    for (const cell of ['NAME:', 'Doe, Jordan A', '555-555-0102']) expect(xml).toContain(cell);
  });

  it('a minimum row height becomes Word\'s "at least"', async () => {
    const t = setRowHeight(roster, roster.rows[1].id, 0.5);
    expect(await docXml(letter(t))).toContain('<w:trHeight w:val="720" w:hRule="atLeast"/>');
  });

  it('no header row → no repeating header', async () => {
    expect(await docXml(letter({ ...roster, header: false }))).not.toContain('<w:tblHeader/>');
  });
});

describe('tables — local PII scan and proofread', () => {
  it('the PII scan sees an SSN typed into a table cell', () => {
    const t = table([['Name', 'SSN'], ['Doe', '123-45-6789']]);
    expect(detectPii(letter(t)).some((h) => h.kind === 'Social Security Number')).toBe(true);
  });

  it('proofread flags a table that runs past the right margin (wrap off), and passes one that fits', () => {
    const long = table([['Item', 'Description'], ['1', 'A description far too long to sit on one line between the margins of the page without wrapping']]);
    expect(proofread(letter({ ...long, wrap: false })).find((c) => c.id === 'table-margin')?.status).toBe('warn');
    expect(proofread(letter(long)).find((c) => c.id === 'table-margin')?.status).toBe('pass');
  });

  it('a paragraph holding only a table still counts as body content', () => {
    const s: LetterState = { ...letter(roster), body: [{ id: 'p', text: '', children: [], table: roster }] };
    expect(proofread(s).find((c) => c.id === 'body')?.status).toBe('pass');
  });
});
