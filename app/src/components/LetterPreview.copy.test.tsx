// @vitest-environment jsdom
import { it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { LetterPreview } from './LetterPreview';
import { defaultState } from '../defaultState';

afterEach(cleanup);

// The gap after a paragraph marker or title is a fixed-width box. Empty, it made text copied out of
// the preview read "1.Per" and "Approver.Per"; it now holds a no-break space.
it('text copied from the preview keeps the space after markers and titles', () => {
  const { container } = render(
    <LetterPreview
      state={{
        ...defaultState,
        body: [{ id: 'p1', title: 'Purpose', text: 'Per reference (a).', children: [] }],
      }}
    />,
  );
  const para = container.querySelector('.page:not(.measurer) p.para')!;
  expect(para.textContent).toBe('1. Purpose. Per reference (a).');
});
