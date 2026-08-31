import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { PDFDocument, PDFName, PDFDict, PDFArray } from 'pdf-lib';
import { buildSignablePdf } from './signablePdf';
import { defaultState, defaultFor } from '../defaultState';

describe('signable PDF export', () => {
  it('generates a valid PDF carrying an AcroForm digital-signature field (/FT /Sig)', async () => {
    const bytes = await buildSignablePdf({
      ...defaultState,
      from: 'Commanding Officer, USS Test',
      to: 'Chief of Naval Operations',
      subj: 'TEST LETTER',
      signature: { ...defaultState.signature, name: 'I. M. LASTNAME' },
    });

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);

    // The catalog must carry an AcroForm with a single field...
    const acro = doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
    expect(acro).toBeDefined();
    const fields = acro!.lookup(PDFName.of('Fields'), PDFArray);
    expect(fields.size()).toBe(1);

    // ...and that field is a signature field (FT = Sig), the Adobe "click to sign" widget.
    const field = fields.lookup(0, PDFDict);
    expect(field.get(PDFName.of('FT'))?.toString()).toBe('/Sig');
    expect(field.get(PDFName.of('Subtype'))?.toString()).toBe('/Widget');
  });
});

// The headless harness can't fetch() the Vite-bundled seal asset, so loadSealBytes() silently returns
// nothing in node — meaning the seal never embedded in any automated check. We read the real PNG from
// disk and hand it to buildSignablePdf (the same embed path the browser uses), so a regression that
// drops the seal now fails CI instead of slipping through.
describe('signable PDF — letterhead seal embedding', () => {
  const SEAL = readFileSync(new URL('../assets/dow-seal.png', import.meta.url));
  const today = new Date(2006, 8, 7);

  it('embeds the seal when the letterhead is on and a seal is selected', async () => {
    const withSeal = await buildSignablePdf(defaultState, today, SEAL);
    const noSeal = await buildSignablePdf(
      { ...defaultState, letterhead: { ...defaultState.letterhead, seal: 'none' } },
      today,
    );
    // The detailed 1000x1000 seal adds well over 50 KB to the PDF once embedded.
    expect(withSeal.length).toBeGreaterThan(noSeal.length + 50_000);
  });

  it('does not embed the seal when the letterhead is off, even if bytes are supplied', async () => {
    const off = await buildSignablePdf(
      { ...defaultState, letterhead: { ...defaultState.letterhead, mode: 'off' } },
      today,
      SEAL,
    );
    const offNoSeal = await buildSignablePdf(
      { ...defaultState, letterhead: { ...defaultState.letterhead, mode: 'off', seal: 'none' } },
      today,
    );
    expect(off.length).toBeLessThan(offNoSeal.length + 1000);
  });
});

// A locked (encrypted) PDF enclosure used to export as BLANK pages: pdf-lib has no decryption
// code, so `copyPages` "succeeded" and copied ciphertext content streams. Those enclosures are now
// pre-rendered with pdf.js and embedded as page images instead. See export/lockedPdf.ts.
// pdf-lib Flate-compresses content streams, so drawn text isn't greppable in the raw bytes.
// Inflate every stream and search that — enough to assert "this text was drawn somewhere".
function pdfText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString('latin1');
  let all = '';
  const re = /(?<!end)stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) continue;
    let e = end;
    while (e > start && (raw[e - 1] === '\n' || raw[e - 1] === '\r')) e--;
    try {
      all += inflateSync(Buffer.from(raw.slice(start, e), 'latin1')).toString('latin1');
    } catch { /* not a flate stream (image data, etc.) */ }
  }
  // pdf-lib writes drawn text as hex strings — `<4445...> Tj` — so decode those before searching.
  const decoded = all.replace(/<([0-9A-Fa-f]{2,})>/g, (_, h: string) =>
    (h.match(/../g) ?? []).map((b) => String.fromCharCode(parseInt(b, 16))).join(''),
  );
  return raw + all + decoded;
}

async function makeEncryptedPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([300, 400]);
  const base = await doc.save({ useObjectStreams: false });
  let s = Buffer.from(base).toString('latin1');
  const nextObj = (s.match(/\d+ 0 obj/g) || []).length + 1;
  const prevXref = Number(s.slice(s.lastIndexOf('startxref') + 9).trim().split(/\s/)[0]);
  const encOffset = s.length;
  const encObj =
    `${nextObj} 0 obj\n<< /Filter /Standard /V 4 /R 4 /Length 128 /P -1084 ` +
    `/O <${'00'.repeat(32)}> /U <${'00'.repeat(32)}> >>\nendobj\n`;
  s +=
    encObj +
    `xref\n0 1\n0000000000 65535 f \n${nextObj} 1\n${String(encOffset).padStart(10, '0')} 00000 n \n` +
    `trailer\n<< /Size ${nextObj + 1} /Prev ${prevXref} /Root 1 0 R /Encrypt ${nextObj} 0 R >>\n` +
    `startxref\n${encOffset + encObj.length}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(s, 'latin1'));
}

describe('locked PDF enclosures', () => {
  const PNG_1PX = Uint8Array.from(
    atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
    (c) => c.charCodeAt(0),
  );
  const withEncl = () => ({
    ...defaultFor('standard-letter'),
    subj: 'LOCKED ENCLOSURE',
    encls: [
      {
        id: 'e1',
        text: 'Official form',
        inDocument: true,
        cuiBanner: '',
        file: { name: 'form.pdf', type: 'application/pdf', dataUrl: 'data:application/pdf;base64,' },
      },
    ],
  });

  it('embeds pre-rendered pages at the true page size and marks them as an enclosure', async () => {
    const bytes = await buildSignablePdf(withEncl(), new Date(2026, 0, 1), undefined, {
      e1: [{ bytes: PNG_1PX, width: 612 * 3, height: 792 * 3 }],
    });
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const last = doc.getPage(doc.getPageCount() - 1);
    expect(Math.round(last.getSize().width)).toBe(612);
    expect(Math.round(last.getSize().height)).toBe(792);
    expect(doc.getPageCount()).toBeGreaterThan(1); // letter + the enclosure page
  });

  // The important failure mode: if the pre-render never happened or timed out, the export must
  // OMIT the enclosure, never fall through to copying pages that decode to blank.
  it('omits a locked enclosure entirely rather than emitting blank pages', async () => {
    const s = withEncl();
    s.encls[0].file.dataUrl = `data:application/pdf;base64,${Buffer.from(await makeEncryptedPdf()).toString('base64')}`;
    const withoutRaster = await buildSignablePdf(s, new Date(2026, 0, 1)); // no locked pages supplied
    const plain = await buildSignablePdf({ ...s, encls: [] }, new Date(2026, 0, 1));
    const a = await PDFDocument.load(withoutRaster, { updateMetadata: false });
    const b = await PDFDocument.load(plain, { updateMetadata: false });
    expect(a.getPageCount()).toBe(b.getPageCount()); // no extra (blank) enclosure pages
  });

  it('carries the per-enclosure CUI banner onto a rendered locked page', async () => {
    const s = withEncl();
    s.cui = { ...s.cui, enabled: true, banner: 'CUI' };
    s.encls[0].cuiBanner = 'CUI//SP-PRVCY';
    const bytes = await buildSignablePdf(s, new Date(2026, 0, 1), undefined, {
      e1: [{ bytes: PNG_1PX, width: 612 * 3, height: 792 * 3 }],
    });
    expect(pdfText(bytes)).toContain('CUI//SP-PRVCY');
  });
});
