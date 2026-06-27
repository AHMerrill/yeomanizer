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

  it('embeds the seal as a media image when seal bytes are provided', async () => {
    // a 1x1 PNG stands in for the seal
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const bytes = new Uint8Array(Buffer.from(png, 'base64'));
    const buf = await Packer.toBuffer(
      buildDocxDocument({ ...defaultState, from: 'CO, USS Test' }, new Date(2006, 8, 7), bytes),
    );
    const zip = await JSZip.loadAsync(buf);
    expect(Object.keys(zip.files).some((f) => f.startsWith('word/media/'))).toBe(true);
  });

  it('right-aligns the SSIC/date ident block (top-right, like the preview)', async () => {
    const xml = await docxText({ from: 'CO', ssic: '5216', includeSsic: true });
    expect(xml).toContain('w:val="right"'); // ident lines are right-aligned, not left-indented
  });

  it('a memorandum carries MEMORANDUM and omits the SSIC (§10-2)', async () => {
    const xml = await docxText({ type: 'memo-from-to', ssic: '9999', subj: 'memo subject' });
    expect(xml).toContain('MEMORANDUM');
    expect(xml).not.toContain('9999'); // a memo's only ID symbol is the date
  });

  it('appends endorsements to the Word export, matching the PDF', async () => {
    const xml = await docxText({
      from: 'Commanding Officer, USS Test',
      endorsements: [
        {
          id: 'e1',
          endorser: 'Commander, CSG ONE',
          serial: '',
          body: [{ id: 'eb1', text: 'forwarded recommending approval', children: [] }],
          sigName: 'A. B. SEADOG',
          sigTitle: '',
        },
      ],
    });
    expect(xml).toContain('FIRST ENDORSEMENT on'); // the endorsement is appended
    expect(xml).toContain('Commander, CSG ONE'); // From = the endorser
    expect(xml).toContain('forwarded recommending approval'); // endorsement body
    expect(xml).toContain('A. B. SEADOG'); // endorsement signature
  });

  it('renders an endorsement signed "By direction"', async () => {
    const xml = await docxText({
      from: 'CO, USS Test',
      endorsements: [
        {
          id: 'e1',
          endorser: 'Commander, CSG ONE',
          serial: '',
          body: [],
          sigName: 'A. B. SEADOG',
          sigTitle: '',
          authority: 'by-direction',
        },
      ],
    });
    expect(xml).toContain('A. B. SEADOG');
    expect(xml).toContain('By direction');
  });

  it('appends in-document enclosures — image embedded, PDF referenced, each marked', async () => {
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';
    const state: LetterState = {
      ...defaultState,
      from: 'CO, USS Test',
      encls: [
        { id: 'i1', text: 'A photo', inDocument: true, file: { name: 'p.png', type: 'image/png', dataUrl: `data:image/png;base64,${png}` } },
        { id: 'i2', text: 'A document', inDocument: true, file: { name: 'd.pdf', type: 'application/pdf', dataUrl: 'data:application/pdf;base64,JVBERi0=' } },
      ],
    };
    const buf = await Packer.toBuffer(buildDocxDocument(state, new Date(2006, 8, 7)));
    const zip = await JSZip.loadAsync(buf);
    const xml = (await zip.file('word/document.xml')?.async('string')) ?? '';
    expect(Object.keys(zip.files).some((f) => f.startsWith('word/media/'))).toBe(true); // image embedded
    expect(xml).toContain('Enclosure (1)');
    expect(xml).toContain('Enclosure (2)');
    expect(xml).toContain('PDF attached separately'); // PDF referenced (docx can't hold vector pages)
  });
});
