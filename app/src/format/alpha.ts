// Spreadsheet-style alpha sequence: 0 -> a, 25 -> z, 26 -> aa, 27 -> ab, ...
// Shared by paragraph sub-lists (a., b., …) and reference letters (Ref (a), (b), …)
// so the two can never drift apart.
export function alphaIndex(i: number): string {
  let s = '';
  let n = i;
  do {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}
