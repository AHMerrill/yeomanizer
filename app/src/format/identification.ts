import type { LetterState, ListEntry } from '../types';
import { abbreviatedDate } from './date';
import { alphaIndex } from './alpha';

export interface IdentLines {
  ssic: string;
  codeLine: string;
  date: string;
}

// Build the sender's-symbol block (SECNAV M-5216.5 7-2.3).
//   SSIC            -> "5216"
//   originator/ser  -> "Code 13"  |  "Ser Code 13/271"  |  "Ser N00J/S20"
//   date            -> abbreviated, "7 Sep 06"
export function buildIdent(s: LetterState, today: Date = new Date()): IdentLines {
  const serial = s.serial.trim();
  const code = s.originatorCode.trim();
  // 7-2.3: serialized correspondence is "Ser <code>/<serial>"; otherwise just the code.
  const codeLine = serial ? `Ser ${code}/${serial}` : code;

  let date = '';
  if (s.dateMode === 'auto') date = abbreviatedDate(today);
  else if (s.dateMode === 'manual') date = s.dateManual.trim();

  return { ssic: s.ssic.trim(), codeLine, date };
}

// Reference letters: a, b, … z, aa, ab, … (same sequence as paragraph sub-lists).
export function refLetter(i: number): string {
  return alphaIndex(i);
}

// Ordinals for appended endorsements (Ch 9). Shared by the preview, the editor, and the .docx
// export so they can't drift.
export const ENDORSE_ORD = [
  'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH',
  'SIXTH', 'SEVENTH', 'EIGHTH', 'NINTH', 'TENTH',
];

// "<From> ltr <SSIC> [Ser <code>/<serial>] of <date>" — names the basic letter that an
// appended endorsement sits on ("FIRST ENDORSEMENT on <this>"). Used by preview + .docx.
export function basicLetterId(basic: LetterState, today?: Date): string {
  const date = buildIdent(basic, today).date;
  return `${basic.from} ltr ${basic.ssic}${
    basic.serial ? ` Ser ${basic.originatorCode}/${basic.serial}` : ''
  }${date ? ` of ${date}` : ''}`
    .replace(/\s+/g, ' ')
    .trim();
}

// Ch 9-2.2: an endorsement's "Via:" line carries the Via addressees that remain AFTER this
// endorser in the routing chain (the "To:" stays the action addressee). For a Via-linked
// endorsement, "remaining" = the non-empty Via addressees after this one.
export function remainingVias(basic: LetterState, viaId?: string): ListEntry[] {
  const vias = basic.via.filter((v) => v.text.trim());
  const pos = viaId ? vias.findIndex((v) => v.id === viaId) : -1;
  return pos >= 0 ? vias.slice(pos + 1) : [];
}
