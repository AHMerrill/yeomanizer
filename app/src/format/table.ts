// Tables inside body paragraphs: the model operations, and the ONE place column widths are decided.
// The preview, the PDF and the .docx all call resolveWidths(), so a table measures the same in every
// output. Autofit measures text with the Times metrics the PDF draws with (timesMetrics.ts); Times
// New Roman is metric-compatible, so Word and the browser wrap to the same widths.
import type { LetterState, Paragraph, ParaTable, ParaTableCol, ParaTableRow } from '../types';
import { uid } from '../defaultState';
import { parseInline } from './inline';
import { depthIndentIn } from './paragraphs';
import { setTable } from './tree';
import { TIMES_CHARS, TIMES_REGULAR, TIMES_BOLD, TIMES_ITALIC } from './timesMetrics';

export const BODY_W_IN = 6.5; // text width between the 1-inch side margins
export const CELL_PAD_X_IN = 0.08; // Word's default left/right cell margin
export const CELL_PAD_Y_IN = 0.04; // a little air above and below each row's text
export const TABLE_LH = 1.14; // the body's line height
export const BORDER_PT = 0.5; // a hairline, like Word's "Table Grid"
export const MIN_COL_IN = 0.3;
export const MIN_TABLE_IN = 1; // the indent can't squeeze a table narrower than this
export const MAX_COLS = 10;
export const MAX_ROWS = 200;
export const MAX_CELL_CHARS = 2_000;
const EMPTY_COL_IN = 0.75; // what an empty column asks for when fitting to text
// Autofit headroom: the measured text width × 2% + 1pt, so a fitted line never wraps in a
// renderer whose Times runs a hair wider than the metrics here.
const FIT_SLACK = 1.02;

const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const round2 = (x: number) => Math.round(x * 100) / 100;

// ---- Text measurement (points) ----
type Face = 'regular' | 'bold' | 'italic';
const FACES: Record<Face, readonly number[]> = { regular: TIMES_REGULAR, bold: TIMES_BOLD, italic: TIMES_ITALIC };
const GLYPH = new Map<string, number>([...TIMES_CHARS].map((ch, i) => [ch, i]));

export function textWidthPt(text: string, size: number, face: Face = 'regular'): number {
  const w = FACES[face];
  let units = 0;
  for (const ch of text) {
    const i = GLYPH.get(ch);
    units += i === undefined ? 556 : w[i]; // a glyph outside WinAnsi: about an average letter
  }
  return (units * size) / 1000;
}

// One line of cell text, measured with its inline emphasis: the whole line, and its longest word
// (the narrowest a column can go before a word has to break).
function measureLine(line: string, size: number, boldAll: boolean): { full: number; longest: number } {
  const space = textWidthPt(' ', size);
  let full = 0;
  let longest = 0;
  let word = 0;
  let words = 0;
  const endWord = () => {
    if (word > 0) {
      full += (words ? space : 0) + word;
      longest = Math.max(longest, word);
      words++;
      word = 0;
    }
  };
  for (const r of parseInline(line)) {
    const face: Face = boldAll || r.bold ? 'bold' : r.italic ? 'italic' : 'regular';
    for (const part of r.text.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) endWord();
      else word += textWidthPt(part, size, face);
    }
  }
  endWord();
  return { full, longest };
}

// A cell's text as its hard lines (the user's line breaks). Every renderer draws each as a block.
export const cellLines = (text: string): string[] => text.split('\n');

export const isHeaderRow = (t: ParaTable, r: number) => t.header && r === 0;

// Per-column natural widths in inches, padding included: `max` sets every line on one line,
// `min` is the longest single word.
export function columnNaturals(t: ParaTable): { min: number[]; max: number[] } {
  const n = t.cols.length;
  const min = new Array<number>(n).fill(0);
  const max = new Array<number>(n).fill(0);
  t.rows.forEach((row, r) => {
    const boldAll = isHeaderRow(t, r) && t.headerStyle === 'bold';
    for (let c = 0; c < n; c++) {
      for (const line of cellLines(row.cells[c] ?? '')) {
        const m = measureLine(line, t.fontSize, boldAll);
        max[c] = Math.max(max[c], m.full);
        min[c] = Math.max(min[c], m.longest);
      }
    }
  });
  const toIn = (pt: number) => (pt * FIT_SLACK + 1) / 72 + 2 * CELL_PAD_X_IN;
  return {
    max: max.map((pt) => (pt > 0 ? Math.max(MIN_COL_IN, toIn(pt)) : EMPTY_COL_IN)),
    min: min.map((pt) => (pt > 0 ? Math.max(MIN_COL_IN, toIn(pt)) : MIN_COL_IN)),
  };
}

// Room for the table between its indent and the right margin.
export const availIn = (t: ParaTable) => Math.max(MIN_TABLE_IN, BODY_W_IN - t.indent);

