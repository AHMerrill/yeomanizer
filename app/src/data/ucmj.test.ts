import { describe, it, expect } from 'vitest';
import { UCMJ_ARTICLES, searchArticles } from './ucmj';

describe('UCMJ punitive articles', () => {
  it('covers Articles 77 through 134, lettered ones included', () => {
    expect(UCMJ_ARTICLES.length).toBe(94);
    const nums = new Set(UCMJ_ARTICLES.map((a) => a.a));
    for (let n = 77; n <= 134; n++) expect(nums.has(String(n))).toBe(true);
    for (const l of ['87a', '112a', '120b', '128a', '131g']) expect(nums.has(l)).toBe(true);
  });

  it('keeps the statute section alongside each article', () => {
    const a86 = UCMJ_ARTICLES.find((a) => a.a === '86');
    expect(a86?.s).toBe('886');
    expect(a86?.t).toBe('Absence without leave');
    expect(UCMJ_ARTICLES.find((a) => a.a === '112a')?.s).toBe('912a');
  });

  it('finds an article by number, prefix, or keyword', () => {
    expect(searchArticles('86')[0].a).toBe('86');
    expect(searchArticles('absence').some((a) => a.a === '86')).toBe(true);
    expect(searchArticles('awol')[0].a).toBe('86'); // synonym
    expect(searchArticles('larceny').some((a) => a.a === '121')).toBe(true);
    expect(searchArticles('')).toEqual([]);
  });

  it('matches a synonym as it is typed, not only when complete', () => {
    // "awo" has no hit in any statute heading; without prefix matching the list blinks empty
    // mid-word and reads as "no such article".
    for (const partial of ['aw', 'awo', 'awol']) {
      expect(searchArticles(partial).some((a) => a.a === '86'), partial).toBe(true);
    }
    expect(searchArticles('du').some((a) => a.a === '113')).toBe(true); // dui
  });

  it('ranks an exact number above a keyword hit and caps the list', () => {
    expect(searchArticles('92')[0].a).toBe('92');
    expect(searchArticles('a', 5).length).toBeLessThanOrEqual(5);
  });

  it('carries no elements, punishments, or advice — it is a lookup only', () => {
    const blob = JSON.stringify(UCMJ_ARTICLES).toLowerCase();
    for (const banned of ['maximum punishment', 'confinement for', 'elements:', 'should charge', 'recommend']) {
      expect(blob).not.toContain(banned);
    }
  });
});
