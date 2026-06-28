import { describe, it, expect } from 'vitest';
import { detectPii } from './pii';
import { defaultFor } from '../defaultState';
import type { LetterState } from '../types';

const clean = (over: Partial<LetterState> = {}): LetterState => ({
  ...defaultFor('standard-letter'),
  subj: 'ROUTINE ADMINISTRATIVE MATTER',
  from: 'Commanding Officer',
  to: 'Chief of Naval Operations',
  refs: [],
  encls: [],
  body: [{ id: 'b', text: 'A clean paragraph with no sensitive data.', children: [] }],
  signature: { name: 'SMITH', title: '', authority: 'none' },
  ...over,
});

describe('detectPii()', () => {
  it('flags an SSN in the body and locates it', () => {
    const hits = detectPii(clean({ body: [{ id: 'b', text: 'Member SSN is 123-45-6789.', children: [] }] }));
    const ssn = hits.find((h) => h.kind === 'Social Security Number');
    expect(ssn).toBeDefined();
    expect(ssn?.where).toBe('the body');
  });

  it('flags a date-of-birth keyword', () => {
    expect(detectPii(clean({ subj: 'REQUEST FOR DOB VERIFICATION' })).some((h) => h.kind === 'date of birth')).toBe(true);
  });

  it('returns nothing for a clean letter', () => {
    expect(detectPii(clean())).toHaveLength(0);
  });

  it('counts multiple hits in the same area', () => {
    const ssn = detectPii(clean({ body: [{ id: 'b', text: '111-22-3333 and 444-55-6666', children: [] }] })).find(
      (h) => h.kind === 'Social Security Number',
    );
    expect(ssn?.count).toBe(2);
  });
});
