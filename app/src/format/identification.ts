import type { LetterState } from '../types';
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
