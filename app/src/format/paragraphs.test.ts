import { describe, it, expect } from 'vitest';
import {
  paragraphMarker,
  markerText,
  depthIndentIn,
  PARA_INDENTS_IN,
  MAX_DEPTH,
} from './paragraphs';

describe('paragraphMarker — SECNAV M-5216.5 fig 7-8 ladder', () => {
  it('depth 0 → "1." "2." (number + period, not underlined)', () => {
    expect(markerText(paragraphMarker(0, 0))).toBe('1.');
    expect(markerText(paragraphMarker(0, 1))).toBe('2.');
    expect(paragraphMarker(0, 0).underline).toBe(false);
  });

  it('depth 1 → "a." "b." (lower alpha + period)', () => {
    expect(markerText(paragraphMarker(1, 0))).toBe('a.');
    expect(markerText(paragraphMarker(1, 1))).toBe('b.');
  });

  it('depth 2 → "(1)" "(3)" (paren number)', () => {
    expect(markerText(paragraphMarker(2, 0))).toBe('(1)');
    expect(markerText(paragraphMarker(2, 2))).toBe('(3)');
  });

  it('depth 3 → "(a)" "(b)" (paren alpha)', () => {
    expect(markerText(paragraphMarker(3, 0))).toBe('(a)');
    expect(markerText(paragraphMarker(3, 1))).toBe('(b)');
  });

  it('depths 4–7 repeat the 0–3 glyphs but underlined', () => {
    expect(markerText(paragraphMarker(4, 0))).toBe('1.');
    expect(paragraphMarker(4, 0).underline).toBe(true);
    expect(markerText(paragraphMarker(5, 0))).toBe('a.');
    expect(markerText(paragraphMarker(6, 0))).toBe('(1)');
    expect(markerText(paragraphMarker(7, 0))).toBe('(a)');
    expect(paragraphMarker(7, 0).underline).toBe(true);
  });

  it('alpha wraps past z: index 25 → "z", index 26 → "aa"', () => {
    expect(paragraphMarker(1, 25).core).toBe('z');
    expect(paragraphMarker(1, 26).core).toBe('aa');
  });
});

describe('depthIndentIn', () => {
  it('returns the calibrated indent per depth', () => {
    expect(depthIndentIn(0)).toBe(0);
    expect(depthIndentIn(1)).toBe(0.25);
  });

  it('clamps beyond the table to the last value (never undefined)', () => {
    const last = PARA_INDENTS_IN[PARA_INDENTS_IN.length - 1];
    expect(depthIndentIn(99)).toBe(last);
    expect(depthIndentIn(MAX_DEPTH + 5)).toBe(last);
  });
});
