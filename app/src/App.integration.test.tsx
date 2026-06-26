// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  // App reads/writes an anonymous counter on mount/export; stub fetch so it resolves quietly.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ count: 0 }) })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const previewText = () => document.querySelector('.paper-backdrop')?.textContent ?? '';

describe('Editor ↔ preview integration', () => {
  it('typing From / To flows into the rendered letter', () => {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('Commanding Officer, [your command]'), {
      target: { value: 'Commanding Officer, USS Example' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Chief of Naval Operations/), {
      target: { value: 'Chief of Naval Operations' },
    });
    const p = previewText();
    expect(p).toContain('Commanding Officer, USS Example');
    expect(p).toContain('Chief of Naval Operations');
  });

  it('editing a body paragraph flows into the preview', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Paragraph 1. text'), {
      target: { value: 'unique-body-content-xyz' },
    });
    expect(previewText()).toContain('unique-body-content-xyz');
  });

  it('switching to a memorandum renders the MEMORANDUM heading', () => {
    render(<App />);
    expect(previewText()).not.toContain('MEMORANDUM');
    fireEvent.change(screen.getByLabelText('Correspondence type'), {
      target: { value: 'memo-from-to' },
    });
    expect(previewText()).toContain('MEMORANDUM');
  });

  it('the Features tab swaps the editor/preview for the features page', () => {
    render(<App />);
    expect(document.querySelector('.paper-backdrop')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Features' }));
    expect(screen.getByText('Available now')).toBeTruthy();
    expect(document.querySelector('.paper-backdrop')).toBeNull();
  });

  // Regression guard for the endorsement redesign: a Via endorsement must APPEND page(s)
  // after the letter, never replace it (the original "it covers the original doc" bug).
  it('adding a Via endorsement appends it — the basic letter is NOT replaced', () => {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('Commanding Officer, [your command]'), {
      target: { value: 'Commanding Officer, USS Example' },
    });

    // add a Via addressee (the "+ Add" inside the Routing card)
    const routingCard = screen.getByRole('heading', { name: 'Routing' }).closest('.card')!;
    fireEvent.click(within(routingCard as HTMLElement).getByText('+ Add'));
    fireEvent.change(screen.getByLabelText('Via addressee 1'), {
      target: { value: 'Commander, Carrier Strike Group ONE' },
    });

    // add the endorsement (pre-fills the endorser from the Via)
    fireEvent.click(screen.getByText('+ Add endorsement'));

    const p = previewText();
    // the basic letter is still fully present...
    expect(p).toContain('Commanding Officer, USS Example');
    expect(p).toContain('This letter was produced by the yeomanizer');
    // ...AND the endorsement is appended, From <- the Via addressee
    expect(p).toContain('FIRST ENDORSEMENT on');
    expect(p).toContain('Commander, Carrier Strike Group ONE');
  });

  it('enabling CUI renders the banners + designation block with the ISOO label', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('checkbox', { name: /contains CUI/i }));
    const backdrop = document.querySelector('.paper-backdrop')!;
    expect(backdrop.querySelector('.cui-top')?.textContent).toContain('CUI');
    expect(backdrop.querySelector('.cui-bottom')?.textContent).toContain('CUI');
    const desig = backdrop.querySelector('.cui-designation')?.textContent ?? '';
    expect(desig).toContain('Limited Dissemination Control'); // corrected ISOO term
    expect(desig).not.toContain('Distribution/Dissemination'); // old wrong label stays gone
  });

  it('selecting the NATO travel order renders the form with the translated rank code', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Correspondence type'), { target: { value: 'nato' } });
    const p = previewText();
    expect(p).toContain('NATO TRAVEL ORDER');
    expect(p).toContain('OF-2'); // default grade O-3 -> OF-2 (STANAG 2116)
  });

  // Regression guard for the memo/letter toggle bug ("toggle to memo and there's still SSIC
  // stuff"): a memorandum's only ID symbol is the date — no SSIC line (§10-2).
  it('toggling memo<->letter shows/hides the SSIC line (memo = date only)', () => {
    render(<App />);
    const typeSel = screen.getByLabelText('Correspondence type');
    expect(previewText()).toContain('SSIC'); // letter: SSIC line present
    fireEvent.change(typeSel, { target: { value: 'memo-from-to' } });
    const memo = previewText();
    expect(memo).toContain('MEMORANDUM');
    expect(memo).not.toContain('SSIC'); // memo: no SSIC line
    fireEvent.change(typeSel, { target: { value: 'standard-letter' } });
    expect(previewText()).toContain('SSIC'); // back to a letter: SSIC returns
    expect(previewText()).not.toContain('MEMORANDUM');
  });
});
