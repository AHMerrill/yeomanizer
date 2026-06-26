import { describe, it, expect } from 'vitest';
import { buildIdent, refLetter } from './identification';
import { defaultState } from '../defaultState';
import type { LetterState } from '../types';

const base = (over: Partial<LetterState> = {}): LetterState => ({ ...defaultState, ...over });
const sep7 = new Date(2006, 8, 7);

describe('buildIdent — sender symbol block (§7-2.3)', () => {
  it('codeLine is just the code when unserialized', () => {
    expect(buildIdent(base({ originatorCode: 'Code 13', serial: '' })).codeLine).toBe('Code 13');
  });

  it('codeLine is "Ser <code>/<serial>" when serialized', () => {
    expect(buildIdent(base({ originatorCode: 'N00J', serial: 'S20' })).codeLine).toBe('Ser N00J/S20');
  });

  it('auto date uses the abbreviated form', () => {
    expect(buildIdent(base({ dateMode: 'auto' }), sep7).date).toBe('7 Sep 06');
  });

  it('manual date is passed through, trimmed', () => {
    expect(buildIdent(base({ dateMode: 'manual', dateManual: '  3 Jan 25 ' })).date).toBe('3 Jan 25');
  });

  it('dateMode "none" yields no date', () => {
    expect(buildIdent(base({ dateMode: 'none' })).date).toBe('');
  });

  it('ssic is trimmed', () => {
    expect(buildIdent(base({ ssic: ' 5216 ' })).ssic).toBe('5216');
  });
});

describe('refLetter — reference lettering (a, b, … aa)', () => {
  it('maps 0→a, 1→b, 25→z', () => {
    expect(refLetter(0)).toBe('a');
    expect(refLetter(1)).toBe('b');
    expect(refLetter(25)).toBe('z');
  });

  it('wraps past z: 26→aa, 27→ab', () => {
    expect(refLetter(26)).toBe('aa');
    expect(refLetter(27)).toBe('ab');
  });
});
