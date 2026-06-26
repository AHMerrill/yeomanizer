import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The app's core promise is exact measurement, so the spec-critical page geometry is a
// contract. jsdom does no layout (computed px are 0), so we assert against the CSS source.
// Verified live in a real browser: 8.5x11in page, 1in margins, signature at the page center.
const css = readFileSync(fileURLToPath(new URL('./preview.css', import.meta.url)), 'utf8');
const block = (sel: string): string => {
  const i = css.indexOf(`${sel} {`);
  return i < 0 ? '' : css.slice(i, css.indexOf('}', i));
};

describe('preview.css layout contract (SECNAV M-5216.5)', () => {
  it('the page is 8.5in x 11in, set in 12pt Times New Roman', () => {
    const page = block('.page');
    expect(page).toMatch(/width:\s*8\.5in/);
    expect(page).toMatch(/height:\s*11in/);
    expect(page).toMatch(/font-family:\s*'Times New Roman'/);
    expect(page).toMatch(/font-size:\s*12pt/);
  });

  it('1-inch side and bottom margins, 0.5in top for the letterhead', () => {
    expect(block('.page')).toMatch(/padding:\s*0\.5in\s+1in\s+1in\s+1in/);
  });

  it('the signature block begins at the page center (3.25in past the 1in margin, §7-2.14)', () => {
    expect(block('.signature')).toMatch(/margin-left:\s*3\.25in/);
  });
});
