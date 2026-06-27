// Dev-only visual harness. `buildSignablePdf` runs in this (jsdom) test env, so we render real
// sample PDFs to disk and inspect them with the Read tool (which rasterizes PDF pages) — that's
// how we verify the vector layout without a human in the loop. Gated so normal test runs skip it:
//   GEN_PDF=1 npx vitest run src/export/_render_samples.test.ts
import { it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildSignablePdf } from './signablePdf';
import { defaultState } from '../defaultState';
import type { LetterState } from '../types';

const RUN = process.env.GEN_PDF === '1';
const today = new Date(2006, 8, 7);
const OUT = '/tmp/ynpdf';

const base: LetterState = {
  ...defaultState,
  ssic: '5216',
  serial: '0123',
  includeSsic: true,
  includeCode: true,
  originatorCode: 'N1',
  from: 'Commanding Officer, USS Yeoman (DDG 1000)',
  to: 'Chief of Naval Operations (N1)',
  via: [{ id: 'v1', text: 'Commander, Naval Surface Force, U.S. Pacific Fleet' }],
  subj: 'EXAMPLE NAVAL LETTER FORMAT FOR LAYOUT VERIFICATION',
  signature: { name: 'I. M. SAILOR', title: '', authority: 'none' },
};

(RUN ? it : it.skip)('render sample PDFs to disk', async () => {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/basic.pdf`, await buildSignablePdf(base, today));

  const endo: LetterState = {
    ...base,
    endorsements: [
      {
        id: 'e1',
        endorser: 'Commander, Naval Surface Force, U.S. Pacific Fleet',
        serial: '',
        body: [
          { id: 'eb1', text: 'Forwarded, recommending approval.', children: [] },
          { id: 'eb2', text: 'The requested action is fully supported by this command.', children: [] },
        ],
        sigName: 'A. B. SEADOG',
        sigTitle: '',
        authority: 'by-direction',
      },
    ],
  };
  writeFileSync(`${OUT}/endorsement.pdf`, await buildSignablePdf(endo, today));

  const cui: LetterState = { ...base, cui: { ...base.cui, enabled: true } };
  writeFileSync(`${OUT}/cui.pdf`, await buildSignablePdf(cui, today));

  const longBody: LetterState = {
    ...base,
    body: Array.from({ length: 16 }, (_, i) => ({
      id: `b${i}`,
      text:
        `Paragraph ${i + 1}. ` +
        'This is filler text used to push the letter onto a second page so continuation spacing and the centered page number can be verified. '.repeat(
          3,
        ),
      children: [],
    })),
  };
  writeFileSync(`${OUT}/multipage.pdf`, await buildSignablePdf(longBody, today));
});
