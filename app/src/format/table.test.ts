import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { ParaTable } from '../types';
import {
  newTable,
  resolveWidths,
  overflowIn,
  textWidthPt,
  setCell,
  setColWidth,
  dragEdge,
  fitColumn,
  distribute,
  setFit,
  insertCol,
  removeCol,
  moveCol,
  insertRow,
  removeRow,
  setIndent,
  sanitizeTable,
  columnNaturals,
  BODY_W_IN,
  MIN_COL_IN,
} from './table';

const sum = (a: number[]) => Math.round(a.reduce((s, x) => s + x, 0) * 100) / 100;

// A placeholder roster in the shape of a unit-approver letter: header + names/titles/phones.
function roster(fit: ParaTable['fit'] = 'page'): ParaTable {
  let t = newTable(0);
  const data = [
    ['NAME:', 'TITLE:', 'PHONE:'],
    ['Lastname, Firstname A', 'Commanding Officer', '555-555-0100'],
    ['Lastname, Firstname B', 'Assistant Future Operations Officer', '555-555-0101'],
  ];
  data.forEach((cells, r) => cells.forEach((text, c) => (t = setCell(t, t.rows[r].id, c, text))));
  return { ...t, fit };
}

describe('table text metrics', () => {
  // pdf-lib's widthOfTextAtSize() adds the AFM kerning pairs, but drawText() emits a plain Tj with
  // no kerning — so what lands on the page is the sum of the glyph advances. That drawn width is the
  // one a table cell has to hold.
  it('matches the advances pdf-lib draws Times with (glyph by glyph — drawText does not kern)', async () => {
    const doc = await PDFDocument.create();
    const times = await doc.embedFont(StandardFonts.TimesRoman);
    const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
    const drawn = (f: typeof times, s: string) => [...s].reduce((w, ch) => w + f.widthOfTextAtSize(ch, 12), 0);
    for (const s of ['NAME:', 'Assistant Future Operations Officer', '555-555-0100', 'Ünïcødé “quotes” — dash']) {
      expect(textWidthPt(s, 12)).toBeCloseTo(drawn(times, s), 1);
      expect(textWidthPt(s, 12, 'bold')).toBeCloseTo(drawn(bold, s), 1);
    }
  });
});

describe('newTable', () => {
  it('starts as a 3×3 boxed roster with a header, indented like subparagraph text, filling to the margin', () => {
    const t = newTable(0);
    expect(t.cols).toHaveLength(3);
    expect(t.rows).toHaveLength(3);
    expect(t.rows.every((r) => r.cells.length === 3)).toBe(true);
    expect(t.header).toBe(true);
    expect(t.indent).toBe(0.5);
    const w = resolveWidths(t);
    expect(sum(w)).toBe(BODY_W_IN - 0.5); // fills from the indent to the right margin
    expect(new Set(w.map((x) => Math.round(x * 10))).size).toBe(1); // empty → equal columns
  });

  it('indents deeper paragraphs further', () => {
    expect(newTable(1).indent).toBeGreaterThan(newTable(0).indent);
  });
});

describe('resolveWidths', () => {
  it('fit-to-text sizes each column to its longest line and stops short of the margin', () => {
    const t = roster('contents');
    const w = resolveWidths(t);
    expect(sum(w)).toBeLessThan(BODY_W_IN - t.indent);
    const nat = columnNaturals(t).max;
    w.forEach((x, i) => expect(x).toBeCloseTo(nat[i], 2));
    expect(w[1]).toBeGreaterThan(w[2]); // the long title column is the widest
  });

  it('fill-width stretches in proportion to the text, landing exactly on the margin', () => {
    const t = roster('page');
    const w = resolveWidths(t);
    expect(sum(w)).toBe(BODY_W_IN - t.indent);
    expect(w[1]).toBeGreaterThan(w[0]);
  });

  it('wraps rather than overflowing when the text is wider than the page', () => {
    let t = roster('contents');
    t = setCell(t, t.rows[1].id, 1, 'A very long title that keeps going well past what one column could ever hold on a line');
    const w = resolveWidths(t);
    expect(sum(w)).toBe(BODY_W_IN - t.indent);
    expect(overflowIn(t)).toBe(0);
  });

  it('when one column is long, the short columns keep their one-line width and only the long one wraps', () => {
    let t = { ...roster('contents'), indent: 0 };
    t = setCell(t, t.rows[1].id, 1, 'Remarks long enough that this one column alone wants more than the whole text width of the page does');
    const nat = columnNaturals(t).max;
    const w = resolveWidths(t);
    expect(w[0]).toBeCloseTo(nat[0], 2); // the name column is not squeezed into wrapping
    expect(w[2]).toBeCloseTo(nat[2], 2); // nor the phone column
    expect(sum(w)).toBe(BODY_W_IN);
  });

  it('with wrap off, never narrows a column below its longest line — and reports any overflow', () => {
    let t = { ...roster('contents'), wrap: false };
    t = setCell(t, t.rows[1].id, 1, 'A very long title that keeps going well past what one column could ever hold on a line');
    const nat = columnNaturals(t).max;
    resolveWidths(t).forEach((x, i) => expect(x).toBeGreaterThanOrEqual(Math.round(nat[i] * 100) / 100 - 0.01));
    expect(overflowIn(t)).toBeGreaterThan(0);
  });

  it('fixed widths are used as typed; a fixed table never runs past the margin with wrap on', () => {
    let t = setFit(roster('page'), 'fixed');
    const before = resolveWidths(t);
    expect(sum(before)).toBe(BODY_W_IN - t.indent); // freezing keeps the widths on the page
    t = setIndent(t, 2); // less room than the frozen widths need
    expect(sum(resolveWidths(t))).toBe(BODY_W_IN - 2);
  });
});

