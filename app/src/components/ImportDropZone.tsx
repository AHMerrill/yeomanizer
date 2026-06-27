// The "Editor" tab landing: drop (or pick) a saved .docx to reopen it for editing. Reads in-browser
// only — nothing is uploaded. On success it hands the parsed state up; the cards then take over.
import { useState } from 'react';
import { importLetterFile } from '../import/importFile';
import type { LetterState } from '../types';

export function ImportDropZone({ onImport }: { onImport: (s: LetterState) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const handle = async (file: File) => {
    setBusy(true);
    setError(null);
    const result = await importLetterFile(file);
    setBusy(false);
    if (result.state) onImport(result.state);
    else setError(result.error ?? 'Could not read that file.');
  };

  return (
    <div className="import-wrap">
      <div
        className={`import-zone${over ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) void handle(f);
        }}
      >
        <h2>Continue editing a saved letter</h2>
        <p>
          Drop the editable copy (<strong>.yeomanizer.json</strong>) you saved and it reopens with
          every field filled in — pick up exactly where you left off.
        </p>
        <label className="import-pick">
          Choose a file…
          <input
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handle(f);
            }}
          />
        </label>
        {busy && <p className="import-busy">Reading…</p>}
        {error && <p className="import-error">{error}</p>}
      </div>
      <p className="import-note">
        Nothing is uploaded — the file is read inside your browser. The .docx/PDF you export stay
        clean (nothing hidden inside them); the editable data lives only in this separate .json you
        chose to save.
      </p>
    </div>
  );
}
