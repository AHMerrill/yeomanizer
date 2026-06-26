// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EnclosureMerge } from './EnclosureMerge';

afterEach(cleanup);

describe('EnclosureMerge UI', () => {
  it('renders the combine control with instructions and a labelled file input', () => {
    render(<EnclosureMerge />);
    expect(screen.getByText('Combine into one PDF')).toBeTruthy();
    expect(screen.getByLabelText('Add PDF files to combine')).toBeTruthy();
    // the file list + Build button only appear once files are added
    expect(screen.queryByText(/Build combined PDF/)).toBeNull();
  });
});
