import { describe, it, expect } from 'vitest';
import { syncViaEndorsements, defaultState } from './defaultState';
import type { LetterState, ListEntry } from './types';

const withVia = (via: ListEntry[], over: Partial<LetterState> = {}): LetterState => ({
  ...defaultState,
  via,
  ...over,
});

describe('syncViaEndorsements — one auto-endorsement per Via addressee', () => {
  it('creates a via-linked endorsement for each non-empty Via (From = the via)', () => {
    const s = syncViaEndorsements(withVia([{ id: 'v1', text: 'Commander, X' }]));
    expect(s.endorsements).toHaveLength(1);
    expect(s.endorsements[0]).toMatchObject({ viaId: 'v1', endorser: 'Commander, X' });
  });

  it('ignores empty / whitespace-only Via rows', () => {
    expect(syncViaEndorsements(withVia([{ id: 'v1', text: '   ' }])).endorsements).toHaveLength(0);
  });

  it('removes a Via’s endorsement when the Via is cleared', () => {
    const filled = syncViaEndorsements(withVia([{ id: 'v1', text: 'Cmdr A' }]));
    const cleared = syncViaEndorsements({ ...filled, via: [{ id: 'v1', text: '' }] });
    expect(cleared.endorsements).toHaveLength(0);
  });

  it('updates the endorser but preserves a typed body when the Via text changes', () => {
    const start: LetterState = {
      ...defaultState,
      via: [{ id: 'v1', text: 'Cmdr A' }],
      endorsements: [
        {
          id: 'e1',
          viaId: 'v1',
          endorser: 'Cmdr A',
          serial: '',
          body: [{ id: 'b', text: 'forwarded', children: [] }],
          sigName: '',
          sigTitle: '',
        },
      ],
    };
    const next = syncViaEndorsements({ ...start, via: [{ id: 'v1', text: 'Cmdr A (updated)' }] });
    expect(next.endorsements[0].endorser).toBe('Cmdr A (updated)'); // From follows the Via
    expect(next.endorsements[0].body[0].text).toBe('forwarded'); // typed body kept
  });

  it('keeps manually-added (non-via) endorsements, after the via ones', () => {
    const manual = {
      id: 'm1',
      endorser: 'Manual endorser',
      serial: '',
      body: [],
      sigName: '',
      sigTitle: '',
    };
    const s = syncViaEndorsements(withVia([{ id: 'v1', text: 'Cmdr A' }], { endorsements: [manual] }));
    expect(s.endorsements.map((e) => e.viaId ?? 'manual')).toEqual(['v1', 'manual']);
  });

  it('two Vias create two endorsements, in Via order', () => {
    const s = syncViaEndorsements(
      withVia([
        { id: 'v1', text: 'A' },
        { id: 'v2', text: 'B' },
      ]),
    );
    expect(s.endorsements.map((e) => e.endorser)).toEqual(['A', 'B']);
  });

  it('does nothing for types that do not take appended endorsements (e.g. NATO)', () => {
    const s = syncViaEndorsements(withVia([{ id: 'v1', text: 'Cmdr A' }], { type: 'nato' }));
    expect(s.endorsements).toHaveLength(0);
  });
});
