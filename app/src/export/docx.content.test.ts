import { describe, it, expect } from 'vitest';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { buildDocxDocument } from './docx';
import { defaultState } from '../defaultState';
import type { LetterState } from '../types';

// Unzip the generated .docx and return word/document.xml as text, so we can assert the export
// actually carries the right content (not just that it's a valid zip).
async function docxText(over: Partial<LetterState>): Promise<string> {
  const state: LetterState = { ...defaultState, ...over };
  const buf = await Packer.toBuffer(buildDocxDocument(state, new Date(2006, 8, 7)));
  const zip = await JSZip.loadAsync(buf);
  return (await zip.file('word/document.xml')?.async('string')) ?? '';
}

describe('buildDocxDocument — document.xml content', () => {
  it('includes the letterhead, From/To, subject, and body text', async () => {
    const xml = await docxText({
      from: 'Commanding Officer, USS Test',
      to: 'Chief of Naval Operations',
      subj: 'unique subject phrase',
      body: [{ id: 'b1', text: 'unique body sentence here', children: [] }],
    });
    expect(xml).toContain('DEPARTMENT OF THE NAVY');
    expect(xml).toContain('Commanding Officer, USS Test');
    expect(xml).toContain('Chief of Naval Operations');
    expect(xml.toLowerCase()).toContain('unique subject phrase'); // subj (rendered uppercase)
    expect(xml).toContain('unique body sentence here');
  });

  it('a memorandum carries MEMORANDUM and omits the SSIC (§10-2)', async () => {
    const xml = await docxText({ type: 'memo-from-to', ssic: '9999', subj: 'memo subject' });
    expect(xml).toContain('MEMORANDUM');
    expect(xml).not.toContain('9999'); // a memo's only ID symbol is the date
  });
});
