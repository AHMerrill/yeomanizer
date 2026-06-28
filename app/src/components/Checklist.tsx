// Proofread tab — a pre-send review grounded in SECNAV M-5216.5, Ch 2, ¶19. Three groups:
//   1. data-driven checks on the current draft (pass / warn),
//   2. the format-framework items the render engine already guarantees,
//   3. the substance items (¶19.c/.d) the writer verifies — manual checkboxes.
// All advisory. Reads the editing state; never mutates it. The manual checks are local, session-only
// state (they reset when you leave the tab — a feature: re-verify after you change anything).
import { useEffect, useState } from 'react';
import type { LetterState } from '../types';
import { proofread } from '../format/proofread';
import { detectPii } from '../format/pii';
import { loadSpeller, checkText, draftProse, type SpellHit } from '../format/spell';

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
  'Read slowly for typos, spelling, punctuation, spacing, and grammar.',
  'Reviewed the spelling check above and fixed real misspellings; checked grammar too (the tool checks spelling, not grammar).',
  'Looked up any hyphenated or uncertain words.',
  'Read once more for content and substance.',
  'Acronyms are spelled out on first use.',
  'The subject accurately summarizes the letter.',
  'The SSIC is correct for the subject.',
  'Addressee’s name, title, and office code are current and correct.',
  'Every reference is accurate and available to the reader.',
  'Each listed enclosure is actually attached and in the right order.',
  'A point of contact (name + phone/email) is included if a reply is expected.',
  'Any required-by / suspense date is stated if action is required.',
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

  // Offline spell-check of the subject + body — lazy-loads a bundled dictionary, runs in the browser,
  // and never sends or stores your text.
  const [spell, setSpell] = useState<{ loading: boolean; hits: SpellHit[] } | null>(null);
  const prose = state && state.type !== 'nato' ? draftProse(state) : '';
  useEffect(() => {
    if (!prose.trim()) {
      setSpell(null);
      return;
    }
    let cancelled = false;
    setSpell({ loading: true, hits: [] });
    loadSpeller()
      .then((sp) => {
        if (!cancelled) setSpell({ loading: false, hits: checkText(sp, prose) });
      })
      .catch(() => {
        if (!cancelled) setSpell(null); // dictionary unavailable (e.g. offline first load) — fail quiet
      });
    return () => {
      cancelled = true;
    };
  }, [prose]);

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
  const pii = detectPii(state);

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

        <section className="check-group">
          <h2>
            Possible sensitive data{' '}
            {pii.length === 0 ? (
              <span className="grp-ok">none detected</span>
            ) : (
              <span className="grp-warn">{pii.length} to review</span>
            )}
          </h2>
          {pii.length === 0 ? (
            <p className="check-note">
              No obvious SSN, DoD ID, or date-of-birth patterns found. This is a quick local scan, not a
              guarantee — deciding what is PII/CUI, and marking it, is still your call.
            </p>
          ) : (
            <>
              <ul className="checks">
                {pii.map((h) => (
                  <li key={h.kind + h.where} className="warn">
                    <span className="check-icon" aria-hidden="true">
                      !
                    </span>
                    <span className="check-body">
                      <span className="check-label">
                        {h.kind}
                        {h.count > 1 ? ` ×${h.count}` : ''} — in {h.where}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="check-note">
                If this is PII/CUI, make sure the document is marked accordingly and handled only on
                authorized equipment. The scan runs locally — nothing here is logged or sent anywhere.
              </p>
            </>
          )}
        </section>

        {!isForm && spell && (
          <section className="check-group">
            <h2>
              Spelling{' '}
              {spell.loading ? (
                <span className="grp-warn">checking…</span>
              ) : spell.hits.length === 0 ? (
                <span className="grp-ok">looks clean</span>
              ) : (
                <span className="grp-warn">{spell.hits.length} to check</span>
              )}
            </h2>
            {spell.loading && (
              <p className="check-note">
                Checking the subject and body against a bundled dictionary, in your browser…
              </p>
            )}
            {!spell.loading && spell.hits.length === 0 && (
              <p className="check-note">
                No likely misspellings in the subject or body. It’s an offline check against a bundled
                dictionary — names, codes, references, and many acronyms aren’t checked, so it’s advisory,
                not a guarantee. Your text never leaves the page.
              </p>
            )}
            {!spell.loading && spell.hits.length > 0 && (
              <>
                <ul className="spell-list">
                  {spell.hits.map((h) => (
                    <li key={h.word}>
                      <span className="spell-word">{h.word}</span>
                      {h.suggest.length > 0 && <span className="spell-sug">→ {h.suggest.join(', ')}</span>}
                    </li>
                  ))}
                </ul>
                <p className="check-note">
                  Words from the subject and body not in the dictionary — proper nouns and acronyms may
                  show up; ignore those. The check runs entirely in your browser; nothing is sent or stored.
                </p>
              </>
            )}
          </section>
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
