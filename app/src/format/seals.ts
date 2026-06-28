import dow from '../assets/dow-seal.png';
import dod from '../assets/dod-seal.png';
import dodColor from '../assets/dod-seal.svg';
import don from '../assets/don-seal.svg';
import type { LetterState } from '../types';

// Seal asset URLs. These are IMPORTED (not referenced as fixed /public paths) so Vite content-hashes
// each filename — when a seal is recolored its URL changes, so the browser/CDN never serves a stale
// cached copy after a deploy. One shared map for the preview, the NATO form, and the .docx/PDF loader.
export const SEAL_URL: Record<LetterState['letterhead']['seal'], string | null> = {
  dow,
  dod,
  'dod-color': dodColor,
  don,
  none: null,
};
