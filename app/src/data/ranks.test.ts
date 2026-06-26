import { describe, it, expect } from 'vitest';
import { rankByGrade, NAVY_RANKS } from './ranks';

describe('rankByGrade — US grade → NATO code (STANAG 2116)', () => {
  it('maps the verified reference rank LCDR (O-4) → OF-3', () => {
    expect(rankByGrade('O-4')).toMatchObject({ abbr: 'LCDR', nato: 'OF-3' });
  });

  it('maps officer grades onto the OF ladder (O-1 and O-2 both OF-1)', () => {
    expect(rankByGrade('O-1')?.nato).toBe('OF-1');
    expect(rankByGrade('O-2')?.nato).toBe('OF-1');
    expect(rankByGrade('O-3')?.nato).toBe('OF-2');
    expect(rankByGrade('O-6')?.nato).toBe('OF-5');
    expect(rankByGrade('O-10')?.nato).toBe('OF-9');
  });

  it('maps enlisted grades E-1..E-9 onto OR-1..OR-9', () => {
    for (let i = 1; i <= 9; i++) {
      expect(rankByGrade(`E-${i}`)?.nato).toBe(`OR-${i}`);
    }
  });

  it('returns undefined for an unknown or empty grade', () => {
    expect(rankByGrade('O-99')).toBeUndefined();
    expect(rankByGrade('')).toBeUndefined();
  });

  it('every rank entry is well-formed (grade, abbr, title, NATO code)', () => {
    expect(NAVY_RANKS.length).toBe(24);
    for (const r of NAVY_RANKS) {
      expect(r.grade).toMatch(/^[EWO]-\d+$/);
      expect(r.abbr).toBeTruthy();
      expect(r.title).toBeTruthy();
      expect(r.nato).toMatch(/^(OF|OR|WO)-\d$/);
    }
  });

  it('grades are unique', () => {
    const grades = NAVY_RANKS.map((r) => r.grade);
    expect(new Set(grades).size).toBe(grades.length);
  });
});
