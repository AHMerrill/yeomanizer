// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PreviewErrorBoundary } from './PreviewErrorBoundary';

afterEach(cleanup);

function Boom(): never {
  throw new Error('preview blew up');
}

describe('PreviewErrorBoundary', () => {
  it('renders children normally when they do not throw', () => {
    render(
      <PreviewErrorBoundary>
        <div>preview content</div>
      </PreviewErrorBoundary>,
    );
    expect(screen.getByText('preview content')).toBeTruthy();
  });

  it('shows a recoverable fallback instead of crashing when a child throws', () => {
    // React logs caught render errors to console.error; silence that expected noise.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <PreviewErrorBoundary>
        <Boom />
      </PreviewErrorBoundary>,
    );
    expect(screen.getByText(/rendering error/i)).toBeTruthy();
    expect(screen.getByText(/your text is safe/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /retry preview/i })).toBeTruthy();
    spy.mockRestore();
  });
});
