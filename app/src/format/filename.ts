import type { LetterState } from '../types';

// A short, recognizable stem per correspondence type, so a download isn't always "naval-letter".
const TYPE_SLUG: Record<LetterState['type'], string> = {
  'standard-letter': 'naval-letter',
  'memo-from-to': 'memorandum',
  mfr: 'memorandum-for-record',
  'business-letter': 'business-letter',
  endorsement: 'endorsement',
  nato: 'travel-order',
};

// Type-aware download name: "<type>-<subject>.<ext>" (subject slugged + capped; omitted if blank).
// e.g. business-letter-preparation-of-a-business-letter.pdf
export function documentFilename(state: LetterState, ext: string): string {
  const stem = TYPE_SLUG[state.type] ?? 'naval-letter';
  const subj = (state.subj || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${stem}${subj ? `-${subj}` : ''}.${ext}`;
}
