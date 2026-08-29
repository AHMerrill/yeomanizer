// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { EnclosureMerge } from './EnclosureMerge';

// The merge itself is covered in export/mergePdfs.test.ts; here we only pin the message the user
// actually reads back, so an encrypted enclosure can never be reported as a "non-PDF file" again.
const mergeMock = vi.hoisted(() => vi.fn());
vi.mock('../export/mergePdfs', () => ({ mergePdfs: mergeMock }));

afterEach(() => {
  cleanup();
  mergeMock.mockReset();
});

function addFiles(names: string[]) {
  const input = screen.getByLabelText('Add PDF files to combine') as HTMLInputElement;
  const files = names.map((n) => new File([new Uint8Array([1, 2, 3])], n, { type: 'application/pdf' }));
  fireEvent.change(input, { target: { files } });
}

async function clickBuild() {
  fireEvent.click(screen.getByText(/Build combined PDF/));
}

describe('EnclosureMerge UI', () => {
  it('renders the combine control with instructions and a labelled file input', () => {
    render(<EnclosureMerge />);
    expect(screen.getByText('Combine into one PDF')).toBeTruthy();
    expect(screen.getByLabelText('Add PDF files to combine')).toBeTruthy();
    // the file list + Build button only appear once files are added
    expect(screen.queryByText(/Build combined PDF/)).toBeNull();
  });

  it('names a secured PDF and explains the re-save workaround, not "non-PDF"', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    mergeMock.mockResolvedValue({
      bytes: new Uint8Array([37, 80, 68, 70]),
      pageCount: 2,
      skipped: [1],
      encrypted: [1],
    });

    render(<EnclosureMerge />);
    addFiles(['letter.pdf', 'NAVPERS_1626-7.pdf']);
    await clickBuild();

    await waitFor(() => {
      const msg = screen.getByText(/Combined 2 page\(s\)/).textContent ?? '';
      expect(msg).toContain('NAVPERS_1626-7.pdf');
      expect(msg).toContain('password-protected or secured');
      expect(msg).toContain('re-save');
      expect(msg).not.toContain('non-PDF');
    });
  });

  it('distinguishes an unreadable file from a secured one', async () => {
    mergeMock.mockResolvedValue({
      bytes: new Uint8Array(),
      pageCount: 0,
      skipped: [0],
      encrypted: [],
    });

    render(<EnclosureMerge />);
    addFiles(['notes.pdf']);
    await clickBuild();

    await waitFor(() => {
      const msg = screen.getByText(/Nothing to download/).textContent ?? '';
      expect(msg).toContain('notes.pdf');
      expect(msg).toContain('not a readable PDF');
      expect(msg).not.toContain('secured');
    });
  });
});
