import { describe, it, expect } from 'vitest';
import { Packer } from 'docx';
import { buildDocxDocument } from './docx';
import { embedStateInDocx, extractStateFromDocx, serializeState, deserializeState } from './roundtrip';
import { defaultState } from '../defaultState';
import type { LetterState } from '../types';

const state: LetterState = {
  ...defaultState,
  from: 'Commanding Officer, USS Test',
  to: 'Chief of Naval Operations',
  subj: 'ROUND TRIP TEST',
  body: [{ id: 'b1', text: 'hello world', children: [{ id: 'b2', text: 'a child paragraph', children: [] }] }],
  cui: { ...defaultState.cui, enabled: true },
};

describe('round-trip state bundle', () => {
  it('serialize → deserialize preserves the full state', async () => {
    const back = await deserializeState(await serializeState(state));
    expect(back).toEqual(state);
  });

  it('drops enclosure file bytes when not included, keeps titles/flags', async () => {
    const withEncl: LetterState = {
      ...state,
      encls: [
        { id: 'e', text: 'photo', inDocument: true, file: { name: 'p.png', type: 'image/png', dataUrl: 'data:image/png;base64,AAAA' } },
      ],
    };
    const back = await deserializeState(await serializeState(withEncl, false));
    expect(back?.encls[0].text).toBe('photo');
    expect(back?.encls[0].inDocument).toBe(true);
    expect(back?.encls[0].file).toBeUndefined();
  });

  it('round-trips through a real .docx (and the doc still opens)', async () => {
    const docx = new Uint8Array(await Packer.toBuffer(buildDocxDocument(state, new Date(2006, 8, 7))));
    const embedded = await embedStateInDocx(docx, state);
    const back = await extractStateFromDocx(embedded);
    expect(back?.subj).toBe('ROUND TRIP TEST');
    expect(back?.body[0].children[0].text).toBe('a child paragraph');
    expect(back?.cui.enabled).toBe(true);
  });

  it('returns null for a docx with no embedded state', async () => {
    const docx = new Uint8Array(await Packer.toBuffer(buildDocxDocument(state, new Date(2006, 8, 7))));
    expect(await extractStateFromDocx(docx)).toBeNull();
  });
});
