import { describe, it, expect } from 'vitest';
import { alphaIndex } from './alpha';

describe('alphaIndex — shared a/b/…/aa sequence (paragraphs + references)', () => {
  it('maps 0→a … 25→z', () => {
    expect(alphaIndex(0)).toBe('a');
    expect(alphaIndex(25)).toBe('z');
  });

  it('wraps to two letters: 26→aa, 27→ab, 51→az, 52→ba', () => {
    expect(alphaIndex(26)).toBe('aa');
    expect(alphaIndex(27)).toBe('ab');
    expect(alphaIndex(51)).toBe('az');
    expect(alphaIndex(52)).toBe('ba');
  });
});
