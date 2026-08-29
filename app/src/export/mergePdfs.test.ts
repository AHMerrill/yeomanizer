import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { mergePdfs } from './mergePdfs';

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([300, 400]);
  return doc.save();
}

// A real, parseable PDF whose trailer carries /Encrypt — the shape of every official NAVPERS form
// (standard security handler, /V 4 /R 4, AES-128). Built by appending an incremental update to a
// pdf-lib document so the fixture stays plain text: *.pdf is gitignored in this repo, so a binary
// fixture can't be committed. Only the /Encrypt entry matters here — pdf-lib detects it before it
// would ever try to read the (in a real file, undecryptable) page content.
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

describe('mergePdfs — combine PDFs client-side', () => {
  it('merges in order, summing the page counts', async () => {
    const r = await mergePdfs([await makePdf(2), await makePdf(1)]);
    expect(r.pageCount).toBe(3);
    expect(r.skipped).toEqual([]);
    expect(r.encrypted).toEqual([]);
  });

  it('returns a valid PDF (%PDF- header)', async () => {
    const r = await mergePdfs([await makePdf(1)]);
    expect(new TextDecoder().decode(r.bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('skips unparseable inputs, reports their indices, keeps the rest', async () => {
    const good = await makePdf(1);
    const bad = new TextEncoder().encode('this is not a pdf');
    const r = await mergePdfs([good, bad, good]);
    expect(r.skipped).toEqual([1]);
    expect(r.encrypted).toEqual([]); // unparseable ≠ encrypted
    expect(r.pageCount).toBe(2);
  });

  it('all-invalid / empty input yields an empty result without throwing', async () => {
    const empty = await mergePdfs([]);
    expect(empty.pageCount).toBe(0);
    expect(empty.bytes.length).toBe(0);

    const allBad = await mergePdfs([new TextEncoder().encode('nope')]);
    expect(allBad.pageCount).toBe(0);
    expect(allBad.skipped).toEqual([0]);
  });

  // pdf-lib cannot decrypt (it has no RC4/AES code); `ignoreEncryption` only suppresses the throw.
  // Copying pages out of an encrypted source produced a packet that opened fine with SILENTLY BLANK
  // pages and skipped === [] — the user was told "Combined N page(s)" and got garbage.
  describe('encrypted / secured sources', () => {
    it('the fixture really is detected as encrypted by pdf-lib', async () => {
      const doc = await PDFDocument.load(await makeEncryptedPdf(), { ignoreEncryption: true });
      expect(doc.isEncrypted).toBe(true);
    });

    it('refuses an encrypted source instead of merging blank pages', async () => {
      const r = await mergePdfs([await makePdf(2), await makeEncryptedPdf()]);
      expect(r.pageCount).toBe(2); // only the readable input contributed
      expect(r.skipped).toEqual([1]);
      expect(r.encrypted).toEqual([1]);
    });

    it('reports an encrypted-only merge as empty rather than producing a blank packet', async () => {
      const r = await mergePdfs([await makeEncryptedPdf()]);
      expect(r.pageCount).toBe(0);
      expect(r.bytes.length).toBe(0);
      expect(r.skipped).toEqual([0]);
      expect(r.encrypted).toEqual([0]);
    });
  });
});
