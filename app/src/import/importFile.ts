// Read a dropped "editable copy" (.yeomanizer.json) back into editing state. The data is a plain
// JSON file you saved alongside the document — read entirely in the browser, never uploaded. The
// docx/PDF are the final documents and carry no embedded data, so the .json is the editable source.
import { parseProject } from '../export/roundtrip';
import type { LetterState } from '../types';

export interface ImportResult {
  state: LetterState | null;
  error?: string;
}

export async function importLetterFile(file: File): Promise<ImportResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.json') || file.type === 'application/json') {
    const state = parseProject(await file.text());
    return state
      ? { state }
      : { state: null, error: 'That .json isn’t a yeomanizer editable copy — pick the file you saved with “Save editable copy.”' };
  }
  if (name.endsWith('.docx') || name.endsWith('.pdf')) {
    return {
      state: null,
      error: 'That’s the final document. To keep editing, drop the editable copy (.yeomanizer.json) you saved alongside it.',
    };
  }
  return { state: null, error: 'Drop the editable copy (.yeomanizer.json) you saved from the yeomanizer.' };
}