const scaleTo = (w: number[], total: number) => {
  const s = sum(w);
  return s > 0 ? w.map((x) => (x * total) / s) : w.map(() => total / w.length);
};

// Round to hundredths; when the widths must add up to `total`, the widest column takes the
// remainder (it's the one wrapping anyway — a column fitted to its text must not lose a hair).
const round = (w: number[], total?: number) => {
  const out = w.map(round2);
  if (total !== undefined && out.length) {
    const k = out.indexOf(Math.max(...out));
    out[k] = round2(out[k] + total - sum(out));
  }
  return out;
};

// Share `avail` among columns that together want more than that. Short columns come first: any that
// wants no more than an even share gets all it wants (so a name or phone column never wraps just
// because a remarks column is long); the rest split what's left in proportion to what they want,
// never below their longest word. If even the longest words can't fit, everything scales down.
function shareOut(nat: { min: number[]; max: number[] }, avail: number): number[] {
  const w = new Array<number>(nat.max.length).fill(0);
  let open = nat.max.map((_, i) => i);
  let room = avail;
  for (;;) {
    const share = room / open.length;
    const happy = open.filter((i) => nat.max[i] <= share);
    if (!happy.length || happy.length === open.length) break;
    for (const i of happy) {
      w[i] = nat.max[i];
      room -= nat.max[i];
    }
    open = open.filter((i) => !happy.includes(i));
  }
  while (open.length) {
    const want = sum(open.map((i) => nat.max[i]));
    const starved = open.filter((i) => (room * nat.max[i]) / want < nat.min[i]);
    if (!starved.length) {
      for (const i of open) w[i] = (room * nat.max[i]) / want;
      break;
    }
    for (const i of starved) {
      w[i] = nat.min[i];
      room -= nat.min[i];
    }
    open = open.filter((i) => !starved.includes(i));
  }
  return sum(w) > avail ? scaleTo(w, avail) : w;
}

// The widths the table is drawn at, in inches. contents: every column at its one-line width if
// they all fit, otherwise shared out as above. page: the same, stretched to the right margin.
// fixed: the typed/dragged widths. With wrap off a column never goes narrower than its longest
// line, which can push the table past the right margin — the editor warns when it does.
export function resolveWidths(t: ParaTable): number[] {
  if (!t.cols.length) return [];
  const avail = availIn(t);
  const nat = columnNaturals(t);
  if (t.fit === 'fixed') {
    const w = t.cols.map((c) => Math.max(MIN_COL_IN, c.width || 0));
    if (!t.wrap) return round(w.map((x, i) => Math.max(x, nat.max[i])));
    // Never past the right margin (a raised indent, or widths from a hand-edited file).
    return sum(w) > avail ? round(scaleTo(w, avail), avail) : round(w);
  }
  let w = nat.max.slice();
  let total: number | undefined; // set when the widths must land exactly on the right margin
  if (t.wrap && sum(nat.max) > avail) {
    total = avail;
    w = shareOut(nat, avail);
  }
  if (t.fit === 'page' && sum(w) < avail) {
    w = scaleTo(w, avail);
    total = avail;
  }
  return round(w, total);
}

// How far the table runs past the right margin, in inches (0 when it fits).
export function overflowIn(t: ParaTable): number {
  return Math.max(0, round2(t.indent + sum(resolveWidths(t)) - BODY_W_IN));
}

// Which rules to draw. The header rule sits under the header row in every boxed style.
export function tableLines(t: ParaTable) {
  const b = t.borders;
  return {
    outer: b !== 'none',
    vertical: b === 'grid' || b === 'columns',
    between: b === 'grid',
    headerRule: b !== 'none' && t.header,
  };
}

// Is there a rule between row `prev` and the row drawn right after it (on the same page)?
export const ruleBetween = (t: ParaTable, prev: number) => {
  const l = tableLines(t);
  return l.between || (l.headerRule && isHeaderRow(t, prev));
};

// ---- Building and editing (pure; each returns a new table) ----

const blankRow = (n: number): ParaTableRow => ({ id: uid(), cells: new Array<string>(n).fill(''), height: 0 });

// A new table under a paragraph at `depth`: three columns, a header row and two rows, ruled like a
// boxed roster (outline + column lines + a rule under an underlined header), indented to where that
// paragraph's subparagraph text starts and stretched to the right margin.
export function newTable(depth: number): ParaTable {
  const t: ParaTable = {
    cols: [0, 1, 2].map(() => ({ id: uid(), width: 0, align: 'left' as const })),
    rows: [blankRow(3), blankRow(3), blankRow(3)],
    header: true,
    headerStyle: 'underline',
    borders: 'columns',
    fit: 'page',
    wrap: true,
    indent: depthIndentIn(Math.min(depth + 2, 7)),
    fontSize: 12,
  };
  return withWidths(t, resolveWidths(t), 'page');
}

