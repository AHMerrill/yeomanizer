import {
  Fragment,
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type {
  LetterState,
  Paragraph,
  EndorsementEntry,
  EnclosureEntry,
  ListEntry,
  SignatureBlock,
  ParaTable,
} from '../types';
import { parseInline } from '../format/inline';
import {
  resolveWidths,
  tableLines,
  ruleBetween,
  isHeaderRow,
  cellLines,
  dragEdge,
  fitColumn,
  setRowHeight,
} from '../format/table';
import { paragraphMarker, depthIndentIn } from '../format/paragraphs';
import { anyCui } from '../format/tree';
import { SEAL_URL } from '../format/seals';
import {
  buildIdent,
  refLetter,
  ENDORSE_ORD,
  basicLetterId,
  remainingVias,
  endorsementLetterheadLines,
  type IdentLines,
} from '../format/identification';
import { Form1626 } from './Form1626';
import { NatoForm } from './NatoForm';
import './preview.css';

// Page geometry (96 dpi). Body flows between the top matter and the 1-inch bottom margin.
const DPI = 96;
const PAGE1_TOP = 0.5 * DPI; // letterhead / first-page top matter starts here
const PAGEN_TOP = 1.0 * DPI; // continuation Subj starts at the 1-inch margin (7-2.16)
const BODY_BOTTOM = 9.9 * DPI; // ~1-inch bottom margin (slight slack so nothing clips)
const BODY_GAP = 16; // blank line between the top matter and the body

function MarkerSpan({ depth, index }: { depth: number; index: number }) {
  const m = paragraphMarker(depth, index);
  return (
    <span className="pmark">
      {m.prefix}
      {m.underline ? <u>{m.core}</u> : m.core}
      {m.suffix}
    </span>
  );
}

interface FlatPara {
  key: string;
  depth: number;
  index: number;
  text: string;
  cui?: boolean;
  title?: string;
  table?: ParaTable;
}
function flattenForFlow(list: Paragraph[], depth: number, out: FlatPara[]): void {
  list.forEach((p, i) => {
    out.push({ key: p.id, depth, index: i, text: p.text, cui: p.cui, title: p.title, table: p.table });
    flattenForFlow(p.children, depth + 1, out);
  });
}

// Renders inline markup (**bold** *italic* __underline__) as escaped emphasis spans.
function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((r, i) =>
        r.bold ? (
          <strong key={i}>{r.text}</strong>
        ) : r.italic ? (
          <em key={i}>{r.text}</em>
        ) : r.underline ? (
          <u key={i}>{r.text}</u>
        ) : (
          <span key={i}>{r.text}</span>
        ),
      )}
    </>
  );
}

function ParaFlow({
  fp,
  portionActive,
  business,
  exec,
  memoFor,
}: {
  fp: FlatPara;
  portionActive: boolean;
  business?: boolean;
  exec?: boolean;
  memoFor?: boolean;
}) {
  // Business letter (Ch 11-2.6): main paragraphs are NOT numbered (just indented); subparagraphs are
  // lettered/numbered the same as a standard letter, so the ladder shifts one level deeper. Exec memo
  // (Ch 12, figs 12-9/12-11): main paragraphs are BULLETED ("•"); subparagraphs use the same ladder.
  const indent =
    memoFor && fp.depth === 0
      ? 0.5 // fig 12-14: Memo-For paragraphs indent a half inch
      : business || exec
        ? depthIndentIn(fp.depth + 1)
        : depthIndentIn(fp.depth);
  const bulletTop = exec && fp.depth === 0;
  const showMarker = !((business && fp.depth === 0) || bulletTop);
  // Exec-memo bullets hang: the "•" sits at indent, and wrapped lines align ~0.18in past it (bullet
  // width + gap), matching the PDF/docx and fig 12-9. Everything else indents just the first line.
  const HANG = 0.25; // fig 12-9 (measured): bullet flush at the margin, text hangs at 0.25in
  const style = bulletTop
    ? { paddingLeft: `${HANG}in`, textIndent: `-${HANG}in` }
    : { textIndent: `${indent}in` };
  return (
    <p className="para" data-sync={`p:${fp.key}`} style={style}>
      {bulletTop && <span className="pmark">•</span>}
      {bulletTop && <span className="pgap" />}
      {showMarker && <MarkerSpan depth={fp.depth} index={fp.index} />}
      {showMarker && <span className="pgap" />}
      {portionActive ? (fp.cui ? '(CUI) ' : '(U) ') : ''}
      {fp.title && (
        <>
          <u>{fp.title}</u>.<span className="pgap" />
        </>
      )}
      <Inline text={fp.text} />
    </p>
  );
}

// ---- Body tables ----
// The preview's drag handles resize a table through this. Null — no handles — wherever the
// preview isn't editable.
const TableEdit = createContext<((pid: string, t: ParaTable) => void) | null>(null);

// A table flows as pieces so a long one breaks across pages between rows, like the PDF and Word:
// the header travels with the first body row (never stranded at the foot of a page); every other
// row is its own piece.
function tablePieces(t: ParaTable): number[][] {
  const first = t.header && t.rows.length > 1 ? [0, 1] : [0];
  return [first, ...t.rows.slice(first.length).map((_, k) => [first.length + k])];
}

interface TablePieceInfo {
  pid: string; // the paragraph the table belongs to
  t: ParaTable;
  widths: number[]; // resolveWidths(t), inches
  rows: number[]; // the row indices in this piece
  first: boolean; // the table's first piece
  last: boolean; // the table's last piece — carries the paragraph gap below the table
}

// Cell text: inline **bold** *italic* __underline__, with the header row's style laid over it.
function CellText({ text, hdr }: { text: string; hdr: ParaTable['headerStyle'] | null }) {
  return (
    <>
      {parseInline(text).map((r, i) => {
        let n: ReactNode = r.text;
        if (r.bold || hdr === 'bold') n = <strong>{n}</strong>;
        if (r.italic) n = <em>{n}</em>;
        if (r.underline || hdr === 'underline') n = <u>{n}</u>;
        return <Fragment key={i}>{n}</Fragment>;
      })}
    </>
  );
}

// Pointer drag in inches of page. The sheet may be scaled to fit the pane (a CSS transform), so
// screen pixels are divided back out by that scale.
function beginDrag(e: ReactPointerEvent, axis: 'x' | 'y', onMove: (dIn: number) => void) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const page = (e.currentTarget as HTMLElement).closest('.page') as HTMLElement | null;
  const scale = page && page.offsetWidth ? page.getBoundingClientRect().width / page.offsetWidth : 1;
  const start = axis === 'x' ? e.clientX : e.clientY;
  // Report only real changes (to the hundredth of an inch the widths are kept at), so a pointer
  // that sits still mid-drag doesn't stack up identical undo steps.
  let last = 0;
  const move = (ev: PointerEvent) => {
    const d = Math.round((((axis === 'x' ? ev.clientX : ev.clientY) - start) / scale / 96) * 100) / 100;
    if (d !== last) {
      last = d;
      onMove(d);
    }
  };
  const end = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';
  document.body.style.userSelect = 'none';
}

