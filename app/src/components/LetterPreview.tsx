import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type {
  LetterState,
  Paragraph,
  EndorsementEntry,
  EnclosureEntry,
  ListEntry,
  SignatureBlock,
} from '../types';
import { parseInline } from '../format/inline';
import { paragraphMarker, depthIndentIn } from '../format/paragraphs';
import { anyCui } from '../format/tree';
import { SEAL_URL } from '../format/seals';
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
  exec,
}: {
  fp: FlatPara;
  portionActive: boolean;
  business?: boolean;
  exec?: boolean;
}) {
  // Business letter (Ch 11-2.6): main paragraphs are NOT numbered (just indented); subparagraphs are
  // lettered/numbered the same as a standard letter, so the ladder shifts one level deeper. Exec memo
  // (Ch 12, figs 12-9/12-11): main paragraphs are BULLETED ("•"); subparagraphs use the same ladder.
  const indent = business || exec ? depthIndentIn(fp.depth + 1) : depthIndentIn(fp.depth);
  const bulletTop = exec && fp.depth === 0;
  const showMarker = !((business && fp.depth === 0) || bulletTop);
  return (
    <p className="para" data-sync={`p:${fp.key}`} style={{ textIndent: `${indent}in` }}>
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

function Letterhead({ state }: { state: LetterState }) {
  const lh = state.letterhead;
  const sealSrc = SEAL_URL[lh.seal];
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
  const toAddrs = state.toAddrs.filter((a) => a.text.trim());
  const refs = state.refs.filter((r) => r.text.trim());
  const encls = state.encls.filter((e) => e.text.trim());
  if (state.type === 'business-letter') return <BusinessHead state={state} ident={ident} />;
  if (state.type === 'moa') return <MoaHead state={state} ident={ident} />;
  if (state.type === 'joint-letter') return <JointHead state={state} />;
  if (state.type === 'exec-memo') return <ExecMemoHead state={state} ident={ident} />;
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
  const refs = state.refs.filter((r) => r.text.trim());
  return (
    <>
      {lh.mode === 'on' && <Letterhead state={state} />}
      {lh.mode === 'preprinted' && (
        <div className="lh-spacer" aria-hidden style={{ height: `${Math.max(0.86, lh.preprintedLines * 0.11)}in` }} />
      )}
      {/* Date + control symbol, upper right. A principal's memo is dated when signed. */}
      <div className={lh.mode === 'off' ? 'ident no-letterhead' : 'ident'}>
        {ident.date ? <div>{ident.date}</div> : <div className="ph">Date (added when signed)</div>}
        {em.controlLine.trim() && <div>{em.controlLine}</div>}
      </div>
      <div className="exec-title" data-sync="head">{title}</div>
      <div className="headings exec">
        <div className="hrow">
          <span className="label">FOR:</span>
          <span className={state.to ? 'content' : 'content ph'}>{state.to || 'SECRETARY OF THE NAVY'}</span>
        </div>
        <div className="hrow">
          <span className="label">FROM:</span>
          <span className={em.from.trim() ? 'content' : 'content ph'}>{em.from.trim() || 'Full Name, Title'}</span>
        </div>
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
                      ({String.fromCharCode(97 + i)}) {r.text}
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
        <div>
          <span className="label">COORDINATION:</span>{' '}
          <span className={em.coordination.trim() ? '' : 'ph'}>{em.coordination.trim() || 'TAB D (or None)'}</span>
        </div>
        <div className="exec-attach">Attachments:</div>
        <div>{em.attachments.trim() || 'As stated'}</div>
        {em.preparedBy.trim() && <div className="exec-prepared">Prepared by: {em.preparedBy}</div>}
      </div>
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
        <div className="hrow">
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
  const cols = [...state.joint.parties].reverse(); // senior (parties[0]) at the right
  return (
    <div className="moa-close" data-sync="sig">
      {cols.map((p, i) => (
        <div className="moa-sig" key={i}>
          <div className="moa-sig-line" />
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
                    banner={e.cuiBanner?.trim() || state.cui.banner || 'CUI'}
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
  const distribution = state.distribution.filter((d) => d.text.trim());

  // Flatten the body into atomic flow blocks: paragraphs, then signature, then copy-to.
  const flat: FlatPara[] = [];
  flattenForFlow(state.body, 0, flat);
  const isBusiness = state.type === 'business-letter';
  const isMoa = state.type === 'moa';
  const isJoint = state.type === 'joint-letter';
  const isExec = state.type === 'exec-memo';
  const items: FlowItem[] = [
    ...flat.map((fp) => ({
      key: `p_${fp.key}`,
      node: <ParaFlow fp={fp} portionActive={portionActive} business={isBusiness} exec={isExec} />,
    })),
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
    ...(distribution.length ? [{ key: 'dist', node: <Distribution items={distribution} /> }] : []),
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
