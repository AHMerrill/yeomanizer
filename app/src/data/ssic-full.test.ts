import { describe, it, expect } from 'vitest';
import full from './ssic-full.json';

// Integrity guard for the bundled full SSIC catalog (adapted from SECNAV M-5210.2 via jeranaias, MIT).
// Codes are not invented — this just protects against a corrupt/truncated data file.
describe('full SSIC catalog (ssic-full.json)', () => {
  it('carries the full authoritative catalog with valid entries', () => {
    expect(full.codes.length).toBeGreaterThan(2000);
    expect(
      full.codes.every((c) => typeof c.code === 'string' && c.code.length > 0 && c.label.trim().length > 0),
    ).toBe(true);
    // no duplicate codes
    expect(new Set(full.codes.map((c) => c.code)).size).toBe(full.codes.length);
  });

  it('matches known codes against the manual', () => {
    const find = (code: string) => full.codes.find((c) => c.code === code);
    expect(find('5216')?.label).toMatch(/correspondence/i);
    expect(find('1650')?.label).toMatch(/award|decoration|medal/i);
    expect(find('5211')?.label).toMatch(/privacy/i);
    expect(find('1320')?.label).toMatch(/orders/i);
    expect(find('1730')?.label).toMatch(/chaplain/i);
  });
});
