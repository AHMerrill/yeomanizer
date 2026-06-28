import { describe, it, expect } from 'vitest';
import { proofread, type Check } from './proofread';
import { defaultFor } from '../defaultState';
import type { LetterState } from '../types';

const get = (checks: Check[], id: string) => checks.find((c) => c.id === id);

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
});
