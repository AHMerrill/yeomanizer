// Lightweight inline markup for emphasis (SECNAV M-5216.5 allows bold/underline/italic for
// occasional emphasis). The user types it as plain text; every renderer parses it the SAME way:
//   **bold**   *italic*   __underline__
// Non-nested by design — keeps the parser tiny, predictable, and safe (it only ever produces data
// runs; nothing is executed). Unmatched markers are left as literal text.
export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

// Order matters: try the double markers (**bold**, __underline__) before the single (*italic*).
const TOKEN = /\*\*([^*]+?)\*\*|__([^_]+?)__|\*([^*]+?)\*/g;

export function parseInline(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  let last = 0;
  TOKEN.lastIndex = 0; // shared global regex — reset stateful lastIndex before each use
  for (let m = TOKEN.exec(text); m; m = TOKEN.exec(text)) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    if (m[1] !== undefined) runs.push({ text: m[1], bold: true });
    else if (m[2] !== undefined) runs.push({ text: m[2], underline: true });
    else runs.push({ text: m[3], italic: true });
    last = TOKEN.lastIndex;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.length ? runs : [{ text }];
}

// True when the text actually contains a complete marker pair (so renderers can fast-path plain text).
export function hasInlineMarkup(text: string): boolean {
  TOKEN.lastIndex = 0;
  return TOKEN.test(text);
}
