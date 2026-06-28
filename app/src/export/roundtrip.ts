// "Editable copy" project file: a plain-text JSON snapshot of the editing state, saved as a
// SEPARATE file (never embedded in the docx/PDF). Drop it back into the Editor tab to resume.
//
// Why separate + plaintext: the exported document stays exactly what it renders (no hidden or
// compressed data inside a file you might send — which matters on gov/CUI systems for document
// sanitization and DLP scanning). The project file is an obvious, fully-readable data file you
// keep locally; open it in any text editor and see exactly what's there. Nothing is uploaded.
import { defaultState } from '../defaultState';
import type { LetterState, Paragraph } from '../types';

const VERSION = 1;
interface Project {
  v: number;
  state: LetterState;
}

// When enclosure files aren't included, keep their titles + flags but drop the (large) bytes.
function prepare(state: LetterState, includeEnclosureFiles: boolean): LetterState {
  if (includeEnclosureFiles) return state;
  return { ...state, encls: state.encls.map((e) => ({ ...e, file: undefined })) };
}

export function serializeProject(state: LetterState, includeEnclosureFiles = true): string {
  return JSON.stringify({ v: VERSION, state: prepare(state, includeEnclosureFiles) }, null, 2);
}

// Only let image/PDF data URLs back in — a project file is plain data, but this stops a hand-edited
// or hostile file from slipping a non-media URL (e.g. data:text/html) into an <img>/embed.
function sanitizeEnclosures(state: LetterState): LetterState {
  return {
    ...state,
    encls: (state.encls ?? []).map((e) =>
      e.file && !/^data:(image\/|application\/pdf)/i.test(e.file.dataUrl) ? { ...e, file: undefined } : e,
    ),
  };
}

// Keys that could pollute Object.prototype if they survived into a later spread/merge.
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Bound + type-coerce the body tree from a hostile or corrupt file: cap total nodes (a render hang
// from millions of paragraphs) and depth (a stack overflow in the recursive format/render passes),
// and force every field to its expected type so a renderer never meets a wrong-typed value. Over the
// node cap → throw, which parseProject's catch turns into a clean null (reject the file).
const MAX_BODY_NODES = 2000; // a real letter has tens of paragraphs — far below this
const MAX_BODY_DEPTH = 12; // the manual's paragraph scheme tops out at 8 levels

function sanitizeBody(nodes: unknown, depth: number, counter: { n: number }): Paragraph[] {
  if (!Array.isArray(nodes) || depth > MAX_BODY_DEPTH) return [];
  const out: Paragraph[] = [];
  for (const raw of nodes) {
    if (!raw || typeof raw !== 'object') continue;
    if (++counter.n > MAX_BODY_NODES) throw new Error('project body exceeds node cap');
    const p = raw as Record<string, unknown>;
    out.push({
      id: typeof p.id === 'string' && p.id ? p.id.slice(0, 100) : `b${counter.n}`,
      text: typeof p.text === 'string' ? p.text.slice(0, 50_000) : '',
      title: typeof p.title === 'string' ? p.title.slice(0, 2_000) : undefined,
      cui: p.cui === true ? true : undefined,
      children: sanitizeBody(p.children, depth + 1, counter),
    });
  }
  return out;
}

export function parseProject(text: string): LetterState | null {
  if (text.length > 60_000_000) return null; // ~60MB ceiling — a real project file is far smaller
  try {
    // The reviver drops prototype-pollution keys before the parsed object reaches any spread/merge.
    const obj = JSON.parse(text, (key, value) => (DANGEROUS_KEYS.has(key) ? undefined : value)) as Project;
    const s = obj?.state;
    if (!s || typeof s !== 'object' || typeof s.type !== 'string' || !Array.isArray(s.body)) return null;
    // Replace the body with a bounded, well-typed copy before it can reach any renderer.
    const body = sanitizeBody(s.body, 0, { n: 0 });
    // Merge over defaults so a file from an older/partial schema still fills every field.
    // (Future versions migrate off obj.v here.) Deep-fill the business sub-object too, so a partial
    // or pre-business-letter file still carries every field a renderer reads.
    const business =
      s.business && typeof s.business === 'object'
        ? { ...defaultState.business, ...(s.business as object) }
        : defaultState.business;
    return sanitizeEnclosures({ ...defaultState, ...s, body, business });
  } catch {
    return null;
  }
}

export function exportProjectFile(state: LetterState, includeEnclosureFiles = true): void {
  const blob = new Blob([serializeProject(state, includeEnclosureFiles)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(state.subj || 'naval-letter')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)}.yeomanizer.json`;
  a.click();
  URL.revokeObjectURL(url);
}