// Drag handles on one row: each column's right edge (drag to resize, double-click to fit the column
// to its text) and the row's bottom edge (drag to set a minimum height, double-click to go back to
// fitting the text). Screen-only — hidden in print, and the exports never see the preview DOM.
function TableHandles({ pid, t, widths, r, onEdit }: { pid: string; t: ParaTable; widths: number[]; r: number; onEdit: (pid: string, t: ParaTable) => void }) {
  let x = 0;
  return (
    <>
      {widths.map((w, j) => {
        x += w;
        return (
          <span
            key={j}
            className="tdrag tdrag-col"
            style={{ left: `${x}in` }}
            aria-hidden="true"
            title="Drag to resize the column · double-click to fit it to its text"
            onPointerDown={(e) => beginDrag(e, 'x', (d) => onEdit(pid, dragEdge(t, widths, j, d)))}
            onDoubleClick={() => onEdit(pid, fitColumn(t, j))}
          />
        );
      })}
      <span
        className="tdrag tdrag-row"
        aria-hidden="true"
        title="Drag to set the row height · double-click to fit it to its text"
        onPointerDown={(e) => {
          const rowEl = (e.currentTarget as HTMLElement).closest('.trow') as HTMLElement | null;
          const h0 = (rowEl?.offsetHeight ?? 0) / 96; // offsetHeight is unscaled CSS px
          const rowId = t.rows[r].id;
          beginDrag(e, 'y', (d) => onEdit(pid, setRowHeight(t, rowId, Math.max(0.1, h0 + d))));
        }}
        onDoubleClick={() => onEdit(pid, setRowHeight(t, t.rows[r].id, 0))}
      />
    </>
  );
}

// One piece of a table. Rules are drawn by each cell's ::after (absolutely positioned), so they
// take no layout space and the row heights match the PDF's line math. `pageTop`/`pageBottom` say
// whether this piece opens/closes the table's run on its page: the outline closes at a page break
// and reopens on the next page under a repeated header row.
function TablePiece({
  pid,
  t,
  widths,
  rows,
  last,
  pageTop,
  pageBottom,
  repeatHeader,
  measure,
}: TablePieceInfo & { pageTop: boolean; pageBottom: boolean; repeatHeader: boolean; measure?: boolean }) {
  const onEdit = useContext(TableEdit);
  const lines = tableLines(t);
  const drawn = repeatHeader ? [0, ...rows] : rows;
  const cols = widths.map((w) => `${w}in`).join(' ');
  const total = widths.reduce((s, w) => s + w, 0);
  return (
    <div
      className={t.wrap ? 'ptable' : 'ptable nowrap'}
      data-sync={`p:${pid}`}
      style={{
        marginLeft: `${t.indent}in`,
        width: `${total}in`,
        fontSize: `${t.fontSize}pt`,
        marginBottom: last ? 'var(--para-gap)' : undefined,
      }}
    >
      {drawn.map((r, k) => {
        const row = t.rows[r];
        const top = k === 0 && pageTop ? lines.outer : ruleBetween(t, k > 0 ? drawn[k - 1] : r - 1);
        const bottom = pageBottom && k === drawn.length - 1 && lines.outer;
        const hdr = isHeaderRow(t, r) ? t.headerStyle : null;
        return (
          <div
            className="trow"
            key={k === 0 && repeatHeader ? 'rh' : row.id}
            style={{ gridTemplateColumns: cols, gridTemplateRows: row.height ? `minmax(${row.height}in, auto)` : undefined }}
          >
            {row.cells.map((text, c) => {
              const cls = ['tcell'];
              if (top) cls.push('bt');
              if (bottom) cls.push('bb');
              if (c === 0 ? lines.outer : lines.vertical) cls.push('bl');
              if (c === row.cells.length - 1 && lines.outer) cls.push('br');
              return (
                <div key={c} className={cls.join(' ')} style={{ textAlign: t.cols[c]?.align ?? 'left' }}>
                  {cellLines(text).map((ln, i) => (
                    <div className="tline" key={i}>
                      {ln.trim() ? <CellText text={ln} hdr={hdr} /> : ' '}
                    </div>
                  ))}
                </div>
              );
            })}
            {onEdit && !measure && <TableHandles pid={pid} t={t} widths={widths} r={r} onEdit={onEdit} />}
          </div>
        );
      })}
    </div>
  );
}

// Whether the letterhead shows faint "fill this in" hints for blank activity/address/city lines.
// An endorsement's letterhead is free-form lines typed as a block — there are no separate fields
// to fill in, so its page turns the hints off and shows exactly the lines given.
const LetterheadHints = createContext(true);

function Letterhead({ state }: { state: LetterState }) {
  const lh = state.letterhead;
  const sealSrc = SEAL_URL[lh.seal];
  const hints = useContext(LetterheadHints);
  return (
    <>
      {sealSrc && <img className="seal" src={sealSrc} alt="" />}
      <div className="letterhead">
        <div className="lh-dept">{lh.line1}</div>
        {/* Flag/personal stationery: render just the centered title, no activity/address lines. */}
        {!lh.titleOnly && (
        <>
        {lh.activityName ? (
          lh.activityName.split('\n').map((l, i) => (
            <div key={i} className="lh-sub">
              {l || ' '}
            </div>
          ))
        ) : (
          hints && <div className="lh-sub ph">NAME OF ACTIVITY</div>
        )}
        {(lh.addressLine || hints) && (
          <div className={lh.addressLine ? 'lh-sub' : 'lh-sub ph'}>
            {lh.addressLine || 'STREET ADDRESS'}
          </div>
        )}
        {(lh.cityStateZip || hints) && (
          <div className={lh.cityStateZip ? 'lh-sub' : 'lh-sub ph'}>
            {lh.cityStateZip || 'CITY STATE ZIP+4'}
          </div>
        )}
        </>
        )}
      </div>
    </>
  );
}