// Store `w` as the column widths. Any fit other than the one given keeps its auto widths; passing
// 'fixed' (the default) is how every manual resize lands.
function withWidths(t: ParaTable, w: number[], fit: ParaTable['fit'] = 'fixed'): ParaTable {
  return { ...t, fit, cols: t.cols.map((c, i) => ({ ...c, width: round2(w[i] ?? c.width) })) };
}

export function setCell(t: ParaTable, rowId: string, c: number, text: string): ParaTable {
  return {
    ...t,
    rows: t.rows.map((r) =>
      r.id === rowId ? { ...r, cells: r.cells.map((x, i) => (i === c ? text.slice(0, MAX_CELL_CHARS) : x)) } : r,
    ),
  };
}

export function insertRow(t: ParaTable, at: number): ParaTable {
  if (t.rows.length >= MAX_ROWS) return t;
  const rows = [...t.rows];
  rows.splice(clamp(at, 0, rows.length), 0, blankRow(t.cols.length));
  return { ...t, rows };
}

export function removeRow(t: ParaTable, rowId: string): ParaTable {
  return t.rows.length <= 1 ? t : { ...t, rows: t.rows.filter((r) => r.id !== rowId) };
}

export function moveRow(t: ParaTable, rowId: string, dir: -1 | 1): ParaTable {
  const i = t.rows.findIndex((r) => r.id === rowId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= t.rows.length) return t;
  const rows = [...t.rows];
  [rows[i], rows[j]] = [rows[j], rows[i]];
  return { ...t, rows };
}

// Insert a column at index `at`. A fixed-width table splits the neighbouring column in two (as Word
// does), so the table keeps its width instead of running past the margin.
export function insertCol(t: ParaTable, at: number): ParaTable {
  if (t.cols.length >= MAX_COLS) return t;
  const i = clamp(at, 0, t.cols.length);
  const cols: ParaTableCol[] = [...t.cols];
  let width = EMPTY_COL_IN;
  if (t.fit === 'fixed' && cols.length) {
    const w = resolveWidths(t);
    const n = i < cols.length ? i : cols.length - 1; // the column being split
    width = Math.max(MIN_COL_IN, w[n] / 2);
    cols[n] = { ...cols[n], width: round2(Math.max(MIN_COL_IN, w[n] - width)) };
  }
  cols.splice(i, 0, { id: uid(), width: round2(width), align: 'left' });
  const rows = t.rows.map((r) => {
    const cells = [...r.cells];
    cells.splice(i, 0, '');
    return { ...r, cells };
  });
  return { ...t, cols, rows };
}

export function removeCol(t: ParaTable, c: number): ParaTable {
  if (t.cols.length <= 1) return t;
  return {
    ...t,
    cols: t.cols.filter((_, i) => i !== c),
    rows: t.rows.map((r) => ({ ...r, cells: r.cells.filter((_, i) => i !== c) })),
  };
}

export function moveCol(t: ParaTable, c: number, dir: -1 | 1): ParaTable {
  const j = c + dir;
  if (j < 0 || j >= t.cols.length) return t;
  const swap = <T,>(a: T[]) => {
    const b = [...a];
    [b[c], b[j]] = [b[j], b[c]];
    return b;
  };
  return { ...t, cols: swap(t.cols), rows: t.rows.map((r) => ({ ...r, cells: swap(r.cells) })) };
}

export function setAlign(t: ParaTable, c: number, align: ParaTableCol['align']): ParaTable {
  return { ...t, cols: t.cols.map((col, i) => (i === c ? { ...col, align } : col)) };
}

// Type a column width. The other columns hold still; the typed one is held to what fits before the
// right margin, so the table never runs off the page.
export function setColWidth(t: ParaTable, c: number, inches: number): ParaTable {
  const w = resolveWidths(t);
  const room = availIn(t) - (sum(w) - w[c]);
  w[c] = clamp(inches, MIN_COL_IN, Math.max(MIN_COL_IN, room));
  return withWidths(t, w);
}

// Drag the right edge of column j by `d` inches, starting from widths `start`. An inner edge trades
// width between its two columns (the table keeps its width, as in Word); the outer right edge
// widens or narrows the table, up to the right margin.
export function dragEdge(t: ParaTable, start: number[], j: number, d: number): ParaTable {
  const w = [...start];
  if (j < w.length - 1) {
    const pair = w[j] + w[j + 1];
    w[j] = clamp(w[j] + d, MIN_COL_IN, pair - MIN_COL_IN);
    w[j + 1] = pair - w[j];
  } else {
    const room = availIn(t) - (sum(w) - w[j]);
    w[j] = clamp(w[j] + d, MIN_COL_IN, Math.max(MIN_COL_IN, room));
  }
  return withWidths(t, w);
}

