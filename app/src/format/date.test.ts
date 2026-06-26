import { describe, it, expect } from 'vitest';
import { abbreviatedDate, standardDate, civilianDate } from './date';

// Local-time Date(year, monthIndex, day) so getMonth/getDate are deterministic.
const d = (y: number, m0: number, day: number) => new Date(y, m0, day);

describe('date formats — SECNAV M-5216.5 §2-16 (day has NO leading zero)', () => {
  it('abbreviatedDate → "7 Sep 06" (day, 3-letter month, 2-digit year)', () => {
    expect(abbreviatedDate(d(2006, 8, 7))).toBe('7 Sep 06');
  });

  it('abbreviatedDate keeps no leading zero on single-digit days', () => {
    expect(abbreviatedDate(d(2024, 0, 1))).toBe('1 Jan 24');
    expect(abbreviatedDate(d(2024, 11, 9))).toBe('9 Dec 24');
  });

  it('standardDate → "5 May 2015" (full month, 4-digit year)', () => {
    expect(standardDate(d(2015, 4, 5))).toBe('5 May 2015');
  });

  it('civilianDate → "January 14, 2014" (month day, year)', () => {
    expect(civilianDate(d(2014, 0, 14))).toBe('January 14, 2014');
  });

  it('covers all twelve months in the abbreviated form', () => {
    const abbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    abbr.forEach((mon, i) => expect(abbreviatedDate(d(2020, i, 15))).toBe(`15 ${mon} 20`));
  });
});
