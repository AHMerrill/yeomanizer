import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { LetterState, Paragraph, EndorsementEntry, EnclosureEntry } from '../types';
import { parseInline } from '../format/inline';
import { paragraphMarker, depthIndentIn } from '../format/paragraphs';
import { anyCui } from '../format/tree';
import {
  buildIdent,
  refLetter,
  ENDORSE_ORD,
  basicLetterId,
  remainingVias,
  type IdentLines,
} from '../format/identification';
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
}
function flattenForFlow(list: Paragraph[], depth: number, out: FlatPara[]): void {
  list.forEach((p, i) => {
    out.push({ key: p.id, depth, index: i, text: p.text, cui: p.cui, title: p.title });
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
}: {
  fp: FlatPara;
  portionActive: boolean;
  business?: boolean;
}) {
  // Business letter (Ch 11-2.6): main paragraphs are NOT numbered (just indented); subparagraphs are
  // lettered/numbered the same as a standard letter, so the whole ladder shifts one level deeper.
  const indent = business ? depthIndentIn(fp.depth + 1) : depthIndentIn(fp.depth);
  const showMarker = !(business && fp.depth === 0);
  return (
    <p className="para" style={{ textIndent: `${indent}in` }}>
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

// Seal sources — all authentic, downloaded assets (never recolored/redrawn):
//   dod       = the letterhead seal as printed in SECNAV M-5216.5 Fig 7-1 (DoD seal, blue)
//   dod-color = the official full-color DoD seal vector (razor-sharp, full color)
const SEAL_SRC: Record<LetterState['letterhead']['seal'], string | null> = {
  dod: '/dod-seal.png',
  'dod-color': '/dod-seal.svg',
  don: '/don-seal.svg',
  none: null,
};

function Letterhead({ state }: { state: LetterState }) {
  const lh = state.letterhead;
  const sealSrc = SEAL_SRC[lh.seal];
  return (
    <>
      {sealSrc && <img className="seal" src={sealSrc} alt="" />}
      <div className="letterhead">
        <div className="lh-dept">{lh.line1}</div>
        {lh.activityName ? (
          lh.activityName.split('\n').map((l, i) => (
            <div key={i} className="lh-sub">
              {l || ' '}
            </div>
          ))
        ) : (
          <div className="lh-sub ph">NAME OF ACTIVITY</div>
        )}
        <div className={lh.addressLine ? 'lh-sub' : 'lh-sub ph'}>
          {lh.addressLine || 'STREET ADDRESS'}
        </div>
        <div className={lh.cityStateZip ? 'lh-sub' : 'lh-sub ph'}>
          {lh.cityStateZip || 'CITY STATE ZIP+4'}
        </div>
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
  const refs = state.refs.filter((r) => r.text.trim());
  const encls = state.encls.filter((e) => e.text.trim());
  if (state.type === 'business-letter') return <BusinessHead state={state} ident={ident} />;
  return (
    <>
      {lh.mode === 'on' && <Letterhead state={state} />}
      {lh.mode === 'preprinted' && <div className="lh-spacer" aria-hidden />}
      {/* Memo: date only (flush right, ~6th line). Letter: SSIC block (lines optional).
          A kept-but-blank line shows a faint screen-only placeholder (hidden in print). */}
      <div className={lh.mode === 'off' ? 'ident no-letterhead' : 'ident'}>
        {!isMemo &&
          state.includeSsic &&
          (ident.ssic ? <div>{ident.ssic}</div> : <div className="ph">SSIC</div>)}
        {!isMemo &&
          state.includeCode &&
          (ident.codeLine ? <div>{ident.codeLine}</div> : <div className="ph">Code</div>)}
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
      <div className={isMemo || isMfr ? 'headings memo' : isEndorsement ? 'headings endo' : 'headings'}>
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
      {lh.mode === 'preprinted' && <div className="lh-spacer" aria-hidden />}
      <div className={`${lh.mode === 'off' ? 'ident no-letterhead' : 'ident'} biz-ident`}>
        {state.includeSsic && (ident.ssic ? <div>{ident.ssic}</div> : <div className="ph">SSIC</div>)}
        {state.includeCode &&
          (ident.codeLine ? <div>{ident.codeLine}</div> : <div className="ph">Code</div>)}
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
      {encls.length > 1 && (
        <div className="biz-encls">
          <div>Enclosures:</div>
          {encls.map((e, i) => (
            <div key={e.id} className="biz-encl-item">
              {i + 1}.&ensp;{e.text}
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

function Signature({ state }: { state: LetterState }) {
  const sig = state.signature;
  return (
    <div className="signature">
      <div className={sig.name ? '' : 'ph'}>{sig.name || 'I. M. LASTNAME'}</div>
      {sig.title && <div>{sig.title}</div>}
      {sig.authority === 'by-direction' && <div>By direction</div>}
      {sig.authority === 'acting' && <div>Acting</div>}
    </div>
  );
}

function CopyTo({ items }: { items: string[] }) {
  return (
    <div className="copyto">
      <div>Copy to:</div>
      {items.map((c, i) => (
        <div key={i}>{c}</div>
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
    </div>
  );
}

function CuiBanner({ pos, text }: { pos: 'top' | 'bottom'; text: string }) {
  return <div className={`cui-banner cui-${pos}`}>{text}</div>;
}

interface FlowItem {
  key: string;
  node: ReactNode;
}

// Build a virtual letter-state for an appended endorsement, rendered by the same LetterDoc.
// From: = the endorser; To:/Subj: carry from the basic letter; the "FIRST ENDORSEMENT on …"
// line is derived from the basic letter's originator/SSIC/serial/date.
function endorsementState(basic: LetterState, e: EndorsementEntry, i: number): LetterState {
  const basicId = basicLetterId(basic);
  return {
    ...basic,
    type: 'endorsement',
    letterhead: { ...basic.letterhead, mode: 'off' },
    endorsementNumber: ENDORSE_ORD[i] ?? `${i + 1}`,
    endorsementOf: basicId,
    from: e.endorser,
    serial: e.serial,
    includeSsic: true,
    includeCode: !!e.serial.trim(),
    via: remainingVias(basic, e.viaId),
    refs: [],
    encls: [],
    body: e.body,
    signature: { name: e.sigName, title: e.sigTitle, authority: e.authority ?? 'none' },
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

export function LetterPreview({ state }: { state: LetterState }) {
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
    <div className="preview-fit" ref={fitRef}>
      <div className="preview-pages" ref={pagesRef}>
        {state.type === 'nato' ? (
          <NatoForm state={state} />
        ) : (
          <>
            <LetterDoc state={state} />
            {state.type !== 'endorsement' &&
              state.endorsements.map((e, i) => (
                <LetterDoc key={e.id} state={endorsementState(state, e, i)} />
              ))}
            {state.type !== 'endorsement' &&
              state.encls.map((e, i) =>
                e.inDocument && e.file ? (
                  <EnclosurePage
                    key={e.id}
                    encl={e}
                    index={i + 1}
                    cuiOn={state.cui.enabled}
                    banner={state.cui.banner || 'CUI'}
                  />
                ) : null,
              )}
          </>
        )}
      </div>
    </div>
  );
}

function LetterDoc({ state }: { state: LetterState }) {
  const cui = state.cui;
  // Portion markings show only once at least one paragraph is marked (per the user's flow:
  // enabling CUI doesn't auto-mark every paragraph). When active: (CUI) marked, (U) otherwise.
  const portionActive = cui.enabled && anyCui(state.body);
  const bannerText = cui.banner || 'CUI';
  const copyTo = state.copyTo.filter((c) => c.trim());

  // Flatten the body into atomic flow blocks: paragraphs, then signature, then copy-to.
  const flat: FlatPara[] = [];
  flattenForFlow(state.body, 0, flat);
  const isBusiness = state.type === 'business-letter';
  const items: FlowItem[] = [
    ...flat.map((fp) => ({
      key: `p_${fp.key}`,
      node: <ParaFlow fp={fp} portionActive={portionActive} business={isBusiness} />,
    })),
    { key: 'sig', node: isBusiness ? <BusinessClose state={state} /> : <Signature state={state} /> },
    ...(copyTo.length ? [{ key: 'copy', node: <CopyTo items={copyTo} /> }] : []),
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
            {it.node}
          </div>
        ))}
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
            {idxs.map((i) => {
              // pages can briefly hold stale indices after content shrinks (before the
              // measurer re-runs); guard so a missing item never crashes the render.
              const it = items[i];
              return it ? <Fragment key={it.key}>{it.node}</Fragment> : null;
            })}
          </div>
          {p === 0 && cui.enabled && <Designation cui={cui} />}
          {pageList.length > 1 && p >= 1 && <div className="page-number">{p + 1}</div>}
          {cui.enabled && <CuiBanner pos="bottom" text={bannerText} />}
        </div>
      ))}
    </>
  );
}
