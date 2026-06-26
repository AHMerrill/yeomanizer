import { describe, it, expect } from 'vitest';
import { Packer } from 'docx';
import { buildDocxDocument } from './docx';
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
