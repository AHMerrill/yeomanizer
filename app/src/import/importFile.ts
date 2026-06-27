// Read a dropped file back into editable state. The editable data was bundled inside the file when
// it was exported here (gzipped JSON) — see export/roundtrip.ts. Everything happens in the browser;
// the file is never uploaded. Only files exported by the yeomanizer carry this data.
import { extractStateFromDocx } from '../export/roundtrip';
import type { LetterState } from '../types';

export interface ImportResult {
  state: LetterState | null;
  error?: string;
}

export async function importLetterFile(file: File): Promise<ImportResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx') || file.type.includes('word')) {
    const state = await extractStateFromDocx(bytes);
    return state
      ? { state }
      : { state: null, error: 'This .docx has no editable data — only documents you exported from the yeomanizer can be reopened.' };
  }
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    return { state: null, error: 'Reopening a PDF is coming next — for now, reopen the .docx version.' };
  }
  return { state: null, error: 'Drop a .docx you exported from the yeomanizer.' };
}