// First-page top matter: letterhead + identification + From/To/Via/Subj/Ref/Encl.
function Head({ state }: { state: LetterState }) {
  const ident = buildIdent(state);
  const lh = state.letterhead;
  const isMemo = state.type === 'memo-from-to';
  const isMfr = state.type === 'mfr';
  const isEndorsement = state.type === 'endorsement';
  const via = state.via.filter((v) => v.text.trim());
  const toAddrs = state.toAddrs.filter((a) => a.text.trim());
  const refs = state.refs.filter((r) => r.text.trim());
  const encls = state.encls.filter((e) => e.text.trim());
  if (state.type === 'business-letter') return <BusinessHead state={state} ident={ident} />;
  if (state.type === 'moa') return <MoaHead state={state} ident={ident} />;
  if (state.type === 'joint-letter') return <JointHead state={state} />;
  if (state.type === 'exec-memo') return <ExecMemoHead state={state} ident={ident} />;
  if (state.type === 'coordination-page') return <CoordPageHead state={state} />;
  return (
    <>
      {lh.mode === 'on' && <Letterhead state={state} />}
      {lh.mode === 'preprinted' && (
        <div className="lh-spacer" aria-hidden style={{ height: `${Math.max(0.86, lh.preprintedLines * 0.11)}in` }} />
      )}
      {/* Memo: date only (flush right, ~6th line). Letter: SSIC block (lines optional).
          A kept-but-blank line shows a faint screen-only placeholder (hidden in print). */}
      <div className={lh.mode === 'off' ? 'ident no-letterhead' : 'ident'}>
        {state.includeSsic && (ident.ssic ? <div>{ident.ssic}</div> : <div className="ph ph-line">SSIC</div>)}
        {state.includeCode &&
          (ident.codeLine ? <div>{ident.codeLine}</div> : <div className="ph ph-line">Code</div>)}
        {ident.date ? <div>{ident.date}</div> : <div className="ph">Date</div>}
      </div>
      {isMemo && <div className="memo-title">MEMORANDUM</div>}
      {isMfr && <div className="memo-title">MEMORANDUM FOR THE RECORD</div>}
      {isEndorsement && (
        <div className="endorsement-line">
          {state.endorsementNumber} ENDORSEMENT on{' '}
          {state.endorsementOf || (
            <span className="ph">[basic letter — e.g., USS SCRANTON ltr 3000 Ser SSN 756/001 of 5 May 15]</span>
          )}
        </div>
      )}
      <div
        data-sync="head"
        className={isMemo || isMfr ? 'headings memo' : isEndorsement ? 'headings endo' : 'headings'}
      >
        {/* MFR is "for the record" — no addressee, so no From/To/Via. */}
        {!isMfr && (
          <>
            <div className="hrow">
              <span className="label">From:</span>
              <span className={state.from ? 'content' : 'content ph'}>
                {state.from || 'Commanding Officer, [your command]'}
              </span>
            </div>
            <div className="hrow">
              <span className="label">To:</span>
              <span className={state.to ? 'content' : 'content ph'}>
                {state.to || 'Action addressee — e.g., Chief of Naval Operations (N1)'}
              </span>
            </div>
            {/* Multiple-address letter (Ch 8): additional action addressees stack under the To: line. */}
            {toAddrs.map((a) => (
              <div className="hrow" key={a.id}>
                <span className="label" />
                <span className="content">{a.text}</span>
              </div>
            ))}
          </>
        )}
        {via.length === 1 && (
          <div className="hrow">
            <span className="label">Via:</span>
            <span className="content">{via[0].text}</span>
          </div>
        )}
        {via.length >= 2 && (
          <div className="hrow">
            <span className="label">Via:</span>
            <span className="content hlist">
              {via.map((v, i) => (
                <span className="hitem" key={v.id}>
                  <span>({i + 1})</span>
                  <span>{v.text}</span>
                </span>
              ))}
            </span>
          </div>
        )}
        <div className="hrow h-gap">
          <span className="label">Subj:</span>
          <span className={state.subj ? 'content subj' : 'content subj ph'}>
            {state.subj || 'SUBJECT IN ALL CAPS, NO PUNCTUATION'}
          </span>
        </div>
        {refs.length > 0 && (
          <div className="hrow h-gap">
            <span className="label">Ref:</span>
            <span className="content hlist">
              {refs.map((r, i) => (
                <span className="hitem" key={r.id}>
                  <span>({refLetter(i)})</span>
                  <span>{r.text}</span>
                </span>
              ))}
            </span>
          </div>
        )}
        {encls.length > 0 && (
          <div className="hrow h-gap">
            <span className="label">Encl:</span>
            <span className="content hlist">
              {encls.map((e, i) => (
                <span className="hitem" key={e.id}>
                  <span>({i + 1})</span>
                  <span>{e.text}</span>
                </span>
              ))}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

// Continuation pages repeat only the Subj line (7-2.16).
function ContinuationHead({ subj }: { subj: string }) {
  return (
    <div className="cont-head">
      <div className="hrow">
        <span className="label">Subj:</span>
        <span className="content subj">{subj}</span>
      </div>
    </div>
  );
}

// Business letter (Ch 11) first-page top matter: letterhead + identification symbols + inside
// address + optional attention line + salutation (or an all-caps subject standing in for it).
function BusinessHead({ state, ident }: { state: LetterState; ident: IdentLines }) {
  const lh = state.letterhead;
  const biz = state.business;
  const hasAddr = biz.insideAddress.trim().length > 0;
  return (
    <>
      {lh.mode === 'on' && <Letterhead state={state} />}
      {lh.mode === 'preprinted' && (
        <div className="lh-spacer" aria-hidden style={{ height: `${Math.max(0.86, lh.preprintedLines * 0.11)}in` }} />
      )}
      {/* Identification symbols right-aligned, like the standard letter — see the note in signablePdf:
          the manual's business-letter figures (11-2, 11-6) show them upper-right despite ¶11-2.1's text. */}
      <div className={lh.mode === 'off' ? 'ident no-letterhead' : 'ident'}>
        {state.includeSsic && (ident.ssic ? <div>{ident.ssic}</div> : <div className="ph ph-line">SSIC</div>)}
        {state.includeCode &&
          (ident.codeLine ? <div>{ident.codeLine}</div> : <div className="ph ph-line">Code</div>)}
        {ident.date ? <div>{ident.date}</div> : <div className="ph">Date</div>}
      </div>
      <div className="biz-address">
        {hasAddr ? (
          biz.insideAddress.split('\n').map((l, i) => <div key={i}>{l || ' '}</div>)
        ) : (
          <div className="ph">Mr. A. B. Recipient · Company · Street · City, ST ZIP+4</div>
        )}
      </div>
      {biz.attention.trim() && <div className="biz-attention">Attention:&ensp;{biz.attention}</div>}
      {biz.subjectReplacesSalutation ? (
        <div className="biz-subject">
          SUBJECT:&ensp;
          <span className={state.subj.trim() ? '' : 'ph'}>
            {state.subj.trim() || 'SUBJECT IN ALL CAPS'}
          </span>
        </div>
      ) : (
        <>
          <div className={biz.salutation.trim() ? 'biz-salutation' : 'biz-salutation ph'}>
            {biz.salutation.trim() || 'Dear Mr. Recipient:'}
          </div>
          {state.subj.trim() && <div className="biz-subject">SUBJECT:&ensp;{state.subj}</div>}
        </>
      )}
    </>
  );
}

// Business letter closing: a centered "Sincerely," + signature block (11-2.8/2.9), then the
// left-margin Enclosures and Separate-Mailing notations (11-2.10/2.11). Copy-to flows after.
function BusinessClose({ state }: { state: LetterState }) {
  const biz = state.business;
  const sig = state.signature;
  const encls = state.encls.filter((e) => e.text.trim());
  return (
    <div className="biz-close">
      <div className="biz-signoff">
        <div className="biz-complimentary">{biz.complimentaryClose.trim() || 'Sincerely,'}</div>
        <div className="biz-signature">
          <div className={sig.name ? '' : 'ph'}>{sig.name || 'I. M. LASTNAME'}</div>
          {sig.title && <div>{sig.title}</div>}
          {sig.authority === 'by-direction' && <div>By direction</div>}
          {sig.authority === 'acting' && <div>Acting</div>}
        </div>
      </div>
      {encls.length === 1 && <div className="biz-encls">Enclosure:&ensp;{encls[0].text}</div>}
      {/* Fig 11-3: the first item rides the label line; later items align under its number. */}
      {encls.length > 1 && (
        <div className="biz-encls">
          <div>
            Enclosures:&ensp;<span className="biz-encl-first">1.&ensp;{encls[0].text}</span>
          </div>
          {encls.slice(1).map((e, i) => (
            <div key={e.id} className="biz-encl-item biz-encl-under">
              {i + 2}.&ensp;{e.text}
            </div>
          ))}
        </div>
      )}
      {biz.separateMailing.trim() && (
        <div className="biz-sepmail">Separate Mailing:&ensp;{biz.separateMailing}</div>
      )}
    </div>
  );
}

// Business letter continuation pages repeat the identification symbols (11-2.14), not the Subj line.
function BusinessContinuationHead({ state }: { state: LetterState }) {
  const ident = buildIdent(state);
  return (
    <div className="cont-head biz-cont">
      {state.includeSsic && ident.ssic && <div>{ident.ssic}</div>}
      {state.includeCode && ident.codeLine && <div>{ident.codeLine}</div>}
      {ident.date && <div>{ident.date}</div>}
    </div>
  );
}

// MOA/MOU (Ch 10, fig 10-5): plain bond, date-only ident (right), a centered title + "BETWEEN" the
// two activities (senior first), then Subj / Ref / Encl and numbered paragraphs.
function MoaHead({ state, ident }: { state: LetterState; ident: IdentLines }) {
  const lh = state.letterhead;
  const moa = state.moa;
  const title = `MEMORANDUM OF ${moa.kind === 'UNDERSTANDING' ? 'UNDERSTANDING' : 'AGREEMENT'}`;
  const refs = state.refs.filter((r) => r.text.trim());
  const encls = state.encls.filter((e) => e.text.trim());
  return (
    <>
      {lh.mode === 'on' && <Letterhead state={state} />}
      {lh.mode === 'preprinted' && (
        <div className="lh-spacer" aria-hidden style={{ height: `${Math.max(0.86, lh.preprintedLines * 0.11)}in` }} />
      )}
      {/* Dual identification blocks (fig 10-5): party A left (short title + the shared SSIC/code/date),
          party B right (its own short title + SSIC + serial + date). */}
      <div className={lh.mode === 'off' ? 'moa-idents no-letterhead' : 'moa-idents'}>
        <div className="moa-ident-a">
          {moa.shortTitleA.trim() && <div>{moa.shortTitleA}</div>}
          {state.includeSsic && (ident.ssic ? <div>{ident.ssic}</div> : <div className="ph ph-line">SSIC</div>)}
          {state.includeCode &&
            (ident.codeLine ? <div>{ident.codeLine}</div> : <div className="ph ph-line">Code</div>)}
          {ident.date ? <div>{ident.date}</div> : <div className="ph">Date</div>}
        </div>
        <div className="moa-ident-b">
          {moa.shortTitleB.trim() && <div>{moa.shortTitleB}</div>}
          {moa.ssicB.trim() && <div>{moa.ssicB}</div>}
          {moa.serialB.trim() && <div>Ser {moa.serialB}</div>}
          {moa.dateB.trim() && <div>{moa.dateB}</div>}
        </div>
      </div>
      <div className="moa-title" data-sync="head">
        <div className="moa-title-main">{title}</div>
        <div>BETWEEN</div>
        <div className={moa.partyA.trim() ? '' : 'ph'}>
          {moa.partyA.trim() || 'COMMANDER, FIRST ACTIVITY (the senior)'}
        </div>
        <div>AND</div>
        <div className={moa.partyB.trim() ? '' : 'ph'}>
          {moa.partyB.trim() || 'COMMANDER, SECOND ACTIVITY'}
        </div>
      </div>
      <div className="headings">
        <div className="hrow h-gap">
          <span className="label">Subj:</span>
          <span className={state.subj ? 'content subj' : 'content subj ph'}>
            {state.subj || 'SUBJECT IN ALL CAPS, NO PUNCTUATION'}
          </span>
        </div>
        {refs.length > 0 && (
          <div className="hrow h-gap">
            <span className="label">Ref:</span>
            <span className="content hlist">
              {refs.map((r, i) => (
                <span className="hitem" key={r.id}>
                  <span>({refLetter(i)})</span>
                  <span>{r.text}</span>
                </span>
              ))}
            </span>
          </div>
        )}
        {encls.length > 0 && (
          <div className="hrow h-gap">
            <span className="label">Encl:</span>
            <span className="content hlist">
              {encls.map((e, i) => (
                <span className="hitem" key={e.id}>
                  <span>({i + 1})</span>
                  <span>{e.text}</span>
                </span>
              ))}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

// MOA/MOU closing — dual signatures arranged so the senior official (party A, state.signature) is at
// the RIGHT and party B (moa.signerB) at the left, each over its own signature line (10-2, fig 10-5).
function MoaClose({ state }: { state: LetterState }) {
  const block = (s: SignatureBlock) => (
    <div className="moa-sig">
      <div className="moa-sig-line" />
      <div className={s.name ? '' : 'ph'}>{s.name || 'I. M. LASTNAME'}</div>
      {s.title && <div>{s.title}</div>}
      {s.authority === 'by-direction' && <div>By direction</div>}
      {s.authority === 'acting' && <div>Acting</div>}
    </div>
  );
  return (
    <div className="moa-close" data-sync="sig">
      {block(state.moa.signerB)}
      {block(state.signature)}
    </div>
  );
}

// Executive memorandum head (Ch 12, figs 12-9/12-11): the signing office's letterhead, a top-right
// date + control symbol, a centered "ACTION MEMO" / "INFO MEMO" title, FOR:/FROM: addressing, a
// Title-Case SUBJECT, and an optional Reference(s): line. The body is bulleted; the decision block
// lives in the close.
function ExecMemoHead({ state, ident }: { state: LetterState; ident: IdentLines }) {
  const lh = state.letterhead;
  const em = state.execMemo;
  const title = em.kind === 'INFORMATION' ? 'INFO MEMO' : 'ACTION MEMO';
  const isMemoFor = em.kind === 'MEMORANDUM-FOR';
  const refs = state.refs.filter((r) => r.text.trim());
  return (
    <>
      {lh.mode === 'on' && <Letterhead state={state} />}
      {lh.mode === 'preprinted' && (
        <div className="lh-spacer" aria-hidden style={{ height: `${Math.max(0.86, lh.preprintedLines * 0.11)}in` }} />
      )}
      {isMemoFor ? (
        // Fig 12-14: right-aligned date space, then the "MEMORANDUM FOR <recipient>" addressing.
        <>
          <div className={lh.mode === 'off' ? 'ident no-letterhead' : 'ident'}>
            {ident.date ? <div>{ident.date}</div> : <div className="ph">Date (added when signed)</div>}
          </div>
          <div className="exec-memofor" data-sync="head">
            MEMORANDUM FOR <span className={state.to ? '' : 'ph'}>{state.to || 'SECRETARY OF DEFENSE'}</span>
          </div>
        </>
      ) : (
        // Figs 12-9/12-11: centered title FIRST, then the date + control symbol beneath it.
        <>
          <div className="exec-title" data-sync="head">{title}</div>
          <div className="ident exec-ident">
            {ident.date ? <div>{ident.date}</div> : <div className="ph">Date (added when signed)</div>}
            {em.controlLine.trim() && <div>{em.controlLine}</div>}
          </div>
        </>
      )}
      <div className="headings exec">
        {!isMemoFor && (
          <>
            <div className="hrow">
              <span className="label">FOR:</span>
              <span className={state.to ? 'content' : 'content ph'}>{state.to || 'SECRETARY OF THE NAVY'}</span>
            </div>
            <div className="hrow">
              <span className="label">FROM:</span>
              <span className={em.from.trim() ? 'content' : 'content ph'}>{em.from.trim() || 'Full Name, Title'}</span>
            </div>
          </>
        )}
        <div className="hrow">
          <span className="label">SUBJECT:</span>
          <span className={state.subj.trim() ? 'content' : 'content ph'}>
            {state.subj.trim() || 'Subject in Title Case'}
          </span>
        </div>
        {refs.length > 0 && (
          <div className="hrow">
            <span className="label">{refs.length === 1 ? 'Reference:' : 'References:'}</span>
            <span className="content">
              {refs.length === 1
                ? refs[0].text
                : refs.map((r, i) => (
                    <div key={r.id}>
                      ({refLetter(i)}) {r.text}
                    </div>
                  ))}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

// Executive-memo close (Ch 12): the RECOMMENDATION + Approve/Disapprove decision block (ACTION only),
// then COORDINATION, Attachments, and "Prepared by".
function ExecMemoClose({ state }: { state: LetterState }) {
  const em = state.execMemo;
  const blank = '_'.repeat(14);
  const sig = state.signature;
  if (em.kind === 'MEMORANDUM-FOR') {
    // Plain "Memorandum For" (fig 12-14): a centered signature, then Attachments and cc — no decision.
    return (
      <div className="exec-close" data-sync="sig">
        <div className="exec-memofor-sig">
          <div className={sig.name ? '' : 'ph'}>{sig.name || 'I. M. LASTNAME'}</div>
          {sig.title && <div>{sig.title}</div>}
        </div>
        <div className="exec-meta">
          {/* Empty fields show gray screen-only hints (.ph never prints/exports). */}
          <div className={em.attachments.trim() ? 'exec-attach' : 'exec-attach ph'}>Attachments:</div>
          <div className={em.attachments.trim() ? '' : 'ph'}>{em.attachments.trim() || 'As stated'}</div>
          {em.cc?.trim() && (
            <div className="exec-cc">
              <div>cc:</div>
              {em.cc
                .split(/[\n;]/)
                .map((c) => c.trim())
                .filter(Boolean)
                .map((c, i) => (
                  <div key={i}>{c}</div>
                ))}
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="exec-close" data-sync="sig">
      {em.kind === 'ACTION' && (
        <div className="exec-rec">
          <div>
            <span className="label">RECOMMENDATION:</span>{' '}
            <span className={em.recommendation.trim() ? '' : 'ph'}>
              {em.recommendation.trim() || 'That SECNAV sign the action at TAB A.'}
            </span>
          </div>
          {em.decisionLines && (
            <div className="exec-decision">
              Approve {blank}&emsp;&emsp;Disapprove {blank}
            </div>
          )}
        </div>
      )}
      <div className="exec-meta">
        <div className={em.coordination.trim() ? '' : 'ph'}>
          <span className="label">COORDINATION:</span>{' '}
          <span>{em.coordination.trim() || 'TAB D (or None)'}</span>
        </div>
        <div className={em.attachments.trim() ? 'exec-attach' : 'exec-attach ph'}>Attachments:</div>
        <div className={em.attachments.trim() ? '' : 'ph'}>{em.attachments.trim() || 'As stated'}</div>
        {em.preparedBy.trim() && <div className="exec-prepared">Prepared by: {em.preparedBy}</div>}
      </div>
    </div>
  );
}

// Coordination page (Ch 12, fig 12-13): plain bond, a centered "COORDINATION PAGE" title over a table
// of the offices that reviewed/concurred (Office/Dept · POC/Title · Phone · Date · Remarks).
function CoordPageHead({ state }: { state: LetterState }) {
  const entries = state.coordPage.entries;
  return (
    <div className="coord-page" data-sync="head">
      <div className="coord-title">COORDINATION PAGE</div>
      <table className="coord-table">
        <thead>
          <tr>
            <th>Office/Dept</th>
            <th>Point of Contact/Title</th>
            <th>Phone</th>
            <th>Date</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={5} className="ph">
                Add offices in the editor — each row is one coordinating office.
              </td>
            </tr>
          ) : (
            entries.map((e) => (
              <tr key={e.id}>
                <td>{e.office}</td>
                <td>{e.poc}</td>
                <td>{e.phone}</td>
                <td>{e.date}</td>
                <td>{e.remarks}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// Joint letter / memorandum (Ch 7, fig 7-4): co-signed by multiple commands. The letterhead lists each
// command (senior first); each command keeps its own identification column (senior at the right); a
// "JOINT LETTER" title precedes the multi-command From block.
function JointHead({ state }: { state: LetterState }) {
  const lh = state.letterhead;
  const j = state.joint;
  const parties = j.parties;
  const title = `JOINT ${j.kind === 'MEMORANDUM' ? 'MEMORANDUM' : 'LETTER'}`;
  const refs = state.refs.filter((r) => r.text.trim());
  const encls = state.encls.filter((e) => e.text.trim());
  const sealSrc = SEAL_URL[lh.seal];
  const identCols = [...parties].reverse(); // senior (parties[0]) rendered at the RIGHT
  return (
    <>
      {lh.mode === 'on' && (
        <>
          {sealSrc && <img className="seal" src={sealSrc} alt="" />}
          <div className="letterhead">
            <div className="lh-dept">{lh.line1 || 'DEPARTMENT OF THE NAVY'}</div>
            {parties.map((p, i) => (
              <div key={i} className={p.command.trim() ? 'lh-sub' : 'lh-sub ph'}>
                {p.command.trim() || 'COMMAND TITLE'}
              </div>
            ))}
            <div className={lh.cityStateZip ? 'lh-sub' : 'lh-sub ph'}>{lh.cityStateZip || 'CITY STATE ZIP+4'}</div>
          </div>
        </>
      )}
      {lh.mode === 'preprinted' && (
        <div className="lh-spacer" aria-hidden style={{ height: `${Math.max(0.86, lh.preprintedLines * 0.11)}in` }} />
      )}
      <div className={lh.mode === 'off' ? 'joint-ident no-letterhead' : 'joint-ident'}>
        {identCols.map((p, i) => (
          <div className="joint-ident-col" key={i}>
            {p.shortTitle.trim() && <div>{p.shortTitle}</div>}
            {p.ssic.trim() && <div>{p.ssic}</div>}
            {p.serial.trim() && <div>{p.serial}</div>}
            {p.date.trim() && <div>{p.date}</div>}
          </div>
        ))}
      </div>
      <div className="joint-title" data-sync="head">{title}</div>
      <div className="headings">
        {parties.map((p, i) => (
          <div className="hrow" key={i}>
            <span className="label">{i === 0 ? 'From:' : ''}</span>
            <span className={p.from.trim() ? 'content' : 'content ph'}>{p.from.trim() || 'Commander, [command]'}</span>
          </div>
        ))}
        {/* fig 7-4 marks a blank line between the From: block and To: */}
        <div className="hrow h-gap">
          <span className="label">To:</span>
          <span className={state.to ? 'content' : 'content ph'}>{state.to || 'Action addressee'}</span>
        </div>
        <div className="hrow h-gap">
          <span className="label">Subj:</span>
          <span className={state.subj ? 'content subj' : 'content subj ph'}>
            {state.subj || 'SUBJECT IN ALL CAPS, NO PUNCTUATION'}
          </span>
        </div>
        {refs.length > 0 && (
          <div className="hrow h-gap">
            <span className="label">Ref:</span>
            <span className="content hlist">
              {refs.map((r, i) => (
                <span className="hitem" key={r.id}>
                  <span>({refLetter(i)})</span>
                  <span>{r.text}</span>
                </span>
              ))}
            </span>
          </div>
        )}
        {encls.length > 0 && (
          <div className="hrow h-gap">
            <span className="label">Encl:</span>
            <span className="content hlist">
              {encls.map((e, i) => (
                <span className="hitem" key={e.id}>
                  <span>({i + 1})</span>
                  <span>{e.text}</span>
                </span>
              ))}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

// Joint letter closing — one signature per command, senior at the RIGHT (7-4). Reuses the MOA
// signature-line styling.
function JointClose({ state }: { state: LetterState }) {
  // Fig 7-4: typed names only (no signature rules); junior at the left margin, senior at the
  // naval signature position (page center), a third cosigner between them.
  const cols = [...state.joint.parties].reverse(); // senior (parties[0]) at the right
  return (
    <div className={cols.length > 2 ? 'joint-close three' : 'joint-close'} data-sync="sig">
      {cols.map((p, i) => (
        <div className="joint-sig" key={i}>
          <div className={p.signer.name ? '' : 'ph'}>{p.signer.name || 'I. M. LASTNAME'}</div>
          {p.signer.title && <div>{p.signer.title}</div>}
          {p.signer.authority === 'by-direction' && <div>By direction</div>}
          {p.signer.authority === 'acting' && <div>Acting</div>}
        </div>
      ))}
    </div>
  );
}

function Signature({ state }: { state: LetterState }) {
  const sig = state.signature;
  return (
    <div className="signature" data-sync="sig">
      <div className={sig.name ? '' : 'ph'}>{sig.name || 'I. M. LASTNAME'}</div>
      {sig.title && <div>{sig.title}</div>}
      {sig.authority === 'by-direction' && <div>By direction</div>}
      {sig.authority === 'acting' && <div>Acting</div>}
    </div>
  );
}

function CopyTo({ items }: { items: string[] }) {
  return (
    <div className="copyto" data-sync="copy">
      <div>Copy to:</div>
      {items.map((c, i) => (
        <div key={i}>{c}</div>
      ))}
    </div>
  );
}

// Multiple-address letter (Ch 8-2): the "Distribution:" block of action addressees, printed after
// the signature and above "Copy to:". Shares the copy-to styling.
function Distribution({ items }: { items: ListEntry[] }) {
  return (
    <div className="copyto" data-sync="dist">
      <div>Distribution:</div>
      {items.map((d) => (
        <div key={d.id}>{d.text}</div>
      ))}
    </div>
  );
}

function Designation({ cui }: { cui: LetterState['cui'] }) {
  return (
    <div className="cui-designation">
      <div>Controlled by: {cui.controlledBy1}</div>
      {cui.controlledBy2 && <div>Controlled by: {cui.controlledBy2}</div>}
      <div>CUI Category: {cui.category}</div>
      <div>Limited Dissemination Control: {cui.dissemination}</div>
      {cui.poc && <div>POC: {cui.poc}</div>}
      {cui.transmittalNote.trim() && <div className="cui-transmittal">{cui.transmittalNote}</div>}
    </div>
  );
}

function CuiBanner({ pos, text }: { pos: 'top' | 'bottom'; text: string }) {
  return <div className={`cui-banner cui-${pos}`}>{text}</div>;
}

interface FlowItem {
  key: string;
  node: ReactNode;
  table?: TablePieceInfo; // a table piece — drawn per page (its rules depend on where breaks fall)
}

// Draw a flow item. A table piece needs to know whether it opens or closes the table's run on its
// page; everything else is drawn as built.
function renderItem(it: FlowItem, pageTop: boolean, pageBottom: boolean, measure = false): ReactNode {
  const p = it.table;
  if (!p) return it.node;
  return (
    <TablePiece
      {...p}
      pageTop={p.first || pageTop}
      pageBottom={p.last || pageBottom}
      repeatHeader={pageTop && !p.first && p.t.header}
      measure={measure}
    />
  );
}

// Build a virtual letter-state for an appended endorsement, rendered by the same LetterDoc.
// From: = the endorser; To:/Subj: carry from the basic letter; the "FIRST ENDORSEMENT on …"
// line is derived from the basic letter's originator/SSIC/serial/date.
function endorsementState(basic: LetterState, e: EndorsementEntry, i: number): LetterState {
  const basicId = basicLetterId(basic);
  // Fig 9-2: a new-page endorsement is prepared on the ENDORSING activity's letterhead. When the
  // endorsement carries letterhead lines (first = the DoN line, rest = activity/address/city), the
  // page renders them; blank = the plain continuation-sheet look.
  const lhLines = endorsementLetterheadLines(e);
  // Lines after the DoN line map bottom-up: last = city/state/zip, next-to-last = street address,
  // the rest = the activity name. With fewer than three, they're all activity lines.
  const sub = lhLines.slice(1);
  const full = sub.length >= 3;
  return {
    ...basic,
    type: 'endorsement',
    letterhead: lhLines.length
      ? {
          ...basic.letterhead,
          mode: 'on',
          titleOnly: false,
          line1: lhLines[0],
          activityName: (full ? sub.slice(0, -2) : sub).join('\n'),
          addressLine: full ? sub[sub.length - 2] : '',
          cityStateZip: full ? sub[sub.length - 1] : '',
        }
      : { ...basic.letterhead, mode: 'off' },
    endorsementNumber: ENDORSE_ORD[i] ?? `${i + 1}`,
    endorsementOf: basicId,
    from: e.endorser,
    serial: e.serial,
    originatorCode: '', // the endorser's serial carries its own code (fig 9-2 "Ser N72/420")
    includeSsic: true,
    includeCode: !!e.serial.trim(),
    via: remainingVias(basic, e.viaId),
    toAddrs: [],
    refs: [],
    encls: [],
    body: e.body,
    signature: { name: e.sigName, title: e.sigTitle, authority: e.authority ?? 'none' },
    distribution: [],
    copyTo: [],
    endorsements: [],
  };
}

// An "Add in document" enclosure rendered as its own appended sheet (after the letter +
// endorsements). Images render full-page; PDFs show a placeholder for now (page-by-page
// rasterizing is a follow-up — they still merge into the CAC-signable/print export).
function EnclosurePage({
  encl,
  index,
  cuiOn,
  banner,
}: {
  encl: EnclosureEntry;
  index: number;
  cuiOn: boolean;
  banner: string;
}) {
  const isImage = encl.file?.type.startsWith('image/');
  return (
    <div className="page enclosure-sheet">
      {/* CUI banner repeats on every page of a CUI package, enclosures included */}
      {cuiOn && <CuiBanner pos="top" text={banner} />}
      {isImage ? (
        <img className="encl-page-img" src={encl.file!.dataUrl} alt={encl.text} />
      ) : (
        <div className="encl-page-note">
          Enclosure ({index}): {encl.file?.name}
          <div className="encl-page-sub">PDF attached — page rendering in the preview is coming.</div>
        </div>
      )}
      {/* §7: enclosure marking, "Enclosure (n)", lower-right corner of each page. */}
      <div className="encl-mark">Enclosure ({index})</div>
      {cuiOn && <CuiBanner pos="bottom" text={banner} />}
    </div>
  );
}

export function LetterPreview({
  state,
  onTableChange,
}: {
  state: LetterState;
  // Set when the preview is editable: its table drag handles write back through this.
  onTableChange?: (pid: string, t: ParaTable) => void;
}) {
  const fitRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);

  // Fit-to-width: on screens narrower than the 8.5in sheet, scale the whole preview down so the
  // full page width is always visible (no horizontal scrolling/pinching). We use CSS `transform`,
  // NOT `zoom`: transform is visual-only, so the measurers' offsetHeight stays at true size and
  // pagination (which compares against pixel constants) is unaffected. The outer .preview-fit box
  // is sized to the SCALED footprint so the scroll container reserves the right space.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const fit = fitRef.current;
    const pages = pagesRef.current;
    const backdrop = fit?.closest('.paper-backdrop') as HTMLElement | null;
    if (!fit || !pages || !backdrop) return;
    if (typeof ResizeObserver === 'undefined') return; // jsdom/SSR has no layout — skip fit-to-width
    const apply = () => {
      const cs = getComputedStyle(backdrop);
      const avail = backdrop.clientWidth - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0');
      const natural = pages.offsetWidth; // true content width — transform does not affect offsetWidth
      const z = natural > 0 ? Math.min(1, avail / natural) : 1;
      if (z < 0.999) {
        pages.style.transform = `scale(${z})`;
        fit.style.width = `${natural * z}px`;
        fit.style.height = `${pages.offsetHeight * z}px`;
      } else {
        pages.style.transform = '';
        fit.style.width = '';
        fit.style.height = '';
      }
    };
    // Debounce RO callbacks to the next frame so we always measure the SETTLED layout. Reading
    // synchronously while the viewport changes (rotating a tablet, crossing the stack/side-by-side
    // breakpoint, a resize mid-reflow) can catch an intermediate width and leave the sheet scaled
    // wrong — which is exactly how the preview ends up overflowing its pane after a rotate.
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    const ro = new ResizeObserver(schedule);
    ro.observe(backdrop);
    ro.observe(pages);
    apply();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  });

  return (
    <TableEdit.Provider value={onTableChange ?? null}>
      <div className="preview-fit" ref={fitRef}>
        <div className="preview-pages" ref={pagesRef}>
          {state.type === 'njp-1626-7' ? (
            <Form1626 state={state} />
          ) : state.type === 'nato' ? (
            <NatoForm state={state} />
          ) : (
            <>
              <LetterDoc state={state} />
              {(state.type === 'standard-letter' || state.type === 'memo-from-to') &&
                state.endorsements.map((e, i) => (
                  <LetterheadHints.Provider key={e.id} value={false}>
                    <LetterDoc state={endorsementState(state, e, i)} showDesignation={false} />
                  </LetterheadHints.Provider>
                ))}
              {state.encls.map((e, i) =>
                  e.inDocument && e.file ? (
                    <EnclosurePage
                      key={e.id}
                      encl={e}
                      index={i + 1}
                      cuiOn={state.cui.enabled}
                      banner={e.cuiBanner?.trim() || state.cui.banner || 'CUI'}
                    />
                  ) : null,
                )}
            </>
          )}
        </div>
      </div>
    </TableEdit.Provider>
  );
}

function LetterDoc({ state, showDesignation = true }: { state: LetterState; showDesignation?: boolean }) {
  const cui = state.cui;
  // Portion markings show only once at least one paragraph is marked (per the user's flow:
  // enabling CUI doesn't auto-mark every paragraph). When active: (CUI) marked, (U) otherwise.
  const portionActive = cui.enabled && anyCui(state.body);
  const bannerText = cui.banner || 'CUI';
  const copyTo = state.copyTo.filter((c) => c.trim());
  const distribution = state.distribution.filter((d) => d.text.trim());

  // Flatten the body into atomic flow blocks: paragraphs, then signature, then copy-to.
  const flat: FlatPara[] = [];
  flattenForFlow(state.body, 0, flat);
  const isBusiness = state.type === 'business-letter';
  const isMoa = state.type === 'moa';
  const isJoint = state.type === 'joint-letter';
  const isExec = state.type === 'exec-memo';
  // A "Memorandum For" (Ch 12, fig 12-14) uses INDENTED (unnumbered) paragraphs like a business letter;
  // the Action/Info memos use bullets.
  const isExecMemoFor = isExec && state.execMemo.kind === 'MEMORANDUM-FOR';
  // The coordination page is a standalone table (rendered by Head); it has no body/signature/copy-to.
  const isCoord = state.type === 'coordination-page';
  const items: FlowItem[] = [
    // The coordination page is title + table only in every renderer — leftover body/distribution/
    // copy-to from a type switch must not flow beneath it (the exports drop them).
    ...(isCoord
      ? []
      : flat.flatMap((fp): FlowItem[] => {
          const para: FlowItem = {
            key: `p_${fp.key}`,
            node: (
              <ParaFlow
                fp={fp}
                portionActive={portionActive}
                business={isBusiness || isExecMemoFor}
                exec={isExec && !isExecMemoFor}
                memoFor={isExecMemoFor}
              />
            ),
          };
          if (!fp.table) return [para];
          // A paragraph's table follows its text (and comes before its subparagraphs).
          const t = fp.table;
          const widths = resolveWidths(t);
          const pieces = tablePieces(t);
          return [
            para,
            ...pieces.map((rows, k) => ({
              key: `t_${fp.key}_${t.rows[rows[0]].id}`,
              node: null,
              table: { pid: fp.key, t, widths, rows, first: k === 0, last: k === pieces.length - 1 },
            })),
          ];
        })),
    ...(isCoord
      ? []
      : [
          {
            key: 'sig',
            node: isJoint ? (
              <JointClose state={state} />
            ) : isMoa ? (
              <MoaClose state={state} />
            ) : isBusiness ? (
              <BusinessClose state={state} />
            ) : isExec ? (
              <ExecMemoClose state={state} />
            ) : (
              <Signature state={state} />
            ),
          },
        ]),
    ...(distribution.length && !isCoord ? [{ key: 'dist', node: <Distribution items={distribution} /> }] : []),
    ...(copyTo.length && !isCoord ? [{ key: 'copy', node: <CopyTo items={copyTo} /> }] : []),
  ];

  const measurerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<number[][]>([]);

  // Re-measure on EVERY render (intentionally no dep list): page breaks depend on rendered block
  // heights, which change with any edit, font load, or CUI toggle. This cannot loop — the setPages
  // below returns the *previous* array reference when the computed pagination is unchanged, so
  // React bails out of the redundant update. (An empty dep list, as the linter suggests, would
  // instead freeze pagination at first render and never re-flow on edits.)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const m = measurerRef.current;
    if (!m) return;
    const headH = (m.querySelector('[data-m="head"]') as HTMLElement | null)?.offsetHeight ?? 0;
    const contH = (m.querySelector('[data-m="cont"]') as HTMLElement | null)?.offsetHeight ?? 0;
    const adv = (Array.from(m.querySelectorAll('[data-m="item"]')) as HTMLElement[]).map(
      (el) => el.offsetHeight,
    );
    // A table continued onto a new page repeats its header row there — that page starts that much
    // fuller. Each header table's header row is measured on its own (data-m="rh").
    const rh = new Map<string, number>();
    (Array.from(m.querySelectorAll('[data-m="rh"]')) as HTMLElement[]).forEach((el) =>
      rh.set(el.dataset.pid ?? '', el.offsetHeight),
    );
    const repeatH = items.map((it) =>
      it.table && !it.table.first && it.table.t.header ? (rh.get(it.table.pid) ?? 0) : 0,
    );

    const cap1 = BODY_BOTTOM - PAGE1_TOP - headH - BODY_GAP;
    const capN = BODY_BOTTOM - PAGEN_TOP - contH - BODY_GAP;
    const result: number[][] = [];
    let cur: number[] = [];
    let acc = 0;
    let cap = cap1;
    for (let i = 0; i < adv.length; i++) {
      if (cur.length > 0 && acc + adv[i] > cap) {
        result.push(cur);
        cur = [];
        acc = 0;
        cap = capN;
      }
      if (cur.length === 0) acc += repeatH[i] ?? 0;
      cur.push(i);
      acc += adv[i];
    }
    if (cur.length || result.length === 0) result.push(cur);

    setPages((prev) => (JSON.stringify(prev) === JSON.stringify(result) ? prev : result));
  });

  const pageList = pages.length ? pages : [items.map((_, i) => i)];

  return (
    <>
      {/* Hidden measurer — same width/styles as a real page. */}
      <div className="page measurer" ref={measurerRef} aria-hidden>
        <div data-m="head">
          <Head state={state} />
        </div>
        <div data-m="cont">
          {isBusiness ? (
            <BusinessContinuationHead state={state} />
          ) : (
            <ContinuationHead subj={state.subj} />
          )}
        </div>
        {items.map((it) => (
          <div data-m="item" key={it.key}>
            {renderItem(it, false, false, true)}
          </div>
        ))}
        {items.map((it) =>
          it.table?.first && it.table.t.header ? (
            <div data-m="rh" data-pid={it.table.pid} key={`rh_${it.key}`}>
              <TablePiece {...it.table} rows={[]} last={false} pageTop pageBottom={false} repeatHeader measure />
            </div>
          ) : null,
        )}
      </div>

      {/* Real, paginated sheets. */}
      {pageList.map((idxs, p) => (
        <div className={p === 0 ? 'page' : 'page cont'} key={p}>
          {cui.enabled && <CuiBanner pos="top" text={bannerText} />}
          {p === 0 ? (
            <Head state={state} />
          ) : isBusiness ? (
            <BusinessContinuationHead state={state} />
          ) : (
            <ContinuationHead subj={state.subj} />
          )}
          <div className="body">
            {idxs.map((i, k) => {
              // pages can briefly hold stale indices after content shrinks (before the
              // measurer re-runs); guard so a missing item never crashes the render.
              const it = items[i];
              return it ? <Fragment key={it.key}>{renderItem(it, k === 0, k === idxs.length - 1)}</Fragment> : null;
            })}
          </div>
          {p === 0 && cui.enabled && showDesignation && <Designation cui={cui} />}
          {pageList.length > 1 && p >= 1 && <div className="page-number">{p + 1}</div>}
          {cui.enabled && <CuiBanner pos="bottom" text={bannerText} />}
        </div>
      ))}
    </>
  );
}
