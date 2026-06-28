// Proofread tab — a pre-send review grounded in SECNAV M-5216.5, Ch 2, ¶19. Three groups:
//   1. data-driven checks on the current draft (pass / warn),
//   2. the format-framework items the render engine already guarantees,
//   3. the substance items (¶19.c/.d) the writer verifies — manual checkboxes.
// All advisory. Reads the editing state; never mutates it. The manual checks are local, session-only
// state (they reset when you leave the tab — a feature: re-verify after you change anything).
import { useState } from 'react';
import type { LetterState } from '../types';
import { proofread } from '../format/proofread';

// ¶19.b framework items the engine renders to spec automatically (verified across preview/PDF/.docx).
const ENGINE = [
  '1-inch margins on every page',
  'Sequential paragraph numbering (1, 2…, then a, b…) and indentation',
  'Page numbers centered near the bottom margin, from page 2',
  'Letterhead, seal, and identification-block placement',
  'Enclosure “Enclosure (n)” markings on appended pages',
  'CUI banners top & bottom of every page when CUI is on',
];

// ¶19.c (typos/spelling/grammar) and ¶19.d (read for content), plus the judgment items only a person
// can confirm. Checkboxes are a reminder, not a gate.
const MANUAL = [
  'Read slowly for typos, spelling, punctuation, spacing, and grammar (¶19.c).',
  'Looked up any hyphenated or uncertain words.',
  'Ran spell-check / grammar-check — as a tool, not the only check.',
  'Read once more for content and substance (¶19.d).',
  'Addressee’s name, title, and office code are current and correct.',
  'Every reference is accurate and available to the reader.',
  'Each listed enclosure is actually attached and in the right order.',
  'CUI / classification marking matches the content — your call; the tool only formats.',
  'Signature line and signing authority (by direction / acting) are correct.',
];

export function Checklist({ state }: { state: LetterState | null }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setDone((d) => {
      const n = new Set(d);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  if (!state) {
    return (
      <div className="checklist">
        <div className="checklist-inner">
          <h1>Proofread</h1>
          <p className="checklist-lede">
            Start a letter in <b>Builder</b> — or import one in <b>Editor</b> — to run the checklist
            against it.
          </p>
        </div>
      </div>
    );
  }

  const isForm = state.type === 'nato';
  const checks = isForm ? [] : proofread(state);
  const warnings = checks.filter((c) => c.status === 'warn');

  return (
    <div className="checklist">
      <div className="checklist-inner">
        <h1>Proofread</h1>
        <p className="checklist-lede">
          A pre-send review based on the proofreading method in <b>SECNAV M-5216.5, Ch 2, ¶19</b>.
          Everything here is advisory — the tool flags and formats; it never blocks an export and
          certifies nothing.
        </p>

        {!isForm && (
          <section className="check-group">
            <h2>
              Your draft{' '}
              {warnings.length === 0 ? (
                <span className="grp-ok">✓ all clear</span>
              ) : (
                <span className="grp-warn">
                  {warnings.length} to look at
                </span>
              )}
            </h2>
            <ul className="checks">
              {checks.map((c) => (
                <li key={c.id} className={c.status}>
                  <span className="check-icon" aria-hidden="true">
                    {c.status === 'pass' ? '✓' : '!'}
                  </span>
                  <span className="check-body">
                    <span className="check-label">{c.label}</span>
                    {c.status === 'warn' && <span className="check-hint">{c.hint}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {isForm && (
          <p className="checklist-lede">
            The NATO travel order is a fixed form, so the draft checks above apply to letters and
            memos. Use the review list below before signing.
          </p>
        )}

        {!isForm && (
          <section className="check-group">
            <h2>Handled automatically by the format engine</h2>
            <ul className="checks">
              {ENGINE.map((t) => (
                <li key={t} className="pass">
                  <span className="check-icon" aria-hidden="true">
                    ✓
                  </span>
                  <span className="check-body">
                    <span className="check-label">{t}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="check-group">
          <h2>Review before you sign</h2>
          <ul className="checks manual">
            {MANUAL.map((t, i) => {
              const id = 'm' + i;
              return (
                <li key={id}>
                  <label>
                    <input type="checkbox" checked={done.has(id)} onChange={() => toggle(id)} />
                    <span className={done.has(id) ? 'check-label done' : 'check-label'}>{t}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
