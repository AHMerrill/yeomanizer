import nspell, { type NSpell } from 'nspell';
import type { LetterState, Paragraph } from '../types';

// Offline spell-check. The dictionary (en_US Hunspell, SCOWL-derived, MIT AND BSD) is bundled in the
// app at /spell/ and fetched once from OUR OWN origin; nspell (MIT) runs entirely in the browser. Your
// draft is tokenized and checked against that local dictionary in memory — nothing is logged, stored,
// or transmitted, and no document text ever leaves the page (same posture as the PII scan). It is
// advisory: it flags words not in the dictionary, which includes proper nouns and uncommon acronyms.

let speller: NSpell | null = null;
let loading: Promise<NSpell> | null = null;

// Loads the bundled dictionary once (same-origin, lazy) and builds the checker. Cached for the session.
export async function loadSpeller(): Promise<NSpell> {
  if (speller) return speller;
  if (!loading) {
    loading = (async () => {
      const [aff, dic] = await Promise.all([
        fetch('/spell/en_US.aff').then((r) => r.text()),
        fetch('/spell/en_US.dic').then((r) => r.text()),
      ]);
      speller = nspell(aff, dic);
      return speller;
    })();
  }
  return loading;
}

// Naval / military / correspondence terms a general dictionary doesn't know but that are correct here,
// so they don't show up as "misspellings." Lowercase; extra entries are harmless.
const ALLOW = new Set([
  'ssic', 'navadmin', 'maradmin', 'almar', 'genadmin', 'alnav', 'nmci', 'secnav', 'secnavinst',
  'opnav', 'opnavinst', 'bupers', 'bumed', 'comnavsurfpac', 'mcpon', 'usmc', 'usn', 'usni', 'dod',
  'dodi', 'dodm', 'don', 'jag', 'ojag', 'navy', 'sndl', 'uic', 'edipi', 'fpo', 'apo', 'cac', 'gfe',
  'cui', 'fouo', 'prvcy', 'propin', 'fedcon', 'noforn', 'isoo', 'subj', 'encl', 'encls', 'refs',
  'yeomanizer', 'yeoman', 'addressee', 'addressees', 'originator', 'mfr', 'navmc', 'navpers', 'opord',
  'frago', 'conus', 'oconus', 'nato', 'sofa', 'stanag', 'pii', 'phi', 'foia',
]);

export interface SpellHit {
  word: string;
  count: number;
  suggest: string[];
}

// The prose worth checking: subject + body (paragraph titles and text). From/To/Via, references,
// enclosure titles, names, and codes are skipped — they are mostly proper nouns and citations that
// would just produce noise.
const paraText = (p: Paragraph[]): string =>
  p.map((x) => `${x.title ?? ''} ${x.text} ${paraText(x.children)}`).join(' ');

export function draftProse(s: LetterState): string {
  return `${s.subj}  ${paraText(s.body)}`;
}

export function checkText(sp: NSpell, text: string): SpellHit[] {
  const hits = new Map<string, number>();
  for (const raw of text.match(/[A-Za-z'’]+/g) || []) {
    const w = raw.replace(/[’]/g, "'").replace(/^'+|'+$/g, '');
    const lw = w.toLowerCase();
    if (lw.length < 3) continue; // ignore 1–2 letter tokens
    if (ALLOW.has(lw)) continue;
    if (sp.correct(w) || sp.correct(lw)) continue;
    hits.set(w, (hits.get(w) ?? 0) + 1);
  }
  return [...hits.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([word, count]) => ({ word, count, suggest: sp.suggest(word.toLowerCase()).slice(0, 3) }));
}
