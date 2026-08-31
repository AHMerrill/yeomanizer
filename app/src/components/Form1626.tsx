// NAVPERS 1626/7 preview. Walks the SAME geometry table the PDF renderer walks
// (data/form1626.ts), positioning everything in points on a 612x792 sheet, so the preview and the
// export cannot drift apart — the parity that CHECKLIST Part A #4 demands for every type.
import type { CSSProperties } from 'react';
import type { LetterState } from '../types';
import {
  FORM_1626_PAGES,
  FORM_1626_SIGS,
  FORM_PAGE_W,
  FORM_PAGE_H,
  type FormGlyph,
} from '../data/form1626';

const px = (v: number) => `${v}pt`;

function glyphStyle(g: FormGlyph): CSSProperties {
  return {
    left: px(g.x),
    top: px(g.y),
    fontSize: px(g.s),
    fontWeight: g.b ? 700 : 400,
    fontStyle: g.i ? 'italic' : 'normal',
  };
}

// The free-text blocks are areas rather than single-line slots; these match the boxes the PDF
// renderer wraps into, so a long entry breaks at the same place in both.
const AREAS: { page: number; key: 'detailsOfOffenses' | 'recordOfPreviousOffenses' | 'coComments'; x: number; y: number; w: number; h: number }[] = [
  { page: 0, key: 'detailsOfOffenses', x: 38.5, y: 168, w: 535, h: 138 },
  { page: 0, key: 'recordOfPreviousOffenses', x: 38.5, y: 630, w: 535, h: 118 },
  { page: 1, key: 'coComments', x: 38.5, y: 500, w: 535, h: 78 },
];

const PLEA_COLS = [73.5, 151.7, 233.4, 326.7, 501.1];
const PLEA_W = [40, 25, 33, 56, 72];
const PLEA_Y = [229.9, 247.8, 265.8, 283.7, 301.7];

export function Form1626({ state }: { state: LetterState }) {
  const njp = state.njp;
  const cuiOn = state.cui.enabled;
  const banner = (state.cui.banner || 'CUI').toUpperCase();

  return (
    <>
      {FORM_1626_PAGES.map((fp, pi) => (
        <div
          className="page form-sheet"
          key={pi}
          style={{ width: px(FORM_PAGE_W), height: px(FORM_PAGE_H) }}
        >
          {/* The app's own CUI marking sits at the sheet edge, clear of the form's printed
              "CUI - (when Filled In)" banner, so enabling it never doubles up on that line. */}
          {cuiOn && (
            <>
              <div className="form-cui form-cui-top">{banner}</div>
              <div className="form-cui form-cui-bot">{banner}</div>
            </>
          )}
          {fp.rules.map((r, i) => (
            <div
              className="form-rule"
              key={`r${i}`}
              style={{ left: px(r.x), top: px(r.y), width: px(r.w), height: px(r.h) }}
            />
          ))}
          {fp.checks.map((c, i) => (
            <div
              className="form-check"
              key={`c${i}`}
              style={{ left: px(c.x), top: px(c.y), width: px(c.w), height: px(c.h) }}
            >
              {c.id && njp.checks[c.id] ? <span aria-hidden="true">✕</span> : null}
            </div>
          ))}
          {fp.glyphs.map((g, i) => (
            <div className="form-glyph" key={`g${i}`} style={glyphStyle(g)}>
              {g.t}
            </div>
          ))}
          {fp.slots.map((s) => {
            const v = (njp.values[s.id] ?? '').trim();
            if (!v) return null;
            return (
              <div
                className="form-value"
                key={s.id}
                style={{ left: px(s.x), top: px(s.y), width: px(s.w), fontSize: px(s.s) }}
              >
                {v}
              </div>
            );
          })}
          {AREAS.filter((a) => a.page === pi).map((a) => {
            const v = njp[a.key].trim();
            if (!v) return null;
            return (
              <div
                className="form-area"
                key={a.key}
                style={{ left: px(a.x), top: px(a.y), width: px(a.w), height: px(a.h) }}
              >
                {v}
              </div>
            );
          })}
          {pi === 1 &&
            njp.pleas.slice(0, PLEA_Y.length).map((row, ri) =>
              [row.article, row.charge, row.specification, row.plea, row.finding].map((v, ci) =>
                (v ?? '').trim() ? (
                  <div
                    className="form-value"
                    key={`pl${ri}-${ci}`}
                    style={{
                      left: px(PLEA_COLS[ci]),
                      top: px(PLEA_Y[ri]),
                      width: px(PLEA_W[ci]),
                      fontSize: px(7.9),
                    }}
                  >
                    {v}
                  </div>
                ) : null,
              ),
            )}
          {/* Signature areas. The PDF puts a real CAC-signable field over each; here they are shown
              as a subtle guide so the writer can see where the form expects a signature. */}
          {FORM_1626_SIGS.filter((s) => s.p === pi).map((s) => (
            <div
              className="form-sig"
              key={s.id}
              title={`${s.label} — signable in the exported PDF`}
              style={{ left: px(s.x), top: px(s.y), width: px(s.w), height: px(s.h) }}
            >
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
