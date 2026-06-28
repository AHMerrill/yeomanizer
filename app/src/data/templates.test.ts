import { describe, it, expect } from 'vitest';
import { TEMPLATES } from './templates';

describe('starter templates', () => {
  it('each builds a valid letter state with a type, a name, and body content', () => {
    expect(TEMPLATES.length).toBeGreaterThan(0);
    for (const t of TEMPLATES) {
      const s = t.build();
      expect(t.name).toBeTruthy();
      expect(t.blurb).toBeTruthy();
      expect(s.type).toBeTruthy();
      expect(Array.isArray(s.body)).toBe(true);
      expect(s.body.some((p) => p.text.trim().length > 0)).toBe(true);
    }
  });

  it('template ids are unique', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
