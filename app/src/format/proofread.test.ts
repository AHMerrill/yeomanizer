import { describe, it, expect } from 'vitest';
import { proofread, type Check } from './proofread';
import { defaultFor } from '../defaultState';
import type { LetterState } from '../types';

const get = (checks: Check[], id: string) => checks.find((c) => c.id === id);

const clean = (over: Partial<LetterState> = {}): LetterState => ({
  ...defaultFor('standard-letter'),
  subj: 'ROUTINE MATTER',
  refs: [],
  encls: [],
  body: [{ id: 'b', text: 'A paragraph.', children: [] }],
  ...over,
});

describe('proofread()', () => {
  it('warns on an empty standard letter and clears once each field is filled', () => {
    const empty: LetterState = {
      ...defaultFor('standard-letter'),
      subj: '',
      from: '',
      to: '',
      signature: { name: '', title: '', authority: 'none' },
      dateMode: 'auto',
      body: [{ id: 'b', text: '', children: [] }],
    };
    const c1 = proofread(empty);
    expect(get(c1, 'subj')?.status).toBe('warn');
    expect(get(c1, 'from')?.status).toBe('warn');
    expect(get(c1, 'to')?.status).toBe('warn');
    expect(get(c1, 'body')?.status).toBe('warn');
    expect(get(c1, 'sig')?.status).toBe('warn');

    const filled: LetterState = {
      ...empty,
      subj: 'TEST SUBJECT',
      from: 'Commanding Officer',
      to: 'Chief of Naval Operations',
      signature: { name: 'I. M. SAILOR', title: '', authority: 'none' },
      body: [{ id: 'b', text: 'Body content.', children: [] }],
    };
    const c2 = proofread(filled);
    expect(get(c2, 'subj')?.status).toBe('pass');
    expect(get(c2, 'from')?.status).toBe('pass');
    expect(get(c2, 'to')?.status).toBe('pass');
    expect(get(c2, 'body')?.status).toBe('pass');
    expect(get(c2, 'sig')?.status).toBe('pass');
  });

  it('warns on a lowercase subject and a trailing period', () => {
    const c = proofread({ ...defaultFor('standard-letter'), subj: 'lower case subject.' });
    expect(get(c, 'subj-caps')?.status).toBe('warn');
    expect(get(c, 'subj-dot')?.status).toBe('warn');
  });

  it('flags a lone subparagraph (never a single subdivision)', () => {
    const s: LetterState = {
      ...defaultFor('standard-letter'),
      body: [{ id: 'p', text: 'Parent.', children: [{ id: 'c', text: 'only child', children: [] }] }],
    };
    expect(get(proofread(s), 'subdiv')?.status).toBe('warn');
  });

  it('the MFR type has no From/To checks (date-only identification)', () => {
    const c = proofread({ ...defaultFor('mfr'), from: '', to: '' });
    expect(get(c, 'from')).toBeUndefined();
    expect(get(c, 'to')).toBeUndefined();
    expect(get(c, 'subj')).toBeDefined(); // but it still checks subject, body, signature, date
  });

  it('the NATO form yields no draft checks (it is a fixed form)', () => {
    expect(proofread(defaultFor('nato'))).toHaveLength(0);
  });

  it('flags a reference cited in the body that is not listed', () => {
    const cited = clean({ refs: [], body: [{ id: 'b', text: 'In accordance with reference (a).', children: [] }] });
    expect(get(proofread(cited), 'ref-cite')?.status).toBe('warn');
    const ok = clean({
      refs: [{ id: 'r', text: 'SECNAV M-5216.5' }],
      body: [{ id: 'b', text: 'Per reference (a).', children: [] }],
    });
    expect(get(proofread(ok), 'ref-cite')?.status).toBe('pass');
  });

  it('flags an enclosure cited in the body that is not listed', () => {
    const cited = clean({ encls: [], body: [{ id: 'b', text: 'See enclosure (2).', children: [] }] });
    expect(get(proofread(cited), 'encl-cite')?.status).toBe('warn');
  });

  it('flags an incomplete CUI designation block when CUI is on', () => {
    const base = defaultFor('standard-letter');
    const incomplete = clean({ cui: { ...base.cui, enabled: true, controlledBy1: '', category: '', poc: '' } });
    expect(get(proofread(incomplete), 'cui-block')?.status).toBe('warn');
    const complete = clean({
      cui: { ...base.cui, enabled: true, controlledBy1: 'Department of the Navy', category: 'PRVCY', poc: 'POC, 703-555-5555' },
    });
    expect(get(proofread(complete), 'cui-block')?.status).toBe('pass');
  });

  it('warns on a non-standard manual date', () => {
    expect(get(proofread(clean({ dateMode: 'manual', dateManual: 'next tuesday' })), 'date-fmt')?.status).toBe('warn');
    expect(get(proofread(clean({ dateMode: 'manual', dateManual: '7 Sep 26' })), 'date-fmt')?.status).toBe('pass');
  });

  it('flags a CUI enclosure when the cover letter is unmarked (transmittal rule)', () => {
    const s = clean({
      cui: { ...defaultFor('standard-letter').cui, enabled: false },
      encls: [{ id: 'e1', text: 'Doc', inDocument: true, cuiBanner: 'CUI//SP-PROPIN' }],
    });
    expect(get(proofread(s), 'cui-cover')?.status).toBe('warn');
  });

  it('rolls the cover banner up to the most restrictive enclosure marking', () => {
    const base = defaultFor('standard-letter');
    const fullCui = { ...base.cui, enabled: true, banner: 'CUI//PRVCY', controlledBy1: 'DON', category: 'PRVCY', poc: 'x' };
    const diverges = clean({ cui: fullCui, encls: [{ id: 'e1', text: 'Doc', inDocument: true, cuiBanner: 'CUI//SP-PROPIN' }] });
    expect(get(proofread(diverges), 'cui-rollup')?.status).toBe('warn');
    const matches = clean({ cui: fullCui, encls: [{ id: 'e1', text: 'Doc', inDocument: true, cuiBanner: 'CUI//PRVCY' }] });
    expect(get(proofread(matches), 'cui-rollup')?.status).toBe('pass');
  });
});
