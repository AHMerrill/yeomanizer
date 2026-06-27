// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  // App records an anonymous visit on mount + a download on export; stub fetch so it resolves quietly.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ downloads: 0, visits: 0 }) })),
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
    fireEvent.click(screen.getByRole('tab', { name: 'Features' }));
    expect(screen.getByText('Available now')).toBeTruthy();
    expect(document.querySelector('.paper-backdrop')).toBeNull();
  });

  // Regression guard for the endorsement redesign: a Via endorsement must APPEND page(s)
  // after the letter, never replace it (the original "it covers the original doc" bug).
  it('adding a Via AUTO-creates its endorsement page — basic letter NOT replaced', () => {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('Commanding Officer, [your command]'), {
      target: { value: 'Commanding Officer, USS Example' },
    });

    // add a Via addressee — its endorsement page must appear automatically (no extra step)
    const routingCard = screen.getByRole('heading', { name: 'Routing' }).closest('.card')!;
    fireEvent.click(within(routingCard as HTMLElement).getByText('+ Add'));
    fireEvent.change(screen.getByLabelText('Via addressee 1'), {
      target: { value: 'Commander, Carrier Strike Group ONE' },
    });

    const p = previewText();
    expect(p).toContain('Commanding Officer, USS Example'); // basic letter intact
    expect(p).toContain('This letter was produced by the yeomanizer');
    expect(p).toContain('FIRST ENDORSEMENT on'); // auto-appended, no button click
    expect(p).toContain('Commander, Carrier Strike Group ONE'); // From <- the Via addressee
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

  it('two Via addressees auto-create FIRST and SECOND endorsements', () => {
    render(<App />);
    const routingCard = screen.getByRole('heading', { name: 'Routing' }).closest('.card')!;
    fireEvent.click(within(routingCard as HTMLElement).getByText('+ Add'));
    fireEvent.change(screen.getByLabelText('Via addressee 1'), { target: { value: 'Commander, CSG ONE' } });
    fireEvent.click(within(routingCard as HTMLElement).getByText('+ Add'));
    fireEvent.change(screen.getByLabelText('Via addressee 2'), {
      target: { value: 'Commander, Pacific Fleet' },
    });
    const p = previewText();
    expect(p).toContain('FIRST ENDORSEMENT');
    expect(p).toContain('SECOND ENDORSEMENT');
    expect(p).toContain('This letter was produced by the yeomanizer'); // basic letter intact
  });

  it('“+ Add a standalone endorsement” adds one not tied to a Via', () => {
    render(<App />);
    fireEvent.click(screen.getByText('+ Add a standalone endorsement'));
    expect(previewText()).toContain('FIRST ENDORSEMENT');
  });

  it('CUI portion markings are per-paragraph and enable overall CUI', () => {
    render(<App />);
    // enabling CUI alone does NOT mark any paragraph (no (CUI)/(U) prefixes yet)
    fireEvent.click(screen.getByRole('checkbox', { name: /contains CUI/i }));
    expect(previewText()).not.toContain('(CUI)');
    expect(previewText()).not.toMatch(/\(U\)/);
    // toggle the first paragraph's (CUI): it gets (CUI), the others get (U)
    const togs = screen.getAllByTitle(/Toggle \(CUI\) portion marking/i);
    fireEvent.click(togs[0]);
    const p = previewText();
    expect(p).toContain('(CUI)');
    expect(p).toMatch(/\(U\)/);
  });

  it('marking a paragraph (CUI) turns on the overall CUI banner', () => {
    render(<App />);
    const backdrop = () => document.querySelector('.paper-backdrop')!;
    expect(backdrop().querySelector('.cui-top')).toBeNull(); // no banner yet
    fireEvent.click(screen.getAllByTitle(/Toggle \(CUI\) portion marking/i)[0]);
    expect(backdrop().querySelector('.cui-top')).not.toBeNull(); // banner appears
  });

  it('letterhead modes: printed shows the letterhead; plain & pre-printed hide it', () => {
    render(<App />);
    expect(previewText()).toContain('DEPARTMENT OF THE NAVY'); // default: printed
    fireEvent.click(screen.getByRole('button', { name: 'Plain paper' }));
    expect(previewText()).not.toContain('DEPARTMENT OF THE NAVY');
    fireEvent.click(screen.getByRole('button', { name: 'Pre-printed paper' }));
    expect(previewText()).not.toContain('DEPARTMENT OF THE NAVY'); // space reserved, no ink
    fireEvent.click(screen.getByRole('button', { name: 'Print letterhead' }));
    expect(previewText()).toContain('DEPARTMENT OF THE NAVY'); // back on
  });

  it('the Seal style choice swaps the letterhead seal image', () => {
    render(<App />);
    const sealSrc = () =>
      document.querySelector('.paper-backdrop img.seal')?.getAttribute('src') ?? null;
    expect(sealSrc()).toBe('/dod-seal.png'); // default: manual letterhead blue
    fireEvent.change(screen.getByLabelText('Seal'), { target: { value: 'dod-color' } });
    expect(sealSrc()).toBe('/dod-seal.svg'); // full-color vector
    fireEvent.change(screen.getByLabelText('Seal'), { target: { value: 'none' } });
    expect(sealSrc()).toBeNull(); // no seal
  });

  it('each correspondence type keeps its own draft (no carry-over between types)', () => {
    render(<App />);
    const typeSel = screen.getByLabelText('Correspondence type');
    const subj = () =>
      screen.getByPlaceholderText('Subject in all caps, no punctuation') as HTMLTextAreaElement;
    fireEvent.change(subj(), { target: { value: 'LETTER SUBJECT' } });
    fireEvent.change(typeSel, { target: { value: 'memo-from-to' } });
    expect(subj().value).toBe(''); // memo has its own (empty) draft — nothing carried over
    fireEvent.change(subj(), { target: { value: 'MEMO SUBJECT' } });
    fireEvent.change(typeSel, { target: { value: 'standard-letter' } });
    expect(subj().value).toBe('LETTER SUBJECT'); // the letter's draft is restored
    fireEvent.change(typeSel, { target: { value: 'memo-from-to' } });
    expect(subj().value).toBe('MEMO SUBJECT'); // the memo's draft is restored
  });

  it('a Via endorsement forwards the REMAINING Vias in its own Via line (§9-2.2)', () => {
    render(<App />);
    const routingCard = screen.getByRole('heading', { name: 'Routing' }).closest('.card')!;
    fireEvent.click(within(routingCard as HTMLElement).getByText('+ Add'));
    fireEvent.change(screen.getByLabelText('Via addressee 1'), { target: { value: 'Commander Alpha' } });
    fireEvent.click(within(routingCard as HTMLElement).getByText('+ Add'));
    fireEvent.change(screen.getByLabelText('Via addressee 2'), { target: { value: 'Commander Bravo' } });
    // the FIRST endorsement (by Alpha) must carry "Via: Commander Bravo"
    const firstEndoText =
      [...document.querySelectorAll('.endorsement-line')]
        .map((el) => el.closest('.page')?.textContent ?? '')
        .find((t) => t.includes('FIRST ENDORSEMENT'))
        ?.replace(/\s+/g, ' ') ?? '';
    expect(firstEndoText).toContain('Via:');
    expect(firstEndoText).toContain('Commander Bravo');
  });
});
