import { describe, it, expect } from 'vitest';
import { serializeProject, parseProject } from './roundtrip';
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

describe('project-file round-trip (.yeomanizer.json)', () => {
  it('serialize → parse preserves the full state', () => {
    const back = parseProject(serializeProject(state));
    expect(back).toEqual(state);
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
