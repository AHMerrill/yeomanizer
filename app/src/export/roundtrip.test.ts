import { describe, it, expect } from 'vitest';
import { serializeProject, parseProject } from './roundtrip';
import { defaultState, defaultFor } from '../defaultState';
import { TEMPLATES } from '../data/templates';
import type { LetterState, CorrespondenceType } from '../types';

const state: LetterState = {
  ...defaultState,
  from: 'Commanding Officer, USS Test',
  to: 'Chief of Naval Operations',
  subj: 'ROUND TRIP TEST',
  body: [{ id: 'b1', text: 'hello world', children: [{ id: 'b2', text: 'a child paragraph', children: [] }] }],
  cui: { ...defaultState.cui, enabled: true },
};

describe('project-file round-trip (.yeomanizer.json)', () => {
  it('serialize → parse preserves the full state', () => {
    const back = parseProject(serializeProject(state));
    expect(back).toEqual(state);
  });

  it('round-trips an MFR losslessly (type + MFR defaults survive)', () => {
    const mfr: LetterState = {
      ...defaultFor('mfr'),
      subj: 'TELEPHONE CONVERSATION WITH NAVSEA',
      signature: { name: 'E. S. HOWARD', title: 'N11', authority: 'none' },
    };
    const back = parseProject(serializeProject(mfr));
    expect(back).toEqual(mfr); // type='mfr', letterhead off, includeSsic/Code false, MFR body, signature
    expect(back?.type).toBe('mfr');
  });

  it('round-trips a business letter losslessly (type + business fields survive)', () => {
    const business: LetterState = {
      ...defaultFor('business-letter'),
      business: {
        insideAddress: 'Mr. A. B. Recipient\nExample Company, Inc.\n1234 Any Street\nAnytown, ST 12345-6789',
        attention: 'Records Manager',
        salutation: 'Dear Mr. Recipient:',
        subjectReplacesSalutation: false,
        complimentaryClose: 'Sincerely,',
        separateMailing: 'Secretarial Handbook',
      },
    };
    const back = parseProject(serializeProject(business));
    expect(back).toEqual(business);
    expect(back?.type).toBe('business-letter');
    expect(back?.business.insideAddress).toContain('Example Company');
  });

  it('round-trips a multiple-address letter (To: addressees + Distribution survive)', () => {
    const multi: LetterState = {
      ...defaultState,
      from: 'Commander, Submarine Group TWO',
      to: 'Commander, Submarine Squadron TWO',
      toAddrs: [
        { id: 'ta1', text: 'Commander, Submarine Squadron FOUR' },
        { id: 'ta2', text: 'Commander, Submarine Squadron TWELVE' },
      ],
      distribution: [{ id: 'd1', text: 'COMSUBFOR NORFOLK (4 copies)' }],
    };
    const back = parseProject(serializeProject(multi));
    expect(back).toEqual(multi);
    expect(back?.toAddrs).toHaveLength(2);
    expect(back?.distribution[0].text).toBe('COMSUBFOR NORFOLK (4 copies)');
  });

  it('round-trips an MOA losslessly (kind, parties, second signer survive)', () => {
    const moa: LetterState = { ...defaultFor('moa') };
    const back = parseProject(serializeProject(moa));
    expect(back).toEqual(moa);
    expect(back?.moa.partyA).toContain('Naval Air');
    expect(back?.moa.signerB.title).toBe('Deputy');
  });

  it('round-trips a joint letter losslessly (parties + per-command signers survive)', () => {
    const joint: LetterState = { ...defaultFor('joint-letter') };
    const back = parseProject(serializeProject(joint));
    expect(back).toEqual(joint);
    expect(back?.joint.parties).toHaveLength(2);
    expect(back?.joint.parties[0].shortTitle).toBe('NAVSEA');
    expect(back?.joint.parties[1].signer.name).toBe('J. K. JANICKI');
  });

  it('bounds a hostile joint parties array on import (no giant arrays survive)', () => {
    const hostile = JSON.stringify({
      v: 1,
      state: {
        ...defaultState,
        joint: { kind: 'LETTER', parties: Array.from({ length: 99 }, () => ({ command: 'X', signer: {} })) },
      },
    });
    const back = parseProject(hostile);
    expect(back?.joint.parties.length).toBeLessThanOrEqual(6);
  });

  it('bounds a hostile list field on import (no giant arrays survive)', () => {
    const hostile = JSON.stringify({
      v: 1,
      state: {
        ...defaultState,
        toAddrs: Array.from({ length: 5000 }, (_, i) => ({ id: `x${i}`, text: 'A' })),
        copyTo: Array.from({ length: 5000 }, () => 'X'),
      },
    });
    const back = parseProject(hostile);
    expect(back?.toAddrs.length).toBeLessThanOrEqual(100);
    expect(back?.copyTo.length).toBeLessThanOrEqual(100);
  });

  it('is plain, human-readable JSON (no code, no compression)', () => {
    const text = serializeProject(state);
    expect(() => JSON.parse(text)).not.toThrow();
    expect(text).toContain('"v": 1');
    expect(text).toContain('ROUND TRIP TEST');
  });

  it('drops enclosure file bytes when not included, keeps titles/flags', () => {
    const withEncl: LetterState = {
      ...state,
      encls: [
        { id: 'e', text: 'photo', inDocument: true, file: { name: 'p.png', type: 'image/png', dataUrl: 'data:image/png;base64,AAAA' } },
      ],
    };
    const back = parseProject(serializeProject(withEncl, false));
    expect(back?.encls[0].text).toBe('photo');
    expect(back?.encls[0].file).toBeUndefined();
  });

  it('strips a non-image/pdf data URL on import (defense against a hand-edited file)', () => {
    const obj = JSON.parse(serializeProject(state));
    obj.state.encls = [
      { id: 'x', text: 'x', inDocument: true, file: { name: 'x', type: 'text/html', dataUrl: 'data:text/html,<script>alert(1)</script>' } },
    ];
    const back = parseProject(JSON.stringify(obj));
    expect(back?.encls[0].file).toBeUndefined(); // hostile URL refused
  });

  it('returns null for non-yeomanizer JSON or garbage', () => {
    expect(parseProject('{"hello":"world"}')).toBeNull();
    expect(parseProject('not json at all')).toBeNull();
  });

  it('strips prototype-pollution keys on import', () => {
    const hostile =
      '{"v":1,"state":{"type":"standard-letter","from":"X","body":[],"__proto__":{"polluted":true},"constructor":{"bad":1}}}';
    const back = parseProject(hostile);
    expect(back?.from).toBe('X');
    // the dangerous keys did not reach Object.prototype
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('parseProject — body-tree hardening', () => {
  const wrapState = (overrides: object): string =>
    JSON.stringify({ v: 1, state: { ...defaultState, ...overrides } });

  it('coerces malformed nodes (wrong-typed text, non-array children)', () => {
    const back = parseProject(wrapState({ body: [{ id: 'a', text: { evil: 1 }, children: 'nope' }] }));
    expect(back).not.toBeNull();
    expect(back!.body[0].text).toBe('');
    expect(back!.body[0].children).toEqual([]);
  });

  it('rejects a body that exceeds the node cap (render-DoS guard)', () => {
    const huge = Array.from({ length: 2001 }, (_, i) => ({ id: `n${i}`, text: 't', children: [] }));
    expect(parseProject(wrapState({ body: huge }))).toBeNull();
  });

  it('drops nesting beyond the depth cap (stack-overflow guard)', () => {
    let node: unknown = { id: 'leaf', text: 'deep', children: [] };
    for (let i = 0; i < 20; i++) node = { id: `d${i}`, text: 't', children: [node] };
    const back = parseProject(wrapState({ body: [node] }));
    expect(back).not.toBeNull();
    let p = back!.body[0];
    let depth = 0;
    while (p.children.length) {
      p = p.children[0];
      depth++;
    }
    expect(depth).toBeLessThanOrEqual(12);
  });
});

// "Upload 20 times each": every type must be a lossless FIXPOINT under repeated export→import —
// each of 20 round-trips reproduces the original state exactly, so re-importing a downloaded .json
// (and re-exporting, and re-importing…) never drifts or silently drops a type-specific field.
describe('every correspondence type survives 20 serialize→parse round-trips unchanged', () => {
  const TYPES: CorrespondenceType[] = [
    'standard-letter',
    'memo-from-to',
    'mfr',
    'business-letter',
    'endorsement',
    'moa',
    'joint-letter',
    'exec-memo',
    'coordination-page',
    'nato',
  ];
  for (const t of TYPES) {
    it(`${t}: 20 round-trips are a lossless fixpoint`, () => {
      const original = defaultFor(t);
      let cur: LetterState = original;
      for (let i = 0; i < 20; i++) {
        const back = parseProject(serializeProject(cur));
        expect(back, `${t} round-trip #${i + 1} returned null`).not.toBeNull();
        expect(back, `${t} drifted on round-trip #${i + 1}`).toEqual(original);
        cur = back!;
      }
    });
  }
});

// The starter templates carry the trickier field combinations (copyTo, inside address, editable
// close, titleOnly letterhead, congressional/interim/flag content) — round-trip each 20× too.
describe('every starter template survives 20 serialize→parse round-trips unchanged', () => {
  for (const tmpl of TEMPLATES) {
    it(`template "${tmpl.id}": 20 round-trips are a lossless fixpoint`, () => {
      const original = tmpl.build();
      let cur: LetterState = original;
      for (let i = 0; i < 20; i++) {
        const back = parseProject(serializeProject(cur));
        expect(back, `${tmpl.id} round-trip #${i + 1} returned null`).not.toBeNull();
        expect(back, `${tmpl.id} drifted on round-trip #${i + 1}`).toEqual(original);
        cur = back!;
      }
    });
  }
});
