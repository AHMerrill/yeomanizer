// Minimal type declaration for nspell (no bundled types). Only the surface we use.
declare module 'nspell' {
  export interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
    add(word: string): NSpell;
  }
  export default function nspell(aff: string, dic: string): NSpell;
}
