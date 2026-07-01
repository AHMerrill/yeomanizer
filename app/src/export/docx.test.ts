import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { Packer } from 'docx';
import { buildDocxDocument, silenceDocx } from './docx';
import { defaultState } from '../defaultState';
import type { LetterState } from '../types';

const base = (over: Partial<LetterState> = {}): LetterState => ({ ...defaultState, ...over });
const pack = (s: LetterState) => Packer.toBuffer(buildDocxDocument(s, new Date(2006, 8, 7)));

describe('buildDocxDocument — Word export assembles without crashing', () => {
  it('builds a non-empty document for a standard letter', async () => {
    const buf = await pack(base());
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('produces a valid OOXML zip (PK signature)', async () => {
    const buf = await pack(base());
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'
  });

  it('builds a memorandum', async () => {
    const buf = await pack(base({ type: 'memo-from-to' }));
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('builds with CUI markings enabled (title page + headers/footers)', async () => {
    const buf = await pack(base({ cui: { ...defaultState.cui, enabled: true } }));
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('builds with references, enclosures, multiple vias, and copy-to populated', async () => {
    const buf = await pack(
      base({
        via: [
          { id: 'v1', text: 'Commander, Carrier Strike Group ONE' },
          { id: 'v2', text: 'Commander, U.S. Pacific Fleet' },
        ],
        copyTo: ['COMNAVSURFPAC (N1)'],
      }),
    );
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('builds with a signature title and "by direction" authority', async () => {
    const buf = await pack(
      base({ signature: { name: 'I. M. LASTNAME', title: 'Deputy', authority: 'by-direction' } }),
    );
    expect(buf.length).toBeGreaterThan(1000);
  });
});

describe('silenceDocx — the exported .docx carries no generation timestamp', () => {
  it('zeroes core.xml dates and pins every zip entry to the DOS epoch', async () => {
    const silenced = await silenceDocx(new Blob([new Uint8Array(await pack(base()))]));
    const zip = await JSZip.loadAsync(await silenced.arrayBuffer());
    // core.xml: created/modified must read the 1970 epoch, and no real (21st-century) time survives.
    const core = await zip.file('docProps/core.xml')!.async('string');
    expect(core).toContain('1970-01-01T00:00:00Z');
    expect(core).not.toMatch(/20\d\d-\d\d-\d\dT/);
    // Zip local-header mod-times: every entry pinned to 1980, so none leaks the build time.
    const years = Object.values(zip.files).map((f) => f.date.getUTCFullYear());
    expect(years.length).toBeGreaterThan(3);
    expect(years.every((y) => y === 1980)).toBe(true);
  });
});