describe('manual sizing', () => {
  it('a typed width is held to the room before the right margin', () => {
    const t = setColWidth(roster('page'), 0, 9);
    expect(t.fit).toBe('fixed');
    const w = resolveWidths(t);
    expect(sum(w)).toBeLessThanOrEqual(BODY_W_IN - t.indent + 0.001);
    const t2 = setColWidth(t, 2, 0.05);
    expect(resolveWidths(t2)[2]).toBe(MIN_COL_IN);
  });

  it('dragging an inner edge trades width between neighbours; the table keeps its width', () => {
    const t = setFit(roster('page'), 'fixed');
    const start = resolveWidths(t);
    const t2 = dragEdge(t, start, 0, 0.5);
    const w = resolveWidths(t2);
    expect(w[0]).toBeCloseTo(start[0] + 0.5, 2);
    expect(w[1]).toBeCloseTo(start[1] - 0.5, 2);
    expect(sum(w)).toBeCloseTo(sum(start), 2);
  });

  it('dragging the outer edge narrows the table, and can never push it past the margin', () => {
    const t = setFit(roster('page'), 'fixed');
    const start = resolveWidths(t);
    expect(sum(resolveWidths(dragEdge(t, start, 2, -0.5)))).toBeCloseTo(sum(start) - 0.5, 2);
    expect(sum(resolveWidths(dragEdge(t, start, 2, 5)))).toBe(BODY_W_IN - t.indent);
  });

  it('fit-one-column and distribute', () => {
    const t = setFit(roster('page'), 'fixed');
    const fitted = resolveWidths(fitColumn(t, 2))[2];
    expect(fitted).toBeCloseTo(columnNaturals(t).max[2], 1);
    const even = resolveWidths(distribute(t));
    expect(Math.max(...even) - Math.min(...even)).toBeLessThan(0.02);
  });

  it('inserting a column into a fixed table splits its neighbour rather than overflowing', () => {
    const t = setFit(roster('page'), 'fixed');
    const t2 = insertCol(t, 1);
    expect(t2.cols).toHaveLength(4);
    expect(t2.rows.every((r) => r.cells.length === 4 && r.cells[1] === '')).toBe(true);
    expect(sum(resolveWidths(t2))).toBeCloseTo(sum(resolveWidths(t)), 1);
  });

  it('column and row edits keep every row the same length', () => {
    let t = roster();
    t = removeCol(t, 0);
    expect(t.rows.every((r) => r.cells.length === 2 && r.cells[0] !== 'NAME:')).toBe(true);
    t = moveCol(t, 0, 1);
    expect(t.rows[0].cells).toEqual(['PHONE:', 'TITLE:']);
    t = insertRow(t, 1);
    expect(t.rows[1].cells).toEqual(['', '']);
    t = removeRow(t, t.rows[1].id);
    expect(t.rows).toHaveLength(3);
  });
});

describe('sanitizeTable', () => {
  const budget = () => ({ cells: 0 });
  it('coerces a hand-edited table: pads rows, clamps numbers, drops unknown enums', () => {
    const t = sanitizeTable(
      {
        cols: [{ id: 'a', width: 99, align: 'justify' }, { width: 'wide' }],
        rows: [{ cells: ['x'] }, { cells: [1, 'y', 'extra'], height: -4 }, 'junk'],
        borders: 'dotted',
        fit: 'fixed',
        fontSize: 72,
        indent: 99,
      },
      budget(),
      100,
    )!;
    expect(t.cols).toHaveLength(2);
    expect(t.cols[0].width).toBe(20);
    expect(t.cols[0].align).toBe('left');
    expect(t.rows.map((r) => r.cells)).toEqual([['x', ''], ['', 'y']]);
    expect(t.rows[1].height).toBe(0);
    expect(t.borders).toBe('columns');
    expect(t.fontSize).toBe(12);
    expect(t.indent).toBeLessThan(BODY_W_IN);
  });

  it('drops a table with no columns or no rows, and enforces the cell budget', () => {
    expect(sanitizeTable({ cols: [], rows: [{ cells: [] }] }, budget(), 100)).toBeUndefined();
    expect(sanitizeTable({ cols: [{}], rows: [] }, budget(), 100)).toBeUndefined();
    expect(sanitizeTable('nope', budget(), 100)).toBeUndefined();
    const big = { cols: [{}, {}], rows: Array.from({ length: 60 }, () => ({ cells: ['a', 'b'] })) };
    expect(() => sanitizeTable(big, budget(), 100)).toThrow();
  });
});
