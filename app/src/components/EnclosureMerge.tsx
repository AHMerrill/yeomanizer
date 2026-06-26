import { useState } from 'react';

// "Combine into one PDF" tool for the Enclosures card. The user saves the letter as a PDF
// (Print / Save PDF), then adds it + enclosure files here, in order, to download one packet.
// Entirely client-side — files are read into memory, merged with pdf-lib, and never uploaded.
// pdf-lib is dynamic-imported on first use so it stays out of the initial bundle.
export function EnclosureMerge() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const add = (list: FileList | null) => list && setFiles((f) => [...f, ...Array.from(list)]);
  const removeAt = (i: number) => setFiles((f) => f.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) =>
    setFiles((f) => {
      const j = i + dir;
      if (j < 0 || j >= f.length) return f;
      const c = [...f];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  const build = async () => {
    if (!files.length || busy) return;
    setBusy(true);
    setStatus('Combining…');
    try {
      const { mergePdfs } = await import('../export/mergePdfs');
      const parts = await Promise.all(
        files.map(async (f) => new Uint8Array(await f.arrayBuffer())),
      );
      const { bytes, pageCount, skipped } = await mergePdfs(parts);
      if (!pageCount) {
        setStatus('None of those were readable PDFs — nothing to download.');
        return;
      }
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'packet.pdf';
      a.click();
      URL.revokeObjectURL(url);
      const skip = skipped.length ? ` (skipped ${skipped.length} non-PDF file(s))` : '';
      setStatus(`Combined ${pageCount} page(s) into packet.pdf${skip}.`);
    } catch {
      setStatus('Could not combine those files.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="encl-merge">
      <div className="sub-label">Combine into one PDF</div>
      <p className="hint">
        Save the letter as a PDF first (Print / Save PDF), then add it and your enclosure files
        below, in order, to download a single packet. Files stay in this browser — nothing is
        uploaded.
      </p>
      <label className="file-btn">
        + Add PDF files
        <input
          type="file"
          accept="application/pdf"
          multiple
          aria-label="Add PDF files to combine"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = '';
          }}
        />
      </label>
      {files.length > 0 && (
        <div className="entry-list">
          {files.map((f, i) => (
            <div className="entry-row" key={`${f.name}-${i}`}>
              <span className="entry-idx">{i + 1}</span>
              <span className="file-name">{f.name}</span>
              <button title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                ↑
              </button>
              <button title="Move down" disabled={i === files.length - 1} onClick={() => move(i, 1)}>
                ↓
              </button>
              <button title="Remove" onClick={() => removeAt(i)}>
                ✕
              </button>
            </div>
          ))}
          <button className="add-btn" disabled={busy} onClick={() => void build()}>
            {busy ? 'Combining…' : '⤓ Build combined PDF'}
          </button>
        </div>
      )}
      {status && <p className="hint">{status}</p>}
    </div>
  );
}
