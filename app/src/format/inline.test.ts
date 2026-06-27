import { describe, it, expect } from 'vitest';
import { parseInline, hasInlineMarkup } from './inline';

describe('parseInline', () => {
  it('returns plain text as a single run', () => {
    expect(parseInline('plain text')).toEqual([{ text: 'plain text' }]);
  });

  it('parses **bold**, *italic*, __underline__', () => {
    expect(parseInline('a **b** c')).toEqual([{ text: 'a ' }, { text: 'b', bold: true }, { text: ' c' }]);
    expect(parseInline('a *i* c')).toEqual([{ text: 'a ' }, { text: 'i', italic: true }, { text: ' c' }]);
    expect(parseInline('a __u__ c')).toEqual([{ text: 'a ' }, { text: 'u', underline: true }, { text: ' c' }]);
  });

  it('parses multiple markers in one string', () => {
    expect(parseInline('**b** and *i*')).toEqual([
      { text: 'b', bold: true },
      { text: ' and ' },
      { text: 'i', italic: true },
    ]);
  });

  it('prefers ** over * (no mis-parse of bold as two italics)', () => {
    expect(parseInline('**bold**')).toEqual([{ text: 'bold', bold: true }]);
  });

  it('leaves unmatched markers as literal text', () => {
    expect(parseInline('a * b')).toEqual([{ text: 'a * b' }]);
    expect(parseInline('**unclosed')).toEqual([{ text: '**unclosed' }]);
  });

  it('is stateless across calls (shared global regex reset)', () => {
    parseInline('**x** **y**');
    expect(parseInline('plain')).toEqual([{ text: 'plain' }]);
    expect(hasInlineMarkup('**x**')).toBe(true);
    expect(hasInlineMarkup('plain')).toBe(false);
    expect(hasInlineMarkup('**x**')).toBe(true); // still correct after a false result
  });
});
