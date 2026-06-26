// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
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
});
