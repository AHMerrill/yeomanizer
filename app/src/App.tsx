import { useEffect, useState } from 'react';
import { defaultState } from './defaultState';
import type { LetterState } from './types';
import { Editor } from './components/Editor';
import { LetterPreview } from './components/LetterPreview';
import { About } from './components/About';
import { PreviewErrorBoundary } from './components/PreviewErrorBoundary';
import { printLetter } from './export/print';
import { getDownloadCount, recordDownload } from './api/counter';
import './App.css';

export default function App() {
  const [state, setState] = useState<LetterState>(defaultState);
  const [downloads, setDownloads] = useState<number | null>(null);
  const [view, setView] = useState<'editor' | 'about'>('editor');

  useEffect(() => {
    getDownloadCount().then(setDownloads);
  }, []);

  const bump = () =>
    recordDownload().then((n) => {
      if (typeof n === 'number') setDownloads(n);
    });

  const onDocx = async () => {
    // Lazy-load the .docx exporter (and the heavy `docx` library it pulls in) only when the
    // user actually exports — keeps ~all of it out of the initial page bundle.
    const { exportDocx } = await import('./export/docx');
    await exportDocx(state);
    void bump();
  };

  const onPrint = () => {
    const after = () => {
      void bump();
      window.removeEventListener('afterprint', after);
    };
    window.addEventListener('afterprint', after);
    printLetter();
  };

  return (
    <div className="app">
      <div className="disclaimer">
        <strong>Unofficial tool</strong> — not affiliated with or endorsed by the U.S. Navy or
        DoD, and not an official system of record. You are responsible for following CUI and all
        other information-handling rules. Nothing you type is saved or transmitted — it lives only
        in this browser tab and is erased when you close it.
      </div>

      <header className="toolbar">
        <div className="brand">
          the&nbsp;yeomanizer
          <span className="brand-sub">naval correspondence, formatted</span>
        </div>
        <nav className="tabs">
          <button className={view === 'editor' ? 'tab on' : 'tab'} onClick={() => setView('editor')}>
            Editor
          </button>
          <button className={view === 'about' ? 'tab on' : 'tab'} onClick={() => setView('about')}>
            Features
          </button>
        </nav>
        <div className="grow" />
        {view === 'editor' && state.type !== 'nato' && (
          <button onClick={() => void onDocx()}>Export .docx</button>
        )}
        {view === 'editor' && (
          <button className="primary" onClick={onPrint}>
            Print / Save PDF
          </button>
        )}
      </header>

      {view === 'editor' ? (
        <main className="panes">
          {/* autoComplete + spellCheck off so the browser never stores or transmits entries
              (e.g. autofill history, Chrome Enhanced Spellcheck). */}
          <form
            className="editor-pane"
            autoComplete="off"
            spellCheck={false}
            onSubmit={(e) => e.preventDefault()}
          >
            <Editor state={state} setState={setState} />
          </form>
          <div className="paper-backdrop">
            <PreviewErrorBoundary>
              <LetterPreview state={state} />
            </PreviewErrorBoundary>
          </div>
        </main>
      ) : (
        <About />
      )}

      <footer className="footer">
        <span>
          Questions? <a href="mailto:info@yeomanizer.com">info@yeomanizer.com</a>
        </span>
        <span className="foot-mid">
          Your draft never leaves this browser — only an anonymous, site-wide download tally (a
          number, never any content) is recorded.
        </span>
        <span
          className="foot-count"
          title="A site-wide count of completed downloads across all users. No document content, personal data, or identifiers are ever sent or stored — only an integer is incremented."
        >
          Downloads: {downloads === null ? '—' : downloads.toLocaleString()}
        </span>
      </footer>
    </div>
  );
}
