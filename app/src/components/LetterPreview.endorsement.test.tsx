// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { LetterPreview } from './LetterPreview';
import { defaultState } from '../defaultState';
import type { LetterState } from '../types';

afterEach(cleanup);

// Fig 9-2: a new-page endorsement on the endorser's own letterhead. The letterhead is typed as a
// block of lines, so its page must show exactly those lines — no faint STREET ADDRESS / CITY STATE
// ZIP+4 hints under a real address.
const endo = (letterhead: string): LetterState['endorsements'][number] => ({
  id: 'e1',
  endorser: 'Commanding Officer, Navy Reserve Center Atlanta',
  serial: '',
  letterhead,
  body: [],
  sigName: 'A. B. SEADOG',
  sigTitle: '',
});

// The preview also renders an off-screen measuring copy of each page, so pick the letterheads by
// their activity line rather than by position.
function endorsementLetterheads(state: LetterState): HTMLElement[] {
  const { container } = render(<LetterPreview state={state} />);
  return Array.from(container.querySelectorAll<HTMLElement>('.letterhead')).filter((el) =>
    el.textContent?.includes('NAVY RESERVE CENTER ATLANTA'),
  );
}

const sealCount = (state: LetterState) => {
  const { container } = render(<LetterPreview state={state} />);
  const n = container.querySelectorAll('img.seal').length;
  cleanup();
  return n;
};

describe('endorsement letterhead in the preview', () => {
  it('shows a full four-line letterhead with no placeholder hints', () => {
    const lhs = endorsementLetterheads({
      ...defaultState,
      endorsements: [
        endo('DEPARTMENT OF THE NAVY\nNAVY RESERVE CENTER ATLANTA\n1210 NAVAL FORCES COURT BUILDING 440\nATLANTA GA 30069-5000'),
      ],
    });
    expect(lhs.length).toBeGreaterThan(0);
    for (const lh of lhs) {
      expect(lh.querySelectorAll('.ph')).toHaveLength(0);
      expect(Array.from(lh.querySelectorAll('.lh-sub')).map((d) => d.textContent)).toEqual([
        'NAVY RESERVE CENTER ATLANTA',
        '1210 NAVAL FORCES COURT BUILDING 440',
        'ATLANTA GA 30069-5000',
      ]);
    }
  });

  it('shows no hints for a short letterhead either', () => {
    const lhs = endorsementLetterheads({
      ...defaultState,
      endorsements: [endo('DEPARTMENT OF THE NAVY\nNAVY RESERVE CENTER ATLANTA')],
    });
    expect(lhs.length).toBeGreaterThan(0);
    for (const lh of lhs) {
      expect(lh.querySelectorAll('.ph')).toHaveLength(0);
      expect(lh.textContent).not.toMatch(/STREET ADDRESS|CITY STATE/);
    }
  });

  it('prints no letterhead or seal when the endorsement is set to plain paper', () => {
    const lines = 'DEPARTMENT OF THE NAVY\nNAVY RESERVE CENTER ATLANTA\nATLANTA GA 30069-5000';
    const off = { ...defaultState, endorsements: [{ ...endo(lines), letterheadMode: 'off' as const }] };
    expect(endorsementLetterheads(off)).toHaveLength(0);
    cleanup();
    expect(sealCount(off)).toBe(sealCount({ ...defaultState, endorsements: [endo('')] }));
  });

  it('draws the seal on an endorsement page with its own letterhead', () => {
    const plain = sealCount({ ...defaultState, endorsements: [endo('')] });
    const withLh = sealCount({
      ...defaultState,
      endorsements: [endo('DEPARTMENT OF THE NAVY\nNAVY RESERVE CENTER ATLANTA\nATLANTA GA 30069-5000')],
    });
    expect(plain).toBeGreaterThan(0); // the basic letter's seal
    expect(withLh).toBe(plain * 2); // ...and the same again on the endorsement page
  });
});