// Fit one column to its text (double-click its edge), within the room before the margin.
export function fitColumn(t: ParaTable, c: number): ParaTable {
  const w = resolveWidths(t);
  const room = availIn(t) - (sum(w) - w[c]);
  w[c] = clamp(columnNaturals(t).max[c], MIN_COL_IN, Math.max(MIN_COL_IN, room));
  return withWidths(t, w);
}

// Same width for every column, keeping the table's current overall width.
export function distribute(t: ParaTable): ParaTable {
  const w = resolveWidths(t);
  const each = sum(w) / w.length;
  return withWidths(t, w.map(() => each));
}

// Switch how widths are decided. Going to fixed freezes the widths currently on the page, so the
// table doesn't jump.
export function setFit(t: ParaTable, fit: ParaTable['fit']): ParaTable {
  return fit === 'fixed' ? withWidths(t, resolveWidths(t)) : { ...t, fit };
}

export function setRowHeight(t: ParaTable, rowId: string, inches: number): ParaTable {
  const h = Number.isFinite(inches) ? round2(clamp(inches, 0, 9)) : 0;
  return { ...t, rows: t.rows.map((r) => (r.id === rowId ? { ...r, height: h } : r)) };
}

export function setIndent(t: ParaTable, inches: number): ParaTable {
  return { ...t, indent: round2(clamp(Number.isFinite(inches) ? inches : 0, 0, BODY_W_IN - MIN_TABLE_IN)) };
}

// All of a table's text, for the proofread / PII / spelling passes.
export const tableText = (t?: ParaTable): string =>
  t ? t.rows.map((r) => r.cells.join(' ')).join(' ') : '';

// Put `table` on paragraph `pid` wherever it lives — the body or an endorsement's body. The
// preview's drag handles know only the paragraph id.
export function setTableInState(s: LetterState, pid: string, table: ParaTable): LetterState {
  const put = (list: Paragraph[]) => setTable(list, pid, table);
  return { ...s, body: put(s.body), endorsements: s.endorsements.map((e) => ({ ...e, body: put(e.body) })) };
}

// ---- Import: bound and coerce a table from a hostile or corrupt project file ----
const ALIGNS = ['left', 'center', 'right'] as const;
const HEADER_STYLES = ['underline', 'bold', 'plain'] as const;
const BORDERS = ['grid', 'columns', 'box', 'none'] as const;
const FITS = ['contents', 'page', 'fixed'] as const;
const pick = <T extends string>(v: unknown, opts: readonly T[], dflt: T): T =>
  opts.includes(v as T) ? (v as T) : dflt;
const num = (v: unknown, lo: number, hi: number, dflt: number) =>
  typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : dflt;
const id = (v: unknown, fallback: string) => (typeof v === 'string' && v ? v.slice(0, 100) : fallback);

// Returns undefined for anything that isn't a usable table; `budget.cells` caps the cells across a
// whole body (throws past it, which rejects the file like the paragraph-node cap does).
export function sanitizeTable(raw: unknown, budget: { cells: number }, maxCells: number): ParaTable | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const t = raw as Record<string, unknown>;
  const cols = (Array.isArray(t.cols) ? t.cols : [])
    .slice(0, MAX_COLS)
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    .map((c, i) => ({
      id: id(c.id, `tc${i}`),
      width: round2(num(c.width, 0, 20, 1)),
      align: pick(c.align, ALIGNS, 'left'),
    }));
  if (!cols.length) return undefined;
  const rows = (Array.isArray(t.rows) ? t.rows : [])
    .slice(0, MAX_ROWS)
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r, i) => {
      const cells = Array.isArray(r.cells) ? r.cells : [];
      return {
        id: id(r.id, `tr${i}`),
        // Exactly one cell per column, whatever the file says.
        cells: cols.map((_, c) => (typeof cells[c] === 'string' ? (cells[c] as string).slice(0, MAX_CELL_CHARS) : '')),
        height: round2(num(r.height, 0, 9, 0)),
      };
    });
  if (!rows.length) return undefined;
  budget.cells += cols.length * rows.length;
  if (budget.cells > maxCells) throw new Error('project tables exceed the cell cap');
  return {
    cols,
    rows,
    header: t.header !== false,
    headerStyle: pick(t.headerStyle, HEADER_STYLES, 'underline'),
    borders: pick(t.borders, BORDERS, 'columns'),
    fit: pick(t.fit, FITS, 'page'),
    wrap: t.wrap !== false,
    indent: round2(num(t.indent, 0, BODY_W_IN - MIN_TABLE_IN, 0.5)),
    fontSize: t.fontSize === 10 || t.fontSize === 11 ? t.fontSize : 12,
  };
}
