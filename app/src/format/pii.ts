import type { LetterState, Paragraph } from '../types';

// Heuristic, LOCAL-ONLY scan for common PII/PHI patterns, surfaced as an advisory reminder in the
// Proofread tab. It runs entirely in the browser on the in-memory draft — nothing is logged, stored,
// or transmitted, and it never blocks anything. It is a prompt to think, not an authority: it cannot
// tell whether content is actually CUI, and the writer remains responsible for marking and handling.

export interface PiiHit {
  kind: string;
  where: string; // which part of the letter
  count: number;
}

// Each pattern is deliberately conservative + labelled "possible" where ambiguous, to limit noise.
const PATTERNS: { kind: string; re: RegExp }[] = [
  { kind: 'Social Security Number', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { kind: 'possible SSN (9 digits, no dashes)', re: /\b\d{9}\b/g },
  { kind: 'possible DoD ID / EDIPI (10 digits) — or a phone number', re: /\b\d{10}\b/g },
  { kind: 'date of birth', re: /\b(?:DOB|date of birth)\b/gi },
];

const text = (p: Paragraph[]): string => p.map((x) => `${x.title ?? ''} ${x.text} ${text(x.children)}`).join(' ');

// Gather the user-entered text by area, so a hit can be located ("in the body", "in the signature"…).
function areas(s: LetterState): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  const push = (where: string, t: string) => t && t.trim() && out.push({ where, text: t });
  push('subject', s.subj);
  push('the From line', s.from);
  push('the To line', s.to);
  push('an additional addressee', s.toAddrs.map((a) => a.text).join(' '));
  push('a Via line', s.via.map((v) => v.text).join(' '));
  push('the body', text(s.body));
  push('the references', s.refs.map((r) => r.text).join(' '));
  push('an enclosure title', s.encls.map((e) => e.text).join(' '));
  push('the distribution list', s.distribution.map((d) => d.text).join(' '));
  push('the copy-to list', s.copyTo.join(' '));
  push('the signature block', `${s.signature.name} ${s.signature.title}`);
  push('the inside address', s.business.insideAddress);
  push('the CUI point of contact', s.cui.poc);
  push('the NATO traveler block', `${s.nato.name} ${s.nato.dodId}`);
  return out;
}

export function detectPii(s: LetterState): PiiHit[] {
  const tally = new Map<string, PiiHit>();
  for (const area of areas(s)) {
    for (const { kind, re } of PATTERNS) {
      const matches = area.text.match(re);
      if (matches && matches.length) {
        const key = `${kind}|${area.where}`;
        const prev = tally.get(key);
        if (prev) prev.count += matches.length;
        else tally.set(key, { kind, where: area.where, count: matches.length });
      }
    }
  }
  return [...tally.values()];
}
