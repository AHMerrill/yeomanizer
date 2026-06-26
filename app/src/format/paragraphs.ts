// Paragraph numbering ladder — SECNAV M-5216.5 fig 7-8 (8 levels max).
// Depth 0-based. Markers reset per parent; levels 5-8 underline the digit/letter.

import { alphaIndex } from './alpha';

export const MAX_DEPTH = 8;

// First-line indents per depth, in inches, calibrated to Times New Roman 12 pt.
// Rule (7-2.13): each subdivision's marker aligns under the first letter of the
// paragraph above; continuation lines return to the LEFT MARGIN (so only the
// first line is indented — implemented with CSS text-indent on a full-width block).
export const PARA_INDENTS_IN = [0, 0.25, 0.5, 0.78, 1.06, 1.31, 1.56, 1.84];

export function depthIndentIn(depth: number): number {
  return PARA_INDENTS_IN[Math.min(depth, PARA_INDENTS_IN.length - 1)];
}

export interface Marker {
  prefix: string; // "" or "("
  core: string; // "1" or "a"
  suffix: string; // "." or ")"
  underline: boolean;
}

// depth: 0-based; index: 0-based position among siblings.
export function paragraphMarker(depth: number, index: number): Marker {
  const fmt = depth % 4;
  const underline = depth >= 4;
  const num = String(index + 1);
  const alpha = alphaIndex(index);
  switch (fmt) {
    case 0:
      return { prefix: '', core: num, suffix: '.', underline };
    case 1:
      return { prefix: '', core: alpha, suffix: '.', underline };
    case 2:
      return { prefix: '(', core: num, suffix: ')', underline };
    default:
      return { prefix: '(', core: alpha, suffix: ')', underline };
  }
}

export function markerText(m: Marker): string {
  return `${m.prefix}${m.core}${m.suffix}`;
}
