import { describe, it, expect } from 'vitest';
import { JAGMAN_PART_B, NJP_SOURCES, citationsFor } from './njpCitations';

describe('NJP citations — signposts only', () => {
  it('carries every JAGMAN Part B section, 0106 through 0119, in order', () => {
    expect(JAGMAN_PART_B.map((c) => c.n)).toEqual([
      '0106','0107','0108','0109','0110','0111','0112','0113','0114','0115','0116','0117','0118','0119',
    ]);
  });

  it('keeps the section titles verbatim', () => {
    const s = (n: string) => JAGMAN_PART_B.find((c) => c.n === n);
    expect(s('0111')?.t).toBe('Limitations on and Nature of Punishments');
    expect(s('0106')?.t).toBe('Authority to Impose');
    expect(s('0119')?.t).toBe('Records of Nonjudicial Punishment');
    expect(s('0112')?.t).toContain('Reserve Component Personnel Not on Active Duty');
  });

  it('keeps the subsection letters under the punishment section', () => {
    const subs = JAGMAN_PART_B.find((c) => c.n === '0111')?.subs ?? [];
    expect(subs.map((x) => x.l)).toEqual(['a','b','c','d','e','f','g','h','i']);
    expect(subs.find((x) => x.l === 'b')?.t).toBe('Correctional custody');
    expect(subs.find((x) => x.l === 'e')?.t).toBe('Reduction in grade');
  });

  it('cites Article 15 to the right section of the U.S. Code', () => {
    expect(NJP_SOURCES.ucmj.cite).toBe('10 U.S.C. § 815');
    expect(NJP_SOURCES.mcm.cite).toContain('Part V');
    expect(NJP_SOURCES.jagman.cite).toContain('5800.7G');
  });

  it('groups sections to the form blocks they belong beside', () => {
    expect(citationsFor('punishment').map((c) => c.n)).toContain('0111');
    expect(citationsFor('appeal').map((c) => c.n)).toEqual(expect.arrayContaining(['0116', '0117']));
    expect(citationsFor('authority').map((c) => c.n)).toContain('0106');
  });

  // The whole point: this states no rule and evaluates nothing.
  it('contains no limits, numbers, or determinations — only names and numbers of sections', () => {
    const blob = JSON.stringify(JAGMAN_PART_B).toLowerCase();
    for (const banned of ['maximum of', 'days of', 'may not exceed', 'is limited to', 'shall not exceed',
                          'within limits', 'exceeds', 'permitted', 'recommend', 'should']) {
      expect(blob).not.toContain(banned);
    }
    // no bare day/month quantities smuggled into a title
    expect(blob).not.toMatch(/\b\d+\s*(days?|months?)\b/);
  });
});
